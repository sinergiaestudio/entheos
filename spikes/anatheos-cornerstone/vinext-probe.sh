#!/usr/bin/env bash
set -euo pipefail
# Temporary build-only route. NO deploy, NO server, NO clinical images.
# The route exists only inside an ephemeral GitHub Actions checkout and
# is removed before job exit. Stable ANATHEOS source is not edited.
dir="app/app/anatheos-3d/cornerstone-g2a-spike"
if [[ -e "$dir" ]]; then
  echo "FAIL: temporary spike route already exists" >&2
  exit 2
fi
mkdir -p "$dir"
trap 'rm -rf "$dir"' EXIT

cat > "$dir/client.tsx" <<'TS'
"use client";
import { useEffect, useState } from "react";
export default function CornerstoneG2aClientProbe() {
  const [status, setStatus] = useState("client import not attempted");
  useEffect(() => {
    let alive = true;
    Promise.all([
      import("@cornerstonejs/core"),
      import("@cornerstonejs/dicom-image-loader"),
    ]).then(([core, dicom]) => {
      if (alive) setStatus(
        typeof core.init === "function" && typeof dicom.init === "function"
          ? "client bundle imported"
          : "missing symbols"
      );
    }).catch(() => { if (alive) setStatus("client import rejected"); });
    return () => { alive = false; };
  }, []);
  return <div>ANATHEOS isolated client-bundle probe: {status}</div>;
}
TS

cat > "$dir/page.tsx" <<'TS'
import { notFound } from "next/navigation";
import { env } from "cloudflare:workers";
import { isAnatheosPilotEnabled, isAnatheosOwner } from "@/lib/anatheos/owner-access";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import CornerstoneG2aClientProbe from "./client";

export default async function TemporaryG2aPage() {
  // Route exists ONLY during CI build, not at any deployed Site.
  if (!isAnatheosPilotEnabled(env.ANATHEOS_PILOT_ENABLED)) notFound();
  const user = await requireChatGPTUser("/app/anatheos-3d/cornerstone-g2a-spike");
  if (!isAnatheosOwner(user, env.APP_OWNER_EMAIL)) notFound();
  return <CornerstoneG2aClientProbe />;
}
TS

export ANATHEOS_PILOT_ENABLED=false
echo "Running temporary Vinext/Cloudflare Worker build with Cornerstone client-only import..."
npm run build
echo "PASS: temporary Cornerstone client-only code bundled by Vinext into Worker artifact (NO runtime session or decode tested)."
