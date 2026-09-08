import type { JazzCashConfig } from "../../config.js";
import { buildSecureHash } from "./hash.js";
import { STATUS_INQUIRY_V2_PATH } from "./client.js";

/**
 * Minimum wait, per status-inquiry gotcha #2 ("a minimum of 10 minutes after
 * transaction initiated"), before the *first* inquiry for a payment attempt.
 * Enforced by the caller (the reconciliation route/job), not this client.
 */
export const STATUS_INQUIRY_MINIMUM_DELAY_MILLISECONDS = 10 * 60 * 1000;

export interface StatusInquiryResult {
  readonly ppResponseCode: string;
  readonly ppPaymentResponseCode: string | undefined;
  readonly ppStatus: string | undefined;
  readonly ppAmount: string | undefined;
  readonly raw: Record<string, unknown>;
}

export type StatusInquiryOutcome =
  | { readonly kind: "paid"; readonly result: StatusInquiryResult }
  | { readonly kind: "not_completed"; readonly result: StatusInquiryResult }
  | { readonly kind: "ambiguous"; readonly reason: string };

/**
 * Call JazzCash Status Inquiry v2.0 (chosen over v1.1 because only v2.0 echoes
 * pp_Amount/pp_TxnRefNo for reconciliation) and classify the result.
 *
 * pp_ResponseCode is the *Status Inquiry operation's own* result, never the
 * payment's (status-inquiry gotcha #1 — the single most likely defect in this
 * API). Only pp_PaymentResponseCode === "121" together with
 * pp_Status === "Completed" means paid; every other value is "not completed",
 * not a specific documented failure. Response pp_SecureHash verification is
 * explicitly NOT DOCUMENTED IN SOURCE, so it is not attempted here.
 *
 * A timeout, connection failure, or non-JSON body is ambiguous, never a
 * failure (the go-live checklist's transport-failure item) — the caller must
 * not treat "ambiguous" as "not completed".
 */
export async function performStatusInquiry(
  txnRefNo: string,
  config: JazzCashConfig,
  fetchImplementation: typeof fetch = fetch,
): Promise<StatusInquiryOutcome> {
  const requestFields = {
    pp_TxnRefNo: txnRefNo,
    pp_MerchantID: config.merchantId,
    pp_Password: config.password,
  };
  const requestBody = {
    ...requestFields,
    pp_SecureHash: buildSecureHash(requestFields, config.integritySalt),
  };
  const url = `${config.baseUrl}${STATUS_INQUIRY_V2_PATH}`;

  let response: Response;
  try {
    response = await fetchImplementation(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    return {
      kind: "ambiguous",
      reason: `Status Inquiry request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      kind: "ambiguous",
      reason: `Status Inquiry returned a non-JSON body (HTTP ${response.status}).`,
    };
  }

  if (typeof body !== "object" || body === null) {
    return {
      kind: "ambiguous",
      reason: "Status Inquiry returned an unexpected body shape.",
    };
  }

  const record = body as Record<string, unknown>;
  const result: StatusInquiryResult = {
    ppResponseCode:
      typeof record.pp_ResponseCode === "string" ? record.pp_ResponseCode : "",
    ppPaymentResponseCode:
      typeof record.pp_PaymentResponseCode === "string"
        ? record.pp_PaymentResponseCode
        : undefined,
    ppStatus: typeof record.pp_Status === "string" ? record.pp_Status : undefined,
    ppAmount: typeof record.pp_Amount === "string" ? record.pp_Amount : undefined,
    raw: record,
  };

  if (result.ppPaymentResponseCode === "121" && result.ppStatus === "Completed") {
    return { kind: "paid", result };
  }
  return { kind: "not_completed", result };
}
