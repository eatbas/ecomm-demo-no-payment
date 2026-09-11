import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * pp_SecureHash calculation per JazzCash's hmac-sha256-calculation documentation:
 * 1. Select every field whose name starts with 'pp' (case-sensitive, covers both pp_ and ppmpf_).
 * 2. Exclude 'pp_SecureHash' itself and any empty or null values.
 * 3. Sort surviving field names in ascending ASCII (code unit) order.
 * 4. Join the values with '&' (no trailing delimiter).
 * 5. Prepend the Integrity Salt followed by '&'.
 * 6. Compute HMAC-SHA256 over the UTF-8 bytes using the Integrity Salt as the secret key.
 * 7. Render the digest as uppercase hexadecimal.
 */
export function buildSecureHash(
  fields: object,
  integritySalt: string,
): string {
  const record = fields as Record<string, unknown>;
  const orderedValues = Object.keys(record)
    .filter((key) => key.startsWith("pp") && key !== "pp_SecureHash")
    .sort()
    .map((key) => record[key])
    .filter(
      (value): value is string =>
        typeof value === "string" && value !== "",
    );

  const message = [integritySalt, ...orderedValues].join("&");
  return createHmac("sha256", integritySalt)
    .update(message, "utf8")
    .digest("hex")
    .toUpperCase();
}

/** Recompute pp_SecureHash over an inbound payload and compare in constant time. */
export function verifySecureHash(
  fields: object,
  integritySalt: string,
  providedSecureHash: string | undefined | null,
): boolean {
  if (
    typeof providedSecureHash !== "string" ||
    providedSecureHash.length === 0
  ) {
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
