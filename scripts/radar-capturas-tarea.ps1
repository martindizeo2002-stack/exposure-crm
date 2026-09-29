# radar-capturas-tarea.ps1 — tarea de Windows que saca las capturas de historias del Radar todos los días a
# las 18:00 y a las 22:00 (el segundo turno suma solo las historias nuevas). Corre scripts\radar-capturas.py
# sin ventana. Si la compu estaba apagada o dormida a esa hora, corre apenas se prende.
#
#   powershell -ExecutionPolicy Bypass -File scripts\radar-capturas-tarea.ps1 -Login      iniciar sesión en Instagram (una vez)
#   powershell -ExecutionPolicy Bypass -File scripts\radar-capturas-tarea.ps1 -Registrar  registra la tarea
#   powershell -ExecutionPolicy Bypass -File scripts\radar-capturas-tarea.ps1 -Ahora      corre una captura ya
#   powershell -ExecutionPolicy Bypass -File scripts\radar-capturas-tarea.ps1 -Quitar     borra la tarea
param([switch]$Registrar, [switch]$Quitar, [switch]$Ahora, [switch]$Login)

$nombre = "EXPOSURE - Radar capturas"
$raiz = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot "radar-capturas.py"
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { $python = "python" }
$pythonw = Join-Path (Split-Path -Parent $python) "pythonw.exe"
if (-not (Test-Path $pythonw)) { $pythonw = $python }

if ($Login) { & $python $script --login; exit $LASTEXITCODE }
if ($Quitar) { Unregister-ScheduledTask -TaskName $nombre -Confirm:$false -ErrorAction SilentlyContinue; Write-Output "tarea quitada: $nombre"; exit 0 }
if ($Ahora) { & $python $script; exit $LASTEXITCODE }

if ($Registrar) {
  $accion = New-ScheduledTaskAction -Execute $pythonw -Argument "`"$script`"" -WorkingDirectory $raiz
  $d18 = New-ScheduledTaskTrigger -Daily -At "18:00"
  $d22 = New-ScheduledTaskTrigger -Daily -At "22:00"
  $ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 45) -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
  $desc = "Radar de contenido: captura las historias de las cuentas seguidas a las 18 y rechequea a las 22. Log: %LOCALAPPDATA%\exposure-radar\capturas.log"
  Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger @($d18, $d22) -Settings $ajustes -Description $desc -Force | Out-Null
  $i = Get-ScheduledTask -TaskName $nombre | Get-ScheduledTaskInfo
  Write-Output "tarea registrada: $nombre · próxima corrida $($i.NextRunTime)"
  exit 0
}
Write-Output "Usá -Login, -Registrar, -Ahora o -Quitar."
