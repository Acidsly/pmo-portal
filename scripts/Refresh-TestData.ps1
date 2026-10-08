#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Освежает демонстрационные данные ТЕСТОВОГО сайта (команда из нескольких человек, несколько ссылок): демо-проекты (PRJ-001…PRJ-010) со старым отчётом получают свежий погоджений
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
    [string[]]$Demo = @(1..10 | ForEach-Object { "PRJ-{0:d3}" -f $_ }),
    # тестовые учётные записи для «Команда проєкту» демо-проектов (людей фокус-группы в чужие проекты не добавляем)
    [string[]]$People = @("j.pochobut@eclectic.group", "test.kovalenko@smarthr.kz", "test.burbega@fillin.kz", "test@smarthr.kz"),
    [int]$TeamSize = 3,
    [int]$LinkCount = 3
)
$ErrorActionPreference = "Stop"
if ($SiteUrl -notmatch '-test/?$') { throw "Refresh-TestData.ps1 работает только с тестовым сайтом (…/sites/*-test), получено: $SiteUrl" }
. (Join-Path $PSScriptRoot "PMO.Common.ps1")   # Test-ArchivedStatus
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

$today = (Get-Date).Date
function SpDate([datetime]$d) { $d.ToString("yyyy-MM-dd") + "T12:00:00Z" }
function DateOnly($v) { if ($v) { return ([datetime]$v).ToUniversalTime().AddHours(12).Date } return $null }

$items = @(Get-PnPListItem -List "Lists/Projects" -PageSize 500 | Where-Object { $Demo -contains [string]$_["pmCode"] -and -not (Test-ArchivedStatus ([string]$_["pmStatus"])) } |
    Sort-Object { [string]$_["pmCode"] })
# самый свежий отчёт проекта — по списку отчётов (в том числе ещё не перенесённых синхронизацией), а не по карточке
$lastRep = @{}
foreach ($x in (Get-PnPListItem -List "Lists/StatusReports" -PageSize 500 -Fields "srProject","srDate" | Where-Object { [string]$_.FileSystemObjectType -ne "Folder" })) {
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
    # решение — записью «Погодження звітів» (синхронизация применяет отчёт только по решению; автор — приложение скрипта)
    if (Get-PnPList -Identity "Lists/ReportApprovals" -ErrorAction SilentlyContinue) {
        Add-PnPListItem -List "Lists/ReportApprovals" -Values @{ Title = "Демо"; apReport = $r.Id; apProject = $it.Id; apDecision = "Погоджено"
            apNote = "Демонстраційні дані"; apApplied = $true } | Out-Null
    }
    $added++
    Write-Host ("  + {0}: звіт від {1:dd.MM.yyyy}, {2}, {3}%" -f $code, $date, $sched, $prog) -ForegroundColor Green
}

# просроченные открытые риски демо-проектов — новый срок через 1–4 недели
$ids = @{}; foreach ($it in $items) { $ids[$it.Id] = [string]$it["pmCode"] }
$moved = 0; $k = 0
foreach ($ri in (Get-PnPListItem -List "Lists/RisksIssues" -PageSize 500 | Where-Object { [string]$_.FileSystemObjectType -ne "Folder" })) {
    $lk = $ri["riProject"]; if (-not $lk -or -not $ids.ContainsKey($lk.LookupId)) { continue }
    $due = DateOnly $ri["riDue"]
    if ($ri["riStatus"] -eq "Закрито" -or -not $due -or $due -ge $today) { continue }
    $k++; $nd = $today.AddDays(7 * (1 + ($k % 4)))
    Set-PnPListItem -List "Lists/RisksIssues" -Identity $ri.Id -Values @{ riDue = (SpDate $nd) } -UpdateType SystemUpdate | Out-Null
    $moved++
    Write-Host ("  ~ {0}: ризик «{1}» — термін {2:dd.MM.yyyy}" -f $ids[$lk.LookupId], $ri["Title"], $nd)
}
# «Команда проєкту» и «Посилання»: у каждого демо-проекта — несколько записей (идемпотентно: добавляются только недостающие)
$ROLES = @(
    @("Бізнес-замовник", "Цілі, пріоритети, бюджет"),
    @("Ключовий користувач", "Вимоги, тестування, навчання"),
    @("Архітектор", "Інтеграції, дані, безпека"),
    @("Фінансовий контролер", "Витрати, акти, закриття етапів"))
$LINKSET = @(
    @("Loop", "https://loop.cloud.microsoft/demo/{0}"),
    @("Технічне завдання", "https://example.com/pmo-demo/{0}/tz"),
    @("План-графік", "https://example.com/pmo-demo/{0}/plan"),
    @("Протокол установчої зустрічі", "https://example.com/pmo-demo/{0}/kickoff"))
$teamRows = @(Get-PnPListItem -List "Lists/ProjectTeam" -PageSize 500 | Where-Object { [string]$_.FileSystemObjectType -ne "Folder" })
$tAdded = 0; $lAdded = 0
foreach ($it in (Get-PnPListItem -List "Lists/Projects" -PageSize 500 | Where-Object { $Demo -contains [string]$_["pmCode"] })) {
    $code = [string]$it["pmCode"]
    $rows = @($teamRows | Where-Object { $_["tmProject"] -and $_["tmProject"].LookupId -eq $it.Id })
    $inTeam = @($rows | Where-Object { $_["tmUser"] } | ForEach-Object { ([string]$_["tmUser"].Email).ToLowerInvariant() })
    $pm = if ($it["pmManager"]) { ([string]$it["pmManager"].Email).ToLowerInvariant() } else { "" }
    $own = if ($it["pmOwner"]) { ([string]$it["pmOwner"].Email).ToLowerInvariant() } else { "" }
    # власник уже в карточке отдельно — в команде его не дублируем: строку демо-роли переводим на свободного человека
    foreach ($r in @($rows | Where-Object { $_["tmUser"] -and $_["tmRole"] -ne "Стейкхолдер" -and ([string]$_["tmUser"].Email).ToLowerInvariant() -eq $own })) {
        $free = @($People | ForEach-Object { $_.ToLowerInvariant() } | Where-Object { $_ -ne $pm -and $_ -ne $own -and $inTeam -notcontains $_ })[0]
        if (-not $free) { continue }
        Set-PnPListItem -List "Lists/ProjectTeam" -Identity $r.Id -Values @{ tmUser = $free } -UpdateType SystemUpdate | Out-Null
        $inTeam = @($inTeam | Where-Object { $_ -ne $own }) + $free
        Write-Host ("  ~ {0}: {1} — замість власника" -f $code, $r["tmRole"])
    }
    $usedRoles = @($rows | ForEach-Object { [string]$_["tmRole"] })
    $k = 0
    foreach ($e in $People) {
        if ($rows.Count + $k -ge $TeamSize) { break }
        $e = $e.ToLowerInvariant(); if ($e -eq $pm -or $e -eq $own -or $inTeam -contains $e) { continue }
        $role = @($ROLES | Where-Object { $usedRoles -notcontains $_[0] })[0]; if (-not $role) { $role = $ROLES[$k % $ROLES.Count] }
        Add-PnPListItem -List "Lists/ProjectTeam" -Values @{ tmProject = $it.Id; tmUser = $e; tmRole = $role[0]; tmTopics = $role[1] } | Out-Null
        $usedRoles += $role[0]; $k++; $tAdded++
        Write-Host ("  + {0}: команда — {1}" -f $code, $role[0])
    }
    # ссылки: pmLinks — JSON [{t,u}]; добавляем недостающие по названию
    $links = @(); try { if ([string]$it["pmLinks"]) { $links = @([string]$it["pmLinks"] | ConvertFrom-Json) } } catch { $links = @() }
    $titles = @($links | ForEach-Object { [string]$_.t })
    $before = $links.Count
    foreach ($l in $LINKSET) {
        if ($links.Count -ge $LinkCount) { break }
        if ($titles -contains $l[0]) { continue }
        $links += [pscustomobject]@{ t = $l[0]; u = ($l[1] -f $code.ToLowerInvariant()) }
    }
    if ($links.Count -ne $before) {
        $json = ConvertTo-Json -InputObject @($links | ForEach-Object { [ordered]@{ t = [string]$_.t; u = [string]$_.u } }) -Compress
        Set-PnPListItem -List "Lists/Projects" -Identity $it.Id -Values @{ pmLinks = $json } -UpdateType SystemUpdate | Out-Null
        $lAdded += $links.Count - $before
        Write-Host ("  + {0}: посилань {1}" -f $code, $links.Count)
    }
}
Write-Host ("Команда: +{0} записів, посилання: +{1}." -f $tAdded, $lAdded)
Write-Host ("Готово: свіжих звітів {0}, перенесених термінів ризиків {1}. Далі — Invoke-Env.ps1 -Env test -Action sync." -f $added, $moved) -ForegroundColor Green
