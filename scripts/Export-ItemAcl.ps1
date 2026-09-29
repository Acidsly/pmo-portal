#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Выгрузка фактических прав записей портала (только чтение): по каждой записи — уникальные ли права, кто и с какой ролью, отметка pmoAcl.
    Для сверки «до / после» изменений синхронизации. Запуск: Invoke-Env.ps1 -Env test -Action acl-export -File <путь.json>.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [Parameter(Mandatory)][string]$File
)
$ErrorActionPreference = "Stop"
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

$ctx = Get-PnPContext
$out = [ordered]@{}
$sw = [Diagnostics.Stopwatch]::StartNew()
foreach ($url in @("Lists/Projects", "Lists/StatusReports", "Lists/RisksIssues", "Lists/ProjectComments", "Lists/KeyChanges", "Lists/ProjectTeam", "Lists/ReportApprovals")) {
    $list = Get-PnPList -Identity $url -ErrorAction SilentlyContinue
    if (-not $list) { continue }
    $q = [Microsoft.SharePoint.Client.CamlQuery]::new()
    $q.ViewXml = "<View Scope='RecursiveAll'><RowLimit Paged='TRUE'>500</RowLimit></View>"
    $rows = [ordered]@{}
    do {
        $items = $list.GetItems($q)
        $ctx.Load($items)
        $ctx.ExecuteQuery()
        foreach ($it in $items) {
            $ctx.Load($it.RoleAssignments)
        }
        $ctx.ExecuteQuery()
        foreach ($it in $items) { foreach ($ra in $it.RoleAssignments) { $ctx.Load($ra.Member); $ctx.Load($ra.RoleDefinitionBindings) } }
        $ctx.ExecuteQuery()
        foreach ($it in $items) {
            $acl = @($it.RoleAssignments | ForEach-Object {
                $who = [string]$_.Member.LoginName; $who = ($who -replace '^.*\|', '').ToLowerInvariant()
                "{0}={1}" -f $who, (@($_.RoleDefinitionBindings | Where-Object { -not $_.Hidden } | ForEach-Object { $_.Name } | Sort-Object) -join "+")
            } | Where-Object { $_ -notmatch '=$' } | Sort-Object)
            # папки проектов P<ID> — с отметкой folder; dir — папка записи (после переноса записи наследуют права папки)
            $rows[[string]$it.Id] = [ordered]@{ unique = [bool](Get-PnPProperty -ClientObject $it -Property HasUniqueRoleAssignments); acl = $acl; hash = [string]$it["pmoAcl"]
                folder = ([string]$it.FileSystemObjectType -eq "Folder"); dir = [string]$it["FileDirRef"]; name = [string]$it["FileLeafRef"] }
        }
        $q.ListItemCollectionPosition = $items.ListItemCollectionPosition
    } while ($q.ListItemCollectionPosition)
    $out[$url] = $rows
    Write-Host ("  {0}: {1} записей" -f $url, $rows.Count)
}
$out | ConvertTo-Json -Depth 6 | Set-Content -Path $File -Encoding utf8
Write-Host ("Готово за {0:n0} c: {1}" -f $sw.Elapsed.TotalSeconds, $File) -ForegroundColor Green
