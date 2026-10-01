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
      5. Права: PM — редактирование; его руководители, Собственник, команда и их руководители — просмотр и комментарии;
         группа PMO — просмотр, владельцы сайта — полный доступ. Цепочка руководителей берётся из Entra ID.
         Права выдаются записи проекта и папке проекта P<ID> в каждом дочернем списке; записи наследуют права папки
         (синхронизация переносит в папку записи, созданные в корне списка). Отчёты, комментарии, журнал и погодження —
         только чтение; риски и команду правит PM. Архивный проект — только чтение; после выдачи прав архива обычный
         запуск его не пересчитывает (пересчёт — -RebuildPermissions).
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
    # кэш оргструктуры (руководители, имена, должности) между запусками; пусто — только на время запуска
    [string]$ManagerCache,
    [int]$ManagerCacheHours = 24,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$PMO_GROUP = "PMO-адміністратори"
# уровень прав «только добавление» (создаёт Deploy-PMO.ps1): отчёты, комментарии, погодження — созданную запись не правит никто, кроме синхронизации
$ROLE_ADD_NAME = "Портал: додавання"
$L_PROJ = "Lists/Projects"; $L_REP = "Lists/StatusReports"; $L_RISK = "Lists/RisksIssues"
$L_CHG  = "Lists/KeyChanges"; $L_CMT = "Lists/ProjectComments"; $L_TEAM = "Lists/ProjectTeam"; $L_AP = "Lists/ReportApprovals"
$stats = [ordered]@{ edits = 0; reports = 0; changes = 0; created = 0; comments = 0; types = 0; acl = 0; folders = 0; moved = 0; reset = 0; access = 0; feedback = 0; approvals = 0; members = 0; reminders = 0; warnings = 0 }

function Log([string]$m, [string]$c = "Gray") { Write-Host ("{0:HH:mm:ss} {1}" -f (Get-Date), $m) -ForegroundColor $c }
function Warn([string]$m) { $stats.warnings++; Write-Warning $m }

# ---------------------------------------------------------------------------
# Подключение
# ---------------------------------------------------------------------------
if (-not ($ManagedIdentity -or $Thumbprint -or $CertificatePath)) { throw "Укажите -Thumbprint, -CertificatePath или -ManagedIdentity (синхронизация работает от имени приложения)." }
# один запуск за раз: параллельные запуски конфликтуют при выдаче прав («Конфлікт версій»); пробный запуск ничего не пишет
if (-not $DryRun) {
    $LOCK = Join-Path ([IO.Path]::GetTempPath()) ("pmo-sync-{0}.lock" -f ([uri]$SiteUrl).AbsolutePath.Trim('/').Replace('/', '-'))
    if (Test-Path $LOCK) {
        $other = [int](Get-Content -Raw $LOCK -ErrorAction SilentlyContinue)
        if ($other -and $other -ne $PID -and (Get-Process -Id $other -ErrorAction SilentlyContinue)) { Log "Синхронизация уже выполняется (процесс $other) — этот запуск пропущен" "Yellow"; return }
    }
    Set-Content -Path $LOCK -Value $PID -NoNewline
}
# вход с одной повторной попыткой: сразу после пробуждения компьютера часы могут быть ещё не сверены (AADSTS700024)
for ($try = 1; $try -le 2; $try++) {
    try {
        if ($ManagedIdentity)      { Connect-PnPOnline -Url $SiteUrl -ManagedIdentity }
        elseif ($Thumbprint)       { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
        elseif ($CertificatePath)  { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
        break
    } catch {
        if ($try -eq 2) { throw }
        Write-Warning "Вход не удался ($($_.Exception.Message.Split([Environment]::NewLine)[0])) — повтор через 60 с"; Start-Sleep -Seconds 60
    }
}
Log "Подключено: $SiteUrl" "Cyan"
if ($DryRun) { Log "Режим DryRun: изменения не записываются" "Yellow" }

$roles = Get-PnPRoleDefinition
$ROLE = @{
    full = ($roles | Where-Object RoleTypeKind -eq "Administrator" | Select-Object -First 1).Name
    edit = ($roles | Where-Object RoleTypeKind -eq "Contributor"   | Select-Object -First 1).Name
    read = ($roles | Where-Object RoleTypeKind -eq "Reader"        | Select-Object -First 1).Name
    # «только добавление» (отчёты, комментарии, погодження): создаёт Deploy-PMO.ps1; до развёртывания — прежняя модель прав
    add  = ($roles | Where-Object Name -eq $ROLE_ADD_NAME | Select-Object -First 1).Name
}
# модель прав v2 (роль «додавання», запись сразу в папку проекта) — только когда роль уже есть на сайте
$PERM_V2 = [bool]$ROLE.add
if (-not $PERM_V2) { Warn "Немає рівня дозволів «$ROLE_ADD_NAME» — спочатку Deploy-PMO.ps1; права видаються за попередньою моделлю" }
$OWNERS = (Get-PnPGroup -AssociatedOwnerGroup).Title
$OWNER_EMAILS = @(Get-PnPGroupMember -Group $OWNERS | ForEach-Object { ([string]$_.Email).ToLowerInvariant() } | Where-Object { $_ })

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

# Решение PMO по статус-отчёту (общие векторы tests/cases/approval.json). $rep: s, b, r, approval; $ap: decision, s, b, r, note или $null.
# Пустой цвет PMO — без изменений; смена цвета или возврат — только с комментарием; решённый отчёт повторно не решается.
function Get-ApprovalResult($rep, $ap) {
    $cur = if ($rep.approval) { [string]$rep.approval } else { "На погодженні" }
    $out = [ordered]@{ valid = $true; decision = $cur; s = [string]$rep.s; b = [string]$rep.b; r = [string]$rep.r; rag = ""; apply = ($cur -eq "Погоджено"); changed = @() }
    if ($ap) {
        $note = ([string]$ap.note).Trim()
        $new = @{ s = $(if ($ap.s) { [string]$ap.s } else { $out.s }); b = $(if ($ap.b) { [string]$ap.b } else { $out.b }); r = $(if ($ap.r) { [string]$ap.r } else { $out.r }) }
        $chg = @(@("s", "b", "r") | Where-Object { $new[$_] -ne $out[$_] })
        if ($cur -ne "На погодженні") { $out.valid = $false }
        elseif ($ap.decision -eq "Повернуто") { if ($note) { $out.decision = "Повернуто" } else { $out.valid = $false } }
        elseif ($ap.decision -eq "Погоджено") {
            if ($chg.Count -and -not $note) { $out.valid = $false }
            else { $out.decision = "Погоджено"; $out.apply = $true; $out.changed = $chg; foreach ($k in $chg) { $out[$k] = $new[$k] } }
        }
        else { $out.valid = $false }
    }
    $out.rag = CalcRag $out.s $out.b $out.r
    return [pscustomobject]$out
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
                   pmManager = "PM"; pmOwner = "Власник"; pmStakeholders = "Стейкхолдери"; pmBudget = "Бюджет (план)"
                   pmTeam = "Команда проєкту"; pmLinks = "Посилання"
                   srSchedule = "Терміни"; srBudget = "Бюджет"; srResources = "Ресурси"; srApproval = "Погодження звіту" }
function EditLogRows([string]$json) {
    # {"entries":[{"when","who","reason","diffs":[{"f","from","to"}]}]} -> строки журнала; повреждённое содержимое — пусто
    $key = @{ title = "Title"; code = "pmCode"; dept = "pmDepartment"; loop = "pmLoop"; prio = "pmPriority"; pm = "pmManager"
              owner = "pmOwner"; stakeholders = "pmStakeholders"; budget = "pmBudget"; team = "pmTeam"; links = "pmLinks" }
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
    if ($DryRun) { Log "    журнал: [$kind] $($DISPLAY[$field] ?? $EDIT_DISPLAY[$field] ?? $field): $from -> $to"; return }
    $vals = @{ Title = ($DISPLAY[$field] ?? $EDIT_DISPLAY[$field] ?? "Проєкт"); kcProject = $projectId; kcDate = ($when ?? (Get-Date).ToUniversalTime().ToString("o"))
               kcKind = $kind; kcField = $field; kcFrom = $from; kcTo = $to; kcReason = $reason }
    if ($who) { $vals.kcChangedBy = $who }
    # сразу в папку проекта (права папки), если она уже есть; иначе — в корень, раздел 5 перенесёт в этом же запуске
    $dir = @{}; if ($FOLDERS[$L_CHG] -and $FOLDERS[$L_CHG].ContainsKey((Get-FolderName $projectId))) { $dir.Folder = Get-FolderName $projectId }
    try { Add-PnPListItem -List $L_CHG -Values $vals @dir | Out-Null }
    catch { if ($who) { $vals.Remove("kcChangedBy"); Add-PnPListItem -List $L_CHG -Values $vals @dir | Out-Null } else { throw } }
}

# ---------------------------------------------------------------------------
# Папки проектов: в каждом дочернем списке папка P<ID проекта>; права выдаются папке, записи их наследуют
# ---------------------------------------------------------------------------
function Get-FolderName($projectId) { return "P$([int]$projectId)" }
# Роль человека на папке проекта (модель v2). Отчёты — PM «только добавление» (созданный отчёт не правится);
# комментарии — всем, кто видит активный проект, «только добавление»; журнал и погодження — чтение;
# риски, команда и сам проект — PM правит. Архив — только чтение всем, комментариев нет. Векторы tests/cases/folders.json.
# Без роли «додавання» на сайте ($v2 = false) — прежняя модель: отчёты и комментарии — чтение.
function Get-FolderRole([string]$list, [string]$level, [bool]$archived, [bool]$v2 = $true) {
    if ($archived) { return "read" }
    switch ($list) {
        "Lists/ProjectComments" { if ($v2) { return "add" } return "read" }
        "Lists/StatusReports"   { if ($v2 -and $level -eq "edit") { return "add" } return "read" }
        "Lists/KeyChanges"      { return "read" }
        "Lists/ReportApprovals" { return "read" }
    }
    if ($level -eq "edit") { return "edit" }
    return "read"
}
# Группа PMO на папке: погодження и комментарии активного проекта — «только добавление» (PMO решает и комментирует), остальное — чтение
function Get-GroupFolderRole([string]$list, [bool]$archived, [bool]$v2 = $true) {
    if ($v2 -and -not $archived -and $list -in @("Lists/ReportApprovals", "Lists/ProjectComments")) { return "add" }
    return "read"
}
# Отметка прав в pmoAcl проекта и его папок: хэш круга людей; у архивного — префикс «arch:» (не из алфавита хэша 0-9A-F).
# Модель v2 — префиксы «v2:» / «arch2:»: смена модели меняет отметку, и папки получают новые роли (переход — rebuild-permissions).
function Get-AclMark([string]$aclHash, [bool]$archived, [bool]$v2 = $true) {
    if ($v2) { if ($archived) { return "arch2:$aclHash" } return "v2:$aclHash" }
    if ($archived) { return "arch:$aclHash" } return $aclHash
}
function Get-ArchPrefix([bool]$v2 = $true) { if ($v2) { return "arch2:" } return "arch:" }
# Архивный проект не пересчитывается обычным запуском, если права архива уже выданы проекту и всем его папкам.
# Еженедельный -RebuildPermissions пересчитывает и архив (смена руководителей в Entra ID).
function Test-ArchiveFrozen([string]$status, [string]$pmoAcl, [bool]$foldersReady, [bool]$rebuild, [string]$prefix = "arch2:") {
    return ($status -eq "Архівний") -and $pmoAcl.StartsWith($prefix) -and $foldersReady -and -not $rebuild
}
# Что сделать с записью дочернего списка: «move» — не в папке своего проекта (перенос + сброс личных прав); «reset» — в своей папке,
# но с личными правами (непустой pmoAcl — его писала прежняя выдача прав записи); пусто — ничего.
# Пока папке не выданы права проекта ($folderReady), запись не трогаем: иначе после сброса она наследовала бы права всего списка.
function Get-RowAction([string]$dir, [string]$expected, [string]$pmoAcl, [bool]$folderReady) {
    if (-not $folderReady) { return "" }
    if ($dir.TrimEnd("/") -ne $expected.TrimEnd("/")) { return "move" }
    if ($pmoAcl) { return "reset" }
    return ""
}

# ---------------------------------------------------------------------------
# Загрузка
# ---------------------------------------------------------------------------
Log "Загрузка списков…"
$CTX = Get-PnPContext
$WEBREL = (Get-PnPWeb -Includes ServerRelativeUrl).ServerRelativeUrl.TrimEnd("/")
# записи дочернего списка без папок (Get-PnPListItem возвращает и записи из папок, и сами папки)
function Get-ListRows([string]$list) {
    $rows = [System.Collections.Generic.List[object]]::new()
    foreach ($it in @(Get-PnPListItem -List $list -PageSize 500)) { if ($it -and [string]$it.FileSystemObjectType -ne "Folder") { $rows.Add($it) } }
    return , $rows
}
# папки проектов списка: имя -> @{ id; mark } (через RootFolder — без запроса по списку, порог 5000 не касается)
$FOLDERS = @{}
function Read-Folders([string]$list) {
    $l = Get-PnPList -Identity $list
    $fs = $l.RootFolder.Folders; $CTX.Load($fs); Invoke-PnPQuery -RetryCount 10
    foreach ($f in $fs) { $CTX.Load($f.ListItemAllFields) }; Invoke-PnPQuery -RetryCount 10
    $FOLDERS[$list] = @{}
    foreach ($f in $fs) { if ($f.Name -match '^P\d+$') { $FOLDERS[$list][$f.Name] = @{ id = $f.ListItemAllFields.Id; mark = [string]$f.ListItemAllFields["pmoAcl"] } } }
}
$projects = Get-PnPListItem -List $L_PROJ -PageSize 500
$reports  = Get-ListRows $L_REP
$risks    = Get-ListRows $L_RISK
$comments = Get-ListRows $L_CMT
# команда проекта: люди из строк команды — стейкхолдеры (просмотр и комментарии)
# новые списки раунда 2 появляются с Deploy-PMO.ps1; до развёртывания синхронизация работает по-прежнему
$HAS_TEAM = [bool](Get-PnPList -Identity $L_TEAM -ErrorAction SilentlyContinue)
$HAS_AP   = [bool](Get-PnPList -Identity $L_AP -ErrorAction SilentlyContinue)
function Get-ItemsIfExists([string]$list, [bool]$has) { if ($has) { return , (Get-ListRows $list) } return @() }
# дочерние списки: поле ссылки на проект
$CHILD = [ordered]@{ $L_REP = "srProject"; $L_RISK = "riProject"; $L_CMT = "cmProject"; $L_CHG = "kcProject" }
if ($HAS_TEAM) { $CHILD[$L_TEAM] = "tmProject" }
if ($HAS_AP)   { $CHILD[$L_AP] = "apProject" }
foreach ($l in $CHILD.Keys) { Read-Folders $l }
$teamItems = Get-ItemsIfExists $L_TEAM $HAS_TEAM
$TEAM = @{}
foreach ($it in @($teamItems)) { if (-not $it) { continue }
    $lk = $it["tmProject"]; $e = Email $it["tmUser"]
    if (-not $lk -or -not $e) { continue }
    if (-not $TEAM.ContainsKey($lk.LookupId)) { $TEAM[$lk.LookupId] = @() }
    if ($TEAM[$lk.LookupId] -notcontains $e) { $TEAM[$lk.LookupId] += $e }
}
function Get-Stakeholders($item) {
    # после миграции (Deploy-PMO.ps1, отметка «team») источник — «Команда проєкту»; до неё — pmStakeholders
    if ($HAS_TEAM -and ([string]$item["pmMigrated"]).Split(",") -contains "team") { return @($TEAM[$item.Id] ?? @()) }
    return @(Emails $item["pmStakeholders"])
}
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
# 0. Погодження PMO -> статус-отчёт (решение, цвета, комментарий), журнал «Погодження звіту»
# ---------------------------------------------------------------------------
$PMO_EMAILS = @(Get-PnPGroupMember -Group $PMO_GROUP | ForEach-Object { ([string]$_.Email).ToLowerInvariant() } | Where-Object { $_ })
$REPBYID = @{}; foreach ($r in $reports) { $REPBYID[$r.Id] = $r }
$RAGF = [ordered]@{ s = "srSchedule"; b = "srBudget"; r = "srResources" }
$approvals = Get-ItemsIfExists $L_AP $HAS_AP
foreach ($a in (@($approvals) | Where-Object { $_ } | Where-Object { $_["apApplied"] -ne $true } | Sort-Object Id)) {
    $lk = $a["apReport"]; $r = if ($lk) { $REPBYID[$lk.LookupId] } else { $null }
    $who = Email $a["Author"]
    $done = $true
    if (-not $r) { Warn "Погодження #$($a.Id): звіт не знайдено" }
    elseif ($PMO_EMAILS -notcontains $who -and $OWNER_EMAILS -notcontains $who) { Warn "Погодження #$($a.Id) від $who — не PMO: не застосовано" }
    else {
        $res = Get-ApprovalResult @{ s = (Norm $r["srSchedule"]); b = (Norm $r["srBudget"]); r = (Norm $r["srResources"]); approval = (Norm $r["srApproval"]) } `
                                  @{ decision = (Norm $a["apDecision"]); s = (Norm $a["apSchedule"]); b = (Norm $a["apBudget"]); r = (Norm $a["apResources"]); note = [string]$a["apNote"] }
        if (-not $res.valid) { Warn "Погодження #$($a.Id) звіту #$($r.Id) не прийнято: звіт уже вирішено або немає коментаря" }
        else {
            $stats.approvals++
            $note = ([string]$a["apNote"]).Trim()
            $when = $a["Created"].ToUniversalTime().ToString("o")
            $pid_ = $r["srProject"].LookupId
            Log "  погодження #$($a.Id): звіт #$($r.Id) — $($res.decision)$(if ($res.changed.Count) { ', оцінки: ' + ($res.changed -join ',') })"
            $vals = @{ srApproval = $res.decision; srApprovedBy = $who; srApprovedAt = $when; srApprovalNote = $note }
            foreach ($k in $res.changed) {
                $vals[$RAGF[$k]] = $res.$k
                Add-Change $pid_ $RAGF[$k] (Norm $r[$RAGF[$k]]) $res.$k "Погодження звіту" $who $note $when
            }
            if (-not $res.changed.Count) { Add-Change $pid_ "srApproval" "На погодженні" $res.decision "Погодження звіту" $who $note $when }
            if (-not $DryRun) {
                try { Set-PnPListItem -List $L_REP -Identity $r.Id -Values $vals -UpdateType SystemUpdate | Out-Null }
                catch { Warn "Звіт #$($r.Id): $($_.Exception.Message)"; $done = $false }
            }
            # в памяти — для переноса в карточку ниже (и в пробном запуске)
            foreach ($k in @("srApproval") + @($res.changed | ForEach-Object { $RAGF[$_] })) { $r[$k] = $vals[$k] }
        }
    }
    if ($done -and -not $DryRun) { Set-PnPListItem -List $L_AP -Identity $a.Id -Values @{ apApplied = $true } -UpdateType SystemUpdate | Out-Null }
}

# ---------------------------------------------------------------------------
# 1. Статус-отчёты -> карточка проекта, журнал, архив (только погоджені PMO)
# ---------------------------------------------------------------------------
$pending = $reports | Where-Object { $_["srApplied"] -ne $true -and (-not $HAS_AP -or (Norm $_["srApproval"]) -eq "Погоджено") } |
    Sort-Object @{ Expression = { DateOnly $_["srDate"] } }, @{ Expression = { $_.Id } }
foreach ($r in $pending) {
    $lk = $r["srProject"]; if (-not $lk) { continue }
    $p = $PROJ[$lk.LookupId]; if (-not $p) { Warn "Отчёт $($r.Id): проект $($lk.LookupId) не найден"; continue }
    $stats.reports++
    $repDate = DateOnly $r["srDate"]
    $rag     = CalcRag $r["srSchedule"] $r["srBudget"] $r["srResources"]
    $newer   = (-not $p.Values.pmLastUpdate) -or ($repDate -ge $p.Values.pmLastUpdate)
    $author  = Email $r["Author"]
    # статус-отчёт меняет карточку, только если его сдал PM проекта (или владелец сайта); приложение других не пускает
    if ($author -ne (Email $p.Item["pmManager"]) -and $OWNER_EMAILS -notcontains $author) {
        Warn "Звіт #$($r.Id) від $author — не PM проєкту «$($p.Item["Title"])»: не застосовано"; $stats.reports--; continue
    }
    $title   = [string]$r["Title"]
    $reason  = @($r["srKeyReason"], $title) | Where-Object { $_ } | Join-String -Separator " · "
    Log "  звіт #$($r.Id) ($repDate) -> «$($p.Item["Title"])»"

    $target = [ordered]@{}
    foreach ($src in $MAP.Keys) {
        $v = Norm $r[$src]
        if ($v -ne "") { $target[$MAP[$src]] = $v }
    }
    if ($target.pmStatus -in @("Завершено", "Скасовано")) { $target.pmStatus = "Архівний"; $target.pmArchivedAt = $repDate }
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
# 2b. Відгуки → «Відгуки — загальні» (тест с фокус-группой): копия без скриншотов для страницы «Відгуки»
# ---------------------------------------------------------------------------
if ((Get-PnPList -Identity "Lists/Feedback" -ErrorAction SilentlyContinue) -and (Get-PnPList -Identity "Lists/FeedbackPublic" -ErrorAction SilentlyContinue)) {
    $pub = @{}
    foreach ($x in (Get-PnPListItem -List "Lists/FeedbackPublic" -PageSize 500)) { if ($x["fpId"]) { $pub[[int]$x["fpId"]] = $x } }
    foreach ($fb in (Get-PnPListItem -List "Lists/Feedback" -PageSize 500)) {
        $shots = if ($fb["Attachments"]) { @(Get-PnPProperty -ClientObject $fb -Property AttachmentFiles).Count } else { 0 }
        $vals = [ordered]@{ Title = ([string]$fb["Title"]); fpId = $fb.Id; fpCreated = $fb["Created"]; fpAuthor = [string]$fb["Author"].LookupValue
                  fpScreen = [string]$fb["fbScreen"]; fpText = [string]$fb["fbText"]; fpStatus = ([string]$fb["fbStatus"]); fpAnswer = [string]$fb["fbAnswer"]; fpShots = $shots }
        $old = $pub[$fb.Id]
        $same = $old -and ((Norm $old["fpText"]) -eq $vals.fpText) -and ((Norm $old["fpStatus"]) -eq $vals.fpStatus) -and ((Norm $old["fpAnswer"]) -eq $vals.fpAnswer) -and ([int]$old["fpShots"] -eq $shots) -and ((Norm $old["fpScreen"]) -eq $vals.fpScreen)
        if ($same) { continue }
        $stats.feedback++
        if ($DryRun) { Log ("  відгук #{0} → загальний список ({1})" -f $fb.Id, $vals.fpStatus); continue }
        if ($old) { Set-PnPListItem -List "Lists/FeedbackPublic" -Identity $old.Id -Values $vals -UpdateType SystemUpdate | Out-Null }
        else      { Add-PnPListItem -List "Lists/FeedbackPublic" -Values $vals | Out-Null }
    }
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
$MGR = @{}; $PEOPLE = @{}; $MGRFAIL = @{}
# оргструктура из Entra ID меняется редко: руководители, имена и должности читаются не чаще раза в -ManagerCacheHours
# (по умолчанию сутки); полный пересчёт прав (-RebuildPermissions) кэш не использует и читает всё заново
$cacheSaved = $null
if ($ManagerCache -and -not $RebuildPermissions -and (Test-Path $ManagerCache)) {
    try {
        $c = Get-Content -Raw $ManagerCache | ConvertFrom-Json -AsHashtable
        $age = (Get-Date).ToUniversalTime() - ([datetime]$c.saved).ToUniversalTime()
        if ($age.TotalHours -lt $ManagerCacheHours) {
            $cacheSaved = ([datetime]$c.saved).ToUniversalTime().ToString("o")
            foreach ($k in $c.mgr.Keys) { $MGR[$k] = [string]$c.mgr[$k] }
            foreach ($k in $c.people.Keys) { $PEOPLE[$k] = @{ n = [string]$c.people[$k].n; j = [string]$c.people[$k].j } }
            Log ("Оргструктура из кэша ({0:n0} ч назад): {1} человек" -f $age.TotalHours, $MGR.Count)
        }
    } catch { Warn "Кэш оргструктуры не прочитан, читаю Entra ID: $($_.Exception.Message)" }
}
# человек из Entra ID: имя и должность для «Доступ до картки» (кэш на запуск)
function Get-Person([string]$email) {
    if (-not $email) { return @{ n = ""; j = "" } }
    if (-not $PEOPLE.ContainsKey($email)) {
        try {
            $u = Invoke-PnPGraphMethod -Url ("v1.0/users/{0}?`$select=displayName,jobTitle" -f [uri]::EscapeDataString($email)) -Method Get
            $PEOPLE[$email] = @{ n = [string]$u.displayName; j = [string]$u.jobTitle }
        } catch { $PEOPLE[$email] = @{ n = ""; j = "" } }
    }
    return $PEOPLE[$email]
}
function Get-Chain([string]$email) {
    $chain = @(); $cur = $email; $depth = 0
    while ($cur -and $depth -lt $MaxManagerDepth) {
        if (-not $MGR.ContainsKey($cur)) {
            try {
                $m = Invoke-PnPGraphMethod -Url ("v1.0/users/{0}/manager?`$select=mail,userPrincipalName,displayName,jobTitle" -f [uri]::EscapeDataString($cur)) -Method Get
                $MGR[$cur] = ([string]($m.mail ?? $m.userPrincipalName)).ToLowerInvariant()
                if ($MGR[$cur] -and -not $PEOPLE.ContainsKey($MGR[$cur])) { $PEOPLE[$MGR[$cur]] = @{ n = [string]$m.displayName; j = [string]$m.jobTitle } }
            } catch {
                # «нет руководителя» (404) — сохраняем; другой сбой — только на этот запуск, в кэш не пишем
                $MGR[$cur] = ""
                if ([string]$_.Exception.Message -notmatch 'Request_ResourceNotFound|NotFound|404|does not exist|not present') { $MGRFAIL[$cur] = 1 }
            }
        }
        $cur = $MGR[$cur]
        if ($cur -and $chain -notcontains $cur -and $cur -ne $email) { $chain += $cur } else { break }
        $depth++
    }
    return $chain
}
# Кто видит проект и что может (общие векторы tests/cases/acl.json). Править — только PM;
# его руководители, собственник, стейкхолдеры и их руководители — просмотр и комментарии.
# Порядок — как «Доступ до картки» в прототипе; первое вхождение человека побеждает. Архив — всем просмотр.
function Get-Access([string]$pm, [string]$owner, [string[]]$st, [scriptblock]$chain, [bool]$archived) {
    $list = [System.Collections.Generic.List[object]]::new(); $seen = @{}
    $add = { param($e, $l, $r) if (-not $e -or $seen.ContainsKey($e)) { return }; $seen[$e] = 1; $list.Add([ordered]@{ e = $e; l = $l; r = $r }) }
    & $add $pm "edit" "pm"
    foreach ($m in (& $chain $pm)) { & $add $m "read" "pmMgr" }
    & $add $owner "read" "owner"
    foreach ($x in $st) { & $add $x "read" "stake" }
    foreach ($x in @($owner) + @($st)) { if ($x) { foreach ($m in (& $chain $x)) { & $add $m "read" "mgr" } } }
    if ($archived) { foreach ($a in $list) { $a.l = "read" } }
    return , $list
}
function Get-Acl($access) {
    $acl = [ordered]@{}
    foreach ($a in $access) { $acl[$a.e] = $a.l }
    return $acl
}
function Get-Hash($acl) {
    $s = ($acl.Keys | Sort-Object | ForEach-Object { "$_=$($acl[$_])" }) -join ";"
    $bytes = [System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($s))
    return ([Convert]::ToHexString($bytes)).Substring(0, 24)
}
# Права записи — одним пакетным запросом CSOM: сброс, группа PMO, владельцы, люди и отметка pmoAcl.
# Люди, группы, роли и списки ищутся один раз за запуск (кэш), а не для каждой записи. При ответе 429 — повтор с паузой.
$RD = @{}; $PRINCIPAL = @{}; $LISTOBJ = @{}
function Get-Rd([string]$name) { if (-not $RD.ContainsKey($name)) { $RD[$name] = $CTX.Web.RoleDefinitions.GetByName($name) }; return $RD[$name] }
function Get-ListObj([string]$list) { if (-not $LISTOBJ.ContainsKey($list)) { $LISTOBJ[$list] = Get-PnPList -Identity $list }; return $LISTOBJ[$list] }
function Get-Principal([string]$key, [bool]$group) {
    if (-not $PRINCIPAL.ContainsKey($key)) {
        try {
            $pr = if ($group) { $CTX.Web.SiteGroups.GetByName($key) } else { $CTX.Web.EnsureUser($key) }
            $CTX.Load($pr); Invoke-PnPQuery -RetryCount 10; $PRINCIPAL[$key] = $pr
        } catch { Warn "Не найден на сайте: $key ($($_.Exception.Message))"; $PRINCIPAL[$key] = $null }
    }
    return $PRINCIPAL[$key]
}
# Права записи проекта или папки проекта: $list — для роли (Get-FolderRole), $acl — e-mail -> уровень, $aclMark — отметка в pmoAcl
function Set-ItemAcl([string]$list, [int]$id, $acl, [string]$aclMark, [string]$what, [bool]$archived) {
    $stats.acl++
    if ($DryRun) { Log ("    права: {0} -> {1}" -f $what, (($acl.Keys | ForEach-Object { "$_($(Get-FolderRole $list $acl[$_] $archived $PERM_V2))" }) -join ", ")); return }
    # PMO видит все проекты, правит, как все, только свои (как PM), в папках — погодження и комментарии; владельцы сайта — полный доступ
    $grants = @(@{ p = (Get-Principal $PMO_GROUP $true); r = $ROLE[(Get-GroupFolderRole $list $archived $PERM_V2)] }, @{ p = (Get-Principal $OWNERS $true); r = $ROLE.full })
    $ok = $true
    foreach ($e in $acl.Keys) {
        $pr = Get-Principal $e $false
        if (-not $pr) { $ok = $false; continue }
        $grants += @{ p = $pr; r = $ROLE[(Get-FolderRole $list $acl[$e] $archived $PERM_V2)] }
    }
    if (-not $grants[0].p -or -not $grants[1].p) { Warn "Нет группы PMO или владельцев — права $what не изменены"; return }
    try {
        $item = (Get-ListObj $list).GetItemById($id)
        $item.ResetRoleInheritance()
        $item.BreakRoleInheritance($false, $false)
        foreach ($g in $grants) {
            $b = [Microsoft.SharePoint.Client.RoleDefinitionBindingCollection]::new($CTX)
            $b.Add((Get-Rd $g.r))
            $item.RoleAssignments.Add($g.p, $b) | Out-Null
        }
        # отметка «права выданы» — только если выдано всё: иначе следующий запуск повторит
        if ($ok) { $item["pmoAcl"] = $aclMark; $item.SystemUpdate() }
        Invoke-PnPQuery -RetryCount 10
        return $ok
    } catch { Warn "Не удалось выдать права $what : $($_.Exception.Message) — повторим в следующий запуск" }
}

Log "Права доступа…"
$ACLS = @{}; $MARK = @{}
$frozen = 0
$chainOf = { param($e) Get-Chain $e }
foreach ($p in $PROJ.Values) {
    $st = Get-Stakeholders $p.Item
    # pmStakeholders повторяет команду (представления списка, совместимость)
    $old = @(Emails $p.Item["pmStakeholders"])
    if ((@($old | Sort-Object) -join ";") -ne (@($st | Sort-Object) -join ";")) {
        if ($DryRun) { Log "  стейкхолдери «$($p.Item["Title"])»: $($st -join ', ')" }
        else {
            try { Set-PnPListItem -List $L_PROJ -Identity $p.Item.Id -Values @{ pmStakeholders = @($st) } -UpdateType SystemUpdate | Out-Null }
            catch { Warn "Стейкхолдери «$($p.Item["Title"])»: $($_.Exception.Message)" }
        }
    }
    $archived = $p.Values.pmStatus -eq "Архівний"
    $name = Get-FolderName $p.Item.Id
    $ready = -not @($CHILD.Keys | Where-Object { -not $FOLDERS[$_].ContainsKey($name) -or $FOLDERS[$_][$name].mark -ne $p.Values.pmoAcl }).Count
    # архив, права которого уже выданы проекту и папкам: без Entra ID, без «Доступ до картки», без прав (пересчёт — воскресный rebuild)
    if (Test-ArchiveFrozen $p.Values.pmStatus $p.Values.pmoAcl $ready ([bool]$RebuildPermissions) (Get-ArchPrefix $PERM_V2)) { $frozen++; $MARK[$p.Item.Id] = $p.Values.pmoAcl; continue }
    $access = Get-Access (Email $p.Item["pmManager"]) (Email $p.Item["pmOwner"]) $st $chainOf $archived
    $acl = Get-Acl $access
    $h = Get-AclMark (Get-Hash $acl) $archived $PERM_V2
    # «Доступ до картки» в приложении: имя и должность из Entra ID, пишется только при изменении
    $rows = @($access | Select-Object -First 200 | ForEach-Object { $who = Get-Person $_.e; [ordered]@{ e = $_.e; n = $who.n; j = $who.j; l = $_.l; r = $_.r } })
    $json = ConvertTo-Json -InputObject ([ordered]@{ v = 1; more = [math]::Max(0, $access.Count - 200); people = $rows }) -Depth 5 -Compress
    if ((Norm $p.Item["pmAccess"]) -ne $json) {
        $stats.access++
        if ($DryRun) { Log "  доступ «$($p.Item["Title"])»: $($access.Count) людей" }
        else { Set-PnPListItem -List $L_PROJ -Identity $p.Item.Id -Values @{ pmAccess = $json } -UpdateType SystemUpdate | Out-Null }
    }
    $ACLS[$p.Item.Id] = $acl; $MARK[$p.Item.Id] = $h
    if ($RebuildPermissions -or $p.Values.pmoAcl -ne $h) {
        Log "  проєкт «$($p.Item["Title"])»: $($acl.Count) користувачів"
        Set-ItemAcl $L_PROJ $p.Item.Id $acl $h "проєкт #$($p.Item.Id)" $archived | Out-Null
    }
    # папки проекта в дочерних списках: создать недостающую, выдать права при смене круга людей
    foreach ($l in $CHILD.Keys) {
        $f = $FOLDERS[$l][$name]
        if (-not $f) {
            $stats.folders++
            if ($DryRun) { Log "    папка: + $l/$name"; continue }
            try {
                $null = Add-PnPFolder -Name $name -Folder $l
                $fi = Get-PnPFolder -Url "$l/$name" -Includes ListItemAllFields
                $f = @{ id = $fi.ListItemAllFields.Id; mark = "" }; $FOLDERS[$l][$name] = $f
            } catch { Warn "Папка $l/$name не создана: $($_.Exception.Message)"; continue }
        }
        if ($RebuildPermissions -or $f.mark -ne $h) {
            if (Set-ItemAcl $l $f.id $acl $h "$l/$name" $archived) { $f.mark = $h }
        }
    }
}
if ($frozen) { Log "  архів: пропущено $frozen (права вже видано)" }
# участники сайта: каждый, у кого есть права хотя бы на один проект (PM, власник, команда, руководители), должен открыть портал —
# страница портала доступна только участникам сайта. Только добавляем: людей из группы синхронизация не убирает.
$MEMBERS = Get-PnPGroup -AssociatedMemberGroup
$inMembers = @{}
foreach ($x in @(Get-PnPGroupMember -Group $MEMBERS)) { foreach ($k in @([string]$x.Email, ([string]$x.LoginName -replace '^.*\|', ''))) { if ($k) { $inMembers[$k.ToLowerInvariant()] = 1 } } }
$needed = @($ACLS.Values | ForEach-Object { $_.Keys } | ForEach-Object { ([string]$_).ToLowerInvariant() } | Sort-Object -Unique)
foreach ($e in $needed) {
    if ($inMembers.ContainsKey($e)) { continue }
    $stats.members++
    if ($DryRun) { Log "  учасник сайту: + $e"; continue }
    try { Add-PnPGroupMember -Group $MEMBERS -LoginName "i:0#.f|membership|$e" | Out-Null; Log "  учасник сайту: + $e" }
    catch { Warn "Не удалось добавить $e в участники сайта: $($_.Exception.Message)" }
}

# Записи дочерних списков -> в папку своего проекта (перечитываем: в этом запуске могли появиться новые строки журнала).
# Перенос сохраняет ID, автора, даты, связи и версии; личные права записи сбрасываются — она наследует права папки.
# Порядок для одной записи: перенос, сброс прав, очистка pmoAcl — при сбое посередине следующий запуск повторит.
foreach ($l in $CHILD.Keys) {
    foreach ($it in (Get-ListRows $l)) {
        $lk = $it[$CHILD[$l]]; if (-not $lk -or -not $PROJ.ContainsKey($lk.LookupId)) { continue }
        $name = Get-FolderName $lk.LookupId
        $dir = "$WEBREL/$l/$name"
        # папка с правами проекта: отметка папки = отметке проекта этого запуска (в пробном запуске права не выдаются — считаем готовой)
        $f = $FOLDERS[$l][$name]
        $act = Get-RowAction ([string]$it["FileDirRef"]) $dir ([string]$it["pmoAcl"]) ($DryRun -or ($f -and $f.mark -and $f.mark -eq $MARK[$lk.LookupId]))
        if (-not $act) { continue }
        if ($act -eq "move") { $stats.moved++ } else { $stats.reset++ }
        if ($DryRun) { Log ("    {0}: {1} #{2} -> {3}" -f $(if ($act -eq "move") { "перенос" } else { "сброс прав" }), $l, $it.Id, $name); continue }
        try {
            if ($act -eq "move") {
                $file = $CTX.Web.GetFileByServerRelativePath([Microsoft.SharePoint.Client.ResourcePath]::FromDecodedUrl([string]$it["FileRef"]))
                $file.MoveToUsingPath([Microsoft.SharePoint.Client.ResourcePath]::FromDecodedUrl("$dir/$($it["FileLeafRef"])"), [Microsoft.SharePoint.Client.MoveOperations]::None)
            }
            # после переноса — всегда сброс: запись могла остаться с частично выданными личными правами без отметки
            if ($act -eq "move" -or $it["pmoAcl"]) {
                $x = (Get-ListObj $l).GetItemById($it.Id)
                $x.ResetRoleInheritance(); $x["pmoAcl"] = ""; $x.SystemUpdate()
            }
            Invoke-PnPQuery -RetryCount 10
        } catch { Warn "Запись $l #$($it.Id) не перенесена в $name : $($_.Exception.Message) — повторим в следующий запуск" }
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
Log ("Списков доступа обновлено: {0}" -f $stats.access)
Log ("Отзывов в общий список: {0}" -f $stats.feedback)
Log ("Решений PMO по отчётам: {0}" -f $stats.approvals)
Log ("Добавлено участников сайта: {0}" -f $stats.members)
Log ("Папок создано: {0}, записей перенесено в папки: {1}, сброшено личных прав: {2}" -f $stats.folders, $stats.moved, $stats.reset)
Log ("Готово. Звітів: {0}, записів у журнал: {1}, нових проєктів: {2}, коментарів: {3}, типів: {4}, прав: {5}, нагадувань: {6}, попереджень: {7}" -f `
    $stats.reports, $stats.changes, $stats.created, $stats.comments, $stats.types, $stats.acl, $stats.reminders, $stats.warnings) "Green"
if ($ManagerCache -and -not $DryRun) {
    try {
        $mgrOut = [ordered]@{}; foreach ($k in $MGR.Keys) { if (-not $MGRFAIL.ContainsKey($k)) { $mgrOut[$k] = $MGR[$k] } }
        $pplOut = [ordered]@{}; foreach ($k in $PEOPLE.Keys) { $pplOut[$k] = [ordered]@{ n = $PEOPLE[$k].n; j = $PEOPLE[$k].j } }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ManagerCache) | Out-Null
        # срок кэша — от первого чтения Entra ID: новые люди дописываются, но не продлевают его
        $saved = if ($cacheSaved) { $cacheSaved } else { (Get-Date).ToUniversalTime().ToString("o") }
        [ordered]@{ saved = $saved; mgr = $mgrOut; people = $pplOut } | ConvertTo-Json -Depth 4 | Set-Content -Path $ManagerCache -Encoding utf8
    } catch { Warn "Кэш оргструктуры не сохранён: $($_.Exception.Message)" }
}
if ($LOCK) { Remove-Item $LOCK -ErrorAction SilentlyContinue }
