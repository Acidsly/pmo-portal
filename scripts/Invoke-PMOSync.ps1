#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Портфель проєктів — синхронизация: то, что раньше предлагалось делать потоками Power Automate.

.DESCRIPTION
    Запускается по расписанию (например, каждые 10–15 минут) от имени приложения (app-only).
    Скрипт идемпотентен: повторный запуск ничего не задваивает.

      1. Статус-отчёты -> карточка проекта. Каждый новый отчёт (srApplied = нет) переносит в проект
         ключевые показатели: статус, тип, % выполнения, даты, затраты; если отчёт самый свежий —
         ещё общее состояние (худшая из трёх оценок), дату отчёта и «Останній апдейт».
         Статус «Завершено» в отчёте -> проект получает статус «Архівний» и дату архивации.
      2. Журнал «Зміни показників»: строка на каждое изменённое поле (было / стало / кто / причина)
         и строка «Створення» для новых проектов.
      3. «Останній коментар» в карточке — из списка «Коментарі».
      4. «Стратегічний» и «Пріоритет» в статус-отчётах и рисках — копия из проекта.
      5. Права уровня элементов: PM, его руководители и Собственник — редактирование;
         стейкхолдеры и руководители Собственника и стейкхолдеров — просмотр и комментарии;
         группа PMO и владельцы сайта — полный доступ. Цепочка руководителей берётся из Entra ID.
         Отчёты и риски проекта получают тот же круг, комментарии и журнал — только чтение.
         Архивный проект — только чтение для всех, кроме PMO и владельцев сайта.
      6. (-SendReminders) письмо каждому PM со списком его активных проектов без свежего отчёта.

.PARAMETER SiteUrl          https://contoso.sharepoint.com/sites/pmo
.PARAMETER ClientId         Client ID приложения синхронизации (Register-PMOApps.ps1)
.PARAMETER Tenant           contoso.onmicrosoft.com
.PARAMETER Thumbprint       отпечаток сертификата в хранилище (Windows / Azure Automation)
.PARAMETER CertificatePath  либо путь к .pfx и -CertificatePassword
.PARAMETER ManagedIdentity  подключение через управляемое удостоверение Azure Automation
.PARAMETER RebuildPermissions  пересчитать права для всех элементов (после смены руководителей в Entra ID)
.PARAMETER SendReminders    отправить напоминания PM (запускайте с этим ключом раз в неделю)
.PARAMETER ReminderFrom     ящик-отправитель напоминаний, например pmo@contoso.com
.PARAMETER DryRun           только показать, что будет сделано

.EXAMPLE
    ./Invoke-PMOSync.ps1 -SiteUrl https://contoso.sharepoint.com/sites/pmo -ClientId <guid> -Tenant contoso.onmicrosoft.com -Thumbprint <thumb>
.EXAMPLE
    ./Invoke-PMOSync.ps1 ... -SendReminders -ReminderFrom pmo@contoso.com
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    [switch]$ManagedIdentity,
    [switch]$RebuildPermissions,
    [switch]$SendReminders,
    [string]$ReminderFrom,
    [int]$ReminderDays = 7,
    [int]$MaxManagerDepth = 10,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$PMO_GROUP = "PMO-адміністратори"
$L_PROJ = "Lists/Projects"; $L_REP = "Lists/StatusReports"; $L_RISK = "Lists/RisksIssues"
$L_CHG  = "Lists/KeyChanges"; $L_CMT = "Lists/ProjectComments"
$stats = [ordered]@{ edits = 0; reports = 0; changes = 0; created = 0; comments = 0; types = 0; acl = 0; reminders = 0; warnings = 0 }

function Log([string]$m, [string]$c = "Gray") { Write-Host ("{0:HH:mm:ss} {1}" -f (Get-Date), $m) -ForegroundColor $c }
function Warn([string]$m) { $stats.warnings++; Write-Warning $m }

# ---------------------------------------------------------------------------
# Подключение
# ---------------------------------------------------------------------------
if ($ManagedIdentity)      { Connect-PnPOnline -Url $SiteUrl -ManagedIdentity }
elseif ($Thumbprint)       { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath)  { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else { throw "Укажите -Thumbprint, -CertificatePath или -ManagedIdentity (синхронизация работает от имени приложения)." }
Log "Подключено: $SiteUrl" "Cyan"
if ($DryRun) { Log "Режим DryRun: изменения не записываются" "Yellow" }

$roles = Get-PnPRoleDefinition
$ROLE = @{
    full = ($roles | Where-Object RoleTypeKind -eq "Administrator" | Select-Object -First 1).Name
    edit = ($roles | Where-Object RoleTypeKind -eq "Contributor"   | Select-Object -First 1).Name
    read = ($roles | Where-Object RoleTypeKind -eq "Reader"        | Select-Object -First 1).Name
}
$OWNERS = (Get-PnPGroup -AssociatedOwnerGroup).Title

# ---------------------------------------------------------------------------
# Значения полей
# ---------------------------------------------------------------------------
# Поля «только дата» хранятся как полночь по часовому поясу сайта в UTC.
# +12 часов даёт правильную календарную дату для поясов от UTC-12 до UTC+12.
function DateOnly($v) {
    if ($v -isnot [datetime]) { return "" }
    $u = $v.ToUniversalTime()
    # 12:00 UTC — значение, записанное синхронизацией (ToSpDate): календарная дата — дата UTC.
    # Иначе — дата из формы, хранится как полночь по поясу сайта: +12 часов дают верную дату для UTC-11…UTC+11.
    if ($u.TimeOfDay -eq [timespan]::FromHours(12)) { return $u.ToString("yyyy-MM-dd") }
    return $u.AddHours(12).ToString("yyyy-MM-dd")
}
function ToSpDate([string]$d) { if ($d) { return "$($d)T12:00:00Z" } return $null }
function Human([string]$field, [string]$v) {
    if (-not $v) { return "—" }
    if ($v -match '^\d{4}-\d{2}-\d{2}$') { return ([datetime]$v).ToString("dd.MM.yyyy") }
    if ($field -in @("pmProgress")) { return "$v%" }
    return $v
}
function Norm($v) {
    if ($null -eq $v) { return "" }
    if ($v -is [datetime]) { return DateOnly $v }
    if ($v -is [double] -or $v -is [int] -or $v -is [decimal]) { return [string][math]::Round([double]$v) }
    return [string]$v
}
function Email($u) { if ($u) { return ([string]$u.Email).ToLowerInvariant() } return "" }
function Emails($arr) { if (-not $arr) { return @() } return @($arr | ForEach-Object { Email $_ } | Where-Object { $_ }) }
function CalcRag($s, $b, $r) {
    # худшая из трёх оценок
    $v = @($s, $b, $r)
    if ($v -contains $null -or $v -contains "") { return "" }
    if ($v -contains "Червоний") { return "Червоний" }
    if ($v -contains "Жовтий") { return "Жовтий" }
    return "Зелений"
}

$DISPLAY = [ordered]@{
    pmStatus = "Статус проєкту"; pmRAG = "Загальний стан"; pmType = "Тип проєкту"; pmProgress = "% виконання"
    pmStart = "Дата старту"; pmGoLive = "Дата запуску (продакшн)"; pmPlanEnd = "Дата завершення (план)"; pmForecastEnd = "Прогноз завершення"
}
# поле отчёта -> поле проекта
$MAP = [ordered]@{
    srStatus = "pmStatus"; srType = "pmType"; srProgress = "pmProgress"; srStart = "pmStart"; srGoLive = "pmGoLive"
    srPlanEnd = "pmPlanEnd"; srForecastEnd = "pmForecastEnd"; srActualCost = "pmActualCost"
}
$DATE_FIELDS = @("pmStart","pmGoLive","pmPlanEnd","pmForecastEnd","pmLastUpdate","pmArchivedAt")

# Правки карточки из приложения SPFx (поле pmEditLog): ключ прототипа -> внутреннее имя, подпись строки журнала
$EDIT_DISPLAY = @{ Title = "Назва проєкту"; pmCode = "Код проєкту"; pmDepartment = "Напрям"; pmLoop = "Посилання на картку в Loop"; pmPriority = "Пріоритет"
                   pmManager = "PM"; pmOwner = "Власник"; pmStakeholders = "Стейкхолдери"; pmBudget = "Бюджет (план)" }
function EditLogRows([string]$json) {
    # {"entries":[{"when","who","reason","diffs":[{"f","from","to"}]}]} -> строки журнала; повреждённое содержимое — пусто
    $key = @{ title = "Title"; code = "pmCode"; dept = "pmDepartment"; loop = "pmLoop"; prio = "pmPriority"; pm = "pmManager"
              owner = "pmOwner"; stakeholders = "pmStakeholders"; budget = "pmBudget" }
    if (-not $json) { return @() }
    try { $log = $json | ConvertFrom-Json -ErrorAction Stop } catch { return @() }
    $rows = @()
    foreach ($e in @($log.entries)) {
        # ConvertFrom-Json превращает ISO-время в DateTime — возвращаем в ISO UTC
        $when = if ($e.when -is [datetime]) { $e.when.ToUniversalTime().ToString("o") } else { [string]$e.when }
        foreach ($d in @($e.diffs)) {
            $f = $key[[string]$d.f]; if (-not $f) { $f = [string]$d.f }
            $rows += [pscustomobject]@{ field = $f; from = [string]$d.from; to = [string]$d.to; who = [string]$e.who; reason = [string]$e.reason; when = $when }
        }
    }
    return $rows
}
function Add-Change($projectId, [string]$field, [string]$from, [string]$to, [string]$kind, [string]$who, [string]$reason, [string]$when) {
    $stats.changes++
    if ($DryRun) { Log "    журнал: [$kind] $($DISPLAY[$field] ?? $field): $from -> $to"; return }
    $vals = @{ Title = ($DISPLAY[$field] ?? $EDIT_DISPLAY[$field] ?? "Проєкт"); kcProject = $projectId; kcDate = ($when ?? (Get-Date).ToUniversalTime().ToString("o"))
               kcKind = $kind; kcField = $field; kcFrom = $from; kcTo = $to; kcReason = $reason }
    if ($who) { $vals.kcChangedBy = $who }
    try { Add-PnPListItem -List $L_CHG -Values $vals | Out-Null }
    catch { if ($who) { $vals.Remove("kcChangedBy"); Add-PnPListItem -List $L_CHG -Values $vals | Out-Null } else { throw } }
}

# ---------------------------------------------------------------------------
# Загрузка
# ---------------------------------------------------------------------------
Log "Загрузка списков…"
$projects = Get-PnPListItem -List $L_PROJ -PageSize 500
$reports  = Get-PnPListItem -List $L_REP  -PageSize 500
$risks    = Get-PnPListItem -List $L_RISK -PageSize 500
$comments = Get-PnPListItem -List $L_CMT  -PageSize 500
$PROJ = @{}
foreach ($it in $projects) {
    $PROJ[$it.Id] = [pscustomobject]@{ Item = $it; Values = @{} }
    foreach ($f in @($DISPLAY.Keys) + @("pmActualCost","pmLastUpdate","pmLastReport","pmLastComment","pmArchivedAt","pmoAcl")) {
        $PROJ[$it.Id].Values[$f] = Norm $it[$f]
    }
}
Log ("Проєктів: {0}, звітів: {1}, ризиків: {2}, коментарів: {3}" -f $projects.Count, $reports.Count, $risks.Count, $comments.Count)

# ---------------------------------------------------------------------------
# 1–2. Новые проекты -> «Створення» в журнале
# ---------------------------------------------------------------------------
foreach ($p in $PROJ.Values) {
    if (-not $p.Values.pmoAcl) {
        $stats.created++
        Add-Change $p.Item.Id "Title" "" ([string]$p.Item["Title"]) "Створення" (Email $p.Item["Author"]) "" ($p.Item["Created"].ToUniversalTime().ToString("o"))
    }
}

# ---------------------------------------------------------------------------
# 1. Статус-отчёты -> карточка проекта, журнал, архив
# ---------------------------------------------------------------------------
$pending = $reports | Where-Object { $_["srApplied"] -ne $true } |
    Sort-Object @{ Expression = { DateOnly $_["srDate"] } }, @{ Expression = { $_.Id } }
foreach ($r in $pending) {
    $lk = $r["srProject"]; if (-not $lk) { continue }
    $p = $PROJ[$lk.LookupId]; if (-not $p) { Warn "Отчёт $($r.Id): проект $($lk.LookupId) не найден"; continue }
    $stats.reports++
    $repDate = DateOnly $r["srDate"]
    $rag     = CalcRag $r["srSchedule"] $r["srBudget"] $r["srResources"]
    $newer   = (-not $p.Values.pmLastUpdate) -or ($repDate -ge $p.Values.pmLastUpdate)
    $author  = Email $r["Author"]
    $title   = [string]$r["Title"]
    $reason  = @($r["srKeyReason"], $title) | Where-Object { $_ } | Join-String -Separator " · "
    Log "  звіт #$($r.Id) ($repDate) -> «$($p.Item["Title"])»"

    $target = [ordered]@{}
    foreach ($src in $MAP.Keys) {
        $v = Norm $r[$src]
        if ($v -ne "") { $target[$MAP[$src]] = $v }
    }
    if ($target.pmStatus -eq "Завершено") { $target.pmStatus = "Архівний"; $target.pmArchivedAt = $repDate }
    if ($newer) {
        if ($rag) { $target.pmRAG = $rag }
        $target.pmLastUpdate = $repDate
        $target.pmLastReport = $title
    }

    $changed = [ordered]@{}
    foreach ($k in $target.Keys) { if ($p.Values[$k] -ne $target[$k]) { $changed[$k] = $target[$k] } }
    # одно время на все строки журнала отчёта — приложение собирает их в одно событие истории
    $when = (Get-Date).ToUniversalTime().ToString("o")
    foreach ($k in $changed.Keys) {
        if ($DISPLAY.Contains($k)) { Add-Change $p.Item.Id $k (Human $k $p.Values[$k]) (Human $k $changed[$k]) "Статус-звіт" $author $reason $when }
    }
    if ($changed.Count) {
        $write = @{}
        foreach ($k in $changed.Keys) { $write[$k] = if ($k -in $DATE_FIELDS) { ToSpDate $changed[$k] } else { $changed[$k] } }
        if (-not $DryRun) { Set-PnPListItem -List $L_PROJ -Identity $p.Item.Id -Values $write | Out-Null }
        foreach ($k in $changed.Keys) { $p.Values[$k] = $changed[$k] }
    }
    if (-not $DryRun) {
        Set-PnPListItem -List $L_REP -Identity $r.Id -Values @{ srApplied = $true; srProjectType = $p.Values.pmType; srProjectPriority = (Norm $p.Item["pmPriority"]) } -UpdateType SystemUpdate | Out-Null
    }
}

# ---------------------------------------------------------------------------
# 2a. Правки карточки из приложения SPFx -> журнал «Редагування картки», поле очищается
# ---------------------------------------------------------------------------
foreach ($p in $PROJ.Values) {
    $rows = @(EditLogRows ([string]$p.Item["pmEditLog"]))
    if (-not [string]$p.Item["pmEditLog"]) { continue }
    foreach ($r in $rows) { Add-Change $p.Item.Id $r.field $r.from $r.to "Редагування картки" $r.who $r.reason $r.when; $stats.edits++ }
    Log "  правки картки «$($p.Item["Title"])»: $($rows.Count)"
    if (-not $DryRun) { Set-PnPListItem -List $L_PROJ -Identity $p.Item.Id -Values @{ pmEditLog = "" } -UpdateType SystemUpdate | Out-Null }
}

# ---------------------------------------------------------------------------
# 3. «Останній коментар»
# ---------------------------------------------------------------------------
$latest = @{}
foreach ($c in $comments) {
    $lk = $c["cmProject"]; if (-not $lk) { continue }
    $cur = $latest[$lk.LookupId]
    if (-not $cur -or $c["Created"] -gt $cur["Created"]) { $latest[$lk.LookupId] = $c }
}
foreach ($id in $latest.Keys) {
    $p = $PROJ[$id]; if (-not $p) { continue }
    $c = $latest[$id]
    $txt = "{0} — {1}, {2}" -f $c["cmText"], $c["Author"].LookupValue, $c["Created"].ToLocalTime().ToString("dd.MM.yyyy")
    if ($p.Values.pmLastComment -ne $txt) {
        $stats.comments++
        if (-not $DryRun) { Set-PnPListItem -List $L_PROJ -Identity $id -Values @{ pmLastComment = $txt } -UpdateType SystemUpdate | Out-Null }
        $p.Values.pmLastComment = $txt
    }
}

# ---------------------------------------------------------------------------
# 4. «Стратегічний» и «Пріоритет» в отчётах и рисках
# ---------------------------------------------------------------------------
foreach ($pair in @(@($L_REP, $reports, "srProject", "srProjectType", "srProjectPriority"), @($L_RISK, $risks, "riProject", "riProjectType", "riProjectPriority"))) {
    foreach ($it in $pair[1]) {
        $lk = $it[$pair[2]]; if (-not $lk) { continue }
        $p = $PROJ[$lk.LookupId]; if (-not $p) { continue }
        $prio = Norm $p.Item["pmPriority"]
        if ((Norm $it[$pair[3]]) -ne $p.Values.pmType -or (Norm $it[$pair[4]]) -ne $prio) {
            $stats.types++
            if (-not $DryRun) { Set-PnPListItem -List $pair[0] -Identity $it.Id -Values @{ $pair[3] = $p.Values.pmType; $pair[4] = $prio } -UpdateType SystemUpdate | Out-Null }
        }
    }
}

# ---------------------------------------------------------------------------
# 5. Права по иерархии
# ---------------------------------------------------------------------------
$MGR = @{}
function Get-Chain([string]$email) {
    $chain = @(); $cur = $email; $depth = 0
    while ($cur -and $depth -lt $MaxManagerDepth) {
        if (-not $MGR.ContainsKey($cur)) {
            try {
                $m = Invoke-PnPGraphMethod -Url ("v1.0/users/{0}/manager?`$select=mail,userPrincipalName" -f [uri]::EscapeDataString($cur)) -Method Get
                $MGR[$cur] = ([string]($m.mail ?? $m.userPrincipalName)).ToLowerInvariant()
            } catch { $MGR[$cur] = "" }
        }
        $cur = $MGR[$cur]
        if ($cur -and $chain -notcontains $cur -and $cur -ne $email) { $chain += $cur } else { break }
        $depth++
    }
    return $chain
}
function Get-Acl($item) {
    $acl = [ordered]@{}
    $add = { param($e, $lvl) if (-not $e) { return }; if ($acl[$e] -ne "edit") { $acl[$e] = $lvl } }
    $pm = Email $item["pmManager"]; $owner = Email $item["pmOwner"]; $st = Emails $item["pmStakeholders"]
    & $add $pm "edit"
    foreach ($m in (Get-Chain $pm)) { & $add $m "edit" }
    & $add $owner "edit"
    foreach ($s in $st) { & $add $s "read" }
    foreach ($x in @($owner) + $st) { if ($x) { foreach ($m in (Get-Chain $x)) { & $add $m "read" } } }
    return $acl
}
function Get-Hash($acl) {
    $s = ($acl.Keys | Sort-Object | ForEach-Object { "$_=$($acl[$_])" }) -join ";"
    $bytes = [System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($s))
    return ([Convert]::ToHexString($bytes)).Substring(0, 24)
}
function Set-ItemAcl([string]$list, [int]$id, $acl, [bool]$readOnly, [string]$aclHash) {
    $stats.acl++
    if ($DryRun) { Log ("    права: {0} #{1} -> {2}" -f $list, $id, (($acl.Keys | ForEach-Object { "$_($($acl[$_]))" }) -join ", ")); return }
    Set-PnPListItemPermission -List $list -Identity $id -Group $PMO_GROUP -AddRole $ROLE.full -ClearExisting -SystemUpdate | Out-Null
    Set-PnPListItemPermission -List $list -Identity $id -Group $OWNERS -AddRole $ROLE.full -SystemUpdate | Out-Null
    foreach ($e in $acl.Keys) {
        $roleName = if ($readOnly -or $acl[$e] -eq "read") { $ROLE.read } else { $ROLE.edit }
        try { Set-PnPListItemPermission -List $list -Identity $id -User $e -AddRole $roleName -SystemUpdate | Out-Null }
        catch { Warn "Не удалось выдать права $e на $list #$id : $($_.Exception.Message)" }
    }
    Set-PnPListItem -List $list -Identity $id -Values @{ pmoAcl = $aclHash } -UpdateType SystemUpdate | Out-Null
}

Log "Права доступа…"
$HASH = @{}; $ACLS = @{}
foreach ($p in $PROJ.Values) {
    $acl = Get-Acl $p.Item
    # архивный проект — только просмотр (PMO и владельцы сайта сохраняют полный доступ, см. Set-ItemAcl)
    if ($p.Values.pmStatus -eq "Архівний") { foreach ($k in @($acl.Keys)) { $acl[$k] = "read" } }
    $h = Get-Hash $acl
    $HASH[$p.Item.Id] = $h; $ACLS[$p.Item.Id] = $acl
    if ($RebuildPermissions -or $p.Values.pmoAcl -ne $h) {
        Log "  проєкт «$($p.Item["Title"])»: $($acl.Count) користувачів"
        Set-ItemAcl $L_PROJ $p.Item.Id $acl $false $h
    }
}
# дочерние элементы (перечитываем журнал и комментарии — в этом запуске могли появиться новые строки)
$children = @(
    @($L_REP,  (Get-PnPListItem -List $L_REP  -PageSize 500), "srProject", $false),
    @($L_RISK, (Get-PnPListItem -List $L_RISK -PageSize 500), "riProject", $false),
    @($L_CMT,  (Get-PnPListItem -List $L_CMT  -PageSize 500), "cmProject", $true),
    @($L_CHG,  (Get-PnPListItem -List $L_CHG  -PageSize 500), "kcProject", $true)
)
foreach ($c in $children) {
    foreach ($it in $c[1]) {
        $lk = $it[$c[2]]; if (-not $lk -or -not $HASH.ContainsKey($lk.LookupId)) { continue }
        $h = $HASH[$lk.LookupId]
        if ($RebuildPermissions -or (Norm $it["pmoAcl"]) -ne $h) { Set-ItemAcl $c[0] $it.Id $ACLS[$lk.LookupId] $c[3] $h }
    }
}

# ---------------------------------------------------------------------------
# 6. Напоминания PM
# ---------------------------------------------------------------------------
if ($SendReminders) {
    if (-not $ReminderFrom) { throw "Для -SendReminders укажите -ReminderFrom (ящик-отправитель)." }
    $limit = (Get-Date).Date.AddDays(-$ReminderDays).ToString("yyyy-MM-dd")
    $byPm = @{}
    foreach ($p in $PROJ.Values) {
        if ($p.Values.pmStatus -in @("Скасовано","Архівний","Завершено")) { continue }
        if ($p.Values.pmLastUpdate -and $p.Values.pmLastUpdate -ge $limit) { continue }
        $pm = Email $p.Item["pmManager"]; if (-not $pm) { continue }
        if (-not $byPm[$pm]) { $byPm[$pm] = @() }
        $byPm[$pm] += $p
    }
    $newForm = "$SiteUrl/Lists/StatusReports/NewForm.aspx"
    foreach ($pm in $byPm.Keys) {
        $rows = ($byPm[$pm] | ForEach-Object {
            $last = if ($_.Values.pmLastUpdate) { Human "pmLastUpdate" $_.Values.pmLastUpdate } else { "звітів ще немає" }
            "<li><b>$([System.Net.WebUtility]::HtmlEncode([string]$_.Item["Title"]))</b> — останній звіт: $last</li>" }) -join ""
        $body = @"
<p>Доброго дня!</p>
<p>За цими проєктами немає статус-звіту понад $ReminderDays днів:</p><ul>$rows</ul>
<p><a href="$newForm">Додати статус-звіт</a> · <a href="$SiteUrl">Портфель проєктів</a></p>
<hr><p style="color:#666">Добрый день! По этим проектам нет статус-отчёта более $ReminderDays дней. Ссылка выше открывает форму нового отчёта.</p>
"@
        $msg = @{ message = @{ subject = "Портфель проєктів: потрібен статус-звіт ($($byPm[$pm].Count))"
                               body = @{ contentType = "HTML"; content = $body }
                               toRecipients = @(@{ emailAddress = @{ address = $pm } }) }
                  saveToSentItems = $false }
        $stats.reminders++
        if ($DryRun) { Log "  нагадування -> $pm ($($byPm[$pm].Count))"; continue }
        try { Invoke-PnPGraphMethod -Url "v1.0/users/$ReminderFrom/sendMail" -Method Post -Content $msg | Out-Null }
        catch { Warn "Не удалось отправить напоминание $pm : $($_.Exception.Message)" }
    }
}

Log ("Правок картки: {0}" -f $stats.edits)
Log ("Готово. Звітів: {0}, записів у журнал: {1}, нових проєктів: {2}, коментарів: {3}, типів: {4}, прав: {5}, нагадувань: {6}, попереджень: {7}" -f `
    $stats.reports, $stats.changes, $stats.created, $stats.comments, $stats.types, $stats.acl, $stats.reminders, $stats.warnings) "Green"
