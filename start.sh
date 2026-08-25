#!/usr/bin/env bash
#
# start.sh — run the Vite development server in the pinned Node container.
#
# This static storefront has no backend, database, payment provider, or
# runtime secrets. Vite would embed any VITE_* values in the public bundle,
# so this script does not create or load a .env file.
#
# Usage:
#   ./start.sh              start in the background and wait until ready
#   ./start.sh up           same as the default
#   ./start.sh --foreground start attached (Ctrl-C stops the container)
#   ./start.sh logs         follow container logs
#   ./start.sh down         stop and remove the development container
#   ./start.sh help         show this help text

set -euo pipefail

readonly SCRIPT_NAME=${0##*/}
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR

readonly CONTAINER_NAME=ecomm-demo-no-payment-dev
readonly VOLUME_NAME=ecomm-demo-node-modules
readonly HOST_BIND=127.0.0.1
readonly HOST_PORT=5173
readonly READY_URL="http://${HOST_BIND}:${HOST_PORT}/healthz"
readonly READY_TIMEOUT_SECONDS=120
# Keep this image pin identical to Dockerfile and README.
readonly NODE_IMAGE=node:22.22.2-alpine3.23@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f

DOCKER=()

die() {
  printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2
  exit 1
}

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \?//'
}

resolve_docker() {
  if docker info >/dev/null 2>&1; then
    DOCKER=(docker)
    return 0
  fi

  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
    return 0
  fi

  die "cannot reach the Docker daemon. Install Docker and add this user to the docker group."
}

container_running() {
  "${DOCKER[@]}" inspect --format '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null | grep -qx true
}

container_exists() {
  "${DOCKER[@]}" inspect --format '{{.Id}}' "$CONTAINER_NAME" >/dev/null 2>&1
}

explain_env_policy() {
  if [[ -e $SCRIPT_DIR/.env || -e $SCRIPT_DIR/.env.local ]]; then
    printf '%s: a local .env file exists, but this application does not read it. Vite may still load VITE_* keys into the client bundle; remove those files if they were added by mistake.\n' "$SCRIPT_NAME" >&2
    return
  fi

  printf 'No .env file is used: the storefront has no runtime configuration or secrets.\n'
}

ensure_volume() {
  "${DOCKER[@]}" volume create "$VOLUME_NAME" >/dev/null
}

remove_stale_container() {
  if container_exists && ! container_running; then
    "${DOCKER[@]}" rm --force "$CONTAINER_NAME" >/dev/null
  fi
}

run_dev_container() {
  local detach=$1
  local -a run_args=(
    --name "$CONTAINER_NAME"
    --init
    --publish "${HOST_BIND}:${HOST_PORT}:5173"
    --volume "${SCRIPT_DIR}:/app"
    --volume "${VOLUME_NAME}:/app/node_modules"
    --workdir /app
  )

  if [[ $detach == true ]]; then
    run_args+=(--detach)
  else
    run_args+=(--rm)
    if [[ -t 0 && -t 1 ]]; then
      run_args+=(--interactive --tty)
    fi
  fi

  "${DOCKER[@]}" run "${run_args[@]}" "$NODE_IMAGE" \
    sh -c 'npm ci --no-audit --no-fund && npm run dev -- --host 0.0.0.0 --strictPort'
}

probe_ready() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "$READY_URL" >/dev/null 2>&1
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O /dev/null "$READY_URL"
  else
    die "curl or wget is required to wait for the development server"
  fi
}

wait_until_ready() {
  local deadline=$((SECONDS + READY_TIMEOUT_SECONDS))

  printf 'Waiting for %s ' "$READY_URL"
  while ((SECONDS < deadline)); do
    if probe_ready; then
      printf ' ready\n'
      return 0
    fi

    if ! container_running; then
      printf '\n'
      "${DOCKER[@]}" logs "$CONTAINER_NAME" >&2 || true
      die "development container exited before becoming ready"
    fi

    printf '.'
    sleep 1
  done

  printf '\n'
  "${DOCKER[@]}" logs --tail 80 "$CONTAINER_NAME" >&2 || true
  die "development server did not become ready within ${READY_TIMEOUT_SECONDS}s"
}

print_endpoints() {
  cat <<EOF

Development server: ${READY_URL%/healthz}
Health probe:       ${READY_URL}
Catalogue:          http://${HOST_BIND}:${HOST_PORT}/
Cart:               http://${HOST_BIND}:${HOST_PORT}/cart
Checkout:           http://${HOST_BIND}:${HOST_PORT}/checkout

Follow logs with: ./start.sh logs
Stop with:        ./start.sh down
EOF
}

cmd_up() {
  if container_running; then
    printf 'Already running as %s.\n' "$CONTAINER_NAME"
    print_endpoints
    return 0
  fi

  remove_stale_container
  ensure_volume
  explain_env_policy
  printf 'Starting %s from %s\n' "$CONTAINER_NAME" "$SCRIPT_DIR"
  run_dev_container true >/dev/null
  wait_until_ready
  print_endpoints
}

cmd_foreground() {
  if container_running; then
    die "container ${CONTAINER_NAME} is already running. Use ./start.sh logs or ./start.sh down first."
  fi

  remove_stale_container
  ensure_volume
  explain_env_policy
  printf 'Starting %s in the foreground. Open http://%s:%s\n' \
    "$CONTAINER_NAME" "$HOST_BIND" "$HOST_PORT"
  run_dev_container false
}

cmd_logs() {
  container_exists || die "container ${CONTAINER_NAME} is not running. Start it with ./start.sh"
  "${DOCKER[@]}" logs --follow --tail 200 "$CONTAINER_NAME"
}

cmd_down() {
  if ! container_exists; then
    printf 'Nothing to stop.\n'
    return 0
  fi

  "${DOCKER[@]}" rm --force "$CONTAINER_NAME" >/dev/null
  printf 'Stopped %s. Named volume %s was kept.\n' "$CONTAINER_NAME" "$VOLUME_NAME"
}

main() {
  local command=${1:-up}

  case $command in
    help | -h | --help)
      usage
      return 0
      ;;
  esac

  cd -- "$SCRIPT_DIR"
  resolve_docker

  case $command in
    up | start | '')
      cmd_up
      ;;
    --foreground | foreground | -f)
      cmd_foreground
      ;;
    logs)
      cmd_logs
      ;;
    down | stop)
      cmd_down
      ;;
    *)
      die "unknown command '${command}' (expected: up, --foreground, logs, down, help)"
      ;;
  esac
}

main "$@"
