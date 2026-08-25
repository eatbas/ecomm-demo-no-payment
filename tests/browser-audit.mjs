import assert from "node:assert/strict";

import { chromium } from "playwright";

const configuredBaseUrl = process.env.BROWSER_AUDIT_BASE_URL ?? "http://storefront:8080";
const baseUrl = new URL(configuredBaseUrl);

if (!new Set(["http:", "https:"]).has(baseUrl.protocol)) {
  throw new Error("BROWSER_AUDIT_BASE_URL must use HTTP or HTTPS.");
}

const confirmationText = "Everyday backpack, quantity 1";

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

function monitorPage(page) {
  const failures = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => {
    failures.push(`request: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== baseUrl.origin) {
      failures.push(`external request: ${request.url()}`);
    }
  });

  return failures;
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

async function assertCustomerJourney(page) {
  await page.getByRole("link", { name: /Cart, 1 item/ }).click();
  await page.waitForFunction(() => document.activeElement?.id === "main-content");
  await page.getByRole("button", { name: "Increase quantity of Everyday Backpack" }).click();
  await page.getByRole("link", { name: "Review checkout" }).click();

  await page.getByRole("heading", { name: "Checkout", level: 1 }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "main-content");
  await page.getByRole("button", { name: "Fill with demo account" }).waitFor();
  assert.equal(await page.locator("input").count(), 7);
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(await hasHorizontalOverflow(page), false, "checkout horizontal overflow");

  await page.getByRole("button", { name: "Fill with demo account" }).click();
  assert.equal(await page.getByLabel("Email address").inputValue(), "alex@example.test");
  await page.getByRole("button", { name: "Complete order" }).click();
  await page.getByRole("heading", { name: "Demo order completed" }).waitFor();
  await page.getByText("Payment not configured").waitFor();
  assert.equal(
    await hasHorizontalOverflow(page),
    false,
    "confirmation horizontal overflow",
  );

  const reference = await page
    .locator("dd")
    .filter({ hasText: /^CG-[A-Z0-9]{8}$/ })
    .textContent();
  assert.match(reference ?? "", /^CG-[A-Z0-9]{8}$/);
  return reference;
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
  await page.goto(new URL("/admin", baseUrl).href, { waitUntil: "networkidle" });
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

async function assertAdminPage(page, viewportName, reference) {
  await page.goto(new URL("/admin", baseUrl).href, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Completed orders", level: 1 }).waitFor();
  await assertAdminResponsiveLayout(page, viewportName);
  const visibleOrders =
    viewportName === "desktop"
      ? page.locator("table")
      : page.locator('ul[aria-label="Completed demo orders"]');
  await visibleOrders.getByText(reference, { exact: true }).waitFor();
  await visibleOrders
    .getByText("Payment not configured", { exact: true })
    .first()
    .waitFor();
  assert.equal(
    await hasHorizontalOverflow(page),
    false,
    `${viewportName}: admin horizontal overflow`,
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

    try {
      await assertCatalogue(page, viewport.name);
      await assertAddToCartFeedback(page, viewport.name);
      if (viewport.name === "desktop") {
        await assertConfirmationExpires(page);
      }
      const completedOrderReference = await assertCustomerJourney(page);
      await assertAdminPage(page, viewport.name, completedOrderReference);
      assert.deepEqual(failures, [], `${viewport.name}: browser diagnostics`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log("Browser audit passed for desktop, mobile, and 320 px viewports.");
