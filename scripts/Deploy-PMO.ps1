#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS
    Портфель проєктів — развёртывание всех компонентов SharePoint Online.

.DESCRIPTION
    Создаёт или обновляет (скрипт идемпотентен, его можно запускать повторно):
      1. Сайт-коммуникацию на трёх языках (uk-UA по умолчанию, en-US, ru-RU) и группу PMO.
      2. Списки: «Проєкти», «Статус-звіти», «Ризики та проблеми», «Зміни показників», «Коментарі» —
         со всеми полями, связями (подстановки с запретом удаления), переводами названий.
      3. Настройки форм: ключевые показатели скрыты из формы редактирования проекта —
         они меняются только через статус-отчёт.
      4. Права уровня списков: журнал изменений только для чтения пользователям.
      5. Представления (без группировок), «Архів» и меню сайта.
    Интерфейс портала — приложение SPFx (spfx/, устанавливает Deploy-App.ps1).
    Логику (перенос отчётов в карточку, журнал, архив, права по иерархии, напоминания)
    выполняет Invoke-PMOSync.ps1 — см. README.

.PARAMETER TenantName   contoso для https://contoso.sharepoint.com
.PARAMETER ClientId     Client ID приложения PnP (Register-PMOApps.ps1 выводит его)
.PARAMETER Tenant       contoso.onmicrosoft.com — нужен для входа по сертификату
.PARAMETER Thumbprint   вход по сертификату из хранилища (без браузера — для Claude Code и CI)
.PARAMETER CertificatePath / CertificatePassword — вход по файлу .pfx
.PARAMETER SiteAlias    адрес сайта /sites/<SiteAlias>
.PARAMETER Owner        e-mail владельца сайта

.EXAMPLE
    ./Deploy-PMO.ps1 -TenantName contoso -ClientId <guid> -Owner yurii@contoso.com
#>
param(
    [Parameter(Mandatory)][string]$TenantName,
    [Parameter(Mandatory)][string]$ClientId,
    [string]$SiteAlias = "pmo",
    [string]$SiteTitle = "Портфель проєктів",
    [string]$Owner,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword
)

$ErrorActionPreference = "Stop"
$adminUrl = "https://$TenantName-admin.sharepoint.com"
$siteUrl  = "https://$TenantName.sharepoint.com/sites/$SiteAlias"
$PMO_GROUP = "PMO-адміністратори"
$AppOnly = [bool]($Thumbprint -or $CertificatePath)
if ($AppOnly -and -not $Tenant) { throw "Для входа по сертификату укажите -Tenant (contoso.onmicrosoft.com)." }
if ($AppOnly -and -not $Owner)  { throw "При входе по сертификату укажите -Owner: владелец сайта не может быть определён автоматически." }

function Connect-Target([string]$Url) {
    if ($Thumbprint)          { Connect-PnPOnline -Url $Url -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
    elseif ($CertificatePath) { Connect-PnPOnline -Url $Url -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
    else                      { Connect-PnPOnline -Url $Url -ClientId $ClientId -Interactive }
}

# ===========================================================================
# Вспомогательные функции
# ===========================================================================
$script:Loc = @()
$script:ListNames = @{}   # Lists/<url> -> uk, en, ru — для пунктов меню сайта

function Set-Loc($Obj, [string]$Uk, [string]$En, [string]$Ru) {
    $Obj.TitleResource.SetValueForUICulture("uk-UA", $Uk)
    $Obj.TitleResource.SetValueForUICulture("en-US", $En)
    $Obj.TitleResource.SetValueForUICulture("ru-RU", $Ru)
}

function Get-RoleName([string]$Kind) {
    # Имена уровней разрешений локализованы (сайт на украинском), поэтому ищем по типу
    (Get-PnPRoleDefinition | Where-Object { $_.RoleTypeKind -eq $Kind } | Select-Object -First 1).Name
}

function Ensure-List([string]$Url, [string]$Uk, [string]$En, [string]$Ru) {
    try { $l = Get-PnPList -Identity $Url -ErrorAction Stop } catch { $l = $null }
    if (-not $l) {
        Write-Host "  + список $Uk" -ForegroundColor Green
        $l = New-PnPList -Title $Uk -Url $Url -Template GenericList -OnQuickLaunch
        Set-PnPList -Identity $l -EnableVersioning $true -MajorVersions 100 | Out-Null
    }
    $l = Get-PnPList -Identity $Url
    Set-Loc $l $Uk $En $Ru
    $script:ListNames[$Url] = @($Uk, $En, $Ru)
    # встроенные комментарии SharePoint выключены: комментарии к проекту — список «Коментарі»
    $l.DisableCommenting = $true
    $l.Update(); Invoke-PnPQuery
    return $l
}

# Подсказка под полем в форме (uk / en / ru); применяется вместе с переводами названий
$script:Desc = @()
function Desc($List, [string]$Name, [string]$Uk, [string]$En, [string]$Ru) { $script:Desc += , @($List, $Name, $Uk, $En, $Ru) }

# Список в текущем контексте PnP (объект, полученный раньше, мог остаться в прежнем контексте)
function Fresh-List($List) { Get-PnPList -Identity $List.Id }

function Test-Field($List, [string]$Name) {
    try { return Get-PnPField -List $List -Identity $Name -ErrorAction Stop } catch { return $null }
}

# Поле создаётся с DisplayName = внутреннему имени (латинское внутреннее имя гарантировано);
# локализованные названия назначаются в конце, после создания всех полей (формулы уже привязаны).
function F {
    param($List, [string]$Name, [string]$Type, [string]$Uk, [string]$En, [string]$Ru,
          [string]$Attrs = "", [string]$Inner = "")
    if (-not (Test-Field $List $Name)) {
        if ($Type -eq "Calculated") {
            # формула понимает отображаемые названия: на существующем сайте они уже переведены — подставляем текущие
            foreach ($ref in [regex]::Matches($Inner, "FieldRef Name='([^']+)'")) {
                $n = $ref.Groups[1].Value; $cur = (Get-PnPField -List $List -Identity $n).Title
                if ($cur -ne $n) { $Inner = $Inner.Replace("[$n]", "[$([System.Security.SecurityElement]::Escape($cur))]") }
            }
        }
        $xml = "<Field Type='$Type' Name='$Name' StaticName='$Name' DisplayName='$Name' $Attrs>$Inner</Field>"
        Add-PnPFieldFromXml -List $List -FieldXml $xml | Out-Null
        Write-Host "    + поле $Uk"
    }
    $script:Loc += , @($List, $Name, $Uk, $En, $Ru)
}

function Choices([string[]]$Items, [string]$Default) {
    $d = if ($Default) { "<Default>$Default</Default>" } else { "" }
    return "$d<CHOICES>" + (($Items | ForEach-Object { "<CHOICE>$_</CHOICE>" }) -join "") + "</CHOICES>"
}

function Set-FormVisibility($List, [string[]]$Names, [bool]$InNew, [bool]$InEdit) {
    # CSOM в PowerShell 7.6 (.NET 10) не собирает пакет из нескольких вызовов методов с параметром bool
    # («The node to be inserted is from a different document context»), поэтому каждый вызов — отдельным
    # запросом. Update() не нужен: SetShowIn*Form применяются сразу.
    $l = Fresh-List $List
    foreach ($n in $Names) {
        $f = $l.Fields.GetByInternalNameOrTitle($n)
        $f.SetShowInNewForm($InNew);   Invoke-PnPQuery
        $f.SetShowInEditForm($InEdit); Invoke-PnPQuery
    }
}

function Ensure-View($List, [string]$Title, [string[]]$Fields, [string]$Query) {
    $v = Get-PnPView -List $List | Where-Object Title -eq $Title
    if (-not $v) {
        $v = Add-PnPView -List $List -Title $Title -Fields $Fields -Query $Query -Paged -RowLimit 100
        Write-Host "    + представление $Title"
    } else {
        Set-PnPView -List $List -Identity $v.Id -Fields $Fields -Values @{ ViewQuery = $Query } | Out-Null
    }
    return $v
}

# Базовое представление списка (AllItems.aspx) — по адресу, а не по признаку «по умолчанию»:
# представлением по умолчанию может быть назначено другое (на ранее развёрнутых сайтах — «Плитки»)
function Set-BaseView($List, [string]$Title, [string[]]$Fields, [string]$Query) {
    $dv = Get-PnPView -List $List -Includes ServerRelativeUrl | Where-Object { $_.ServerRelativeUrl -like "*/AllItems.aspx" } | Select-Object -First 1
    Set-PnPView -List $List -Identity $dv.Id -Fields $Fields -Values @{ ViewQuery = $Query; Title = $Title } | Out-Null
    return $dv
}

# ===========================================================================
# 1. Сайт, языки, группа PMO
# ===========================================================================
Write-Host "1. Сайт $siteUrl" -ForegroundColor Cyan
Connect-Target $adminUrl
try { $exists = Get-PnPTenantSite -Identity $siteUrl -ErrorAction Stop } catch { $exists = $null }
if (-not $exists) {
    $a = @{ Type = "CommunicationSite"; Title = $SiteTitle; Url = $siteUrl; Lcid = 1058; Wait = $true }
    if ($Owner) { $a.Owner = $Owner }
    New-PnPSite @a | Out-Null
    Write-Host "  + сайт создан (язык по умолчанию — украинский)" -ForegroundColor Green
}
Connect-Target $siteUrl

$ctx = Get-PnPContext
$web = $ctx.Web
$web.IsMultilingual = $true
$web.AddSupportedUILanguage(1033)
$web.AddSupportedUILanguage(1049)
Set-Loc $web "Портфель проєктів" "Project portfolio" "Портфель проектов"
$web.Update()
Invoke-PnPQuery
Write-Host "  языки: uk-UA (по умолчанию), en-US, ru-RU"

$ROLE_FULL = Get-RoleName "Administrator"
$ROLE_EDIT = Get-RoleName "Contributor"
$ROLE_READ = Get-RoleName "Reader"

# PMO видит все проекты и заводит новые; править проект может только его PM (права элементов выдаёт синхронизация)
try { $g = Get-PnPGroup -Identity $PMO_GROUP -ErrorAction Stop } catch { $g = $null }
if (-not $g) {
    New-PnPGroup -Title $PMO_GROUP -Description "Перегляд усіх проєктів порталу, створення нових проєктів" | Out-Null
    Write-Host "  + группа $PMO_GROUP" -ForegroundColor Green
}
# миграция: раньше у PMO был полный доступ к сайту
$ctx = Get-PnPContext; $ra = $ctx.Web.RoleAssignments; $ctx.Load($ra); Invoke-PnPQuery
$pmoRoles = @()
foreach ($a in $ra) { $ctx.Load($a.Member); $ctx.Load($a.RoleDefinitionBindings) }; Invoke-PnPQuery
# системный «Обмежений доступ» (Hidden) SharePoint выдаёт сам под права элементов — его не трогаем
foreach ($a in $ra) { if ($a.Member.Title -eq $PMO_GROUP) { $pmoRoles = @($a.RoleDefinitionBindings | Where-Object { -not $_.Hidden } | ForEach-Object { $_.Name }) } }
foreach ($x in $pmoRoles) { if ($x -ne $ROLE_READ) { Set-PnPGroupPermissions -Identity $PMO_GROUP -RemoveRole $x | Out-Null; Write-Host "  $PMO_GROUP : снят уровень «$x» на сайте" } }
if ($pmoRoles -notcontains $ROLE_READ) { Set-PnPGroupPermissions -Identity $PMO_GROUP -AddRole $ROLE_READ | Out-Null; Write-Host "  $PMO_GROUP : чтение сайта" }

$rag       = @("Зелений", "Жовтий", "Червоний")
$status    = @("Ініціація", "Планування", "Реалізація", "Призупинено", "Скасовано", "Архівний")
$repStatus = @("Ініціація", "Планування", "Реалізація", "Призупинено", "Скасовано", "Завершено")
$types     = @("Стратегічний", "Звичайний")

# ===========================================================================
# 2. Проєкти — карточка проекта
# ===========================================================================
Write-Host "2. Список «Проєкти»" -ForegroundColor Cyan
$P = Ensure-List "Lists/Projects" "Проєкти" "Projects" "Проекты"

F $P pmCode        Text     "Код проєкту"        "Project code"        "Код проекта"          "MaxLength='30'"
F $P pmLoop        URL      "Посилання на картку в Loop" "Loop project card" "Ссылка на карточку в Loop" "Format='Hyperlink'"
F $P pmType        Choice   "Тип проєкту"        "Project type"        "Тип проекта"          "Format='Dropdown' Required='TRUE'" (Choices $types "Звичайний")
F $P pmManager     User     "PM"                 "PM"                  "PM"                   "UserSelectionMode='PeopleOnly' Required='TRUE'"
F $P pmOwner       User     "Власник"            "Owner"               "Собственник"          "UserSelectionMode='PeopleOnly'"
F $P pmStakeholders UserMulti "Стейкхолдери"     "Stakeholders"        "Стейкхолдеры"         "UserSelectionMode='PeopleOnly' Mult='TRUE'"
F $P pmDepartment  Choice   "Напрям"             "Area"                "Направление"          "Format='Dropdown'" (Choices @("ІТ","HR та кадрове адміністрування","Розрахунок зарплати","Продажі","Фінанси","Операції","Юридичний"))
F $P pmStatus      Choice   "Статус проєкту"     "Project status"      "Статус проекта"       "Format='Dropdown' Required='TRUE'" (Choices $status "Ініціація")
F $P pmPriority    Choice   "Пріоритет"          "Priority"            "Приоритет"            "Format='Dropdown'" (Choices @("1 — Високий","2 — Середній","3 — Низький") "2 — Середній")
F $P pmRAG         Choice   "Загальний стан"     "Overall health"      "Общее состояние"      "Format='Dropdown'" (Choices $rag)
F $P pmProgress    Number   "% виконання"        "% complete"          "% выполнения"         "Min='0' Max='100' Decimals='0'" "<Default>0</Default>"
F $P pmStart       DateTime "Дата старту"        "Start date"          "Дата старта"          "Format='DateOnly'"
F $P pmGoLive      DateTime "Дата запуску (продакшн)" "Go-live date (production)" "Дата запуска (продакшн)" "Format='DateOnly'"
F $P pmPlanEnd     DateTime "Дата завершення (план)"  "Planned completion"        "Дата завершения (план)"  "Format='DateOnly'"
F $P pmForecastEnd DateTime "Прогноз завершення" "Forecast completion" "Прогноз завершения"   "Format='DateOnly'"
F $P pmArchivedAt  DateTime "Дата архівації"     "Archived on"         "Дата архивации"       "Format='DateOnly'"
F $P pmBudget      Currency "Бюджет (план)"      "Budget (plan)"       "Бюджет (план)"        "LCID='1058' Decimals='0'"
F $P pmActualCost  Currency "Витрати (факт)"     "Actual cost"         "Затраты (факт)"       "LCID='1058' Decimals='0'"
F $P pmLastUpdate  DateTime "Останній статус-звіт" "Last status report" "Последний статус-отчёт" "Format='DateOnly'"
F $P pmLastReport  Note     "Останній апдейт"    "Latest update"       "Последний апдейт"     "NumLines='3' RichText='FALSE'"
F $P pmLastComment Note     "Останній коментар"  "Latest comment"      "Последний комментарий" "NumLines='3' RichText='FALSE'"
F $P pmDescription Note     "Мета та опис"       "Goal and description" "Цель и описание"     "NumLines='6' RichText='FALSE'"
F $P pmBudgetUse   Calculated "Освоєння бюджету, %" "Budget used, %"   "Освоение бюджета, %"  "ResultType='Number' Decimals='0'" `
    "<Formula>=IF([pmBudget]=0,0,[pmActualCost]/[pmBudget]*100)</Formula><FieldRefs><FieldRef Name='pmBudget'/><FieldRef Name='pmActualCost'/></FieldRefs>"
F $P pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
# Правки карточки из приложения SPFx: «было / стало» до переноса в журнал синхронизацией (она же очищает поле)
# «Доступ до картки» — кто видит проект и что может (JSON), пишет синхронизация
F $P pmAccess      Note     "Службове: доступ"   "System: access list" "Служебное: доступ"    "Hidden='TRUE' NumLines='6' RichText='FALSE'"
F $P pmEditLog     Note     "Службове: правки картки" "System: card edits" "Служебное: правки карточки" "Hidden='TRUE' NumLines='6' RichText='FALSE'"
$script:Loc += , @($P, "Title", "Назва проєкту", "Project name", "Название проекта")

# Миграция из ранних версий: «Product» (один пользователь) -> «Стейкхолдери» (несколько)
if (Test-Field $P "pmProduct") {
    Write-Host "  миграция: Product -> Стейкхолдери"
    foreach ($it in (Get-PnPListItem -List $P -PageSize 500 -Fields "pmProduct","pmStakeholders")) {
        $prod = $it["pmProduct"]
        if ($prod -and -not $it["pmStakeholders"]) {
            Set-PnPListItem -List $P -Identity $it.Id -Values @{ pmStakeholders = @($prod.Email) } -UpdateType SystemUpdate | Out-Null
        }
    }
    Remove-PnPField -List $P -Identity "pmProduct" -Force
}

$lookup = "List='{$($P.Id)}' ShowField='Title' Required='TRUE' Indexed='TRUE' RelationshipDeleteBehavior='Restrict'"

# ===========================================================================
# 3. Статус-звіти — единственный способ менять ключевые показатели
# ===========================================================================
Write-Host "3. Список «Статус-звіти»" -ForegroundColor Cyan
$R = Ensure-List "Lists/StatusReports" "Статус-звіти" "Status reports" "Статус-отчёты"
$hadApplied = [bool](Test-Field $R "srApplied")

# Миграция: «Загальний стан» был полем выбора или считался по старой формуле (с «Обсяг та якість») — пересоздаём
$old = Test-Field $R "srRAG"
if ($old -and ($old.TypeAsString -ne "Calculated" -or $old.SchemaXml -match "srScope")) {
    Write-Host "  миграция: «Загальний стан» -> вычисляемый по новой формуле"
    Remove-PnPField -List $R -Identity "srRAG" -Force
}
# «Обсяг та якість» убран из решения
if (Test-Field $R "srScope") {
    Write-Host "  миграция: удаление поля «Обсяг та якість»"
    Remove-PnPField -List $R -Identity "srScope" -Force
}

F $R srProject     Lookup   "Проєкт"             "Project"             "Проект"               $lookup
F $R srProjectType Choice   "Стратегічний"       "Strategic"           "Стратегический"       "Format='Dropdown'" (Choices $types)
F $R srProjectPriority Choice "Пріоритет"        "Priority"            "Приоритет"            "Format='Dropdown'" (Choices @("1 — Високий","2 — Середній","3 — Низький"))
F $R srDate        DateTime "Дата звіту"         "Report date"         "Дата отчёта"          "Format='DateOnly' Required='TRUE'" "<Default>[today]</Default>"
F $R srPeriod      Choice   "Період"             "Period"              "Период"               "Format='Dropdown'" (Choices @("Тиждень","2 тижні","Місяць","Квартал") "2 тижні")
F $R srSchedule    Choice   "Терміни"            "Schedule"            "Сроки"                "Format='Dropdown' Required='TRUE'" (Choices $rag)
F $R srBudget      Choice   "Бюджет"             "Budget"              "Бюджет"               "Format='Dropdown' Required='TRUE'" (Choices $rag)
F $R srResources   Choice   "Ресурси"            "Resources"           "Ресурсы"              "Format='Dropdown' Required='TRUE'" (Choices $rag)
# Общее состояние — худшая из трёх оценок: хотя бы одна красная -> красный; хотя бы одна жёлтая -> жёлтый; иначе зелёный
$anyRed = 'OR([srSchedule]="Червоний",[srBudget]="Червоний",[srResources]="Червоний")'
$anyYel = 'OR([srSchedule]="Жовтий",[srBudget]="Жовтий",[srResources]="Жовтий")'
F $R srRAG         Calculated "Загальний стан"   "Overall health"      "Общее состояние"      "ResultType='Text'" `
    ("<Formula>=IF($anyRed,""Червоний"",IF($anyYel,""Жовтий"",""Зелений""))</Formula>" +
     "<FieldRefs><FieldRef Name='srSchedule'/><FieldRef Name='srBudget'/><FieldRef Name='srResources'/></FieldRefs>")
F $R srStatus      Choice   "Статус проєкту"     "Project status"      "Статус проекта"       "Format='Dropdown'" (Choices $repStatus)
F $R srType        Choice   "Тип проєкту"        "Project type"        "Тип проекта"          "Format='Dropdown'" (Choices $types)
F $R srProgress    Number   "% виконання"        "% complete"          "% выполнения"         "Min='0' Max='100' Decimals='0'"
F $R srStart       DateTime "Дата старту"        "Start date"          "Дата старта"          "Format='DateOnly'"
F $R srGoLive      DateTime "Дата запуску (продакшн)" "Go-live date (production)" "Дата запуска (продакшн)" "Format='DateOnly'"
F $R srPlanEnd     DateTime "Дата завершення (план)"  "Planned completion"        "Дата завершения (план)"  "Format='DateOnly'"
F $R srForecastEnd DateTime "Прогноз завершення" "Forecast completion" "Прогноз завершения"   "Format='DateOnly'"
F $R srActualCost  Currency "Витрати на дату"    "Cost to date"        "Затраты на дату"      "LCID='1058' Decimals='0'"
F $R srKeyReason   Note     "Причина зміни показників" "Reason for changing indicators" "Причина изменения показателей" "NumLines='3' RichText='FALSE'"
F $R srDone        Note     "Зроблено за період" "Done this period"    "Сделано за период"    "NumLines='5' RichText='FALSE'"
F $R srNext        Note     "План на наступний період" "Plan for next period" "План на следующий период" "NumLines='5' RichText='FALSE'"
F $R srIssues      Note     "Проблеми та ризики" "Issues and risks"    "Проблемы и риски"     "NumLines='5' RichText='FALSE'"
F $R srDecision    Boolean  "Потрібне рішення керівництва" "Management decision needed" "Требуется решение руководства" "" "<Default>0</Default>"
F $R srDecisionText Note    "Яке рішення потрібне" "Decision required" "Какое решение нужно"  "NumLines='3' RichText='FALSE'"
F $R srApplied     Boolean  "Службове: застосовано" "System: applied"  "Служебное: применено" "Hidden='TRUE'" "<Default>0</Default>"
F $R pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
$script:Loc += , @($R, "Title", "Резюме одним рядком", "One-line summary", "Резюме одной строкой")

if (-not $hadApplied) {
    # Отчёты, созданные до появления синхронизации, считаем уже применёнными — чтобы не задвоить историю
    $existing = Get-PnPListItem -List $R -PageSize 500 -Fields "ID"
    foreach ($it in $existing) { Set-PnPListItem -List $R -Identity $it.Id -Values @{ srApplied = $true } -UpdateType SystemUpdate | Out-Null }
    if ($existing.Count) { Write-Host "  существующие отчёты ($($existing.Count)) отмечены как применённые" }
}

# ===========================================================================
# 4. Ризики та проблеми
# ===========================================================================
Write-Host "4. Список «Ризики та проблеми»" -ForegroundColor Cyan
$K = Ensure-List "Lists/RisksIssues" "Ризики та проблеми" "Risks and issues" "Риски и проблемы"
F $K riProject     Lookup   "Проєкт"             "Project"             "Проект"               $lookup
F $K riProjectType Choice   "Стратегічний"       "Strategic"           "Стратегический"       "Format='Dropdown'" (Choices $types)
F $K riProjectPriority Choice "Пріоритет"        "Priority"            "Приоритет"            "Format='Dropdown'" (Choices @("1 — Високий","2 — Середній","3 — Низький"))
F $K riType        Choice   "Тип"                "Type"                "Тип"                  "Format='Dropdown'" (Choices @("Ризик","Проблема") "Ризик")
F $K riProbability Number   "Ймовірність (1–5)"  "Probability (1–5)"   "Вероятность (1–5)"    "Min='1' Max='5' Decimals='0'" "<Default>3</Default>"
F $K riImpact      Number   "Вплив (1–5)"        "Impact (1–5)"        "Влияние (1–5)"        "Min='1' Max='5' Decimals='0'" "<Default>3</Default>"
F $K riScore       Calculated "Оцінка"           "Score"               "Оценка"               "ResultType='Number' Decimals='0'" `
    "<Formula>=[riProbability]*[riImpact]</Formula><FieldRefs><FieldRef Name='riProbability'/><FieldRef Name='riImpact'/></FieldRefs>"
F $K riOwner       User     "Власник ризику"     "Risk owner"          "Владелец риска"       "UserSelectionMode='PeopleOnly'"
F $K riStatus      Choice   "Статус"             "Status"              "Статус"               "Format='Dropdown'" (Choices @("Відкрито","В роботі","Закрито") "Відкрито")
F $K riDue         DateTime "Термін"             "Due date"            "Срок"                 "Format='DateOnly'"
F $K riMitigation  Note     "Заходи реагування"  "Mitigation"          "Меры реагирования"    "NumLines='4' RichText='FALSE'"
F $K pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
$script:Loc += , @($K, "Title", "Ризик / проблема", "Risk / issue", "Риск / проблема")
# Подсказки к шкалам — видны под полями в форме риска
Set-PnPField -List $K -Identity "riProbability" -Values @{ Description = "1 — рідко (до 10%), 2 — малоймовірно (10–30%), 3 — можливо (30–60%), 4 — ймовірно (60–90%), 5 — майже напевно (понад 90%)" } | Out-Null
Set-PnPField -List $K -Identity "riImpact" -Values @{ Description = "1 — незначний, 2 — помірний (у межах резерву), 3 — суттєвий (зсув етапу / до 10% бюджету), 4 — значний (зсув запуску / понад 10%), 5 — критичний (зрив цілей)" } | Out-Null
Set-PnPField -List $K -Identity "riScore" -Values @{ Description = "Ймовірність × Вплив: 15–25 високий, 8–14 середній, 1–7 низький" } | Out-Null

# ===========================================================================
# 5. Зміни показників — журнал, одна строка на каждое изменённое поле
# ===========================================================================
Write-Host "5. Список «Зміни показників»" -ForegroundColor Cyan
$C = Ensure-List "Lists/KeyChanges" "Зміни показників" "Indicator changes" "Изменения показателей"
F $C kcProject     Lookup   "Проєкт"             "Project"             "Проект"               $lookup
F $C kcDate        DateTime "Дата зміни"         "Changed on"          "Дата изменения"       "Format='DateTime' Required='TRUE'" "<Default>[today]</Default>"
F $C kcChangedBy   User     "Хто змінив"         "Changed by"          "Кто изменил"          "UserSelectionMode='PeopleOnly'"
F $C kcKind        Choice   "Тип зміни"          "Change type"         "Тип изменения"        "Format='Dropdown'" (Choices @("Створення","Статус-звіт","Редагування картки") "Статус-звіт")
F $C kcField       Text     "Поле (внутр.)"      "Field (internal)"    "Поле (внутр.)"        "MaxLength='64'"
F $C kcFrom        Note     "Було"               "Old value"           "Было"                 "NumLines='2' RichText='FALSE'"
F $C kcTo          Note     "Стало"              "New value"           "Стало"                "NumLines='2' RichText='FALSE'"
F $C kcReason      Note     "Причина зміни"      "Reason"              "Причина изменения"    "NumLines='3' RichText='FALSE'"
F $C pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
$script:Loc += , @($C, "Title", "Показник", "Indicator", "Показатель")

# ===========================================================================
# 6. Коментарі — отдельный список: комментировать могут все участники проекта
# ===========================================================================
Write-Host "6. Список «Коментарі»" -ForegroundColor Cyan
$M = Ensure-List "Lists/ProjectComments" "Коментарі" "Comments" "Комментарии"
F $M cmProject     Lookup   "Проєкт"             "Project"             "Проект"               $lookup
F $M cmText        Note     "Коментар"           "Comment"             "Комментарий"          "NumLines='4' RichText='FALSE' Required='TRUE'"
F $M pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
$script:Loc += , @($M, "Title", "Коротко", "Summary", "Кратко")
Set-PnPField -List $M -Identity "Title" -Values @{ Required = $false } | Out-Null

# ---------------------------------------------------------------------------
# Подсказки к полям (описания столбцов, uk / en / ru)
# ---------------------------------------------------------------------------
$keep = @("Залиште порожнім, якщо не змінюється.", "Leave empty if unchanged.", "Оставьте пустым, если не меняется.")
foreach ($n in @("srType","srProgress","srStart","srGoLive","srPlanEnd","srForecastEnd","srActualCost")) { Desc $R $n $keep[0] $keep[1] $keep[2] }
Desc $R srStatus "Залиште порожнім, якщо не змінюється. «Завершено» переводить проєкт в архів." "Leave empty if unchanged. «Завершено» moves the project to the archive." "Оставьте пустым, если не меняется. «Завершено» переводит проект в архив."
Desc $R srKeyReason "Обов'язково, якщо змінюєте статус, тип або дати — потрапить у журнал змін." "Required if you change the status, type or dates — goes to the change log." "Обязательно, если меняете статус, тип или даты — попадёт в журнал изменений."
Desc $R srDecisionText "Заповніть, якщо позначено «Потрібне рішення керівництва»." "Fill in if «Management decision needed» is checked." "Заполните, если отмечено «Требуется решение руководства»."
Desc $R srSchedule "Загальний стан звіту — найгірша з трьох оцінок." "Overall health is the worst of the three ratings." "Общее состояние отчёта — худшая из трёх оценок."
Desc $K riScore "Оцінка = ймовірність × вплив. Від 15 — червоний, від 8 — жовтий." "Score = probability × impact. 15+ red, 8+ yellow." "Оценка = вероятность × влияние. От 15 — красный, от 8 — жёлтый."

# ---------------------------------------------------------------------------
# Переводы названий столбцов
# ---------------------------------------------------------------------------
Write-Host "  переводы названий столбцов"
# PnP.PowerShell 3.x: командлет, вызванный при неотправленных изменениях, переключается на новый контекст,
# и объекты, полученные раньше, перестают с ним работать. Поэтому список берётся заново (Fresh-List),
# поля меняются только через CSOM, а командлеты PnP в цикле не вызываются.
foreach ($grp in ($script:Loc | Group-Object { $_[0].Id })) {
    $l = Fresh-List $grp.Group[0][0]
    foreach ($x in $grp.Group) {
        $f = $l.Fields.GetByInternalNameOrTitle($x[1])
        $f.Title = $x[2]
        Set-Loc $f $x[2] $x[3] $x[4]
        $f.Update()
    }
    Invoke-PnPQuery
}
foreach ($grp in ($script:Desc | Group-Object { $_[0].Id })) {
    $l = Fresh-List $grp.Group[0][0]
    foreach ($x in $grp.Group) {
        $f = $l.Fields.GetByInternalNameOrTitle($x[1])
        $f.Description = $x[2]
        $f.DescriptionResource.SetValueForUICulture("uk-UA", $x[2])
        $f.DescriptionResource.SetValueForUICulture("en-US", $x[3])
        $f.DescriptionResource.SetValueForUICulture("ru-RU", $x[4])
        $f.Update()
    }
    Invoke-PnPQuery
}

# Пункты меню сайта: New-PnPList создаёт их с украинским названием, переводы задаём явно
Write-Host "  переводы пунктов меню"
$ctx = Get-PnPContext
$ql = $ctx.Web.Navigation.QuickLaunch; $ctx.Load($ql); Invoke-PnPQuery
foreach ($nd in $ql) {
    $key = $script:ListNames.Keys | Where-Object { $nd.Url -like "*/$_/*" } | Select-Object -First 1
    if ($key) { $t = $script:ListNames[$key]; Set-Loc $nd $t[0] $t[1] $t[2]; $nd.Update() }
}
Invoke-PnPQuery

# ===========================================================================
# 7. Формы и права уровня списков
# ===========================================================================
Write-Host "7. Формы и права списков" -ForegroundColor Cyan
# Ключевые показатели и служебные поля не редактируются в карточке — только через статус-отчёт
Set-FormVisibility $P @("pmStatus","pmRAG","pmType","pmProgress","pmStart","pmGoLive","pmPlanEnd","pmForecastEnd",
                        "pmActualCost","pmArchivedAt","pmLastUpdate","pmLastReport","pmLastComment") $true $false
Set-FormVisibility $P @("pmRAG","pmForecastEnd","pmActualCost","pmArchivedAt","pmLastUpdate","pmLastReport","pmLastComment") $false $false
# «Стратегічний» в отчётах и рисках заполняет синхронизация
# «Стратегічний» и «Пріоритет» в отчётах и рисках — копия из проекта, заполняет синхронизация
Set-FormVisibility $R @("srProjectType","srProjectPriority") $false $false
Set-FormVisibility $K @("riProjectType","riProjectPriority") $false $false

# Права списков. Участники сайта: «Проєкти» — только чтение (новый проект заводит PMO), журнал — только чтение
# (пишет синхронизация); отчёты, риски, комментарии — добавление (кто может менять запись, решают права элемента).
$members = Get-PnPGroup -AssociatedMemberGroup
function Set-ListRoles([string]$Url, [hashtable]$Want) {
    $l = Get-PnPList -Identity $Url -Includes HasUniqueRoleAssignments
    if (-not $l.HasUniqueRoleAssignments) { Set-PnPList -Identity $Url -BreakRoleInheritance -CopyRoleAssignments | Out-Null; $l = Get-PnPList -Identity $Url }
    $ctx = Get-PnPContext; $ra = $l.RoleAssignments; $ctx.Load($ra); Invoke-PnPQuery
    foreach ($a in $ra) { $ctx.Load($a.Member); $ctx.Load($a.RoleDefinitionBindings) }; Invoke-PnPQuery
    foreach ($grp in $Want.Keys) {
        $have = @(); foreach ($a in $ra) { if ($a.Member.Title -eq $grp) { $have = @($a.RoleDefinitionBindings | Where-Object { -not $_.Hidden } | ForEach-Object { $_.Name }) } }
        foreach ($x in $have) { if ($x -ne $Want[$grp]) { Set-PnPListPermission -Identity $Url -Group $grp -RemoveRole $x | Out-Null; Write-Host "  «$($l.Title)» $grp : − $x" } }
        if ($have -notcontains $Want[$grp]) { Set-PnPListPermission -Identity $Url -Group $grp -AddRole $Want[$grp] | Out-Null; Write-Host "  «$($l.Title)» $grp : + $($Want[$grp])" }
    }
}
Set-ListRoles "Lists/Projects"   @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_EDIT }
Set-ListRoles "Lists/KeyChanges" @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }

# ===========================================================================
# 8. Представления (группировок по статусам нет; названия представлений SharePoint не переводит)
# ===========================================================================
Write-Host "8. Представления" -ForegroundColor Cyan
$active = "<And><And><Neq><FieldRef Name='pmStatus'/><Value Type='Choice'>Скасовано</Value></Neq>" +
          "<Neq><FieldRef Name='pmStatus'/><Value Type='Choice'>Архівний</Value></Neq></And>" +
          "<Neq><FieldRef Name='pmStatus'/><Value Type='Choice'>Завершено</Value></Neq></And>"
$notArchived = "<Neq><FieldRef Name='pmStatus'/><Value Type='Choice'>Архівний</Value></Neq>"
$order = "<OrderBy><FieldRef Name='pmType' Ascending='FALSE'/><FieldRef Name='pmPriority'/></OrderBy>"

# Порядок колонок во всех представлениях: стратегический, приоритет, название, затем остальные
$pFields = @("pmType","pmPriority","LinkTitle","pmManager","pmStatus","pmRAG","pmLastUpdate","pmProgress","pmPlanEnd","pmLastReport")
$vAll     = Set-BaseView $P "Усі проєкти" $pFields "$order<Where>$notArchived</Where>"
$null     = Ensure-View $P "Стратегічні" $pFields "$order<Where><And>$active<Eq><FieldRef Name='pmType'/><Value Type='Choice'>Стратегічний</Value></Eq></And></Where>"
$null     = Ensure-View $P "Проблемні" @("pmType","pmPriority","LinkTitle","pmRAG","pmManager","pmLastReport","pmLastUpdate") `
    ("<OrderBy><FieldRef Name='pmRAG'/></OrderBy><Where><And>$active<Or><Eq><FieldRef Name='pmRAG'/><Value Type='Choice'>Червоний</Value></Eq>" +
     "<Eq><FieldRef Name='pmRAG'/><Value Type='Choice'>Жовтий</Value></Eq></Or></And></Where>")
$null     = Ensure-View $P "Мої проєкти" $pFields `
    ("$order<Where><And>$notArchived<Or><Eq><FieldRef Name='pmManager'/><Value Type='Integer'><UserID Type='Integer'/></Value></Eq>" +
     "<Or><Eq><FieldRef Name='pmOwner'/><Value Type='Integer'><UserID Type='Integer'/></Value></Eq>" +
     "<Includes><FieldRef Name='pmStakeholders' LookupId='TRUE'/><Value Type='Integer'><UserID Type='Integer'/></Value></Includes></Or></Or></And></Where>")
$null     = Ensure-View $P "Немає свіжого звіту" @("pmType","pmPriority","LinkTitle","pmManager","pmLastUpdate","pmStatus") `
    ("<Where><And>$active<Or><IsNull><FieldRef Name='pmLastUpdate'/></IsNull>" +
     "<Lt><FieldRef Name='pmLastUpdate'/><Value Type='DateTime'><Today OffsetDays='-14'/></Value></Lt></Or></And></Where>")
$vArchive = Ensure-View $P "Архів" @("pmType","pmPriority","LinkTitle","pmManager","pmOwner","pmArchivedAt","pmPlanEnd","pmBudget","pmActualCost") `
    "<OrderBy><FieldRef Name='pmArchivedAt' Ascending='FALSE'/></OrderBy><Where><Eq><FieldRef Name='pmStatus'/><Value Type='Choice'>Архівний</Value></Eq></Where>"

$rFields = @("srProjectType","srProjectPriority","srProject","srDate","srRAG","srSchedule","srBudget","srResources","LinkTitle","Author","srDecision")
$null      = Set-BaseView $R "Усі звіти" $rFields "<OrderBy><FieldRef Name='srDate' Ascending='FALSE'/></OrderBy>"
$null      = Ensure-View $R "Потребують рішення" @("srProjectType","srProjectPriority","srProject","srDate","srDecisionText","Author") `
    "<OrderBy><FieldRef Name='srDate' Ascending='FALSE'/></OrderBy><Where><Eq><FieldRef Name='srDecision'/><Value Type='Boolean'>1</Value></Eq></Where>"

$kFields = @("riProjectType","riProjectPriority","riProject","LinkTitle","riType","riScore","riOwner","riStatus","riDue")
$null   = Set-BaseView $K "Усі ризики" $kFields "<OrderBy><FieldRef Name='riScore' Ascending='FALSE'/></OrderBy>"
$vRisks = Ensure-View $K "Відкриті" $kFields `
    "<OrderBy><FieldRef Name='riScore' Ascending='FALSE'/></OrderBy><Where><Neq><FieldRef Name='riStatus'/><Value Type='Choice'>Закрито</Value></Neq></Where>"

$null = Set-BaseView $C "Усі зміни" @("kcProject","kcDate","kcChangedBy","kcKind","LinkTitle","kcFrom","kcTo","kcReason") "<OrderBy><FieldRef Name='kcDate' Ascending='FALSE'/></OrderBy>"
$null = Set-BaseView $M "Усі коментарі" @("cmProject","cmText","Author","Created") "<OrderBy><FieldRef Name='Created' Ascending='FALSE'/></OrderBy>"

# По умолчанию: «Проєкти» — «Усі проєкти» (без архива), «Ризики» — «Відкриті»
Set-PnPView -List $P -Identity $vAll.Id -Values @{ DefaultView = $true } | Out-Null
Set-PnPView -List $K -Identity $vRisks.Id -Values @{ DefaultView = $true } | Out-Null

# Меню сайта — как в прототипе: Головна, Проєкти, Статус-звіти, Ризики та проблеми, Архів.
# Журнал и комментарии открываются из карточки проекта; «Вміст сайту» остаётся в меню «Параметры».
Write-Host "  меню сайта"
$web = Get-PnPWeb -Includes ServerRelativeUrl
$keepUrls = @("Lists/Projects", "Lists/StatusReports", "Lists/RisksIssues")
$archUrl = (Get-PnPView -List $P -Identity $vArchive.Id -Includes ServerRelativeUrl).ServerRelativeUrl
foreach ($nd in (Get-PnPNavigationNode -Location QuickLaunch)) {
    $u = [string]$nd.Url
    $isHome = $u.TrimEnd('/') -eq $web.ServerRelativeUrl.TrimEnd('/')
    $isList = $keepUrls | Where-Object { $u -like "*/$_/*" }
    if (-not $isHome -and -not $isList -and $u -ne $archUrl) {
        Remove-PnPNavigationNode -Identity $nd.Id -Force | Out-Null
        Write-Host "    - пункт меню «$($nd.Title)»"
    }
}
if (-not (Get-PnPNavigationNode -Location QuickLaunch | Where-Object { $_.Url -eq $archUrl })) {
    $null = Add-PnPNavigationNode -Location QuickLaunch -Title "Архів" -Url $archUrl
    Write-Host "    + пункт меню «Архів»"
}
$ctx = Get-PnPContext
$ql = $ctx.Web.Navigation.QuickLaunch; $ctx.Load($ql); Invoke-PnPQuery
foreach ($nd in $ql) { if ($nd.Url -eq $archUrl) { Set-Loc $nd "Архів" "Archive" "Архив"; $nd.Update() } }
Invoke-PnPQuery

#region legacy-cleanup
# ===========================================================================
# 9. Уборка прежнего интерфейса на стандартных средствах SharePoint (до приложения SPFx).
#    Идемпотентно; данных в этих объектах нет. Список и страницы — в корзину сайта (восстановимы).
# ===========================================================================
Write-Host "9. Уборка прежнего интерфейса" -ForegroundColor Cyan
$homePage = [string](Get-PnPHomePage)
if ($homePage -notmatch 'Dashboard\.aspx$') {
    # прежняя главная и её копии EN / RU — только когда главной уже стало приложение
    foreach ($pg in @("SitePages/Dashboard.aspx", "SitePages/en/Dashboard.aspx", "SitePages/ru/Dashboard.aspx")) {
        if (Get-PnPFile -Url $pg -ErrorAction SilentlyContinue) {
            Remove-PnPFile -ServerRelativeUrl "$($web.ServerRelativeUrl.TrimEnd('/'))/$pg" -Recycle -Force | Out-Null
            Write-Host "  - страница $pg (в корзину)"
        }
    }
} else { Write-Host "  главная — ещё прежняя страница: сначала установите приложение (-Action app)" -ForegroundColor Yellow }

# служебный список для диаграмм прежней главной
$stats = Get-PnPList -Identity "Lists/PortfolioStats" -ErrorAction SilentlyContinue
if ($stats) { Remove-PnPList -Identity $stats -Recycle -Force | Out-Null; Write-Host "  - список «$($stats.Title)» (в корзину)" }

# вычисляемые поля карточки стандартной формы и «Пов'язані записи і доступ»
foreach ($fn in @("pmKState", "pmKDates", "pmKMoney", "pmCardInfo")) {
    if (Test-Field $P $fn) { Remove-PnPField -List $P -Identity $fn -Force; Write-Host "  - поле $fn" }
}

# оформление столбцов, представлений и разделы стандартных форм
$pl = Fresh-List $P
if (Get-PnPView -List $pl -Identity "Плитки" -ErrorAction SilentlyContinue) { Remove-PnPView -List $pl -Identity "Плитки" -Force; Write-Host "  - представление «Плитки»" }
foreach ($l in @($P, $R, $K, $C, $M)) {
    $l = Fresh-List $l
    $n = 0
    foreach ($fd in (Get-PnPField -List $l)) {
        if ($fd.CustomFormatter) { Set-PnPField -List $l -Identity $fd.InternalName -Values @{ CustomFormatter = "" } | Out-Null; $n++ }
    }
    foreach ($vw in (Get-PnPView -List $l -Includes CustomFormatter)) {
        if ($vw.CustomFormatter) { Set-PnPView -List $l -Identity $vw.Id -Values @{ CustomFormatter = "" } | Out-Null; $n++ }
    }
    foreach ($ct in (Get-PnPContentType -List $l)) {
        $ctx = Get-PnPContext; $ctx.Load($ct); Invoke-PnPQuery
        if ($ct.ClientFormCustomFormatter) { $ct.ClientFormCustomFormatter = ""; $ct.Update($false); Invoke-PnPQuery; $n++ }
    }
    if ($n) { Write-Host "  «$($l.Title)»: снято оформление ($n)" }
}
#endregion legacy-cleanup

Write-Host "`nГотово: $siteUrl" -ForegroundColor Yellow
Write-Host "Дальше:" -ForegroundColor Yellow
Write-Host "  1) добавьте участников в группу «$PMO_GROUP» и сотрудников компании — в участники сайта;"
Write-Host "  2) установите приложение SPFx (Invoke-Env.ps1 -Action app);"
Write-Host "  3) запустите Invoke-PMOSync.ps1 и поставьте его на расписание (см. README)."
