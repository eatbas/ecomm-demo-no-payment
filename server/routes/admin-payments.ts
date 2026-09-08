import type { FastifyInstance } from "fastify";
import type { JazzCashConfig } from "../config.js";
import {
  performStatusInquiry,
  STATUS_INQUIRY_MINIMUM_DELAY_MILLISECONDS,
} from "../payments/jazzcash/status-inquiry.js";
import type { PaymentRecord, PaymentRepository } from "../payments/payment.repository.js";

const TRANSACTION_EXPIRY_MILLISECONDS = 24 * 60 * 60 * 1000; // matches pp_TxnExpiryDateTime, +1 day

interface RecheckParams {
  readonly txnRefNo: string;
}

export interface AdminPaymentRouteDependencies {
  readonly paymentRepository: PaymentRepository;
  readonly jazzcash: JazzCashConfig;
}

/**
 * Admin-triggered reconciliation for a payment stuck `awaiting_payment` or
 * `ambiguous`. There is no scheduler in this deployment, so this endpoint is
 * the documented substitute for a periodic job (create-plan Phase 4).
 *
 * Status Inquiry only ever proves "paid" or "not yet completed" — it defines
 * no failure code (status-inquiry gotchas: "anything other than 121 is NOT
 * DOCUMENTED IN SOURCE"). This route's "failed" verdict is therefore this
 * application's own business rule, not a JazzCash-documented one: only once
 * the transaction's own expiry window (pp_TxnExpiryDateTime, +1 day) has
 * passed AND Status Inquiry still reports "not completed" is the payment
 * given up on. Before expiry, "not completed" stays `ambiguous` and must be
 * re-checked later.
 */
export function registerAdminPaymentRoutes(
  app: FastifyInstance,
  deps: AdminPaymentRouteDependencies,
): void {
  app.post<{ Params: RecheckParams }>(
    "/api/admin/payments/:txnRefNo/recheck",
    async (request, reply) => {
      const payment = deps.paymentRepository.findByTxnRefNo(
        request.params.txnRefNo,
      );
      if (payment === undefined) {
        return reply
          .code(404)
          .send({ code: "NOT_FOUND", message: "The requested resource was not found." });
      }
      if (payment.status === "paid") {
        return reply.send({ status: "paid" satisfies PaymentRecord["status"] });
      }

      const initiatedAt = Date.parse(payment.initiatedAt);
      const elapsedMilliseconds = Date.now() - initiatedAt;
      if (elapsedMilliseconds < STATUS_INQUIRY_MINIMUM_DELAY_MILLISECONDS) {
        return reply.code(429).send({
          code: "INVALID_REQUEST",
          message:
            "JazzCash Status Inquiry must not be called within 10 minutes of initiating the payment.",
        });
      }

      const outcome = await performStatusInquiry(
        payment.ppTxnRefNo,
        deps.jazzcash,
      );
      const resolvedAt = new Date().toISOString();

      if (outcome.kind === "paid") {
        const resolved = deps.paymentRepository.resolve({
          ppTxnRefNo: payment.ppTxnRefNo,
          status: "paid",
          ppResponseCode: outcome.result.ppResponseCode,
          ppStatus: outcome.result.ppStatus ?? null,
          resolvedAt,
          eventSource: "status_inquiry",
          rawPayload: JSON.stringify(outcome.result.raw),
        });
        return reply.send({ status: resolved.status });
      }

      if (outcome.kind === "ambiguous") {
        // Transport failure: leave (or set) ambiguous, never fail on this alone.
        const resolved = deps.paymentRepository.resolve({
          ppTxnRefNo: payment.ppTxnRefNo,
          status: "ambiguous",
          ppResponseCode: null,
          ppStatus: null,
          resolvedAt,
          eventSource: "status_inquiry",
          rawPayload: JSON.stringify({ transportError: outcome.reason }),
        });
        return reply.code(202).send({ status: resolved.status, reason: outcome.reason });
      }

      const isExpired =
        Date.now() - initiatedAt >= TRANSACTION_EXPIRY_MILLISECONDS;
      const resolved = deps.paymentRepository.resolve({
        ppTxnRefNo: payment.ppTxnRefNo,
        status: isExpired ? "failed" : "ambiguous",
        ppResponseCode: outcome.result.ppResponseCode,
        ppStatus: outcome.result.ppStatus ?? null,
        resolvedAt,
        eventSource: "status_inquiry",
        rawPayload: JSON.stringify(outcome.result.raw),
      });
      return reply.code(isExpired ? 200 : 202).send({ status: resolved.status });
    },
  );
}
