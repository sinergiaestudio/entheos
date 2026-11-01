param([int]$Port=0,[switch]$NoBrowser)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'web'))
$manifest=Get-Content -LiteralPath (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
foreach($entry in $manifest.PSObject.Properties){
  $path=[IO.Path]::GetFullPath((Join-Path $root $entry.Name))
  if(-not $path.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Manifest path rejected'}
  if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value){throw 'Prototype integrity failed; restore the complete private ZIP'}
}
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port)
$listener.Start();$actual=$listener.LocalEndpoint.Port
Write-Output "ANATHEOS_SURVEY_URL=http://127.0.0.1:$actual/"
if(-not $NoBrowser){Start-Process "http://127.0.0.1:$actual/"}
Write-Output 'SURVEY L0 private prototype. Close this window to stop. Existing installation unchanged.'
try{
 while($true){
  $client=$listener.AcceptTcpClient()
  try{
   $stream=$client.GetStream();$stream.ReadTimeout=4000;$stream.WriteTimeout=10000
   $bytes=[Collections.Generic.List[byte]]::new()
   while($bytes.Count -lt 16384){$v=$stream.ReadByte();if($v -lt 0){break};$bytes.Add([byte]$v);$n=$bytes.Count;if($n -ge 4 -and $bytes[$n-4] -eq 13 -and $bytes[$n-3] -eq 10 -and $bytes[$n-2] -eq 13 -and $bytes[$n-1] -eq 10){break}}
   $request=[Text.Encoding]::ASCII.GetString($bytes.ToArray());$lines=$request -split "`r`n";$parts=$lines[0] -split ' '
   $status='200 OK';$mime='application/octet-stream';$body=[byte[]]@()
   $hostMatch=[regex]::Match($request,'(?im)^Host: ([^\r\n]+)');$site=[regex]::Match($request,'(?im)^Sec-Fetch-Site: ([^\r\n]+)')
   if($parts.Length -ne 3 -or $hostMatch.Groups[1].Value -ne "127.0.0.1:$actual" -or ($site.Success -and $site.Groups[1].Value -eq 'cross-site')){$status='403 Forbidden'}
   elseif($parts[0] -notin @('GET','HEAD')){$status='405 Method Not Allowed'}
   else{
    $relative=[Uri]::UnescapeDataString(($parts[1] -split '\?')[0]).TrimStart('/')
    if($relative -eq ''){$relative='index.html'}
    if($relative -eq 'api/cmr/capabilities'){$mime='application/json';$body=[Text.Encoding]::UTF8.GetBytes('{"local_only":true,"original_zip":false,"survey_prototype":true}')}
    elseif($manifest.PSObject.Properties.Name -notcontains $relative){$status='404 Not Found'}
    else{
     $path=[IO.Path]::GetFullPath((Join-Path $root $relative))
     if(-not $path.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){$status='403 Forbidden'}
     else{$body=[IO.File]::ReadAllBytes($path);$ext=[IO.Path]::GetExtension($path);$mime=switch($ext){'.html' {'text/html; charset=utf-8'} '.mjs' {'text/javascript; charset=utf-8'} '.js' {'text/javascript; charset=utf-8'} '.css' {'text/css; charset=utf-8'} '.json' {'application/json; charset=utf-8'} default {'application/octet-stream'}}}
    }
   }
   $header="HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nReferrer-Policy: no-referrer`r`nCross-Origin-Resource-Policy: same-origin`r`nContent-Security-Policy: default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'`r`n`r`n"
   $h=[Text.Encoding]::ASCII.GetBytes($header);$stream.Write($h,0,$h.Length)
   if($parts[0] -ne 'HEAD' -and $body.Length){$stream.Write($body,0,$body.Length)}
  }catch{Write-Verbose 'Local request rejected or disconnected'}finally{$client.Close()}
 }
}finally{$listener.Stop()}
