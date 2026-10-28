# Descarga opcional de datos originales SPL Knee Atlas exclusivamente a esta PC.
# Sin datos de pacientes, cookies, telemetria ni suscripciones.
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$atlas = Join-Path $root 'ATLAS_SPL'
New-Item -ItemType Directory -Path $atlas -Force | Out-Null
$source='https://raw.githubusercontent.com/lorensen/SPLKneeAtlas/a033300264aec8625a56512be3865c10cdbcb61b'
$files=@(
 @{Name='femur-95.stl';Rel='Models/STL/femur-95.stl';Size=16447884;Hash='f14b53539fe5dba8cc3488f172e651f729e35b9b1f49eb7f695586c61d39b277'},
 @{Name='tibia-96.stl';Rel='Models/STL/tibia-96.stl';Size=13344284;Hash='4b74bcbfb8b344e157253471d97ab07426a72162586d7b5011ae57aeb2acc055'},
 @{Name='SPLKneeAtlasLabels.nrrd';Rel='Atlas/SPLKneeAtlasLabels.nrrd';Size=466136;Hash='3f9e2b8cdf7a969a346445ec570ebb89a2e91ad2f3719e588cf20021a4895d0d'}
)
Write-Host 'Fuente abierta: SPL Knee Atlas / licencia 3D Slicer, Parte B.'
Write-Host 'Descarga exclusivamente desde GitHub del proyecto original; los archivos nunca salen de esta computadora.'
foreach($item in $files) {
 $target=Join-Path $atlas $item.Name
 if(Test-Path -LiteralPath $target -PathType Leaf){
  if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -eq $item.Hash){
    Write-Host "Ya verificado: $($item.Name)" -ForegroundColor Green
    continue
  }
  throw "Archivo existente NO coincide con la fuente original: $target. No se sobrescribe."
 }
 $temp = Join-Path $atlas ($item.Name+'.descarga_temporal')
 if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force}
 try {
  $url=$source+'/'+$item.Rel
  Write-Host "Descargando $($item.Name) ..."
  Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing -MaximumRedirection 5
  $length=(Get-Item -LiteralPath $temp).Length
  if($length -ne $item.Size){throw "Tamaño incompatible ($length; esperado $($item.Size))"}
  $hash=(Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
  if($hash -ne $item.Hash){throw "SHA-256 no coincide con el atlas original"}
  Move-Item -LiteralPath $temp -Destination $target
  Write-Host "Verificado por SHA-256: $($item.Name)" -ForegroundColor Green
 } finally {
   if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force}
 }
}
Write-Host 'Finalizado. Inicia ANATHEOS, selecciona SPL Knee Atlas e importa femur-95.stl y tibia-96.stl desde ATLAS_SPL.'
Write-Host 'Conserva la atribucion y la licencia original del atlas.'
