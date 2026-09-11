import { resolve } from "node:path";

export interface JazzCashConfig {
  /** An https origin only (e.g. the JazzCash host) — never a path. */
  readonly baseUrl: string;
  readonly merchantId: string;
  readonly password: string;
  readonly integritySalt: string;
  /** Must be pre-registered with JazzCash and byte-identical on every request. */
  readonly returnUrl: string;
  readonly ipnUrl?: string;
  readonly merchantMpin?: string;
}

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly staticRoot?: string;
  readonly jazzcash: JazzCashConfig;
}

function parsePort(value: string | undefined): number {
  const port = value === undefined ? 8080 : Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function readOptionalValue(
  name: string,
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new Error(`${name} must not be empty.`);
  }
  return trimmedValue;
}

function readRequiredValue(name: string, value: string | undefined): string {
  const readValue = readOptionalValue(name, value);
  if (readValue === undefined) {
    throw new Error(`${name} is required.`);
  }
  return readValue;
}

function readRequiredOrigin(name: string, value: string | undefined): string {
  const readValue = readRequiredValue(name, value);
  let parsed: URL;
  try {
    parsed = new URL(readValue);
  } catch (error) {
    throw new Error(`${name} must be a valid absolute URL.`, { cause: error });
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use https.`);
  }
  return readValue;
}

function readOptionalOrigin(
  name: string,
  value: string | undefined,
): string | undefined {
  const readValue = readOptionalValue(name, value);
  if (readValue === undefined) {
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(readValue);
  } catch (error) {
    throw new Error(`${name} must be a valid absolute URL.`, { cause: error });
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use https.`);
  }
  return readValue;
}

const DEFAULT_JAZZCASH_BASE_URL = [
  "https:",
  "",
  "onlinepayments.jazzcash.com.pk",
].join("/");

/** Read the JazzCash merchant profile from process environment. */
export function readJazzCashConfig(
  environment: NodeJS.ProcessEnv = process.env,
): JazzCashConfig {
  const baseUrl =
    readOptionalOrigin("JAZZCASH_BASE_URL", environment.JAZZCASH_BASE_URL) ??
    DEFAULT_JAZZCASH_BASE_URL;

  return {
    baseUrl,
    merchantId: readRequiredValue(
      "JAZZCASH_MERCHANT_ID",
      environment.JAZZCASH_MERCHANT_ID,
    ),
    password: readRequiredValue(
      "JAZZCASH_PASSWORD",
      environment.JAZZCASH_PASSWORD,
    ),
    integritySalt: readRequiredValue(
      "JAZZCASH_INTEGRITY_SALT",
      environment.JAZZCASH_INTEGRITY_SALT,
    ),
    returnUrl: readRequiredOrigin(
      "JAZZCASH_RETURN_URL",
      environment.JAZZCASH_RETURN_URL,
    ),
    ...(environment.JAZZCASH_IPN_URL !== undefined
      ? { ipnUrl: readOptionalOrigin("JAZZCASH_IPN_URL", environment.JAZZCASH_IPN_URL) }
      : {}),
    ...(environment.JAZZCASH_MERCHANT_MPIN !== undefined
      ? {
          merchantMpin: readOptionalValue(
            "JAZZCASH_MERCHANT_MPIN",
            environment.JAZZCASH_MERCHANT_MPIN,
          ),
        }
      : {}),
  };
}

/** Read runtime configuration and reject ambiguous or missing values. */
export function readServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const production = environment.NODE_ENV === "production";
  const configuredHost = readOptionalValue("HOST", environment.HOST);
  const configuredDatabasePath = readOptionalValue(
    "ORDER_DB_PATH",
    environment.ORDER_DB_PATH,
  );
  const configuredStaticRoot = readOptionalValue(
    "STATIC_ROOT",
    environment.STATIC_ROOT,
  );
  const staticRoot =
    configuredStaticRoot ?? (production ? resolve("dist") : undefined);

  return {
    host: configuredHost ?? "0.0.0.0",
    port: parsePort(environment.PORT),
    databasePath:
      configuredDatabasePath ??
      (production ? "/data/orders.sqlite" : resolve(".data/orders.sqlite")),
    ...(staticRoot === undefined ? {} : { staticRoot }),
    jazzcash: readJazzCashConfig(environment),
  };
}
