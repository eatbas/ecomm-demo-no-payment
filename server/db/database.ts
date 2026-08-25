import { accessSync, constants, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./migrate.js";

const IN_MEMORY_DATABASE = ":memory:";
const BUSY_TIMEOUT_MILLISECONDS = 5_000;
const JOURNAL_MODE_RETRY_MILLISECONDS = 20;
const journalModeWaitBuffer = new Int32Array(
  new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT),
);

function isDatabaseBusy(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "errcode" in error &&
    (error.errcode === 5 || error.errcode === 6)
  );
}

function enableWriteAheadLogging(database: DatabaseSync): void {
  const deadline = Date.now() + BUSY_TIMEOUT_MILLISECONDS;
  while (true) {
    try {
      database.exec("PRAGMA journal_mode = WAL");
      return;
    } catch (error) {
      if (!isDatabaseBusy(error) || Date.now() >= deadline) {
        throw error;
      }
      Atomics.wait(
        journalModeWaitBuffer,
        0,
        0,
        JOURNAL_MODE_RETRY_MILLISECONDS,
      );
    }
  }
}

function prepareDatabaseDirectory(databasePath: string): void {
  if (databasePath === IN_MEMORY_DATABASE) {
    return;
  }

  const databaseDirectory = dirname(resolve(databasePath));
  try {
    mkdirSync(databaseDirectory, { recursive: true });
    accessSync(databaseDirectory, constants.R_OK | constants.W_OK);
  } catch (error) {
    throw new Error(
      `The order database directory is not readable and writable: ${databaseDirectory}`,
      { cause: error },
    );
  }
}

/** Open, harden, and migrate the application's SQLite connection. */
export function openOrderDatabase(databasePath: string): DatabaseSync {
  if (databasePath.trim().length === 0) {
    throw new Error("The order database path must not be empty.");
  }
  prepareDatabaseDirectory(databasePath);

  let database: DatabaseSync;
  try {
    database = new DatabaseSync(databasePath, {
      allowExtension: false,
      allowUnknownNamedParameters: false,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      timeout: BUSY_TIMEOUT_MILLISECONDS,
    });
  } catch (error) {
    throw new Error(`The order database could not be opened: ${databasePath}`, {
      cause: error,
    });
  }

  try {
    database.exec("PRAGMA foreign_keys = ON");
    if (databasePath !== IN_MEMORY_DATABASE) {
      enableWriteAheadLogging(database);
    }
    database.exec("PRAGMA synchronous = FULL");
    runMigrations(database);
    return database;
  } catch (error) {
    database.close();
    throw new Error("The order database could not be initialised.", {
      cause: error,
    });
  }
}
