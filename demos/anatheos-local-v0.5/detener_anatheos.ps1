# Cerrar exclusivamente procesos ANATHEOS iniciados con este servidor_local.ps1.
$ErrorActionPreference = 'Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$target=[IO.Path]::GetFullPath((Join-Path $root 'servidor_local.ps1'))
$pattern=[regex]::Escape($target)
try { $procs=@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'") } catch {
 Write-Host 'No se puede inspeccionar procesos de Windows. Cierra la ventana o usa Ctrl+C.'
 exit 1
}
$found=0
foreach ($p in $procs) {
 if ($p.ProcessId -eq $PID) { continue }
 if ([string]$p.CommandLine -match $pattern -and [string]$p.CommandLine -match '(?i)-File\s+') {
   $found++
   try {
     Stop-Process -Id $p.ProcessId -ErrorAction Stop
     Write-Host "Servidor ANATHEOS detenido (PID $($p.ProcessId))."
   } catch { Write-Host "No se pudo cerrar PID $($p.ProcessId): $_"; exit 1 }
 }
}
if ($found -eq 0){Write-Host 'No se encontraron servidores ANATHEOS de esta carpeta activos.'}
