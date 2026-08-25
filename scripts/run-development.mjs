import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const localDataDirectory = resolve(".data");
await mkdir(localDataDirectory, { recursive: true });

const childDefinitions = [
  {
    name: "API",
    command: ["run", "dev:api"],
    environment: {
      HOST: "0.0.0.0",
      PORT: "3001",
      ORDER_DB_PATH: resolve(localDataDirectory, "orders.sqlite"),
    },
  },
  {
    name: "Vite",
    command: ["run", "dev:web", "--", "--strictPort"],
    environment: {},
  },
];

const children = childDefinitions.map(({ name, command, environment }) => ({
  name,
  process: spawn("npm", command, {
    env: { ...process.env, ...environment },
    stdio: "inherit",
  }),
}));

let shuttingDown = false;

function stopChildren(signal = "SIGTERM") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (child.process.exitCode === null && child.process.signalCode === null) {
      child.process.kill(signal);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stopChildren(signal));
}

const result = await Promise.race(
  children.map(
    (child) =>
      new Promise((resolveExit) => {
        child.process.once("error", (error) => {
          resolveExit({ name: child.name, code: 1, error });
        });
        child.process.once("exit", (code, signal) => {
          resolveExit({ name: child.name, code: code ?? 1, signal });
        });
      }),
  ),
);

const shutdownWasRequested = shuttingDown;
stopChildren();

if ("error" in result) {
  console.error(`${result.name} development process failed:`, result.error);
} else if (!shutdownWasRequested && result.code !== 0) {
  console.error(
    `${result.name} development process exited with ${result.signal ?? result.code}.`,
  );
}

await Promise.allSettled(
  children.map(
    (child) =>
      new Promise((resolveExit) => {
        if (child.process.exitCode !== null || child.process.signalCode !== null) {
          resolveExit(undefined);
          return;
        }
        child.process.once("exit", resolveExit);
      }),
  ),
);

process.exitCode = shutdownWasRequested ? 0 : result.code;
