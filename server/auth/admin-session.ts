import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL_MILLISECONDS = 12 * 60 * 60 * 1000; // 12 hours
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;

/** Hash a plaintext admin password into the `ADMIN_PASSWORD_HASH` env format. */
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

/** Verify a plaintext password against a stored `ADMIN_PASSWORD_HASH` value. */
export function verifyAdminPassword(
  password: string,
  storedHash: string,
): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const [, saltHex, expectedHex] = parts;
  if (saltHex === undefined || expectedHex === undefined) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(expectedHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEY_LENGTH) {
    return false;
  }

  const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Issue a signed, time-limited admin session token (not a cookie string). */
export function createSessionToken(
  secret: string,
  now: () => Date = () => new Date(),
): string {
  const expiresAt = now().getTime() + SESSION_TTL_MILLISECONDS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload, secret)}`;
}

// Exactly `<digits>.<64 lowercase hex characters>` — no third part, no
// trailing noise. Node's hex Buffer decoding silently truncates at the first
// invalid character rather than rejecting it, so without this exact-shape
// check a tampered token with garbage appended to a valid signature would
// decode to the same bytes as the valid one and pass verification.
const SESSION_TOKEN_PATTERN = /^(\d+)\.([0-9a-f]{64})$/;

/** Verify a session token's signature and expiry. */
export function verifySessionToken(
  token: string,
  secret: string,
  now: () => Date = () => new Date(),
): boolean {
  const match = SESSION_TOKEN_PATTERN.exec(token);
  if (match === null) {
    return false;
  }
  const [, payload, signature] = match;
  if (payload === undefined || signature === undefined) {
    return false;
  }

  const expiresAt = Number(payload);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now().getTime()) {
    return false;
  }

  const expectedSignature = sign(payload, secret);
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

/** Parse a `Cookie` header value into a name/value map (no attribute parsing). */
export function parseCookies(header: string | undefined): ReadonlyMap<string, string> {
  const cookies = new Map<string, string>();
  if (header === undefined) {
    return cookies;
  }

  for (const pair of header.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (name.length > 0) {
      cookies.set(name, decodeURIComponent(value));
    }
  }
  return cookies;
}

export function serializeSessionCookie(
  token: string,
  secureCookies: boolean,
): string {
  const attributes = [
    `${ADMIN_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MILLISECONDS / 1000)}`,
  ];
  if (secureCookies) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}

export function serializeExpiredSessionCookie(secureCookies: boolean): string {
  const attributes = [
    `${ADMIN_SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ];
  if (secureCookies) {
    attributes.push("Secure");
  }
  return attributes.join("; ");
}
