#Requires -Version 7.2
#Requires -Modules Az.Accounts
<#
.SYNOPSIS
    Публикация runbook в Azure Automation (среда выполнения PowerShell 7.6 + PnP.PowerShell из New-PMOAutomation.ps1).

.DESCRIPTION
    PMO-Sync — runbooks/Invoke-PMOSync.ps1 (собирается scripts/Build-Runbook.ps1; перед публикацией сверяется с исходниками).
    Тот же файл публикуется под двумя именами: -Env test -> PMO-Sync-Test (расписания тестового сайта; можно из ветки),
    -Env prod -> PMO-Sync (расписания прода; только из ветки main без незакоммиченных изменений, совпадающей с origin/main).
    PMO-WhoAmI — runbooks/PMO-WhoAmI.ps1 (проверка прав управляемой учётной записи, этап 3).
    Подробный журнал (поток Verbose) включён: в средах PowerShell 7.x Write-Host в журнал задания не попадает, журнал
    синхронизации в Azure пишется в Verbose. Создаёт или обновляет runbook, загружает черновик, публикует и сверяет опубликованный текст с локальным файлом.
    Вход в Azure выполняет человек заранее (Connect-AzAccount ... -UseDeviceAuthentication).
#>
param(
    [ValidateSet("PMO-Sync", "PMO-WhoAmI")][string]$Name = "PMO-Sync",
    [ValidateSet("test", "prod")][string]$Env,
    [string]$ResourceGroup = "rg-pmo-automation",
    [string]$Account = "aa-pmo-sync",
    [string]$RuntimeName = "PowerShell-7.6-PnP"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$API = "2023-05-15-preview"
$file = if ($Name -eq "PMO-Sync") { Join-Path $root "runbooks/Invoke-PMOSync.ps1" } else { Join-Path $root "runbooks/PMO-WhoAmI.ps1" }
$text = Get-Content -Raw $file
$target = $Name
if ($Name -eq "PMO-Sync") {
    if (-not $Env) { throw "Укажите -Env test (runbook PMO-Sync-Test, тестовый сайт) или -Env prod (PMO-Sync, прод — только при выпуске из main)." }
    if ($Env -eq "test") { $target = "PMO-Sync-Test" }
    else {
        # прод: опубликованный код = код main, который прошёл ревью
        # git — внешняя команда: $ErrorActionPreference её не останавливает, проверяем код возврата каждой
        function Git([string[]]$a) { $o = & git -C $root @a; if ($LASTEXITCODE) { throw "PMO-Sync (прод): git $($a -join ' ') — ошибка $LASTEXITCODE" }; return "$o".Trim() }
        $branch = Git rev-parse, --abbrev-ref, HEAD
        if ($branch -ne "main") { throw "PMO-Sync (прод) публикуется только из ветки main, сейчас: $branch" }
        if (Git status, --porcelain, --untracked-files=no) { throw "PMO-Sync (прод): есть незакоммиченные изменения" }
        Git fetch, -q, origin, main | Out-Null
        if ((Git rev-parse, HEAD) -ne (Git rev-parse, origin/main)) { throw "PMO-Sync (прод): локальный main не совпадает с origin/main — сначала git pull / git push" }
    }
}
if ($Name -eq "PMO-Sync" -and $text -ne (& (Join-Path $PSScriptRoot "Build-Runbook.ps1") -PassThru)) {
    throw "runbooks/Invoke-PMOSync.ps1 не совпадает с исходниками — запустите scripts/Build-Runbook.ps1 и закоммитьте"
}
$ctx = Get-AzContext
if (-not $ctx) { throw "Сначала вход в Azure: Connect-AzAccount -Tenant <tenant> -Subscription <sub> -UseDeviceAuthentication" }
$base = "/subscriptions/$($ctx.Subscription.Id)/resourceGroups/$ResourceGroup/providers/Microsoft.Automation/automationAccounts/$Account"
function Rest([string]$method, [string]$path, [string]$payload) {
    $p = @{ Method = $method; Path = "$base$path`?api-version=$API" }
    if ($payload) { $p.Payload = $payload }
    $r = Invoke-AzRestMethod @p
    if ($r.StatusCode -ge 400) { throw "$method $path -> $($r.StatusCode): $($r.Content)" }
    return $r
}
$loc = (Get-AzResource -ResourceGroupName $ResourceGroup -ResourceType Microsoft.Automation/automationAccounts -Name $Account).Location
$desc = (@($text -split "`n")[0]).TrimStart("#", " ")
Rest PUT "/runbooks/$target" (@{ location = $loc; properties = @{ runbookType = "PowerShell"; runtimeEnvironment = $RuntimeName; logVerbose = $true; logProgress = $false; description = $desc } } | ConvertTo-Json -Depth 4 -Compress) | Out-Null
Rest PUT "/runbooks/$target/draft/content" $text | Out-Null
$pub = Rest POST "/runbooks/$target/publish" ""
# публикация асинхронная — ждём и сверяем опубликованный текст
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 5
    $r = Invoke-AzRestMethod -Method GET -Path "$base/runbooks/$target/content?api-version=$API"
    if ($r.StatusCode -eq 200 -and $r.Content.Trim() -eq $text.Trim()) { break }
}
if ($r.StatusCode -ne 200 -or $r.Content.Trim() -ne $text.Trim()) { throw "Опубликованный $target не совпадает с $file (код $($r.StatusCode), публикация $($pub.StatusCode))" }
Write-Host "Опубликовано: $target ($RuntimeName) — $desc" -ForegroundColor Green
