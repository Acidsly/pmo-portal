#Requires -Version 7.2
<#
.SYNOPSIS
    Сборка runbook Azure Automation: scripts/Invoke-PMOSync.ps1 + scripts/PMO.Common.ps1 -> runbooks/Invoke-PMOSync.ps1.

.DESCRIPTION
    В Azure Automation runbook — один файл, $PSScriptRoot там нет: строка подключения PMO.Common.ps1 заменяется его содержимым.
    #Requires, справка и param() синхронизации остаются в начале файла. Первая строка — отпечаток исходников (sha256).
    Собранный файл в репозитории; tests/Test-Scripts.ps1 проверяет, что он совпадает с исходниками (кроме строки коммита).
    Публикация в Azure — scripts/Publish-Runbook.ps1.

.PARAMETER PassThru  вернуть текст, не записывая файл (проверка в Test-Scripts.ps1)
#>
param([switch]$PassThru)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sync = Get-Content -Raw (Join-Path $root "scripts/Invoke-PMOSync.ps1")
$common = Get-Content -Raw (Join-Path $root "scripts/PMO.Common.ps1")
$include = '. (Join-Path $PSScriptRoot "PMO.Common.ps1")'
$at = $sync.IndexOf($include)
if ($at -lt 0 -or $sync.IndexOf($include, $at + 1) -ge 0) { throw "В Invoke-PMOSync.ps1 должна быть ровно одна строка подключения: $include" }
$body = $sync.Substring(0, $at) + "# --- scripts/PMO.Common.ps1 ---`n" + $common.TrimEnd() + "`n# --- конец PMO.Common.ps1 ---" + $sync.Substring($at + $include.Length)
if ($body -match 'PSScriptRoot') { throw "В собранном runbook остался `$PSScriptRoot" }

# отпечаток исходников (а не коммит: коммит меняется, когда в него попадает сам runbook) — Publish-Runbook.ps1 показывает,
# какая версия опубликована; совпадение с исходниками проверяет Test-Scripts.ps1
$hash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($body))).Substring(0, 12).ToLowerInvariant()
$banner = "# Собрано: scripts/Build-Runbook.ps1, исходники sha256:$hash — не править, правьте scripts/"
$text = $banner + "`n" + $body
if ($PassThru) { return $text }

$out = Join-Path $root "runbooks/Invoke-PMOSync.ps1"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $out) | Out-Null
[IO.File]::WriteAllText($out, $text, [Text.UTF8Encoding]::new($false))
$e = $null; [void][System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$null, [ref]$e)
if ($e.Count) { throw "Синтаксис собранного runbook: $($e[0].Message) (строка $($e[0].Extent.StartLineNumber))" }
Write-Host "Собрано: $out ($([math]::Round($text.Length / 1KB)) КБ), $banner" -ForegroundColor Green
