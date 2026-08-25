import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const forbiddenPatterns = [
  /\bstripe\b/i,
  /\bpaypal\b/i,
  /\badyen\b/i,
  /\bbraintree\b/i,
  /\bklarna\b/i,
  /\bpayment(?:intent|method|token)\b/i,
  /https?:\/\//i,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
];
const inspectedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".html"]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}

const sourceFiles = (await listFiles("src")).filter((path) =>
  inspectedExtensions.has(extname(path)),
);
const files = ["package.json", ...sourceFiles];
const violations = [];

for (const path of files) {
  const contents = await readFile(path, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(contents)) {
      violations.push(`${path}: matched ${pattern.source}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Payment boundary violations found:\n" + violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Payment boundary check passed for ${files.length} files.`);
}
