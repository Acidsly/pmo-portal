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
foreach ($f in @("config/environments.example.json", "tests/cases/rag.json", "tests/cases/dates.json", "tests/cases/card-edit.json", "tests/cases/acl.json", "tests/cases/approval.json", "tests/cases/folders.json", "tests/cases/state.json", "config/focus-group.example.json")) {
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
foreach ($n in @("Get-FolderName", "Get-FolderRole", "Get-GroupFolderRole", "Get-AclMark", "Get-ArchPrefix", "Test-ArchiveFrozen", "Get-RowAction")) {
    $fn = $syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq $n }, $true) | Select-Object -First 1
    if ($fn) { Invoke-Expression $fn.Extent.Text } else { Bad "нет функции $n" }
}
$fc = Get-Content -Raw (Join-Path $root "tests/cases/folders.json") | ConvertFrom-Json
if ((Get-FolderName 12) -eq "P12") { Ok "папка проекта 12 — P12" } else { Bad "Get-FolderName 12 -> $(Get-FolderName 12)" }
foreach ($c in $fc.role) { $r = Get-FolderRole $c.list $c.level $c.archived $c.v2; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
foreach ($c in $fc.group) { $r = Get-GroupFolderRole $c.list $c.archived $c.v2; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
foreach ($c in $fc.frozen) { $r = Test-ArchiveFrozen $c.status $c.mark $c.ready $c.rebuild $c.prefix; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): $r, ожидалось $($c.out)" } }
foreach ($c in $fc.row) { $r = Get-RowAction $c.dir $c.expected $c.acl $c.ready; if ($r -eq $c.out) { Ok $c.name } else { Bad "$($c.name): «$r», ожидалось «$($c.out)»" } }
foreach ($c in $fc.mark) { $r = Get-AclMark $c.hash $c.archived $c.v2; if ($r -eq $c.out) { Ok "отметка $($c.hash)/$($c.archived)/v2=$($c.v2) -> $r" } else { Bad "отметка: $r, ожидалось $($c.out)" } }
# все запросы CSOM синхронизации — с повтором при 429 (Invoke-PnPQuery -RetryCount), без голого ExecuteQuery()
if ((Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")) -match 'ExecuteQuery\(\)') { Bad "Invoke-PMOSync.ps1: ExecuteQuery() без повтора" } else { Ok "запросы CSOM — с повтором при 429" }
# дочерние списки читаются без папок (Get-ListRows), кроме «Проєкти» и отзывов
$raw = @([regex]::Matches((Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")), 'Get-PnPListItem -List (\S+)') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -notin @('$list', '$L_PROJ', '"Lists/FeedbackPublic"', '"Lists/Feedback"') })
if ($raw) { Bad "Get-PnPListItem без отбрасывания папок: $($raw -join ', ')" } else { Ok "дочерние списки — без папок" }

Write-Host "3d. Еталон ключових полів (scripts/PMO.Common.ps1, tests/cases/state.json)"
foreach ($n in @("ToSpDate", "Get-StateKeys", "Compare-State", "ConvertTo-StateJson", "ConvertFrom-StateJson", "Get-StateWriteValue")) {
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
