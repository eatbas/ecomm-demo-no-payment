export const CURRENCY = "PKR";
export const CURRENCY_LOCALE = "en-PK";

const pkrFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(priceCents: number): string {
  if (!Number.isSafeInteger(priceCents)) {
    throw new TypeError("Price in cents must be a safe integer.");
  }

  return pkrFormatter.format(priceCents / 100);
}
