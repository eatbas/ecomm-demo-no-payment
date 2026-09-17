// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEMO_CUSTOMER,
  type AdminOrdersResponse,
  type CompletedOrder,
} from "../../shared/orders.js";
import { buildApp } from "../app.js";
import type { JazzCashConfig } from "../config.js";
import { calculateSecureHash } from "../payments/jazzcash/jazzcash.crypto.js";
import type { JazzCashIpnAcknowledgement } from "../payments/jazzcash/jazzcash.types.js";

const temporaryDirectories: string[] = [];

function createDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "ecomm-payments-test-"));
  temporaryDirectories.push(directory);
  return join(directory, "orders.sqlite");
}

const testJazzCashConfig: JazzCashConfig = {
  merchantId: "MC990739",
  password: "testpassword123",
  integritySalt: "testsalt12345",
  merchantMpin: "1234",
  returnUrl: "https://ecomm.atbas.xyz/api/payments/return",
  ipnUrl: "https://ecomm.atbas.xyz/api/payments/ipn",
  postUrl:
    "https://onlinepayments.jazzcash.com.pk/payment-orchestrator/CustomerPortal/transactionmanagement/merchantform",
  publicBaseUrl: "https://ecomm.atbas.xyz",
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Payment Routes", () => {
  it("serves auto-submitting HTML form on payment redirect", async () => {
    const databasePath = createDatabasePath();
    const app = await buildApp({
      databasePath,
      jazzcash: testJazzCashConfig,
    });

    // Create an order via API with paymentMethod: jazzcash
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { "Content-Type": "application/json" },
      payload: {
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
        demoCustomerId: DEMO_CUSTOMER.id,
        lines: [{ productId: "everyday-backpack", quantity: 1 }],
        paymentMethod: "jazzcash",
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const order = createResponse.json<CompletedOrder>();
    expect(order.status).toBe("pending");
    expect(order.paymentStatus).toBe("pending");
    expect(order.currency).toBe("PKR");
    expect(order.paymentRedirectUrl).toBe(`/api/payments/redirect/${order.id}`);

    // Call the redirect endpoint
    const redirectResponse = await app.inject({
      method: "GET",
      url: `/api/payments/redirect/${order.id}`,
    });

    expect(redirectResponse.statusCode).toBe(200);
    expect(redirectResponse.headers["content-type"]).toContain("text/html");
    const html = redirectResponse.body;
    expect(html).toContain('name="pp_MerchantID" value="MC990739"');
    expect(html).toContain('name="pp_TxnType" value="MPAY"');
    expect(html).toContain('name="pp_Amount" value="7900"');
    expect(html).toContain('name="pp_TxnCurrency" value="PKR"');
    expect(html).toContain('name="pp_ReturnURL"');
    expect(html).toContain('name="pp_SecureHash"');
    expect(html).toContain('action="https://onlinepayments.jazzcash.com.pk/payment-orchestrator/CustomerPortal/transactionmanagement/merchantform"');
    expect(html).toContain("document.getElementById('jazzcash').submit()");

    await app.close();
  });

  it("handles IPN notification, validates signature, and updates order to paid", async () => {
    const databasePath = createDatabasePath();
    const app = await buildApp({
      databasePath,
      jazzcash: testJazzCashConfig,
    });

    // Create a pending order
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { "Content-Type": "application/json" },
      payload: {
        idempotencyKey: "22222222-2222-4222-8222-222222222222",
        demoCustomerId: DEMO_CUSTOMER.id,
        lines: [{ productId: "desk-lamp", quantity: 1 }],
        paymentMethod: "jazzcash",
      },
    });

    const order = createResponse.json<CompletedOrder>();
    const txnRefNo = order.transaction?.txnRefNo ?? "";

    // Reject IPN with invalid signature
    const invalidIpn = await app.inject({
      method: "POST",
      url: "/api/payments/ipn",
      headers: { "Content-Type": "application/json" },
      payload: {
        pp_TxnRefNo: txnRefNo,
        pp_ResponseCode: "121",
        pp_SecureHash: "INVALID_HASH_VALUE_000000000000000000000000000000000000000000000000",
      },
    });
    expect(invalidIpn.statusCode).toBe(400);
    expect(invalidIpn.json<{ code: string; message: string }>()).toEqual({
      code: "INVALID_SIGNATURE",
      message: "The IPN secure hash signature is invalid.",
    });

    // Build valid IPN payload
    const ipnBody: Record<string, unknown> = {
      pp_TxnRefNo: txnRefNo,
      pp_ResponseCode: "121",
      pp_ResponseMessage: "Transaction has been marked confirmed by Merchant.",
      pp_RetreivalReferenceNo: "240418718258",
      pp_AuthCode: "060935465981",
      pp_TxnDateTime: "20260917120000",
      pp_TxnType: "MPAY",
      pp_Password: "testpassword123",
      pp_Version: "2.0",
      pp_BankID: "",
      pp_ProductID: null,
    };
    ipnBody.pp_SecureHash = calculateSecureHash(
      ipnBody,
      testJazzCashConfig.integritySalt,
    );

    const validIpn = await app.inject({
      method: "POST",
      url: "/api/payments/ipn",
      headers: { "Content-Type": "application/json" },
      payload: ipnBody,
    });

    expect(validIpn.statusCode).toBe(200);
    expect(validIpn.json<JazzCashIpnAcknowledgement>()).toEqual({
      pp_ResponseCode: "000",
      pp_ResponseMessage: "IPN received successfully",
      pp_SecureHash: "",
    });

    // Verify order was marked completed/paid with transaction details
    const adminOrders = await app.inject({
      method: "GET",
      url: "/api/admin/orders",
    });
    const orders = adminOrders.json<AdminOrdersResponse>().orders;
    const paidOrder = orders.find((item) => item.id === order.id);
    expect(paidOrder).toBeDefined();
    expect(paidOrder?.status).toBe("completed");
    expect(paidOrder?.paymentStatus).toBe("paid");
    expect(paidOrder?.transaction).toMatchObject({
      txnRefNo,
      status: "paid",
      responseCode: "121",
      retrievalRefNo: "240418718258",
      authCode: "060935465981",
    });

    await app.close();
  });

  it("handles IPN failure codes and marks order as failed", async () => {
    const databasePath = createDatabasePath();
    const app = await buildApp({
      databasePath,
      jazzcash: testJazzCashConfig,
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { "Content-Type": "application/json" },
      payload: {
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
        demoCustomerId: DEMO_CUSTOMER.id,
        lines: [{ productId: "travel-mug", quantity: 1 }],
        paymentMethod: "jazzcash",
      },
    });

    const order = createResponse.json<CompletedOrder>();
    const txnRefNo = order.transaction?.txnRefNo ?? "";

    const failedPayload: Record<string, unknown> = {
      pp_TxnRefNo: txnRefNo,
      pp_ResponseCode: "199",
      pp_ResponseMessage: "Transaction failed or declined.",
      pp_TxnDateTime: "20260917120000",
    };
    failedPayload.pp_SecureHash = calculateSecureHash(
      failedPayload,
      testJazzCashConfig.integritySalt,
    );

    const ipnResponse = await app.inject({
      method: "POST",
      url: "/api/payments/ipn",
      headers: { "Content-Type": "application/json" },
      payload: failedPayload,
    });

    expect(ipnResponse.statusCode).toBe(200);
    expect(ipnResponse.json<JazzCashIpnAcknowledgement>().pp_ResponseCode).toBe(
      "000",
    );

    const adminOrders = await app.inject({
      method: "GET",
      url: "/api/admin/orders",
    });
    const orders = adminOrders.json<AdminOrdersResponse>().orders;
    const failedOrder = orders.find((item) => item.id === order.id);
    expect(failedOrder?.status).toBe("failed");
    expect(failedOrder?.paymentStatus).toBe("failed");

    await app.close();
  });

  it("handles browser return callback and redirects with status and reference", async () => {
    const databasePath = createDatabasePath();
    const app = await buildApp({
      databasePath,
      jazzcash: testJazzCashConfig,
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/orders",
      headers: { "Content-Type": "application/json" },
      payload: {
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        demoCustomerId: DEMO_CUSTOMER.id,
        lines: [{ productId: "everyday-backpack", quantity: 1 }],
        paymentMethod: "jazzcash",
      },
    });

    const order = createResponse.json<CompletedOrder>();
    const txnRefNo = order.transaction?.txnRefNo ?? "";

    const returnParams: Record<string, string> = {
      pp_TxnRefNo: txnRefNo,
      pp_ResponseCode: "121",
      pp_ResponseMessage: "Success",
      pp_RetreivalReferenceNo: "240418718999",
      pp_AuthCode: "112233",
    };
    returnParams.pp_SecureHash = calculateSecureHash(
      returnParams,
      testJazzCashConfig.integritySalt,
    );

    // Test POST return (form submission from gateway)
    const postReturn = await app.inject({
      method: "POST",
      url: "/api/payments/return",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams(returnParams).toString(),
    });

    expect(postReturn.statusCode).toBe(303);
    expect(postReturn.headers.location).toContain(
      `/checkout?reference=${order.reference}&payment=paid`,
    );

    await app.close();
  });
});
