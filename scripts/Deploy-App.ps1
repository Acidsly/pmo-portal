#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Собирает приложение SPFx и ставит его на сайт: каталог приложений сайта -> приложение -> страница Portal -> главная.

.DESCRIPTION
    Тестовый сайт (адрес на -test) — сразу; любой другой (прод /sites/ppm) — только с -Production, который передаёт Invoke-Env.ps1
    для -Env prod -Action app -ConfirmProduction (после подтверждения человеком в чате). Каталог приложений — сайта, как на тесте.
    Идемпотентен: каталог и страница создаются один раз, приложение обновляется до новой версии пакета.

.EXAMPLE
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action app
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action app -ConfirmProduction   # только после «да»
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$TenantName,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [switch]$SkipBuild,
    [switch]$Production,
    # приложение с правами только на сайт (PMO Dev): каталог приложений сайта не создаётся, только проверяется
    [switch]$SiteScoped
)
$ErrorActionPreference = "Stop"
if ($SiteUrl -notmatch '-test/?$' -and -not $Production) { throw "Не тестовый сайт ($SiteUrl): установка только с -Production (Invoke-Env.ps1 -Env prod -Action app -ConfirmProduction)" }
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
if ($SiteScoped) {
    Connect-To $SiteUrl
    # каталог приложений сайта — список по адресу <сайт>/AppCatalog (название зависит от языка)
    if (-not @(Get-PnPList | Where-Object { $_.DefaultViewUrl -match '/AppCatalog/' })) { throw "На $SiteUrl нет каталога приложений сайта — его создаёт владелец (Invoke-Env -Action app со своим входом)" }
} else {
    Connect-To "https://$TenantName-admin.sharepoint.com"
    $has = @(Get-PnPSiteCollectionAppCatalog -CurrentSite:$false | Where-Object { $_.AbsoluteUrl.TrimEnd('/') -eq $SiteUrl.TrimEnd('/') })
    if (-not $has) { Add-PnPSiteCollectionAppCatalog -Site $SiteUrl; Write-Host "  + каталог приложений сайта" -ForegroundColor Green }
}

# 3. Приложение: загрузить (перезаписать), опубликовать, установить или обновить
Write-Host "3. Приложение" -ForegroundColor Cyan
Connect-To $SiteUrl
# только что созданный каталог SharePoint готовит несколько минут (ошибка «appMetadata») — повторяем до 10 минут
for ($try = 1; ; $try++) {
    try { $app = Add-PnPApp -Path $pkg -Scope Site -Overwrite -Publish; break }
    catch {
        if ($try -ge 20) { throw }
        Write-Host "  каталог приложений ещё не готов ($($_.Exception.Message)) — повтор через 30 с" -ForegroundColor Yellow
        Start-Sleep 30
    }
}
$inst = Get-PnPApp -Identity $app.Id -Scope Site
if (-not $inst.InstalledVersion) { Install-PnPApp -Identity $app.Id -Scope Site -Wait; Write-Host "  + приложение установлено" -ForegroundColor Green }
elseif ($inst.CanUpgrade) { Update-PnPApp -Identity $app.Id -Scope Site; Write-Host "  приложение обновлено до $($inst.AppCatalogVersion)" }
else { Write-Host "  приложение актуально ($($inst.InstalledVersion))" }

# 4. Страница приложения на весь экран — главная сайта
Write-Host "4. Страница Portal" -ForegroundColor Cyan
if (-not (Get-PnPPage -Identity "Portal" -ErrorAction SilentlyContinue)) {
    $null = Add-PnPPage -Name "Portal" -Title "PPM — Управління портфелем проєктів" -LayoutType SingleWebPartAppPage
    Add-PnPPageWebPart -Page "Portal" -Component "PPM — Project Portfolio Management" | Out-Null
    Set-PnPPage -Identity "Portal" -Publish | Out-Null
    Write-Host "  + страница Portal" -ForegroundColor Green
}
# название страницы (вкладка браузера) — как у сайта; на уже созданной странице тоже
Set-PnPPage -Identity "Portal" -Title "PPM — Управління портфелем проєктів" -Publish | Out-Null
Set-PnPHomePage -RootFolderRelativeUrl "SitePages/Portal.aspx"
# компактная шапка сайта без названия: над приложением — только строка меню SharePoint
Set-PnPWeb -HeaderLayout Minimal -HideTitleInHeader:$true

# 5. «Детальний огляд системи» (из «Довідки» приложения): PDF и скриншоты обзора — в «Ресурси сайту»/pmo-overview.
#    Библиотека наследует права сайта: участники читают. Загружаются только изменённые файлы (по размеру и дате).
Write-Host "5. Огляд системи (SiteAssets/pmo-overview)" -ForegroundColor Cyan
$ctx = Get-PnPContext; $assets = $ctx.Web.Lists.EnsureSiteAssetsLibrary(); $ctx.Load($assets.RootFolder); Invoke-PnPQuery
$dir = $assets.RootFolder.ServerRelativeUrl.TrimEnd("/") + "/pmo-overview"
$webRel = (Get-PnPWeb).ServerRelativeUrl.TrimEnd("/")
$have = @{}
foreach ($f in @(Get-PnPFolderItem -FolderSiteRelativeUrl ($dir.Substring($webRel.Length + 1) + "/img") -ItemType File -ErrorAction SilentlyContinue) + @(Get-PnPFolderItem -FolderSiteRelativeUrl $dir.Substring($webRel.Length + 1) -ItemType File -ErrorAction SilentlyContinue)) {
    if ($f) { $have[[string]$f.ServerRelativeUrl] = [long]$f.Length }
}
$up = 0
$files = @(@{ src = Join-Path $root "docs/overview/overview.uk.pdf"; to = $dir }) +
    @(Get-ChildItem (Join-Path $root "docs/overview/img") -Filter *.png | ForEach-Object { @{ src = $_.FullName; to = "$dir/img" } })
foreach ($x in $files) {
    $dest = "$($x.to)/$(Split-Path -Leaf $x.src)"
    if ($have.ContainsKey($dest) -and $have[$dest] -eq (Get-Item $x.src).Length) { continue }
    Add-PnPFile -Path $x.src -Folder $x.to.Substring($webRel.Length + 1) | Out-Null; $up++
}
Write-Host "  файлов загружено: $up из $($files.Count)"
Write-Host "`nГотово: $SiteUrl" -ForegroundColor Yellow
