// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { JazzCashConfig } from "../../config.js";
import {
  buildCardRedirectionFields,
  createTxnRefNo,
  sanitizeFreeText,
} from "./client.js";
import { buildSecureHash } from "./hash.js";

const config: JazzCashConfig = {
  baseUrl: "https://onlinepayments.jazzcash.com.pk",
  merchantId: "MC00001",
  password: "merchant-password",
  integritySalt: "integrity-salt",
  returnUrl: "https://shop.example.test/checkout/return",
};

describe("createTxnRefNo", () => {
  it("starts with TRN followed by the PKT timestamp", () => {
    const ref = createTxnRefNo(new Date("2026-08-23T07:00:00.000Z"));
    expect(ref).toMatch(/^TRN20260823120000[0-9A-F]{8}$/);
  });

  it("is unique across calls in the same millisecond", () => {
    const now = new Date("2026-08-23T07:00:00.000Z");
    const refs = new Set(Array.from({ length: 50 }, () => createTxnRefNo(now)));
    expect(refs.size).toBe(50);
  });
});

describe("sanitizeFreeText", () => {
  it("removes ampersands so they cannot make the hash delimiter ambiguous", () => {
    expect(sanitizeFreeText("Backpack & Mug bundle")).toBe("Backpack and Mug bundle");
  });

  it("strips control characters and trims", () => {
    expect(sanitizeFreeText("  hello\tworld\n  ")).toBe("helloworld");
  });
});

describe("buildCardRedirectionFields", () => {
  const now = new Date("2026-08-23T07:00:00.000Z"); // 12:00:00 PKT

  it("produces every documented field with pp_TxnType=MPAY and paisa amount", () => {
    const fields = buildCardRedirectionFields({
      amountPaisa: 18_695,
      billReference: "CG-AB12CD34",
      description: "Order CG-AB12CD34",
      txnRefNo: "TRN20260823120000ABCDEF01",
      config,
      now,
    });

    expect(fields).toMatchObject({
      pp_Version: "1.1",
      pp_TxnType: "MPAY",
      pp_Language: "EN",
      pp_MerchantID: config.merchantId,
      pp_Password: config.password,
      pp_TxnRefNo: "TRN20260823120000ABCDEF01",
      pp_Amount: "18695",
      pp_TxnCurrency: "PKR",
      pp_TxnDateTime: "20260823120000",
      pp_TxnExpiryDateTime: "20260824120000",
      pp_ReturnURL: config.returnUrl,
      pp_SubMerchantID: "",
      pp_BankID: "",
      pp_ProductID: "",
      ppmpf_1: "",
      ppmpf_2: "",
      ppmpf_3: "",
      ppmpf_4: "",
      ppmpf_5: "",
    });
    expect(fields.pp_SecureHash).toMatch(/^[0-9A-F]{64}$/);
  });

  it("signs exactly the rendered field set (independently recomputed)", () => {
    const fields = buildCardRedirectionFields({
      amountPaisa: 100,
      billReference: "billref001",
      description: "Test transaction description",
      txnRefNo: "TRN20260823120000123",
      config: {
        ...config,
        merchantId: "YOUR_MERCHANT_ID",
        password: "YOUR_PASSWORD",
        integritySalt: "YOUR_INTEGRITY_SALT",
        returnUrl: "https://merchant.example.com/jazzcash/return",
      },
      now,
    });

    const { pp_SecureHash, ...unsigned } = fields;
    expect(buildSecureHash(unsigned, "YOUR_INTEGRITY_SALT")).toBe(pp_SecureHash);
    // Matches the card-page-redirection worked example exactly.
    expect(pp_SecureHash).toBe(
      "20CA66D57652B9D2F0B4B2991C8324FC594633FD1FE8BBABE21F93DCE9F3C5AB",
    );
  });

  it("rejects a non-positive or non-integer amount", () => {
    for (const amountPaisa of [0, -1, 1.5, Number.NaN]) {
      expect(() =>
        buildCardRedirectionFields({
          amountPaisa,
          billReference: "ref",
          description: "desc",
          txnRefNo: "TRN1",
          config,
          now,
        }),
      ).toThrow(RangeError);
    }
  });

  it("sanitizes free-text fields before signing", () => {
    const fields = buildCardRedirectionFields({
      amountPaisa: 100,
      billReference: "Order & co",
      description: "Backpack & mug",
      txnRefNo: "TRN1",
      config,
      now,
    });

    expect(fields.pp_BillReference).toBe("Order and co");
    expect(fields.pp_Description).toBe("Backpack and mug");
  });
});
