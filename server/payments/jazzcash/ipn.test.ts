// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSecureHash } from "./hash.js";
import {
  IPN_ACKNOWLEDGEMENT,
  interpretIpnPayload,
  redactIpnPayloadForStorage,
} from "./ipn.js";

describe("JazzCash IPN handling", () => {
  it("verifies the exact worked sample payload from ipn-implementation document", () => {
    const salt = "0123456789";
    const samplePayload = {
      pp_AuthCode: "060935465981",
      pp_Password: "0123456789",
      pp_ResponseCode: "121",
      pp_ResponseMessage:
        "Transaction has been marked confirmed by Merchant.",
      pp_RetreivalReferenceNo: "240418718258",
      pp_TxnDateTime: "20240418145702",
      pp_TxnRefNo: "T20240418145702",
      pp_TxnType: "MWALLET",
      pp_Version: "2.0",
      pp_BankID: "",
      pp_ProductID: null,
      pp_SettlementExpiry: null,
      pp_SecureHash:
        "2B47BCF7825FA27FC8B522292BC8D226213FCCDA685FC68A67EC20B10836E5B7",
    };

    const outcome = interpretIpnPayload(samplePayload, salt);
    expect(outcome).toEqual({
      kind: "verified",
      txnRefNo: "T20240418145702",
      status: "paid",
      responseCode: "121",
      responseMessage: "Transaction has been marked confirmed by Merchant.",
    });
  });

  it("handles pending and failure response codes correctly", () => {
    const salt = "test-salt";
    const base = {
      pp_TxnRefNo: "TRN123",
      pp_ResponseMessage: "Status message",
      pp_Amount: "100",
    };

    // Pending code 013
    const pendingPayload = {
      ...base,
      pp_ResponseCode: "013",
      pp_SecureHash: "DUMMY",
    };
    pendingPayload.pp_SecureHash = buildSecureHash(pendingPayload, salt);

    const pendingOutcome = interpretIpnPayload(pendingPayload, salt);
    expect(pendingOutcome.kind).toBe("verified");
    if (pendingOutcome.kind === "verified") {
      expect(pendingOutcome.status).toBe("ambiguous");
    }

    // Failure code 199
    const failedPayload = {
      ...base,
      pp_ResponseCode: "199",
      pp_SecureHash: "DUMMY",
    };
    failedPayload.pp_SecureHash = buildSecureHash(failedPayload, salt);

    const failedOutcome = interpretIpnPayload(failedPayload, salt);
    expect(failedOutcome.kind).toBe("verified");
    if (failedOutcome.kind === "verified") {
      expect(failedOutcome.status).toBe("failed");
    }
  });

  it("rejects an invalid signature", () => {
    const payload = {
      pp_TxnRefNo: "TRN123",
      pp_ResponseCode: "121",
      pp_SecureHash: "INVALID_HASH_HEX",
    };
    expect(interpretIpnPayload(payload, "salt")).toEqual({
      kind: "invalid_signature",
    });
  });

  it("rejects malformed payloads", () => {
    expect(interpretIpnPayload(null, "salt")).toEqual({
      kind: "malformed",
      reason: "Payload must be a non-null object.",
    });
    expect(interpretIpnPayload({ pp_ResponseCode: "121" }, "salt")).toEqual({
      kind: "malformed",
      reason: "Missing or invalid pp_TxnRefNo.",
    });
  });

  it("redacts pp_Password for audit logging and storage", () => {
    const payload = {
      pp_TxnRefNo: "TRN123",
      pp_Password: "supersecretpassword",
      pp_ResponseCode: "121",
    };
    const redacted = redactIpnPayloadForStorage(payload);
    expect(redacted).toContain('"pp_Password":"[REDACTED]"');
    expect(redacted).not.toContain("supersecretpassword");
  });

  it("exports standard 000 IPN acknowledgement", () => {
    expect(IPN_ACKNOWLEDGEMENT).toEqual({
      pp_ResponseCode: "000",
      pp_ResponseMessage: "IPN received successfully",
    });
  });
});
