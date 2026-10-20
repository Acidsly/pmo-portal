#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Даёт существующему приложению «PMO Sync» доступ к сайту окружения (Sites.Selected, FullControl только на этот сайт).

.DESCRIPTION
    Прод (20.10.2026): синхронизация с Mac и проверки (Invoke-Env.ps1 -Env prod -Action sync-dryrun / whois) работают
    через то же приложение «PMO Sync», что и тест, — новая регистрация (Register-PMOApps.ps1 -Stage Sync) перезаписала бы
    сертификат certs/PMO Sync.pfx тестовой синхронизации. Рабочая синхронизация прода — в Azure Automation (Grant-PMOAutomation.ps1).
    Приложение берётся из config/environments.json: раздел окружения, а если там заглушка — из раздела test (и тогда скрипт
    прописывает его в раздел окружения). Вход — в браузере через приложение PMO Deploy окружения; нужны права администратора.
    Идемпотентен: если доступ уже выдан — только повышает до FullControl.

.EXAMPLE
    pwsh -NoLogo -File scripts/Grant-PMOSyncSite.ps1 -Env prod
#>
param([Parameter(Mandatory)][ValidateSet("test", "prod")][string]$Env)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$cfgFile = Join-Path $root "config/environments.json"
$all = Get-Content -Raw $cfgFile | ConvertFrom-Json
$cfg = $all.$Env
$siteUrl = "https://$($cfg.TenantName).sharepoint.com/sites/$($cfg.SiteAlias)"
$placeholder = '^0{8}-0{4}-0{4}-0{4}-0{12}$'
$syncId = $cfg.Sync.ClientId
if (-not $syncId -or $syncId -match $placeholder) {
    $syncId = $all.test.Sync.ClientId
    if (-not $syncId -or $syncId -match $placeholder) { throw "Нет приложения PMO Sync ни в разделе $Env, ни в test." }
    $cfg.Sync.ClientId = $syncId
    $all | ConvertTo-Json -Depth 6 | Set-Content -Path $cfgFile -Encoding utf8
    Write-Host "  раздел $Env.Sync: приложение PMO Sync — то же, что для test (config/environments.json)" -ForegroundColor Green
}
Write-Host "Сайт: $siteUrl · PMO Sync …$($syncId.Substring($syncId.Length - 4))" -ForegroundColor Cyan
Connect-PnPOnline -Url $siteUrl -ClientId $cfg.Deploy.ClientId -Interactive
$cur = @(Get-PnPEntraIDAppSitePermission -Site $siteUrl | Where-Object { @($_.Apps | ForEach-Object { $_.Id }) -contains $syncId })[0]
if (-not $cur) { $cur = Grant-PnPEntraIDAppSitePermission -AppId $syncId -DisplayName "PMO Sync" -Site $siteUrl -Permissions Write; Write-Host "  + доступ PMO Sync" -ForegroundColor Green }
if (@($cur.Roles) -notcontains "fullcontrol") { Set-PnPEntraIDAppSitePermission -Site $siteUrl -PermissionId $cur.Id -Permissions FullControl | Out-Null }
Write-Host "  PMO Sync: FullControl только на $siteUrl" -ForegroundColor Green
Write-Host "Дальше: pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env $Env -Action sync-dryrun" -ForegroundColor Cyan
