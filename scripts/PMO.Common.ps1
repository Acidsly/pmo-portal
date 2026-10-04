# Общие функции скриптов портала: даты «только дата», нормализация значений, эталон ключевых полей («Еталон показників»).
# Подключается точкой (. PMO.Common.ps1) из Invoke-PMOSync.ps1 и скриптов, которые законно меняют ключевые поля карточки
# (Seed-TestData.ps1, Renumber-Projects.ps1, миграции Deploy-PMO.ps1): они обновляют эталон, иначе синхронизация вернула бы прежнее значение.

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
function Norm($v) {
    if ($null -eq $v) { return "" }
    if ($v -is [datetime]) { return DateOnly $v }
    # суммы и проценты — целые; x,5 — вверх (обычное округление, как в приложении), а не к чётному
    if ($v -is [double] -or $v -is [int] -or $v -is [decimal]) { return [string][math]::Round([double]$v, 0, [MidpointRounding]::AwayFromZero) }
    return [string]$v
}

# JSON без превращения строк в даты: ConvertFrom-Json в PowerShell 7.2–7.4 делает ISO-строки DateTime (а -DateKind есть
# только с 7.5) — поэтому System.Text.Json. Объект — упорядоченный словарь, массив — массив, строки — как есть.
function ConvertFrom-JsonElement($e) {
    switch ([string]$e.ValueKind) {
        "Object" { $h = [ordered]@{}; foreach ($pr in $e.EnumerateObject()) { $h[$pr.Name] = ConvertFrom-JsonElement $pr.Value }; return $h }
        "Array"  { $a = [System.Collections.Generic.List[object]]::new(); foreach ($x in $e.EnumerateArray()) { $a.Add((ConvertFrom-JsonElement $x)) }; return , $a.ToArray() }
        "String" { return $e.GetString() }
        "Number" { return $e.GetDouble() }
        "True"   { return $true }
        "False"  { return $false }
        default  { return $null }
    }
}
function ConvertFrom-JsonText([string]$json) {
    $doc = [System.Text.Json.JsonDocument]::Parse($json)
    try { return ConvertFrom-JsonElement $doc.RootElement } finally { $doc.Dispose() }
}

# ---------------------------------------------------------------------------
# Эталон: ключевые поля, которые меняет только погоджений статус-отчёт (и создание проекта PMO).
# Производные поля (права, «Доступ до картки», стейкхолдеры, последний комментарий) синхронизация пересчитывает сама.
# Векторы tests/cases/state.json.
# ---------------------------------------------------------------------------
$STATE_LIST = "Lists/ProjectState"
# служебная строка эталона: блокировка запусков синхронизации (psProject = 0, проектов с ID 0 не бывает)
$LOCK_PROJECT = 0
$LOCK_MINUTES = 45

# Блокировка запусков (векторы tests/cases/lock.json): $text — psState служебной строки, $nowUtc — текущее время UTC.
# free — пусто; busy — занято другим запуском и срок не вышел; expired — срок вышел или запись повреждена (запуск упал).
function Test-LockPlan([string]$text, [datetime]$nowUtc) {
    if (-not $text) { return "free" }
    try { $j = ConvertFrom-JsonText $text } catch { return "expired" }
    if (-not $j -or -not $j.until) { return "expired" }
    try { $until = [datetimeoffset]::Parse([string]$j.until, [cultureinfo]::InvariantCulture).UtcDateTime } catch { return "expired" }
    if ($until -le $nowUtc.ToUniversalTime()) { return "expired" }
    return "busy"
}

# Чья блокировка (векторы tests/cases/lock.json -> owner): своя — только если запись разбирается и run совпадает.
function Test-LockOwner([string]$text, [string]$run) {
    if (-not $text -or -not $run) { return $false }
    try { $j = ConvertFrom-JsonText $text } catch { return $false }
    return [bool]$j -and ($j -is [System.Collections.IDictionary]) -and [string]$j["run"] -eq $run
}

# Кэш оргструктуры (векторы tests/cases/cache.json): $text — JSON {saved, mgr, people}; срок — $hours от saved.
# $null — нет, повреждён или устарел (читать Entra ID заново); иначе @{ saved (ISO UTC); mgr; people; age (часов) }.
function Read-ManagerCache([string]$text, [datetime]$nowUtc, [double]$hours) {
    if (-not $text) { return $null }
    try { $c = ConvertFrom-JsonText $text } catch { return $null }
    if (-not ($c -is [System.Collections.IDictionary]) -or -not $c.Contains("saved")) { return $null }
    try { $saved = [datetimeoffset]::Parse([string]$c["saved"], [cultureinfo]::InvariantCulture).UtcDateTime } catch { return $null }
    $age = ($nowUtc.ToUniversalTime() - $saved).TotalHours
    # небольшой сдвиг часов между машинами (Mac, Azure) — до часа — не делает кэш недействительным
    if ($age -lt -1 -or $age -ge $hours) { return $null }
    $mgr = @{}; if ($c["mgr"] -is [System.Collections.IDictionary]) { foreach ($k in $c["mgr"].Keys) { $mgr[$k] = [string]$c["mgr"][$k] } }
    $ppl = @{}; if ($c["people"] -is [System.Collections.IDictionary]) { foreach ($k in $c["people"].Keys) { $x = $c["people"][$k]; $ppl[$k] = @{ n = [string]$x["n"]; j = [string]$x["j"] } } }
    return @{ saved = $saved.ToString("o"); mgr = $mgr; people = $ppl; age = $age }
}
# Что сохранить в кэш: руководители без сбоев чтения ($fail), люди; срок — от первого чтения Entra ID ($cacheSaved),
# новые люди дописываются, но срок не продлевают.
function Get-ManagerCacheJson($mgr, $people, $fail, [string]$cacheSaved, [datetime]$nowUtc) {
    $mgrOut = [ordered]@{}; foreach ($k in @($mgr.Keys | Sort-Object)) { if (-not $fail.ContainsKey($k)) { $mgrOut[$k] = $mgr[$k] } }
    $pplOut = [ordered]@{}; foreach ($k in @($people.Keys | Sort-Object)) { $pplOut[$k] = [ordered]@{ n = $people[$k].n; j = $people[$k].j } }
    $saved = if ($cacheSaved) { $cacheSaved } else { $nowUtc.ToUniversalTime().ToString("o") }
    return [ordered]@{ saved = $saved; mgr = $mgrOut; people = $pplOut } | ConvertTo-Json -Depth 4 -Compress
}

# Время по Киеву: Azure Automation работает в UTC, Mac — в поясе пользователя; даты для людей — всегда по Киеву.
function Get-KyivZone {
    if ($script:KYIV_ZONE) { return $script:KYIV_ZONE }
    foreach ($id in @("Europe/Kyiv", "Europe/Kiev", "FLE Standard Time")) { try { $script:KYIV_ZONE = [TimeZoneInfo]::FindSystemTimeZoneById($id); return $script:KYIV_ZONE } catch { } }
    Write-Warning "Часовий пояс Києва не знайдено — дати за поясом машини ($([TimeZoneInfo]::Local.Id))"
    $script:KYIV_ZONE = [TimeZoneInfo]::Local
    return $script:KYIV_ZONE
}
# $d с Kind = Local переводится из местного времени, иначе (Utc / Unspecified — значения SharePoint) считается UTC
function ConvertTo-Kyiv([datetime]$d) {
    $u = if ($d.Kind -eq [DateTimeKind]::Local) { $d.ToUniversalTime() } else { [datetime]::SpecifyKind($d, [DateTimeKind]::Utc) }
    return [TimeZoneInfo]::ConvertTimeFromUtc($u, (Get-KyivZone))
}
$STATE_DATES = @("pmStart", "pmGoLive", "pmPlanEnd", "pmForecastEnd", "pmArchivedAt", "pmLastUpdate", "pmActualEnd")
function Get-StateKeys { return @("pmStatus", "pmRAG", "pmType", "pmProgress", "pmStart", "pmGoLive", "pmPlanEnd", "pmForecastEnd",
                                  "pmActualCost", "pmArchivedAt", "pmLastUpdate", "pmLastReport", "pmCode", "pmActualEnd",
                                  "pmManager", "pmOwner") }
# PM и владелец в эталоне — e-mail в нижнем регистре (#43: меняет только PMO через «Призначення»)
$STATE_PEOPLE = @("pmManager", "pmOwner")
function Get-StateValue([string]$k, $v) {
    if ($k -in $STATE_PEOPLE) { if ($v -and $v.Email) { return ([string]$v.Email).ToLowerInvariant() } return "" }
    return Norm $v
}
# значения ключевых полей записи проекта (как их видит синхронизация: Norm)
function Get-CardState($item) {
    $st = [ordered]@{}
    foreach ($k in Get-StateKeys) { $st[$k] = Get-StateValue $k $item[$k] }
    return $st
}
# расхождения карточки с эталоном: @{ f; card; state } по каждому отличающемуся полю
function Compare-State($card, $state) {
    $out = @()
    foreach ($k in Get-StateKeys) {
        $a = [string]$card[$k]; $b = [string]$state[$k]
        if ($a -ne $b) { $out += [ordered]@{ f = $k; card = $a; state = $b } }
    }
    return , $out
}
function ConvertTo-StateJson($state) {
    $o = [ordered]@{}; foreach ($k in Get-StateKeys) { $o[$k] = [string]$state[$k] }
    return ($o | ConvertTo-Json -Compress)
}
# Повреждённый или пустой эталон (нет ключа pmStatus) — $null: «эталона нет», заново из карточки, но никогда не откат к пустым значениям.
# Ключи, которых в эталоне ещё нет (эталон записан до появления поля), — в «_missing»: их значение берётся из карточки без отката.
function ConvertFrom-StateJson([string]$json) {
    if (-not $json) { return $null }
    try { $o = ConvertFrom-JsonText $json } catch { return $null }
    if ($o -isnot [System.Collections.IDictionary] -or -not $o.Contains("pmStatus")) { return $null }
    $st = [ordered]@{}
    foreach ($k in Get-StateKeys) { $st[$k] = if ($o.Contains($k) -and $null -ne $o[$k]) { [string]$o[$k] } else { "" } }
    $st["_missing"] = @(Get-StateKeys | Where-Object { -not $o.Contains($_) })
    return $st
}
# значение для записи в карточку из эталона: даты — полдень UTC, пусто — null
function Get-StateWriteValue([string]$k, [string]$v) {
    if (-not $v) { return $null }
    if ($k -in $STATE_DATES) { return ToSpDate $v }
    return $v
}

# Эталоны всех проектов: psProject -> @{ id; state; done; last } (один запрос; списка ещё нет — пусто)
function Read-ProjectStates {
    $map = @{}
    $script:HAS_STATE_LIST = [bool](Get-PnPList -Identity $STATE_LIST -ErrorAction SilentlyContinue)
    if (-not $script:HAS_STATE_LIST) { return $map }
    foreach ($it in @(Get-PnPListItem -List $STATE_LIST -PageSize 500)) {
        if (-not $it -or $null -eq $it["psProject"] -or [int]$it["psProject"] -eq $LOCK_PROJECT) { continue }
        $map[[int]$it["psProject"]] = @{ id = $it.Id; state = (ConvertFrom-StateJson ([string]$it["psState"])); done = [string]$it["psEditDone"]; last = [string]$it["psLastApplied"]; hist = [string]$it["psHistory"] }
    }
    return $map
}
# Записать эталон проекта (создать или обновить); $states — словарь из Read-ProjectStates, обновляется на месте.
# $extra — поля psEditDone / psLastApplied, если меняются.
function Save-ProjectState([int]$projectId, $state, $states, [hashtable]$extra = @{}) {
    $vals = @{ psState = (ConvertTo-StateJson $state) } + $extra
    $cur = $states[$projectId]
    if ($cur) { Set-PnPListItem -List $STATE_LIST -Identity $cur.id -Values $vals -UpdateType SystemUpdate | Out-Null }
    else { $it = Add-PnPListItem -List $STATE_LIST -Values ($vals + @{ Title = "P$projectId"; psProject = $projectId }); $cur = @{ id = $it.Id; done = ""; last = ""; hist = "" }; $states[$projectId] = $cur }
    $cur.state = $state
    if ($extra.ContainsKey("psEditDone")) { $cur.done = $extra.psEditDone }
    if ($extra.ContainsKey("psLastApplied")) { $cur.last = $extra.psLastApplied }
}
# Для скриптов, меняющих ключевые поля напрямую: эталон = текущая карточка (после записи). Без списка эталона — ничего.
function Sync-ProjectStateFromCard([int]$projectId) {
    if (-not (Get-PnPList -Identity $STATE_LIST -ErrorAction SilentlyContinue)) { return }
    $states = Read-ProjectStates
    $item = Get-PnPListItem -List "Lists/Projects" -Id $projectId
    Save-ProjectState $projectId (Get-CardState $item) $states
}
