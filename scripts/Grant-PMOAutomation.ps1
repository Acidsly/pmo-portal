#Requires -Version 7.2
#Requires -Modules Az.Accounts, Az.Automation, PnP.PowerShell
<#
.SYNOPSIS
    Права управляемой учётной записи Azure Automation (этап 3 плана docs/superpowers/plans/2026-10-01-azure-automation.md).

.DESCRIPTION
    Выполняет человек с ролью глобального администратора (или администратора привилегированных ролей) после входа в Azure
    (Connect-AzAccount ... -UseDeviceAuthentication). Идемпотентно.
      1. Роли приложения сервисному субъекту управляемой учётной записи: SharePoint Sites.Selected, Graph User.Read.All
         (в портале Entra роли приложений управляемым учётным записям не назначаются — только Graph API).
      2. FullControl только на сайт портала: вход в SharePoint приложением PMO Deploy (браузер), как Register-PMOApps.ps1.
    Других сайтов тенанта управляемая учётная запись не видит (Sites.Selected).

.PARAMETER SiteUrl         https://contoso.sharepoint.com/sites/pmo-test
.PARAMETER DeployClientId  Client ID приложения PMO Deploy (config/environments.json, секция Deploy)
.PARAMETER SkipAppRoles    только выдать права на сайт (роли уже назначены — например, для прода)
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$DeployClientId,
    [string]$ResourceGroup = "rg-pmo-automation",
    [string]$Account = "aa-pmo-sync",
    [switch]$SkipAppRoles,
    [switch]$DeviceLogin
)
$ErrorActionPreference = "Stop"
$aa = Get-AzAutomationAccount -ResourceGroupName $ResourceGroup -Name $Account
$oid = $aa.Identity.PrincipalId
if (-not $oid) { throw "У $Account нет системной управляемой учётной записи — сначала New-PMOAutomation.ps1" }
$G = "https://graph.microsoft.com/v1.0"
function Graph([string]$method, [string]$path, $body) {
    $p = @{ Method = $method; Uri = "$G$path" }
    if ($null -ne $body) { $p.Payload = ($body | ConvertTo-Json -Depth 6 -Compress) }
    $r = Invoke-AzRestMethod @p
    if ($r.StatusCode -ge 400) { throw "$method $path -> $($r.StatusCode): $($r.Content)" }
    return $r.Content | ConvertFrom-Json
}
$mi = Graph GET "/servicePrincipals/$oid" $null
Write-Host "Управляемая учётная запись: $($mi.displayName), App ID $($mi.appId)" -ForegroundColor Cyan

if (-not $SkipAppRoles) {
    $have = @((Graph GET "/servicePrincipals/$oid/appRoleAssignments" $null).value)
    $want = @(
        @{ api = "00000003-0000-0ff1-ce00-000000000000"; role = "Sites.Selected" }   # Office 365 SharePoint Online
        @{ api = "00000003-0000-0000-c000-000000000000"; role = "User.Read.All" }    # Microsoft Graph
    )
    foreach ($w in $want) {
        $res = @((Graph GET "/servicePrincipals?`$filter=appId eq '$($w.api)'&`$select=id,displayName,appRoles" $null).value)[0]
        $ar = @($res.appRoles | Where-Object { $_.value -eq $w.role -and $_.allowedMemberTypes -contains "Application" })[0]
        if (-not $ar) { throw "У $($res.displayName) нет роли приложения $($w.role)" }
        if ($have | Where-Object { $_.resourceId -eq $res.id -and $_.appRoleId -eq $ar.id }) { Write-Host "  = $($res.displayName): $($w.role)"; continue }
        Graph POST "/servicePrincipals/$oid/appRoleAssignments" @{ principalId = $oid; resourceId = $res.id; appRoleId = $ar.id } | Out-Null
        Write-Host "  + $($res.displayName): $($w.role)" -ForegroundColor Green
    }
}

# FullControl на сайт портала (Graph не даёт выдать FullControl сразу: сначала Write, затем повышение)
$connect = if ($DeviceLogin) { @{ DeviceLogin = $true; Tenant = (Get-AzContext).Tenant.Id } } else { @{ Interactive = $true } }
Connect-PnPOnline -Url $SiteUrl -ClientId $DeployClientId @connect
$cur = @(Get-PnPEntraIDAppSitePermission -Site $SiteUrl | Where-Object { @($_.Apps | ForEach-Object { $_.Id }) -contains $mi.appId })[0]
if (-not $cur) { $cur = Grant-PnPEntraIDAppSitePermission -AppId $mi.appId -DisplayName $Account -Site $SiteUrl -Permissions Write }
if (@($cur.Roles) -notcontains "fullcontrol") { Set-PnPEntraIDAppSitePermission -Site $SiteUrl -PermissionId $cur.Id -Permissions FullControl | Out-Null }
Write-Host "  $Account : FullControl только на $SiteUrl" -ForegroundColor Green
Write-Host "Дальше — проверочный runbook PMO-WhoAmI (Publish-Runbook.ps1 -Name PMO-WhoAmI, затем запуск)." -ForegroundColor Cyan
