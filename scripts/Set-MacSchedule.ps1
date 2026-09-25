#Requires -Version 7.2
<#
.SYNOPSIS
    ВРЕМЕННОЕ расписание синхронизации на Mac (launchd) — пока нет подписки Azure для Azure Automation.

.DESCRIPTION
    Ставит два задания пользователя (~/Library/LaunchAgents):
      ua.pmo.sync.<env>     — Invoke-Env.ps1 -Action sync: пн–пт 8:00–20:00 каждые 15 минут, ежедневно 6:00 и 22:00;
      ua.pmo.rebuild.<env>  — Invoke-Env.ps1 -Action rebuild-permissions: воскресенье 3:00 (учесть смену руководителей).
    Mac спал — пропущенный запуск выполняется при пробуждении; одновременно два запуска одного задания launchd не делает.
    Пароль сертификата Invoke-Env.ps1 берёт из «Связки ключей» (задания работают, пока пользователь вошёл в систему).
    Журнал: ~/Library/Logs/pmo-sync-<env>.log. Повторный запуск скрипта пересоздаёт задания; -Remove — снимает.

.EXAMPLE
    pwsh -NoLogo -File scripts/Set-MacSchedule.ps1 -Env test
    pwsh -NoLogo -File scripts/Set-MacSchedule.ps1 -Env test -Remove
#>
param(
    [ValidateSet("test", "prod")][string]$Env = "test",
    [switch]$Remove
)
$ErrorActionPreference = "Stop"
if (-not $IsMacOS) { throw "Скрипт только для macOS." }
$root   = Split-Path -Parent $PSScriptRoot
$agents = Join-Path $HOME "Library/LaunchAgents"
$log    = Join-Path $HOME "Library/Logs/pmo-sync-$Env.log"
# постоянная ссылка Homebrew, а не путь с номером версии (иначе после brew upgrade расписание сломается)
$pwsh   = @("/opt/homebrew/bin/pwsh", "/usr/local/bin/pwsh") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $pwsh) { $pwsh = (Get-Command pwsh).Source }
$uid    = (& id -u).Trim()

function Slot([int]$h, [int]$m, $wd) {
    $w = if ($null -ne $wd) { "<key>Weekday</key><integer>$wd</integer>" } else { "" }
    "<dict>$w<key>Hour</key><integer>$h</integer><key>Minute</key><integer>$m</integer></dict>"
}
function Job([string]$label, [string]$action, [string[]]$slots) {
    $path = Join-Path $agents "$label.plist"
    & launchctl bootout "gui/$uid/$label" 2>$null
    if (Test-Path $path) { Remove-Item $path }
    if ($Remove) { Write-Host "  - $label"; return }
    $xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array>
    <string>$pwsh</string><string>-NoLogo</string><string>-NonInteractive</string><string>-File</string>
    <string>$root/scripts/Invoke-Env.ps1</string><string>-Env</string><string>$Env</string><string>-Action</string><string>$action</string>
  </array>
  <key>WorkingDirectory</key><string>$root</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartCalendarInterval</key><array>$($slots -join '')</array>
  <key>StandardOutPath</key><string>$log</string>
  <key>StandardErrorPath</key><string>$log</string>
</dict></plist>
"@
    New-Item -ItemType Directory -Force -Path $agents | Out-Null
    Set-Content -Path $path -Value $xml -Encoding utf8NoBOM
    & launchctl bootstrap "gui/$uid" $path
    Write-Host "  + $label — $($slots.Count) запусков в расписании"
}

# пн–пт (1–5) 8:00–20:00 каждые 15 минут + каждый день 6:00 и 22:00
$sync = foreach ($d in 1..5) { foreach ($h in 8..19) { foreach ($m in 0, 15, 30, 45) { Slot $h $m $d } }; Slot 20 0 $d }
$sync += (Slot 6 0 $null), (Slot 22 0 $null)
Job "ua.pmo.sync.$Env" "sync" $sync
# воскресенье (0) 3:00 — полный пересчёт прав
Job "ua.pmo.rebuild.$Env" "rebuild-permissions" @(Slot 3 0 0)

if (-not $Remove) { Write-Host "Журнал: $log" -ForegroundColor Green } else { Write-Host "Расписание снято." -ForegroundColor Green }
