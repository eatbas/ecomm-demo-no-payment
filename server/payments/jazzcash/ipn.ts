import type { PaymentStatus } from "../../../shared/orders.js";
import { verifySecureHash } from "./hash.js";

export const IPN_ACKNOWLEDGEMENT = Object.freeze({
  pp_ResponseCode: "000",
  pp_ResponseMessage: "IPN received successfully",
});

const PENDING_CODES = new Set(["013", "124", "157"]);

export type InterpretedIpnOutcome =
  | { readonly kind: "malformed"; readonly reason: string }
  | { readonly kind: "invalid_signature" }
  | {
      readonly kind: "verified";
      readonly txnRefNo: string;
      readonly status: Extract<PaymentStatus, "paid" | "failed" | "ambiguous">;
      readonly responseCode: string;
      readonly responseMessage: string;
    };

/**
 * Interpret and verify an inbound IPN notification from JazzCash.
 */
export function interpretIpnPayload(
  payload: unknown,
  integritySalt: string,
): InterpretedIpnOutcome {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { kind: "malformed", reason: "Payload must be a non-null object." };
  }

  const record = payload as Record<string, unknown>;
  const txnRefNo = record.pp_TxnRefNo;
  if (typeof txnRefNo !== "string" || txnRefNo.trim() === "") {
    return { kind: "malformed", reason: "Missing or invalid pp_TxnRefNo." };
  }

  const responseCode = record.pp_ResponseCode;
  if (typeof responseCode !== "string" || responseCode.trim() === "") {
    return { kind: "malformed", reason: "Missing or invalid pp_ResponseCode." };
  }

  const responseMessage =
    typeof record.pp_ResponseMessage === "string" ? record.pp_ResponseMessage : "";

  const secureHash = record.pp_SecureHash;
  if (typeof secureHash !== "string" || secureHash.trim() === "") {
    return { kind: "malformed", reason: "Missing or invalid pp_SecureHash." };
  }

  // Convert payload values to strings for hash verification
  const stringFields: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      stringFields[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      stringFields[key] = String(value);
    } else {
      stringFields[key] = null;
    }
  }

  if (!verifySecureHash(stringFields, integritySalt, secureHash)) {
    return { kind: "invalid_signature" };
  }

  let status: Extract<PaymentStatus, "paid" | "failed" | "ambiguous">;
  if (responseCode === "121") {
    status = "paid";
  } else if (PENDING_CODES.has(responseCode)) {
    status = "ambiguous";
  } else {
    status = "failed";
  }

  return {
    kind: "verified",
    txnRefNo,
    status,
    responseCode,
    responseMessage,
  };
}

/**
 * Redact sensitive password and secret credentials before persisting or logging IPN payloads.
 */
export function redactIpnPayloadForStorage(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "{}";
  }

  const sanitized = { ...(payload as Record<string, unknown>) };
  if ("pp_Password" in sanitized) {
    sanitized.pp_Password = "[REDACTED]";
  }

  return JSON.stringify(sanitized);
}
