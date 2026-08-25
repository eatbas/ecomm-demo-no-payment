// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
const temporaryDirectories: string[] = [];

async function createStaticApp(): Promise<Awaited<ReturnType<typeof buildApp>>> {
  const staticRoot = await mkdtemp(join(tmpdir(), "ecomm-static-app-"));
  temporaryDirectories.push(staticRoot);
  await mkdir(join(staticRoot, "assets"));
  await writeFile(join(staticRoot, "index.html"), "<!doctype html><title>Test</title>");
  await writeFile(join(staticRoot, "assets", "index-ABCDEFGH.js"), "export {};");

  const app = await buildApp({ databasePath: ":memory:", staticRoot });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => rm(path, { recursive: true })),
  );
});

describe("production routing and cache policy", () => {
  it("keeps the API namespace and query-bearing health checks dynamic", async () => {
    const app = await createStaticApp();
    const bareApi = await app.inject({ method: "GET", url: "/api" });
    const health = await app.inject({ method: "GET", url: "/healthz?probe=1" });

    expect(bareApi.statusCode).toBe(404);
    expect(bareApi.headers["content-type"]).toContain("application/json");
    expect(bareApi.headers["cache-control"]).toBe("no-store");
    expect(health.statusCode).toBe(200);
    expect(health.headers["cache-control"]).toBe("no-store");
  });

  it("applies explicit cache policies to static files, fallbacks, and 404s", async () => {
    const app = await createStaticApp();
    const index = await app.inject({ method: "GET", url: "/" });
    const fallback = await app.inject({ method: "GET", url: "/admin" });
    const hashedAsset = await app.inject({
      method: "GET",
      url: "/assets/index-ABCDEFGH.js",
    });
    const missingAsset = await app.inject({
      method: "GET",
      url: "/assets/missing.js",
    });
    const missingExtension = await app.inject({
      method: "GET",
      url: "/unknown.txt",
    });

    expect(index.statusCode).toBe(200);
    expect(index.headers["cache-control"]).toBe("no-cache");
    expect(fallback.statusCode).toBe(200);
    expect(fallback.headers["cache-control"]).toBe("no-cache");
    expect(hashedAsset.statusCode).toBe(200);
    expect(hashedAsset.headers["cache-control"]).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(missingAsset.statusCode).toBe(404);
    expect(missingAsset.headers["cache-control"]).toBe("no-cache");
    expect(missingExtension.statusCode).toBe(404);
    expect(missingExtension.headers["cache-control"]).toBe("no-cache");
  });
});
