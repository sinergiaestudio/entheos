#!/usr/bin/env bash
set -euo pipefail
mkdir -p app/anatheos-ci-preview
cat > app/anatheos-ci-preview/page.tsx <<'TSX'
import { AnatheosSiteDemoClient } from "@/components/anatheos/site-demo-client";
export default function PreviewCheck() { return <AnatheosSiteDemoClient/>; }
TSX
export ANATHEOS_PILOT_ENABLED=false
export APP_OWNER_EMAIL=synthetic@example.invalid
export SITES_RUNTIME_ROOT="$PWD/.sites-runtime/anatheos-preview-ci"
npm run build
bash scripts/sites-env.sh -- ./node_modules/.bin/vite --host 127.0.0.1 --port 4178 --strictPort &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
ready=0
for i in $(seq 1 45); do
  if curl -s --output /dev/null --max-time 2 http://127.0.0.1:4178/anatheos-ci-preview; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  echo "FAIL: loopback route unavailable"
  exit 1
fi
node scripts/anatheos-sites-preview-chromium.mjs
