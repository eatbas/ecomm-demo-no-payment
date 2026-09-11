import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { JazzCashConfig } from "../config.js";
import type { OrderService } from "../orders/order.service.js";
import {
  buildCardRedirectionFields,
  createTxnRefNo,
} from "../payments/jazzcash/client.js";
import {
  IPN_ACKNOWLEDGEMENT,
  interpretIpnPayload,
  redactIpnPayloadForStorage,
} from "../payments/jazzcash/ipn.js";
import { renderCardRedirectionPage } from "../payments/jazzcash/redirect-page.js";
import type { PaymentRepository } from "../payments/payment.repository.js";

export interface RegisterPaymentRoutesOptions {
  readonly app: FastifyInstance;
  readonly orderService: OrderService;
  readonly paymentRepository: PaymentRepository;
  readonly jazzcash: JazzCashConfig;
}

export function registerPaymentRoutes(options: RegisterPaymentRoutesOptions): void {
  const { app, orderService, paymentRepository, jazzcash } = options;

  if (!app.hasContentTypeParser("application/x-www-form-urlencoded")) {
    app.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_req, body, done) => {
        try {
          const bodyStr = typeof body === "string" ? body : body.toString("utf8");
          const params = new URLSearchParams(bodyStr);
          const parsed: Record<string, string> = {};
          for (const [key, value] of params.entries()) {
            parsed[key] = value;
          }
          done(null, parsed);
        } catch (err) {
          done(err as Error, undefined);
        }
      },
    );
  }

  // Lightweight order status polling endpoint
  app.get<{ Params: { id: string } }>(
    "/api/orders/:id/status",
    (request, reply) => {
      const order = orderService.findById(request.params.id);
      if (order === undefined) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "The requested resource was not found.",
        });
      }

      return reply.code(200).send({
        id: order.id,
        reference: order.reference,
        paymentStatus: order.paymentStatus,
      });
    },
  );

  // Hosted card payment redirection endpoint
  app.get<{ Params: { id: string } }>(
    "/api/orders/:id/payment/redirect",
    (request, reply) => {
      const order = orderService.findById(request.params.id);
      if (order === undefined) {
        return reply.code(404).send({
          code: "NOT_FOUND",
          message: "The requested resource was not found.",
        });
      }

      if (order.paymentStatus === "paid") {
        return reply.redirect(
          `/checkout/confirmation?order=${encodeURIComponent(order.id)}`,
          303,
        );
      }

      const now = new Date();
      const txnRefNo = createTxnRefNo(now);

      paymentRepository.initiate({
        orderId: order.id,
        ppTxnRefNo: txnRefNo,
        amountPaisa: order.subtotalCents,
        initiatedAt: now.toISOString(),
      });

      const fields = buildCardRedirectionFields({
        amountPaisa: order.subtotalCents,
        billReference: order.reference,
        description: `Order ${order.reference}`,
        txnRefNo,
        config: jazzcash,
        now,
      });

      const nonce = randomBytes(16).toString("base64");
      const html = renderCardRedirectionPage(fields, jazzcash.baseUrl, nonce);

      const targetOrigin = new URL(jazzcash.baseUrl).origin;
      reply.header(
        "Content-Security-Policy",
        `default-src 'none'; base-uri 'none'; form-action 'self' ${targetOrigin}; frame-ancestors 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'`,
      );

      return reply.type("text/html; charset=utf-8").send(html);
    },
  );

  // Return route from JazzCash customer redirection
  const handleReturn = (request: FastifyRequest, reply: FastifyReply) => {
    const payload =
      request.body && typeof request.body === "object"
        ? (request.body as Record<string, unknown>)
        : request.query && typeof request.query === "object"
          ? (request.query as Record<string, unknown>)
          : {};

    const txnRefNo =
      typeof payload.pp_TxnRefNo === "string" ? payload.pp_TxnRefNo : undefined;

    if (txnRefNo !== undefined) {
      const payment = paymentRepository.findByTxnRefNo(txnRefNo);
      if (payment !== undefined) {
        if (typeof payload.pp_ResponseCode === "string") {
          const outcome = interpretIpnPayload(payload, jazzcash.integritySalt);
          if (outcome.kind === "verified") {
            paymentRepository.resolve({
              ppTxnRefNo: outcome.txnRefNo,
              status: outcome.status,
              ppResponseCode: outcome.responseCode,
              ppStatus: null,
              resolvedAt: new Date().toISOString(),
              eventSource: "return_redirect",
              rawPayload: redactIpnPayloadForStorage(payload),
            });
          }
        }
        return reply.redirect(
          `/checkout/confirmation?order=${encodeURIComponent(payment.orderId)}`,
          303,
        );
      }
    }

    const orderParam =
      typeof payload.order === "string"
        ? payload.order
        : typeof payload.orderId === "string"
          ? payload.orderId
          : undefined;

    if (orderParam !== undefined) {
      return reply.redirect(
        `/checkout/confirmation?order=${encodeURIComponent(orderParam)}`,
        303,
      );
    }

    return reply.redirect("/checkout", 303);
  };

  app.route({
    method: ["GET", "POST"],
    url: "/api/payments/return",
    handler: handleReturn,
  });

  // Server-to-server IPN webhook endpoint
  app.post("/api/payments/ipn", (request, reply) => {
    const outcome = interpretIpnPayload(request.body, jazzcash.integritySalt);

    if (outcome.kind === "malformed") {
      return reply.code(400).send({
        pp_ResponseCode: "999",
        pp_ResponseMessage: outcome.reason,
      });
    }

    if (outcome.kind === "invalid_signature") {
      return reply.code(400).send({
        pp_ResponseCode: "999",
        pp_ResponseMessage: "Invalid signature.",
      });
    }

    const payment = paymentRepository.findByTxnRefNo(outcome.txnRefNo);
    if (payment === undefined) {
      return reply.code(404).send({
        pp_ResponseCode: "999",
        pp_ResponseMessage: "Transaction reference was not found.",
      });
    }

    paymentRepository.resolve({
      ppTxnRefNo: outcome.txnRefNo,
      status: outcome.status,
      ppResponseCode: outcome.responseCode,
      ppStatus: null,
      resolvedAt: new Date().toISOString(),
      eventSource: "ipn",
      rawPayload: redactIpnPayloadForStorage(request.body),
    });

    return reply.code(200).send(IPN_ACKNOWLEDGEMENT);
  });
}
