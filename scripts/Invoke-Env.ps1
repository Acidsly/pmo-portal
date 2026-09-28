#Requires -Version 7.2
<#
.SYNOPSIS
    Единая точка запуска для людей, Claude Code и CI: берёт параметры окружения из config/environments.json.

.EXAMPLE
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action deploy
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync-dryrun
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action seed          # демонстрационные данные
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action renumber      # единая нумерация PRJ-001…
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action refresh       # освежить демо-данные PRJ-001…010
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action app           # приложение SPFx на тестовый сайт
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action feedback      # выгрузка отзывов в feedback-export/
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action deploy -ConfirmProduction
#>
param(
    [Parameter(Mandatory)][ValidateSet("test", "prod")][string]$Env,
    [Parameter(Mandatory)][ValidateSet("deploy", "sync", "sync-dryrun", "reminders", "rebuild-permissions", "seed", "refresh", "renumber", "renumber-dryrun", "app", "feedback")][string]$Action,
    [switch]$ConfirmProduction,
    # корень репозитория (config/, certs/), если скрипты запущены из копии — так делает расписание Set-MacSchedule.ps1
    [string]$RepoRoot
)
$ErrorActionPreference = "Stop"
$root = if ($RepoRoot) { $RepoRoot } else { Split-Path -Parent $PSScriptRoot }
$cfgFile = Join-Path $root "config/environments.json"
if (-not (Test-Path $cfgFile)) { throw "Нет config/environments.json. Скопируйте config/environments.example.json и заполните." }
$cfg = (Get-Content -Raw $cfgFile | ConvertFrom-Json).$Env
if (-not $cfg) { throw "В config/environments.json нет окружения «$Env»." }
if ($Env -eq "prod" -and $Action -ne "sync-dryrun" -and -not $ConfirmProduction) {
    throw "Действие «$Action» на проде требует явного -ConfirmProduction (после подтверждения человеком)."
}

function Get-Auth($section) {
    $a = @{ ClientId = $section.ClientId }
    if ($section.Thumbprint) { $a.Tenant = $cfg.Tenant; $a.Thumbprint = $section.Thumbprint }
    elseif ($section.CertificatePath) {
        $pwdEnv = $section.CertificatePasswordEnv
        $plain = if ($pwdEnv) { [Environment]::GetEnvironmentVariable($pwdEnv) } else { $null }
        # macOS: если переменной нет (приложение запущено не из терминала) — берём пароль из «Связки ключей»
        if (-not $plain -and $pwdEnv -and $IsMacOS) {
            $plain = (& security find-generic-password -a $env:USER -s $pwdEnv -w 2>$null)
        }
        if (-not $plain) { throw "Нет пароля сертификата: добавьте его в «Связку ключей» под именем $pwdEnv (security add-generic-password -a `"`$USER`" -s $pwdEnv -w) или в переменную окружения $pwdEnv." }
        $a.Tenant = $cfg.Tenant
        $a.CertificatePath = (Resolve-Path (Join-Path $root $section.CertificatePath)).Path
        $a.CertificatePassword = ConvertTo-SecureString $plain -AsPlainText -Force
    }
    return $a
}

$siteUrl = "https://$($cfg.TenantName).sharepoint.com/sites/$($cfg.SiteAlias)"
Write-Host "Окружение: $Env · $siteUrl · действие: $Action" -ForegroundColor Cyan

if ($Action -eq "feedback") {
    # выгрузка отзывов фокус-группы (только чтение) — в feedback-export/, вне git
    $a = Get-Auth $cfg.Deploy
    $a.SiteUrl = $siteUrl
    & (Join-Path $PSScriptRoot "Export-Feedback.ps1") @a
} elseif ($Action -eq "seed") {
    # демонстрационные данные — только на тестовом сайте, с приложением развёртывания
    if ($Env -ne "test") { throw "Действие «seed» доступно только для окружения test." }
    $a = Get-Auth $cfg.Deploy
    $a.SiteUrl = $siteUrl
    # роли фокус-группы — из файла вне git (e-mail сотрудников)
    $fg = Join-Path $root "config/focus-group.json"
    if (Test-Path $fg) { $a.Roles = $fg }
    & (Join-Path $PSScriptRoot "Seed-TestData.ps1") @a
} elseif ($Action -eq "refresh") {
    # освежить демонстрационные данные PRJ-001…010 (свежие отчёты, сроки рисков) — только тест
    if ($Env -ne "test") { throw "Действие «refresh» доступно только для окружения test." }
    $a = Get-Auth $cfg.Deploy
    $a.SiteUrl = $siteUrl
    & (Join-Path $PSScriptRoot "Refresh-TestData.ps1") @a
} elseif ($Action -in @("renumber", "renumber-dryrun")) {
    # единая нумерация PRJ-001… по порядку создания; на тесте — сразу, на проде — только с -ConfirmProduction (проверка выше)
    $a = Get-Auth $cfg.Deploy
    $a.SiteUrl = $siteUrl
    if ($Action -eq "renumber-dryrun") { $a.DryRun = $true }
    & (Join-Path $PSScriptRoot "Renumber-Projects.ps1") @a
} elseif ($Action -eq "app") {
    # приложение SPFx: сборка, каталог приложений сайта, страница на весь экран; этап 1 — только test
    if ($Env -ne "test") { throw "Действие «app» на этапе 1 — только для окружения test." }
    $a = Get-Auth $cfg.Deploy
    $a.SiteUrl = $siteUrl; $a.TenantName = $cfg.TenantName
    & (Join-Path $PSScriptRoot "Deploy-App.ps1") @a
} elseif ($Action -eq "deploy") {
    # без сертификата Deploy-PMO.ps1 откроет браузер для входа (рекомендуется для прода)
    $a = Get-Auth $cfg.Deploy
    $a.TenantName = $cfg.TenantName; $a.SiteAlias = $cfg.SiteAlias; $a.Owner = $cfg.Owner
    if ($Env -eq "test") { $a.Feedback = $true }   # отзывы фокус-группы — только на тесте
    & (Join-Path $PSScriptRoot "Deploy-PMO.ps1") @a
} else {
    $a = Get-Auth $cfg.Sync
    if (-not ($a.ContainsKey("Thumbprint") -or $a.ContainsKey("CertificatePath"))) { throw "Для синхронизации нужен сертификат (секция Sync)." }
    $a.SiteUrl = $siteUrl
    switch ($Action) {
        "sync-dryrun"         { $a.DryRun = $true }
        "reminders"           { $a.SendReminders = $true; $a.ReminderFrom = $cfg.ReminderFrom }
        "rebuild-permissions" { $a.RebuildPermissions = $true }
    }
    & (Join-Path $PSScriptRoot "Invoke-PMOSync.ps1") @a
}
