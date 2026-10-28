# ASCII-only, compatible with Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifest = Join-Path $root 'MANIFIESTO_SHA256_EDICION_COMPLETA.txt'
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
 Write-Host 'ERROR: SHA-256 manifest missing.' -ForegroundColor Red
 exit 1
}
$failed = 0
$count = 0
foreach ($line in [System.IO.File]::ReadAllLines($manifest)) {
 if ($line -notmatch '^([0-9a-fA-F]{64})  (.+)$') { continue }
 $expected = $Matches[1].ToLowerInvariant()
 $relative = $Matches[2].Replace('/', [System.IO.Path]::DirectorySeparatorChar)
 $target = Join-Path $root $relative
 $count++
 if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
  Write-Host "[MISSING] $relative" -ForegroundColor Red
  $failed++
  continue
 }
 $current = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
 if ($current -eq $expected) {Write-Host "[OK] $relative"}
 else {Write-Host "[MISMATCH] $relative" -ForegroundColor Red;$failed++}
}
if ($failed -gt 0 -or $count -lt 20) {
 Write-Host "VERIFICATION FAILED: $failed bad files out of $count." -ForegroundColor Red
 exit 1
}
Write-Host "INTEGRITY VERIFIED: $count files match SHA-256." -ForegroundColor Green
exit 0
