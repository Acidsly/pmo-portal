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
$L_CHG  = "Lists/KeyChanges"; $L_CMT = "Lists/ProjectComments"; $L_TEAM = "Lists/ProjectTeam"; $L_AP = "Lists/ReportApprovals"
$stats = [ordered]@{ edits = 0; reports = 0; changes = 0; created = 0; comments = 0; types = 0; acl = 0; access = 0; feedback = 0; approvals = 0; reminders = 0; warnings = 0 }

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
}
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
# команда проекта: люди из строк команды — стейкхолдеры (просмотр и комментарии)
# новые списки раунда 2 появляются с Deploy-PMO.ps1; до развёртывания синхронизация работает по-прежнему
$HAS_TEAM = [bool](Get-PnPList -Identity $L_TEAM -ErrorAction SilentlyContinue)
$HAS_AP   = [bool](Get-PnPList -Identity $L_AP -ErrorAction SilentlyContinue)
function Get-ItemsIfExists([string]$list, [bool]$has) { if ($has) { return @(Get-PnPListItem -List $list -PageSize 500) } return @() }
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
$MGR = @{}; $PEOPLE = @{}
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
            } catch { $MGR[$cur] = "" }
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
function Set-ItemAcl([string]$list, [int]$id, $acl, [bool]$readOnly, [string]$aclHash) {
    $stats.acl++
    if ($DryRun) { Log ("    права: {0} #{1} -> {2}" -f $list, $id, (($acl.Keys | ForEach-Object { "$_($(if ($readOnly) { 'read' } else { $acl[$_] }))" }) -join ", ")); return }
    # PMO видит все проекты, но правит, как все, только свои (как PM); владельцы сайта — полный доступ
    try {
        Set-PnPListItemPermission -List $list -Identity $id -Group $PMO_GROUP -AddRole $ROLE.read -ClearExisting -SystemUpdate | Out-Null
        Set-PnPListItemPermission -List $list -Identity $id -Group $OWNERS -AddRole $ROLE.full -SystemUpdate | Out-Null
    } catch { Warn "Не удалось сбросить права $list #$id : $($_.Exception.Message) — повторим в следующий запуск"; return }
    $ok = $true
    foreach ($e in $acl.Keys) {
        $roleName = if ($readOnly -or $acl[$e] -eq "read") { $ROLE.read } else { $ROLE.edit }
        try { Set-PnPListItemPermission -List $list -Identity $id -User $e -AddRole $roleName -SystemUpdate | Out-Null }
        catch { $ok = $false; Warn "Не удалось выдать права $e на $list #$id : $($_.Exception.Message)" }
    }
    # отметка «права выданы» — только если выдано всё: иначе следующий запуск повторит
    if ($ok) { Set-PnPListItem -List $list -Identity $id -Values @{ pmoAcl = $aclHash } -UpdateType SystemUpdate | Out-Null }
}

Log "Права доступа…"
$HASH = @{}; $ACLS = @{}
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
    $access = Get-Access (Email $p.Item["pmManager"]) (Email $p.Item["pmOwner"]) $st $chainOf ($p.Values.pmStatus -eq "Архівний")
    $acl = Get-Acl $access
    $h = Get-Hash $acl
    # «Доступ до картки» в приложении: имя и должность из Entra ID, пишется только при изменении
    $rows = @($access | Select-Object -First 200 | ForEach-Object { $who = Get-Person $_.e; [ordered]@{ e = $_.e; n = $who.n; j = $who.j; l = $_.l; r = $_.r } })
    $json = ConvertTo-Json -InputObject ([ordered]@{ v = 1; more = [math]::Max(0, $access.Count - 200); people = $rows }) -Depth 5 -Compress
    if ((Norm $p.Item["pmAccess"]) -ne $json) {
        $stats.access++
        if ($DryRun) { Log "  доступ «$($p.Item["Title"])»: $($access.Count) людей" }
        else { Set-PnPListItem -List $L_PROJ -Identity $p.Item.Id -Values @{ pmAccess = $json } -UpdateType SystemUpdate | Out-Null }
    }
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
    @($L_CHG,  (Get-PnPListItem -List $L_CHG  -PageSize 500), "kcProject", $true),
    @($L_TEAM, (Get-ItemsIfExists $L_TEAM $HAS_TEAM), "tmProject", $false),
    @($L_AP,   (Get-ItemsIfExists $L_AP $HAS_AP), "apProject", $true)
)
foreach ($c in $children) {
    foreach ($it in $c[1]) {
        $lk = $it[$c[2]]; if (-not $lk -or -not $HASH.ContainsKey($lk.LookupId)) { continue }
        # применённый статус-отчёт — только для чтения всем (история не переписывается); отметка «R» в хэше
        # статус-отчёт — только чтение после первой синхронизации (PMO погоджує, PM больше не правит отправленный)
        $ro = $c[3] -or $c[0] -eq $L_REP
        $h = $HASH[$lk.LookupId] + $(if ($c[0] -eq $L_REP -and $ro) { "R" } else { "" })
        if ($RebuildPermissions -or (Norm $it["pmoAcl"]) -ne $h) { Set-ItemAcl $c[0] $it.Id $ACLS[$lk.LookupId] $ro $h }
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
Log ("Готово. Звітів: {0}, записів у журнал: {1}, нових проєктів: {2}, коментарів: {3}, типів: {4}, прав: {5}, нагадувань: {6}, попереджень: {7}" -f `
    $stats.reports, $stats.changes, $stats.created, $stats.comments, $stats.types, $stats.acl, $stats.reminders, $stats.warnings) "Green"
if ($LOCK) { Remove-Item $LOCK -ErrorAction SilentlyContinue }
