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
// Every browser-served file allowed to call the network at all, each locked to
// its own exact, enumerated set of same-origin endpoints — one fetch call per
// endpoint, any of that endpoint's accepted literal spellings. A file not
// listed here may not call fetch/XHR/WebSocket/EventSource/sendBeacon at all
// (see browserPolicies' "browser network primitive" entry below).
const allowedOrderFetchEndpoints = [
  {
    name: "create order",
    literals: new Set(['"/api/orders"', "'/api/orders'", "`/api/orders`"]),
  },
  {
    name: "admin order list",
    literals: new Set([
      '"/api/admin/orders?limit=50"',
      "'/api/admin/orders?limit=50'",
      "`/api/admin/orders?limit=50`",
      "`/api/admin/orders?limit=${DEFAULT_ADMIN_ORDER_LIMIT}`",
    ]),
  },
  {
    name: "order payment status",
    literals: new Set(["`/api/orders/${orderId}/status`"]),
  },
];
const allowedAdminAuthFetchEndpoints = [
  {
    name: "admin session check",
    literals: new Set(['"/api/admin/session"', "'/api/admin/session'", "`/api/admin/session`"]),
  },
  {
    name: "admin login",
    literals: new Set(['"/api/admin/login"', "'/api/admin/login'", "`/api/admin/login`"]),
  },
  {
    name: "admin logout",
    literals: new Set(['"/api/admin/logout"', "'/api/admin/logout'", "`/api/admin/logout`"]),
  },
];
const allowedNetworkFiles = new Map([
  ["src/features/orders/order.api.ts", allowedOrderFetchEndpoints],
  ["src/features/admin/admin.api.ts", allowedAdminAuthFetchEndpoints],
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

function inspectAllowedNetworkFile(path, contents, endpoints, violations) {
  const fetchCount = contents.match(/\bfetch\s*\(/g)?.length ?? 0;
  const fetchTargets = [
    ...contents.matchAll(/\bfetch\s*\(\s*([^,\r\n)]+)(?=\s*(?:,|\)))/g),
  ].map((match) => match[1]?.trim());

  if (fetchTargets.length !== fetchCount) {
    violations.push(`${path}: every fetch target must be a direct string literal`);
  }

  const allLiterals = new Set(endpoints.flatMap((endpoint) => [...endpoint.literals]));
  for (const fetchTarget of fetchTargets) {
    if (fetchTarget === undefined || !allLiterals.has(fetchTarget)) {
      violations.push(`${path}: unexpected fetch target ${fetchTarget ?? "unknown"}`);
    }
  }

  // Exactly one call site per approved endpoint, using any of its accepted
  // literal spellings: this file may not grow an unenumerated extra call,
  // and every approved endpoint must actually be used.
  if (fetchCount !== endpoints.length) {
    violations.push(
      `${path}: must contain exactly one fetch call per approved endpoint (${endpoints.length} expected, found ${fetchCount})`,
    );
  }
  for (const endpoint of endpoints) {
    const isPresent = fetchTargets.some(
      (target) => target !== undefined && endpoint.literals.has(target),
    );
    if (!isPresent) {
      violations.push(`${path}: missing required fetch to ${endpoint.name}`);
    }
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
    const allowedTargets = allowedNetworkFiles.get(relativePath);
    const policies = browserPolicies.map((policy) =>
      allowedTargets !== undefined && policy.name === "browser network primitive"
        ? {
            ...policy,
            patterns: policy.patterns.filter(
              (pattern) => pattern !== browserFetchPattern,
            ),
          }
        : policy,
    );
    inspectValue(relativePath, contents, policies, violations);

    if (allowedTargets !== undefined) {
      inspectAllowedNetworkFile(relativePath, contents, allowedTargets, violations);
    }
  }

  const nonBrowserPolicies = browserPolicies.filter(
    (policy) => policy.name !== "browser network primitive",
  );
  for (const path of [...sharedFiles, ...serverFiles]) {
    const relativePath = relative(absoluteRoot, path);
    // Application code (config.ts, the jazzcash/* client modules, and every
    // route) reads the JazzCash host only from JAZZCASH_BASE_URL at runtime —
    // it is never a literal string in source. Only *.test.ts fixtures and the
    // shared test-fixture helper are allowed a literal example/sandbox URL,
    // and only that one policy is relaxed for them; every other check (payment
    // provider identifiers, credential-shaped fields, analytics, …) still
    // applies in full.
    const policies =
      relativePath.endsWith(".test.ts") ||
      relativePath === "server/test/fixtures.ts"
        ? nonBrowserPolicies.filter((policy) => policy.name !== "remote URL")
        : nonBrowserPolicies;
    inspectValue(relativePath, await readFile(path, "utf8"), policies, violations);
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
