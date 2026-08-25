export const CURRENCY = "EUR";
export const CURRENCY_LOCALE = "en-GB";

const euroFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY,
});

export function formatCurrency(priceCents: number): string {
  if (!Number.isSafeInteger(priceCents)) {
    throw new TypeError("Price in cents must be a safe integer.");
  }

  return euroFormatter.format(priceCents / 100);
}
