# Шаблон письма-дайджеста PPM (HTML для Outlook: Windows / Mac / веб / iOS / Android, светлая и тёмная темы).
# Только таблицы и встроенные стили, ширина 600 px, графики из ячеек, без SVG, JavaScript и внешних картинок;
# логотип — вложение (cid:ppm-logo) или data URI для просмотра. Модель письма — см. docs/digest/mockup-data.json.
# Стиль — сайт eclectic.group: чёрная шапка, акценты коралловый и фиолетовый, Roboto → Segoe UI / Arial.

$DG = @{
    black = "#0D0D0D"; coral = "#FF8D6D"; violet = "#9B7DD4"; ink = "#1F1F1F"; text = "#404040"; muted = "#868686"
    line = "#D9D9D9"; soft = "#F4F4F4"; white = "#FFFFFF"
    g = "#2FB457"; y = "#F5A30A"; r = "#E8453C"; n = "#BBBBBB"
    font = "Roboto, 'Segoe UI', Arial, Helvetica, sans-serif"
}

$DG_T = @{
    uk = @{
        kindMember = "Ваші проєкти"; kindManager = "Проєкти вашої команди"; kindCeo = "Портфель країн"
        week = "Тиждень {0} – {1}"; asOf = "стан на {0}"; hello = "Доброго дня, {0}!"
        introMember = "Коротко про проєкти, де ви власник або в команді проєкту."
        introManager = "Проєкти ваших підлеглих — стан зараз і що змінилося з минулого листа."
        introCeo = "Проєкти країн: {0} — стан зараз і що змінилося з минулого листа."
        now = "Стан зараз"; changed = "Що змінилося"; since = "з листа від {0}"; first = "Перший дайджест — зміни з'являться в наступному листі."
        nothing = "Без змін."; attention = "Потребує уваги"; projects = "Проєкти"; byCountry = "За країнами"
        kpiTotal = "проєктів"; kpiRed = "червоних"; kpiDecision = "чекають рішення"; kpiStale = "без звіту понад 14 дн."
        g = "Зелений"; y = "Жовтий"; r = "Червоний"; n = "Не оцінено"
        progress = "Виконання"; budget = "Бюджет"; spent = "витрачено {0} з {1}"; start = "Старт"; plan = "План"; forecast = "Прогноз"
        slip = "+{0} дн."; ahead = "−{0} дн."; report = "Статус-звіт від {0}"; noReport = "Погоджених звітів ще немає"
        done = "Зроблено"; next = "Далі"; issues = "Проблеми"; risks = "Ризики"; decisions = "Потрібне рішення"
        owner = "відп."; due = "до {0}"; overdue = "прострочено"; pm = "PM"; open = "Відкрити картку"; portal = "Відкрити портал"
        why = "Ви отримуєте цей лист як {0}. Лист щопонеділка; якщо змін і питань немає — листа немає."
        roleMember = "власник або учасник команди проєктів"; roleManager = "керівник PM"; roleCeo = "CEO країни"
        budgetPf = "Бюджет портфеля"; spentPct = "витрачено {0} з {1} · {2}%"; decisionsH = "Потрібні рішення"; risksH = "Головні ризики"; waits = "чекає з {0}"
        ownerP = "власник"; colBudget = "бюджет"; aRed = "червоний стан"; aSlip = "прогноз +{0} дн."; aOverdue = "прострочений ризик"; aStale = "немає свіжого звіту"
        aPaused = "призупинено"; aBurn = "освоєно {0}% бюджету при виконанні {1}%"; ask = "До кого"
        gantt = "Терміни"; legDone = "виконано"; legLeft = "залишилось за планом"; legSlip = "зсув прогнозу"; legEarly = "раніше плану"; legToday = "сьогодні"
        wasF = "було {0}"; fcost = "прогноз витрат {0}"; over = "+{0} ({1}%) до бюджету"; under = "−{0} до бюджету"; budgetFc = "Прогноз витрат портфеля"
        months = "січ,лют,бер,кві,тра,чер,лип,сер,вер,жов,лис,гру"; aOver = "прогноз перевитрат +{0}%"
        colDone = "виконання"; colTerm = "строки"; staleN = "без свіжого звіту: {0}"; repOf = "звіт від {0}"; noRep = "звітів немає"
        footer = "PPM — Управління портфелем проєктів · Eclectic Group"
    }
    en = @{
        kindMember = "Your projects"; kindManager = "Your team's projects"; kindCeo = "Country portfolio"
        week = "Week {0} – {1}"; asOf = "as of {0}"; hello = "Hello, {0}!"
        introMember = "A short update on projects where you are the owner or on the project team."
        introManager = "Projects of your reports — current state and what changed since the last letter."
        introCeo = "Projects in {0} — current state and what changed since the last letter."
        now = "Current state"; changed = "What changed"; since = "since the letter of {0}"; first = "First digest — changes will appear in the next letter."
        nothing = "No changes."; attention = "Needs attention"; projects = "Projects"; byCountry = "By country"
        kpiTotal = "projects"; kpiRed = "red"; kpiDecision = "awaiting decision"; kpiStale = "no report for 14+ days"
        g = "Green"; y = "Amber"; r = "Red"; n = "Not rated"
        progress = "Progress"; budget = "Budget"; spent = "spent {0} of {1}"; start = "Start"; plan = "Plan"; forecast = "Forecast"
        slip = "+{0} d"; ahead = "−{0} d"; report = "Status report of {0}"; noReport = "No approved reports yet"
        done = "Done"; next = "Next"; issues = "Issues"; risks = "Risks"; decisions = "Decision needed"
        owner = "owner"; due = "due {0}"; overdue = "overdue"; pm = "PM"; open = "Open the card"; portal = "Open the portal"
        why = "You receive this letter as {0}. Sent every Monday; no changes and no open questions — no letter."
        roleMember = "a project owner or team member"; roleManager = "a PM's manager"; roleCeo = "a country CEO"
        budgetPf = "Portfolio budget"; spentPct = "spent {0} of {1} · {2}%"; decisionsH = "Decisions needed"; risksH = "Top risks"; waits = "waiting since {0}"
        ownerP = "owner"; colBudget = "budget"; aRed = "red status"; aSlip = "forecast +{0} d"; aOverdue = "overdue risk"; aStale = "no fresh report"
        aPaused = "on hold"; aBurn = "{0}% of budget spent at {1}% progress"; ask = "Contact"
        gantt = "Timeline"; legDone = "done"; legLeft = "remaining to plan"; legSlip = "forecast slip"; legEarly = "ahead of plan"; legToday = "today"
        wasF = "was {0}"; fcost = "cost forecast {0}"; over = "+{0} ({1}%) over budget"; under = "−{0} under budget"; budgetFc = "Portfolio cost forecast"
        months = "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec"; aOver = "forecast overrun +{0}%"
        colDone = "progress"; colTerm = "timeline"; staleN = "no fresh report: {0}"; repOf = "report of {0}"; noRep = "no reports"
        footer = "PPM — Project Portfolio Management · Eclectic Group"
    }
    ru = @{
        kindMember = "Ваши проекты"; kindManager = "Проекты вашей команды"; kindCeo = "Портфель стран"
        week = "Неделя {0} – {1}"; asOf = "состояние на {0}"; hello = "Добрый день, {0}!"
        introMember = "Коротко о проектах, где вы владелец или в команде проекта."
        introManager = "Проекты ваших подчинённых — состояние сейчас и что изменилось с прошлого письма."
        introCeo = "Проекты стран: {0} — состояние сейчас и что изменилось с прошлого письма."
        now = "Состояние сейчас"; changed = "Что изменилось"; since = "с письма от {0}"; first = "Первый дайджест — изменения появятся в следующем письме."
        nothing = "Без изменений."; attention = "Требует внимания"; projects = "Проекты"; byCountry = "По странам"
        kpiTotal = "проектов"; kpiRed = "красных"; kpiDecision = "ждут решения"; kpiStale = "без отчёта более 14 дн."
        g = "Зелёный"; y = "Жёлтый"; r = "Красный"; n = "Не оценено"
        progress = "Выполнение"; budget = "Бюджет"; spent = "потрачено {0} из {1}"; start = "Старт"; plan = "План"; forecast = "Прогноз"
        slip = "+{0} дн."; ahead = "−{0} дн."; report = "Статус-отчёт от {0}"; noReport = "Согласованных отчётов ещё нет"
        done = "Сделано"; next = "Далее"; issues = "Проблемы"; risks = "Риски"; decisions = "Нужно решение"
        owner = "отв."; due = "до {0}"; overdue = "просрочено"; pm = "PM"; open = "Открыть карточку"; portal = "Открыть портал"
        why = "Вы получаете это письмо как {0}. Письмо по понедельникам; нет изменений и вопросов — нет письма."
        roleMember = "владелец или участник команды проектов"; roleManager = "руководитель PM"; roleCeo = "CEO страны"
        budgetPf = "Бюджет портфеля"; spentPct = "потрачено {0} из {1} · {2}%"; decisionsH = "Нужные решения"; risksH = "Главные риски"; waits = "ждёт с {0}"
        ownerP = "владелец"; colBudget = "бюджет"; aRed = "красное состояние"; aSlip = "прогноз +{0} дн."; aOverdue = "просроченный риск"; aStale = "нет свежего отчёта"
        aPaused = "приостановлен"; aBurn = "освоено {0}% бюджета при выполнении {1}%"; ask = "К кому"
        gantt = "Сроки"; legDone = "выполнено"; legLeft = "осталось по плану"; legSlip = "сдвиг прогноза"; legEarly = "раньше плана"; legToday = "сегодня"
        wasF = "было {0}"; fcost = "прогноз затрат {0}"; over = "+{0} ({1}%) к бюджету"; under = "−{0} к бюджету"; budgetFc = "Прогноз затрат портфеля"
        months = "янв,фев,мар,апр,май,июн,июл,авг,сен,окт,ноя,дек"; aOver = "прогноз перерасхода +{0}%"
        colDone = "выполнение"; colTerm = "сроки"; staleN = "без свежего отчёта: {0}"; repOf = "отчёт от {0}"; noRep = "отчётов нет"
        footer = "PPM — Управление портфелем проектов · Eclectic Group"
    }
}

function DgE([string]$s) { [System.Net.WebUtility]::HtmlEncode($s) }
function DgRag([string]$v) {
    switch ($v) { "Зелений" { "g" } "Жовтий" { "y" } "Червоний" { "r" } default { "n" } }
}
function DgMoney($v) { if ($null -eq $v -or "$v" -eq "") { "—" } else { '$' + ([double]$v).ToString("#,0", [Globalization.CultureInfo]::InvariantCulture).Replace(",", " ") } }
function DgDate([string]$d) { if ($d) { ([datetime]$d).ToString("dd.MM.yyyy") } else { "—" } }

# полоса из ячеек: сегменты @{ w = доля 0..100; c = цвет }
function DgBar($segs, [int]$h = 8) {
    $cells = ($segs | Where-Object { $_.w -gt 0 } | ForEach-Object {
        "<td width=`"$([math]::Round($_.w))%`" style=`"background:$($_.c);height:${h}px;line-height:${h}px;font-size:1px;mso-line-height-rule:exactly`">&nbsp;</td>" }) -join ""
    if (-not $cells) { $cells = "<td style=`"background:$($DG.soft);height:${h}px;line-height:${h}px;font-size:1px`">&nbsp;</td>" }
    "<table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"border-collapse:collapse;border-radius:4px;overflow:hidden`"><tr>$cells</tr></table>"
}
function DgPct([double]$pct, [string]$color) {
    $p = [math]::Max(0, [math]::Min(100, $pct))
    DgBar @(@{ w = $p; c = $color }, @{ w = 100 - $p; c = $DG.soft })
}
function DgDot([string]$k, [int]$size = 10) {
    "<span style=`"display:inline-block;width:${size}px;height:${size}px;border-radius:50%;background:$($DG[$k]);vertical-align:middle`">&nbsp;</span>"
}
function DgPill([string]$text, [string]$bg, [string]$fg = "#FFFFFF") {
    "<span style=`"display:inline-block;padding:2px 8px;border-radius:10px;background:$bg;color:$fg;font-size:11px;line-height:16px;font-weight:700;white-space:nowrap`">$(DgE $text)</span>"
}
function DgH([string]$text, [string]$accent) {
    "<tr><td style=`"padding:28px 24px 10px 24px`"><table role=`"presentation`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`"><tr>" +
    "<td style=`"width:4px;background:$accent;font-size:1px`">&nbsp;</td>" +
    "<td style=`"padding-left:10px;font-family:$($DG.font);font-size:15px;line-height:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:$($DG.ink)`">$(DgE $text)</td></tr></table></td></tr>"
}
# кнопка для всех Outlook: VML для Windows, ссылка-таблица для остальных
function DgButton([string]$href, [string]$text, [string]$bg) {
    $label = DgE $text
    "<!--[if mso]><v:roundrect xmlns:v=`"urn:schemas-microsoft-com:vml`" href=`"$href`" style=`"height:40px;v-text-anchor:middle;width:220px`" arcsize=`"50%`" stroke=`"f`" fillcolor=`"$bg`"><center style=`"color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold`">$label</center></v:roundrect><![endif]-->" +
    "<!--[if !mso]><!--><a class=`"btn`" href=`"$href`" style=`"display:inline-block;background:$bg;color:#ffffff;font-family:$($DG.font);font-size:14px;font-weight:700;line-height:40px;padding:0 26px;border-radius:20px;text-decoration:none`">$label</a><!--<![endif]-->"
}

function DgChangeRows($changes, $T) {
    if (-not @($changes | Where-Object { $_ }).Count) { return "<p style=`"margin:0;color:$($DG.muted);font-size:13px`">$($T.nothing)</p>" }
    $sym = @{ worse = @("▼", $DG.r); better = @("▲", $DG.g); info = @("●", $DG.violet) }
    ($changes | ForEach-Object {
        $s = $sym[$_.kind]
        $who = if ($_.code) { "<b style=`"color:$($DG.ink)`">$(DgE $_.code)</b> " } else { "" }
        "<tr><td valign=`"top`" style=`"width:18px;padding:4px 0;color:$($s[1]);font-size:12px;line-height:18px`">$($s[0])</td>" +
        "<td style=`"padding:4px 0;font-family:$($DG.font);font-size:13px;line-height:18px;color:$($DG.text)`">$who$(DgE $_.text)</td></tr>" }) -join "" |
        ForEach-Object { "<table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`">$_</table>" }
}

# карточка проекта (письмо участнику): стан зараз, потом «що змінилося» по проекту
function DgProjectCard($p, $T, $M) {
    $k = DgRag $p.rag
    $slip = if ($p.slipDays -gt 0) { DgPill ($T.slip -f $p.slipDays) $DG.r } elseif ($p.slipDays -lt 0) { DgPill ($T.ahead -f (-$p.slipDays)) $DG.g } else { "" }
    $burn = if ($p.budget) { [double]$p.cost / [double]$p.budget * 100 } else { 0 }
    $burnC = if ($burn -gt [double]$p.progress + 15) { $DG.coral } else { $DG.violet }
    $rep = if ($p.report) {
        $rows = foreach ($x in @(@($T.done, $p.report.done), @($T.next, $p.report.next), @($T.issues, $p.report.issues))) {
            if ($x[1]) { "<tr><td valign=`"top`" style=`"width:84px;padding:3px 8px 3px 0;font-size:12px;line-height:18px;color:$($DG.muted);font-weight:700`">$(DgE $x[0])</td><td style=`"padding:3px 0;font-size:13px;line-height:18px;color:$($DG.text)`">$(DgE $x[1])</td></tr>" } }
        "<div style=`"font-size:12px;color:$($DG.muted);padding:14px 0 4px`">$(DgE ($T.report -f (DgDate $p.report.date)))</div><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"font-family:$($DG.font)`">$($rows -join '')</table>"
    } else { "<div style=`"font-size:13px;color:$($DG.muted);padding-top:14px`">$($T.noReport)</div>" }
    $risks = if (@($p.risks | Where-Object { $_ }).Count) {
        $rr = ($p.risks | ForEach-Object {
            $c = if ($_.score -ge 15) { $DG.r } elseif ($_.score -ge 8) { $DG.y } else { $DG.g }
            $d = if ($_.overdue) { DgPill $T.overdue $DG.r } else { "<span style=`"color:$($DG.muted)`">$(DgE ($T.due -f (DgDate $_.due)))</span>" }
            "<tr><td valign=`"top`" style=`"width:34px;padding:4px 8px 4px 0`">$(DgPill ([string]$_.score) $c)</td><td style=`"padding:4px 0;font-size:13px;line-height:18px;color:$($DG.text)`">$(DgE $_.title)<br><span style=`"font-size:11px;color:$($DG.muted)`">$($T.owner) $(DgE $_.owner) · </span><span style=`"font-size:11px`">$d</span></td></tr>" }) -join ""
        "<div style=`"font-size:12px;font-weight:700;color:$($DG.muted);padding:14px 0 2px;text-transform:uppercase;letter-spacing:.5px`">$($T.risks)</div><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"font-family:$($DG.font)`">$rr</table>"
    } else { "" }
    $dec = if (@($p.decisions | Where-Object { $_ }).Count) {
        "<table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"margin-top:14px`"><tr><td style=`"background:#FFF1EC;border-left:4px solid $($DG.coral);padding:10px 12px;font-family:$($DG.font);font-size:13px;line-height:18px;color:$($DG.ink)`"><b>$($T.decisions):</b> " + (($p.decisions | ForEach-Object { DgE $_ }) -join "; ") + "</td></tr></table>"
    } else { "" }
    @"
<tr><td style="padding:6px 24px 14px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid $($DG.line);border-radius:10px;border-collapse:separate">
<tr><td style="padding:16px 18px;font-family:$($DG.font)">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font-size:12px;color:$($DG.muted);font-weight:700">$(DgE $p.code) · $(DgE $p.status)</td>
    <td align="right" style="white-space:nowrap">$(DgDot $k 10) <span style="font-size:12px;font-weight:700;color:$($DG.ink)">$($T[$k])</span></td>
  </tr></table>
  <div style="font-size:18px;line-height:23px;font-weight:700;color:$($DG.ink);padding:4px 0 2px"><a href="$($p.url)" style="color:$($DG.ink);text-decoration:none">$(DgE $p.title)</a></div>
  <div style="font-size:12px;line-height:17px;color:$($DG.muted);padding-bottom:12px">$($T.pm) $(DgE $p.pm) · $($T.ownerP) $(DgE $p.owner)</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font-size:12px;color:$($DG.muted);padding-bottom:4px">$($T.progress)</td><td align="right" style="font-size:20px;font-weight:900;color:$($DG.ink);padding-bottom:4px">$($p.progress)%</td></tr>
    <tr><td colspan="2">$(DgPct $p.progress $DG.violet)</td></tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px"><tr>
    <td style="font-size:12px;color:$($DG.muted);padding-bottom:4px">$($T.budget)</td><td align="right" style="font-size:12px;color:$($DG.text);padding-bottom:4px">$(DgE ($T.spent -f (DgMoney $p.cost), (DgMoney $p.budget)))</td></tr>
    <tr><td colspan="2">$(DgBudgetBar $p)</td></tr>
    $(if ($p.forecastCost) { "<tr><td colspan=`"2`" style=`"font-size:12px;color:$($DG.muted);padding-top:4px`">$(DgE ($T.fcost -f (DgMoney $p.forecastCost))) $(DgBudgetNote $p $T)</td></tr>" })</table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;background:$($DG.soft);border-radius:8px"><tr>
    <td width="33%" style="padding:8px 10px;font-size:11px;color:$($DG.muted)">$($T.start)<br><b style="font-size:13px;color:$($DG.ink)">$(DgDate $p.start)</b></td>
    <td width="33%" style="padding:8px 10px;font-size:11px;color:$($DG.muted)">$($T.plan)<br><b style="font-size:13px;color:$($DG.ink)">$(DgDate $p.planEnd)</b></td>
    <td width="34%" style="padding:8px 10px;font-size:11px;color:$($DG.muted)">$($T.forecast)<br><b style="font-size:13px;color:$($DG.ink)">$(DgDate $p.forecastEnd)</b> $slip</td>
  </tr></table>
  $rep
  $risks
  $dec
  <div style="padding-top:14px"><a href="$($p.url)" style="font-size:13px;font-weight:700;color:$($DG.violet);text-decoration:none">$($T.open) →</a></div>
</td></tr></table>
</td></tr>
"@
}

# полоса бюджета: витрачено, остаток до прогноза, перерасход (прогноз выше бюджета) или экономия (ниже)
function DgBudgetBar($p, [int]$h = 8) {
    $b = [double]$p.budget; $c = [double]$p.cost; $f = if ($p.forecastCost) { [double]$p.forecastCost } else { $b }
    if (-not $b) { return DgBar @() $h }
    $scale = [math]::Max($b, $f)
    $burn = $c / $b * 100
    $cc = if ($burn -gt [double]$p.progress + 20) { $DG.coral } else { $DG.violet }
    $segs = @(@{ w = $c / $scale * 100; c = $cc }, @{ w = ([math]::Min($f, $b) - $c) / $scale * 100; c = $DG.line })
    if ($f -gt $b) { $segs += @{ w = ($f - $b) / $scale * 100; c = $DG.r } } else { $segs += @{ w = ($b - $f) / $scale * 100; c = "#BFE8CB" } }
    DgBar $segs $h
}
function DgBudgetNote($p, $T) {
    $b = [double]$p.budget; $f = [double]$p.forecastCost
    if (-not $b -or -not $f -or $f -eq $b) { return "" }
    $d = $f - $b; $pct = [math]::Round([math]::Abs($d) / $b * 100)
    if ($d -gt 0) { "<span style=`"color:$($DG.r);font-weight:700`">$(DgE ($T.over -f (DgMoney $d), $pct))</span>" } else { "<span style=`"color:$($DG.g);font-weight:700`">$(DgE ($T.under -f (DgMoney (-$d))))</span>" }
}

# «Терміни»: диаграмма Ганта из ячеек — от старта до плана и прогноза, выполнено, «сьогодні», прежний прогноз
function DgGantt($M, $T) {
    $ps = @($M.projects | Where-Object { $_.start -and ($_.planEnd -or $_.forecastEnd) })
    if (-not $ps.Count) { return "" }
    $today = [datetime]$M.asOf
    $ends = @($ps | ForEach-Object { [datetime]($_.forecastEnd ?? $_.planEnd); [datetime]($_.planEnd ?? $_.forecastEnd) })
    $w0 = @($ps | ForEach-Object { [datetime]$_.start }) + $today | Sort-Object | Select-Object -First 1
    $w0 = [datetime]::new($w0.Year, $w0.Month, 1)
    $w1 = @($ends + $today | Sort-Object)[-1]; $w1 = [datetime]::new($w1.Year, $w1.Month, 1).AddMonths(1)
    $span = ($w1 - $w0).TotalDays
    $pos = { param([datetime]$d) [math]::Max(0, [math]::Min(100, ($d - $w0).TotalDays / $span * 100)) }
    $tp = & $pos $today; $tw = 0.7
    # шкала месяцев: подпись — каждый месяц (до 8 месяцев) или каждый квартал
    $mon = $T.months -split ","
    $months = @(); $mo = $w0; while ($mo -lt $w1) { $months += $mo; $mo = $mo.AddMonths(1) }
    $every = if ($months.Count -le 8) { 1 } else { 3 }
    $scaleCells = ($months | ForEach-Object {
        $wd = ($_.AddMonths(1) - $_).TotalDays / $span * 100
        $lbl = if (($_.Month - 1) % $every -eq 0) { $mon[$_.Month - 1] + $(if ($_.Month -eq 1 -or $_ -eq $w0) { " " + $_.ToString("yy") } else { "" }) } else { "&nbsp;" }
        "<td width=`"$([math]::Round($wd, 2))%`" style=`"border-left:1px solid $($DG.line);padding:0 0 2px 3px;font-family:$($DG.font);font-size:10px;line-height:12px;color:$($DG.muted);white-space:nowrap;overflow:hidden`">$lbl</td>" }) -join ""
    $rows = ($ps | ForEach-Object {
        $s = [datetime]$_.start; $pl = [datetime]($_.planEnd ?? $_.forecastEnd); $fc = [datetime]($_.forecastEnd ?? $_.planEnd)
        $done = $s.AddDays(($fc - $s).TotalDays * [double]$_.progress / 100)
        $P0 = & $pos $s; $Pd = & $pos $done; $Pp = & $pos $pl; $Pf = & $pos $fc
        $pts = @(0, 100, $P0, $Pd, $Pp, $Pf, $tp, [math]::Min(100, $tp + $tw)) | Sort-Object -Unique
        $segs = for ($i = 0; $i -lt $pts.Count - 1; $i++) {
            $a = $pts[$i]; $b = $pts[$i + 1]; if ($b - $a -lt 0.05) { continue }
            $mid = ($a + $b) / 2
            $col = if ($mid -ge $tp -and $mid -le $tp + $tw) { $DG.black }
                elseif ($mid -lt $P0) { $DG.soft }
                elseif ($mid -lt $Pd) { $DG.violet }
                elseif ($Pf -ge $Pp) { if ($mid -lt $Pp) { $DG.line } elseif ($mid -lt $Pf) { $DG.r } else { $DG.soft } }
                else { if ($mid -lt $Pf) { $DG.line } elseif ($mid -lt $Pp) { "#BFE8CB" } else { $DG.soft } }
            @{ w = $b - $a; c = $col }
        }
        # концы полосы проекта скруглены (как у остальных полос); фон и «сьогодні» — не полоса
        $bar = @(for ($i = 0; $i -lt $segs.Count; $i++) { if ($segs[$i].c -ne $DG.soft -and $segs[$i].c -ne $DG.black) { $i } })
        $cells = for ($i = 0; $i -lt $segs.Count; $i++) {
            $rad = if ($bar.Count -and $i -eq $bar[0] -and $i -eq $bar[-1]) { "border-radius:5px;" } elseif ($bar.Count -and $i -eq $bar[0]) { "border-radius:5px 0 0 5px;" } elseif ($bar.Count -and $i -eq $bar[-1]) { "border-radius:0 5px 5px 0;" } else { "" }
            "<td width=`"$([math]::Round($segs[$i].w, 2))%`" style=`"background:$($segs[$i].c);${rad}height:10px;line-height:10px;font-size:1px;mso-line-height-rule:exactly`">&nbsp;</td>"
        }
        $slip = if ($_.slipDays -gt 0) { DgPill ($T.slip -f $_.slipDays) $DG.r } elseif ($_.slipDays -lt 0) { DgPill ($T.ahead -f (-$_.slipDays)) $DG.g } else { "" }
        $was = if ($_.prevForecastEnd -and $_.prevForecastEnd -ne $_.forecastEnd) { " · " + (DgE ($T.wasF -f (DgDate $_.prevForecastEnd))) } else { "" }
        "<tr><td style=`"padding:10px 0 3px 0;font-family:$($DG.font)`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`"><tr>" +
        "<td style=`"font-size:12px;line-height:16px;color:$($DG.ink)`"><b>$(DgE $_.code)</b> $(DgE $_.title)<br><span style=`"font-size:11px;color:$($DG.muted)`">$(DgDate $_.start) → $($T.plan.ToLower()) $(DgDate $_.planEnd) · $($T.forecast.ToLower()) $(DgDate $_.forecastEnd)$was</span></td>" +
        "<td align=`"right`" valign=`"top`" style=`"white-space:nowrap;padding-left:6px`">$slip</td></tr></table></td></tr>" +
        "<tr><td><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"border-collapse:separate;border-spacing:0;border-radius:5px;overflow:hidden`"><tr>$($cells -join '')</tr></table></td></tr>" }) -join ""
    $leg = @(@($DG.violet, $T.legDone), @($DG.line, $T.legLeft), @($DG.r, $T.legSlip), @("#BFE8CB", $T.legEarly), @($DG.black, $T.legToday)) |
        ForEach-Object { "<span style=`"white-space:nowrap;padding-right:10px`"><span style=`"display:inline-block;width:10px;height:10px;background:$($_[0]);vertical-align:middle`">&nbsp;</span> $(DgE $_[1])</span>" }
    (DgH $T.gantt $DG.violet) +
    "<tr><td style=`"padding:0 24px`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`">" +
    "<tr><td><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"border-collapse:collapse`"><tr>$scaleCells</tr></table></td></tr>" + $rows +
    "<tr><td style=`"padding-top:10px;font-family:$($DG.font);font-size:11px;line-height:18px;color:$($DG.text)`">$($leg -join ' ')</td></tr></table></td></tr>"
}

# сводные данные письма из проектов: показатели, «Потребує уваги», решения, ризики, изменения, страны
function Complete-DigestModel($M) {
    $T = $DG_T[$M.lang]; if (-not $T) { $T = $DG_T.uk }
    $ps = @($M.projects)
    $k = @{ total = $ps.Count; g = 0; y = 0; r = 0; n = 0; decisions = 0; stale = 0; budget = 0.0; cost = 0.0; forecast = 0.0 }
    $att = @(); $dec = @(); $risks = @(); $chg = @()
    foreach ($p in $ps) {
        $rk = DgRag $p.rag; $k[$rk]++
        $k.budget += [double]$p.budget; $k.cost += [double]$p.cost; $k.forecast += [double]($p.forecastCost ?? $p.budget)
        $stale = -not $p.report -or ([datetime]$M.asOf - [datetime]$p.report.date).TotalDays -gt 14
        $p.isStale = $stale
        if ($stale) { $k.stale++ }
        $burn = if ($p.budget) { [math]::Round([double]$p.cost / [double]$p.budget * 100) } else { 0 }
        $why = @()
        if ($rk -eq "r") { $why += $T.aRed }
        if ($p.status -eq "Призупинено") { $why += $T.aPaused }
        if ($p.slipDays -gt 30) { $why += ($T.aSlip -f $p.slipDays) }
        if ($burn -gt [double]$p.progress + 20) { $why += ($T.aBurn -f $burn, $p.progress) }
        if ($p.budget -and $p.forecastCost -and [double]$p.forecastCost -gt [double]$p.budget * 1.1) { $why += ($T.aOver -f [math]::Round(([double]$p.forecastCost / [double]$p.budget - 1) * 100)) }
        if (@($p.risks | Where-Object { $_ -and $_.overdue }).Count) { $why += $T.aOverdue }
        if ($stale) { $why += $T.aStale }
        if ($why.Count) { $att += @{ code = $p.code; title = $p.title; url = $p.url; rag = $p.rag; pm = $p.pm; owner = $p.owner; reason = ($why -join " · ") } }
        foreach ($d in @($p.decisions | Where-Object { $_ })) { $k.decisions++; $dec += @{ code = $p.code; title = $p.title; url = $p.url; text = $d; pm = $p.pm; owner = $p.owner; since = $p.report.date } }
        foreach ($x in @($p.risks | Where-Object { $_ })) { $risks += @{ code = $p.code; title = $x.title; score = [int]$x.score; owner = $x.owner; due = $x.due; overdue = [bool]$x.overdue } }
        foreach ($c in @($p.changes | Where-Object { $_ })) { $chg += @{ code = $p.code; kind = $c.kind; text = $c.text } }
    }
    $M.kpi = $k
    $order = @{ r = 0; y = 1; n = 2; g = 3 }
    $M.attention = @($att | Sort-Object { $order[(DgRag $_.rag)] })
    $M.decisionsList = $dec
    $M.topRisks = @($risks | Where-Object { $_.overdue -or $_.score -ge 12 } | Sort-Object @{ e = { -[int]$_.overdue } }, @{ e = { -$_.score } } | Select-Object -First 6)
    $rank = @{ worse = 0; better = 1; info = 2 }
    $M.changes = @($chg | Sort-Object { $rank[$_.kind] })
    if ($M.kind -eq "ceo") {
        $M.byCountry = @($M.countries | ForEach-Object { $c = $_; $in = @($ps | Where-Object { $_.country -eq $c })
            $row = @{ name = $c; g = 0; y = 0; r = 0; n = 0; budget = 0.0; cost = 0.0; stale = 0 }
            foreach ($p in $in) { $row[(DgRag $p.rag)]++; $row.budget += [double]$p.budget; $row.cost += [double]$p.cost; if ($p.isStale) { $row.stale++ } }
            $row })
    }
    $M
}

function DgPeople($x, $T) { "$($T.pm) $(DgE $x.pm) · $($T.ownerP) $(DgE $x.owner)" }

# сводка портфеля (руководитель, CEO): показатели, состояние, бюджет, «потребує уваги», страны, таблица
function DgPortfolio($M, $T) {
    $k = $M.kpi
    # плитки — ячейки одной строки таблицы: высота у всех одинаковая, даже если подпись переносится
    $tile = { param($num, $label, $color) "<td width=`"25%`" valign=`"top`" style=`"background:$($DG.soft);border-radius:8px;padding:12px 10px;font-family:$($DG.font)`"><div style=`"font-size:30px;line-height:32px;font-weight:900;color:$color`">$num</div><div style=`"font-size:11px;line-height:14px;color:$($DG.muted);padding-top:4px`">$(DgE $label)</div></td>" }
    $tiles = "<tr><td style=`"padding:4px 18px`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"6`" border=`"0`" style=`"border-collapse:separate;border-spacing:6px 0`"><tr>" +
        (& $tile $k.total $T.kpiTotal $DG.ink) + (& $tile $k.r $T.kpiRed $DG.r) + (& $tile $k.decisions $T.kpiDecision $DG.coral) + (& $tile $k.stale $T.kpiStale $DG.violet) + "</tr></table></td></tr>"
    $tot = [math]::Max(1, $k.g + $k.y + $k.r + $k.n)
    $dist = DgBar @(@{ w = $k.g * 100 / $tot; c = $DG.g }, @{ w = $k.y * 100 / $tot; c = $DG.y }, @{ w = $k.r * 100 / $tot; c = $DG.r }, @{ w = $k.n * 100 / $tot; c = $DG.n }) 14
    $legend = (@("g", "y", "r", "n") | ForEach-Object { "<span style=`"white-space:nowrap;padding-right:12px`">$(DgDot $_ 8) $($T[$_]) <b style=`"color:$($DG.ink)`">$($k[$_])</b></span>" }) -join " "
    $distRow = "<tr><td style=`"padding:12px 24px 0 24px`">$dist<div style=`"font-family:$($DG.font);font-size:12px;line-height:20px;color:$($DG.text);padding-top:8px`">$legend</div></td></tr>"
    $burn = if ($k.budget) { [math]::Round($k.cost / $k.budget * 100) } else { 0 }
    $budgetRow = "<tr><td style=`"padding:16px 24px 0 24px;font-family:$($DG.font)`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`"><tr>" +
        "<td valign=`"bottom`" style=`"font-size:12px;color:$($DG.muted);padding-bottom:4px;white-space:nowrap;padding-right:8px`">$($T.budgetPf)</td><td align=`"right`" style=`"font-size:13px;color:$($DG.ink);padding-bottom:4px`"><b>$(DgE ($T.spentPct -f (DgMoney $k.cost), (DgMoney $k.budget), $burn))</b></td></tr>" +
        "<tr><td colspan=`"2`">$(DgBudgetBar @{ budget = $k.budget; cost = $k.cost; forecastCost = $k.forecast; progress = 100 } 10)</td></tr>" +
        "<tr><td colspan=`"2`" style=`"font-size:12px;color:$($DG.muted);padding-top:4px`">$(DgE ($T.fcost -f (DgMoney $k.forecast))) $(DgBudgetNote @{ budget = $k.budget; forecastCost = $k.forecast } $T)</td></tr></table></td></tr>"
    $att = if (@($M.attention | Where-Object { $_ }).Count) {
        (DgH $T.attention $DG.coral) + "<tr><td style=`"padding:0 24px`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`">" +
        (($M.attention | ForEach-Object {
            "<tr><td style=`"padding:4px 0`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`"><tr><td style=`"border-left:4px solid $($DG[(DgRag $_.rag)]);background:$($DG.soft);padding:9px 12px;font-family:$($DG.font);font-size:13px;line-height:18px;color:$($DG.text)`"><a href=`"$($_.url)`" style=`"color:$($DG.ink);font-weight:700;text-decoration:none`">$(DgE $_.code) · $(DgE $_.title)</a><br>$(DgE $_.reason)<br><span style=`"font-size:11px;color:$($DG.muted)`">$(DgPeople $_ $T)</span></td></tr></table></td></tr>" }) -join "") +
        "</table></td></tr>"
    } else { "" }
    $countries = if (@($M.byCountry | Where-Object { $_ }).Count) {
        (DgH $T.byCountry $DG.violet) + "<tr><td style=`"padding:0 24px`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`">" +
        (($M.byCountry | ForEach-Object {
            $cn = [math]::Max(1, $_.g + $_.y + $_.r + $_.n)
            $cb = if ($_.budget) { [math]::Round($_.cost / $_.budget * 100) } else { 0 }
            "<tr><td valign=`"top`" style=`"padding:7px 10px 7px 0;width:110px;font-family:$($DG.font);font-size:13px;color:$($DG.ink)`"><b>$(DgE $_.name)</b> <span style=`"color:$($DG.muted)`">$($_.g + $_.y + $_.r + $_.n)</span></td>" +
            "<td style=`"padding:9px 0 7px 0;font-family:$($DG.font)`">$(DgBar @(@{ w = $_.g * 100 / $cn; c = $DG.g }, @{ w = $_.y * 100 / $cn; c = $DG.y }, @{ w = $_.r * 100 / $cn; c = $DG.r }, @{ w = $_.n * 100 / $cn; c = $DG.n }) 10)" +
            "<div style=`"font-size:11px;line-height:15px;color:$($DG.muted);padding-top:4px`">$(DgE ($T.spentPct -f (DgMoney $_.cost), (DgMoney $_.budget), $cb))$(if ($_.stale) { ' · <b style="color:' + $DG.violet + '">' + (DgE ($T.staleN -f $_.stale)) + '</b>' })</div></td></tr>" }) -join "") +
        "</table></td></tr>"
    } else { "" }
    $rows = ($M.projects | ForEach-Object {
        $slip = if ($_.slipDays -gt 0) { "<span style=`"color:$($DG.r);font-weight:700`">$(DgE ($T.slip -f $_.slipDays))</span>" } elseif ($_.slipDays -lt 0) { "<span style=`"color:$($DG.g);font-weight:700`">$(DgE ($T.ahead -f (-$_.slipDays)))</span>" } else { "<span style=`"color:$($DG.muted)`">—</span>" }
        $pb = if ($_.budget) { [math]::Round([double]$_.cost / [double]$_.budget * 100) } else { 0 }
        $pbC = if ($pb -gt [double]$_.progress + 20) { $DG.coral } else { $DG.n }
        "<tr><td valign=`"top`" style=`"padding:11px 6px 9px 0;border-bottom:1px solid $($DG.line);width:14px`">$(DgDot (DgRag $_.rag) 10)</td>" +
        "<td style=`"padding:8px 6px;border-bottom:1px solid $($DG.line);font-family:$($DG.font);font-size:13px;line-height:17px`"><a href=`"$($_.url)`" style=`"color:$($DG.ink);font-weight:700;text-decoration:none`">$(DgE $_.title)</a><br><span style=`"font-size:11px;color:$($DG.muted)`">$(DgE $_.code)$(if ($_.country) { ' · ' + (DgE $_.country) }) · $(DgPeople $_ $T)</span><br><span style=`"font-size:11px;color:$(if ($_.isStale) { $DG.violet } else { $DG.muted });$(if ($_.isStale) { 'font-weight:700' })`">$(if ($_.report) { DgE ($T.repOf -f (DgDate $_.report.date)) } else { DgE $T.noRep })</span></td>" +
        "<td valign=`"top`" style=`"padding:8px 6px;border-bottom:1px solid $($DG.line);width:92px;font-family:$($DG.font);font-size:11px;color:$($DG.muted)`">$($T.colDone) <b style=`"color:$($DG.ink);font-size:12px`">$($_.progress)%</b><div style=`"padding:3px 0 5px`">$(DgPct $_.progress $DG.violet)</div>$($T.colBudget) <b style=`"color:$($DG.ink)`">$pb%</b><div style=`"padding-top:3px`">$(DgBudgetBar $_ 6)</div><div style=`"padding-top:3px;white-space:nowrap`">$(DgMoney $_.cost) / $(DgMoney $_.budget)</div><div style=`"white-space:nowrap`">$(DgBudgetNote $_ $T)</div></td>" +
        "<td valign=`"top`" align=`"right`" style=`"padding:8px 0 8px 6px;border-bottom:1px solid $($DG.line);width:52px;font-family:$($DG.font);font-size:12px;white-space:nowrap`"><span style=`"font-size:11px;color:$($DG.muted)`">$($T.colTerm)</span><br>$slip</td></tr>" }) -join ""
    $table = (DgH $T.projects $DG.violet) + "<tr><td style=`"padding:0 24px`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"border-collapse:collapse`">$rows</table></td></tr>"
    $tiles + $distRow + $budgetRow + $att + $countries + (DgGantt $M $T) + $table
}

# «Потрібні рішення»: что, по какому проекту, к кому обращаться, с какой даты ждёт
function DgDecisions($list, $T) {
    if (-not @($list | Where-Object { $_ }).Count) { return "" }
    (DgH $T.decisionsH $DG.coral) + "<tr><td style=`"padding:0 24px`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`">" +
    (($list | ForEach-Object {
        $since = if ($_.since) { " · " + (DgE ($T.waits -f (DgDate $_.since))) } else { "" }
        "<tr><td style=`"padding:4px 0`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`"><tr><td style=`"background:#FFF1EC;border-left:4px solid $($DG.coral);padding:10px 12px;font-family:$($DG.font);font-size:13px;line-height:18px;color:$($DG.ink)`"><b>$(DgE $_.text)</b><br>" +
        "<a href=`"$($_.url)`" style=`"color:$($DG.text);text-decoration:none`">$(DgE $_.code) · $(DgE $_.title)</a><br><span style=`"font-size:11px;color:$($DG.muted)`">$($T.ask): $(DgPeople $_ $T)$since</span></td></tr></table></td></tr>" }) -join "") +
    "</table></td></tr>"
}

# «Головні ризики» портфеля: просроченные и с оценкой от 12
function DgRisks($list, $T) {
    if (-not @($list | Where-Object { $_ }).Count) { return "" }
    (DgH $T.risksH $DG.r) + "<tr><td style=`"padding:0 24px`"><table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"font-family:$($DG.font)`">" +
    (($list | ForEach-Object {
        $c = if ($_.score -ge 15) { $DG.r } elseif ($_.score -ge 8) { $DG.y } else { $DG.g }
        $d = if ($_.overdue) { DgPill $T.overdue $DG.r } else { "<span style=`"color:$($DG.muted)`">$(DgE ($T.due -f (DgDate $_.due)))</span>" }
        "<tr><td valign=`"top`" style=`"width:34px;padding:6px 8px 6px 0;border-bottom:1px solid $($DG.line)`">$(DgPill ([string]$_.score) $c)</td><td style=`"padding:6px 0;border-bottom:1px solid $($DG.line);font-size:13px;line-height:18px;color:$($DG.text)`"><b style=`"color:$($DG.ink)`">$(DgE $_.code)</b> $(DgE $_.title)<br><span style=`"font-size:11px;color:$($DG.muted)`">$($T.owner) $(DgE $_.owner) · </span><span style=`"font-size:11px`">$d</span></td></tr>" }) -join "") +
    "</table></td></tr>"
}

# «Що змінилося»: общий список (руководитель, CEO) или по проектам (участник)
function DgChanges($M, $T) {
    $since = if ($M.first) { "" } else { "<div style=`"font-size:12px;color:$($DG.muted);padding-bottom:2px`">" + (DgE ($T.since -f (DgDate $M.prevDate))) + "</div>" }
    # по проектам: сначала проекты с ухудшениями, внутри — ухудшения, улучшения, остальное
    $rank = @{ worse = 0; better = 1; info = 2 }
    $groups = @($M.projects | Where-Object { @($_.changes | Where-Object { $_ }).Count } |
        Sort-Object { @($_.changes | ForEach-Object { $rank[$_.kind] } | Sort-Object)[0] }, { -@($_.changes | Where-Object { $_.kind -eq "worse" }).Count })
    $inner = if ($M.first) { "<p style=`"margin:0;color:$($DG.muted);font-size:13px`">$($T.first)</p>" }
        elseif (-not $groups.Count) { "<p style=`"margin:0;color:$($DG.muted);font-size:13px`">$($T.nothing)</p>" }
        else {
            ($groups | ForEach-Object {
                $rows = @($_.changes | Where-Object { $_ } | Sort-Object { $rank[$_.kind] })
                "<table role=`"presentation`" width=`"100%`" cellpadding=`"0`" cellspacing=`"0`" border=`"0`" style=`"margin-top:10px;border-bottom:1px solid $($DG.line)`"><tr><td style=`"padding:4px 0 2px`">" +
                "<a href=`"$($_.url)`" style=`"font-size:13px;font-weight:700;color:$($DG.ink);text-decoration:none`">$(DgDot (DgRag $_.rag) 9) $(DgE $_.code) · $(DgE $_.title)</a></td></tr>" +
                "<tr><td style=`"padding:0 0 8px 15px`">$(DgChangeRows $rows $T)</td></tr></table>" }) -join ""
        }
    (DgH $T.changed $DG.violet) + "<tr><td style=`"padding:0 24px;font-family:$($DG.font)`">$since$inner</td></tr>"
}

# письмо целиком; $Logo — "cid:ppm-logo" (рассылка) или data URI (просмотр)
function New-DigestHtml($M, [string]$Logo) {
    $T = $DG_T[$M.lang]; if (-not $T) { $T = $DG_T.uk }
    $title = switch ($M.kind) { "member" { $T.kindMember } "manager" { $T.kindManager } default { $T.kindCeo } }
    $intro = switch ($M.kind) { "member" { $T.introMember } "manager" { $T.introManager } default { $T.introCeo -f ($M.countries -join ", ") } }
    $role = switch ($M.kind) { "member" { $T.roleMember } "manager" { $T.roleManager } default { $T.roleCeo } }
    $week = $T.week -f (DgDate $M.from), (DgDate $M.to)
    $M = Complete-DigestModel $M
    $pre = if ($M.kind -eq "member") { ($M.projects | ForEach-Object { "$($_.code) — $($T[(DgRag $_.rag)])" }) -join " · " } else { "$($M.kpi.total) $($T.kpiTotal) · $($M.kpi.r) $($T.kpiRed) · $($M.kpi.decisions) $($T.kpiDecision)" }
    $body = if ($M.kind -eq "member") {
        (DgH $T.now $DG.coral) + (($M.projects | ForEach-Object { DgProjectCard $_ $T $M }) -join "") + (DgChanges $M $T)
    } else {
        (DgH $T.now $DG.coral) + (DgPortfolio $M $T) + (DgDecisions $M.decisionsList $T) + (DgRisks $M.topRisks $T) + (DgChanges $M $T)
    }
    $firstNote = if ($M.first -and $M.kind -eq "member") { "<tr><td style=`"padding:0 24px 8px;font-family:$($DG.font);font-size:12px;color:$($DG.muted)`">$($T.first)</td></tr>" } else { "" }
    @"
<!DOCTYPE html>
<html lang="$($M.lang)" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>PPM · $(DgE $title)</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body{margin:0;padding:0;background:$($DG.soft)} a{color:$($DG.violet)}
  @media (max-width:620px){ .wrap{width:100% !important} .px{padding-left:16px !important;padding-right:16px !important} }
  /* тёмная тема (Apple Mail, iOS, Outlook для Mac / iOS — где поддерживается): цвета по встроенным стилям */
  @media (prefers-color-scheme:dark){
    .bg{background:#121212 !important} .card{background:#1E1E1E !important}
    [style*="color:#1F1F1F"]{color:#F2F2F2 !important} [style*="color:#404040"]{color:#D0D0D0 !important} [style*="color:#868686"]{color:#A3A3A3 !important}
    [style*="background:#F4F4F4"]{background:#2A2A2A !important} [style*="background:#FFF1EC"]{background:#3A2620 !important}
    [style*="#D9D9D9"]{border-color:#3A3A3A !important} .btn{background:#9B7DD4 !important}
  }
  [data-ogsc] .btn{background:#9B7DD4 !important}
</style>
</head>
<body style="margin:0;padding:0;background:$($DG.soft)">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">$(DgE $pre)</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" style="background:$($DG.soft)"><tr><td align="center" style="padding:20px 8px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="wrap card" style="max-width:600px;background:$($DG.white);border-radius:12px;overflow:hidden">
<tr><td style="background:$($DG.black);padding:22px 24px 20px 24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td><img src="$Logo" width="184" height="18" alt="eclectic" style="display:block;border:0;width:184px;height:18px"></td>
    <td align="right" style="font-family:$($DG.font);font-size:11px;letter-spacing:1px;color:$($DG.muted);text-transform:uppercase">PPM</td></tr></table>
  <div style="font-family:$($DG.font);font-size:26px;line-height:30px;font-weight:900;color:#FFFFFF;text-transform:uppercase;padding-top:22px">$(DgE $title)</div>
  <div style="font-family:$($DG.font);font-size:13px;line-height:18px;color:#BBBBBB;padding-top:6px">$(DgE $week) · $(DgE ($T.asOf -f (DgDate $M.asOf)))</div>
</td></tr>
<tr><td style="font-size:1px;line-height:4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="50%" style="background:$($DG.coral);height:4px;font-size:1px">&nbsp;</td><td width="50%" style="background:$($DG.violet);height:4px;font-size:1px">&nbsp;</td></tr></table></td></tr>
<tr><td class="px" style="padding:22px 24px 0 24px;font-family:$($DG.font);font-size:15px;line-height:22px;color:$($DG.text)"><b style="color:$($DG.ink)">$(DgE ($T.hello -f $M.name))</b><br>$(DgE $intro)</td></tr>
$firstNote
$body
<tr><td align="center" style="padding:28px 24px 8px 24px">$(DgButton $M.portalUrl $T.portal $DG.black)</td></tr>
<tr><td style="padding:18px 24px 24px 24px;font-family:$($DG.font);font-size:11px;line-height:16px;color:$($DG.muted);border-top:1px solid $($DG.line)">$(DgE ($T.why -f $role))<br>$(DgE $T.footer)</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>
"@
}
