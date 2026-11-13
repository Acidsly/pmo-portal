#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Диагностика проекта (только чтение): карточка, эталон показателей, статус-отчёты, решения PMO, призначення, журнал.

.DESCRIPTION
    Отвечает на вопрос «почему у проекта такие показатели»: что записано в карточке и эталоне, какие отчёты поданы,
    какие решения приняты и что синхронизация записала в журнал — по порядку времени. Ничего не меняет.
    Запуск: Invoke-Env.ps1 -Env test -Action project -Title "часть названия или код PRJ-…".
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [Parameter(Mandatory)][string]$Title
)
$ErrorActionPreference = "Stop"
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

function Val($v) {
    if ($null -eq $v) { return "" }
    if ($v -is [Microsoft.SharePoint.Client.FieldLookupValue]) { return "$($v.LookupId):$($v.LookupValue)" }
    if ($v -is [datetime]) { return $v.ToLocalTime().ToString("dd.MM HH:mm") }
    if ($v -is [array]) { return (($v | ForEach-Object { Val $_ }) -join ", ") }
    $s = [string]$v -replace "\s+", " "
    if ($s.Length -gt 160) { $s = $s.Substring(0, 160) + "…" }
    return $s
}
# строки списка (без папок) этого проекта: поле-ссылка на проект — $lookup; свои поля списка — по префиксу
function Show-Rows([string]$caption, [string]$list, [string]$lookup, [string]$prefix, [int]$projId) {
    Write-Host "`n== $caption ==" -ForegroundColor Cyan
    $rows = @(Get-PnPListItem -List $list -PageSize 2000 | Where-Object {
        $_.FileSystemObjectType -ne "Folder" -and $_[$lookup] -and [int]$_[$lookup].LookupId -eq $projId } | Sort-Object { $_["Created"] })
    if (-not $rows.Count) { Write-Host "  (нет)"; return }
    foreach ($r in $rows) {
        $who = Val $r["Author"]
        Write-Host ("  #{0} · создано {1} ({2}) · изменено {3}" -f $r.Id, (Val $r["Created"]), ($who -replace '^\d+:', ''), (Val $r["Modified"]))
        $pairs = foreach ($k in ($r.FieldValues.Keys | Where-Object { $_ -like "$prefix*" -and $_ -ne $lookup } | Sort-Object)) {
            $x = Val $r[$k]; if ($x -ne "") { "$k=$x" } }
        Write-Host ("      " + ($pairs -join " | "))
    }
}

$all = @(Get-PnPListItem -List "Lists/Projects" -PageSize 2000)
$found = @($all | Where-Object { ([string]$_["Title"]) -like "*$Title*" -or ([string]$_["pmCode"]) -eq $Title })
if (-not $found.Count) { Write-Host "Проект «$Title» не найден" -ForegroundColor Yellow; return }
foreach ($p in $found) {
    Write-Host ("`n######## {0} · {1} (ID {2}) ########" -f $p["pmCode"], $p["Title"], $p.Id) -ForegroundColor Green
    Write-Host ("  создан {0} · изменён {1} ({2})" -f (Val $p["Created"]), (Val $p["Modified"]), ((Val $p["Editor"]) -replace '^\d+:', ''))
    foreach ($k in "pmStatus", "pmRAG", "pmType", "pmProgress", "pmStart", "pmGoLive", "pmPlanEnd", "pmForecastEnd", "pmBudget", "pmActualCost", "pmForecastCost",
                   "pmLastUpdate", "pmLastReport", "pmArchivedAt", "pmManager", "pmOwner", "pmCountry", "pmEditLog") {
        $x = Val $p[$k]; if ($x -ne "") { Write-Host ("  {0,-15} {1}" -f $k, $x) } }
    Show-Rows "Еталон показників" "Lists/ProjectState" "psProject" "ps" $p.Id
    Show-Rows "Статус-звіти" "Lists/StatusReports" "srProject" "sr" $p.Id
    Show-Rows "Погодження звітів" "Lists/ReportApprovals" "apProject" "ap" $p.Id
    Show-Rows "Призначення" "Lists/ProjectAssignments" "paProject" "pa" $p.Id
    Show-Rows "Зміни показників (журнал)" "Lists/KeyChanges" "kcProject" "kc" $p.Id
}
