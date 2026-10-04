#Requires -Version 7.2
<#
.SYNOPSIS  Проверки без доступа к SharePoint: синтаксис всех скриптов, валидность JSON,
           формула общего состояния, синтаксис JS прототипа.
           Запускается локально, Claude Code и в CI.
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$fail = 0
function Ok($m) { Write-Host "  ok   $m" -ForegroundColor Green }
function Bad($m) { Write-Host "  FAIL $m" -ForegroundColor Red; $script:fail++ }

Write-Host "1. Синтаксис PowerShell"
foreach ($f in Get-ChildItem (Join-Path $root "scripts"), (Join-Path $root "tests") -Filter *.ps1) {
    $t = $null; $e = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$t, [ref]$e)
    if ($e.Count) { $e | ForEach-Object { Bad "$($f.Name):$($_.Extent.StartLineNumber) $($_.Message)" } } else { Ok $f.Name }
}

Write-Host "1a. Имена переменных, отличающиеся только регистром (в PowerShell это одна переменная)"
foreach ($f in Get-ChildItem (Join-Path $root "scripts"), (Join-Path $root "tests") -Filter *.ps1) {
    $t = $null; $e = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$t, [ref]$e)
    $vars = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.VariableExpressionAst] }, $true) |
        Where-Object { -not $_.VariablePath.IsDriveQualified } | ForEach-Object { $_.VariablePath.UserPath -replace '^(script|global|local):', '' } | Sort-Object -Unique -CaseSensitive
    $clash = $vars | Group-Object { $_.ToLowerInvariant() } | Where-Object { @($_.Group | Sort-Object -Unique -CaseSensitive).Count -gt 1 }
    if ($clash) { Bad "$($f.Name): $(($clash | ForEach-Object { $_.Group -join '/' }) -join ', ')" } else { Ok $f.Name }
}

Write-Host "1b. «Висящие» else / elseif (без if перед ними PowerShell считает их командой и падает при запуске)"
foreach ($f in Get-ChildItem (Join-Path $root "scripts"), (Join-Path $root "tests") -Filter *.ps1) {
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$null, [ref]$null)
    $bad = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.CommandAst] -and $args[0].GetCommandName() -in @("else", "elseif") }, $true)
    if ($bad) { $bad | ForEach-Object { Bad "$($f.Name):$($_.Extent.StartLineNumber) висящий $($_.GetCommandName())" } } else { Ok $f.Name }
}

Write-Host "2. JSON-файлы"
foreach ($f in @("config/environments.example.json", "tests/cases/rag.json", "tests/cases/dates.json", "tests/cases/card-edit.json", "tests/cases/acl.json", "tests/cases/approval.json", "tests/cases/folders.json", "tests/cases/state.json", "tests/cases/reports.json", "tests/cases/editlog.json", "tests/cases/lock.json", "tests/cases/cache.json", "tests/cases/report-form.json", "tests/cases/apply.json", "config/focus-group.example.json")) {
    try { $null = Get-Content -Raw (Join-Path $root $f) | ConvertFrom-Json; Ok $f } catch { Bad "$f $_" }
}

Write-Host "3. Прежнее оформление SharePoint убрано (интерфейс — приложение SPFx)"
$src = (Get-ChildItem (Join-Path $root "scripts") -Filter *.ps1 | ForEach-Object { Get-Content -Raw $_.FullName }) -join "`n"
# блок уборки на развёрнутых сайтах упоминает прежние объекты по имени — его не считаем
$src = [regex]::Replace($src, "(?s)#region legacy-cleanup.*?#endregion legacy-cleanup", "")
# цвета статусов отзывов (тестовый список «Відгуки») — единственное разрешённое оформление столбца
$src = [regex]::Replace($src, "(?s)#region feedback-format.*?#endregion feedback-format", "")
foreach ($w in @("CustomFormatter", "Build-Dashboard", "PortfolioStats", "Update-Stats", "Update-CardInfo", "pmCardInfo", "ChartsOnly")) {
    if ($src -match [regex]::Escape($w)) { Bad "scripts/*.ps1 содержит «$w»" } else { Ok "нет «$w»" }
}

Write-Host "3a. Права и «Доступ до картки» (Get-Access, tests/cases/acl.json)"
# функции синхронизации и общие (scripts/PMO.Common.ps1: даты, Norm, эталон)
$syncAst = [System.Management.Automation.Language.Parser]::ParseInput((Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")) + "`n" + (Get-Content -Raw (Join-Path $root "scripts/PMO.Common.ps1")), [ref]$null, [ref]$null)
$ga = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "Get-Access" }, $true) | Select-Object -First 1
Invoke-Expression $ga.Extent.Text
foreach ($c in (Get-Content -Raw (Join-Path $root "tests/cases/acl.json") | ConvertFrom-Json)) {
    $mgrs = $c.managers
    $chainFn = { param($e) $out = @(); $cur = $e; while ($cur -and $mgrs.$cur -and $out -notcontains $mgrs.$cur) { $cur = $mgrs.$cur; $out += $cur }; $out }.GetNewClosure()
    $res = Get-Access $c.pm $c.owner @($c.stakeholders) $chainFn $c.archived
    $got = ($res | ForEach-Object { "$($_.e) $($_.l) $($_.r)" }) -join "; "
    $exp = ($c.expect | ForEach-Object { $_ -join " " }) -join "; "
    if ($got -eq $exp) { Ok $c.name } else { Bad "$($c.name): $got — ожидалось $exp" }
}

Write-Host "3c. Папки проектов: роли, заморозка архива, перенос записей (tests/cases/folders.json)"
foreach ($n in @("Get-FolderName", "Test-RowPlacement", "Get-FolderRole", "Get-GroupFolderRole", "Get-AclMark", "Get-ArchPrefix", "Test-ArchiveFrozen", "Get-RowAction")) {
    $fn = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq $n }, $true) | Select-Object -First 1
    if ($fn) { Invoke-Expression $fn.Extent.Text } else { Bad "нет функции $n" }
}
$fc = Get-Content -Raw (Join-Path $root "tests/cases/folders.json") | ConvertFrom-Json
if ((Get-FolderName 12) -eq "P12") { Ok "папка проекта 12 — P12" } else { Bad "Get-FolderName 12 -> $(Get-FolderName 12)" }
foreach ($c in $fc.role) { $r = Get-FolderRole $c.list $c.level $c.archived $c.v2; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
foreach ($c in $fc.group) { $r = Get-GroupFolderRole $c.list $c.archived $c.v2; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
foreach ($c in $fc.frozen) { $r = Test-ArchiveFrozen $c.status $c.mark $c.ready $c.rebuild $c.prefix; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
foreach ($c in $fc.placement) { $r = Test-RowPlacement $c.dir $c.expected; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
foreach ($c in $fc.row) { $r = Get-RowAction $c.dir $c.expected $c.acl $c.ready; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): «$r», ожидалось «$($c.out)»" } }
$fnt = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -in @("Test-TeamRowAccepted", "Test-Trusted") }, $true)
foreach ($f in $fnt) { Invoke-Expression $f.Extent.Text }
foreach ($c in $fc.team) { $r = Test-TeamRowAccepted $c.inRoot $c.ready $c.author $c.pm @("own@x"); if ($r -eq $c.out) { Ok "команда: $($c.name)" } else { Bad "команда: $($c.name): $r" } }
if ((Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")) -match 'TEAM_REJECTED\[\$it\.Id\]\) \{ continue \}') { Ok "команда: отклонённая строка не переносится в папку" } else { Bad "команда: отклонённая строка переносится в папку (раздел 5)" }
foreach ($c in $fc.mark) { $r = Get-AclMark $c.hash $c.archived $c.v2; if ($r -eq $c.out) { Ok "отметка $($c.hash)/$($c.archived)/v2=$($c.v2) -> $r" } else { Bad "отметка: $r, ожидалось $($c.out)" } }
# все запросы CSOM синхронизации — с повтором при 429 (Invoke-PnPQuery -RetryCount), без голого ExecuteQuery()
if ((Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")) -match 'ExecuteQuery\(\)') { Bad "Invoke-PMOSync.ps1: ExecuteQuery() без повтора" } else { Ok "запросы CSOM — с повтором при 429" }
# дочерние списки читаются без папок (Get-ListRows), кроме «Проєкти» и отзывов
$raw = @([regex]::Matches((Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")), 'Get-PnPListItem -List (\S+)') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -notin @('$list', '$L_PROJ', '"Lists/FeedbackPublic"', '"Lists/Feedback"') })
if ($raw) { Bad "Get-PnPListItem без отбрасывания папок: $($raw -join ', ')" } else { Ok "дочерние списки — без папок" }

Write-Host "3c1. Блокировка запусков и время по Киеву (PMO.Common.ps1: Test-LockPlan, ConvertTo-Kyiv; tests/cases/lock.json)"
foreach ($n in @("ConvertFrom-JsonElement", "ConvertFrom-JsonText", "Test-LockPlan", "Test-LockOwner", "Read-ManagerCache", "Get-ManagerCacheJson", "Get-KyivZone", "ConvertTo-Kyiv")) {
    $fn = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq $n }, $true) | Select-Object -First 1
    if ($fn) { Invoke-Expression $fn.Extent.Text } else { Bad "нет функции $n" }
}
$lc = Get-Content -Raw (Join-Path $root "tests/cases/lock.json") | ConvertFrom-Json -DateKind String
$lockNow = [datetimeoffset]::Parse($lc.now, [cultureinfo]::InvariantCulture).UtcDateTime
foreach ($c in $lc.owner) { $r = Test-LockOwner $c.text $c.run; if ($r -eq [bool]$c.out) { Ok "владелец блокировки: $($c.name)" } else { Bad "владелец блокировки: $($c.name): $r" } }
if ((Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")) -match '(?s)function Update-SyncLock.*Test-LockOwner.*function Exit-SyncLock.*Test-LockOwner') { Ok "продление и снятие блокировки — через Test-LockOwner" } else { Bad "Update-SyncLock / Exit-SyncLock не проверяют владельца через Test-LockOwner" }
$cc = Get-Content -Raw (Join-Path $root "tests/cases/cache.json") | ConvertFrom-Json -DateKind String
$ccNow = [datetimeoffset]::Parse($cc.now, [cultureinfo]::InvariantCulture).UtcDateTime
foreach ($c in $cc.read) {
    $r = Read-ManagerCache $c.text $ccNow $cc.hours
    $got = if ($r) { "mgr=" + (($r.mgr.Keys | Sort-Object | ForEach-Object { "$_>$($r.mgr[$_])" }) -join ",") + ";people=" + (($r.people.Keys | Sort-Object | ForEach-Object { "$_>$($r.people[$_].n)|$($r.people[$_].j)" }) -join ",") + ";age=" + [math]::Round($r.age) } else { "-" }
    $exp = if ($c.out) { "mgr=" + (($c.out.mgr.PSObject.Properties | Sort-Object Name | ForEach-Object { "$($_.Name)>$($_.Value)" }) -join ",") + ";people=" + (($c.out.people.PSObject.Properties | Sort-Object Name | ForEach-Object { "$($_.Name)>$($_.Value)" }) -join ",") + ";age=" + $c.out.age } else { "-" }
    if ($got -eq $exp) { Ok "кэш: $($c.name)" } else { Bad "кэш: $($c.name): $got, ожидалось $exp" }
}
foreach ($c in $cc.write) {
    $mg = @{}; foreach ($pp in $c.mgr.PSObject.Properties) { $mg[$pp.Name] = [string]$pp.Value }
    $pe = @{}; foreach ($pp in $c.people.PSObject.Properties) { $pe[$pp.Name] = @{ n = $pp.Value.n; j = $pp.Value.j } }
    $fl = @{}; foreach ($x in @($c.fail)) { if ($x) { $fl[$x] = $true } }
    $r = Get-ManagerCacheJson $mg $pe $fl $c.cacheSaved $ccNow
    if ($r -eq $c.out) { Ok "кэш, запись: $($c.name)" } else { Bad "кэш, запись: $($c.name): $r" }
}
foreach ($c in $lc.plan) { $r = Test-LockPlan $c.text $lockNow; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
foreach ($c in $lc.kyiv) {
    $r = (ConvertTo-Kyiv ([datetimeoffset]::Parse($c.utc, [cultureinfo]::InvariantCulture).UtcDateTime)).ToString("yyyy-MM-dd HH:mm")
    if ($r -eq $c.out) { Ok "Киев: $($c.name)" } else { Bad "Киев: $($c.name): $r, ожидалось $($c.out)" }
}
# время, пришедшее как местное (Kind = Local), переводится так же, как то же мгновение в UTC
$utcT = [datetime]::SpecifyKind([datetime]'2026-07-01T21:30:00', [DateTimeKind]::Utc)
if ((ConvertTo-Kyiv $utcT.ToLocalTime()).ToString("yyyy-MM-dd HH:mm") -eq "2026-07-02 00:30") { Ok "Киев: местное время машины переводится через UTC" } else { Bad "Киев: местное время машины переведено неверно" }
# блокировка снимается в finally; сбой записи завершает запуск ошибкой (оповещение Azure Automation)
$syncRaw = Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")
if ($syncRaw -match '(?s)\ntry \{.*\} finally \{\s*if \(\$LOCK_HELD\) \{ Exit-SyncLock \}') { Ok "блокировка снимается в finally" } else { Bad "Invoke-PMOSync.ps1: нет try/finally вокруг тела с Exit-SyncLock" }
if ($syncRaw -match 'if \(\$stats\.errors\) \{ throw') { Ok "ошибки записи -> исключение в конце" } else { Bad "Invoke-PMOSync.ps1: нет исключения при stats.errors" }

$fn = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "Test-AppLogin" }, $true) | Select-Object -First 1
if ($fn) { Invoke-Expression $fn.Extent.Text } else { Bad "нет функции Test-AppLogin" }
foreach ($c in @(
    @{ l = "i:0i.t|00000003-0000-0ff1-ce00-000000000000|app@sharepoint"; out = $true; n = "«Програма SharePoint» (вход приложения) — приложение" }
    @{ l = "i:0i.t|ms.sp.ext|1b2c@faa553e4"; out = $true; n = "ms.sp.ext — приложение" }
    @{ l = "i:0#.f|membership|app@sharepoint.ua"; out = $false; n = "человек с похожим e-mail — не приложение" }
    @{ l = "SHAREPOINT\system"; out = $false; n = "системная учётная запись — не приложение" })) {
    if ((Test-AppLogin $c.l) -eq $c.out) { Ok $c.n } else { Bad "Test-AppLogin $($c.l)" }
}

# журнал синхронизации — только через Log (в Azure Automation Write-Host не сохраняется, Write-Output портит возвраты функций)
$syncAst2 = [System.Management.Automation.Language.Parser]::ParseInput((Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")), [ref]$null, [ref]$null)
$outCmds = $syncAst2.FindAll({ $args[0] -is [System.Management.Automation.Language.CommandAst] -and $args[0].GetCommandName() -in @("Write-Host", "Write-Output", "echo") }, $true)
$outside = @($outCmds | Where-Object { $fn = $_.Parent; while ($fn -and -not ($fn -is [System.Management.Automation.Language.FunctionDefinitionAst])) { $fn = $fn.Parent }; -not $fn -or $fn.Name -ne "Log" })
if (-not $outside.Count) { Ok "синхронизация пишет журнал только через Log" } else { Bad "Write-Host / Write-Output вне Log: строки $(@($outside | ForEach-Object { $_.Extent.StartLineNumber }) -join ', ')" }
# #9 расписание: каждые 15 минут круглые сутки (Mac -AllDay: 96 слотов без 3:00 — пересчёт прав; Azure — 4 часовых со сдвигом + воскресенье)
$mac = Get-Content -Raw (Join-Path $root "scripts/Set-MacSchedule.ps1")
if ($mac -match 'foreach \(\$h in 0\.\.23\) \{ foreach \(\$m in 0, 15, 30, 45\)') { Ok "Mac: -AllDay — каждые 15 минут круглые сутки" } else { Bad "Set-MacSchedule.ps1: -AllDay не каждые 15 минут" }
$az = Get-Content -Raw (Join-Path $root "scripts/Set-AzureSchedule.ps1")
if ($az -match 'foreach \(\$m in 0, 15, 30, 45\)' -and $az -match '-HourInterval 1' -and $az -match '-WeekInterval 1 -DaysOfWeek Sunday') { Ok "Azure: 4 часовых расписания со сдвигом 15 минут и воскресный пересчёт" } else { Bad "Set-AzureSchedule.ps1: расписание не каждые 15 минут" }

Write-Host "3c2. Runbook Azure Automation (scripts/Build-Runbook.ps1 -> runbooks/Invoke-PMOSync.ps1)"
$rbPath = Join-Path $root "runbooks/Invoke-PMOSync.ps1"
if (-not (Test-Path $rbPath)) { Bad "нет runbooks/Invoke-PMOSync.ps1 — запустите scripts/Build-Runbook.ps1" }
else {
    $rb = Get-Content -Raw $rbPath
    $e = $null; [void][System.Management.Automation.Language.Parser]::ParseInput($rb, [ref]$null, [ref]$e)
    if ($e.Count) { Bad "runbook: синтаксис $($e[0].Message)" } else { Ok "runbook: синтаксис" }
    if ($rb -match 'PSScriptRoot') { Bad "runbook: есть `$PSScriptRoot (в Azure Automation его нет)" } else { Ok "runbook: без `$PSScriptRoot" }
    $fresh = & (Join-Path $root "scripts/Build-Runbook.ps1") -PassThru
    $strip = { param($t) ($t -replace '(?m)^# Собрано: .*\r?\n', '') }
    if ((& $strip $rb) -eq (& $strip $fresh)) { Ok "runbook совпадает с исходниками" } else { Bad "runbook устарел — запустите scripts/Build-Runbook.ps1" }
}

Write-Host "3d. Еталон ключових полів (scripts/PMO.Common.ps1, tests/cases/state.json)"
foreach ($n in @("ToSpDate", "ConvertFrom-JsonElement", "ConvertFrom-JsonText", "Get-StateKeys", "Compare-State", "ConvertTo-StateJson", "ConvertFrom-StateJson", "Get-StateWriteValue")) {
    $fn = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq $n }, $true) | Select-Object -First 1
    if ($fn) { Invoke-Expression $fn.Extent.Text } else { Bad "нет функции $n" }
}
$STATE_DATES = @("pmStart", "pmGoLive", "pmPlanEnd", "pmForecastEnd", "pmArchivedAt", "pmLastUpdate")
$sc = Get-Content -Raw (Join-Path $root "tests/cases/state.json") | ConvertFrom-Json -DateKind String
$toHash = { param($o) $h = [ordered]@{}; foreach ($k in Get-StateKeys) { $h[$k] = [string]$o.$k }; $h }
foreach ($c in $sc.compare) {
    $got = @((Compare-State (& $toHash $c.card) (& $toHash $c.state)) | ForEach-Object { $_.f }) -join ","
    if ($got -eq (@($c.diff) -join ",")) { Ok $c.name } else { Bad "$($c.name): $got, ожидалось $(@($c.diff) -join ',')" }
}
foreach ($c in $sc.write) { $r = Get-StateWriteValue $c.f $c.v; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
# JSON эталона: даты остаются «yyyy-MM-dd» после ConvertFrom-Json (который превращает ISO в DateTime)
$rt = ConvertFrom-StateJson (ConvertTo-StateJson (& $toHash $sc.compare[0].card))
if (-not (Compare-State $rt (& $toHash $sc.compare[0].card)).Count) { Ok "эталон: запись и чтение JSON без искажений (даты, числа, пустые)" } else { Bad "эталон: JSON искажает значения" }
# повреждённый или пустой эталон — «эталона нет» ($null), а не пустые значения для отката
# (векторы state.json -> parse — те же у parseState приложения)
foreach ($c in $sc.parse) { $ok = $null -ne (ConvertFrom-StateJson $c.json); if ($ok -eq [bool]$c.valid) { Ok "разбор эталона: $($c.name)" } else { Bad "разбор эталона: $($c.name): $ok" } }

Write-Host "3e. Правила отчётов: авто-возврат и применение (tests/cases/reports.json)"
foreach ($n in @("Test-Trusted", "Get-PendingReturns", "Get-ApplyAction", "CalcRag", "Get-ApprovalResult", "Get-EffectiveApproval", "Get-ReportTarget")) {
    $fn = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq $n }, $true) | Select-Object -First 1
    if ($fn) { Invoke-Expression $fn.Extent.Text } else { Bad "нет функции $n" }
}
$rc = Get-Content -Raw (Join-Path $root "tests/cases/reports.json") | ConvertFrom-Json -DateKind String
foreach ($c in $rc.returns) {
    $got = @((Get-PendingReturns @($c.pending) $c.pm @($c.owners) $c.archived) | ForEach-Object { $_.id }) -join ","
    if ($got -eq (@($c.returned) -join ",")) { Ok $c.name } else { Bad "$($c.name): [$got], ожидалось [$(@($c.returned) -join ',')]" }
}
foreach ($c in $rc.apply) {
    $got = Get-ApplyAction $c.rep $c.pm @($c.owners) $c.archived $c.last $c.lastUpdate
    if ($got -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $got, ожидалось $($c.out)" }
}
foreach ($c in $rc.effective) {
    $e = Get-EffectiveApproval $c.rep @($c.aps)
    $got = if ($e) { "$($e.id):$($e.decision)" } else { "-" }; $exp = if ($c.out) { "$($c.out.id):$($c.out.decision)" } else { "-" }
    if ($got -eq $exp) { Ok "действующее решение: $($c.name)" } else { Bad "действующее решение: $($c.name): $got, ожидалось $exp" }
}
$syncSrc = Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")
# «Створення» один раз (R8): нужна ли строка — и эталон пишется раньше строки журнала (ошибка сверки №3)
$fnc = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "Test-NeedCreation" }, $true) | Select-Object -First 1
if ($fnc) { Invoke-Expression $fnc.Extent.Text } else { Bad "нет функции Test-NeedCreation" }
foreach ($c in @(@{ a = ""; l = $true; s = $false; out = $true; n = "новый проект: без прав и без эталона — строка" }, @{ a = ""; l = $true; s = $true; out = $false; n = "эталон уже есть (сбой выдачи прав) — строки нет" },
                 @{ a = "v2:abc"; l = $true; s = $false; out = $false; n = "права уже выданы — строки нет" }, @{ a = ""; l = $false; s = $false; out = $true; n = "без списка эталона — по отметке прав" })) {
    if ((Test-NeedCreation $c.a $c.l $c.s) -eq $c.out) { Ok "«Створення»: $($c.n)" } else { Bad "«Створення»: $($c.n)" }
}
$blk = [regex]::Match($syncSrc, '(?s)if \(Test-NeedCreation .*?\n    \}')
if ($blk.Success -and $blk.Value.IndexOf('Save-ProjectState') -ge 0 -and $blk.Value.IndexOf('Save-ProjectState') -lt $blk.Value.IndexOf('Add-Change')) { Ok "«Створення»: эталон записывается раньше строки журнала" } else { Bad "«Створення»: строка журнала раньше эталона (задвоится при сбое)" }
# имя уровня прав «только добавление» одно и то же в развёртывании и синхронизации (иначе синхронизация тихо уйдёт на старую модель прав)
$depSrc = Get-Content -Raw (Join-Path $root "scripts/Deploy-PMO.ps1")
$roleDep = [regex]::Match($depSrc, '\$ROLE_ADD\s*=\s*"([^"]+)"').Groups[1].Value; $roleSync = [regex]::Match($syncSrc, '\$ROLE_ADD_NAME\s*=\s*"([^"]+)"').Groups[1].Value
if ($roleDep -and $roleDep -eq $roleSync) { Ok "уровень прав «$roleDep» — одинаковое имя в Deploy-PMO и Invoke-PMOSync" } else { Bad "имя уровня прав: Deploy-PMO «$roleDep», Invoke-PMOSync «$roleSync»" }
# решение по эталону: принять / откатить / заново (tests/cases/state.json -> plan)
$fnp = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "Get-StatePlan" }, $true) | Select-Object -First 1
if ($fnp) { Invoke-Expression $fnp.Extent.Text } else { Bad "нет функции Get-StatePlan" }
$scp = Get-Content -Raw (Join-Path $root "tests/cases/state.json") | ConvertFrom-Json -DateKind String
$toH = { param($o) if ($null -eq $o) { return $null }; $h = [ordered]@{}; foreach ($k in Get-StateKeys) { $h[$k] = [string]$o.$k }; $h }
foreach ($c in $scp.plan) {
    $exp = "$($c.out):$(@($c.fields) -join ',')"
    try { $pl = Get-StatePlan (& $toH $c.card) (& $toH $c.state) ([bool]$c.record) $c.editor @($c.owners); $got = "$($pl.action):$(@($pl.diff | ForEach-Object { $_.f }) -join ',')" }
    catch { $got = "исключение: $($_.Exception.Message)" }
    if ($got -eq $exp) { Ok "эталон: $($c.name)" } else { Bad "эталон: $($c.name): $got, ожидалось $exp" }
}
# перенос отчёта в карточку (tests/cases/apply.json — те же векторы у reportTarget приложения)
foreach ($c in (Get-Content -Raw (Join-Path $root "tests/cases/apply.json") | ConvertFrom-Json -DateKind String).cases) {
    $rep = @{}; foreach ($pp in $c.rep.PSObject.Properties) { $rep[$pp.Name] = $pp.Value }
    $t = Get-ReportTarget $rep $c.lastUpdate
    $got = ($t.Keys | Sort-Object | ForEach-Object { "$_=$($t[$_])" }) -join "; "
    $exp = ($c.out.PSObject.Properties | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join "; "
    if ($got -eq $exp) { Ok "перенос в карточку: $($c.name)" } else { Bad "перенос в карточку: $($c.name): [$got], ожидалось [$exp]" }
}
if ($syncSrc -match '\$plan = Get-StatePlan \$card') { Ok "раздел 0a решает по эталону общим правилом Get-StatePlan" } else { Bad "Invoke-PMOSync.ps1: раздел 0a не использует Get-StatePlan" }
if ($syncSrc -match '\$tg = Get-ReportTarget') { Ok "раздел 1 переносит отчёт общим правилом Get-ReportTarget" } else { Bad "Invoke-PMOSync.ps1: раздел 1 не использует Get-ReportTarget" }
# подтверждение «Погоджено» в синхронизации — именно этим правилом (а не «любое Погоджено от PMO»: ошибка сверки №1)
if ($syncSrc -match '\$eff = Get-EffectiveApproval' -and $syncSrc -match 'if \(\$eff -and \$eff\.decision -eq "Погоджено"\) \{ \$APPROVED\[\$rid\] = \$true \}' -and ([regex]::Matches($syncSrc, '\$APPROVED\[[^\]]+\] = \$true')).Count -eq 1) {
    Ok "«Погоджено» подтверждается только действующим решением (Get-EffectiveApproval)" } else { Bad 'Invoke-PMOSync.ps1: $APPROVED заполняется не через Get-EffectiveApproval' }

Write-Host "3f. Журнал правок карточки без потерь и дублей (tests/cases/editlog.json)"
foreach ($n in @("ConvertFrom-JsonElement", "ConvertFrom-JsonText", "EditLogRows", "Get-EditLogKey", "Get-EditLogPlan", "Remove-EditLogEntries")) {
    $fn = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq $n }, $true) | Select-Object -First 1
    if ($fn) { Invoke-Expression $fn.Extent.Text } else { Bad "нет функции $n" }
}
$ec = Get-Content -Raw (Join-Path $root "tests/cases/editlog.json") | ConvertFrom-Json -DateKind String
foreach ($c in $ec.plan) {
    $pl = Get-EditLogPlan $c.log @($c.done)
    $got = "$(@($pl.keys) -join ',')|$(@($pl.rows | ForEach-Object { $_.field }) -join ',')"; $exp = "$(@($c.keys) -join ',')|$(@($c.fields) -join ',')"
    if ($got -eq $exp) { Ok $c.name } else { Bad "$($c.name): $got — ожидалось $exp" }
}
foreach ($c in $ec.remove) {
    $rest = Remove-EditLogEntries $c.log @($c.keys)
    $got = if ($rest -eq $c.log -and @($c.left) -contains "__same__") { "__same__" } elseif ($rest) { @(($rest | ConvertFrom-Json).entries | ForEach-Object { $_.id }) -join "," } else { "" }
    if ($got -eq (@($c.left) -join ",")) { Ok $c.name } else { Bad "$($c.name): [$got], ожидалось [$(@($c.left) -join ',')]" }
}

Write-Host "3b. Роли фокус-группы (Get-RolePlan, Seed-TestData.ps1)"
$seedAst = [System.Management.Automation.Language.Parser]::ParseInput((Get-Content -Raw (Join-Path $root "scripts/Seed-TestData.ps1")), [ref]$null, [ref]$null)
Invoke-Expression ($seedAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "Get-RolePlan" }, $true) | Select-Object -First 1).Extent.Text
$codes = 1..10 | ForEach-Object { "PRJ-{0:d3}" -f $_ }
foreach ($k in @(3, 5, 10, 13)) {
    $em = 1..$k | ForEach-Object { "u$_@c" }
    $plan = Get-RolePlan $em $codes
    $bad = @()
    foreach ($e in $em) {
        $isPm = @($plan.Values | Where-Object { $_.pm -eq $e }).Count; $isOwn = @($plan.Values | Where-Object { $_.owner -eq $e }).Count; $isSt = @($plan.Values | Where-Object { $_.st -contains $e }).Count
        if ($k -le 10 -and (-not $isPm -or -not $isOwn -or -not $isSt)) { $bad += $e }
        if ($k -gt 10 -and -not ($isPm + $isOwn + $isSt)) { $bad += $e }
    }
    foreach ($c in $codes) { $r = $plan[$c]; if ($r.pm -eq $r.owner -or $r.st -contains $r.pm -or $r.st -contains $r.owner) { $bad += $c } }
    if ($bad) { Bad "$k человек: $($bad -join ', ')" } else { Ok "$k человек — у каждого роль, PM ≠ власник ≠ стейкхолдер" }
}

Write-Host "4. Формула общего состояния (Invoke-PMOSync.ps1)"
$sync = (Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")) + "`n" + (Get-Content -Raw (Join-Path $root "scripts/PMO.Common.ps1"))
$ast = [System.Management.Automation.Language.Parser]::ParseInput($sync, [ref]$null, [ref]$null)
$fn = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "CalcRag" }, $true) | Select-Object -First 1
Invoke-Expression $fn.Extent.Text
# общие тест-векторы — их же проверяет Jest в spfx/test
$cases = Get-Content -Raw (Join-Path $root "tests/cases/rag.json") | ConvertFrom-Json
foreach ($c in $cases) { $r = CalcRag $c.s $c.b $c.r; if ($r -eq $c.out) { Ok "$($c.s)/$($c.b)/$($c.r) -> $r" } else { Bad "$($c.s)/$($c.b)/$($c.r) -> $r, ожидалось $($c.out)" } }

Write-Host "4c. Погодження статус-звітів (Get-ApprovalResult, tests/cases/approval.json)"
$fn = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "Get-ApprovalResult" }, $true) | Select-Object -First 1
Invoke-Expression $fn.Extent.Text
foreach ($c in (Get-Content -Raw (Join-Path $root "tests/cases/approval.json") | ConvertFrom-Json)) {
    $res = Get-ApprovalResult $c.report $c.approval
    $got = "$($res.valid)|$($res.decision)|$($res.s)|$($res.b)|$($res.r)|$($res.rag)|$($res.apply)|$(@($res.changed) -join ',')"
    $e = $c.expect; $exp = "$($e.valid)|$($e.decision)|$($e.s)|$($e.b)|$($e.r)|$($e.rag)|$($e.apply)|$(@($e.changed) -join ',')"
    if ($got -eq $exp) { Ok $c.name } else { Bad "$($c.name): $got — ожидалось $exp" }
}

Write-Host "4a. Даты «только дата» (Invoke-PMOSync.ps1: DateOnly / ToSpDate)"
foreach ($n in @("DateOnly", "ToSpDate")) {
    $fn = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq $n }, $true) | Select-Object -First 1
    Invoke-Expression $fn.Extent.Text
}
$dcases = Get-Content -Raw (Join-Path $root "tests/cases/dates.json") | ConvertFrom-Json
foreach ($c in $dcases) {
    $d = [datetime]::Parse($c.in, [cultureinfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal)
    $r = DateOnly $d; if ($r -eq $c.out) { Ok "$($c.note): $r" } else { Bad "$($c.note): $r, ожидалось $($c.out)" }
}
# ToSpDate -> DateOnly без сдвига
$r = DateOnly ([datetime]::Parse((ToSpDate "2026-03-05"), [cultureinfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal))
if ($r -eq "2026-03-05") { Ok "ToSpDate -> DateOnly: $r" } else { Bad "ToSpDate -> DateOnly: $r, ожидалось 2026-03-05" }

Write-Host "4b. Правки карточки из приложения -> журнал (Invoke-PMOSync.ps1: EditLogRows)"
$fn = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "EditLogRows" }, $true) | Select-Object -First 1
Invoke-Expression $fn.Extent.Text
foreach ($c in (Get-Content -Raw (Join-Path $root "tests/cases/card-edit.json") | ConvertFrom-Json)) {
    $got = @(EditLogRows $c.log) | ForEach-Object { "$($_.field)|$($_.from)|$($_.to)|$($_.who)|$($_.reason)|$($_.when)" }
    # ConvertFrom-Json превращает ISO-время ожидаемых строк в DateTime — возвращаем в ISO UTC, как EditLogRows
    $want = @($c.rows) | ForEach-Object { $w = if ($_.when -is [datetime]) { $_.when.ToUniversalTime().ToString("o") } else { $_.when }
        "$($_.field)|$($_.from)|$($_.to)|$($_.who)|$($_.reason)|$w" }
    if ((@($got) -join "`n") -eq (@($want) -join "`n")) { Ok $c.note } else { Bad "$($c.note): получено $(@($got) -join '; ')" }
}

Write-Host "5. Прототип"
$html = Get-Content -Raw (Join-Path $root "prototype/pmo-prototype.html")
$m = [regex]::Match($html, '(?s)<script>(.*)</script>')
if (-not $m.Success) { Bad "в прототипе нет <script>" }
elseif (Get-Command node -ErrorAction SilentlyContinue) {
    $tmp = Join-Path ([IO.Path]::GetTempPath()) "pmo-proto-check.js"
    Set-Content -Path $tmp -Value $m.Groups[1].Value -Encoding utf8
    & node --check $tmp; if ($LASTEXITCODE) { Bad "синтаксис JS прототипа" } else { Ok "JS прототипа" }
    Remove-Item $tmp
} else { Write-Host "  skip node не установлен — проверка JS прототипа пропущена" }

if ($fail) { Write-Host "`nОшибок: $fail" -ForegroundColor Red; exit 1 } else { Write-Host "`nВсе проверки пройдены" -ForegroundColor Green }
