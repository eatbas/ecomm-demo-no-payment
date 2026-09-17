// @vitest-environment node
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readServerConfig } from "./config.js";

describe("server configuration", () => {
  it("uses durable production and isolated development defaults", () => {
    expect(readServerConfig({})).toEqual({
      host: "0.0.0.0",
      port: 8080,
      databasePath: resolve(".data/orders.sqlite"),
    });
    expect(readServerConfig({ NODE_ENV: "production" })).toEqual({
      host: "0.0.0.0",
      port: 8080,
      databasePath: "/data/orders.sqlite",
      staticRoot: resolve("dist"),
    });
  });

  it("trims explicit non-secret string values", () => {
    expect(
      readServerConfig({
        HOST: " 127.0.0.1 ",
        PORT: " 3001 ",
        ORDER_DB_PATH: " /data/demo.sqlite ",
        STATIC_ROOT: " /app/dist ",
      }),
    ).toEqual({
      host: "127.0.0.1",
      port: 3001,
      databasePath: "/data/demo.sqlite",
      staticRoot: "/app/dist",
    });
  });

  it.each(["HOST", "ORDER_DB_PATH", "STATIC_ROOT"] as const)(
    "rejects an empty %s value",
    (name) => {
      expect(() => readServerConfig({ [name]: " \t " })).toThrow(
        `${name} must not be empty.`,
      );
    },
  );

  it.each(["0", "65536", "1.5", "invalid", ""])(
    "rejects the invalid port %j",
    (port) => {
      expect(() => readServerConfig({ PORT: port })).toThrow(
        "PORT must be an integer between 1 and 65535.",
      );
    },
  );

  it("reads complete JazzCash configuration", () => {
    const config = readServerConfig({
      JAZZCASH_MERCHANT_ID: "MC990739",
      JAZZCASH_PASSWORD: "testpassword",
      JAZZCASH_INTEGRITY_SALT: "testsalt123",
      JAZZCASH_MERCHANT_MPIN: "1234",
      JAZZCASH_RETURN_URL: "https://ecomm.atbas.xyz/api/payments/return",
      JAZZCASH_IPN_URL: "https://ecomm.atbas.xyz/api/payments/ipn",
      PUBLIC_BASE_URL: "https://ecomm.atbas.xyz",
    });

    expect(config.jazzcash).toEqual({
      merchantId: "MC990739",
      password: "testpassword",
      integritySalt: "testsalt123",
      merchantMpin: "1234",
      returnUrl: "https://ecomm.atbas.xyz/api/payments/return",
      ipnUrl: "https://ecomm.atbas.xyz/api/payments/ipn",
      postUrl:
        "https://onlinepayments.jazzcash.com.pk/payment-orchestrator/CustomerPortal/transactionmanagement/merchantform",
      publicBaseUrl: "https://ecomm.atbas.xyz",
    });
  });

  it("allows empty optional JAZZCASH_MERCHANT_MPIN", () => {
    const config = readServerConfig({
      JAZZCASH_MERCHANT_ID: "MC990739",
      JAZZCASH_PASSWORD: "testpassword",
      JAZZCASH_INTEGRITY_SALT: "testsalt123",
      JAZZCASH_MERCHANT_MPIN: "   ",
      JAZZCASH_RETURN_URL: "https://ecomm.atbas.xyz/api/payments/return",
      JAZZCASH_IPN_URL: "https://ecomm.atbas.xyz/api/payments/ipn",
      PUBLIC_BASE_URL: "https://ecomm.atbas.xyz",
    });

    expect(config.jazzcash?.merchantMpin).toBeUndefined();
  });

  it("rejects incomplete JazzCash configuration", () => {
    expect(() =>
      readServerConfig({
        JAZZCASH_MERCHANT_ID: "MC990739",
      }),
    ).toThrow("JAZZCASH_PASSWORD must be specified when JazzCash is configured.");
  });
});
