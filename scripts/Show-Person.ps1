#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Диагностика доступа человека к порталу (только чтение): профиль в Entra ID, руководитель, прямые подчинённые,
    группы сайта, роли самого человека и его подчинённых в проектах, «Доступ до картки».

.DESCRIPTION
    Отвечает на вопросы «почему он не видит портал / проекты подчинённых». Ничего не меняет.
    Запуск: Invoke-Env.ps1 -Env test -Action whois -Email user@company.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [Parameter(Mandatory)][string]$Email
)
$ErrorActionPreference = "Stop"
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

function G([string]$url) { try { return Invoke-PnPGraphMethod -Url $url -Method Get } catch { return $null } }
$enc = [uri]::EscapeDataString($Email)
$u = G "v1.0/users/$enc`?`$select=displayName,mail,userPrincipalName,jobTitle,accountEnabled,proxyAddresses"
if (-not $u) { Write-Host "Entra ID: пользователь $Email не найден (ни по UPN, ни по почте)." -ForegroundColor Red; return }
$mail = ([string]($u.mail ?? $u.userPrincipalName)).ToLowerInvariant()
Write-Host "Entra ID: $($u.displayName) · $($u.jobTitle) · UPN $($u.userPrincipalName) · почта $($u.mail) · вход разрешён: $($u.accountEnabled)"
$aliases = @($u.proxyAddresses | Where-Object { $_ -like "smtp:*" } | ForEach-Object { ($_ -replace '^smtp:', '').ToLowerInvariant() })
if ($aliases.Count) { Write-Host "  адреса: $($aliases -join ', ')" }
$m = G "v1.0/users/$enc/manager?`$select=displayName,mail,userPrincipalName"
Write-Host "  руководитель: $(if ($m) { "$($m.displayName) ($($m.mail ?? $m.userPrincipalName))" } else { '— не указан' })"
$dr = @((G "v1.0/users/$enc/directReports?`$select=displayName,mail,userPrincipalName").value)
Write-Host "  прямые подчинённые: $($dr.Count)"
$reports = @($dr | ForEach-Object { [pscustomobject]@{ n = [string]$_.displayName; e = ([string]($_.mail ?? $_.userPrincipalName)).ToLowerInvariant() } })

# цепочка руководителей — той же функцией, что синхронизация (Get-Chain из Invoke-PMOSync.ps1)
$syncAst = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot "Invoke-PMOSync.ps1"), [ref]$null, [ref]$null)
foreach ($fn in @("Get-Chain")) { Invoke-Expression ($syncAst.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $args[0].Name -eq $fn }, $true) | Select-Object -First 1).Extent.Text }
$MGR = @{}; $PEOPLE = @{}; $MaxManagerDepth = 10
Write-Host "  цепочка руководителей (как в синхронизации): $(((Get-Chain $mail) -join ' → ') ?? '')"

# сайт: группы и доступ к странице портала
$login = "i:0#.f|membership|$($u.userPrincipalName)"
$inGroups = @()
foreach ($g in (Get-PnPGroup)) {
    $mem = @(Get-PnPGroupMember -Group $g | ForEach-Object { ([string]$_.LoginName).ToLowerInvariant() })
    if ($mem -contains $login.ToLowerInvariant()) { $inGroups += $g.Title }
}
Write-Host "Сайт: группы — $(if ($inGroups.Count) { $inGroups -join ', ' } else { 'ни одной (портал не откроется: «Вам нужен доступ»)' })"

# проекты: роли человека и его подчинённых, «Доступ до картки»
$projects = @(Get-PnPListItem -List "Lists/Projects" -PageSize 500)
$team = @(Get-PnPListItem -List "Lists/ProjectTeam" -PageSize 500)
function RolesOf([string]$e) {
    $out = @()
    foreach ($p in $projects) {
        $code = [string]$p["pmCode"]
        if ($p["pmManager"] -and ([string]$p["pmManager"].Email).ToLowerInvariant() -eq $e) { $out += "$code PM" }
        if ($p["pmOwner"] -and ([string]$p["pmOwner"].Email).ToLowerInvariant() -eq $e) { $out += "$code власник" }
        foreach ($t in @($team | Where-Object { $_["tmProject"] -and $_["tmProject"].LookupId -eq $p.Id -and $_["tmUser"] -and ([string]$_["tmUser"].Email).ToLowerInvariant() -eq $e })) { $out += "$code команда/$($t["tmRole"])" }
    }
    return $out
}
$own = RolesOf $mail
Write-Host "Роли в проектах: $(if ($own.Count) { $own -join '; ' } else { 'нет' })"
foreach ($r in $reports) {
    $rr = RolesOf $r.e
    Write-Host ("  подчинённый {0} ({1}): {2}" -f $r.n, $r.e, $(if ($rr.Count) { $rr -join '; ' } else { 'ролей в проектах нет' }))
}
$seen = @()
foreach ($p in $projects) {
    try { $acc = ([string]$p["pmAccess"] | ConvertFrom-Json).people } catch { $acc = @() }
    $row = @($acc | Where-Object { ([string]$_.e).ToLowerInvariant() -eq $mail -or $aliases -contains ([string]$_.e).ToLowerInvariant() })[0]
    if ($row) { $seen += "$($p["pmCode"]) ($($row.r)/$($row.l))" }
}
Write-Host "«Доступ до картки» (права от синхронизации): $(if ($seen.Count) { $seen -join ', ' } else { 'ни в одном проекте' })"
