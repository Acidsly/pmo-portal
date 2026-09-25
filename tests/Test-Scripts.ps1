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

Write-Host "2. JSON-файлы"
foreach ($f in @("config/environments.example.json", "tests/cases/rag.json", "tests/cases/dates.json", "tests/cases/card-edit.json")) {
    try { $null = Get-Content -Raw (Join-Path $root $f) | ConvertFrom-Json; Ok $f } catch { Bad "$f $_" }
}

Write-Host "3. Прежнее оформление SharePoint убрано (интерфейс — приложение SPFx)"
$src = (Get-ChildItem (Join-Path $root "scripts") -Filter *.ps1 | ForEach-Object { Get-Content -Raw $_.FullName }) -join "`n"
foreach ($w in @("CustomFormatter", "Build-Dashboard", "PortfolioStats", "Update-Stats", "Update-CardInfo", "pmCardInfo", "ChartsOnly")) {
    if ($src -match [regex]::Escape($w)) { Bad "scripts/*.ps1 содержит «$w»" } else { Ok "нет «$w»" }
}

Write-Host "4. Формула общего состояния (Invoke-PMOSync.ps1)"
$sync = Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")
$ast = [System.Management.Automation.Language.Parser]::ParseInput($sync, [ref]$null, [ref]$null)
$fn = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "CalcRag" }, $true) | Select-Object -First 1
Invoke-Expression $fn.Extent.Text
# общие тест-векторы — их же проверяет Jest в spfx/test
$cases = Get-Content -Raw (Join-Path $root "tests/cases/rag.json") | ConvertFrom-Json
foreach ($c in $cases) { $r = CalcRag $c.s $c.b $c.r; if ($r -eq $c.out) { Ok "$($c.s)/$($c.b)/$($c.r) -> $r" } else { Bad "$($c.s)/$($c.b)/$($c.r) -> $r, ожидалось $($c.out)" } }

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
