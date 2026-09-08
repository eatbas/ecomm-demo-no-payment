// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSecureHash } from "./hash.js";
import {
  interpretIpnPayload,
  redactIpnPayloadForStorage,
} from "./ipn.js";

const salt = "0123456789";

function signedPayload(overrides: Record<string, unknown> = {}) {
  const base = {
    pp_Version: "2.0",
    pp_TxnType: "MWALLET",
    pp_BankID: "",
    pp_ProductID: null,
    pp_Password: "0123456789",
    pp_TxnRefNo: "T20240418145702",
    pp_TxnDateTime: "20240418145702",
    pp_ResponseCode: "121",
    pp_ResponseMessage: "Transaction has been marked confirmed by Merchant.",
    pp_AuthCode: "060935465981",
    pp_SettlementExpiry: null,
    pp_RetreivalReferenceNo: "240418718258",
    ...overrides,
  };
  const pp_SecureHash = buildSecureHash(base, salt);
  return { ...base, pp_SecureHash };
}

describe("interpretIpnPayload", () => {
  it("reproduces the documented sample digest and reports success for pp_ResponseCode 121", () => {
    const payload = signedPayload();
    expect(payload.pp_SecureHash).toBe(
      "2B47BCF7825FA27FC8B522292BC8D226213FCCDA685FC68A67EC20B10836E5B7",
    );

    const outcome = interpretIpnPayload(payload, salt);
    expect(outcome).toEqual({ kind: "reported_success", txnRefNo: "T20240418145702" });
  });

  it("treats a non-121 response code as unresolved, not failed", () => {
    for (const code of ["199", "999", "013", "157", "anything-else"]) {
      const payload = signedPayload({ pp_ResponseCode: code });
      expect(interpretIpnPayload(payload, salt)).toEqual({
        kind: "unresolved",
        txnRefNo: "T20240418145702",
      });
    }
  });

  it("rejects a tampered payload", () => {
    const payload = signedPayload({ pp_ResponseCode: "121" });
    const tampered = { ...payload, pp_ResponseCode: "199" };
    expect(interpretIpnPayload(tampered, salt)).toEqual({ kind: "invalid_signature" });
  });

  it("rejects a payload with no pp_SecureHash at all", () => {
    const payload: Record<string, unknown> = signedPayload();
    delete payload.pp_SecureHash;
    expect(interpretIpnPayload(payload, salt)).toEqual({
      kind: "invalid_signature",
    });
  });

  it("rejects malformed bodies without a usable pp_TxnRefNo", () => {
    expect(interpretIpnPayload(null, salt)).toEqual({ kind: "malformed" });
    expect(interpretIpnPayload("a string", salt)).toEqual({ kind: "malformed" });
    expect(interpretIpnPayload([], salt)).toEqual({ kind: "malformed" });
    expect(interpretIpnPayload({ pp_TxnRefNo: "" }, salt)).toEqual({
      kind: "malformed",
    });
  });
});

describe("redactIpnPayloadForStorage", () => {
  it("redacts pp_Password before serialising", () => {
    const stored = redactIpnPayloadForStorage(
      signedPayload({ pp_Password: "super-secret" }),
    );
    expect(stored).not.toContain("super-secret");
    expect(JSON.parse(stored)).toMatchObject({ pp_Password: "[redacted]" });
  });

  it("handles a non-object body without throwing", () => {
    expect(redactIpnPayloadForStorage(null)).toBe("null");
    expect(redactIpnPayloadForStorage("plain text")).toBe('"plain text"');
  });
});
