#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Регистрирует в Entra ID два приложения для портала «Портфель проєктів».

.DESCRIPTION
    Этап Deploy — приложение «PMO Deploy» для интерактивного входа администратора.
                  Им пользуется Deploy-PMO.ps1. Запускайте до развёртывания сайта.
    Этап Automation — приложение «PMO Automation» (app-only, сертификат) для развёртывания без
                  браузера — им пользуется Claude Code. Права Sites.FullControl.All: выдавайте его
                  только для тестового тенанта или держите выкладку на прод под подтверждением человека.
    Этап Sync   — приложение «PMO Sync» (app-only, вход по сертификату) для Invoke-PMOSync.ps1.
                  Запускайте после развёртывания сайта: при режиме Sites.Selected права
                  выдаются только на сайт портала.

    Права приложения PMO Sync:
      SharePoint  Sites.Selected + FullControl на сайт портала (по умолчанию)
                  или Sites.FullControl.All (ключ -AllSites)
      Graph       User.Read.All  — цепочка руководителей для прав по иерархии
                  Mail.Send      — напоминания PM (ограничьте ящиком PMO, см. README)

.EXAMPLE
    ./Register-PMOApps.ps1 -Stage Deploy -Tenant contoso.onmicrosoft.com
.EXAMPLE
    ./Register-PMOApps.ps1 -Stage Sync -Tenant contoso.onmicrosoft.com -SiteUrl https://contoso.sharepoint.com/sites/pmo -DeployClientId <guid>
#>
param(
    [Parameter(Mandatory)][ValidateSet("Deploy", "Automation", "Sync")][string]$Stage,
    [Parameter(Mandatory)][string]$Tenant,
    [string]$SiteUrl,
    [string]$DeployClientId,
    [string]$OutPath = (Join-Path $PSScriptRoot "certs"),
    [switch]$AllSites,
    [switch]$NoMail,
    [switch]$DeviceLogin
)
$ErrorActionPreference = "Stop"
# PnP.PowerShell 3.x: командлеты регистрации входят интерактивно по умолчанию, ключа -Interactive у них нет.
# -DeviceLogin выводит код и адрес — их можно открыть в любом браузере (например, в том, где уже выполнен вход).
$login = if ($DeviceLogin) { @{ DeviceLogin = $true } } else { @{} }

if ($Stage -eq "Deploy") {
    $app = Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PMO Deploy" -Tenant $Tenant @login `
        -SharePointDelegatePermissions "AllSites.FullControl" -GraphDelegatePermissions "Sites.FullControl.All", "User.Read.All"
    $id = $app.'AzureAppId/ClientId'
    Write-Host "`nPMO Deploy ClientId: $id" -ForegroundColor Green
    Write-Host "Дальше: ./Deploy-PMO.ps1 -TenantName <tenant> -ClientId $id -Owner <e-mail>"
    return
}

if ($Stage -eq "Automation") {
    New-Item -ItemType Directory -Force -Path $OutPath | Out-Null
    $pfxPassword = Read-Host "Пароль для файла сертификата .pfx" -AsSecureString
    $app = Register-PnPEntraIDApp -ApplicationName "PMO Automation" -Tenant $Tenant -OutPath $OutPath -CertificatePassword $pfxPassword `
        -SharePointApplicationPermissions "Sites.FullControl.All" @login
    Write-Host "`nPMO Automation ClientId: $($app.'AzureAppId/ClientId')" -ForegroundColor Green
    Write-Host   "Отпечаток сертификата:   $($app.'Certificate Thumbprint')" -ForegroundColor Green
    Write-Host   "Внесите их в config/environments.json (секция test)."
    return
}

# ----- Stage Sync -----
if (-not $SiteUrl) { throw "Укажите -SiteUrl сайта портала." }
if (-not $AllSites -and -not $DeployClientId) { throw "Для режима Sites.Selected укажите -DeployClientId (приложение PMO Deploy)." }

New-Item -ItemType Directory -Force -Path $OutPath | Out-Null
$pfxPassword = Read-Host "Пароль для файла сертификата .pfx" -AsSecureString
$graph = @("User.Read.All") + $(if ($NoMail) { @() } else { @("Mail.Send") })
$sp    = if ($AllSites) { "Sites.FullControl.All" } else { "Sites.Selected" }

$app = Register-PnPEntraIDApp -ApplicationName "PMO Sync" -Tenant $Tenant -OutPath $OutPath -CertificatePassword $pfxPassword `
    -SharePointApplicationPermissions $sp -GraphApplicationPermissions $graph @login
$syncId = $app.'AzureAppId/ClientId'
$thumb  = $app.'Certificate Thumbprint'

if (-not $AllSites) {
    $connect = if ($DeviceLogin) { @{ DeviceLogin = $true; Tenant = $Tenant } } else { @{ Interactive = $true } }
    Connect-PnPOnline -Url $SiteUrl -ClientId $DeployClientId @connect
    $grant = Grant-PnPEntraIDAppSitePermission -AppId $syncId -DisplayName "PMO Sync" -Site $SiteUrl -Permissions Write
    Set-PnPEntraIDAppSitePermission -Site $SiteUrl -PermissionId $grant.Id -Permissions FullControl | Out-Null
    Write-Host "  PMO Sync: FullControl только на $SiteUrl" -ForegroundColor Green
}

Write-Host "`nPMO Sync ClientId:   $syncId" -ForegroundColor Green
Write-Host   "Отпечаток сертификата: $thumb" -ForegroundColor Green
Write-Host   "Сертификат (.pfx/.cer): $OutPath"
Write-Host   "Проверка: ./Invoke-PMOSync.ps1 -SiteUrl $SiteUrl -ClientId $syncId -Tenant $Tenant -CertificatePath <pfx> -CertificatePassword (Read-Host -AsSecureString) -DryRun"
