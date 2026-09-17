import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { JazzCashConfig } from "../config.js";
import type { OrderService } from "../orders/order.service.js";
import {
  calculateSecureHash,
  formatPktDateTime,
  generateTxnRefNo,
  verifySecureHash,
} from "../payments/jazzcash/jazzcash.crypto.js";
import type {
  JazzCashIpnAcknowledgement,
  PaymentTransactionStatus,
} from "../payments/jazzcash/jazzcash.types.js";

const PENDING_RESPONSE_CODES = new Set(["013", "124", "157"]);

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] ?? character,
  );
}

function resolvePaymentStatus(responseCode: string | undefined): PaymentTransactionStatus {
  if (responseCode === "121") {
    return "paid";
  }
  if (responseCode !== undefined && PENDING_RESPONSE_CODES.has(responseCode)) {
    return "pending";
  }
  return "failed";
}

function renderRedirectHtml(postUrl: string, parameters: Record<string, string>): string {
  const inputs = Object.entries(parameters)
    .map(
      ([name, val]) =>
        `      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(val)}">`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redirecting to JazzCash…</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
    .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 24rem; width: 90%; }
    .spinner { width: 2.5rem; height: 2.5rem; border: 3px solid #e2e8f0; border-top-color: #0284c7; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1.25rem; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 0.5rem; }
    p { font-size: 0.875rem; color: #64748b; margin: 0 0 1.5rem; line-height: 1.5; }
    button { background: #0284c7; color: white; border: none; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 0.875rem; }
    button:hover { background: #0369a1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Redirecting to JazzCash</h1>
    <p>Please wait while we securely transfer you to complete your payment.</p>
    <form id="jazzcash" method="post" action="${escapeHtml(postUrl)}">
${inputs}
      <noscript>
        <button type="submit">Click here to continue to JazzCash</button>
      </noscript>
    </form>
  </div>
  <script>
    document.getElementById('jazzcash').submit();
  </script>
</body>
</html>`;
}

export function registerPaymentRoutes(
  app: FastifyInstance,
  service: OrderService,
  jazzcashConfig: JazzCashConfig | undefined,
): void {
  // Hosted payment redirection endpoint
  app.get<{ Params: { orderId: string } }>(
    "/api/payments/redirect/:orderId",
    async (request, reply) => {
      if (jazzcashConfig === undefined) {
        return reply.code(503).send({
          code: "PAYMENT_NOT_CONFIGURED",
          message: "JazzCash payment gateway is not configured.",
        });
      }

      const order = service.findOrderById(request.params.orderId);
      if (order === undefined) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "The requested order was not found.",
        });
      }

      const now = new Date();
      const expiry = new Date(now.getTime() + 86_400_000); // 1 day
      const txnRefNo =
        order.transaction?.txnRefNo ?? generateTxnRefNo("TRN", now);
      const amountPaisa =
        order.transaction?.amountPaisa?.toString() ??
        order.subtotalCents.toString();

      // Ensure transaction record exists
      if (order.transaction === undefined) {
        service.repository.createTransaction({
          id: `txn_${order.id}`,
          orderId: order.id,
          txnRefNo,
          txnType: "MPAY",
          amountPaisa: order.subtotalCents,
          currency: "PKR",
          status: "initiated",
          createdAt: now.toISOString(),
        });
      }

      const parameters: Record<string, string> = {
        pp_Version: "1.1",
        pp_TxnType: "MPAY",
        pp_Language: "EN",
        pp_MerchantID: jazzcashConfig.merchantId,
        pp_Password: jazzcashConfig.password,
        pp_TxnRefNo: txnRefNo,
        pp_Amount: amountPaisa,
        pp_TxnCurrency: "PKR",
        pp_TxnDateTime: formatPktDateTime(now),
        pp_BillReference: order.reference.replace(/[^A-Za-z0-9]/g, "").slice(0, 20),
        pp_Description: `Order ${order.reference}`,
        pp_TxnExpiryDateTime: formatPktDateTime(expiry),
        pp_ReturnURL: jazzcashConfig.returnUrl,
        pp_SubMerchantID: "",
        pp_BankID: "",
        pp_ProductID: "",
        ppmpf_1: "",
        ppmpf_2: "",
        ppmpf_3: "",
        ppmpf_4: "",
        ppmpf_5: "",
      };

      parameters.pp_SecureHash = calculateSecureHash(
        parameters,
        jazzcashConfig.integritySalt,
      );

      const html = renderRedirectHtml(jazzcashConfig.postUrl, parameters);
      return reply.code(200).type("text/html; charset=utf-8").send(html);
    },
  );

  // Asynchronous Instant Payment Notification (IPN) listener
  app.post(
    "/api/payments/ipn",
    async (
      request: FastifyRequest<{ Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      if (jazzcashConfig === undefined) {
        return reply.code(503).send({
          code: "PAYMENT_NOT_CONFIGURED",
          message: "JazzCash payment gateway is not configured.",
        });
      }

      const rawBody = request.body;
      const payload: Record<string, unknown> =
        typeof rawBody === "object" && rawBody !== null ? rawBody : {};

      // Verify pp_SecureHash
      const isValid = verifySecureHash(payload, jazzcashConfig.integritySalt);
      if (!isValid) {
        request.log.warn(
          { requestId: request.id },
          "JazzCash IPN signature verification failed.",
        );
        return reply.code(400).send({
          code: "INVALID_SIGNATURE",
          message: "The IPN secure hash signature is invalid.",
        });
      }

      const txnRefNo =
        typeof payload.pp_TxnRefNo === "string"
          ? payload.pp_TxnRefNo.trim()
          : typeof payload.pp_TxnRefNo === "number"
            ? String(payload.pp_TxnRefNo)
            : "";
      const responseCode =
        typeof payload.pp_ResponseCode === "string"
          ? payload.pp_ResponseCode.trim()
          : typeof payload.pp_ResponseCode === "number"
            ? String(payload.pp_ResponseCode)
            : "";
      const responseMessage =
        typeof payload.pp_ResponseMessage === "string"
          ? payload.pp_ResponseMessage
          : undefined;
      const retrievalRefNo =
        typeof payload.pp_RetreivalReferenceNo === "string"
          ? payload.pp_RetreivalReferenceNo
          : undefined;
      const authCode =
        typeof payload.pp_AuthCode === "string"
          ? payload.pp_AuthCode
          : undefined;
      const txnDateTime =
        typeof payload.pp_TxnDateTime === "string"
          ? payload.pp_TxnDateTime
          : undefined;

      // Scrub pp_Password before storage
      const sanitizedPayload = { ...payload };
      delete sanitizedPayload.pp_Password;

      const order = service.findOrderByTxnRefNo(txnRefNo);
      if (order !== undefined) {
        const paymentStatus = resolvePaymentStatus(responseCode);
        service.updateTransactionStatus({
          txnRefNo,
          status: paymentStatus,
          responseCode,
          responseMessage,
          retrievalRefNo,
          authCode,
          txnDatetime: txnDateTime,
          rawIpnPayload: JSON.stringify(sanitizedPayload),
        });
      } else {
        request.log.warn(
          { txnRefNo },
          "Received JazzCash IPN for unrecognised transaction reference.",
        );
      }

      // Return 200 acknowledgement as prescribed by IPN specification
      const acknowledgement: JazzCashIpnAcknowledgement = {
        pp_ResponseCode: "000",
        pp_ResponseMessage: "IPN received successfully",
        pp_SecureHash: "",
      };

      return reply.code(200).type("application/json").send(acknowledgement);
    },
  );

  // Return URL callback handler (handles both POST and GET from JazzCash)
  const handleReturn = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const rawPayload = request.method === "POST" ? request.body : request.query;
    const payload: Record<string, unknown> =
      typeof rawPayload === "object" && rawPayload !== null
        ? (rawPayload as Record<string, unknown>)
        : {};

    const txnRefNo =
      typeof payload.pp_TxnRefNo === "string"
        ? payload.pp_TxnRefNo.trim()
        : typeof payload.pp_TxnRefNo === "number"
          ? String(payload.pp_TxnRefNo)
          : "";
    const responseCode =
      typeof payload.pp_ResponseCode === "string"
        ? payload.pp_ResponseCode.trim()
        : typeof payload.pp_ResponseCode === "number"
          ? String(payload.pp_ResponseCode)
          : undefined;
    const responseMessage =
      typeof payload.pp_ResponseMessage === "string"
        ? payload.pp_ResponseMessage
        : undefined;
    const retrievalRefNo =
      typeof payload.pp_RetreivalReferenceNo === "string"
        ? payload.pp_RetreivalReferenceNo
        : undefined;
    const authCode =
      typeof payload.pp_AuthCode === "string"
        ? payload.pp_AuthCode
        : undefined;

    let order = txnRefNo ? service.findOrderByTxnRefNo(txnRefNo) : undefined;
    let paymentStatus = resolvePaymentStatus(responseCode);

    if (order !== undefined && jazzcashConfig !== undefined) {
      // Validate hash if present in return payload
      if (typeof payload.pp_SecureHash === "string" && payload.pp_SecureHash) {
        const isValid = verifySecureHash(payload, jazzcashConfig.integritySalt);
        if (!isValid) {
          paymentStatus = "failed";
        }
      }

      // If transaction was still pending/initiated, update with return status
      if (
        order.transaction?.status === "initiated" ||
        order.transaction?.status === "pending"
      ) {
        order = service.updateTransactionStatus({
          txnRefNo,
          status: paymentStatus,
          responseCode,
          responseMessage,
          retrievalRefNo,
          authCode,
        });
      }
    }

    const referenceParam = order ? encodeURIComponent(order.reference) : "";
    const statusParam = encodeURIComponent(
      order?.paymentStatus ?? paymentStatus ?? "unknown",
    );
    const redirectTarget = `/checkout?reference=${referenceParam}&payment=${statusParam}`;

    return reply.redirect(redirectTarget, 303);
  };

  app.post("/api/payments/return", handleReturn);
  app.get("/api/payments/return", handleReturn);
}
