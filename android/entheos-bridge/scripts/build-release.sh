#!/usr/bin/env bash
set -euo pipefail

required=(
  ENTHEOS_UPLOAD_KEYSTORE
  ENTHEOS_UPLOAD_STORE_PASSWORD
  ENTHEOS_UPLOAD_KEY_ALIAS
  ENTHEOS_UPLOAD_KEY_PASSWORD
)

for variable in "${required[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Falta la variable de firma: $variable" >&2
    exit 2
  fi
done

if [[ ! -f "$ENTHEOS_UPLOAD_KEYSTORE" ]]; then
  echo "No existe el almacén indicado en ENTHEOS_UPLOAD_KEYSTORE." >&2
  exit 2
fi

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"

gradle_bin=${GRADLE_BIN:-./gradlew}
"$gradle_bin" --no-daemon clean lintRelease assembleRelease bundleRelease

sdk_root=${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}
if [[ -z "$sdk_root" ]]; then
  echo "Definí ANDROID_SDK_ROOT o ANDROID_HOME para verificar el APK." >&2
  exit 2
fi

apksigner_path=""
for candidate in "$sdk_root"/build-tools/*/apksigner; do
  if [[ -x "$candidate" ]]; then
    apksigner_path="$candidate"
  fi
done

if [[ -z "$apksigner_path" ]]; then
  echo "No se encontró apksigner dentro del Android SDK." >&2
  exit 2
fi

apk="app/build/outputs/apk/release/app-release.apk"
aab="app/build/outputs/bundle/release/app-release.aab"
jarsigner_bin=$(command -v jarsigner || true)
if [[ -z "$jarsigner_bin" && -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/jarsigner" ]]; then
  jarsigner_bin="$JAVA_HOME/bin/jarsigner"
fi
if [[ -z "$jarsigner_bin" ]]; then
  echo "No se encontró jarsigner dentro de Java 17." >&2
  exit 2
fi

"$apksigner_path" verify --verbose --print-certs "$apk"
"$jarsigner_bin" -verify "$aab"
sha256sum "$apk" > "$apk.sha256"
sha256sum "$aab" > "$aab.sha256"

echo "Distribución firmada y verificada:"
echo "  $apk"
echo "  $aab"
