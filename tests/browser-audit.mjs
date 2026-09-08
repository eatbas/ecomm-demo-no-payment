import assert from "node:assert/strict";

import { chromium } from "playwright";

const configuredBaseUrl = process.env.BROWSER_AUDIT_BASE_URL ?? "http://storefront:8080";
const baseUrl = new URL(configuredBaseUrl);
const jazzcashOrigin = process.env.BROWSER_AUDIT_JAZZCASH_ORIGIN;

if (!new Set(["http:", "https:"]).has(baseUrl.protocol)) {
  throw new Error("BROWSER_AUDIT_BASE_URL must use HTTP or HTTPS.");
}
if (jazzcashOrigin === undefined || jazzcashOrigin.length === 0) {
  throw new Error("BROWSER_AUDIT_JAZZCASH_ORIGIN is required.");
}

const confirmationText = "Everyday backpack, quantity 1";
const testCustomer = {
  fullName: "Zara Khan",
  email: "zara@example.test",
  phone: "+92 300 1234567",
  addressLine1: "12 Model Town",
  city: "Lahore",
  postcode: "54700",
  country: "Pakistan",
};

const viewportCases = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
  { name: "minimum", width: 320, height: 720 },
];

function hasHorizontalOverflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
}

/**
 * The only cross-origin request this application ever makes is the one,
 * user-initiated form POST from the JazzCash redirect page to JazzCash's own
 * host (see server/payments/jazzcash/redirect-page.ts). It is stubbed out
 * here (never actually reaches JazzCash) so the audit can verify the
 * hand-off happens correctly without a live JazzCash sandbox, while every
 * other external request still fails the audit exactly as before.
 */
function monitorPage(page) {
  const failures = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).origin === jazzcashOrigin) {
      return;
    }
    failures.push(`request: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== baseUrl.origin && requestUrl.origin !== jazzcashOrigin) {
      failures.push(`external request: ${request.url()}`);
    }
  });

  return failures;
}

async function stubJazzCashRedirect(page) {
  await page.route(`${jazzcashOrigin}/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>JazzCash sandbox stub</title><p>Stubbed for the browser audit.</p>",
    });
  });
}

async function assertCatalogue(page, viewportName) {
  await page.goto(baseUrl.href, { waitUntil: "networkidle" });

  assert.equal(await page.title(), "Common Goods", `${viewportName}: document title`);
  assert.equal(
    await page.getByRole("button", { name: /^Add .+ to cart$/ }).count(),
    3,
    `${viewportName}: product count`,
  );

  await page.keyboard.press("Tab");
  const focusedElement = page.locator(":focus");
  assert.equal(
    await focusedElement.textContent(),
    "Skip to main content",
    `${viewportName}: skip link must be the first keyboard target`,
  );
  assert.notEqual(
    await focusedElement.boundingBox(),
    null,
    `${viewportName}: focused skip link must be visible`,
  );

  assert.equal(
    await hasHorizontalOverflow(page),
    false,
    `${viewportName}: horizontal overflow`,
  );
}

function roundedBox(box) {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

async function measureCatalogueCards(page) {
  return page.locator("main li").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        height: box.height,
        width: box.width,
        x: box.x + window.scrollX,
        y: box.y + window.scrollY,
      };
    }),
  );
}

async function assertAddToCartFeedback(page, viewportName) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  const boxesBeforeAdd = await measureCatalogueCards(page);

  await page.getByRole("button", { name: "Add Everyday Backpack to cart" }).click();

  const boxesAfterAdd = await measureCatalogueCards(page);
  assert.deepEqual(
    boxesAfterAdd.map(roundedBox),
    boxesBeforeAdd.map(roundedBox),
    `${viewportName}: adding to cart must not shift catalogue card boxes`,
  );

  const confirmation = page.getByText(confirmationText, { exact: true });
  await confirmation.waitFor();

  const confirmationBox = await confirmation.boundingBox();
  assert.ok(
    confirmationBox !== null &&
      confirmationBox.width > 1 &&
      confirmationBox.height > 1,
    `${viewportName}: add-to-cart confirmation must be visible`,
  );

  const viewportSize = page.viewportSize();
  assert.ok(
    confirmationBox.x >= 0 &&
      confirmationBox.x + confirmationBox.width <= viewportSize.width,
    `${viewportName}: add-to-cart confirmation must stay inside the viewport`,
  );
  assert.equal(
    await hasHorizontalOverflow(page),
    false,
    `${viewportName}: horizontal overflow after add-to-cart confirmation`,
  );
}

async function assertConfirmationExpires(page) {
  await page
    .getByText(confirmationText, { exact: true })
    .waitFor({ state: "detached", timeout: 10_000 });
}

async function fillCustomerDetails(page) {
  await page.getByLabel("Full name").fill(testCustomer.fullName);
  await page.getByLabel("Email address").fill(testCustomer.email);
  await page.getByLabel("Phone number").fill(testCustomer.phone);
  await page.getByLabel("Address").fill(testCustomer.addressLine1);
  await page.getByLabel("Town or city").fill(testCustomer.city);
  await page.getByLabel("Postcode").fill(testCustomer.postcode);
  await page.getByLabel("Country").fill(testCustomer.country);
}

/**
 * Drives checkout through to the JazzCash hand-off (never further — see
 * stubJazzCashRedirect) and returns the order reference shown in the cart
 * summary. The order is left `awaiting_payment`; it deliberately does not
 * appear in the admin view (see assertAdminPage), matching real behaviour.
 */
async function assertCustomerJourney(page) {
  await page.getByRole("link", { name: /Cart, 1 item/ }).click();
  await page.waitForFunction(() => document.activeElement?.id === "main-content");
  await page.getByRole("button", { name: "Increase quantity of Everyday Backpack" }).click();
  await page.getByRole("link", { name: "Review checkout" }).click();

  await page.getByRole("heading", { name: "Checkout", level: 1 }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "main-content");
  assert.equal(await page.locator("input").count(), 7);
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(await hasHorizontalOverflow(page), false, "checkout horizontal overflow");

  await fillCustomerDetails(page);
  await page.getByRole("button", { name: "Continue to JazzCash" }).click();

  // The stubbed JazzCash response is the final page loaded by the auto-submit
  // form; its title proves the hand-off (server-rendered redirect page →
  // cross-origin POST) actually happened.
  await page.waitForFunction(
    () => document.title === "JazzCash sandbox stub",
    { timeout: 15_000 },
  );
}

async function assertAdminPageLoaded(page) {
  await page.goto(new URL("/admin", baseUrl).href, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Orders", level: 1 }).waitFor();
}

async function assertAdminKeyboardFocus(page, viewportName) {
  await page.keyboard.press("Tab");
  const skipLink = page.locator(":focus");
  assert.equal(
    await skipLink.textContent(),
    "Skip to main content",
    `${viewportName}: admin skip link must be the first keyboard target`,
  );
  assert.notEqual(
    await skipLink.boundingBox(),
    null,
    `${viewportName}: focused admin skip link must be visible`,
  );

  await page.keyboard.press("Tab");
  const applicationLink = page.locator(":focus");
  assert.equal(
    await applicationLink.textContent(),
    "Common Goods",
    `${viewportName}: application link must follow the skip link`,
  );
  assert.notEqual(
    await applicationLink.boundingBox(),
    null,
    `${viewportName}: focused application link must be visible`,
  );
  assert.notEqual(
    await applicationLink.evaluate((element) => getComputedStyle(element).boxShadow),
    "none",
    `${viewportName}: application link must have a visible focus ring`,
  );
}

async function assertAdminResponsiveLayout(page, viewportName) {
  const table = page.locator("table");
  const cardList = page.locator('ul[aria-label="Completed demo orders"]');
  const desktop = viewportName === "desktop";

  assert.equal(
    await table.isVisible(),
    desktop,
    `${viewportName}: desktop table visibility`,
  );
  assert.equal(
    await cardList.isVisible(),
    !desktop,
    `${viewportName}: mobile card visibility`,
  );
}

async function assertEmptyAdminPage(page, viewportName) {
  await assertAdminPageLoaded(page);
  await page.getByRole("heading", { name: "No completed orders", level: 2 }).waitFor();
  assert.equal(await page.locator("table").count(), 0);
  assert.equal(await page.locator('ul[aria-label="Completed demo orders"]').count(), 0);
  assert.equal(
    await hasHorizontalOverflow(page),
    false,
    `${viewportName}: empty admin horizontal overflow`,
  );
  await assertAdminKeyboardFocus(page, viewportName);
}

/**
 * An order that only reached the JazzCash hand-off (no real payment, since
 * JazzCash itself is stubbed) is `awaiting_payment` — it must never appear
 * in the admin view, which lists only `paid` orders.
 */
async function assertUnpaidOrderNotAdminVisible(page, viewportName) {
  await assertAdminPageLoaded(page);
  await assertAdminResponsiveLayout(page, viewportName);
  await page.getByRole("heading", { name: "No completed orders", level: 2 }).waitFor();
  assert.equal(
    await hasHorizontalOverflow(page),
    false,
    `${viewportName}: post-checkout admin horizontal overflow`,
  );
}

const browser = await chromium.launch();

try {
  for (const viewport of viewportCases) {
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const failures = monitorPage(page);

    try {
      await assertEmptyAdminPage(page, viewport.name);
      assert.deepEqual(failures, [], `${viewport.name}: empty admin diagnostics`);
    } finally {
      await context.close();
    }
  }

  for (const viewport of viewportCases) {
    const context = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const failures = monitorPage(page);
    await stubJazzCashRedirect(page);

    try {
      await assertCatalogue(page, viewport.name);
      await assertAddToCartFeedback(page, viewport.name);
      if (viewport.name === "desktop") {
        await assertConfirmationExpires(page);
      }
      await assertCustomerJourney(page);
      await assertUnpaidOrderNotAdminVisible(page, viewport.name);
      assert.deepEqual(failures, [], `${viewport.name}: browser diagnostics`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log("Browser audit passed for desktop, mobile, and 320 px viewports.");
