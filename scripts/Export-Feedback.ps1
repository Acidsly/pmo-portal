#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Выгрузка отзывов фокус-группы (список «Відгуки») для разбора: feedback.json + feedback.csv + скриншоты по папкам.

.DESCRIPTION
    Только чтение. Запуск — через Invoke-Env.ps1 -Env test -Action feedback.
    Результат — в feedback-export/ в корне репозитория (не в git: там ФИО и скриншоты участников).
    Повторный запуск перезаписывает выгрузку целиком.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "feedback-export")
)
$ErrorActionPreference = "Stop"
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir | Out-Null
$web = Get-PnPWeb -Includes ServerRelativeUrl

$rows = @()
foreach ($it in (Get-PnPListItem -List "Lists/Feedback" -PageSize 500)) {
    $files = @()
    if ($it["Attachments"]) {
        $dir = Join-Path $OutDir ("{0:d3}" -f $it.Id)
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        $att = Get-PnPProperty -ClientObject $it -Property AttachmentFiles
        foreach ($a in $att) {
            Get-PnPFile -Url $a.ServerRelativeUrl -Path $dir -FileName $a.FileName -AsFile -Force | Out-Null
            $files += (Join-Path ("{0:d3}" -f $it.Id) $a.FileName)
        }
    }
    $rows += [ordered]@{
        id = $it.Id
        created = $it["Created"].ToLocalTime().ToString("yyyy-MM-dd HH:mm")
        author = [string]$it["Author"].LookupValue
        status = [string]$it["fbStatus"]
        screen = [string]$it["fbScreen"]
        device = [string]$it["fbDevice"]
        text = [string]$it["fbText"]
        answer = [string]$it["fbAnswer"]
        screenshots = $files
    }
}
$rows | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $OutDir "feedback.json") -Encoding utf8NoBOM
$rows | ForEach-Object { [pscustomobject]@{ Id = $_.id; Дата = $_.created; Автор = $_.author; Статус = $_.status; Екран = $_.screen
        Відгук = $_.text; Відповідь = $_.answer; Скриншоти = ($_.screenshots -join "; "); Пристрій = $_.device } } |
    Export-Csv (Join-Path $OutDir "feedback.csv") -NoTypeInformation -Encoding utf8BOM
Write-Host ("Відгуків: {0}, зі скриншотами: {1} → {2}" -f $rows.Count, @($rows | Where-Object { $_.screenshots.Count }).Count, $OutDir) -ForegroundColor Green
