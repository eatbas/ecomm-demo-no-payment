import { verifySecureHash } from "./hash.js";

export const IPN_ACKNOWLEDGEMENT = {
  pp_ResponseCode: "000",
  pp_ResponseMessage: "IPN received successfully",
} as const;

const SUCCESS_RESPONSE_CODE = "121";

export type IpnOutcome =
  | { readonly kind: "invalid_signature" }
  | { readonly kind: "malformed" }
  // pp_ResponseCode === "121": trigger Status Inquiry to confirm before settling.
  | { readonly kind: "reported_success"; readonly txnRefNo: string }
  // Every other value — "199", "999", or anything undocumented — per
  // ipn-implementation gotcha #13: NOT necessarily a failure. Resolve via
  // Status Inquiry rather than settling here in either direction.
  | { readonly kind: "unresolved"; readonly txnRefNo: string };

function stringOrNullFields(
  record: Record<string, unknown>,
): Record<string, string | null> {
  const fields: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      fields[key] = value;
    } else if (value === null) {
      fields[key] = null;
    }
    // Non-string, non-null values (should not occur on pp_-prefixed fields)
    // are simply excluded from hashing rather than coerced.
  }
  return fields;
}

/**
 * Verify and classify one inbound IPN notification. Verifies pp_SecureHash
 * before anything else (ipn-implementation gotcha #18 — nothing else
 * authenticates the caller). Never returns a "paid"/"failed" verdict itself:
 * the IPN carries no amount or currency (gotcha #14), so the caller must
 * always corroborate with Status Inquiry before changing an order's state.
 */
export function interpretIpnPayload(
  body: unknown,
  integritySalt: string,
): IpnOutcome {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { kind: "malformed" };
  }

  const record = body as Record<string, unknown>;
  const txnRefNo = record.pp_TxnRefNo;
  if (typeof txnRefNo !== "string" || txnRefNo.length === 0) {
    return { kind: "malformed" };
  }

  const providedHash =
    typeof record.pp_SecureHash === "string" ? record.pp_SecureHash : undefined;
  if (!verifySecureHash(stringOrNullFields(record), integritySalt, providedHash)) {
    return { kind: "invalid_signature" };
  }

  const responseCode =
    typeof record.pp_ResponseCode === "string" ? record.pp_ResponseCode : "";
  return responseCode === SUCCESS_RESPONSE_CODE
    ? { kind: "reported_success", txnRefNo }
    : { kind: "unresolved", txnRefNo };
}

/**
 * Redact the one field the IPN payload is documented to echo back verbatim
 * (ipn-implementation gotcha #17) before the raw payload is persisted for
 * audit.
 */
export function redactIpnPayloadForStorage(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return JSON.stringify(body ?? null);
  }
  const record = { ...(body as Record<string, unknown>) };
  if ("pp_Password" in record) {
    record.pp_Password = "[redacted]";
  }
  return JSON.stringify(record);
}
