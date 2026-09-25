#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Собирает приложение SPFx и ставит его на сайт: каталог приложений сайта -> приложение -> страница Portal -> главная.

.DESCRIPTION
    Этап 1 — только тестовый сайт (адрес заканчивается на -test). Каталог тенанта и прод — на этапе 4, с подтверждением человека.
    Идемпотентен: каталог и страница создаются один раз, приложение обновляется до новой версии пакета.

.EXAMPLE
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action app
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$TenantName,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
if ($SiteUrl -notmatch '-test/?$') { throw "Этап 1: только тестовый сайт (…-test), получено $SiteUrl" }
$root = Split-Path -Parent $PSScriptRoot
$pkg = Join-Path $root "spfx/sharepoint/solution/pmo-portal.sppkg"

if (-not $SkipBuild) {
    Write-Host "1. Сборка приложения" -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot "spfx.sh") npm run build | Out-Null
    if ($LASTEXITCODE) { throw "Сборка SPFx не прошла: scripts/spfx.sh npm run build" }
}
if (-not (Test-Path $pkg)) { throw "Нет пакета $pkg" }

function Connect-To([string]$Url) {
    if ($Thumbprint) { Connect-PnPOnline -Url $Url -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
    elseif ($CertificatePath) { Connect-PnPOnline -Url $Url -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
    else { Connect-PnPOnline -Url $Url -ClientId $ClientId -Interactive }
}

# 2. Каталог приложений сайта — один раз; нужны права администратора SharePoint
Write-Host "2. Каталог приложений сайта" -ForegroundColor Cyan
Connect-To "https://$TenantName-admin.sharepoint.com"
$has = @(Get-PnPSiteCollectionAppCatalog -CurrentSite:$false | Where-Object { $_.AbsoluteUrl.TrimEnd('/') -eq $SiteUrl.TrimEnd('/') })
if (-not $has) { Add-PnPSiteCollectionAppCatalog -Site $SiteUrl; Write-Host "  + каталог приложений сайта" -ForegroundColor Green }

# 3. Приложение: загрузить (перезаписать), опубликовать, установить или обновить
Write-Host "3. Приложение" -ForegroundColor Cyan
Connect-To $SiteUrl
$app = Add-PnPApp -Path $pkg -Scope Site -Overwrite -Publish
$inst = Get-PnPApp -Identity $app.Id -Scope Site
if (-not $inst.InstalledVersion) { Install-PnPApp -Identity $app.Id -Scope Site -Wait; Write-Host "  + приложение установлено" -ForegroundColor Green }
elseif ($inst.CanUpgrade) { Update-PnPApp -Identity $app.Id -Scope Site; Write-Host "  приложение обновлено до $($inst.AppCatalogVersion)" }
else { Write-Host "  приложение актуально ($($inst.InstalledVersion))" }

# 4. Страница приложения на весь экран — главная сайта
Write-Host "4. Страница Portal" -ForegroundColor Cyan
if (-not (Get-PnPPage -Identity "Portal" -ErrorAction SilentlyContinue)) {
    $null = Add-PnPPage -Name "Portal" -Title "Портфель проєктів" -LayoutType SingleWebPartAppPage
    Add-PnPPageWebPart -Page "Portal" -Component "Портфель проєктів" | Out-Null
    Set-PnPPage -Identity "Portal" -Publish | Out-Null
    Write-Host "  + страница Portal" -ForegroundColor Green
}
Set-PnPHomePage -RootFolderRelativeUrl "SitePages/Portal.aspx"
# компактная шапка сайта без названия: над приложением — только строка меню SharePoint
Set-PnPWeb -HeaderLayout Minimal -HideTitleInHeader:$true
Write-Host "`nГотово: $SiteUrl" -ForegroundColor Yellow
