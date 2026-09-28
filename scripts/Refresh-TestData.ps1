#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Освежает демонстрационные данные ТЕСТОВОГО сайта: демо-проекты (PRJ-001…PRJ-010) со старым отчётом получают свежий погоджений
    статус-отчёт от своего PM (в карточку его переносит синхронизация), просроченные открытые риски — новый срок.

.DESCRIPTION
    Только тестовый сайт (…/sites/*-test), только демо-проекты PRJ-001…PRJ-010; проекты и отчёты фокус-группы не трогаются.
    Идемпотентен: у проекта со свежим отчётом (не старше -FreshDays) ничего не добавляется.
    Проекты из -KeepStale остаются без свежего отчёта — чтобы на главной было что показать в «Немає свіжого звіту».
    Запуск: Invoke-Env.ps1 -Env test -Action refresh, затем -Action sync.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [int]$FreshDays = 8,
    [string[]]$KeepStale = @("PRJ-008"),
    # демо-проекты Seed-TestData.ps1 — первые десять номеров
    [string[]]$Demo = @(1..10 | ForEach-Object { "PRJ-{0:d3}" -f $_ })
)
$ErrorActionPreference = "Stop"
if ($SiteUrl -notmatch '-test/?$') { throw "Refresh-TestData.ps1 работает только с тестовым сайтом (…/sites/*-test), получено: $SiteUrl" }
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

$today = (Get-Date).Date
function SpDate([datetime]$d) { $d.ToString("yyyy-MM-dd") + "T12:00:00Z" }
function DateOnly($v) { if ($v) { return ([datetime]$v).ToUniversalTime().AddHours(12).Date } return $null }

$items = @(Get-PnPListItem -List "Lists/Projects" -PageSize 500 | Where-Object { $Demo -contains [string]$_["pmCode"] -and $_["pmStatus"] -ne "Архівний" } |
    Sort-Object { [string]$_["pmCode"] })
# самый свежий отчёт проекта — по списку отчётов (в том числе ещё не перенесённых синхронизацией), а не по карточке
$lastRep = @{}
foreach ($x in (Get-PnPListItem -List "Lists/StatusReports" -PageSize 500 -Fields "srProject","srDate")) {
    $lk = $x["srProject"]; $d = DateOnly $x["srDate"]; if (-not $lk -or -not $d) { continue }
    if (-not $lastRep[$lk.LookupId] -or $d -gt $lastRep[$lk.LookupId]) { $lastRep[$lk.LookupId] = $d }
}
$added = 0; $i = 0
foreach ($it in $items) {
    $code = [string]$it["pmCode"]; $last = $lastRep[$it.Id]
    if ($KeepStale -contains $code) { continue }
    if ($last -and ($today - $last).TotalDays -le $FreshDays) { continue }
    $pm = $it["pmManager"]; if (-not $pm) { continue }
    $i++
    $date = $today.AddDays(-(1 + ($i % 6)))
    # состояние — как в карточке (не улучшаем и не ухудшаем портфель), % — чуть вперёд
    $rag = [string]$it["pmRAG"]; if (-not $rag) { $rag = "Зелений" }
    $sched = $rag; $prog = [Math]::Min(95, [int]$it["pmProgress"] + 5)
    $v = @{ Title = "Роботи за планом: етап продовжується"; srProject = $it.Id; srDate = (SpDate $date); srPeriod = "2 тижні"
            srSchedule = $sched; srBudget = "Зелений"; srResources = "Зелений"; srProgress = $prog
            srDone = "Виконано заплановані роботи періоду."; srNext = "Продовжити роботи за планом."; srIssues = ""
            srDecision = $false; srApplied = $false; srApproval = "Погоджено"; srApprovalNote = "Демонстраційні дані" }
    $r = Add-PnPListItem -List "Lists/StatusReports" -Values $v
    # автор — PM проекта: синхронизация применяет только отчёты PM
    Set-PnPListItem -List "Lists/StatusReports" -Identity $r.Id -UpdateType UpdateOverwriteVersion `
        -Values @{ Author = $pm.Email; Editor = $pm.Email; Created = (SpDate $date); Modified = (SpDate $date) } | Out-Null
    $added++
    Write-Host ("  + {0}: звіт від {1:dd.MM.yyyy}, {2}, {3}%" -f $code, $date, $sched, $prog) -ForegroundColor Green
}

# просроченные открытые риски демо-проектов — новый срок через 1–4 недели
$ids = @{}; foreach ($it in $items) { $ids[$it.Id] = [string]$it["pmCode"] }
$moved = 0; $k = 0
foreach ($ri in (Get-PnPListItem -List "Lists/RisksIssues" -PageSize 500)) {
    $lk = $ri["riProject"]; if (-not $lk -or -not $ids.ContainsKey($lk.LookupId)) { continue }
    $due = DateOnly $ri["riDue"]
    if ($ri["riStatus"] -eq "Закрито" -or -not $due -or $due -ge $today) { continue }
    $k++; $nd = $today.AddDays(7 * (1 + ($k % 4)))
    Set-PnPListItem -List "Lists/RisksIssues" -Identity $ri.Id -Values @{ riDue = (SpDate $nd) } -UpdateType SystemUpdate | Out-Null
    $moved++
    Write-Host ("  ~ {0}: ризик «{1}» — термін {2:dd.MM.yyyy}" -f $ids[$lk.LookupId], $ri["Title"], $nd)
}
Write-Host ("Готово: свіжих звітів {0}, перенесених термінів ризиків {1}. Далі — Invoke-Env.ps1 -Env test -Action sync." -f $added, $moved) -ForegroundColor Green
