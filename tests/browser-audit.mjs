import assert from "node:assert/strict";

import { chromium } from "playwright";

const configuredBaseUrl = process.env.BROWSER_AUDIT_BASE_URL ?? "http://storefront:8080";
const baseUrl = new URL(configuredBaseUrl);

if (!new Set(["http:", "https:"]).has(baseUrl.protocol)) {
  throw new Error("BROWSER_AUDIT_BASE_URL must use HTTP or HTTPS.");
}

const viewportCases = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
  { name: "minimum", width: 320, height: 720 },
];

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

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  assert.equal(hasHorizontalOverflow, false, `${viewportName}: horizontal overflow`);
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

async function assertAddDoesNotShiftCards(page, viewportName) {
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

  const confirmationBox = await page.getByText(/added to your cart/i).boundingBox();
  assert.ok(
    confirmationBox === null ||
      (confirmationBox.width <= 1 && confirmationBox.height <= 1),
    `${viewportName}: add-to-cart confirmation must stay visually hidden`,
  );
}

async function assertCustomerJourney(page) {
  await page.getByRole("link", { name: /Cart, 1 item/ }).click();
  await page.waitForFunction(() => document.activeElement?.id === "main-content");
  await page.getByRole("button", { name: "Increase quantity of Everyday Backpack" }).click();
  await page.getByRole("link", { name: "Review checkout" }).click();

  await page.getByRole("heading", { name: "Checkout", level: 1 }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === "main-content");
  await page.getByText("Payments are not available in this demo.").waitFor();
  assert.equal(await page.locator("form, input, select, textarea, iframe").count(), 0);
  assert.equal(
    await page.getByRole("button", { name: /pay|buy|place order|submit/i }).count(),
    0,
  );

  await page.getByRole("link", { name: "Back to cart" }).click();
  await page.waitForFunction(() => document.activeElement?.id === "main-content");
  assert.equal(
    await page
      .getByRole("status", {
        name: "Quantity of Everyday backpack",
        exact: true,
      })
      .textContent(),
    "2",
    "cart quantity must survive checkout navigation",
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
      await assertCatalogue(page, viewport.name);
      await assertAddDoesNotShiftCards(page, viewport.name);
      if (viewport.name === "desktop") {
        await assertCustomerJourney(page);
      }
      assert.deepEqual(failures, [], `${viewport.name}: browser diagnostics`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log("Browser audit passed for desktop, mobile, and 320 px viewports.");
