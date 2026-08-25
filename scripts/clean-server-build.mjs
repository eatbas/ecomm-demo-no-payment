import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const generatedPaths = [
  resolve("dist-server"),
  resolve("node_modules/.tmp/tsconfig.server.tsbuildinfo"),
];

await Promise.all(
  generatedPaths.map((generatedPath) =>
    rm(generatedPath, { force: true, recursive: true }),
  ),
);
