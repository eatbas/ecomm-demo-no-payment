// @vitest-environment node
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { openOrderDatabase } from "./database.js";
import { runMigrations } from "./migrate.js";

const temporaryDirectories: string[] = [];

function createDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "ecomm-orders-database-"));
  temporaryDirectories.push(directory);
  return join(directory, "orders.sqlite");
}

interface ChildResult {
  readonly code: number | null;
  readonly stderr: string;
}

function startConcurrentMigration(
  databasePath: string,
  startAt: number,
): Promise<ChildResult> {
  const databaseModuleUrl = new URL("./database.ts", import.meta.url).href;
  const source = `
    import { openOrderDatabase } from ${JSON.stringify(databaseModuleUrl)};
    const delay = Math.max(0, Number(process.env.MIGRATION_START_AT) - Date.now());
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    const database = openOrderDatabase(process.env.MIGRATION_DATABASE_PATH);
    database.close();
  `;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", source],
    {
      env: {
        ...process.env,
        MIGRATION_DATABASE_PATH: databasePath,
        MIGRATION_START_AT: String(startAt),
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );

  return new Promise((resolveResult, reject) => {
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolveResult({ code, stderr }));
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("order database", () => {
  it.each(["", "  "])("rejects the empty database path %j", (databasePath) => {
    expect(() => openOrderDatabase(databasePath)).toThrow(
      "The order database path must not be empty.",
    );
  });

  it("applies the versioned migration exactly once", () => {
    const database = openOrderDatabase(createDatabasePath());
    runMigrations(database);

    const migration = database
      .prepare("SELECT version, name FROM schema_migrations")
      .get() as { version: number; name: string };
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all() as unknown as { name: string }[];

    expect(migration).toEqual({ version: 1, name: "create-orders" });
    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(["orders", "order_items", "schema_migrations"]),
    );
    database.close();
  });

  it("retains its migration ledger after closing and reopening", () => {
    const databasePath = createDatabasePath();
    const firstConnection = openOrderDatabase(databasePath);
    firstConnection.close();

    const secondConnection = openOrderDatabase(databasePath);
    const migrationCount = secondConnection
      .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
      .get() as { count: number };

    expect(migrationCount.count).toBe(1);
    secondConnection.close();
  });

  it("rejects an inconsistent known migration ledger", () => {
    const database = openOrderDatabase(":memory:");
    database
      .prepare(
        "UPDATE schema_migrations SET name = 'unexpected-name' WHERE version = 1",
      )
      .run();

    expect(() => runMigrations(database)).toThrow(/recorded as/);
    expect(database.isOpen).toBe(true);
    database.close();
  });

  it("rejects a migration ledger newer than the application", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (2, 'future-schema', '2026-08-25T00:00:00.000Z');
    `);

    expect(() => runMigrations(database)).toThrow(
      "Database migration 2 is newer than this application supports.",
    );
    expect(database.isTransaction).toBe(false);
    expect(
      database
        .prepare("SELECT version, name FROM schema_migrations")
        .all(),
    ).toEqual([{ version: 2, name: "future-schema" }]);
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE name = 'orders'")
        .get(),
    ).toBeUndefined();
    database.close();
  });

  it("rolls back schema and ledger changes after a mid-migration failure", () => {
    const database = new DatabaseSync(":memory:");
    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      ) STRICT;
      CREATE TRIGGER reject_migration_ledger_insert
      BEFORE INSERT ON schema_migrations
      WHEN NEW.version = 1
      BEGIN
        SELECT RAISE(ABORT, 'forced migration ledger failure');
      END;
    `);

    expect(() => runMigrations(database)).toThrow(
      "forced migration ledger failure",
    );
    expect(database.isTransaction).toBe(false);
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
        .get(),
    ).toEqual({ count: 0 });
    expect(
      database
        .prepare(
          `SELECT name
           FROM sqlite_master
           WHERE name IN ('orders', 'order_items', 'orders_completed_newest_idx')`,
        )
        .all(),
    ).toEqual([]);
    database.close();
  });

  it(
    "serialises concurrent first-start migrations across processes",
    async () => {
      const databasePath = createDatabasePath();
      const startAt = Date.now() + 1_000;
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          startConcurrentMigration(databasePath, startAt),
        ),
      );

      const failedMigrations = results.filter((result) => result.code !== 0);
      expect(failedMigrations, JSON.stringify(failedMigrations)).toEqual([]);

      const database = openOrderDatabase(databasePath);
      expect(
        database
          .prepare("SELECT version, name FROM schema_migrations")
          .all(),
      ).toEqual([{ version: 1, name: "create-orders" }]);
      database.close();
    },
    15_000,
  );
});
