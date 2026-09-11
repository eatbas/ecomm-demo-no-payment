// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSecureHash, verifySecureHash } from "./hash.js";

describe("JazzCash HMAC-SHA256 hash calculation", () => {
  it("reproduces the verified worked example from hmac-sha256-calculation", () => {
    const fields = {
      pp_Amount: "25000",
      pp_MerchantID: "MC25041",
      pp_MerchantMPIN: "1234",
      pp_Password: "sz1v4agvyf",
      pp_TxnCurrency: "PKR",
      pp_TxnRefNo: "T20220518150213",
    };
    const salt = "3vv9wu3a18";
    const expected =
      "2C595361C2DA0E502D18BFBAA92CF4740330215E5E8AD0CF4489A64E7400B117";

    const hash = buildSecureHash(fields, salt);
    expect(hash).toBe(expected);
    expect(verifySecureHash(fields, salt, expected)).toBe(true);
  });

  it("reproduces the card-page-redirection worked hash example with skipped empty fields", () => {
    const fields = {
      pp_Amount: "100",
      pp_BillReference: "billref001",
      pp_Description: "Test transaction description",
      pp_Language: "EN",
      pp_MerchantID: "YOUR_MERCHANT_ID",
      pp_Password: "YOUR_PASSWORD",
      pp_ReturnURL: "https://merchant.example.com/jazzcash/return",
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: "20260823120000",
      pp_TxnExpiryDateTime: "20260824120000",
      pp_TxnRefNo: "TRN20260823120000123",
      pp_TxnType: "MPAY",
      pp_Version: "1.1",
      pp_BankID: "",
      pp_ProductID: "",
      pp_SubMerchantID: "",
      ppmpf_1: "",
      ppmpf_2: "",
      ppmpf_3: "",
      ppmpf_4: "",
      ppmpf_5: "",
    };
    const salt = "YOUR_INTEGRITY_SALT";
    const expected =
      "20CA66D57652B9D2F0B4B2991C8324FC594633FD1FE8BBABE21F93DCE9F3C5AB";

    const hash = buildSecureHash(fields, salt);
    expect(hash).toBe(expected);
    expect(verifySecureHash(fields, salt, expected)).toBe(true);
  });

  it("excludes non-pp prefixed keys and self pp_SecureHash from hash", () => {
    const salt = "test-salt";
    const base = {
      pp_Amount: "1000",
      pp_MerchantID: "MC1234",
    };
    const withExtra = {
      ...base,
      pp_SecureHash: "SOME_HASH",
      csrf_token: "secret",
      other_field: "value",
    };

    expect(buildSecureHash(withExtra, salt)).toBe(buildSecureHash(base, salt));
  });

  it("verifies hash case-insensitively and fails on mismatch or empty input", () => {
    const fields = { pp_Amount: "500" };
    const salt = "test-salt";
    const valid = buildSecureHash(fields, salt);

    expect(verifySecureHash(fields, salt, valid.toLowerCase())).toBe(true);
    expect(verifySecureHash(fields, salt, "INVALID_HASH")).toBe(false);
    expect(verifySecureHash(fields, salt, "")).toBe(false);
    expect(verifySecureHash(fields, salt, null)).toBe(false);
  });
});
