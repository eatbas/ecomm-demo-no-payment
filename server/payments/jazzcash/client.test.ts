// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { JazzCashConfig } from "../../config.js";
import {
  buildCardRedirectionFields,
  createTxnRefNo,
  sanitizeFreeText,
} from "./client.js";
import { verifySecureHash } from "./hash.js";

const testConfig: JazzCashConfig = {
  baseUrl: "https://onlinepayments.jazzcash.com.pk",
  merchantId: "MC990739",
  password: "m40ceq345k",
  integritySalt: "g8u36b27xd",
  returnUrl: "https://ecomm.atbas.xyz/api/payments/return",
};

describe("JazzCash client", () => {
  it("generates a valid txnRefNo under 20 alphanumeric characters", () => {
    const now = new Date();
    const ref = createTxnRefNo(now);

    expect(ref.startsWith("TRN")).toBe(true);
    expect(ref.length).toBeLessThanOrEqual(20);
    expect(/^[A-Za-z0-9]+$/.test(ref)).toBe(true);
  });

  it("sanitises ampersands and control characters from free text", () => {
    expect(sanitizeFreeText("Order & Items \x00\x1f")).toBe("Order and Items");
  });

  it("builds the full signed 22-field parameter set for card redirection", () => {
    const now = new Date("2026-09-11T10:00:00.000Z");
    const txnRefNo = "TRN2026091115000001";
    const fields = buildCardRedirectionFields({
      amountPaisa: 7900,
      billReference: "CG-12345678",
      description: "Order CG-12345678",
      txnRefNo,
      config: testConfig,
      now,
    });

    expect(fields.pp_Version).toBe("1.1");
    expect(fields.pp_TxnType).toBe("MPAY");
    expect(fields.pp_Language).toBe("EN");
    expect(fields.pp_MerchantID).toBe(testConfig.merchantId);
    expect(fields.pp_Password).toBe(testConfig.password);
    expect(fields.pp_TxnRefNo).toBe(txnRefNo);
    expect(fields.pp_Amount).toBe("7900");
    expect(fields.pp_TxnCurrency).toBe("PKR");
    expect(fields.pp_TxnDateTime).toBe("20260911150000");
    expect(fields.pp_TxnExpiryDateTime).toBe("20260912150000");
    expect(fields.pp_ReturnURL).toBe(testConfig.returnUrl);
    expect(fields.pp_SubMerchantID).toBe("");
    expect(fields.pp_BankID).toBe("");
    expect(fields.pp_ProductID).toBe("");
    expect(fields.ppmpf_1).toBe("");
    expect(fields.ppmpf_5).toBe("");
    expect(fields.pp_SecureHash).toMatch(/^[0-9A-F]{64}$/);

    expect(verifySecureHash(fields, testConfig.integritySalt, fields.pp_SecureHash)).toBe(true);
  });

  it("rejects non-positive or non-integer amounts", () => {
    const now = new Date();
    expect(() =>
      buildCardRedirectionFields({
        amountPaisa: 0,
        billReference: "ref",
        description: "desc",
        txnRefNo: "TRN1",
        config: testConfig,
        now,
      }),
    ).toThrow(RangeError);
  });
});
