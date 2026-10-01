# Проверочный runbook Azure Automation (этап 3 плана docs/superpowers/plans/2026-10-01-azure-automation.md)
<#
.SYNOPSIS
    Права управляемой учётной записи: все операции, которые делает синхронизация, — на служебном списке «Перевірка форматів».

.DESCRIPTION
    Данные портала не меняет: пишет только в скрытый служебный список Lists/PortalProbe (папка whoami, одна запись)
    и в служебную строку блокировки (захват и снятие, если она свободна). Повторный запуск ничего не дублирует.
    Каждая проверка — строка «ok» или «FAIL»; хотя бы один FAIL — задание завершается ошибкой.
    Локально (без Azure): Connect-PnPOnline сертификатом приложения PMO Sync, затем ./PMO-WhoAmI.ps1 -SiteUrl ... -UseCurrentConnection.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    # человек, чей руководитель читается из Entra ID (проверка Graph User.Read.All)
    [Parameter(Mandatory)][string]$PersonEmail,
    [string]$ManagerCacheVariable,
    [switch]$UseCurrentConnection
)
$ErrorActionPreference = "Stop"
$fail = 0
function Check([string]$name, [scriptblock]$do) {
    try { $r = & $do; Write-Output ("ok   {0}{1}" -f $name, $(if ($null -ne $r -and "$r") { " — $r" })) }
    catch { $script:fail++; Write-Output ("FAIL {0} — {1}" -f $name, $_.Exception.Message.Split([Environment]::NewLine)[0]) }
}
$inAutomation = [bool](Get-Command Get-AutomationVariable -ErrorAction SilentlyContinue)
Write-Output "PnP.PowerShell $((Get-Module PnP.PowerShell -ListAvailable | Select-Object -First 1).Version), PowerShell $($PSVersionTable.PSVersion), Automation: $inAutomation"
if (-not $UseCurrentConnection) { Connect-PnPOnline -Url $SiteUrl -ManagedIdentity }

Check "сайт" { (Get-PnPWeb).Title }
Check "проєкти (читання)" { "$(@(Get-PnPListItem -List "Lists/Projects" -PageSize 500 -Fields "ID").Count) записів" }
Check "власники сайту" { $g = (Get-PnPGroup -AssociatedOwnerGroup).Title; "$(@(Get-PnPGroupMember -Group $g).Count) у «$g»" }
Check "група PMO" { "$(@(Get-PnPGroupMember -Group "PMO-адміністратори").Count) учасників" }
Check "рівні дозволів" { $r = Get-PnPRoleDefinition; if (-not ($r | Where-Object Name -eq "Додавання (портал)")) { throw "немає «Додавання (портал)»" }; "$(@($r).Count) рівнів" }
Check "адміністратори семейства сайтів" { "$(@(Get-PnPSiteCollectionAdmin).Count)" }
Check "приложения на сайте (siteusers)" {
    $u = Invoke-PnPSPRestMethod -Method Get -Url "/_api/web/siteusers?`$select=Id,LoginName,Title&`$filter=substringof('ms.sp.ext',LoginName) or substringof('app@sharepoint',LoginName)"
    $v = if ($u.value) { @($u.value) } else { @($u) }
    "$(@($v | Where-Object { ([string]$_.LoginName) -like 'i:0i.t|ms.sp.ext|*' -or ([string]$_.LoginName) -like 'i:0i.t|*|app@sharepoint' }).Count) приложений: " + ((@($v) | ForEach-Object { "$($_.Title) ($(([string]$_.LoginName).Split('|')[-1]))" }) -join ", ")
}
Check "Graph: руководитель $PersonEmail" { $m = Invoke-PnPGraphMethod -Url "v1.0/users/$PersonEmail/manager?`$select=mail,displayName" -Method Get; "$($m.displayName) <$($m.mail)>" }
Check "токен SharePoint (блокировка)" { $t = Get-PnPAccessToken -ResourceTypeName SharePoint; if (-not $t) { throw "пусто" }; "$($t.Length) символів" }

# запись: служебный список (создаёт scripts/Test-FormValues.ps1; нет — создаём так же, скрытым)
$L = "Lists/PortalProbe"
Check "служебний список $L" {
    if (-not (Get-PnPList -Identity $L -ErrorAction SilentlyContinue)) { New-PnPList -Title "Перевірка форматів" -Url $L -Template GenericList | Out-Null; Set-PnPList -Identity $L -Hidden $true | Out-Null; "створено" } else { "є" }
}
$folder = $null; $item = $null
Check "папка (Add-PnPFolder)" {
    $script:folder = Get-PnPFolder -Url "$L/whoami" -Includes ListItemAllFields -ErrorAction SilentlyContinue
    if (-not $script:folder) { Add-PnPFolder -Name "whoami" -Folder $L | Out-Null; $script:folder = Get-PnPFolder -Url "$L/whoami" -Includes ListItemAllFields }
    "id $($script:folder.ListItemAllFields.Id)"
}
Check "запис у корені + SystemUpdate" {
    $script:item = @(Get-PnPListItem -List $L -PageSize 500 | Where-Object { $_["Title"] -eq "whoami" -and $_.FileSystemObjectType -ne "Folder" })[0]
    if (-not $script:item) { $script:item = Add-PnPListItem -List $L -Values @{ Title = "whoami" } }
    Set-PnPListItem -List $L -Identity $script:item.Id -Values @{ Title = "whoami" } -UpdateType SystemUpdate | Out-Null
    "id $($script:item.Id)"
}
Check "розрив успадкування й права папки" {
    $me = (Get-PnPGroup -AssociatedOwnerGroup).Title
    Set-PnPListItemPermission -List $L -Identity $script:folder.ListItemAllFields.Id -Group $me -AddRole (Get-PnPRoleDefinition | Where-Object RoleTypeKind -eq "Administrator" | Select-Object -First 1).Name -ClearExisting | Out-Null
    "власники — повний доступ"
}
Check "перенесення запису в папку й скидання прав (як синхронізація)" {
    $it = Get-PnPListItem -List $L -Id $script:item.Id -Fields "FileRef", "FileDirRef", "FileLeafRef"
    $dir = [string]$script:folder.ServerRelativeUrl
    $ctx = Get-PnPContext
    if ([string]$it["FileDirRef"] -ne $dir) {
        $file = $ctx.Web.GetFileByServerRelativePath([Microsoft.SharePoint.Client.ResourcePath]::FromDecodedUrl([string]$it["FileRef"]))
        $file.MoveToUsingPath([Microsoft.SharePoint.Client.ResourcePath]::FromDecodedUrl("$dir/$($it["FileLeafRef"])"), [Microsoft.SharePoint.Client.MoveOperations]::None)
    }
    $x = (Get-PnPList -Identity $L).GetItemById($script:item.Id)
    $x.ResetRoleInheritance(); $x["Title"] = "whoami"; $x.SystemUpdate()
    Invoke-PnPQuery -RetryCount 5
    "у $dir"
}
Check "рядок блокування (читання)" {
    $u = "/_api/web/GetList(@l)/items?`$select=Id,psState&`$filter=psProject eq 0&@l='" + [uri]::EscapeDataString(([uri](Get-PnPWeb).Url).AbsolutePath.TrimEnd("/") + "/Lists/ProjectState") + "'"
    $r = Invoke-PnPSPRestMethod -Method Get -Url $u
    $row = @($r.value)[0]
    if (-not $row) { "ще немає (створить перший запуск синхронізації)" } elseif ($row.psState) { "зайнято: $($row.psState)" } else { "вільно" }
}
if ($inAutomation -and $ManagerCacheVariable) {
    Check "змінна кешу $ManagerCacheVariable (читання і запис)" {
        $v = [string](Get-AutomationVariable -Name $ManagerCacheVariable)
        Set-AutomationVariable -Name $ManagerCacheVariable -Value $v
        "$($v.Length) символів"
    }
}
if ($fail) { throw "Перевірка прав: $fail FAIL" }
Write-Output "Усі перевірки пройдені"
