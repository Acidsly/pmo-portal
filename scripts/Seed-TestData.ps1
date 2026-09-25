#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Наполняет ТЕСТОВЫЙ сайт портала демонстрационными данными: проекты, статус-отчёты, риски, комментарии, журнал.

.DESCRIPTION
    Только для тестового сайта (адрес должен заканчиваться на -test). Запуск — через Invoke-Env.ps1 -Env test -Action seed.
    Идемпотентен: проекты помечены кодом TEST-NN; уже существующий проект и всё, что к нему относится, пропускается.
    Данные записываются так, как их оставила бы синхронизация: карточка проекта соответствует последнему отчёту,
    отчёты отмечены применёнными (srApplied), в журнале есть строки «Створення» и «Статус-звіт».
    В pmoAcl записывается заглушка «seed»: синхронизация не добавит повторную строку «Створення»
    (она пишет её для проектов с пустым pmoAcl), а права выдаст, потому что заглушка не совпадёт с хэшем.

.EXAMPLE
    pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action seed
    (если есть config/focus-group.json — после демо-данных раздаёт роли фокус-группе, см. -Roles)
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    # люди для полей PM / Власник / Стейкхолдери / Власник ризику; по умолчанию — тестовые учётные записи тенанта
    [string[]]$People = @("j.pochobut@eclectic.group", "test.kovalenko@smarthr.kz", "test.burbega@fillin.kz"),
    # фокус-группа: JSON { "people": [e-mail…], "noRole": [e-mail…] } (config/focus-group.json, не в git).
    # Все — в «Учасники сайта»; people получают роли в проектах TEST-NN по кругу (Get-RolePlan), noRole — без ролей.
    [string]$Roles
)
$ErrorActionPreference = "Stop"
if ($SiteUrl -notmatch '-test/?$') { throw "Seed-TestData.ps1 работает только с тестовым сайтом (…/sites/*-test), получено: $SiteUrl" }

if ($Thumbprint)          { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
elseif ($CertificatePath) { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
else                      { Connect-PnPOnline -Url $SiteUrl -ClientId $ClientId -Interactive }

$today = (Get-Date).Date
function D([int]$days) { $today.AddDays($days).ToString("yyyy-MM-dd") }           # дата относительно сегодня
function SpDate([string]$d) { if ($d) { "$($d)T12:00:00Z" } else { $null } }      # как ToSpDate в Invoke-PMOSync.ps1
function Human([string]$d) { if ($d) { ([datetime]$d).ToString("dd.MM.yyyy") } else { "—" } }
function CalcRag($s, $b, $r) { if (@($s, $b, $r) -contains "Червоний") { "Червоний" } elseif (@($s, $b, $r) -contains "Жовтий") { "Жовтий" } else { "Зелений" } }

# люди: убедиться, что они есть на сайте (иначе поле «Користувач» не заполнится)
$U = @()
foreach ($p in $People) { try { $null = New-PnPUser -LoginName "i:0#.f|membership|$p"; $U += $p } catch { Write-Warning "Пользователь $p не найден — пропущен" } }
if (-not $U) { throw "Ни один пользователь из -People не найден в тенанте." }
function Person([int]$i) { $U[$i % $U.Count] }

# Автор и дата записи — как будто её создал человек в указанный день (приложение пишет от своего имени)
function Set-Authored($list, $id, [string]$who, [string]$when) {
    try {
        Set-PnPListItem -List $list -Identity $id -UpdateType UpdateOverwriteVersion `
            -Values @{ Author = $who; Editor = $who; Created = $when; Modified = $when } | Out-Null
    } catch { Write-Warning "  автор/дата записи $list #$id не заданы: $($_.Exception.Message)" }
}

# ---------------------------------------------------------------------------
# Данные. Отчёты — в порядке дат, последний определяет состояние карточки.
# s/b/r — оценки термінів, бюджету, ресурсів: g = Зелений, y = Жовтий, r = Червоний
# ---------------------------------------------------------------------------
$RAG = @{ g = "Зелений"; y = "Жовтий"; r = "Червоний" }
$projects = @(
    @{ Code = "TEST-01"; Title = "Впровадження 1С:ЗУП у Казахстані"; Type = "Стратегічний"; Priority = "1 — Високий"; Dept = "Розрахунок зарплати"
       PM = 0; Owner = 1; St = @(2); Start = D -206; GoLive = D 53; PlanEnd = D 85; Budget = 2400000
       Desc = "Перехід розрахунку зарплати казахстанських клієнтів на 1С:ЗУП КОРП: міграція даних, налаштування розрахунку, навчання розрахунковців."
       Reports = @(
         @{ Days = -30; Title = "Завершено міграцію довідників і кадрових даних"; Status = "Реалізація"; Progress = 40; Cost = 1050000; S = "g"; B = "g"; R = "y"
            Done = "Перенесено довідники та кадрові дані 12 клієнтів. Налаштовано базові види нарахувань."; Next = "Паралельний розрахунок за вересень для трьох пілотних клієнтів."; Issues = "Не вистачає одного консультанта з розрахунку." }
         @{ Days = -16; Title = "Пілотний паралельний розрахунок: розбіжності у 2 з 3 клієнтів"; Status = "Реалізація"; Progress = 48; Cost = 1280000; S = "y"; B = "g"; R = "y"; Forecast = D 127
            Reason = "Розбіжності паралельного розрахунку потребують доопрацювання формул."
            Done = "Проведено паралельний розрахунок для трьох клієнтів; у двох розбіжності в утриманнях."; Next = "Виправити формули утримань, повторити розрахунок."; Issues = "Зсув запуску на 6 тижнів, якщо розбіжності не закриємо до кінця місяця." }
         @{ Days = -3;  Title = "Розбіжності закрито у першого клієнта, другий — у роботі"; Status = "Реалізація"; Progress = 55; Cost = 1450000; S = "y"; B = "g"; R = "g"
            Done = "Виправлено формули утримань; перший клієнт звірений без розбіжностей. Підключено другого консультанта."; Next = "Звірити другого клієнта, почати навчання розрахунковців."; Issues = "Прогноз завершення — кінець січня." } ) }
    @{ Code = "TEST-02"; Title = "Портал самообслуговування співробітників"; Type = "Стратегічний"; Priority = "1 — Високий"; Dept = "HR та кадрове адміністрування"
       PM = 1; Owner = 0; St = @(2); Start = D -150; GoLive = D 20; PlanEnd = D 45; Budget = 1800000
       Desc = "Особистий кабінет співробітника: заявки на відпустку, довідки, розрахункові листи, підпис документів КЕП."
       Reports = @(
         @{ Days = -28; Title = "Готовий прототип кабінету, почато інтеграцію з ЗУП"; Status = "Реалізація"; Progress = 30; Cost = 820000; S = "g"; B = "y"; R = "g"
            Done = "Затверджено прототип, розгорнуто тестове середовище."; Next = "Інтеграція із ЗУП: відпустки та довідки."; Issues = "Постачальник КЕП підняв ціну на 15%." }
         @{ Days = -5;  Title = "Інтеграція з ЗУП затримується, бюджет перевищено"; Status = "Реалізація"; Progress = 35; Cost = 1350000; S = "r"; B = "r"; R = "y"; Forecast = D 110
            Reason = "Затримка інтеграції з ЗУП і подорожчання КЕП."; Decision = "Погодити додатковий бюджет 400 000 ₴ або скоротити обсяг першого релізу (без підпису КЕП)."
            Done = "Реалізовано заявки на відпустку. Інтеграція довідок блокована доступом до API ЗУП."; Next = "Отримати доступ до API, вирішити питання бюджету."; Issues = "Без рішення по бюджету запуск у листопаді неможливий." } ) }
    @{ Code = "TEST-03"; Title = "Міграція пошти та файлів у Microsoft 365"; Type = "Звичайний"; Priority = "2 — Середній"; Dept = "ІТ"
       PM = 2; Owner = 0; St = @(1); Start = D -120; GoLive = D -10; PlanEnd = D 20; Budget = 650000
       Desc = "Перенесення поштових скриньок, спільних папок і файлових серверів у Exchange Online та SharePoint."
       Reports = @(
         @{ Days = -24; Title = "Пошту перенесено для 80% користувачів"; Status = "Реалізація"; Progress = 65; Cost = 410000; S = "g"; B = "g"; R = "g"
            Done = "Перенесено 240 поштових скриньок."; Next = "Решта скриньок, спільні папки."; Issues = "" }
         @{ Days = -10; Title = "Пошту перенесено повністю, запуск відбувся"; Status = "Реалізація"; Progress = 75; Cost = 470000; S = "g"; B = "g"; R = "g"
            Done = "Усі поштові скриньки в Exchange Online, старий сервер у режимі читання."; Next = "Перенесення файлових серверів."; Issues = "" }
         @{ Days = -2;  Title = "Почато перенесення файлових серверів"; Status = "Реалізація"; Progress = 80; Cost = 505000; S = "g"; B = "g"; R = "g"
            Done = "Перенесено папки бухгалтерії та HR."; Next = "Папки продажів і юридичного відділу."; Issues = "" } ) }
    @{ Code = "TEST-04"; Title = "CRM для відділу продажів"; Type = "Стратегічний"; Priority = "2 — Середній"; Dept = "Продажі"
       PM = 0; Owner = 2; St = @(1); Start = D -20; GoLive = D 160; PlanEnd = D 200; Budget = 1200000
       Desc = "Вибір і впровадження CRM: воронка продажів, історія клієнтів, інтеграція з поштою та 1С."
       Reports = @(
         @{ Days = -6; Title = "Зібрано вимоги, короткий список з трьох систем"; Status = "Планування"; Progress = 10; Cost = 60000; S = "g"; B = "g"; R = "g"
            Done = "Інтерв'ю з 8 менеджерами, документ вимог."; Next = "Демонстрації трьох постачальників."; Issues = "" } ) }
    @{ Code = "TEST-05"; Title = "Автоматизація закриття місяця"; Type = "Звичайний"; Priority = "1 — Високий"; Dept = "Фінанси"
       PM = 1; Owner = 2; St = @(0); Start = D -180; GoLive = D 10; PlanEnd = D 30; Budget = 540000
       Desc = "Регламентні операції закриття місяця, звірка з банком і контрагентами, чек-лист закриття."
       Reports = @(
         @{ Days = -40; Title = "Автоматизовано звірку з банком"; Status = "Реалізація"; Progress = 50; Cost = 260000; S = "g"; B = "g"; R = "g"
            Done = "Звірка банківських виписок виконується автоматично."; Next = "Звірка з контрагентами."; Issues = "" }
         @{ Days = -25; Title = "Звірка з контрагентами: затримка через формати актів"; Status = "Реалізація"; Progress = 60; Cost = 330000; S = "y"; B = "g"; R = "g"
            Done = "Узгоджено формат актів звірки з двома найбільшими контрагентами."; Next = "Решта контрагентів."; Issues = "Контрагенти надсилають акти в різних форматах." } ) }
    @{ Code = "TEST-06"; Title = "Електронний документообіг з клієнтами"; Type = "Звичайний"; Priority = "2 — Середній"; Dept = "Юридичний"
       PM = 2; Owner = 1; St = @(0); Start = D -200; GoLive = D 60; PlanEnd = D 90; Budget = 380000
       Desc = "Обмін договорами та актами з клієнтами через сервіс ЕДО з підписом КЕП."
       Reports = @(
         @{ Days = -35; Title = "Проєкт призупинено до вибору нового постачальника ЕДО"; Status = "Призупинено"; Progress = 40; Cost = 150000; S = "y"; B = "g"; R = "y"
            Reason = "Постачальник ЕДО припиняє роботу в Україні."
            Done = "Підключено 15 клієнтів до пілоту."; Next = "Тендер на нового постачальника."; Issues = "Потрібна повторна інтеграція." } ) }
    @{ Code = "TEST-07"; Title = "Навчальна платформа для нових співробітників"; Type = "Звичайний"; Priority = "3 — Низький"; Dept = "HR та кадрове адміністрування"
       PM = 1; Owner = 0; St = @(); Start = D 14; GoLive = D 120; PlanEnd = D 150; Budget = 250000
       Desc = "Онбординг-курси, тести та трекінг проходження навчання новими співробітниками."
       Reports = @() }
    @{ Code = "TEST-08"; Title = "Оновлення мережевої інфраструктури офісу"; Type = "Звичайний"; Priority = "3 — Низький"; Dept = "ІТ"
       PM = 2; Owner = 0; St = @(); Start = D -160; GoLive = D -40; PlanEnd = D -30; Budget = 420000
       Desc = "Заміна комутаторів і точок доступу Wi-Fi, сегментація мережі."
       Reports = @(
         @{ Days = -45; Title = "Обладнання встановлено, триває налаштування"; Status = "Реалізація"; Progress = 85; Cost = 380000; S = "g"; B = "g"; R = "g"
            Done = "Встановлено комутатори та точки доступу."; Next = "Сегментація, документація."; Issues = "" }
         @{ Days = -27; Title = "Проєкт завершено, мережу передано в експлуатацію"; Status = "Завершено"; Progress = 100; Cost = 405000; S = "g"; B = "g"; R = "g"
            Done = "Сегментацію виконано, документацію передано службі підтримки."; Next = ""; Issues = "" } ) }
    @{ Code = "TEST-09"; Title = "Звітність для клієнтів у Power BI"; Type = "Стратегічний"; Priority = "2 — Середній"; Dept = "Операції"
       PM = 0; Owner = 1; St = @(1, 2); Start = D -100; GoLive = D 30; PlanEnd = D 60; Budget = 700000
       Desc = "Панелі для клієнтів: чисельність, фонд оплати праці, плинність кадрів, відпустки."
       Reports = @(
         @{ Days = -18; Title = "Опубліковано перші дві панелі для пілотних клієнтів"; Status = "Реалізація"; Progress = 60; Cost = 390000; S = "g"; B = "g"; R = "g"
            Done = "Панелі «Чисельність» і «ФОП» у пілотних клієнтів."; Next = "Панель плинності кадрів."; Issues = "" }
         @{ Days = -4;  Title = "Готова панель плинності кадрів"; Status = "Реалізація"; Progress = 70; Cost = 450000; S = "g"; B = "g"; R = "g"
            Done = "Панель плинності, налаштовано RLS за клієнтом."; Next = "Панель відпусток, навчання клієнтів."; Issues = "" } ) }
    @{ Code = "TEST-10"; Title = "Інтеграція з банками для виплат зарплати"; Type = "Звичайний"; Priority = "1 — Високий"; Dept = "Розрахунок зарплати"
       PM = 1; Owner = 0; St = @(2); Start = D -90; GoLive = D 5; PlanEnd = D 25; Budget = 480000
       Desc = "Пряма передача зарплатних відомостей у банки через API замість файлів."
       Reports = @(
         @{ Days = -20; Title = "Інтеграцію з першим банком завершено"; Status = "Реалізація"; Progress = 40; Cost = 210000; S = "g"; B = "g"; R = "y"
            Done = "Відомості передаються через API першого банку."; Next = "Другий банк."; Issues = "Другий банк не надав тестовий доступ." }
         @{ Days = -1;  Title = "Другий банк не надає тестовий доступ, запуск під загрозою"; Status = "Реалізація"; Progress = 45; Cost = 260000; S = "r"; B = "g"; R = "y"; Forecast = D 60
            Reason = "Банк не надав тестовий доступ до API."; Decision = "Ескалація на рівні керівництва з банком або запуск лише з першим банком."
            Done = "Підготовлено специфікацію для другого банку."; Next = "Рішення керівництва щодо ескалації."; Issues = "Запуск зсувається на місяць." } ) }
)
$risks = @(
    @("TEST-01", "Ризик",    "Розбіжності розрахунку в пілотних клієнтів не буде закрито вчасно", 3, 4, "В роботі", 14, "Щоденна звірка, другий консультант."),
    @("TEST-01", "Ризик",    "Звільнення ключового розрахунковця клієнта під час запуску", 2, 3, "Відкрито", 40, "Навчити двох розрахунковців у кожного клієнта."),
    @("TEST-02", "Проблема", "Немає доступу до API ЗУП для інтеграції довідок", 5, 4, "Відкрито", 7, "Ескалація до ІТ клієнта, тимчасово — вивантаження файлів."),
    @("TEST-02", "Ризик",    "Перевищення бюджету через подорожчання КЕП", 4, 4, "Відкрито", 10, "Переговори з постачальником, альтернативний постачальник."),
    @("TEST-03", "Ризик",    "Втрата прав доступу до файлів під час перенесення", 2, 3, "В роботі", 20, "Вивантаження прав перед перенесенням, вибіркова перевірка."),
    @("TEST-04", "Ризик",    "Низьке залучення менеджерів з продажів", 3, 3, "Відкрито", 60, "Ключові користувачі в кожній команді, навчання."),
    @("TEST-05", "Проблема", "Контрагенти надсилають акти звірки в різних форматах", 4, 2, "В роботі", 15, "Шаблон акту, розпізнавання PDF."),
    @("TEST-06", "Проблема", "Постачальник ЕДО припиняє роботу", 5, 5, "Відкрито", 30, "Тендер на нового постачальника."),
    @("TEST-09", "Ризик",    "Клієнти побачать чужі дані через помилку RLS", 1, 5, "Відкрито", 20, "Автотести RLS перед кожною публікацією."),
    @("TEST-10", "Проблема", "Другий банк не надає тестовий доступ до API", 5, 4, "Відкрито", 5, "Ескалація через керівництво."),
    @("TEST-10", "Ризик",    "Зміна формату API банком без попередження", 2, 4, "Відкрито", 45, "Моніторинг відповідей, резервна передача файлом."),
    @("TEST-08", "Ризик",    "Перебої зв'язку під час заміни обладнання", 3, 2, "Закрито", -35, "Роботи у вихідні.")
)
$comments = @(
    @("TEST-01", 1, -15, "Прошу на наступному звіті показати план закриття розбіжностей по днях."),
    @("TEST-01", 0, -2,  "План закриття розбіжностей додано в Loop, друга звірка — у п'ятницю."),
    @("TEST-02", 0, -4,  "Питання бюджету винесено на комітет у четвер."),
    @("TEST-02", 2, -3,  "Можемо запустити перший реліз без КЕП — погоджуємо з юристами."),
    @("TEST-03", 0, -9,  "Дякуємо команді, перенесення пошти пройшло без скарг."),
    @("TEST-05", 2, -20, "Чекаємо оновлений звіт — останній був майже місяць тому."),
    @("TEST-06", 1, -30, "Тендер на нового постачальника ЕДО стартує в жовтні."),
    @("TEST-09", 1, -3,  "Пілотні клієнти просять додати фільтр за підрозділами."),
    @("TEST-10", 0, -1,  "Зустріч з керівництвом банку запланована на наступний тиждень.")
)

# ---------------------------------------------------------------------------
# Запись
# ---------------------------------------------------------------------------
$existing = @{}
foreach ($it in (Get-PnPListItem -List "Lists/Projects" -PageSize 500 -Fields "pmCode","pmoAcl")) {
    if (-not $it["pmCode"]) { continue }
    $existing[[string]$it["pmCode"]] = $it.Id
    # демо-проекты из прежней версии скрипта — без заглушки (см. описание)
    if ([string]$it["pmCode"] -like "TEST-*" -and -not $it["pmoAcl"]) { Set-PnPListItem -List "Lists/Projects" -Identity $it.Id -Values @{ pmoAcl = "seed" } -UpdateType SystemUpdate | Out-Null }
}
$ids = @{}; $new = @{}
$n = @{ projects = 0; reports = 0; risks = 0; comments = 0; changes = 0 }

function Add-Change($pid_, [string]$title, [string]$field, [string]$from, [string]$to, [string]$kind, [string]$who, [string]$reason, [string]$when) {
    $v = @{ Title = $title; kcProject = $pid_; kcDate = $when; kcKind = $kind; kcField = $field; kcFrom = $from; kcTo = $to; kcReason = $reason; kcChangedBy = $who }
    Add-PnPListItem -List "Lists/KeyChanges" -Values $v | Out-Null
    $script:n.changes++
}

foreach ($p in $projects) {
    if ($existing.ContainsKey($p.Code)) { $ids[$p.Code] = $existing[$p.Code]; Write-Host "  = $($p.Code) уже есть"; continue }
    $first = $p.Reports | Select-Object -First 1
    $last  = $p.Reports | Select-Object -Last 1
    $createdOn = if ($first) { D ($first.Days - 7) } else { D -3 }
    $pm = Person $p.PM
    # карточка при создании: начальный статус, даты — как ввёл PM
    $v = @{ Title = $p.Title; pmCode = $p.Code; pmType = $p.Type; pmPriority = $p.Priority; pmDepartment = $p.Dept
            pmManager = $pm; pmOwner = (Person $p.Owner); pmStatus = $(if ($first) { "Планування" } else { "Ініціація" })
            pmProgress = 0; pmStart = (SpDate $p.Start); pmGoLive = (SpDate $p.GoLive); pmPlanEnd = (SpDate $p.PlanEnd)
            pmBudget = $p.Budget; pmDescription = $p.Desc; pmoAcl = "seed" }
    if ($p.St) { $v.pmStakeholders = @($p.St | ForEach-Object { Person $_ } | Select-Object -Unique | Where-Object { $_ -ne $pm }) }
    if (-not $v.pmStakeholders) { $v.Remove("pmStakeholders") }
    $item = Add-PnPListItem -List "Lists/Projects" -Values $v
    $id = $item.Id; $ids[$p.Code] = $id; $new[$p.Code] = $true; $n.projects++
    Set-Authored "Lists/Projects" $id $pm (SpDate $createdOn)
    Add-Change $id "Проєкт" "Title" "—" $p.Title "Створення" $pm "" (SpDate $createdOn)
    Write-Host "  + $($p.Code) $($p.Title)" -ForegroundColor Green

    # отчёты — как их применила бы синхронизация
    $state = @{ pmStatus = $v.pmStatus; pmProgress = "0"; pmForecastEnd = "" }
    foreach ($r in $p.Reports) {
        $date = D $r.Days
        $rv = @{ Title = $r.Title; srProject = $id; srDate = (SpDate $date); srPeriod = "2 тижні"
                 srSchedule = $RAG[$r.S]; srBudget = $RAG[$r.B]; srResources = $RAG[$r.R]
                 srStatus = $r.Status; srProgress = $r.Progress; srActualCost = $r.Cost
                 srDone = $r.Done; srNext = $r.Next; srIssues = $r.Issues
                 srApplied = $true; srProjectType = $p.Type; srProjectPriority = $p.Priority }
        if ($r.Forecast) { $rv.srForecastEnd = SpDate $r.Forecast }
        if ($r.Reason)   { $rv.srKeyReason = $r.Reason }
        if ($r.Decision) { $rv.srDecision = $true; $rv.srDecisionText = $r.Decision }
        foreach ($k in @($rv.Keys)) { if ($rv[$k] -eq "" -or $null -eq $rv[$k]) { $rv.Remove($k) } }
        $ri = Add-PnPListItem -List "Lists/StatusReports" -Values $rv; $n.reports++
        Set-Authored "Lists/StatusReports" $ri.Id $pm (SpDate $date)

        $reason = @($r.Reason, $r.Title) | Where-Object { $_ } | Join-String -Separator " · "
        $status = if ($r.Status -eq "Завершено") { "Архівний" } else { $r.Status }
        if ($state.pmStatus -ne $status) { Add-Change $id "Статус проєкту" "pmStatus" $state.pmStatus $status "Статус-звіт" $pm $reason (SpDate $date); $state.pmStatus = $status }
        if ($state.pmProgress -ne [string]$r.Progress) { Add-Change $id "% виконання" "pmProgress" "$($state.pmProgress)%" "$($r.Progress)%" "Статус-звіт" $pm $reason (SpDate $date); $state.pmProgress = [string]$r.Progress }
        if ($r.Forecast -and $state.pmForecastEnd -ne $r.Forecast) { Add-Change $id "Прогноз завершення" "pmForecastEnd" (Human $state.pmForecastEnd) (Human $r.Forecast) "Статус-звіт" $pm $reason (SpDate $date); $state.pmForecastEnd = $r.Forecast }
    }

    # карточка после отчётов = последний отчёт (как после синхронизации)
    if ($last) {
        $cv = @{ pmStatus = $state.pmStatus; pmProgress = $last.Progress; pmActualCost = $last.Cost
                 pmRAG = (CalcRag $RAG[$last.S] $RAG[$last.B] $RAG[$last.R]); pmLastUpdate = (SpDate (D $last.Days)); pmLastReport = $last.Title }
        if ($state.pmForecastEnd) { $cv.pmForecastEnd = SpDate $state.pmForecastEnd }
        if ($last.Status -eq "Завершено") { $cv.pmArchivedAt = SpDate (D $last.Days) }
        Set-PnPListItem -List "Lists/Projects" -Identity $id -Values $cv -UpdateType SystemUpdate | Out-Null
    }
}

$byCode = @{}; foreach ($p in $projects) { $byCode[$p.Code] = $p }
foreach ($x in $risks) {
    if (-not $new[$x[0]]) { continue }
    $v = @{ Title = $x[2]; riProject = $ids[$x[0]]; riType = $x[1]; riProbability = $x[3]; riImpact = $x[4]; riStatus = $x[5]
            riDue = (SpDate (D $x[6])); riMitigation = $x[7]; riOwner = (Person $byCode[$x[0]].PM)
            riProjectType = $byCode[$x[0]].Type; riProjectPriority = $byCode[$x[0]].Priority }
    $ri = Add-PnPListItem -List "Lists/RisksIssues" -Values $v; $n.risks++
    Set-Authored "Lists/RisksIssues" $ri.Id (Person $byCode[$x[0]].PM) (SpDate (D ([Math]::Min($x[6], 0) - 10)))
}

$lastComment = @{}
foreach ($x in $comments) {
    if (-not $new[$x[0]]) { continue }
    $who = Person $x[1]; $when = D $x[2]
    $ci = Add-PnPListItem -List "Lists/ProjectComments" -Values @{ cmProject = $ids[$x[0]]; cmText = $x[3] }; $n.comments++
    Set-Authored "Lists/ProjectComments" $ci.Id $who (SpDate $when)
    if (-not $lastComment[$x[0]] -or $when -ge $lastComment[$x[0]].When) { $lastComment[$x[0]] = @{ When = $when; Text = $x[3]; Item = $ci.Id } }
}
# «Останній коментар» — в формате синхронизации: текст — автор, дата
foreach ($code in $lastComment.Keys) {
    $c = Get-PnPListItem -List "Lists/ProjectComments" -Id $lastComment[$code].Item -Fields "cmText","Author","Created"
    $txt = "{0} — {1}, {2}" -f $c["cmText"], $c["Author"].LookupValue, $c["Created"].ToLocalTime().ToString("dd.MM.yyyy")
    Set-PnPListItem -List "Lists/Projects" -Identity $ids[$code] -Values @{ pmLastComment = $txt } -UpdateType SystemUpdate | Out-Null
}

Write-Host ("`nГотово: проектов {0}, статус-отчётов {1}, рисков {2}, комментариев {3}, записей журнала {4}" -f $n.projects, $n.reports, $n.risks, $n.comments, $n.changes) -ForegroundColor Green

# ---------------------------------------------------------------------------
# Роли фокус-группы (-Roles): в каждом проекте TEST-NN — PM, собственник и стейкхолдер из списка по кругу,
# так что каждый (при людях ≤ проектов) получает все три роли в разных проектах. Лишние люди — стейкхолдерами.
# Повторный запуск ничего не меняет; меняются только поля участников, права пересчитает синхронизация.
# ---------------------------------------------------------------------------
function Get-RolePlan([string[]]$Emails, [string[]]$Codes) {
    $k = $Emails.Count; $plan = [ordered]@{}
    for ($j = 0; $j -lt $Codes.Count; $j++) {
        $st = @(); if ($k -ge 3) { $st += $Emails[($j + 2) % $k] }
        for ($x = $Codes.Count + $j; $x -lt $k; $x += $Codes.Count) { $st += $Emails[$x] }
        $plan[$Codes[$j]] = @{ pm = $Emails[$j % $k]; owner = $(if ($k -ge 2) { $Emails[($j + 1) % $k] } else { "" }); st = @($st | Where-Object { $_ } | Select-Object -Unique) }
    }
    return $plan
}
if ($Roles) {
    $fg = Get-Content -Raw $Roles | ConvertFrom-Json
    $who = @($fg.people | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $_ })
    $none = @($fg.noRole | ForEach-Object { ([string]$_).Trim().ToLowerInvariant() } | Where-Object { $_ })
    if (-not $who) { throw "В $Roles нет people." }
    Write-Host "`nФокус-група: $($who.Count) з ролями, $($none.Count) без ролей" -ForegroundColor Cyan
    $members = (Get-PnPGroup -AssociatedMemberGroup).Title
    $inGroup = @(Get-PnPGroupMember -Group $members | ForEach-Object { ([string]$_.Email).ToLowerInvariant() })
    foreach ($e in $who + $none) {
        try { $null = New-PnPUser -LoginName "i:0#.f|membership|$e" } catch { Write-Warning "  $e не знайдено в тенанті — пропущено"; continue }
        if ($inGroup -notcontains $e) { Add-PnPGroupMember -Group $members -EmailAddress $e | Out-Null; Write-Host "  + $e — учасник сайту" }
    }
    $items = @(Get-PnPListItem -List "Lists/Projects" -PageSize 500 | Where-Object { [string]$_["pmCode"] -match '^TEST-\d+$' } | Sort-Object { [string]$_["pmCode"] })
    $plan = Get-RolePlan $who @($items | ForEach-Object { [string]$_["pmCode"] })
    foreach ($it in $items) {
        $want = $plan[[string]$it["pmCode"]]
        $cur = @{ pm = ([string]$it["pmManager"].Email).ToLowerInvariant(); owner = ([string]$it["pmOwner"].Email).ToLowerInvariant()
                  st = @($it["pmStakeholders"] | ForEach-Object { ([string]$_.Email).ToLowerInvariant() }) }
        if ($cur.pm -eq $want.pm -and $cur.owner -eq $want.owner -and (($cur.st | Sort-Object) -join ",") -eq (($want.st | Sort-Object) -join ",")) { continue }
        $vals = @{ pmManager = $want.pm; pmOwner = $(if ($want.owner) { $want.owner } else { $null }); pmStakeholders = @($want.st) }
        Set-PnPListItem -List "Lists/Projects" -Identity $it.Id -Values $vals | Out-Null
        Write-Host ("  {0}: PM {1}, власник {2}, стейкхолдери {3}" -f $it["pmCode"], $want.pm, $want.owner, ($want.st -join ", "))
    }
    Write-Host "Ролі роздано. Права і «Доступ до картки» видасть синхронізація." -ForegroundColor Green
}

