import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
]);
const publicExtensions = new Set([...sourceExtensions, ".htm", ".svg"]);
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const allowedSvgNamespaces = [
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/1999/xlink",
];
const allowedBrowserNetworkFile = "src/features/orders/order.api.ts";
const allowedOrderFetchTargets = new Set([
  '"/api/orders"',
  "'/api/orders'",
  "`/api/orders`",
  '"/api/admin/orders?limit=50"',
  "'/api/admin/orders?limit=50'",
  "`/api/admin/orders?limit=50`",
  "`/api/admin/orders?limit=${DEFAULT_ADMIN_ORDER_LIMIT}`",
  "`/api/orders/${orderId}/status`",
]);
const browserFetchPattern = /\bfetch\s*\(/;

const packagePolicies = [
  {
    name: "payment provider package",
    patterns: [
      /(?:^|[/@_.-])(?:stripe|paypal|adyen|braintree|klarna|square(?:up)?)(?:[/@_.-]|$)/i,
      /(?:^|[/@_.-])checkout(?:[/@_.-]|$)/i,
    ],
  },
  {
    name: "analytics or tracking package",
    patterns: [
      /(?:^|[/@_.-])(?:analytics|tracking|segment|mixpanel|amplitude|posthog|plausible|matomo|hotjar|fullstory)(?:[/@_.-]|$)/i,
      /(?:^|[/@_.-])google[-_.]?(?:analytics|tag[-_.]?manager)(?:[/@_.-]|$)/i,
    ],
  },
];

const browserPolicies = [
  {
    name: "payment provider identifier or domain",
    patterns: [
      /\b(?:stripe|paypal|adyen|braintree|klarna|squareup)\b/i,
      /\bsquare(?=\s*[.(])/i,
      /\bcheckout(?:\.com|[-_.](?:com|sdk|payments?))\b/i,
    ],
  },
  {
    name: "analytics or tracking identifier or domain",
    patterns: [
      /\b(?:google[-_.]?(?:analytics|tag[-_.]?manager)|gtag|segment|mixpanel|amplitude|posthog|plausible|matomo|hotjar|fullstory)\b/i,
      /\b(?:analytics|tracking)[-_.](?:api|client|sdk)\b/i,
      /\b(?:analytics|tracking)\b(?![-_.])/i,
    ],
  },
  {
    name: "payment credential or token",
    patterns: [
      /\bpayment[-_.]?(?:credential|intent|key|method|secret|token)s?\b/i,
      /\b(?:billing|card)[-_.]?(?:credential|number|token)s?\b/i,
    ],
  },
  {
    name: "remote URL",
    patterns: [/https?:\/\//i],
  },
  {
    name: "browser network primitive",
    patterns: [
      browserFetchPattern,
      /\bXMLHttpRequest\b/,
      /\bWebSocket\b/,
      /\bEventSource\b/,
      /\b(?:navigator\s*\.\s*)?sendBeacon\s*\(/,
    ],
  },
];

async function listFiles(directory) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function collectManifestPackageNames(manifest) {
  const names = new Set();

  for (const field of dependencyFields) {
    const dependencies = manifest[field];
    if (dependencies && typeof dependencies === "object") {
      Object.keys(dependencies).forEach((name) => names.add(name));
    }
  }

  return names;
}

function packageNameFromLockPath(path) {
  const marker = "node_modules/";
  const markerIndex = path.lastIndexOf(marker);
  return markerIndex === -1 ? null : path.slice(markerIndex + marker.length);
}

function collectLockfilePackageNames(lockfile) {
  const names = new Set();

  if (lockfile.packages && typeof lockfile.packages === "object") {
    for (const path of Object.keys(lockfile.packages)) {
      const name = packageNameFromLockPath(path);
      if (name) {
        names.add(name);
      }
    }
  }

  if (lockfile.dependencies && typeof lockfile.dependencies === "object") {
    Object.keys(lockfile.dependencies).forEach((name) => names.add(name));
  }

  return names;
}

function inspectValue(path, value, policies, violations) {
  for (const policy of policies) {
    for (const pattern of policy.patterns) {
      if (pattern.test(value)) {
        violations.push(`${path}: ${policy.name} matched ${pattern.source}`);
      }
    }
  }
}

function removeAllowedSvgNamespaces(path, contents) {
  if (extname(path) !== ".svg") {
    return contents;
  }

  return allowedSvgNamespaces.reduce(
    (sanitisedContents, namespace) =>
      sanitisedContents.replaceAll(namespace, "allowed-svg-namespace"),
    contents,
  );
}

function inspectAllowedOrderApiClient(path, contents, violations) {
  const fetchCount = contents.match(/\bfetch\s*\(/g)?.length ?? 0;
  const fetchTargets = [
    ...contents.matchAll(/\bfetch\s*\(\s*([^,\r\n)]+)(?=\s*(?:,|\)))/g),
  ].map((match) => match[1]?.trim());

  if (fetchCount !== 2 && fetchCount !== 3) {
    violations.push(
      `${path}: order API client must contain approved endpoint-specific fetch primitives`,
    );
  }

  if (fetchTargets.length !== fetchCount) {
    violations.push(`${path}: every fetch target must be a direct string literal`);
  }

  for (const fetchTarget of fetchTargets) {
    if (fetchTarget === undefined || !allowedOrderFetchTargets.has(fetchTarget)) {
      violations.push(`${path}: unexpected fetch target ${fetchTarget ?? "unknown"}`);
    }
  }

  const uniqueTargets = new Set(fetchTargets);
  const hasCreateTarget = [...uniqueTargets].some((target) =>
    target?.includes("/api/orders") && !target?.includes("/status"),
  );
  const hasAdminTarget = [...uniqueTargets].some((target) =>
    target?.includes("/api/admin/orders?limit="),
  );
  if (!hasCreateTarget || !hasAdminTarget) {
    violations.push(`${path}: approved order API targets are required`);
  }
}

export async function inspectPaymentBoundary(rootDirectory = process.cwd()) {
  const absoluteRoot = resolve(rootDirectory);
  const manifestPath = join(absoluteRoot, "package.json");
  const lockfilePath = join(absoluteRoot, "package-lock.json");
  const manifest = await readJson(manifestPath);
  const lockfile = await readJson(lockfilePath);
  const packageSources = [
    ["package.json dependency keys", collectManifestPackageNames(manifest)],
    ["package-lock.json package keys", collectLockfilePackageNames(lockfile)],
  ];
  const violations = [];

  for (const [source, names] of packageSources) {
    for (const name of names) {
      inspectValue(source, name, packagePolicies, violations);
    }
  }

  const sourceFiles = (await listFiles(join(absoluteRoot, "src"))).filter((path) =>
    sourceExtensions.has(extname(path)),
  );
  const sharedFiles = (await listFiles(join(absoluteRoot, "shared"))).filter((path) =>
    sourceExtensions.has(extname(path)),
  );
  const serverFiles = (await listFiles(join(absoluteRoot, "server"))).filter((path) =>
    sourceExtensions.has(extname(path)),
  );
  const publicFiles = (await listFiles(join(absoluteRoot, "public"))).filter((path) =>
    publicExtensions.has(extname(path)),
  );
  const browserFiles = [join(absoluteRoot, "index.html"), ...sourceFiles, ...publicFiles];

  for (const path of browserFiles) {
    const contents = removeAllowedSvgNamespaces(path, await readFile(path, "utf8"));
    const relativePath = relative(absoluteRoot, path);
    const policies = browserPolicies.map((policy) =>
      relativePath === allowedBrowserNetworkFile &&
      policy.name === "browser network primitive"
        ? {
            ...policy,
            patterns: policy.patterns.filter(
              (pattern) => pattern !== browserFetchPattern,
            ),
          }
        : policy,
    );
    inspectValue(relativePath, contents, policies, violations);

    if (relativePath === allowedBrowserNetworkFile) {
      inspectAllowedOrderApiClient(relativePath, contents, violations);
    }
  }

  const nonBrowserPolicies = browserPolicies.filter(
    (policy) => policy.name !== "browser network primitive",
  );
  for (const path of [...sharedFiles, ...serverFiles]) {
    const isTestFixture =
      path.endsWith(".test.ts") || path.endsWith(".test.tsx");
    const activePolicies = isTestFixture
      ? nonBrowserPolicies.filter((policy) => policy.name !== "remote URL")
      : nonBrowserPolicies;
    inspectValue(
      relative(absoluteRoot, path),
      await readFile(path, "utf8"),
      activePolicies,
      violations,
    );
  }

  return {
    inspectedFileCount:
      browserFiles.length + sharedFiles.length + serverFiles.length + 2,
    violations,
  };
}

async function runCli() {
  const result = await inspectPaymentBoundary();

  if (result.violations.length > 0) {
    console.error(
      "Payment boundary violations found:\n" + result.violations.join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Payment boundary check passed for ${result.inspectedFileCount} files.`,
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await runCli();
}
