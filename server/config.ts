import { resolve } from "node:path";

export interface JazzCashConfig {
  /** An https origin only (e.g. the JazzCash host) — never a path. */
  readonly baseUrl: string;
  readonly merchantId: string;
  readonly password: string;
  readonly integritySalt: string;
  /** Must be pre-registered with JazzCash and byte-identical on every request. */
  readonly returnUrl: string;
}

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly staticRoot?: string;
  readonly adminPasswordHash: string;
  readonly adminSessionSecret: string;
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

/** Read the JazzCash merchant profile. Every value is a secret except the URLs. */
function readJazzCashConfig(environment: NodeJS.ProcessEnv): JazzCashConfig {
  return {
    baseUrl: readRequiredOrigin(
      "JAZZCASH_BASE_URL",
      environment.JAZZCASH_BASE_URL,
    ),
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
  };
}

/** Read runtime configuration, failing fast on a missing or malformed secret. */
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
    adminPasswordHash: readRequiredValue(
      "ADMIN_PASSWORD_HASH",
      environment.ADMIN_PASSWORD_HASH,
    ),
    adminSessionSecret: readRequiredValue(
      "ADMIN_SESSION_SECRET",
      environment.ADMIN_SESSION_SECRET,
    ),
    jazzcash: readJazzCashConfig(environment),
  };
}
