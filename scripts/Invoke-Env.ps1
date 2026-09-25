#Requires -Version 7.2
<#
.SYNOPSIS
    Единая точка запуска для людей, Claude Code и CI: берёт параметры окружения из config/environments.json.

.EXAMPLE
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action deploy
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync-dryrun
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action seed          # демонстрационные данные
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action app           # приложение SPFx на тестовый сайт
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action deploy -ConfirmProduction
#>
param(
    [Parameter(Mandatory)][ValidateSet("test", "prod")][string]$Env,
    [Parameter(Mandatory)][ValidateSet("deploy", "sync", "sync-dryrun", "reminders", "rebuild-permissions", "seed", "app")][string]$Action,
    [switch]$ConfirmProduction
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
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

if ($Action -eq "seed") {
    # демонстрационные данные — только на тестовом сайте, с приложением развёртывания
    if ($Env -ne "test") { throw "Действие «seed» доступно только для окружения test." }
    $a = Get-Auth $cfg.Deploy
    $a.SiteUrl = $siteUrl
    & (Join-Path $PSScriptRoot "Seed-TestData.ps1") @a
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
