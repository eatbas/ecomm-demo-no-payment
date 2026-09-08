# Common Goods shop

A React shop with three fixed products, a persistent browser cart, real
customer checkout, and card payment via **JazzCash** (hosted page redirection,
`pp_TxnType=MPAY`), with durable orders and a public, read-only admin order view.

## Data and payment policy

This application collects real customer contact and billing details at
checkout (name, email, phone, address) and stores them with each order. It
never collects or stores card numbers, CVVs, or any other card data: JazzCash
hosts the card-entry page itself, and this application only ever redirects
the browser there and later confirms the outcome via JazzCash's Status
Inquiry and IPN APIs.

**`/admin` and its order-list/recheck APIs are public and unauthenticated**,
matching this repository's original demo posture — deliberately, for a
staging environment. They expose real customer names, addresses, and payment
status to anyone who can reach the deployment. Do not point this
configuration at a deployment reachable by anyone other than trusted staging
users; add authentication in front of `/admin` (a platform-level basic-auth
gate, a VPN, or reintroducing an application-level login) before using this
with real customers in production.

Running this in production requires the JazzCash secrets described in
[Coolify deployment](#coolify-deployment) below, and carries the same
data-protection obligations as any checkout that stores real customer
information — retention, access control, and incident handling are the
deploying operator's responsibility.

## Routes and API

| Route | Purpose |
| --- | --- |
| `/` | Three-product catalogue and add-to-cart controls |
| `/cart` | Cart quantities, removal, clearing, and subtotal |
| `/checkout` | Real customer details and JazzCash card payment |
| `/checkout/confirmation` | Polls and displays the order's payment status after returning from JazzCash |
| `/admin` | Public, read-only list of paid orders |
| `/healthz` | Application and database readiness response |
| `POST /api/orders` | Validate and persist an idempotent order, `awaiting_payment` |
| `GET /api/orders/:id/status` | Same-origin, unauthenticated: `{ id, reference, paymentStatus }` only (the order id is an unguessable capability token; no PII is returned) |
| `GET /api/orders/:id/payment/redirect` | Signs and renders the JazzCash hosted-checkout auto-submit form |
| `POST /checkout/return` | JazzCash's redirect callback (undocumented payload — never trusted for payment status, only used to route back to `/checkout/confirmation`) |
| `POST /api/payments/jazzcash/ipn` | JazzCash's server-to-server payment notification |
| `GET /api/admin/orders?limit=50` | Paid orders, newest first |
| `POST /api/admin/payments/:txnRefNo/recheck` | Triggers a JazzCash Status Inquiry reconciliation for one payment |
| Any other client route | Customer-facing not-found view |

The browser submits an idempotency key, real customer details, and product
IDs/quantities. The server validates the product catalogue, calculates
integer-paisa totals (PKR), snapshots item names/prices, generates the
reference and time, and commits the order and items in one SQLite
transaction with `payment_status = 'awaiting_payment'`. The browser is then
navigated (a full-page, same-origin hand-off — never a `fetch`) to the
payment-redirect route, which signs and renders JazzCash's hosted checkout
form. The cart is cleared once the order is durably created, before that
hand-off.

## Architecture

- React, React Router, local shadcn-style components, and Tailwind CSS provide the UI.
- The admin view uses a Material Design-inspired surface hierarchy, elevation,
  status chips, semantic desktop tables, and responsive cards without MUI/Emotion.
- Shared dependency-free TypeScript modules define the catalogue, order, and
  customer contracts.
- Fastify serves the same-origin JSON API, health route, built Vite assets, and SPA
  fallback from one unprivileged Node process.
- Node's built-in SQLite API persists `/data/orders.sqlite`. Versioned migrations,
  prepared statements, foreign keys, strict tables, and idempotency constraints
  protect the order and payment boundary.
- API responses use `Cache-Control: no-store`; hashed Vite assets are immutable.
- The content security policy permits connections only to the same origin.
  The one exception is the JazzCash payment-redirect response
  (`GET /api/orders/:id/payment/redirect`), which carries its own narrowly
  scoped, per-response CSP (`form-action 'self' <jazzcash-origin>` plus a
  single-use script nonce) so every other response keeps the strict default.
  The maintained boundary scanner continues to reject other payment
  providers, payment credentials, analytics, external browser URLs, and
  browser networking outside the one dedicated same-origin API client
  (`src/features/orders/order.api.ts`).

## JazzCash payment integration

Card payment is JazzCash's hosted **Page Redirection v1.1** flow
(`pp_TxnType=MPAY`): `server/payments/jazzcash/` builds and HMAC-SHA256-signs
the request (`hash.ts`, unit-tested against JazzCash's own published worked
examples), and `server/routes/payments.ts` renders the auto-submitting
redirect form. An order is only ever marked `paid` after JazzCash **Status
Inquiry** confirms `pp_PaymentResponseCode = "121"` and `pp_Status =
"Completed"` — never from the redirect callback (its payload is undocumented)
and never from the IPN alone (it carries no amount or currency). A verified
IPN moves a payment to `ambiguous`, pending that confirmation.

Status Inquiry must not be called within 10 minutes of initiating a payment
(JazzCash's own documented minimum wait). There is no background scheduler in
this deployment; `POST /api/admin/payments/:txnRefNo/recheck` is the
documented way to trigger reconciliation for a payment stuck
`awaiting_payment` or `ambiguous`.

Required runtime secrets (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `JAZZCASH_BASE_URL` | JazzCash host origin only (e.g. the sandbox/production host JazzCash gives you) — never a literal in source, only ever read from this variable |
| `JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT` | From the JazzCash portal, Integration > Credentials |
| `JAZZCASH_RETURN_URL` | Pre-registered with JazzCash, byte-identical on every request; path must be exactly `/checkout/return` |

JazzCash prints the **same host for sandbox and production** in every guide
in its documentation — the environment is selected by which credentials you
configure, not by this URL. Confirm the real production posture with
JazzCash in writing before go-live; do not assume a `sandbox.` subdomain
exists. See `plan_request_claude.md`'s Risks section for the full go-live
checklist, including the two items (production endpoint confirmation,
settlement-report access) that require direct action with JazzCash and
cannot be closed from this codebase.

## Docker-only development

Node.js is not required on the host. Copy `.env.example` to `.env` and fill
in the JazzCash and admin secrets above, then from the repository root:

```sh
./start.sh
```

Open <http://127.0.0.1:5173>. The script runs Vite and the Fastify API together in
the pinned Node container. Vite proxies only `/api`, `/checkout/return`, and
`/healthz` to the API. Dependencies and orders use the named volumes
`ecomm-demo-node-modules` and `ecomm-demo-order-data`.

Useful commands:

```sh
./start.sh logs
./start.sh down
./start.sh --foreground
```

Stopping the container retains both volumes. Vite's own environment-file
loading stays disabled, so repository `.env*` files never reach the browser
build; only the API process (`scripts/run-development.mjs`) reads `.env`, to
seed the JazzCash and admin secrets above into its own environment before it
starts — copy `.env.example` to `.env` first, or the API process will fail
fast with a clear "X is required" error.

To reset local orders, stop the development container and remove only its
order-data volume. This permanently deletes those orders:

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
requests, lost state, inaccessible focus, or horizontal overflow fail the
audit. **The audit script itself supplies fixed JazzCash environment values
it needs to build/run the container; it does not exercise
a real JazzCash sandbox transaction** — that remains a manual verification
step against JazzCash's sandbox once real credentials are available.

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
  --env JAZZCASH_BASE_URL='https://onlinepayments.jazzcash.com.pk' \
  --env JAZZCASH_MERCHANT_ID='<merchant id>' \
  --env JAZZCASH_PASSWORD='<merchant password>' \
  --env JAZZCASH_INTEGRITY_SALT='<integrity salt>' \
  --env JAZZCASH_RETURN_URL='https://127.0.0.1:8080/checkout/return' \
  ecomm-demo-no-payment:local
```

Wait for `healthy`, then verify readiness and create a deterministic order:

```sh
docker inspect --format '{{.State.Health.Status}}' ecomm-demo-no-payment-smoke
curl --fail http://127.0.0.1:8080/healthz
curl --fail \
  --header 'Content-Type: application/json' \
  --data '{"idempotencyKey":"123e4567-e89b-42d3-a456-426614174000","customer":{"fullName":"Zara Khan","email":"zara@example.test","phone":"+92 300 1234567","addressLine1":"12 Model Town","city":"Lahore","postcode":"54700","country":"Pakistan"},"lines":[{"productId":"everyday-backpack","quantity":1}]}' \
  http://127.0.0.1:8080/api/orders
```

The created order returns `paymentStatus: "awaiting_payment"` and does not
appear in `GET /api/admin/orders` (which lists only `paid` orders) until a
JazzCash payment against it is confirmed.

Stop the container, start a replacement with the same volume and command, then
confirm the order's `GET /api/orders/<id>/status` still returns the same result.

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
| Runtime environment variables/secrets | `JAZZCASH_BASE_URL`, `JAZZCASH_MERCHANT_ID`, `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT`, `JAZZCASH_RETURN_URL` — all required, see [JazzCash payment integration](#jazzcash-payment-integration) |
| Host port mappings | Empty; use the Coolify proxy |

The container runs as the unprivileged `node` user. It supports a read-only root
filesystem when `/tmp` is supplied as a small writable tmpfs and `/data` is a
persistent writable volume. Back up the SQLite database using a SQLite-aware backup
method before platform maintenance; copying a live database without its WAL state is
not a reliable backup.

After deployment, verify the configured HTTPS domain and all routes in the table
above. `JAZZCASH_RETURN_URL` must resolve to that exact domain with the path
`/checkout/return`, and must be registered with JazzCash before the first
transaction. Create one order, pay it via JazzCash, replace/redeploy the
container, and confirm `/admin` still lists it as paid. A missing or
incorrectly owned `/data` mount must be treated as a deployment failure, not
silently replaced with ephemeral storage.

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
