# RANKED agent v2
# Compte tes minutes actives par categorie (Claude, CRM, trading, boulot, scroll).
# Les titres de fenetres restent sur ton PC : seuls des totaux de minutes partent vers la ligue.
$ErrorActionPreference = 'Continue'
$Server = '__SERVER__'
$Token = '__TOKEN__'
$AgentVersion = '2.0.0'
$Dir = if ($env:RANKED_DIR) { $env:RANKED_DIR } else { Join-Path $env:LOCALAPPDATA 'Ranked' }
New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$StateFile = Join-Path $Dir 'state.json'
$ConfigFile = Join-Path $Dir 'config.json'
$LogFile = Join-Path $Dir 'agent.log'
$TickSec = if ($env:RANKED_TICK_SEC) { [double]$env:RANKED_TICK_SEC } else { 5 }
$PushSec = 60
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Write-Log($m) {
  try {
    Add-Content -Path $LogFile -Value ("{0} {1}" -f (Get-Date -Format s), $m)
    if ((Get-Item $LogFile).Length -gt 300KB) { $t = Get-Content $LogFile -Tail 300; Set-Content -Path $LogFile -Value $t }
  } catch {}
}

# ---------- Probes (Windows). Overridable for tests with RANKED_MOCK ----------
if ($env:RANKED_MOCK) {
  . $env:RANKED_MOCK
} else {
  Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class RkWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] public struct LII { public uint cbSize; public uint dwTime; }
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LII p);
  public static double IdleSeconds() {
    LII l = new LII(); l.cbSize = (uint)Marshal.SizeOf(l);
    if (!GetLastInputInfo(ref l)) return 0;
    return ((uint)Environment.TickCount - l.dwTime) / 1000.0;
  }
  public static string Title(IntPtr h) { StringBuilder sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
}
"@
  function Get-RkForeground {
    $h = [RkWin]::GetForegroundWindow()
    if ($h -eq [IntPtr]::Zero) { return $null }
    $procId = [uint32]0
    [void][RkWin]::GetWindowThreadProcessId($h, [ref]$procId)
    $name = ''
    try { $name = (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch {}
    return @{ title = [RkWin]::Title($h); proc = $name }
  }
  function Get-RkIdleSeconds { return [RkWin]::IdleSeconds() }
}
function Get-RkNow { if (Get-Command Get-RkMockNow -ErrorAction SilentlyContinue) { return Get-RkMockNow } return Get-Date }

# ---------- Config ----------
$script:Cfg = $null
$script:CfgAt = [datetime]::MinValue
function Update-RkConfig {
  try {
    $body = @{ token = $Token } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "$Server/api/agent-config" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 20
    if ($r.cats) {
      $script:Cfg = $r
      $r | ConvertTo-Json -Depth 6 | Set-Content -Path $ConfigFile -Encoding UTF8
      if ($r.push) { $script:PushSec = [int]$r.push }
    }
  } catch {
    Write-Log "config: $($_.Exception.Message)"
    if (-not $script:Cfg -and (Test-Path $ConfigFile)) { try { $script:Cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json } catch {} }
  }
  $script:CfgAt = Get-RkNow
}

function Get-RkCategory($title, $proc) {
  if (-not $script:Cfg) { return $null }
  $t = ('' + $title).ToLower()
  $p = ('' + $proc).ToLower()
  $cats = @($script:Cfg.cats)
  # 1. process name
  foreach ($c in $cats) { if (@($c.proc) -contains $p) { return $c } }
  # 2. player's own keywords first (they win over defaults)
  foreach ($c in $cats) { foreach ($k in @($c.kwx)) { if ($k -and $t.Contains($k)) { return $c } } }
  # 3. defaults: scroll is checked first so a video about work still counts as scroll
  $ordered = @($cats | Where-Object { $_.id -eq 'scroll' }) + @($cats | Where-Object { $_.id -ne 'scroll' })
  foreach ($c in $ordered) { foreach ($k in @($c.kw)) { if ($k -and $t.Contains($k)) { return $c } } }
  return $null
}

# ---------- State ----------
function New-RkState($date) { return @{ date = $date; sec = @{}; late = 0 } }
function Read-RkState {
  try {
    if (Test-Path $StateFile) {
      $o = Get-Content $StateFile -Raw | ConvertFrom-Json
      $s = New-RkState $o.date
      foreach ($pr in $o.sec.PSObject.Properties) { $s.sec[$pr.Name] = [double]$pr.Value }
      $s.late = [double]$o.late
      return $s
    }
  } catch { Write-Log "state read: $($_.Exception.Message)" }
  return $null
}
function Save-RkState($s) { try { $s | ConvertTo-Json -Depth 4 | Set-Content -Path $StateFile -Encoding UTF8 } catch {} }

function Send-RkTotals($s) {
  $minutes = @{}
  foreach ($k in $s.sec.Keys) { $minutes[$k] = [math]::Floor($s.sec[$k] / 60) }
  $tz = [int][math]::Round([TimeZoneInfo]::Local.GetUtcOffset((Get-RkNow)).TotalMinutes)
  $body = @{ token = $Token; date = $s.date; tz = $tz; minutes = $minutes; late = [math]::Floor($s.late / 60); v = $AgentVersion } | ConvertTo-Json -Compress -Depth 4
  try {
    Invoke-RestMethod -Uri "$Server/api/ingest" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 20 | Out-Null
    return $true
  } catch { Write-Log "push: $($_.Exception.Message)"; return $false }
}

# ---------- Main loop ----------
$mutex = New-Object System.Threading.Mutex($false, 'Local\RankedAgentV2')
if (-not $mutex.WaitOne(0)) { Write-Log 'deja lance, sortie'; return }
Write-Log "demarrage v$AgentVersion"
Update-RkConfig
$today = (Get-RkNow).ToString('yyyy-MM-dd')
$state = Read-RkState
if (-not $state -or $state.date -ne $today) {
  if ($state) { [void](Send-RkTotals $state) }
  $state = New-RkState $today
}
[void](Send-RkTotals $state)
$last = Get-RkNow
$lastPush = $last
$ticks = 0
$maxTicks = if ($env:RANKED_TICKS) { [int]$env:RANKED_TICKS } else { 0 }
while ($true) {
  if (-not $env:RANKED_MOCK) { Start-Sleep -Milliseconds ([int]($TickSec * 1000)) }
  $now = Get-RkNow
  $dt = ($now - $last).TotalSeconds
  $last = $now
  if ($dt -lt 0 -or $dt -gt ($TickSec * 3)) { $dt = 0 }   # sleep/hibernate: never count the gap
  $date = $now.ToString('yyyy-MM-dd')
  if ($date -ne $state.date) {
    [void](Send-RkTotals $state)
    $state = New-RkState $date
  }
  $fg = Get-RkForeground
  if ($fg -and $dt -gt 0) {
    $cat = Get-RkCategory $fg.title $fg.proc
    $limit = if ($cat -and $cat.idle) { [double]$cat.idle } else { 300 }
    if ((Get-RkIdleSeconds) -lt $limit) {
      $id = if ($cat) { $cat.id } else { 'other' }
      if (-not $state.sec.ContainsKey($id)) { $state.sec[$id] = 0 }
      $state.sec[$id] += $dt
      if ($cat -and $cat.work -and ($now.Hour -ge 23 -or $now.Hour -lt 4)) { $state.late += $dt }
    }
  }
  if (($now - $lastPush).TotalSeconds -ge $PushSec) {
    Save-RkState $state
    [void](Send-RkTotals $state)
    $lastPush = $now
  }
  if (($now - $script:CfgAt).TotalMinutes -ge 30) { Update-RkConfig }
  $ticks++
  if ($maxTicks -gt 0 -and $ticks -ge $maxTicks) { Save-RkState $state; [void](Send-RkTotals $state); break }
}
$mutex.ReleaseMutex()
