# ANATHEOS v0.8 B7.1. Prevent regression: Python/Chromium web server
# serves arbitrary files, but Windows PowerShell server uses a strict allowlist.
# All static ES module imports MUST be present there, or entire app fails.
param([string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path))
$ErrorActionPreference='Stop'
$server=Join-Path $Root 'servidor_local.ps1'
if(-not (Test-Path -LiteralPath $server)){throw 'No existe servidor_local.ps1'}
$ps=Get-Content -LiteralPath $server -Raw -Encoding UTF8
$imports=New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
# Check application production modules only, never independent test scripts.
$js=Get-ChildItem -LiteralPath $Root -File | Where-Object {
 ($_.Extension -eq '.js' -or $_.Extension -eq '.mjs') -and
 -not ($_.Name -match '^(test_|browser_)')
}
$missing=New-Object 'System.Collections.Generic.List[string]'
foreach($f in $js){
 $source=Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
 # Handle static import "...", import {...} from "...", dynamic import('...').
 $refs=[regex]::Matches($source,'(?m)(?:\bfrom\s*|\bimport\s*\(?\s*)[''"](\./[^''"]+)[''"]')
 foreach($match in $refs){
  $rel=$match.Groups[1].Value.Substring(2)
  if($rel.Contains('/') -or $rel.Contains('\')){throw "Import JS con subdirectorios requiere revisión: $rel"}
  $null=$imports.Add($rel)
  if(-not (Test-Path -LiteralPath (Join-Path $Root $rel) -PathType Leaf)){
   $missing.Add("Archivo importado NO existe: $rel")
   continue
  }
  $expected="'/$rel'"
  if(-not $ps.Contains($expected)){
   $missing.Add("Modulo NO permitido por el servidor Windows: $rel")
  }
 }
}
$required=@('index.html','app.js','volumetric.js','segmentation.mjs','surface-ui.mjs',
 'workflow-b5.mjs','ux-n1.mjs','ux-clean.mjs','ux-clean.css','ux-n5.mjs','ux-n5.css','mask-to-surface.mjs',
 'continuous-mask-surface.mjs','assisted-segmentation-3d.mjs')
foreach($rel in $required){
 $expected="'/$rel'"
 if(-not $ps.Contains($expected)){$missing.Add("Ruta obligatoria no permitida: $rel")}
 if(-not (Test-Path -LiteralPath (Join-Path $Root $rel) -PathType Leaf)){$missing.Add("Archivo obligatorio ausente: $rel")}
}
if($missing.Count -gt 0){
 foreach($issue in $missing){Write-Host "[FALLO] $issue" -ForegroundColor Red}
 throw 'La app no puede inicializarse en Windows. No distribuir.'
}
Write-Host "[OK] Dependencias JavaScript y rutas permitidas del servidor Windows: $($imports.Count) importaciones, 14 rutas criticas." -ForegroundColor Green
