#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Единая нумерация проектов: PRJ-001, PRJ-002… по порядку создания (ID). Номер — только автоматический.

.DESCRIPTION
    Поле «Код» уникально (EnforceUniqueValues), поэтому перенумерация в два шага: сначала временные коды TMP-<ID>,
    затем итоговые. Каждое изменение — строка журнала «Редагування картки» (було → стало). Идемпотентен:
    проекты, у которых код уже совпадает с итоговым, не трогаются. -DryRun — только показать план.
    Запуск: Invoke-Env.ps1 -Env test -Action renumber.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [switch]$DryRun
)
$ErrorActionPreference = "Stop"
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

$items = @(Get-PnPListItem -List "Lists/Projects" -PageSize 500 -Fields "ID", "Title", "pmCode" | Sort-Object Id)
$plan = @()
$n = 0
foreach ($it in $items) {
    $n++
    $want = "PRJ-{0:d3}" -f $n
    if ([string]$it["pmCode"] -ne $want) { $plan += [pscustomobject]@{ Id = $it.Id; Title = [string]$it["Title"]; From = [string]$it["pmCode"]; To = $want } }
}
if (-not $plan.Count) { Write-Host "Нумерация уже единая: PRJ-001…PRJ-$('{0:d3}' -f $n)." -ForegroundColor Green; return }
$plan | ForEach-Object { Write-Host ("  #{0,-3} {1,-8} -> {2}  {3}" -f $_.Id, $_.From, $_.To, $_.Title) }
if ($DryRun) { Write-Host "DryRun: изменений нет ($($plan.Count) проектов к перенумерации)."; return }

# шаг 1: временные коды — чтобы уникальность не мешала обмену номерами
foreach ($x in $plan) { Set-PnPListItem -List "Lists/Projects" -Identity $x.Id -Values @{ pmCode = "TMP-$($x.Id)" } -UpdateType SystemUpdate | Out-Null }
# шаг 2: итоговые коды и журнал
$when = (Get-Date).ToUniversalTime().ToString("o")
foreach ($x in $plan) {
    Set-PnPListItem -List "Lists/Projects" -Identity $x.Id -Values @{ pmCode = $x.To } -UpdateType SystemUpdate | Out-Null
    Add-PnPListItem -List "Lists/KeyChanges" -Values @{ Title = "Код проєкту"; kcProject = $x.Id; kcDate = $when; kcKind = "Редагування картки"
        kcField = "pmCode"; kcFrom = $x.From; kcTo = $x.To; kcReason = "Єдина автоматична нумерація проєктів" } | Out-Null
}
Write-Host "Готово: перенумеровано $($plan.Count) проектов." -ForegroundColor Green
