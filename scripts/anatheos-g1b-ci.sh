#!/usr/bin/env bash
set -euo pipefail
# G1B: local-only HTTP exercise of the real Vite/Vinext/Worker application.
# Run in ephemeral CI checkout, NEVER on production or with clinical data.
command -v setsid >/dev/null || { echo "FAIL: setsid required for safe cleanup"; exit 69; }
command -v curl >/dev/null || { echo "FAIL: curl required"; exit 69; }
[[ -x ./node_modules/.bin/vite ]] || { echo "FAIL: run npm ci first"; exit 69; }

export ANATHEOS_PILOT_ENABLED=false
export APP_OWNER_EMAIL=owner@example.invalid
export SITES_RUNTIME_ROOT="$PWD/.sites-runtime/anatheos-g1b-ci"
origin="http://127.0.0.1:4173"
logfile="$(mktemp)"
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill -TERM -- "-$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f "$logfile"
}
trap cleanup EXIT

setsid bash scripts/sites-env.sh -- ./node_modules/.bin/vite \
  --host 127.0.0.1 --port 4173 --strictPort >"$logfile" 2>&1 &
server_pid=$!

ready=0
for attempt in $(seq 1 60); do
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  if curl --silent --output /dev/null --max-time 2 \
    "$origin/app/anatheos-3d" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != "1" ]]; then
  echo "FAIL: isolated Vinext Worker did not accept loopback HTTP before deadline"
  # Logs not emitted: they could contain environment-specific paths/data.
  exit 1
fi
node scripts/anatheos-g1b-http-matrix.mjs "$origin"
