# Common Goods demo shop

A React demonstration shop with three fixed products, a persistent browser cart,
a synthetic checkout flow, durable demo orders, and a public read-only admin view.
No payment provider is installed and no payment is collected.

## Public-demo data policy

This application intentionally has no accounts or credentials. `/admin` and its
order-list API are public. Checkout therefore accepts only the built-in fictional
demo profile; it does not accept arbitrary personal, billing, or card data. Every
saved order is labelled `completed` with payment status `not_configured`.

Do not adapt this credential-free design to real customer data. Authentication,
authorisation, retention controls, and a production database would be prerequisites.

## Routes and API

| Route | Purpose |
| --- | --- |
| `/` | Three-product catalogue and add-to-cart controls |
| `/cart` | Cart quantities, removal, clearing, and subtotal |
| `/checkout` | Synthetic demo-profile fill and order completion |
| `/admin` | Public, read-only completed-order list |
| `/healthz` | Application and database readiness response |
| `POST /api/orders` | Validate and persist an idempotent demo order |
| `GET /api/admin/orders?limit=50` | Return completed orders newest first |
| Any other client route | Customer-facing not-found view |

The browser submits only an idempotency key, the fixed demo-customer identifier,
and product IDs/quantities. The server validates the product catalogue, calculates
integer-cent totals, snapshots item names/prices, generates the reference and time,
and commits the order and items in one SQLite transaction. The cart is cleared only
after the browser validates the successful server response.

## Architecture

- React, React Router, local shadcn-style components, and Tailwind CSS provide the UI.
- The admin view uses a Material Design-inspired surface hierarchy, elevation,
  status chips, semantic desktop tables, and responsive cards without MUI/Emotion.
- Shared dependency-free TypeScript modules define the catalogue and order contract.
- Fastify serves the same-origin JSON API, health route, built Vite assets, and SPA
  fallback from one unprivileged Node process.
- Node's built-in SQLite API persists `/data/orders.sqlite`. Versioned migrations,
  prepared statements, foreign keys, strict tables, and idempotency constraints
  protect the demo order boundary.
- API responses use `Cache-Control: no-store`; hashed Vite assets are immutable.
- The content security policy permits connections only to the same origin. The
  maintained boundary scanner continues to reject payment providers, payment
  credentials, analytics, external browser URLs, and browser networking outside
  the dedicated order client.

## Docker-only development

Node.js is not required on the host. From the repository root:

```sh
./start.sh
```

Open <http://127.0.0.1:5173>. The script runs Vite and the Fastify API together in
the pinned Node container. Vite proxies only `/api` and `/healthz` to the API.
Dependencies and demo orders use the named volumes
`ecomm-demo-node-modules` and `ecomm-demo-order-data`.

Useful commands:

```sh
./start.sh logs
./start.sh down
./start.sh --foreground
```

Stopping the container retains both volumes. Vite environment-file loading is
disabled, so repository `.env*` files are not consumed. The runner supplies only
non-secret host, port, and database-path settings; no runtime secret is required.

To reset local demo orders, stop the development container and remove only its
order-data volume. This permanently deletes those demo orders:

```sh
./start.sh down
docker volume rm ecomm-demo-order-data
```

## Checks and production build

The checks target installs from the authoritative lockfile and runs linting, strict
type checking, tests, and the payment-boundary scanner:

```sh
docker build --target checks --tag ecomm-demo-no-payment:checks .
```

Build the production image, including that checks stage:

```sh
docker build --pull --tag ecomm-demo-no-payment:local .
```

Run the maintained browser audit after routing, checkout, API, or styling changes:

```sh
./scripts/run-browser-audit.sh
```

It builds the production application and a pinned Playwright runner, uses an
ephemeral writable `/data`, verifies the empty admin view, and independently
exercises the customer-to-admin order journey at desktop, mobile, and 320 px
widths. Responsive table/card visibility, console errors, failed or external
requests, lost state, inaccessible focus, or horizontal overflow fail the audit.

## Reproducible persistence smoke test

Create a dedicated test volume and start the production image with a read-only root:

```sh
docker volume create ecomm-demo-orders-smoke
docker run --detach --rm \
  --name ecomm-demo-no-payment-smoke \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --volume ecomm-demo-orders-smoke:/data \
  --publish 127.0.0.1:8080:8080 \
  ecomm-demo-no-payment:local
```

Wait for `healthy`, then verify readiness and create a deterministic demo order:

```sh
docker inspect --format '{{.State.Health.Status}}' ecomm-demo-no-payment-smoke
curl --fail http://127.0.0.1:8080/healthz
curl --fail \
  --header 'Content-Type: application/json' \
  --data '{"idempotencyKey":"123e4567-e89b-42d3-a456-426614174000","demoCustomerId":"demo-customer","lines":[{"productId":"everyday-backpack","quantity":1}]}' \
  http://127.0.0.1:8080/api/orders
curl --fail http://127.0.0.1:8080/api/admin/orders?limit=50
```

Stop the container, start a replacement with the same volume and command, then
confirm the admin API still returns the same order:

```sh
docker stop ecomm-demo-no-payment-smoke
```

Also verify direct visits to `/`, `/cart`, `/checkout`, and `/admin`; a missing
`/assets/...` file must return 404, while an extensionless unknown route must load
the app's not-found view. Inspect responses for CSP, frame denial, MIME sniffing
protection, referrer policy, permissions policy, and the expected cache policy.

Remove the smoke volume only when its demo data is no longer needed:

```sh
docker volume rm ecomm-demo-orders-smoke
```

## Coolify deployment

Create an application from this repository with these settings:

| Coolify field | Value |
| --- | --- |
| Build pack | Dockerfile |
| Base directory | `/` |
| Dockerfile path | `/Dockerfile` |
| Port exposes | `8080` |
| Health method and path | `GET /healthz` |
| Health port and expected status | `8080`, HTTP 200 |
| Persistent storage | Named volume mounted at `/data` |
| Runtime environment variables/secrets | None required |
| Host port mappings | Empty; use the Coolify proxy |

The container runs as the unprivileged `node` user. It supports a read-only root
filesystem when `/tmp` is supplied as a small writable tmpfs and `/data` is a
persistent writable volume. Back up the SQLite database using a SQLite-aware backup
method before platform maintenance; copying a live database without its WAL state is
not a reliable backup.

After deployment, verify the configured HTTPS domain and all routes in the table
above. Create one demo order, replace/redeploy the container, and confirm `/admin`
still lists it. A missing or incorrectly owned `/data` mount must be treated as a
deployment failure, not silently replaced with ephemeral storage.

## Dependency and base-image updates

Keep every direct dependency exact in `package.json`; `package-lock.json` remains
authoritative. Resolve library documentation for the intended exact version before
updating. Regenerate the lockfile in the pinned Node image:

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

The Node `FROM` lines pin both a readable tag and an immutable digest. Refresh the
tag and digest together, rebuild without cache, rerun the browser audit and
persistence smoke test, and verify the built-in SQLite APIs against the new exact
Node release. Keep Playwright's package version aligned with
`tests/browser-audit.Dockerfile`.
