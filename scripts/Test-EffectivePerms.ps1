#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Фактические права человека на дочерние списки портала (только чтение): корень списка и папки проектов P<ID>.

.DESCRIPTION
    Проверка модели прав v2 (сценарии S10, S13, S16 плана защиты): у участника сайта в корне отчётов, рисков, комментариев,
    команды и погоджень нет права добавлять и править; в папке чужого проекта — тоже; в папке своего проекта — по роли
    (PM: отчёты — добавлять, риски и команда — править; все, кто видит активный проект, — добавлять комментарии; PMO — погодження).
    Запуск: Invoke-Env.ps1 -Env test -Action perm-check -Email <e-mail>.
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

$web = Get-PnPWeb; $rel = $web.ServerRelativeUrl.TrimEnd("/")
$user = Get-PnPUser | Where-Object { ([string]$_.Email).ToLowerInvariant() -eq $Email.ToLowerInvariant() } | Select-Object -First 1
if (-not $user) { throw "Користувача $Email немає на сайті" }
$login = [uri]::EscapeDataString($user.LoginName)
function Get-Bits([string]$url) {
    $j = Invoke-PnPSPRestMethod -Method Get -Url "$url/getusereffectivepermissions(@u)?@u='$login'"
    $low = [uint64]$j.Low
    return [ordered]@{ view = [bool]($low -band 0x1); add = [bool]($low -band 0x2); edit = [bool]($low -band 0x4); del = [bool]($low -band 0x8) }
}
$fmt = { param($b) "{0}{1}{2}" -f $(if ($b.add) { "A" } else { "-" }), $(if ($b.edit) { "E" } else { "-" }), $(if ($b.del) { "D" } else { "-" }) }
$projects = @(Get-PnPListItem -List "Lists/Projects" -PageSize 500 -Fields "ID", "pmCode", "pmStatus", "pmManager")
$lists = @("Lists/StatusReports", "Lists/RisksIssues", "Lists/ProjectComments", "Lists/ProjectTeam", "Lists/ReportApprovals", "Lists/ProjectAssignments", "Lists/ProjectState")
Write-Host "Права $($user.Title) ($Email): A — додавати, E — змінювати, D — видаляти" -ForegroundColor Cyan
foreach ($l in $lists) {
    $lst = Get-PnPList -Identity $l
    $b = Get-Bits "/_api/web/lists(guid'$($lst.Id)')"
    $line = "{0,-24} корінь: {1}" -f $l.Split("/")[1], (& $fmt $b)
    $cells = @()
    foreach ($p in $projects) {
        $f = Get-PnPFolder -Url "$l/P$($p.Id)" -Includes ListItemAllFields -ErrorAction SilentlyContinue
        if (-not $f -or -not $f.ListItemAllFields) { continue }
        $fb = Get-Bits "/_api/web/lists(guid'$($lst.Id)')/items($($f.ListItemAllFields.Id))"
        $role = if (([string]$p["pmManager"].Email).ToLowerInvariant() -eq $Email.ToLowerInvariant()) { "PM" } else { "" }
        $cells += "$($p["pmCode"])$(if ($role) { '(PM)' }):$(& $fmt $fb)"
    }
    Write-Host $line
    Write-Host ("    " + ($cells -join "  "))
}
# сповіщення: «Прочитане» — своя строка (просмотр и правка, без удаления), чужие — не видны
$nsList = Get-PnPList -Identity "Lists/NotifyState" -ErrorAction SilentlyContinue
if ($nsList) {
    $rb = Get-Bits "/_api/web/lists(guid'$($nsList.Id)')"
    $own = ""; $others = 0
    foreach ($it in @(Get-PnPListItem -List "Lists/NotifyState" -PageSize 500)) {
        $b = Get-Bits "/_api/web/lists(guid'$($nsList.Id)')/items($($it.Id))"
        if (([string]$it["Title"]).ToLowerInvariant() -eq $Email.ToLowerInvariant()) { $own = "#$($it.Id): $(if ($b.view) { 'V' } else { '-' })$(& $fmt $b)" }
        elseif ($b.view) { $others++ }
    }
    Write-Host ("{0,-24} корінь: {1}  свій рядок: {2}  чужих видно: {3}" -f "NotifyState", (& $fmt $rb), $(if ($own) { $own } else { "немає" }), $others)
}
