import { resolve } from "node:path";

export interface JazzCashConfig {
  readonly merchantId: string;
  readonly password: string;
  readonly integritySalt: string;
  readonly merchantMpin?: string;
  readonly returnUrl: string;
  readonly ipnUrl: string;
  readonly postUrl: string;
  readonly publicBaseUrl: string;
}

export const DEFAULT_JAZZCASH_POST_URL =
  "https://onlinepayments.jazzcash.com.pk/payment-orchestrator/CustomerPortal/transactionmanagement/merchantform";

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly staticRoot?: string;
  readonly jazzcash?: JazzCashConfig;
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
  allowEmptyAsUndefined = false,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    if (allowEmptyAsUndefined) {
      return undefined;
    }
    throw new Error(`${name} must not be empty.`);
  }
  return trimmedValue;
}

function readJazzCashConfig(
  environment: NodeJS.ProcessEnv,
): JazzCashConfig | undefined {
  const merchantId = readOptionalValue(
    "JAZZCASH_MERCHANT_ID",
    environment.JAZZCASH_MERCHANT_ID,
  );
  const password = readOptionalValue(
    "JAZZCASH_PASSWORD",
    environment.JAZZCASH_PASSWORD,
  );
  const integritySalt = readOptionalValue(
    "JAZZCASH_INTEGRITY_SALT",
    environment.JAZZCASH_INTEGRITY_SALT,
  );
  const returnUrl = readOptionalValue(
    "JAZZCASH_RETURN_URL",
    environment.JAZZCASH_RETURN_URL,
  );
  const ipnUrl = readOptionalValue(
    "JAZZCASH_IPN_URL",
    environment.JAZZCASH_IPN_URL,
  );

  const hasAnyConfig =
    merchantId !== undefined ||
    password !== undefined ||
    integritySalt !== undefined ||
    returnUrl !== undefined ||
    ipnUrl !== undefined;

  if (!hasAnyConfig) {
    return undefined;
  }

  if (merchantId === undefined) {
    throw new Error("JAZZCASH_MERCHANT_ID must be specified when JazzCash is configured.");
  }
  if (password === undefined) {
    throw new Error("JAZZCASH_PASSWORD must be specified when JazzCash is configured.");
  }
  if (integritySalt === undefined) {
    throw new Error("JAZZCASH_INTEGRITY_SALT must be specified when JazzCash is configured.");
  }
  if (returnUrl === undefined) {
    throw new Error("JAZZCASH_RETURN_URL must be specified when JazzCash is configured.");
  }
  if (ipnUrl === undefined) {
    throw new Error("JAZZCASH_IPN_URL must be specified when JazzCash is configured.");
  }

  const merchantMpin = readOptionalValue(
    "JAZZCASH_MERCHANT_MPIN",
    environment.JAZZCASH_MERCHANT_MPIN,
    true,
  );
  const postUrl =
    readOptionalValue("JAZZCASH_POST_URL", environment.JAZZCASH_POST_URL) ??
    DEFAULT_JAZZCASH_POST_URL;
  const publicBaseUrl =
    readOptionalValue("PUBLIC_BASE_URL", environment.PUBLIC_BASE_URL) ??
    new URL(returnUrl).origin;

  return {
    merchantId,
    password,
    integritySalt,
    ...(merchantMpin === undefined ? {} : { merchantMpin }),
    returnUrl,
    ipnUrl,
    postUrl,
    publicBaseUrl,
  };
}

/** Read non-secret runtime configuration and reject ambiguous values. */
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
  const jazzcash = readJazzCashConfig(environment);

  return {
    host: configuredHost ?? "0.0.0.0",
    port: parsePort(environment.PORT),
    databasePath:
      configuredDatabasePath ??
      (production ? "/data/orders.sqlite" : resolve(".data/orders.sqlite")),
    ...(staticRoot === undefined ? {} : { staticRoot }),
    ...(jazzcash === undefined ? {} : { jazzcash }),
  };
}

