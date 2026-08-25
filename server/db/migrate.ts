import { readFileSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

interface Migration {
  readonly version: number;
  readonly name: string;
  readonly source: URL;
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    name: "create-orders",
    source: new URL("./migrations/001-create-orders.sql", import.meta.url),
  },
];

interface AppliedMigrationRow {
  readonly version: number;
  readonly name: string;
}

function readAppliedMigrations(
  database: DatabaseSync,
): ReadonlyMap<number, string> {
  const rows = database
    .prepare("SELECT version, name FROM schema_migrations ORDER BY version")
    .all() as unknown as AppliedMigrationRow[];

  return new Map(rows.map((row) => [row.version, row.name]));
}

function validateAppliedMigrations(
  appliedMigrations: ReadonlyMap<number, string>,
): void {
  const knownMigrations = new Map(
    migrations.map((migration) => [migration.version, migration.name]),
  );

  for (const [version, appliedName] of appliedMigrations) {
    const expectedName = knownMigrations.get(version);
    if (expectedName === undefined) {
      throw new Error(
        `Database migration ${version} is newer than this application supports.`,
      );
    }
    if (appliedName !== expectedName) {
      throw new Error(
        `Database migration ${version} was recorded as "${appliedName}" instead of "${expectedName}".`,
      );
    }
  }
}

function rollback(database: DatabaseSync, cause: unknown): never {
  try {
    if (database.isTransaction) {
      database.exec("ROLLBACK");
    }
  } catch (rollbackError) {
    throw new AggregateError(
      [cause, rollbackError],
      "The database migration and its rollback both failed.",
      { cause: rollbackError },
    );
  }

  throw cause;
}

/** Validate the ledger and apply pending migrations in one write transaction. */
export function runMigrations(database: DatabaseSync): void {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);

    const appliedMigrations = readAppliedMigrations(database);
    validateAppliedMigrations(appliedMigrations);
    for (const migration of migrations) {
      if (appliedMigrations.has(migration.version)) {
        continue;
      }

      const sql = readFileSync(migration.source, "utf8");
      database.exec(sql);
      database
        .prepare(
          "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        )
        .run(migration.version, migration.name, new Date().toISOString());
    }

    database.exec("COMMIT");
  } catch (error) {
    rollback(database, error);
  }
}
