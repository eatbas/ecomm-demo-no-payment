import { resolve } from "node:path";

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly staticRoot?: string;
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
  return {
    host: configuredHost ?? "0.0.0.0",
    port: parsePort(environment.PORT),
    databasePath:
      configuredDatabasePath ??
      (production ? "/data/orders.sqlite" : resolve(".data/orders.sqlite")),
    ...(staticRoot === undefined ? {} : { staticRoot }),
  };
}
