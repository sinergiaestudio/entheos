# ANATHEOS local-only static server, PowerShell 5.1+; binds IPv4 loopback.
# No external network/telemetry. Stop with Ctrl+C or close window.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = @{
 '/' = 'index.html'
 '/index.html' = 'index.html'
 '/app.js' = 'app.js'
 '/volumetric.js' = 'volumetric.js'
 '/segmentation.mjs' = 'segmentation.mjs'
 '/surface-core.mjs' = 'surface-core.mjs'
 '/surface-renderer.mjs' = 'surface-renderer.mjs'
 '/surface-ui.mjs' = 'surface-ui.mjs'
 '/spl-provenance.mjs' = 'spl-provenance.mjs'
 '/workflow-b5.mjs' = 'workflow-b5.mjs'
 '/ux-n1.mjs' = 'ux-n1.mjs'
 '/mask-to-surface.mjs' = 'mask-to-surface.mjs'
 '/assisted-segmentation-3d.mjs' = 'assisted-segmentation-3d.mjs'
 '/ux-shell.css' = 'ux-shell.css'
 '/style.css' = 'style.css'
 '/datasets/RTKN0668_MR_DESS.zip' = 'datasets\RTKN0668_MR_DESS.zip'
}
$atlasFiles = @{
 '/atlas/femur-95.stl' = @{Name='femur-95.stl';Hash='f14b53539fe5dba8cc3488f172e651f729e35b9b1f49eb7f695586c61d39b277';Size=16447884}
 '/atlas/tibia-96.stl' = @{Name='tibia-96.stl';Hash='4b74bcbfb8b344e157253471d97ab07426a72162586d7b5011ae57aeb2acc055';Size=13344284}
}
$atlasLabel=@{Name='SPLKneeAtlasLabels.nrrd';Hash='3f9e2b8cdf7a969a346445ec570ebb89a2e91ad2f3719e588cf20021a4895d0d';Size=466136}
function TestAtlasAsset($item) {
 $p=Join-Path (Join-Path $root 'ATLAS_SPL') $item.Name
 if(-not (Test-Path -LiteralPath $p -PathType Leaf)){return $false}
 if((Get-Item -LiteralPath $p).Length -ne $item.Size){return $false}
 return ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() -eq $item.Hash)
}
function GetAtlasReady {
 foreach($item in $atlasFiles.Values){if(-not (TestAtlasAsset $item)){return $false}}
 return (TestAtlasAsset $atlasLabel)
}
$mime = @{ '.stl'='application/octet-stream'; '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.zip'='application/zip' }
$listener = $null
$port = $null
foreach ($tryPort in 8765..8775) {
 try {
  $candidate = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, [int]$tryPort)
  $candidate.Start()
  $listener = $candidate
  $port = $tryPort
  break
 } catch {
  if ($candidate) { try { $candidate.Stop() } catch {} }
 }
}
if (-not $listener) { Write-Error 'No se pudo abrir un puerto local entre 8765 y 8775.'; exit 1 }
$address = "http://127.0.0.1:$port/"
Write-Host 'ANATHEOS 3D - v0.6 B5.2 Atlas Local' -ForegroundColor Red
Write-Host 'Servidor limitado a tu computadora (127.0.0.1).'
Write-Host "Abrir: $address" -ForegroundColor White
Write-Host 'Para detener: Ctrl+C o cerrar esta ventana.'
try { Start-Process $address } catch { Write-Host "Abrí manualmente $address" }
try {
 while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
   $client.ReceiveTimeout=8000; $client.SendTimeout=30000
   $stream=$client.GetStream()
   $reader=New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
   $line=$reader.ReadLine()
   if (-not $line) { continue }
   $parts=$line.Split(' ')
   $method=$parts[0]
   $path=($parts[1] -split '\?')[0]
   $headersRead=0; $requestHeaders=@{}
   do {
     $h=$reader.ReadLine(); $headersRead++
     if($h -and $h.Contains(':')){
       $kv=$h.Split(':',2)
       $requestHeaders[$kv[0].ToLowerInvariant()]=$kv[1].Trim()
     }
   } while ($null -ne $h -and $h -ne '' -and $headersRead -lt 60)
   $status='200 OK'; $bytes=$null; $type='text/plain; charset=utf-8'
   $origin=[string]$requestHeaders['origin']
   $httpHostHeader=[string]$requestHeaders['host']
   if($httpHostHeader -ne "127.0.0.1:$port"){
     $status='403 Forbidden'
     $bytes=[System.Text.Encoding]::UTF8.GetBytes('Invalid localhost host')
   } elseif($path -eq '/api/spl/status' -and ($method -eq 'GET' -or $method -eq 'HEAD')){
     $type='application/json; charset=utf-8'
     $json=@{ready=[bool](GetAtlasReady);source='SPL Knee Atlas';clinical=$false}|ConvertTo-Json -Compress
     $bytes=[System.Text.Encoding]::UTF8.GetBytes($json)
   } elseif($path -eq '/api/spl/prepare' -and $method -eq 'POST'){
     $type='application/json; charset=utf-8'
     $allowed=($origin -eq "http://127.0.0.1:$port" -and [string]$requestHeaders['content-type'] -match '^application/json(?:;|$)' -and [string]$requestHeaders['content-length'] -match '^[0-9]{1,2}$' -and [int]$requestHeaders['content-length'] -le 32)
     if(-not $allowed){
       $status='403 Forbidden'
       $bytes=[System.Text.Encoding]::UTF8.GetBytes('{"ok":false,"message":"Solicitud local no autorizada"}')
     } else {
       try {
         if(-not (GetAtlasReady)){& (Join-Path $root 'obtener_atlas_spl.ps1') | Out-Null}
         if(-not (GetAtlasReady)){throw 'Atlas incompleto o no verificado por SHA-256'}
         $bytes=[System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"ready":true}')
       } catch {
         $status='503 Service Unavailable'
         $json=@{ok=$false;message='No se pudo preparar el atlas. Revisa la conexion inicial y archivos locales.'}|ConvertTo-Json -Compress
         $bytes=[System.Text.Encoding]::UTF8.GetBytes($json)
         Write-Host "Error SPL: $($_.Exception.Message)"
       }
     }
   } elseif($atlasFiles.ContainsKey($path) -and ($method -eq 'GET' -or $method -eq 'HEAD')){
     $item=$atlasFiles[$path]
     if(-not (TestAtlasAsset $item)){
       $status='404 Not Found'
       $bytes=[System.Text.Encoding]::UTF8.GetBytes('Atlas file missing or invalid')
     } else {
       $type='application/octet-stream'
       $bytes=[System.IO.File]::ReadAllBytes((Join-Path (Join-Path $root 'ATLAS_SPL') $item.Name))
     }
   } elseif(($method -ne 'GET' -and $method -ne 'HEAD') -or (-not $files.ContainsKey($path))){
     $status='404 Not Found';$bytes=[System.Text.Encoding]::UTF8.GetBytes('Not Found')
   } else {
     $file=Join-Path $root $files[$path]
     if(-not (Test-Path -LiteralPath $file -PathType Leaf)){$status='404 Not Found';$bytes=[System.Text.Encoding]::UTF8.GetBytes('Not Found')}
     else{$bytes=[System.IO.File]::ReadAllBytes($file);$type=$mime[[System.IO.Path]::GetExtension($file).ToLowerInvariant()]}
   }
   $security="X-Content-Type-Options: nosniff`r`nCache-Control: no-store`r`nReferrer-Policy: no-referrer`r`nContent-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; object-src 'none'`r`n"
   $head="HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n$security`r`n"
   $headBytes=[System.Text.Encoding]::ASCII.GetBytes($head)
   $stream.Write($headBytes,0,$headBytes.Length)
   if ($method -ne 'HEAD') { $stream.Write($bytes,0,$bytes.Length) }
   $stream.Flush()
  } catch { Write-Host 'Solicitud local interrumpida.' }
  finally { $client.Close() }
 }
} finally { $listener.Stop() }
