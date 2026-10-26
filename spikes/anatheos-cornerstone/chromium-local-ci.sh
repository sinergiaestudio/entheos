#!/usr/bin/env bash
set -euo pipefail
command -v setsid >/dev/null || { echo "FAIL: setsid required"; exit 69; }
command -v curl >/dev/null || { echo "FAIL: curl required"; exit 69; }
test -x ./node_modules/.bin/vite
export ANATHEOS_PILOT_ENABLED=false
origin=http://127.0.0.1:4174
log="$(mktemp)"
pid=""
cleanup() {
  if [[ -n "$pid" ]]; then
    kill -TERM -- "-$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -f "$log"
}
trap cleanup EXIT
setsid ./node_modules/.bin/vite --config spikes/anatheos-cornerstone/vite.config.mjs \
  --host 127.0.0.1 --port 4174 --strictPort >"$log" 2>&1 &
pid=$!
ready=0
for step in $(seq 1 60); do
  if ! kill -0 "$pid" 2>/dev/null; then break; fi
  if curl -fsS --output /dev/null --max-time 2 "$origin/"; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  echo "FAIL: isolated Cornerstone Vite loopback listener not ready"
  exit 1
fi
node spikes/anatheos-cornerstone/chromium-verify.mjs
