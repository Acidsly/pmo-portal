#Requires -Version 7.2
<#
.SYNOPSIS  Проверки без доступа к SharePoint: синтаксис всех скриптов, валидность JSON,
           JSON форматирования столбцов, формула общего состояния, синтаксис JS прототипа.
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

Write-Host "2. JSON-файлы"
foreach ($f in @("scripts/gallery-view.json", "config/environments.example.json")) {
    try { $null = Get-Content -Raw (Join-Path $root $f) | ConvertFrom-Json; Ok $f } catch { Bad "$f $_" }
}

Write-Host "3. Форматирование столбцов в Deploy-PMO.ps1"
$src = Get-Content -Raw (Join-Path $root "scripts/Deploy-PMO.ps1")
$a = $src.IndexOf('$ragColor = '); $b = $src.IndexOf("@(`n    @(`$P,")
if ($a -lt 0 -or $b -lt 0) { Bad "не найден блок форматирования" } else {
    Invoke-Expression $src.Substring($a, $b - $a)
    foreach ($v in Get-Variable fmt*) { try { $null = $v.Value | ConvertFrom-Json; Ok $v.Name } catch { Bad "$($v.Name): $_" } }
}

Write-Host "4. Формула общего состояния (Invoke-PMOSync.ps1)"
$sync = Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")
$ast = [System.Management.Automation.Language.Parser]::ParseInput($sync, [ref]$null, [ref]$null)
$fn = $ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq "CalcRag" }, $true) | Select-Object -First 1
Invoke-Expression $fn.Extent.Text
$cases = @(
    @("Зелений","Зелений","Зелений","Зелений"), @("Жовтий","Зелений","Зелений","Жовтий"),
    @("Зелений","Червоний","Зелений","Червоний"), @("Жовтий","Червоний","Жовтий","Червоний"), @("Зелений","","Зелений","")
)
foreach ($c in $cases) { $r = CalcRag $c[0] $c[1] $c[2]; if ($r -eq $c[3]) { Ok "$($c[0])/$($c[1])/$($c[2]) -> $r" } else { Bad "$($c[0])/$($c[1])/$($c[2]) -> $r, ожидалось $($c[3])" } }

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
