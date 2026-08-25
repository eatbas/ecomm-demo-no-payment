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
});
