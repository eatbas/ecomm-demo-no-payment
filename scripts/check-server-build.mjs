import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const serverBuildRoot = resolve("dist-server");
const runtimeEntryPoint = resolve(serverBuildRoot, "server/start.js");
const testModulePattern = /\.(?:test|spec)\.js$/;

async function findTestModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const testModules = [];

  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      testModules.push(...(await findTestModules(entryPath)));
    } else if (testModulePattern.test(entry.name)) {
      testModules.push(entryPath);
    }
  }

  return testModules;
}

await access(runtimeEntryPoint);
const emittedTestModules = await findTestModules(serverBuildRoot);
if (emittedTestModules.length > 0) {
  throw new Error(
    `The production server build contains test modules:\n${emittedTestModules.join("\n")}`,
  );
}

console.log("Production server build contains no test modules.");
