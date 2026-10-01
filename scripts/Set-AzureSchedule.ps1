#Requires -Version 7.2
#Requires -Modules Az.Accounts, Az.Resources, Az.Automation
<#
.SYNOPSIS
    Расписания runbook PMO-Sync в Azure Automation и письмо при сбое задания (этапы 5–6 плана
    docs/superpowers/plans/2026-10-01-azure-automation.md).

.DESCRIPTION
    Azure Automation запускает расписание не чаще раза в час, поэтому «каждые 15 минут» — четыре часовых расписания
    со сдвигом :00 / :15 / :30 / :45; еженедельно, воскресенье 3:00 — полный пересчёт прав (-RebuildPermissions).
    Время — по Киеву (переход на летнее время учитывается). Идемпотентно: привязки пересоздаются с текущими параметрами.
    Без -Live — пробный режим (-DryRun: только чтение; рабочие запуски — с Mac). -Live — рабочий режим (Mac-расписание
    перед этим снять: Set-MacSchedule.ps1 -Env <env> -Remove). -Disable — выключить расписания (откат на Mac).
    Оповещение: группа действий с письмом на -AlertEmail и правило по метрике TotalJob (Status = Failed), без Log Analytics.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][ValidateSet("test", "prod")][string]$Env,
    [string]$AlertEmail,
    [switch]$Live,
    [switch]$Disable,
    [string]$ResourceGroup = "rg-pmo-automation",
    [string]$Account = "aa-pmo-sync",
    [string]$Runbook = "PMO-Sync"
)
$ErrorActionPreference = "Stop"
$a = @{ ResourceGroupName = $ResourceGroup; AutomationAccountName = $Account }
$TZ = "Europe/Kiev"
$kyiv = [TimeZoneInfo]::FindSystemTimeZoneById("Europe/Kyiv")
$nowK = [TimeZoneInfo]::ConvertTimeFromUtc((Get-Date).ToUniversalTime(), $kyiv)

$base = @{ SiteUrl = $SiteUrl; ManagedIdentity = $true; ManagerCacheVariable = "pmo-managers-$Env" }
if (-not $Live) { $base.DryRun = $true }
$plan = @(
    foreach ($m in 0, 15, 30, 45) { @{ name = "pmo-$Env-sync-{0:d2}" -f $m; hourly = $true; minute = $m; params = $base.Clone() } }
    @{ name = "pmo-$Env-rebuild-sun-0300"; hourly = $false; minute = 0; params = ($base.Clone() + @{ RebuildPermissions = $true }) }
)
foreach ($s in $plan) {
    $sch = Get-AzAutomationSchedule @a -Name $s.name -ErrorAction SilentlyContinue
    if (-not $sch) {
        # первый запуск — не раньше чем через 10 минут (требование Azure — 5 минут)
        $start = $nowK.Date.AddHours($nowK.Hour).AddMinutes($s.minute)
        while ($start -lt $nowK.AddMinutes(10)) { $start = $start.AddHours(1) }
        if (-not $s.hourly) { $start = $nowK.Date.AddHours(3); while ($start.DayOfWeek -ne "Sunday" -or $start -lt $nowK.AddMinutes(10)) { $start = $start.AddDays(1) } }
        $p = @{ Name = $s.name; StartTime = [DateTimeOffset]::new($start, $kyiv.GetUtcOffset($start)); TimeZone = $TZ; Description = "Синхронизация портала PMO ($Env)" }
        $sch = if ($s.hourly) { New-AzAutomationSchedule @a @p -HourInterval 1 } else { New-AzAutomationSchedule @a @p -WeekInterval 1 -DaysOfWeek Sunday }
        Write-Host "+ расписание $($s.name), первый запуск $($start.ToString('dd.MM HH:mm')) (Киев)" -ForegroundColor Green
    }
    Set-AzAutomationSchedule @a -Name $s.name -IsEnabled (-not $Disable) | Out-Null
    # привязка с параметрами: пересоздаём, чтобы параметры (пробный / рабочий режим) были текущими
    Get-AzAutomationScheduledRunbook @a -RunbookName $Runbook -ScheduleName $s.name -ErrorAction SilentlyContinue |
        ForEach-Object { Unregister-AzAutomationScheduledRunbook @a -JobScheduleId $_.JobScheduleId -Force }
    Register-AzAutomationScheduledRunbook @a -RunbookName $Runbook -ScheduleName $s.name -Parameters $s.params | Out-Null
}
$mode = if ($Disable) { "выключены" } elseif ($Live) { "РАБОЧИЙ режим" } else { "пробный режим (-DryRun)" }
Write-Host "Расписания $Runbook ($Env): $mode" -ForegroundColor Cyan

if ($AlertEmail) {
    $ctx = Get-AzContext
    $rg = "/subscriptions/$($ctx.Subscription.Id)/resourceGroups/$ResourceGroup"
    function Rest([string]$method, [string]$path, [string]$api, $body) {
        $r = Invoke-AzRestMethod -Method $method -Path "$path`?api-version=$api" -Payload ($body | ConvertTo-Json -Depth 10 -Compress)
        if ($r.StatusCode -ge 400) { throw "$method $path -> $($r.StatusCode): $($r.Content)" }
    }
    if (-not (Get-AzResourceProvider -ProviderNamespace Microsoft.Insights | Where-Object RegistrationState -eq "Registered")) {
        Register-AzResourceProvider -ProviderNamespace Microsoft.Insights | Out-Null
        while ((Get-AzResourceProvider -ProviderNamespace Microsoft.Insights)[0].RegistrationState -ne "Registered") { Start-Sleep 10 }
    }
    $ag = "$rg/providers/Microsoft.Insights/actionGroups/ag-pmo-sync"
    Rest PUT $ag "2023-01-01" @{ location = "Global"; properties = @{ groupShortName = "pmo-sync"; enabled = $true
        emailReceivers = @(@{ name = "owner"; emailAddress = $AlertEmail; useCommonAlertSchema = $true }) } }
    Rest PUT "$rg/providers/Microsoft.Insights/metricAlerts/pmo-sync-job-failed" "2018-03-01" @{ location = "global"; properties = @{
        description = "Задание синхронизации портала PMO завершилось ошибкой"; severity = 2; enabled = $true
        scopes = @("$rg/providers/Microsoft.Automation/automationAccounts/$Account"); evaluationFrequency = "PT15M"; windowSize = "PT30M"
        criteria = @{ "odata.type" = "Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria"; allOf = @(@{
            criterionType = "StaticThresholdCriterion"; name = "failed"; metricName = "TotalJob"; metricNamespace = "Microsoft.Automation/automationAccounts"
            operator = "GreaterThan"; threshold = 0; timeAggregation = "Total"
            dimensions = @(@{ name = "Status"; operator = "Include"; values = @("Failed") }, @{ name = "Runbook"; operator = "Include"; values = @($Runbook) }) }) }
        autoMitigate = $true; actions = @(@{ actionGroupId = $ag }) } }
    Write-Host "Оповещение: задание $Runbook «Failed» -> письмо на $AlertEmail (проверка раз в 15 мин)" -ForegroundColor Cyan
}
