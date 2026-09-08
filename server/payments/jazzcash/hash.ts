import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * pp_SecureHash, per JazzCash's `hmac-sha256-calculation` and
 * `card-page-redirection` documents: select every field whose name starts
 * with `pp` (case-sensitive, so `pp_` and `ppmpf_` both qualify), excluding
 * `pp_SecureHash` itself and any empty/null value; sort the surviving field
 * *names* in ascending ASCII order; join the *values* with `&` (no trailing
 * delimiter); prepend the Integrity Salt (used as both the first element of
 * the message and the HMAC key); HMAC-SHA256 the UTF-8 bytes; render as
 * uppercase hexadecimal.
 */
export function buildSecureHash(
  fields: Readonly<Record<string, string | undefined | null>>,
  integritySalt: string,
): string {
  const orderedValues = Object.keys(fields)
    .filter((key) => key.startsWith("pp") && key !== "pp_SecureHash")
    .sort()
    .map((key) => fields[key])
    .filter(
      (value): value is string =>
        value !== undefined && value !== null && value !== "",
    );
  const message = [integritySalt, ...orderedValues].join("&");
  return createHmac("sha256", integritySalt)
    .update(message, "utf8")
    .digest("hex")
    .toUpperCase();
}

/** Recompute pp_SecureHash over an inbound payload and compare in constant time. */
export function verifySecureHash(
  fields: Readonly<Record<string, string | undefined | null>>,
  integritySalt: string,
  providedSecureHash: string | undefined | null,
): boolean {
  if (typeof providedSecureHash !== "string" || providedSecureHash.length === 0) {
    return false;
  }

  const expected = buildSecureHash(fields, integritySalt);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(providedSecureHash.toUpperCase(), "utf8");
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
