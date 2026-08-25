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
  "${runner_image}"
