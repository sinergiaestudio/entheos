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
 '/style.css' = 'style.css'
 '/datasets/RTKN0668_MR_DESS.zip' = 'datasets\RTKN0668_MR_DESS.zip'
}
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.zip'='application/zip' }
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
Write-Host 'ANATHEOS 3D - Demo Local v0.4' -ForegroundColor Red
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
   $headersRead=0
   do { $h=$reader.ReadLine(); $headersRead++ } while ($null -ne $h -and $h -ne '' -and $headersRead -lt 60)
   $status='200 OK'; $bytes=$null; $type='text/plain; charset=utf-8'
   if (($method -ne 'GET' -and $method -ne 'HEAD') -or (-not $files.ContainsKey($path))) {
     $status='404 Not Found';$bytes=[System.Text.Encoding]::UTF8.GetBytes('Not Found')
   } else {
     $file=Join-Path $root $files[$path]
     if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { $status='404 Not Found'; $bytes=[System.Text.Encoding]::UTF8.GetBytes('Not Found') }
     else { $bytes=[System.IO.File]::ReadAllBytes($file);$type=$mime[[System.IO.Path]::GetExtension($file).ToLowerInvariant()] }
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
