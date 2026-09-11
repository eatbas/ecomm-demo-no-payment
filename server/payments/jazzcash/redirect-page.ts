import type { CardRedirectionFields } from "./client.js";
import { CARD_PAGE_REDIRECTION_PATH } from "./client.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Render an auto-submitting HTML redirection page that posts the signed
 * parameters to JazzCash's hosted checkout.
 */
export function renderCardRedirectionPage(
  fields: CardRedirectionFields,
  jazzcashBaseUrl: string,
  nonce: string,
): string {
  const actionUrl = `${jazzcashBaseUrl}${CARD_PAGE_REDIRECTION_PATH}`;
  const hiddenInputs = (
    Object.entries(fields) as Array<[string, string]>
  )
    .map(
      ([name, value]) =>
        `      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Redirecting to JazzCash</title>
  </head>
  <body>
    <p>Redirecting to JazzCash to complete your payment&hellip;</p>
    <form id="jazzcash-redirect-form" method="post" action="${escapeHtml(actionUrl)}">
${hiddenInputs}
      <noscript>
        <button type="submit">Continue to JazzCash</button>
      </noscript>
    </form>
    <script nonce="${escapeHtml(nonce)}">
      document.getElementById("jazzcash-redirect-form").submit();
    </script>
  </body>
</html>
`;
}
