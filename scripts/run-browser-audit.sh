#!/bin/sh

set -eu

audit_suffix="$$"
audit_network="ecomm-browser-audit-${audit_suffix}"
audit_container="ecomm-browser-app-${audit_suffix}"
audit_runner_container="ecomm-browser-runner-${audit_suffix}"
application_image="ecomm-demo-no-payment:browser-audit-app-${audit_suffix}"
runner_image="ecomm-demo-no-payment:browser-audit-runner-${audit_suffix}"

cleanup() {
  docker rm --force "${audit_runner_container}" >/dev/null 2>&1 || true
  docker rm --force "${audit_container}" >/dev/null 2>&1 || true
  docker network rm "${audit_network}" >/dev/null 2>&1 || true
  docker image rm "${runner_image}" "${application_image}" >/dev/null 2>&1 || true
}

trap cleanup EXIT HUP INT TERM

# Fixed, non-secret values used only for this ephemeral audit container —
# never real credentials. hashAdminPassword('audit-password') via
# server/auth/admin-session.ts.
audit_admin_password="audit-password"
audit_admin_password_hash='scrypt$c664e1e5ffec230a14126bba1201e67e$5f94f53b88dee042c48406e3b522805cbf9f7d0ccad7d3a0ceec9b03a9c5d5f9ef0a67d56ff81b11b1dff45f69c63990742ec746e5070f191c58ac7455252f0a'
audit_jazzcash_origin="https://jazzcash-audit-stub.invalid"

docker build --tag "${application_image}" .
docker build --file tests/browser-audit.Dockerfile --tag "${runner_image}" .
docker network create "${audit_network}" >/dev/null
docker run --detach \
  --name "${audit_container}" \
  --network "${audit_network}" \
  --network-alias storefront \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --tmpfs /data:rw,noexec,nosuid,size=32m,uid=1000,gid=1000 \
  --env ADMIN_PASSWORD_HASH="${audit_admin_password_hash}" \
  --env ADMIN_SESSION_SECRET="audit-session-secret" \
  --env JAZZCASH_BASE_URL="${audit_jazzcash_origin}" \
  --env JAZZCASH_MERCHANT_ID="audit-merchant-id" \
  --env JAZZCASH_PASSWORD="audit-merchant-password" \
  --env JAZZCASH_INTEGRITY_SALT="audit-integrity-salt" \
  --env JAZZCASH_RETURN_URL="https://storefront:8080/checkout/return" \
  "${application_image}" >/dev/null

attempt=1
while [ "${attempt}" -le 30 ]; do
  health_status="$(docker inspect --format '{{.State.Health.Status}}' "${audit_container}")"
  if [ "${health_status}" = "healthy" ]; then
    break
  fi
  if [ "${attempt}" -eq 30 ]; then
    docker logs "${audit_container}"
    echo "Application did not become healthy for the browser audit." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 1
done

docker run --rm \
  --name "${audit_runner_container}" \
  --init \
  --ipc=host \
  --network "${audit_network}" \
  --env BROWSER_AUDIT_BASE_URL=http://storefront:8080 \
  --env BROWSER_AUDIT_ADMIN_PASSWORD="${audit_admin_password}" \
  --env BROWSER_AUDIT_JAZZCASH_ORIGIN="${audit_jazzcash_origin}" \
  "${runner_image}"
