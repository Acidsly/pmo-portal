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
    if ($v -is [double] -or $v -is [int] -or $v -is [decimal]) { return [string][math]::Round([double]$v) }
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
$STATE_DATES = @("pmStart", "pmGoLive", "pmPlanEnd", "pmForecastEnd", "pmArchivedAt", "pmLastUpdate")
function Get-StateKeys { return @("pmStatus", "pmRAG", "pmType", "pmProgress", "pmStart", "pmGoLive", "pmPlanEnd", "pmForecastEnd",
                                  "pmActualCost", "pmArchivedAt", "pmLastUpdate", "pmLastReport", "pmCode") }
# значения ключевых полей записи проекта (как их видит синхронизация: Norm)
function Get-CardState($item) {
    $st = [ordered]@{}
    foreach ($k in Get-StateKeys) { $st[$k] = Norm $item[$k] }
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
# Повреждённый или пустой эталон (нет ключа pmStatus) — $null: «эталона нет», заново из карточки, но никогда не откат к пустым значениям
function ConvertFrom-StateJson([string]$json) {
    if (-not $json) { return $null }
    try { $o = ConvertFrom-JsonText $json } catch { return $null }
    if ($o -isnot [System.Collections.IDictionary] -or -not $o.Contains("pmStatus")) { return $null }
    $st = [ordered]@{}
    foreach ($k in Get-StateKeys) { $st[$k] = if ($o.Contains($k) -and $null -ne $o[$k]) { [string]$o[$k] } else { "" } }
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
    if (-not (Get-PnPList -Identity $STATE_LIST -ErrorAction SilentlyContinue)) { return $map }
    foreach ($it in @(Get-PnPListItem -List $STATE_LIST -PageSize 500)) {
        if (-not $it -or $null -eq $it["psProject"]) { continue }
        $map[[int]$it["psProject"]] = @{ id = $it.Id; state = (ConvertFrom-StateJson ([string]$it["psState"])); done = [string]$it["psEditDone"]; last = [string]$it["psLastApplied"] }
    }
    return $map
}
# Записать эталон проекта (создать или обновить); $states — словарь из Read-ProjectStates, обновляется на месте.
# $extra — поля psEditDone / psLastApplied, если меняются.
function Save-ProjectState([int]$projectId, $state, $states, [hashtable]$extra = @{}) {
    $vals = @{ psState = (ConvertTo-StateJson $state) } + $extra
    $cur = $states[$projectId]
    if ($cur) { Set-PnPListItem -List $STATE_LIST -Identity $cur.id -Values $vals -UpdateType SystemUpdate | Out-Null }
    else { $it = Add-PnPListItem -List $STATE_LIST -Values ($vals + @{ Title = "P$projectId"; psProject = $projectId }); $cur = @{ id = $it.Id; done = ""; last = "" }; $states[$projectId] = $cur }
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
