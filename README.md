# Ecommerce demo without payment

A customer-facing React demonstration with exactly three products, a persistent browser cart, and a deliberately inert checkout page. The production artefact is a static Vite build served by an unprivileged nginx container.

## Scope and routes

| Route | Purpose |
| --- | --- |
| `/` | Three-product catalogue and add-to-cart controls |
| `/cart` | Cart quantities, removal, clearing, and subtotal |
| `/checkout` | Read-only cart summary and payment-unavailable notice |
| `/healthz` | Lightweight container and Coolify health response |
| Any other client route | Customer-facing not-found view |

The app has no backend, database, account, inventory, order, analytics, or tracking service. Cart state is stored locally in the customer's browser using a versioned `localStorage` record. Invalid, obsolete, or unavailable storage degrades safely without making the cart authoritative.

The checkout route is intentionally non-functional. It has no form, transaction action, payment provider, payment SDK, network submission, or pretend order state. The app does not collect or transmit personal, contact, billing, or payment data. Do not add runtime secrets: this static application neither needs nor consumes them.

## Architecture

- React and React Router provide the application shell and client-side routes.
- Typed catalogue data contains the three fixed products; prices are represented as integer euro cents.
- One cart context owns state, a pure reducer applies changes, and defensive storage helpers persist validated identifiers and quantities.
- A separate toast context queues transient add-to-cart confirmations. Its pure reducer keeps one message per product and bounds the queue, one always-present polite live region announces each confirmation, and the visible stack sits outside the accessibility tree, the page layout, and the pointer-event path.
- Local shadcn/ui source supplies the small accessible component set. Tailwind CSS supplies design tokens and responsive layout.
- Vite compiles static files to `dist/`. nginx serves only that output, applies security and cache headers, and falls back to `index.html` for extensionless client routes.
- The multi-stage Docker build separates dependency installation, checks, compilation, and the minimal runtime. No source, tests, npm cache, or `node_modules` are copied to the runtime image.

Modern evergreen browsers with ES modules and `localStorage` support are the target. If storage is disabled, the current in-memory cart remains usable until the page reloads.

## Docker-only development

From the repository root:

```sh
./start.sh
```

Open <http://127.0.0.1:5173>. The wrapper uses the Docker flow below, keeps `node_modules` on a named volume, and does not create a `.env` file: this static application has no runtime configuration or secrets.

Node.js is not required on the host. The development server binds only to the host loopback interface:

```sh
docker volume create ecomm-demo-node-modules
docker run --rm --init \
  --publish 127.0.0.1:5173:5173 \
  --volume "$PWD:/app" \
  --volume ecomm-demo-node-modules:/app/node_modules \
  --workdir /app \
  node:22.22.2-alpine3.23@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f \
  sh -c 'npm ci --no-audit --no-fund && npm run dev -- --host 0.0.0.0'
```

Open <http://127.0.0.1:5173>. Recreate the named volume after dependency changes:

```sh
docker volume rm ecomm-demo-node-modules
```

## Checks and production build

The `checks` target performs linting, strict type checking, non-watch tests, and the automated no-payment boundary scan:

```sh
docker build --target checks --tag ecomm-demo-no-payment:checks .
```

Build the final production image, including the checks stage:

```sh
docker build --pull --tag ecomm-demo-no-payment:local .
```

Run a local smoke test:

```sh
docker run --detach --rm \
  --name ecomm-demo-no-payment-smoke \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --publish 127.0.0.1:8080:8080 \
  ecomm-demo-no-payment:local
docker inspect --format '{{.State.Health.Status}}' ecomm-demo-no-payment-smoke
docker exec ecomm-demo-no-payment-smoke wget --quiet --output-document=- http://127.0.0.1:8080/healthz
docker stop ecomm-demo-no-payment-smoke
```

Wait for the inspected health status to become `healthy`; the endpoint body must be `ok`. Then visit `/`, `/cart`, and `/checkout` directly at <http://127.0.0.1:8080>. A missing `/assets/...` file must return 404, while an extensionless unknown route must load the app's not-found view.

## Reproducible browser audit

Run the maintained Playwright audit after customer-facing, routing, or styling changes:

```sh
./scripts/run-browser-audit.sh
```

The script builds the production image and a pinned Playwright 1.61.0 runner, starts the application on an isolated temporary Docker network, and always removes its temporary container and network. It checks the catalogue and keyboard entry point at 1440 px, 390 px, and 320 px, and confirms that adding a product shows a visible confirmation without shifting the catalogue cards or overflowing the viewport; the desktop pass also waits for that confirmation to expire and then exercises the cart and inert checkout journey. Console errors, page errors, failed requests, external requests, unexpected form controls, horizontal overflow, and lost cart state fail the audit.

## Coolify deployment

Create an application from this Git repository and use these settings:

| Coolify field | Value |
| --- | --- |
| Build pack | Dockerfile |
| Base directory | `/` |
| Dockerfile path | `/Dockerfile` |
| Port exposes | `8080` |
| Health check | Enabled |
| Health method and path | `GET /healthz` |
| Health port and expected status | `8080`, HTTP 200 |
| Domain | The customer-facing HTTPS domain routed through Coolify's proxy |
| Port mappings | Empty; do not bind a host port |
| Runtime environment variables/secrets | None |

`EXPOSE 8080` also makes 8080 the image's declared service port. Keeping Coolify's host port mappings empty preserves proxy routing and rolling-update behaviour. The container already runs as the unprivileged nginx user (UID/GID 101), writes transient nginx state only beneath `/tmp`, and supports a read-only root filesystem when `/tmp` is provided as a small writable temporary filesystem.

After deployment, request the configured HTTPS domain and verify:

```text
GET /            -> 200 and the three-product catalogue
GET /healthz     -> 200 with body "ok"
GET /cart        -> 200 and the application shell
GET /checkout    -> 200 and the application shell
GET /assets/missing.js -> 404
```

Also inspect the response headers for the content security policy, frame denial, MIME sniffing protection, referrer policy, permissions policy, and cache policy.

## Updating dependencies and base images

Keep application versions exact in `package.json` and let `package-lock.json` remain authoritative. Before updating a library, inspect its release and migration documentation for the intended version. The `playwright` package version must exactly match the tag and digest in `tests/browser-audit.Dockerfile`. Edit the exact versions, regenerate the lockfile in the pinned Node container, and review the manifest, lockfile, and browser-runner image together:

```sh
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env npm_config_cache=/tmp/npm-cache \
  --volume "$PWD:/app" \
  --workdir /app \
  node:22.22.2-alpine3.23@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f \
  npm install --package-lock-only --ignore-scripts --no-audit --no-fund
docker build --no-cache --target checks --tag ecomm-demo-no-payment:checks .
docker build --no-cache --tag ecomm-demo-no-payment:local .
```

The `FROM` lines pin both a readable tag and an immutable multi-platform digest. To refresh an image, choose a supported release, inspect its registry digest, update the tag and digest together, and rebuild without cache:

```sh
docker buildx imagetools inspect node:22.22.2-alpine3.23
docker buildx imagetools inspect nginxinc/nginx-unprivileged:1.28.2-alpine3.23
docker build --pull --no-cache --target checks --tag ecomm-demo-no-payment:checks .
docker build --pull --no-cache --tag ecomm-demo-no-payment:local .
```

Confirm that the displayed digest is the one recorded in `Dockerfile`, then repeat the read-only smoke test. Never replace the digest with a floating tag, and re-run the payment-boundary scan after every dependency or image update.
