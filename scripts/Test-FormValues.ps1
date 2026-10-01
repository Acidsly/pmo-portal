#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Проверка форматов значений для записи сразу в папку проекта (AddValidateUpdateItemUsingPath) — как пишет приложение.

.DESCRIPTION
    Значения этого метода разбираются по региональным настройкам сайта (десятичный разделитель, формат даты).
    Скрипт создаёт записи в служебном скрытом списке «Перевірка форматів» (Lists/PortalProbe, папка P0) с полями тех же
    типов, что в отчётах, читает их обратно и печатает, какие варианты записи сохранились верно. Реальные списки не трогает.
    Запуск: Invoke-Env.ps1 -Env test -Action probe-formvalues. Повторный запуск дописывает новые пробные записи.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [Parameter(Mandatory)][string]$UserEmail
)
$ErrorActionPreference = "Stop"
if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

$url = "Lists/PortalProbe"
$l = Get-PnPList -Identity $url -ErrorAction SilentlyContinue
if (-not $l) {
    $l = New-PnPList -Title "Перевірка форматів" -Url $url -Template GenericList
    Set-PnPList -Identity $url -Hidden $true | Out-Null
    $proj = Get-PnPList -Identity "Lists/Projects"
    Add-PnPFieldFromXml -List $url -FieldXml "<Field Type='Number' Name='pbNum' StaticName='pbNum' DisplayName='pbNum' Decimals='2'/>" | Out-Null
    Add-PnPFieldFromXml -List $url -FieldXml "<Field Type='DateTime' Name='pbDate' StaticName='pbDate' DisplayName='pbDate' Format='DateOnly'/>" | Out-Null
    Add-PnPFieldFromXml -List $url -FieldXml "<Field Type='Lookup' Name='pbLookup' StaticName='pbLookup' DisplayName='pbLookup' List='{$($proj.Id)}' ShowField='Title'/>" | Out-Null
    Add-PnPFieldFromXml -List $url -FieldXml "<Field Type='User' Name='pbUser' StaticName='pbUser' DisplayName='pbUser' UserSelectionMode='PeopleOnly'/>" | Out-Null
    Add-PnPFieldFromXml -List $url -FieldXml "<Field Type='Boolean' Name='pbBool' StaticName='pbBool' DisplayName='pbBool'><Default>0</Default></Field>" | Out-Null
    Add-PnPFieldFromXml -List $url -FieldXml "<Field Type='Choice' Name='pbChoice' StaticName='pbChoice' DisplayName='pbChoice'><CHOICES><CHOICE>Зелений</CHOICE><CHOICE>Жовтий</CHOICE></CHOICES></Field>" | Out-Null
    Add-PnPFieldFromXml -List $url -FieldXml "<Field Type='Note' Name='pbNote' StaticName='pbNote' DisplayName='pbNote' RichText='FALSE'/>" | Out-Null
    Write-Host "+ служебный список $url"
}
if (-not (Get-PnPFolder -Url "$url/P0" -ErrorAction SilentlyContinue)) { $null = Add-PnPFolder -Name "P0" -Folder $url }

$rs = Invoke-PnPSPRestMethod -Method Get -Url "/_api/web/RegionalSettings?`$select=LocaleId,DecimalSeparator,DateFormat,DateSeparator,TimeZone/Description&`$expand=TimeZone"
Write-Host ("Регіональні налаштування: LocaleId={0}, DecimalSeparator='{1}', DateFormat={2}, DateSeparator='{3}', TimeZone={4}" -f $rs.LocaleId, $rs.DecimalSeparator, $rs.DateFormat, $rs.DateSeparator, $rs.TimeZone.Description)

$web = Get-PnPWeb
$projId = (Get-PnPListItem -List "Lists/Projects" -PageSize 1 | Select-Object -First 1).Id
$userKey = "[{'Key':'i:0#.f|membership|$UserEmail'}]"
$cases = @(
    @{ t = "num-dot";     v = @{ pbNum = "12.5" } ;          check = { param($i) [decimal]$i["pbNum"] -eq 12.5 } }
    @{ t = "num-comma";   v = @{ pbNum = "12,5" } ;          check = { param($i) [decimal]$i["pbNum"] -eq 12.5 } }
    @{ t = "num-int";     v = @{ pbNum = "420000" } ;        check = { param($i) [decimal]$i["pbNum"] -eq 420000 } }
    @{ t = "date-dmy";    v = @{ pbDate = "30.09.2026" } ;   check = { param($i) $i["pbDate"] -and ([datetime]$i["pbDate"]).ToLocalTime().ToString("yyyy-MM-dd") -eq "2026-09-30" } }
    @{ t = "date-iso";    v = @{ pbDate = "2026-09-30" } ;   check = { param($i) $i["pbDate"] -and ([datetime]$i["pbDate"]).ToLocalTime().ToString("yyyy-MM-dd") -eq "2026-09-30" } }
    @{ t = "date-mdy";    v = @{ pbDate = "09/30/2026" } ;   check = { param($i) $i["pbDate"] -and ([datetime]$i["pbDate"]).ToLocalTime().ToString("yyyy-MM-dd") -eq "2026-09-30" } }
    @{ t = "lookup";      v = @{ pbLookup = "$projId" } ;    check = { param($i) $i["pbLookup"] -and $i["pbLookup"].LookupId -eq $projId } }
    @{ t = "user";        v = @{ pbUser = $userKey } ;       check = { param($i) $i["pbUser"] -and ([string]$i["pbUser"].Email).ToLower() -eq $UserEmail.ToLower() } }
    @{ t = "user-json";   v = @{ pbUser = ('[{"Key":"i:0#.f|membership|' + $UserEmail + '"}]') } ; check = { param($i) $i["pbUser"] -and ([string]$i["pbUser"].Email).ToLower() -eq $UserEmail.ToLower() } }
    @{ t = "bool-1";      v = @{ pbBool = "1" } ;            check = { param($i) $i["pbBool"] -eq $true } }
    @{ t = "bool-0";      v = @{ pbBool = "0" } ;            check = { param($i) $i["pbBool"] -eq $false } }
    @{ t = "choice";      v = @{ pbChoice = "Жовтий" } ;     check = { param($i) $i["pbChoice"] -eq "Жовтий" } }
    @{ t = "note-cyr";    v = @{ pbNote = "Рядок 1`nРядок 2 — «лапки» & <теги>" } ; check = { param($i) $i["pbNote"] -eq "Рядок 1`nРядок 2 — «лапки» & <теги>" } }
    @{ t = "empty-date";  v = @{ pbDate = "" } ;             check = { param($i) -not $i["pbDate"] } }
)
$ok = 0
foreach ($c in $cases) {
    $fv = @(@{ FieldName = "Title"; FieldValue = "probe $($c.t) $(Get-Date -Format s)" })
    foreach ($k in $c.v.Keys) { $fv += @{ FieldName = $k; FieldValue = [string]$c.v[$k] } }
    $body = @{ listItemCreateInfo = @{ FolderPath = @{ DecodedUrl = "$($web.ServerRelativeUrl.TrimEnd('/'))/$url/P0" }; UnderlyingObjectType = 0 }
               formValues = $fv; bNewDocumentUpdate = $false }
    try {
        $res = Invoke-PnPSPRestMethod -Method Post -Url "/_api/web/GetList(@u)/AddValidateUpdateItemUsingPath()?@u='$($web.ServerRelativeUrl.TrimEnd('/'))/$url'" -Content $body -ContentType "application/json;odata=nometadata"
        $vals = @($res.value)
        $err = @($vals | Where-Object { $_.HasException })
        $id = [int](($vals | Where-Object FieldName -eq "Id").FieldValue)
        if ($err) { Write-Host ("  ✗ {0,-11} помилка поля: {1}" -f $c.t, (($err | ForEach-Object { "$($_.FieldName): $($_.ErrorMessage)" }) -join "; ")) -ForegroundColor Red; continue }
        $it = Get-PnPListItem -List $url -Id $id
        $dir = [string]$it["FileDirRef"]
        if ((& $c.check $it) -and $dir.EndsWith("/P0")) { $ok++; Write-Host ("  ✓ {0,-11} #{1} у папці P0" -f $c.t, $id) -ForegroundColor Green }
        else { Write-Host ("  ✗ {0,-11} #{1}: збережено інше ({2}) у {3}" -f $c.t, $id, (($c.v.Keys | ForEach-Object { "$_=$($it[$_])" }) -join ", "), $dir) -ForegroundColor Yellow }
    } catch { Write-Host ("  ✗ {0,-11} {1}" -f $c.t, $_.Exception.Message) -ForegroundColor Red }
}
Write-Host "Збіглося: $ok з $($cases.Count)"
