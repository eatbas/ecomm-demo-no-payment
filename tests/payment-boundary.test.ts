import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const executeFile = promisify(execFile);
const scannerPath = resolve("scripts/check-payment-boundary.mjs");
const temporaryDirectories: string[] = [];

interface BoundaryFixture {
  expectedCategory: string;
  name: string;
  path: string;
  value: string;
}

const forbiddenFixtures: BoundaryFixture[] = [
  {
    name: "payment package in the manifest",
    path: "package.json",
    value: JSON.stringify({ dependencies: { "@stripe/stripe-js": "1.0.0" } }),
    expectedCategory: "payment provider package",
  },
  {
    name: "payment package present only in lockfile package keys",
    path: "package-lock.json",
    value: JSON.stringify({
      lockfileVersion: 3,
      packages: { "": {}, "node_modules/@square/web-sdk": {} },
    }),
    expectedCategory: "payment provider package",
  },
  {
    name: "remote payment script in the root document",
    path: "index.html",
    value: '<script src="https://js.stripe.com/v3/"></script>',
    expectedCategory: "payment provider identifier or domain",
  },
  {
    name: "checkout provider identifier in browser source",
    path: "src/provider.ts",
    value: "const provider = checkout_sdk;",
    expectedCategory: "payment provider identifier or domain",
  },
  {
    name: "Square provider identifier in browser source",
    path: "src/provider.ts",
    value: "Square.pay();",
    expectedCategory: "payment provider identifier or domain",
  },
  {
    name: "analytics provider package",
    path: "package.json",
    value: JSON.stringify({ dependencies: { "@vercel/analytics": "1.0.0" } }),
    expectedCategory: "analytics or tracking package",
  },
  {
    name: "tracking provider domain in public markup",
    path: "public/tracking.html",
    value: '<script src="https://www.googletagmanager.com/gtag/js"></script>',
    expectedCategory: "analytics or tracking identifier or domain",
  },
  {
    name: "hyphenated payment token",
    path: "src/payment.ts",
    value: 'const paymentToken = record["payment-token"];',
    expectedCategory: "payment credential or token",
  },
  {
    name: "underscored payment intent",
    path: "src/payment.ts",
    value: "const payment_intent = {};",
    expectedCategory: "payment credential or token",
  },
  {
    name: "remote asset in a stylesheet",
    path: "src/styles.css",
    value: 'background-image: url("https://example.invalid/image.png");',
    expectedCategory: "remote URL",
  },
  {
    name: "remote asset in a public SVG",
    path: "public/products/item.svg",
    value:
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.invalid/item.png" /></svg>',
    expectedCategory: "remote URL",
  },
  {
    name: "fetch network primitive",
    path: "src/network.ts",
    value: 'fetch("/orders");',
    expectedCategory: "browser network primitive",
  },
  {
    name: "XMLHttpRequest network primitive",
    path: "src/network.ts",
    value: "new XMLHttpRequest();",
    expectedCategory: "browser network primitive",
  },
  {
    name: "WebSocket network primitive",
    path: "src/network.ts",
    value: 'new WebSocket("/socket");',
    expectedCategory: "browser network primitive",
  },
  {
    name: "EventSource network primitive",
    path: "src/network.ts",
    value: 'new EventSource("/events");',
    expectedCategory: "browser network primitive",
  },
  {
    name: "sendBeacon network primitive",
    path: "public/runtime.js",
    value: 'navigator.sendBeacon("/events", payload);',
    expectedCategory: "browser network primitive",
  },
];

async function writeFixtureFile(rootDirectory: string, path: string, value: string) {
  const absolutePath = resolve(rootDirectory, path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, value, "utf8");
}

async function createFixture(overrides: Pick<BoundaryFixture, "path" | "value">) {
  const rootDirectory = await mkdtemp(resolve(tmpdir(), "payment-boundary-"));
  temporaryDirectories.push(rootDirectory);

  const files = new Map([
    ["package.json", JSON.stringify({ dependencies: { react: "19.2.7" } })],
    [
      "package-lock.json",
      JSON.stringify({
        lockfileVersion: 3,
        packages: { "": {}, "node_modules/react": {} },
      }),
    ],
    [
      "index.html",
      '<main><h1>Checkout</h1><p>Payment is unavailable.</p></main>',
    ],
    ["src/main.ts", 'const image = "/products/item.svg"; export { image };'],
    ["src/styles.css", 'body { background-image: url("/products/item.svg"); }'],
    [
      "public/products/item.svg",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z" /></svg>',
    ],
    [overrides.path, overrides.value],
  ]);

  await Promise.all(
    [...files].map(([path, value]) => writeFixtureFile(rootDirectory, path, value)),
  );
  return rootDirectory;
}

async function runScanner(rootDirectory: string) {
  return executeFile(process.execPath, [scannerPath], {
    cwd: rootDirectory,
    encoding: "utf8",
  });
}

async function runScannerExpectingFailure(rootDirectory: string) {
  try {
    await runScanner(rootDirectory);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "stderr" in error &&
      typeof error.stderr === "string"
    ) {
      return error.stderr;
    }
    throw error;
  }

  throw new Error("Expected the payment boundary scanner to fail.");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe("payment boundary scanner", () => {
  it("allows inert checkout copy, local assets, and standard SVG namespaces", async () => {
    const rootDirectory = await createFixture({
      path: "src/checkout.ts",
      value: 'export const message = "Checkout payment is unavailable.";',
    });

    await expect(runScanner(rootDirectory)).resolves.toMatchObject({
      stderr: "",
    });
  });

  it.each(forbiddenFixtures)(
    "rejects $name",
    async ({ expectedCategory, path, value }) => {
      const rootDirectory = await createFixture({ path, value });
      const stderr = await runScannerExpectingFailure(rootDirectory);

      expect(stderr).toContain(expectedCategory);
    },
  );
});
