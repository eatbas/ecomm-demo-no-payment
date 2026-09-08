// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { JazzCashConfig } from "../../config.js";
import { buildSecureHash } from "./hash.js";
import { performStatusInquiry } from "./status-inquiry.js";

const config: JazzCashConfig = {
  baseUrl: "https://onlinepayments.jazzcash.com.pk",
  merchantId: "MC00001",
  password: "merchant-password",
  integritySalt: "integrity-salt",
  returnUrl: "https://shop.example.test/checkout/return",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("performStatusInquiry", () => {
  it("signs the request with pp_TxnRefNo, pp_MerchantID, pp_Password", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse({ pp_ResponseCode: "000" }));

    await performStatusInquiry("T1", config, fetchSpy);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://onlinepayments.jazzcash.com.pk/payment-orchestrator/api/v2/rest/payments/status/inquiry",
    );
    const sentBody = JSON.parse(init.body as string) as Record<string, string>;
    expect(sentBody.pp_TxnRefNo).toBe("T1");
    expect(sentBody.pp_MerchantID).toBe(config.merchantId);
    expect(sentBody.pp_Password).toBe(config.password);
    expect(sentBody.pp_SecureHash).toBe(
      buildSecureHash(
        { pp_TxnRefNo: "T1", pp_MerchantID: config.merchantId, pp_Password: config.password },
        config.integritySalt,
      ),
    );
  });

  it("classifies pp_PaymentResponseCode 121 + pp_Status Completed as paid", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        pp_ResponseCode: "000",
        pp_PaymentResponseCode: "121",
        pp_Status: "Completed",
        pp_Amount: "18695",
      }),
    );

    const outcome = await performStatusInquiry("T1", config, fetchSpy);
    expect(outcome.kind).toBe("paid");
  });

  it("never settles paid on the operation-level pp_ResponseCode alone", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({ pp_ResponseCode: "000", pp_PaymentResponseCode: "199" }),
    );

    const outcome = await performStatusInquiry("T1", config, fetchSpy);
    expect(outcome.kind).toBe("not_completed");
  });

  it("treats a network failure as ambiguous, not failed", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    const outcome = await performStatusInquiry("T1", config, fetchSpy);
    expect(outcome.kind).toBe("ambiguous");
  });

  it("treats a non-JSON body as ambiguous, not failed", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    );

    const outcome = await performStatusInquiry("T1", config, fetchSpy);
    expect(outcome.kind).toBe("ambiguous");
  });
});
