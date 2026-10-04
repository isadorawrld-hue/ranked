$ErrorActionPreference = 'Stop'
$Server = '__SERVER__'
$Token = '__TOKEN__'
$Mode = '__MODE__'
$Dir = Join-Path $env:LOCALAPPDATA 'Ranked'
$Agent = Join-Path $Dir 'agent.ps1'
$Startup = [Environment]::GetFolderPath('Startup')
$Lnk = Join-Path $Startup 'RANKED agent.lnk'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Stop-RkAgent {
  try {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*\Ranked\agent.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch {}
}

Write-Host ''
Write-Host '  R A N K E D' -ForegroundColor Cyan
Write-Host ''
if ($Mode -eq 'uninstall') {
  Stop-RkAgent
  Remove-Item -Force -ErrorAction SilentlyContinue $Lnk
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $Dir
  Write-Host '  Agent supprime. Plus rien ne tourne.' -ForegroundColor Green
  return
}

Write-Host '  1/3 Verification de ton code...' -ForegroundColor Gray
try {
  $r = Invoke-RestMethod -Uri "$Server/api/agent-config" -Method Post -ContentType 'application/json' -Body (@{ token = $Token } | ConvertTo-Json -Compress) -TimeoutSec 20
} catch {
  Write-Host "  Impossible de joindre la ligue : $($_.Exception.Message)" -ForegroundColor Red
  Write-Host '  Verifie ta connexion puis relance ce fichier.' -ForegroundColor Red
  return
}

Write-Host '  2/3 Installation...' -ForegroundColor Gray
Stop-RkAgent
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$code = @'
__AGENT__
'@
$code = $code.Replace('__SERVER__', $Server).Replace('__TOKEN__', $Token)
[IO.File]::WriteAllText($Agent, $code, (New-Object System.Text.UTF8Encoding($true)))
$psExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$argsLine = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Agent`""
$sh = New-Object -ComObject WScript.Shell
$l = $sh.CreateShortcut($Lnk)
$l.TargetPath = $psExe
$l.Arguments = $argsLine
$l.WindowStyle = 7
$l.Description = 'RANKED agent'
$l.Save()

Write-Host '  3/3 Demarrage...' -ForegroundColor Gray
Start-Process -FilePath $psExe -ArgumentList $argsLine -WindowStyle Hidden
Start-Sleep -Seconds 6
$running = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*\Ranked\agent.ps1*' }).Count -gt 0
if ($running) {
  Write-Host ''
  Write-Host '  C est bon. L agent tourne et se relance a chaque demarrage.' -ForegroundColor Green
  Write-Host '  Tes titres de fenetres restent sur ce PC, seules tes minutes partent.' -ForegroundColor Green
} else {
  Write-Host '  L agent ne s est pas lance. Regarde le fichier :' -ForegroundColor Yellow
  Write-Host "  $Dir\agent.log" -ForegroundColor Yellow
}
