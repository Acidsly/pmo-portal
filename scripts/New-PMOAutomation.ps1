#Requires -Version 7.2
#Requires -Modules Az.Accounts, Az.Resources, Az.Automation
<#
.SYNOPSIS
    Ресурсы Azure Automation для синхронизации портала (этап 2 плана docs/superpowers/plans/2026-10-01-azure-automation.md).

.DESCRIPTION
    Идемпотентно: повторный запуск ничего не дублирует.
      1. Группа ресурсов и учётная запись Automation с системной управляемой учётной записью (ролей Azure ей не выдаётся).
      2. Среда выполнения PowerShell 7.4 с пакетом PnP.PowerShell (из PowerShell Gallery; импорт 10–30 мин).
      3. Зашифрованная переменная кэша оргструктуры pmo-managers-<env>.
    Вход в Azure выполняет человек заранее: Connect-AzAccount -Tenant <tenant> -Subscription <sub> -UseDeviceAuthentication.
    Выводит Object ID и App ID управляемой учётной записи — они нужны для прав (этап 3).

.PARAMETER Wait  ждать окончания импорта PnP.PowerShell (иначе — проверить позже повторным запуском)
#>
param(
    [string]$ResourceGroup = "rg-pmo-automation",
    [string]$Account = "aa-pmo-sync",
    [string]$Location = "germanywestcentral",
    [string]$RuntimeName = "PowerShell-7.4-PnP",
    [string]$PnPVersion = "3.4.1",
    [string[]]$CacheEnvs = @("test"),
    [switch]$Wait
)
$ErrorActionPreference = "Stop"
$API = "2023-05-15-preview"
$ctx = Get-AzContext
if (-not $ctx) { throw "Сначала вход в Azure: Connect-AzAccount -Tenant <tenant> -Subscription <sub> -UseDeviceAuthentication" }
Write-Host "Подписка: $($ctx.Subscription.Name) ($($ctx.Subscription.Id)), тенант $($ctx.Tenant.Id)" -ForegroundColor Cyan

# 1. Группа ресурсов, учётная запись
if (-not (Get-AzResourceProvider -ProviderNamespace Microsoft.Automation | Where-Object RegistrationState -eq "Registered")) {
    Register-AzResourceProvider -ProviderNamespace Microsoft.Automation | Out-Null
    Write-Host "Регистрирую поставщик Microsoft.Automation…"
    while ((Get-AzResourceProvider -ProviderNamespace Microsoft.Automation)[0].RegistrationState -ne "Registered") { Start-Sleep 10 }
}
if (-not (Get-AzResourceGroup -Name $ResourceGroup -ErrorAction SilentlyContinue)) {
    New-AzResourceGroup -Name $ResourceGroup -Location $Location -Tag @{ app = "pmo-portal" } | Out-Null
    Write-Host "+ группа ресурсов $ResourceGroup ($Location)" -ForegroundColor Green
}
$aa = Get-AzAutomationAccount -ResourceGroupName $ResourceGroup -Name $Account -ErrorAction SilentlyContinue
if (-not $aa) {
    $aa = New-AzAutomationAccount -ResourceGroupName $ResourceGroup -Name $Account -Location $Location -Plan Basic -AssignSystemIdentity
    Write-Host "+ учётная запись Automation $Account" -ForegroundColor Green
} elseif (-not $aa.Identity -or $aa.Identity.Type -notmatch "SystemAssigned") {
    $aa = Set-AzAutomationAccount -ResourceGroupName $ResourceGroup -Name $Account -AssignSystemIdentity
    Write-Host "~ включена системная управляемая учётная запись" -ForegroundColor Green
}
$base = "/subscriptions/$($ctx.Subscription.Id)/resourceGroups/$ResourceGroup/providers/Microsoft.Automation/automationAccounts/$Account"
function Rest([string]$method, [string]$path, $body) {
    $p = @{ Method = $method; Path = "$base$path`?api-version=$API" }
    if ($null -ne $body) { $p.Payload = ($body | ConvertTo-Json -Depth 8 -Compress) }
    $r = Invoke-AzRestMethod @p
    if ($r.StatusCode -ge 400) { throw "$method $path -> $($r.StatusCode): $($r.Content)" }
    if ($r.Content) { return $r.Content | ConvertFrom-Json } return $null
}

# 2. Среда выполнения PowerShell 7.4 + PnP.PowerShell
$rt = try { Rest GET "/runtimeEnvironments/$RuntimeName" $null } catch { $null }
if (-not $rt) {
    Rest PUT "/runtimeEnvironments/$RuntimeName" @{ location = $Location; properties = @{ runtime = @{ language = "PowerShell"; version = "7.4" }; description = "Синхронизация портала PMO" } } | Out-Null
    Write-Host "+ среда выполнения $RuntimeName (PowerShell 7.4)" -ForegroundColor Green
}
# пакет — из списка: запрос по имени с точкой (PnP.PowerShell) отвечает 404
function Get-PnPPackage { return @((Rest GET "/runtimeEnvironments/$RuntimeName/packages" $null).value | Where-Object name -eq "PnP.PowerShell")[0] }
$pkg = Get-PnPPackage
$uri = "https://www.powershellgallery.com/api/v2/package/PnP.PowerShell/$PnPVersion"
# нет пакета, другая версия или прошлый импорт не удался — импорт заново
if (-not $pkg -or [string]$pkg.properties.version -ne $PnPVersion -or [string]$pkg.properties.provisioningState -eq "Failed") {
    Rest PUT "/runtimeEnvironments/$RuntimeName/packages/PnP.PowerShell" @{ properties = @{ contentLink = @{ uri = $uri } } } | Out-Null
    Write-Host "+ импорт PnP.PowerShell $PnPVersion начат" -ForegroundColor Green
}
do {
    $pkg = Get-PnPPackage
    $state = [string]$pkg.properties.provisioningState
    Write-Host ("  PnP.PowerShell: {0} {1}" -f $state, $pkg.properties.version)
    if ($state -eq "Failed") { throw "Импорт PnP.PowerShell не удался: $($pkg.properties.error | ConvertTo-Json -Compress) — план Б (другая версия 3.x)" }
    if ($Wait -and $state -ne "Succeeded") { Start-Sleep 60 }
} while ($Wait -and $state -ne "Succeeded")

# 3. Зашифрованные переменные кэша оргструктуры (значение пишет runbook)
foreach ($e in $CacheEnvs) {
    $n = "pmo-managers-$e"
    if (-not (Get-AzAutomationVariable -ResourceGroupName $ResourceGroup -AutomationAccountName $Account -Name $n -ErrorAction SilentlyContinue)) {
        New-AzAutomationVariable -ResourceGroupName $ResourceGroup -AutomationAccountName $Account -Name $n -Encrypted $true -Value "" -Description "Кэш оргструктуры Entra ID ($e)" | Out-Null
        Write-Host "+ переменная $n (зашифрованная)" -ForegroundColor Green
    }
}

$aa = Get-AzAutomationAccount -ResourceGroupName $ResourceGroup -Name $Account
$oid = $aa.Identity.PrincipalId
$sp = Get-AzADServicePrincipal -ObjectId $oid -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "Управляемая учётная запись: Object ID $oid, App ID $(if ($sp) { $sp.AppId } else { '(ещё не видна в Entra ID — повторите через минуту)' })" -ForegroundColor Cyan
Write-Host "Дальше — права (этап 3): scripts/Grant-PMOAutomation.ps1" -ForegroundColor Cyan
