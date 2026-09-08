/**
 * A full-page, same-origin navigation — deliberately not a fetch/XHR. Used
 * only to hand off to the server-rendered JazzCash redirect page
 * (see server/payments/jazzcash/redirect-page.ts), which itself performs the
 * one, narrowly-scoped cross-origin form POST this app ever makes.
 *
 * Kept as its own function (rather than calling `window.location.assign`
 * inline) so it is a single, auditable seam and so tests can substitute it
 * without fighting jsdom's non-configurable `Location.prototype.assign`.
 */
export function navigateTo(url: string): void {
  window.location.assign(url);
}
