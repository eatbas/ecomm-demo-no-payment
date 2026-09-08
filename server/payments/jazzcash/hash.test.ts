// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSecureHash, verifySecureHash } from "./hash.js";

describe("buildSecureHash", () => {
  // Golden vector #1: card-page-redirection's own worked example.
  // https://onlinepayments.jazzcash.com.pk .../merchantform (Page Redirection v1.1)
  it("reproduces the card-page-redirection worked example digest", () => {
    const fields = {
      pp_Version: "1.1",
      pp_TxnType: "MPAY",
      pp_Language: "EN",
      pp_MerchantID: "YOUR_MERCHANT_ID",
      pp_Password: "YOUR_PASSWORD",
      pp_TxnRefNo: "TRN20260823120000123",
      pp_Amount: "100",
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: "20260823120000",
      pp_BillReference: "billref001",
      pp_Description: "Test transaction description",
      pp_TxnExpiryDateTime: "20260824120000",
      pp_ReturnURL: "https://merchant.example.com/jazzcash/return",
      pp_SubMerchantID: "",
      pp_BankID: "",
      pp_ProductID: "",
      ppmpf_1: "",
      ppmpf_2: "",
      ppmpf_3: "",
      ppmpf_4: "",
      ppmpf_5: "",
    };

    expect(buildSecureHash(fields, "YOUR_INTEGRITY_SALT")).toBe(
      "20CA66D57652B9D2F0B4B2991C8324FC594633FD1FE8BBABE21F93DCE9F3C5AB",
    );
  });

  // Golden vector #2: the hmac-sha256-calculation document's own worked example.
  it("reproduces the hmac-sha256-calculation worked example digest", () => {
    const fields = {
      pp_Amount: "25000",
      pp_MerchantID: "MC25041",
      pp_MerchantMPIN: "1234",
      pp_Password: "sz1v4agvyf",
      pp_TxnCurrency: "PKR",
      pp_TxnRefNo: "T20220518150213",
    };

    expect(buildSecureHash(fields, "3vv9wu3a18")).toBe(
      "2C595361C2DA0E502D18BFBAA92CF4740330215E5E8AD0CF4489A64E7400B117",
    );
  });

  // Golden vector #3: the ipn-implementation document's own sample payload.
  it("reproduces the ipn-implementation sample payload digest", () => {
    const fields = {
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
    };

    expect(buildSecureHash(fields, "0123456789")).toBe(
      "2B47BCF7825FA27FC8B522292BC8D226213FCCDA685FC68A67EC20B10836E5B7",
    );
  });

  it("excludes fields not prefixed with pp, and excludes pp_SecureHash itself", () => {
    const withoutNoise = buildSecureHash(
      { pp_Amount: "100", pp_TxnRefNo: "T1" },
      "salt",
    );
    const withNoise = buildSecureHash(
      {
        pp_Amount: "100",
        pp_TxnRefNo: "T1",
        pp_SecureHash: "SHOULD-NOT-BE-HASHED",
        unrelatedField: "SHOULD-NOT-BE-HASHED",
        csrfToken: "SHOULD-NOT-BE-HASHED",
      },
      "salt",
    );

    expect(withNoise).toBe(withoutNoise);
  });

  it("sorts pp_ before ppmpf_ (ASCII '_' precedes 'm')", () => {
    const inOrder = buildSecureHash(
      { pp_A: "1", ppmpf_1: "2" },
      "salt",
    );
    const reversedInput = buildSecureHash(
      { ppmpf_1: "2", pp_A: "1" },
      "salt",
    );

    expect(inOrder).toBe(reversedInput);
  });
});

describe("verifySecureHash", () => {
  const fields = { pp_Amount: "100", pp_TxnRefNo: "T1" };
  const expected = buildSecureHash(fields, "salt");

  it("accepts the correct digest regardless of case", () => {
    expect(verifySecureHash(fields, "salt", expected)).toBe(true);
    expect(verifySecureHash(fields, "salt", expected.toLowerCase())).toBe(true);
  });

  it("rejects a wrong digest, a wrong salt, and a missing digest", () => {
    expect(verifySecureHash(fields, "salt", "0".repeat(64))).toBe(false);
    expect(verifySecureHash(fields, "wrong-salt", expected)).toBe(false);
    expect(verifySecureHash(fields, "salt", undefined)).toBe(false);
    expect(verifySecureHash(fields, "salt", "")).toBe(false);
  });
});
