import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const PAKISTAN_TIME_ZONE = "Asia/Karachi" as const;
export const MAX_REFERENCE_LENGTH = 20;
const REFERENCE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const pktFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PAKISTAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * Format a Date object as YYYYMMDDHHMMSS in Pakistan Standard Time (PKT).
 */
export function formatPktDateTime(date: Date = new Date()): string {
  const parts = Object.fromEntries(
    pktFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

/**
 * Generate a unique JazzCash transaction reference (pp_TxnRefNo) within the 20-character limit.
 */
export function generateTxnRefNo(prefix = "TRN", date: Date = new Date()): string {
  const stamp = formatPktDateTime(date);
  const room = MAX_REFERENCE_LENGTH - prefix.length - stamp.length;

  if (room < 1) {
    throw new Error(
      `Reference prefix "${prefix}" leaves insufficient room inside the ${MAX_REFERENCE_LENGTH}-character limit.`,
    );
  }

  let suffix = "";
  for (let index = 0; index < room; index += 1) {
    suffix += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }

  return `${prefix}${stamp}${suffix}`;
}

/**
 * Calculate pp_SecureHash for JazzCash according to vendor documentation.
 *
 * Rules:
 *  - Field names must start with 'pp' (case-sensitive, including pp_ and ppmpf_).
 *  - Exclude pp_SecureHash itself.
 *  - Exclude null, undefined, and empty string ("") values.
 *  - Sort keys by ascending ASCII code-unit order.
 *  - Concatenate values separated by '&'.
 *  - Prepend integritySalt separated by '&'.
 *  - Sign using HMAC-SHA256 with integritySalt as the secret key.
 *  - Render output as uppercase hexadecimal.
 */
export function calculateSecureHash(
  parameters: Record<string, unknown>,
  integritySalt: string,
): string {
  if (typeof integritySalt !== "string" || integritySalt.length === 0) {
    throw new Error("Integrity salt must not be empty.");
  }

  const formatHashValue = (val: unknown): string => {
    if (typeof val === "string") {
      return val.trim();
    }
    if (typeof val === "number" || typeof val === "boolean") {
      return String(val);
    }
    return "";
  };

  const contributingKeys = Object.keys(parameters)
    .filter((key) => key.startsWith("pp") && key !== "pp_SecureHash")
    .filter((key) => formatHashValue(parameters[key]) !== "")
    .sort();

  const orderedValues = contributingKeys.map((key) =>
    formatHashValue(parameters[key]),
  );
  const message = [integritySalt, ...orderedValues].join("&");

  return createHmac("sha256", integritySalt)
    .update(message, "utf8")
    .digest("hex")
    .toUpperCase();
}

/**
 * Verify pp_SecureHash on an inbound payload using constant-time comparison.
 */
export function verifySecureHash(
  payload: Record<string, unknown>,
  integritySalt: string,
): boolean {
  const receivedRaw = payload.pp_SecureHash;
  if (typeof receivedRaw !== "string" || receivedRaw.trim().length === 0) {
    return false;
  }

  const expected = calculateSecureHash(payload, integritySalt);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(receivedRaw.trim().toUpperCase(), "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Convert rupee major amounts or minor cent amounts to integer paisa string.
 */
export function toPaisa(majorAmount: number | string): string {
  const normalized = String(majorAmount).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (match === null) {
    throw new Error(
      `Amount "${majorAmount}" must be a positive number with at most two decimal places.`,
    );
  }

  const wholePart = match[1];
  if (wholePart === undefined) {
    throw new Error(`Amount "${majorAmount}" is invalid.`);
  }
  const whole = BigInt(wholePart);
  const decimal = BigInt((match[2] ?? "").padEnd(2, "0"));
  return (whole * 100n + decimal).toString();
}
