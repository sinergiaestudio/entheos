# Diagnostico sin red ni envio de informacion.
$ErrorActionPreference='Continue'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host 'ANATHEOS 3D v0.5 - Diagnostico local' -ForegroundColor Cyan
Write-Host "Ruta: $root"
Write-Host "PowerShell: $($PSVersionTable.PSVersion)"
Write-Host "Windows: $([Environment]::OSVersion.VersionString)"
$required=@('index.html','style.css','app.js','volumetric.js','segmentation.mjs','surface-core.mjs','surface-renderer.mjs','surface-ui.mjs','spl-provenance.mjs','servidor_local.ps1')
$missing=@()
foreach($file in $required){
 $p=Join-Path $root $file
 if(Test-Path -LiteralPath $p -PathType Leaf){Write-Host "[OK] $file"}
 else{Write-Host "[FALTA] $file" -ForegroundColor Red;$missing+= $file}
}
$atlas=Join-Path $root 'ATLAS_SPL'
$expected=@(
 @{Name='femur-95.stl';Sha='f14b53539fe5dba8cc3488f172e651f729e35b9b1f49eb7f695586c61d39b277'},
 @{Name='tibia-96.stl';Sha='4b74bcbfb8b344e157253471d97ab07426a72162586d7b5011ae57aeb2acc055'},
 @{Name='SPLKneeAtlasLabels.nrrd';Sha='3f9e2b8cdf7a969a346445ec570ebb89a2e91ad2f3719e588cf20021a4895d0d'}
)
foreach($item in $expected){
 $path=Join-Path $atlas $item.Name
 if(-not (Test-Path -LiteralPath $path -PathType Leaf)){Write-Host "[OPCIONAL] Sin atlas: $($item.Name)";continue}
 $actual=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
 if($actual -eq $item.Sha){Write-Host "[SHA256 OK] $($item.Name)" -ForegroundColor Green}
 else{Write-Host "[SHA256 NO COINCIDE] $($item.Name)" -ForegroundColor Red}
}
foreach($port in 8765..8775){
 try{
 $c=New-Object System.Net.Sockets.TcpClient
 $a=$c.BeginConnect('127.0.0.1',[int]$port,$null,$null)
 if($a.AsyncWaitHandle.WaitOne(150,$false) -and $c.Connected){Write-Host "[PUERTO OCUPADO] 127.0.0.1:$port";$c.Close()}
 else{$c.Close()}
 }catch{}
}
if($missing.Count){Write-Host "Faltan $($missing.Count) archivos necesarios. Extrae el ZIP completo." -ForegroundColor Red;exit 1}
Write-Host 'Servidor local disponible sin aplicaciones ni APIs externas. No hay ninguna subida automatica de DICOM.'
