import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
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
import { PaymentNotFoundError } from "../payments/payment.repository.js";

// The path portion of JAZZCASH_RETURN_URL. Documented and enforced in
// README.md / .env.example: the configured return URL must resolve to this
// exact same-origin path.
export const JAZZCASH_RETURN_PATH = "/checkout/return";
const CONFIRMATION_PATH = "/checkout/confirmation";

interface OrderIdParams {
  readonly id: string;
}

export interface PaymentRouteDependencies {
  readonly orderService: OrderService;
  readonly paymentRepository: PaymentRepository;
  readonly jazzcash: JazzCashConfig;
}

function jazzcashOrigin(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

export function registerPaymentRoutes(
  app: FastifyInstance,
  deps: PaymentRouteDependencies,
): void {
  const { orderService, paymentRepository, jazzcash } = deps;

  app.get<{ Params: OrderIdParams }>(
    "/api/orders/:id/payment/redirect",
    (request, reply) => {
      const order = orderService.findById(request.params.id);
      if (order === undefined) {
        return reply
          .code(404)
          .send({ code: "NOT_FOUND", message: "The requested resource was not found." });
      }
      if (order.paymentStatus === "paid") {
        return reply.code(409).send({
          code: "INVALID_REQUEST",
          message: "This order has already been paid.",
        });
      }

      const now = new Date();
      // Retry semantics for a reused pp_TxnRefNo are undocumented, so every
      // initiation attempt (including a retry of the same order) mints a
      // fresh reference rather than reusing one.
      const txnRefNo = createTxnRefNo(now);
      const fields = buildCardRedirectionFields({
        amountPaisa: order.subtotalCents,
        billReference: order.reference,
        description: `Order ${order.reference}`,
        txnRefNo,
        config: jazzcash,
        now,
      });

      paymentRepository.initiate({
        orderId: order.id,
        ppTxnRefNo: txnRefNo,
        amountPaisa: order.subtotalCents,
        initiatedAt: now.toISOString(),
      });

      const nonce = randomBytes(16).toString("base64");
      const origin = jazzcashOrigin(jazzcash.baseUrl);
      // Scoped strictly to this one response: the global CSP (server/app.ts)
      // stays default-src 'none' / form-action 'self' for every other route.
      reply.header(
        "Content-Security-Policy",
        [
          "default-src 'none'",
          "base-uri 'none'",
          `form-action 'self' ${origin}`,
          `script-src 'nonce-${nonce}'`,
          "style-src 'none'",
        ].join("; "),
      );
      reply.header("Cache-Control", "no-store");
      reply.type("text/html; charset=utf-8");
      return reply.send(renderCardRedirectionPage(fields, jazzcash.baseUrl, nonce));
    },
  );

  app.get<{ Params: OrderIdParams }>("/api/orders/:id/status", (request, reply) => {
    const order = orderService.findById(request.params.id);
    if (order === undefined) {
      return reply
        .code(404)
        .send({ code: "NOT_FOUND", message: "The requested resource was not found." });
    }
    // Deliberately minimal: an order id is an unguessable UUID acting as a
    // capability token for the customer who just created it, so this is safe
    // to leave same-origin/unauthenticated, but it must never echo back the
    // customer's PII or item detail to anyone who merely guesses/replays an id.
    return reply.send({
      id: order.id,
      reference: order.reference,
      paymentStatus: order.paymentStatus,
    });
  });

  app.post("/api/payments/jazzcash/ipn", (request, reply) => {
    const outcome = interpretIpnPayload(request.body, jazzcash.integritySalt);

    if (outcome.kind === "malformed" || outcome.kind === "invalid_signature") {
      request.log.warn({ outcome }, "Rejected an unverifiable JazzCash IPN payload");
      return reply.code(400).send();
    }

    const payment = paymentRepository.findByTxnRefNo(outcome.txnRefNo);
    if (payment === undefined) {
      request.log.warn(
        { txnRefNo: outcome.txnRefNo },
        "Received a JazzCash IPN for an unknown pp_TxnRefNo",
      );
      // Still acknowledge: JazzCash retries on anything but a clean 200/000,
      // and there is nothing more useful this listener can do with a
      // reference it never initiated.
      return reply.code(200).send(IPN_ACKNOWLEDGEMENT);
    }

    if (payment.status !== "paid") {
      try {
        paymentRepository.resolve({
          ppTxnRefNo: outcome.txnRefNo,
          // The IPN alone never proves payment (no amount/currency field) and
          // a non-121 code is not necessarily a failure either — every valid,
          // verified IPN leaves the payment "ambiguous" pending Status
          // Inquiry confirmation, regardless of which branch fired above.
          status: "ambiguous",
          ppResponseCode: null,
          ppStatus: null,
          resolvedAt: new Date().toISOString(),
          eventSource: "ipn",
          rawPayload: redactIpnPayloadForStorage(request.body),
        });
      } catch (error) {
        if (!(error instanceof PaymentNotFoundError)) {
          throw error;
        }
      }
    }

    return reply.code(200).send(IPN_ACKNOWLEDGEMENT);
  });
}

export interface JazzCashReturnRouteDependencies {
  readonly paymentRepository: PaymentRepository;
}

const TXN_REF_NO_IN_BODY_PATTERN = /pp_TxnRefNo["'=:]+\s*"?([A-Za-z0-9]+)"?/;

/**
 * The redirect callback payload JazzCash posts to pp_ReturnURL is entirely
 * undocumented (card-page-redirection#response-parameters), so this route
 * never trusts the body to determine payment status — it only makes a
 * best-effort attempt to read pp_TxnRefNo back out (to route the customer to
 * the right confirmation-polling page) and always defers the actual outcome
 * to Status Inquiry/IPN. It is registered in its own encapsulated context so
 * its permissive body parser cannot affect the strict JSON-schema parsing
 * used by every other route.
 */
export function registerJazzCashReturnRoute(
  app: FastifyInstance,
  deps: JazzCashReturnRouteDependencies,
): void {
  void app.register((instance, _opts, done) => {
    instance.addContentTypeParser(
      "*",
      { parseAs: "buffer" },
      (_request, payload, contentTypeDone) => {
        contentTypeDone(null, payload);
      },
    );

    instance.post(JAZZCASH_RETURN_PATH, (request, reply) => {
      const raw = Buffer.isBuffer(request.body)
        ? request.body.toString("utf8")
        : "";
      const txnRefNo = TXN_REF_NO_IN_BODY_PATTERN.exec(raw)?.[1];
      const payment =
        txnRefNo === undefined
          ? undefined
          : deps.paymentRepository.findByTxnRefNo(txnRefNo);

      const target =
        payment === undefined
          ? CONFIRMATION_PATH
          : `${CONFIRMATION_PATH}?order=${encodeURIComponent(payment.orderId)}`;
      return reply.code(303).header("Cache-Control", "no-store").redirect(target);
    });

    done();
  });
}
