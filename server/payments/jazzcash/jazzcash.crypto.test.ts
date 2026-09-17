// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  calculateSecureHash,
  formatPktDateTime,
  generateTxnRefNo,
  toPaisa,
  verifySecureHash,
} from "./jazzcash.crypto.js";

describe("jazzcash crypto utilities", () => {
  it("reproduces the hmac-sha256 calculation vector from documentation", () => {
    const salt = "3vv9wu3a18";
    const parameters = {
      pp_Amount: "25000",
      pp_MerchantID: "MC25041",
      pp_MerchantMPIN: "1234",
      pp_Password: "sz1v4agvyf",
      pp_TxnCurrency: "PKR",
      pp_TxnRefNo: "T20220518150213",
    };

    const hash = calculateSecureHash(parameters, salt);
    expect(hash).toBe(
      "2C595361C2DA0E502D18BFBAA92CF4740330215E5E8AD0CF4489A64E7400B117",
    );
  });

  it("reproduces the IPN sample vector with empty and null fields", () => {
    const salt = "0123456789";
    const ipnPayload = {
      pp_AuthCode: "060935465981",
      pp_Password: "0123456789",
      pp_ResponseCode: "121",
      pp_ResponseMessage: "Transaction has been marked confirmed by Merchant.",
      pp_RetreivalReferenceNo: "240418718258",
      pp_TxnDateTime: "20240418145702",
      pp_TxnRefNo: "T20240418145702",
      pp_TxnType: "MWALLET",
      pp_Version: "2.0",
      pp_BankID: "",
      pp_ProductID: null,
      pp_SettlementExpiry: null,
    };

    const hash = calculateSecureHash(ipnPayload, salt);
    expect(hash).toBe(
      "2B47BCF7825FA27FC8B522292BC8D226213FCCDA685FC68A67EC20B10836E5B7",
    );
    expect(verifySecureHash({ ...ipnPayload, pp_SecureHash: hash }, salt)).toBe(
      true,
    );
  });

  it("reproduces the card page redirection worked example vector", () => {
    const salt = "YOUR_INTEGRITY_SALT";
    const parameters = {
      pp_Amount: "100",
      pp_BankID: "",
      pp_BillReference: "billref001",
      pp_Description: "Test transaction description",
      pp_Language: "EN",
      pp_MerchantID: "YOUR_MERCHANT_ID",
      pp_Password: "YOUR_PASSWORD",
      pp_ProductID: "",
      pp_ReturnURL: "https://merchant.example.com/jazzcash/return",
      pp_SubMerchantID: "",
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: "20260823120000",
      pp_TxnExpiryDateTime: "20260824120000",
      pp_TxnRefNo: "TRN20260823120000123",
      pp_TxnType: "MPAY",
      pp_Version: "1.1",
      ppmpf_1: "",
      ppmpf_2: "",
      ppmpf_3: "",
      ppmpf_4: "",
      ppmpf_5: "",
    };

    const hash = calculateSecureHash(parameters, salt);
    expect(hash).toBe(
      "20CA66D57652B9D2F0B4B2991C8324FC594633FD1FE8BBABE21F93DCE9F3C5AB",
    );
  });

  it("excludes non-pp prefixed fields and pp_SecureHash itself", () => {
    const salt = "test_salt";
    const base = {
      pp_Amount: "100",
      pp_TxnRefNo: "T123",
    };

    const hash1 = calculateSecureHash(base, salt);
    const hash2 = calculateSecureHash(
      {
        ...base,
        csrfToken: "xyz123",
        otherField: "val",
        pp_SecureHash: "SOME_HASH",
      },
      salt,
    );

    expect(hash2).toBe(hash1);
  });

  it("verifies hash in constant time and rejects tampering", () => {
    const salt = "test_salt";
    const payload = {
      pp_Amount: "500",
      pp_TxnRefNo: "T12345",
    };
    const validHash = calculateSecureHash(payload, salt);

    expect(
      verifySecureHash({ ...payload, pp_SecureHash: validHash.toLowerCase() }, salt),
    ).toBe(true);

    expect(
      verifySecureHash(
        { ...payload, pp_SecureHash: "WRONG_DIGEST_OF_64_CHARACTERS_LONG_0000000000000000000000000000000" },
        salt,
      ),
    ).toBe(false);

    expect(verifySecureHash({ ...payload, pp_SecureHash: "" }, salt)).toBe(false);
  });

  it("formats date in Pakistan Standard Time (Asia/Karachi)", () => {
    // 2026-08-23T07:00:00Z is 12:00:00 in PKT (UTC+5)
    const date = new Date("2026-08-23T07:00:00.000Z");
    const formatted = formatPktDateTime(date);
    expect(formatted).toBe("20260823120000");
  });

  it("generates collision-safe transaction references within 20 chars", () => {
    const ref1 = generateTxnRefNo("TRN");
    const ref2 = generateTxnRefNo("TRN");

    expect(ref1).toHaveLength(20);
    expect(ref2).toHaveLength(20);
    expect(ref1).toMatch(/^TRN\d{14}[A-Za-z0-9]{3}$/);
    expect(ref1).not.toBe(ref2);
  });

  it("converts amounts to minor unit paisa", () => {
    expect(toPaisa(1)).toBe("100");
    expect(toPaisa("1.50")).toBe("150");
    expect(toPaisa(28.95)).toBe("2895");
    expect(toPaisa("100")).toBe("10000");
    expect(() => toPaisa(-5)).toThrow();
  });
});
