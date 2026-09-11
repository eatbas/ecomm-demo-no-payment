// @vitest-environment node
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readServerConfig } from "./config.js";

const requiredSecrets = {
  JAZZCASH_MERCHANT_ID: "MC990739",
  JAZZCASH_PASSWORD: "m40ceq345k",
  JAZZCASH_INTEGRITY_SALT: "g8u36b27xd",
  JAZZCASH_RETURN_URL: "https://ecomm.atbas.xyz/api/payments/return",
};

const defaultJazzCash = {
  baseUrl: "https://onlinepayments.jazzcash.com.pk",
  merchantId: requiredSecrets.JAZZCASH_MERCHANT_ID,
  password: requiredSecrets.JAZZCASH_PASSWORD,
  integritySalt: requiredSecrets.JAZZCASH_INTEGRITY_SALT,
  returnUrl: requiredSecrets.JAZZCASH_RETURN_URL,
};

describe("server configuration", () => {
  it("uses durable production and isolated development defaults", () => {
    expect(readServerConfig({ ...requiredSecrets })).toEqual({
      host: "0.0.0.0",
      port: 8080,
      databasePath: resolve(".data/orders.sqlite"),
      jazzcash: defaultJazzCash,
    });

    expect(
      readServerConfig({ ...requiredSecrets, NODE_ENV: "production" }),
    ).toEqual({
      host: "0.0.0.0",
      port: 8080,
      databasePath: "/data/orders.sqlite",
      staticRoot: resolve("dist"),
      jazzcash: defaultJazzCash,
    });
  });

  it("trims explicit non-secret string values and parses optional jazzcash fields", () => {
    expect(
      readServerConfig({
        ...requiredSecrets,
        HOST: " 127.0.0.1 ",
        PORT: " 3001 ",
        ORDER_DB_PATH: " /data/demo.sqlite ",
        STATIC_ROOT: " /app/dist ",
        JAZZCASH_BASE_URL: " https://custom.jazzcash.example.test ",
        JAZZCASH_IPN_URL: " https://ecomm.atbas.xyz/api/payments/ipn ",
        JAZZCASH_MERCHANT_MPIN: " 1234 ",
      }),
    ).toEqual({
      host: "127.0.0.1",
      port: 3001,
      databasePath: "/data/demo.sqlite",
      staticRoot: "/app/dist",
      jazzcash: {
        baseUrl: "https://custom.jazzcash.example.test",
        merchantId: requiredSecrets.JAZZCASH_MERCHANT_ID,
        password: requiredSecrets.JAZZCASH_PASSWORD,
        integritySalt: requiredSecrets.JAZZCASH_INTEGRITY_SALT,
        returnUrl: requiredSecrets.JAZZCASH_RETURN_URL,
        ipnUrl: "https://ecomm.atbas.xyz/api/payments/ipn",
        merchantMpin: "1234",
      },
    });
  });

  it.each(["HOST", "ORDER_DB_PATH", "STATIC_ROOT"] as const)(
    "rejects an empty %s value",
    (name) => {
      expect(() =>
        readServerConfig({ ...requiredSecrets, [name]: " \t " }),
      ).toThrow(`${name} must not be empty.`);
    },
  );

  it.each(["0", "65536", "1.5", "invalid", ""])(
    "rejects the invalid port %j",
    (port) => {
      expect(() =>
        readServerConfig({ ...requiredSecrets, PORT: port }),
      ).toThrow("PORT must be an integer between 1 and 65535.");
    },
  );

  it.each([
    "JAZZCASH_MERCHANT_ID",
    "JAZZCASH_PASSWORD",
    "JAZZCASH_INTEGRITY_SALT",
  ] as const)("rejects a missing required secret %s", (name) => {
    const environment = { ...requiredSecrets };
    delete (environment as Record<string, string | undefined>)[name];
    expect(() => readServerConfig(environment)).toThrow(`${name} is required.`);
  });

  it("rejects a missing required JAZZCASH_RETURN_URL", () => {
    const environment = { ...requiredSecrets };
    delete (environment as Record<string, string | undefined>).JAZZCASH_RETURN_URL;
    expect(() => readServerConfig(environment)).toThrow("JAZZCASH_RETURN_URL is required.");
  });

  it.each(["JAZZCASH_BASE_URL", "JAZZCASH_RETURN_URL", "JAZZCASH_IPN_URL"] as const)(
    "rejects a non-https %s",
    (name) => {
      expect(() =>
        readServerConfig({
          ...requiredSecrets,
          [name]: "http://insecure.example.test",
        }),
      ).toThrow(`${name} must use https.`);
    },
  );

  it("rejects a malformed JazzCash URL", () => {
    expect(() =>
      readServerConfig({
        ...requiredSecrets,
        JAZZCASH_BASE_URL: "not-a-url",
      }),
    ).toThrow("JAZZCASH_BASE_URL must be a valid absolute URL.");
  });
});
