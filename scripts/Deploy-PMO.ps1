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
      5. Цветовое форматирование столбцов (светофоры, иконки приоритета, щит стратегического проекта).
      6. Представления (без группировок), галерея «Плитки», «Архів».
      7. Главную страницу-дашборд с переводами EN и RU.
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
    [SecureString]$CertificatePassword,
    [switch]$SkipPage
)

$ErrorActionPreference = "Stop"
$adminUrl = "https://$TenantName-admin.sharepoint.com"
$siteUrl  = "https://$TenantName.sharepoint.com/sites/$SiteAlias"
$here     = Split-Path -Parent $MyInvocation.MyCommand.Path
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

function Ensure-List([string]$Url, [string]$Uk, [string]$En, [string]$Ru, [switch]$Service) {
    try { $l = Get-PnPList -Identity $Url -ErrorAction Stop } catch { $l = $null }
    if (-not $l) {
        Write-Host "  + список $Uk" -ForegroundColor Green
        $l = if ($Service) { New-PnPList -Title $Uk -Url $Url -Template GenericList } else { New-PnPList -Title $Uk -Url $Url -Template GenericList -OnQuickLaunch }
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
# представлением по умолчанию может быть назначено другое (например, «Плитки»)
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

try { $g = Get-PnPGroup -Identity $PMO_GROUP -ErrorAction Stop } catch { $g = $null }
if (-not $g) {
    New-PnPGroup -Title $PMO_GROUP -Description "Повний доступ до всіх проєктів порталу" | Out-Null
    Set-PnPGroupPermissions -Identity $PMO_GROUP -AddRole $ROLE_FULL | Out-Null
    Write-Host "  + группа $PMO_GROUP ($ROLE_FULL)" -ForegroundColor Green
}

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
# Ключевые показатели в карточке — только для чтения: поля выше скрыты из формы (меняются через отчёт),
# а форма SharePoint не показывает скрытые поля; вычисляемые столбцы видны и не редактируются.
function Formula([string]$Expr, [string[]]$Refs) {
    # формула внутри XML поля: & и < экранируются
    "<Formula>$([System.Security.SecurityElement]::Escape($Expr))</Formula><FieldRefs>" + (($Refs | ForEach-Object { "<FieldRef Name='$_'/>" }) -join "") + "</FieldRefs>"
}
function DateTxt([string]$f) { "IF(ISBLANK([$f]),""—"",TEXT([$f],""dd.mm.yyyy""))" }
F $P pmKState      Calculated "Стан і статус"    "Health and status"   "Состояние и статус"   "ResultType='Text'" `
    (Formula "=[pmStatus]&IF(ISBLANK([pmRAG]),"" · не оцінено"","" · ""&[pmRAG])&"" · ""&TEXT([pmProgress],""0"")&""%""" @("pmStatus","pmRAG","pmProgress"))
F $P pmKDates      Calculated "Терміни"          "Timeline"            "Сроки"                "ResultType='Text'" `
    (Formula ("=""старт ""&$(DateTxt pmStart)&"" · запуск ""&$(DateTxt pmGoLive)&"" · план ""&$(DateTxt pmPlanEnd)" +
              "&IF(ISBLANK([pmForecastEnd]),"""","" · прогноз ""&TEXT([pmForecastEnd],""dd.mm.yyyy"")&IF(OR(ISBLANK([pmPlanEnd]),[pmForecastEnd]<=[pmPlanEnd]),"""","" (+""&TEXT([pmForecastEnd]-[pmPlanEnd],""0"")&"" дн.)""))") `
             @("pmStart","pmGoLive","pmPlanEnd","pmForecastEnd"))
F $P pmKMoney      Calculated "Бюджет і звіт"    "Budget and report"   "Бюджет и отчёт"       "ResultType='Text'" `
    (Formula ("=""витрати ""&TEXT([pmActualCost],""#,##0"")&"" з ""&TEXT([pmBudget],""#,##0"")&"" ₴""" +
              "&IF([pmBudget]>0,"" (""&TEXT([pmActualCost]/[pmBudget]*100,""0"")&""%)"","""")&"" · останній звіт ""&$(DateTxt pmLastUpdate)") `
             @("pmActualCost","pmBudget","pmLastUpdate"))
# Ссылки на отчёты, риски, журнал и комментарии проекта и список доступа — заполняет синхронизация
F $P pmCardInfo    Note     "Пов'язані записи і доступ" "Related records and access" "Связанные записи и доступ" "NumLines='6' RichText='TRUE' RichTextMode='FullHtml'"
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

# ===========================================================================
# 6a. Показники портфеля — служебный список для диаграмм на главной; пишет синхронизация
# ===========================================================================
Write-Host "6a. Список «Показники портфеля»" -ForegroundColor Cyan
$S = Ensure-List "Lists/PortfolioStats" "Показники портфеля" "Portfolio indicators" "Показатели портфеля" -Service
F $S psKind        Choice   "Вид"                "Kind"                "Вид"                  "Format='Dropdown'" (Choices @("Поточний","Зріз") "Зріз")
F $S psDate        DateTime "Дата зрізу"         "Snapshot date"       "Дата среза"           "Format='DateOnly'"
foreach ($x in @(@("psGreen","Зелений","Green","Зелёный"), @("psYellow","Жовтий","Yellow","Жёлтый"), @("psRed","Червоний","Red","Красный"),
                 @("psNone","Не оцінено","Not rated","Не оценено"), @("psTotal","Усього","Total","Всего"), @("psMax","Максимум шкали","Scale maximum","Максимум шкалы"))) {
    F $S $x[0] Number $x[1] $x[2] $x[3] "Decimals='0'" "<Default>0</Default>"
}
$script:Loc += , @($S, "Title", "Зріз", "Snapshot", "Срез")

# ---------------------------------------------------------------------------
# Подсказки в формах (как в прототипе)
# ---------------------------------------------------------------------------
$keep = @("Залиште порожнім, якщо не змінюється.", "Leave empty if unchanged.", "Оставьте пустым, если не меняется.")
foreach ($n in @("srType","srProgress","srStart","srGoLive","srPlanEnd","srForecastEnd","srActualCost")) { Desc $R $n $keep[0] $keep[1] $keep[2] }
Desc $R srStatus "Залиште порожнім, якщо не змінюється. «Завершено» переводить проєкт в архів." "Leave empty if unchanged. «Завершено» moves the project to the archive." "Оставьте пустым, если не меняется. «Завершено» переводит проект в архив."
Desc $R srKeyReason "Обов'язково, якщо змінюєте статус, тип або дати — потрапить у журнал змін." "Required if you change the status, type or dates — goes to the change log." "Обязательно, если меняете статус, тип или даты — попадёт в журнал изменений."
Desc $R srDecisionText "Заповніть, якщо позначено «Потрібне рішення керівництва»." "Fill in if «Management decision needed» is checked." "Заполните, если отмечено «Требуется решение руководства»."
Desc $R srSchedule "Загальний стан звіту — найгірша з трьох оцінок." "Overall health is the worst of the three ratings." "Общее состояние отчёта — худшая из трёх оценок."
Desc $P pmPlanEnd "Червона дата — термін минув, а проєкт не закрито." "Red date: the deadline has passed and the project is still open." "Красная дата — срок прошёл, а проект не закрыт."
Desc $P pmKMoney "Витрати з бюджету, освоєння і дата останнього статус-звіту (свіжий — до 8 днів)." "Cost against budget, budget used and the last status report date (fresh: up to 8 days)." "Затраты из бюджета, освоение и дата последнего статус-отчёта (свежий — до 8 дней)."
Desc $P pmKState "Ключові показники змінюються лише через статус-звіт." "Key indicators change only through a status report." "Ключевые показатели меняются только через статус-отчёт."
Desc $P pmCardInfo "Заповнюється автоматично." "Filled in automatically." "Заполняется автоматически."
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
# «Пов'язані записи і доступ» заполняет синхронизация; в форме редактирования поле должно быть видно — иначе его нет и в карточке
Set-FormVisibility $P @("pmCardInfo") $false $true

# Разделы форм. SharePoint сопоставляет поля раздела по отображаемому названию на языке пользователя,
# поэтому в раздел попадают названия на всех трёх языках (лишние он пропускает).
function Set-FormSections($List, $Sections) {
    $labels = @{}
    foreach ($x in $script:Loc) { if ($x[0].Id -eq $List.Id) { $labels[$x[1]] = @($x[2], $x[3], $x[4]) } }
    $body = @{ sections = @($Sections | ForEach-Object {
        @{ displayname = $_[0]; fields = @($_[1] | ForEach-Object { $labels[$_] } | Where-Object { $_ } | Select-Object -Unique) } }) } | ConvertTo-Json -Depth 6 -Compress
    $l = Fresh-List $List
    $ct = Get-PnPContentType -List $l | Where-Object { $_.StringId -like "0x0100*" } | Select-Object -First 1
    $ct.ClientFormCustomFormatter = (@{ headerJSONFormatter = ""; footerJSONFormatter = ""; bodyJSONFormatter = $body } | ConvertTo-Json -Compress)
    $ct.Update($false); Invoke-PnPQuery
}
Set-FormSections $P @(
    @("Ключові показники", @("pmKState","pmKDates","pmKMoney")),
    @("Проєкт",            @("Title","pmCode","pmType","pmPriority","pmDepartment","pmLoop","pmDescription")),
    @("Учасники",          @("pmManager","pmOwner","pmStakeholders")),
    @("Терміни і бюджет",  @("pmStatus","pmProgress","pmStart","pmGoLive","pmPlanEnd","pmBudget","pmBudgetUse")),
    @("Пов'язані записи",  @("pmCardInfo")))
Set-FormSections $R @(
    @("Звіт",              @("srProject","srDate","srPeriod","Title")),
    @("Оцінки",            @("srSchedule","srBudget","srResources","srRAG")),
    @("Що зроблено",       @("srDone","srNext","srIssues")),
    @("Ключові показники — лише якщо змінюються", @("srStatus","srType","srProgress","srStart","srGoLive","srPlanEnd","srForecastEnd","srActualCost","srKeyReason")),
    @("Рішення керівництва", @("srDecision","srDecisionText")))
Set-FormSections $K @(
    @("Ризик",             @("riProject","Title","riType","riStatus")),
    @("Оцінка",            @("riProbability","riImpact","riScore")),
    @("Реагування",        @("riOwner","riDue","riMitigation")))

# Журнал изменений и показатели портфеля: пользователи только читают, пишет синхронизация
$members = Get-PnPGroup -AssociatedMemberGroup
foreach ($u in @("Lists/KeyChanges", "Lists/PortfolioStats")) {
    $ro = Get-PnPList -Identity $u -Includes HasUniqueRoleAssignments
    if (-not $ro.HasUniqueRoleAssignments) {
        Set-PnPList -Identity $ro -BreakRoleInheritance -CopyRoleAssignments | Out-Null
        Set-PnPListPermission -Identity $ro -Group $members.Title -RemoveRole $ROLE_EDIT -ErrorAction SilentlyContinue | Out-Null
        Set-PnPListPermission -Identity $ro -Group $members.Title -AddRole $ROLE_READ | Out-Null
        Write-Host "  «$($ro.Title)»: участники сайта — только чтение"
    }
    Set-PnPListPermission -Identity $ro -Group $PMO_GROUP -AddRole $ROLE_FULL -ErrorAction SilentlyContinue | Out-Null
}

# ===========================================================================
# 8. Цветовое форматирование столбцов
# ---------------------------------------------------------------------------
Write-Host "8. Форматирование столбцов" -ForegroundColor Cyan
$ragColor = "if(@currentField == 'Зелений', '#2e7d32', if(@currentField == 'Жовтий', '#f2a900', if(@currentField == 'Червоний', '#c62828', '#bdbdbd')))"

$fmtRag = @"
{ "`$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div", "style": { "display": "flex", "align-items": "center" },
  "children": [
    { "elmType": "span", "style": { "width": "12px", "height": "12px", "border-radius": "50%", "margin-right": "8px", "background-color": "=$ragColor" } },
    { "elmType": "span", "txtContent": "@currentField" } ] }
"@

$fmtProgress = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div",
  "style": { "width": "100%", "min-width": "90px", "height": "18px", "background-color": "#edebe9", "border-radius": "9px", "position": "relative", "overflow": "hidden" },
  "children": [
    { "elmType": "div", "style": { "height": "100%", "width": "=if(@currentField == '', '0%', if(@currentField > 100, '100%', @currentField + '%'))", "background-color": "=if(@currentField >= 100, '#2e7d32', '#0078d4')" } },
    { "elmType": "span", "txtContent": "=if(@currentField == '', '—', @currentField + '%')",
      "style": { "position": "absolute", "left": "0", "right": "0", "top": "0", "text-align": "center", "font-size": "11px", "line-height": "18px", "color": "#323130" } } ] }
'@

$fmtFreshness = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div", "style": { "display": "flex", "align-items": "center" },
  "children": [
    { "elmType": "span", "style": { "width": "10px", "height": "10px", "border-radius": "50%", "margin-right": "8px",
      "background-color": "=if(Number(@currentField) == 0, '#bdbdbd', if(Number(@now) - Number(@currentField) > 1209600000, '#c62828', if(Number(@now) - Number(@currentField) > 691200000, '#f2a900', '#2e7d32')))" } },
    { "elmType": "span", "txtContent": "=if(Number(@currentField) == 0, '—', toLocaleDateString(@currentField))" } ] }
'@

$fmtPlanEnd = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "span",
  "txtContent": "=if(Number(@currentField) == 0, '', toLocaleDateString(@currentField))",
  "style": { "color": "=if(Number(@currentField) > 0 && @currentField < @now && [$pmStatus] != 'Завершено' && [$pmStatus] != 'Скасовано' && [$pmStatus] != 'Архівний', '#c62828', '')" } }
'@

$fmtType = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "span", "txtContent": "@currentField",
  "style": { "padding": "1px 8px", "border-radius": "10px", "font-size": "12px",
    "background-color": "=if(@currentField == 'Стратегічний', '#fff4ce', '')",
    "color": "=if(@currentField == 'Стратегічний', '#8a5a00', '')",
    "font-weight": "=if(@currentField == 'Стратегічний', '600', '')" } }
'@

$fmtLoop = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "a", "txtContent": "=if(@currentField == '', '', 'Loop ↗')",
  "attributes": { "href": "@currentField", "target": "_blank" } }
'@

$fmtBudgetUse = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "span", "txtContent": "=@currentField + '%'",
  "style": { "color": "=if(@currentField > 100, '#c62828', if(@currentField > 90, '#b26a00', ''))" } }
'@

# Только светофор, без текста (подсказка при наведении)
$fmtDot = @"
{ "`$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div", "style": { "display": "flex", "justify-content": "center" },
  "attributes": { "title": "@currentField" },
  "children": [ { "elmType": "span", "style": { "width": "14px", "height": "14px", "border-radius": "50%", "background-color": "=$ragColor" } } ] }
"@

# Приоритет — иконки: ⏫ высокий, ＝ средний, ⏬ низкий
$fmtPrio = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div", "style": { "display": "flex", "justify-content": "center" }, "attributes": { "title": "@currentField" },
  "children": [ { "elmType": "span",
    "attributes": { "iconName": "=if(startsWith(@currentField, '1'), 'DoubleChevronUp', if(startsWith(@currentField, '2'), 'GripperBarHorizontal', 'ChevronDown'))" },
    "style": { "font-size": "16px", "color": "=if(startsWith(@currentField, '1'), '#c62828', if(startsWith(@currentField, '2'), '#f2a900', '#0078d4'))" } } ] }
'@

# Стратегический — щит с мечом, обычный — пусто
$fmtStar = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div", "style": { "display": "flex", "justify-content": "center" }, "attributes": { "title": "@currentField" },
  "children": [ { "elmType": "svg", "attributes": { "viewBox": "0 0 24 24" },
    "style": { "width": "17px", "height": "17px", "display": "=if(@currentField == 'Стратегічний', 'inline', 'none')" },
    "children": [
      { "elmType": "path", "attributes": { "d": "M12 2 4 5v6.2c0 4.9 3.4 9.3 8 10.8 4.6-1.5 8-5.9 8-10.8V5z" }, "style": { "fill": "#8e44c9" } },
      { "elmType": "path", "attributes": { "d": "M12 4.6l.9 1.3v7.2h2.3v1.4h-2.3v2h.5v1.2h-2.8v-1.2h.5v-2H8.8v-1.4h2.3V5.9z" }, "style": { "fill": "#ffffff" } } ] } ] }
'@

# Длинный текст: колонка шире, до трёх строк, полный текст — во всплывающей подсказке
$fmtLong = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div", "txtContent": "@currentField", "attributes": { "title": "@currentField" },
  "style": { "min-width": "280px", "max-width": "440px", "max-height": "60px", "overflow": "hidden", "white-space": "normal", "line-height": "20px" } }
'@

$fmtScore = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div", "txtContent": "@currentField",
  "style": { "display": "inline-block", "min-width": "28px", "text-align": "center", "padding": "2px 6px", "border-radius": "4px", "color": "#ffffff",
    "background-color": "=if(@currentField >= 15, '#c62828', if(@currentField >= 8, '#f2a900', '#2e7d32'))" } }
'@

# Главная: «Портфель за станом» — представление «Стан» списка «Показники портфеля» (одна строка «Поточний»)
$fmtStatsNow = @'
{ "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/view-formatting.schema.json",
  "hideSelection": true, "hideColumnHeader": true,
  "rowFormatter": {
    "elmType": "div", "style": { "display": "flex", "flex-direction": "column", "width": "100%", "padding": "8px 4px 16px", "box-sizing": "border-box" },
    "children": [
      { "elmType": "div", "style": { "display": "flex", "align-items": "center", "flex-wrap": "wrap" },
        "children": [
          { "elmType": "div", "style": { "display": "flex", "flex-direction": "column", "align-items": "center", "margin-right": "28px", "min-width": "90px" },
            "children": [
              { "elmType": "span", "txtContent": "[$psTotal]", "style": { "font-size": "44px", "font-weight": "600", "line-height": "1.1", "color": "#323130" } },
              { "elmType": "span", "txtContent": "активних", "style": { "font-size": "13px", "color": "#605e5c" } } ] },
          { "elmType": "div", "style": { "display": "flex", "flex-wrap": "wrap", "flex-grow": "1" },
            "children": [
              { "elmType": "div", "style": { "display": "flex", "align-items": "center", "padding": "8px 14px", "margin": "4px", "border-radius": "8px", "background-color": "#e6f4ea", "min-width": "110px" },
                "children": [ { "elmType": "span", "txtContent": "[$psGreen]", "style": { "font-size": "24px", "font-weight": "600", "color": "#1e6b2b", "margin-right": "8px" } },
                              { "elmType": "span", "txtContent": "Зелений", "style": { "color": "#1e6b2b" } } ] },
              { "elmType": "div", "style": { "display": "flex", "align-items": "center", "padding": "8px 14px", "margin": "4px", "border-radius": "8px", "background-color": "#fff4ce", "min-width": "110px" },
                "children": [ { "elmType": "span", "txtContent": "[$psYellow]", "style": { "font-size": "24px", "font-weight": "600", "color": "#8a5a00", "margin-right": "8px" } },
                              { "elmType": "span", "txtContent": "Жовтий", "style": { "color": "#8a5a00" } } ] },
              { "elmType": "div", "style": { "display": "flex", "align-items": "center", "padding": "8px 14px", "margin": "4px", "border-radius": "8px", "background-color": "#fde7e9", "min-width": "110px" },
                "children": [ { "elmType": "span", "txtContent": "[$psRed]", "style": { "font-size": "24px", "font-weight": "600", "color": "#a4262c", "margin-right": "8px" } },
                              { "elmType": "span", "txtContent": "Червоний", "style": { "color": "#a4262c" } } ] },
              { "elmType": "div", "style": { "display": "=if([$psNone] > 0, 'flex', 'none')", "align-items": "center", "padding": "8px 14px", "margin": "4px", "border-radius": "8px", "background-color": "#f3f2f1", "min-width": "110px" },
                "children": [ { "elmType": "span", "txtContent": "[$psNone]", "style": { "font-size": "24px", "font-weight": "600", "color": "#605e5c", "margin-right": "8px" } },
                              { "elmType": "span", "txtContent": "не оцінено", "style": { "color": "#605e5c" } } ] } ] } ] },
      { "elmType": "div", "style": { "display": "flex", "width": "100%", "height": "12px", "border-radius": "6px", "overflow": "hidden", "margin-top": "14px", "background-color": "#edebe9" },
        "children": [
          { "elmType": "div", "style": { "height": "100%", "background-color": "#2e7d32", "width": "=if([$psTotal] == 0, '0%', ([$psGreen] / [$psTotal] * 100) + '%')" } },
          { "elmType": "div", "style": { "height": "100%", "background-color": "#f2a900", "width": "=if([$psTotal] == 0, '0%', ([$psYellow] / [$psTotal] * 100) + '%')" } },
          { "elmType": "div", "style": { "height": "100%", "background-color": "#c62828", "width": "=if([$psTotal] == 0, '0%', ([$psRed] / [$psTotal] * 100) + '%')" } },
          { "elmType": "div", "style": { "height": "100%", "background-color": "#bdbdbd", "width": "=if([$psTotal] == 0, '0%', ([$psNone] / [$psTotal] * 100) + '%')" } } ] } ] } }
'@

# Главная: «Динаміка стану портфеля» — галерея «Динаміка»: плитка = срез, цветной сложенный столбец (высота — от psMax)
$fmtStatsDyn = @'
{ "tileProps": { "height": 236, "width": 64, "hideSelection": true, "fillHorizontally": false,
  "formatter": {
    "elmType": "div", "style": { "display": "flex", "flex-direction": "column", "align-items": "center", "justify-content": "flex-end", "height": "228px", "box-sizing": "border-box" },
    "attributes": { "title": "='Зелений ' + [$psGreen] + ' · Жовтий ' + [$psYellow] + ' · Червоний ' + [$psRed]" },
    "children": [
      { "elmType": "div", "style": { "display": "flex", "flex-direction": "column", "justify-content": "flex-end", "width": "30px", "height": "172px" },
        "children": [
          { "elmType": "div", "txtContent": "=if([$psRed] == 0, '', [$psRed])",
            "style": { "height": "=if([$psMax] == 0, '0px', ([$psRed] / [$psMax] * 150) + 'px')", "background-color": "#c62828", "color": "#ffffff", "font-size": "11px", "font-weight": "600", "text-align": "center", "border-radius": "5px", "margin-top": "2px", "overflow": "hidden" } },
          { "elmType": "div", "txtContent": "=if([$psYellow] == 0, '', [$psYellow])",
            "style": { "height": "=if([$psMax] == 0, '0px', ([$psYellow] / [$psMax] * 150) + 'px')", "background-color": "#f2a900", "color": "#ffffff", "font-size": "11px", "font-weight": "600", "text-align": "center", "border-radius": "5px", "margin-top": "2px", "overflow": "hidden" } },
          { "elmType": "div", "txtContent": "=if([$psGreen] == 0, '', [$psGreen])",
            "style": { "height": "=if([$psMax] == 0, '0px', ([$psGreen] / [$psMax] * 150) + 'px')", "background-color": "#2e7d32", "color": "#ffffff", "font-size": "11px", "font-weight": "600", "text-align": "center", "border-radius": "5px", "margin-top": "2px", "overflow": "hidden" } } ] },
      { "elmType": "div", "txtContent": "[$Title]", "style": { "font-size": "11px", "color": "#605e5c", "margin-top": "6px", "white-space": "nowrap" } } ] } } }
'@

@(
    @($P,"pmRAG",$fmtDot), @($P,"pmPriority",$fmtPrio), @($P,"pmType",$fmtStar), @($P,"pmProgress",$fmtProgress), @($P,"pmLastUpdate",$fmtFreshness),
    @($P,"pmPlanEnd",$fmtPlanEnd), @($P,"pmLastReport",$fmtLong), @($P,"pmLastComment",$fmtLong), @($P,"pmLoop",$fmtLoop), @($P,"pmBudgetUse",$fmtBudgetUse),
    @($R,"srProjectType",$fmtStar), @($R,"srProjectPriority",$fmtPrio), @($R,"srRAG",$fmtDot), @($R,"srSchedule",$fmtDot), @($R,"srBudget",$fmtDot),
    @($R,"srResources",$fmtDot), @($R,"srProgress",$fmtProgress), @($K,"riProjectType",$fmtStar), @($K,"riProjectPriority",$fmtPrio), @($K,"riScore",$fmtScore)
) | ForEach-Object { Set-PnPField -List $_[0] -Identity $_[1] -Values @{ CustomFormatter = $_[2] } | Out-Null }


# ===========================================================================
# 9. Представления (группировок по статусам нет; названия представлений SharePoint не переводит)
# ===========================================================================
Write-Host "9. Представления" -ForegroundColor Cyan
$active = "<And><And><Neq><FieldRef Name='pmStatus'/><Value Type='Choice'>Скасовано</Value></Neq>" +
          "<Neq><FieldRef Name='pmStatus'/><Value Type='Choice'>Архівний</Value></Neq></And>" +
          "<Neq><FieldRef Name='pmStatus'/><Value Type='Choice'>Завершено</Value></Neq></And>"
$notArchived = "<Neq><FieldRef Name='pmStatus'/><Value Type='Choice'>Архівний</Value></Neq>"
$order = "<OrderBy><FieldRef Name='pmType' Ascending='FALSE'/><FieldRef Name='pmPriority'/></OrderBy>"

# Порядок колонок во всех представлениях: стратегический, приоритет, название, затем остальные
$pFields = @("pmType","pmPriority","LinkTitle","pmManager","pmStatus","pmRAG","pmLastUpdate","pmProgress","pmPlanEnd","pmLastReport")
$null     = Set-BaseView $P "Усі проєкти" $pFields "$order<Where>$notArchived</Where>"
$null     = Ensure-View $P "Стратегічні" $pFields "$order<Where><And>$active<Eq><FieldRef Name='pmType'/><Value Type='Choice'>Стратегічний</Value></Eq></And></Where>"
$vProblem = Ensure-View $P "Проблемні" @("pmType","pmPriority","LinkTitle","pmRAG","pmManager","pmLastReport","pmLastUpdate") `
    ("<OrderBy><FieldRef Name='pmRAG'/></OrderBy><Where><And>$active<Or><Eq><FieldRef Name='pmRAG'/><Value Type='Choice'>Червоний</Value></Eq>" +
     "<Eq><FieldRef Name='pmRAG'/><Value Type='Choice'>Жовтий</Value></Eq></Or></And></Where>")
$null     = Ensure-View $P "Мої проєкти" $pFields `
    ("$order<Where><And>$notArchived<Or><Eq><FieldRef Name='pmManager'/><Value Type='Integer'><UserID Type='Integer'/></Value></Eq>" +
     "<Or><Eq><FieldRef Name='pmOwner'/><Value Type='Integer'><UserID Type='Integer'/></Value></Eq>" +
     "<Includes><FieldRef Name='pmStakeholders' LookupId='TRUE'/><Value Type='Integer'><UserID Type='Integer'/></Value></Includes></Or></Or></And></Where>")
$vStale   = Ensure-View $P "Немає свіжого звіту" @("pmType","pmPriority","LinkTitle","pmManager","pmLastUpdate","pmStatus") `
    ("<Where><And>$active<Or><IsNull><FieldRef Name='pmLastUpdate'/></IsNull>" +
     "<Lt><FieldRef Name='pmLastUpdate'/><Value Type='DateTime'><Today OffsetDays='-14'/></Value></Lt></Or></And></Where>")
$vArchive = Ensure-View $P "Архів" @("pmType","pmPriority","LinkTitle","pmManager","pmOwner","pmArchivedAt","pmPlanEnd","pmBudget","pmActualCost") `
    "<OrderBy><FieldRef Name='pmArchivedAt' Ascending='FALSE'/></OrderBy><Where><Eq><FieldRef Name='pmStatus'/><Value Type='Choice'>Архівний</Value></Eq></Where>"

# Галерея «Плитки» — оформление из gallery-view.json
$tileFields = @("LinkTitle","pmCode","pmType","pmPriority","pmStatus","pmManager","pmRAG","pmProgress","pmLastUpdate","pmLastReport","pmLoop")
$vTiles = Ensure-View $P "Плитки" $tileFields "$order<Where>$active</Where>"
$tileJson = Get-Content -Raw -Path (Join-Path $here "gallery-view.json") -ErrorAction SilentlyContinue
try {
    $vals = @{ ViewType2 = "TILES" }
    # gallery-view.json — в формате вставки через интерфейс («Галерея» → «Форматировать представление»);
    # в свойство представления SharePoint принимает его вложенным в tileProps, иначе молча показывает стандартные карточки.
    # & -> \u0026: PnP 3.x передаёт JSON внутри XML без экранирования; для JSON это та же строка.
    if ($tileJson) {
        $tile = [string]$tileJson | ConvertFrom-Json -AsHashtable
        $tile.Remove('$schema')
        $vals.CustomFormatter = (@{ tileProps = $tile } | ConvertTo-Json -Depth 64 -Compress).Replace('&', '\u0026')
    }
    Set-PnPView -List $P -Identity $vTiles.Id -Values $vals | Out-Null
} catch {
    Write-Warning "Режим галереи для «Плитки» не включён. Вручную: представление → «Галерея» → «Форматировать текущее представление» → вставьте gallery-view.json."
}

$rFields = @("srProjectType","srProjectPriority","srProject","srDate","srRAG","srSchedule","srBudget","srResources","LinkTitle","Author","srDecision")
$null      = Set-BaseView $R "Усі звіти" $rFields "<OrderBy><FieldRef Name='srDate' Ascending='FALSE'/></OrderBy>"
$vDecision = Ensure-View $R "Потребують рішення" @("srProjectType","srProjectPriority","srProject","srDate","srDecisionText","Author") `
    "<OrderBy><FieldRef Name='srDate' Ascending='FALSE'/></OrderBy><Where><Eq><FieldRef Name='srDecision'/><Value Type='Boolean'>1</Value></Eq></Where>"

$kFields = @("riProjectType","riProjectPriority","riProject","LinkTitle","riType","riScore","riOwner","riStatus","riDue")
$null   = Set-BaseView $K "Усі ризики" $kFields "<OrderBy><FieldRef Name='riScore' Ascending='FALSE'/></OrderBy>"
$vRisks = Ensure-View $K "Відкриті" $kFields `
    "<OrderBy><FieldRef Name='riScore' Ascending='FALSE'/></OrderBy><Where><Neq><FieldRef Name='riStatus'/><Value Type='Choice'>Закрито</Value></Neq></Where>"

$null = Set-BaseView $C "Усі зміни" @("kcProject","kcDate","kcChangedBy","kcKind","LinkTitle","kcFrom","kcTo","kcReason") "<OrderBy><FieldRef Name='kcDate' Ascending='FALSE'/></OrderBy>"
$null = Set-BaseView $M "Усі коментарі" @("cmProject","cmText","Author","Created") "<OrderBy><FieldRef Name='Created' Ascending='FALSE'/></OrderBy>"

# Как в прототипе: «Проєкти» открываются плитками, «Ризики» — открытыми
Set-PnPView -List $P -Identity $vTiles.Id -Values @{ DefaultView = $true } | Out-Null
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

# Показатели портфеля: «Стан» — плашки по состоянию, «Динаміка» — столбцы по срезам (оформление ниже, в fmtStats*)
$vStatNow = Ensure-View $S "Стан" @("LinkTitle","psGreen","psYellow","psRed","psNone","psTotal") `
    "<Where><Eq><FieldRef Name='psKind'/><Value Type='Choice'>Поточний</Value></Eq></Where>"
$vStatDyn = Ensure-View $S "Динаміка" @("LinkTitle","psDate","psGreen","psYellow","psRed","psNone","psTotal","psMax") `
    "<OrderBy><FieldRef Name='psDate'/></OrderBy><Where><Eq><FieldRef Name='psKind'/><Value Type='Choice'>Зріз</Value></Eq></Where>"
Set-PnPView -List $S -Identity $vStatNow.Id -Values @{ CustomFormatter = $fmtStatsNow } | Out-Null
Set-PnPView -List $S -Identity $vStatDyn.Id -Values @{ ViewType2 = "TILES"; CustomFormatter = $fmtStatsDyn.Replace('&', '\u0026') } | Out-Null

# ===========================================================================
# 10. Дашборд: ссылки «Новий проєкт / статус-звіт», показатели портфеля (плашки и динамика),
#     ниже списки во всю ширину; переводы EN и RU
# ===========================================================================
if (-not $SkipPage) {
    Write-Host "10. Панель проєктів" -ForegroundColor Cyan
    $Pr = Get-PnPList -Identity "Lists/Projects" -Includes RootFolder
    $Re = Get-PnPList -Identity "Lists/StatusReports" -Includes RootFolder
    $Ri = Get-PnPList -Identity "Lists/RisksIssues" -Includes RootFolder
    $St = Get-PnPList -Identity "Lists/PortfolioStats" -Includes RootFolder
    # тексты страницы: uk / en / ru — как в прототипе
    $DASH = @{
        "Dashboard"    = @{ New = @("Новий проєкт", "Новий статус-звіт"); T = @("Портфель за станом", "Динаміка стану портфеля", "Проблемні проєкти", "Немає свіжого статус-звіту", "Потребують рішення керівництва", "Відкриті ризики") }
        "en/Dashboard" = @{ New = @("New project", "New status report"); T = @("Portfolio by health", "Portfolio health over time", "Projects at risk", "No recent status report", "Management decisions needed", "Open risks") }
        "ru/Dashboard" = @{ New = @("Новый проект", "Новый статус-отчёт"); T = @("Портфель по состоянию", "Динамика состояния портфеля", "Проблемные проекты", "Нет свежего статус-отчёта", "Требуют решения руководства", "Открытые риски") }
    }
    $parts = @(@($St, $vStatNow, 2, 1), @($St, $vStatDyn, 2, 2), @($Pr, $vProblem, 3, 1), @($Pr, $vStale, 4, 1), @($Re, $vDecision, 5, 1), @($Ri, $vRisks, 6, 1))
    function Build-Dashboard([string]$Name) {
        $d = $DASH[$Name]
        # пересобираем, только если состав страницы отличается (прежняя версия с Quick chart, другие заголовки)
        $have = @(Get-PnPPageComponent -Page $Name | ForEach-Object { try { ($_.PropertiesJson | ConvertFrom-Json).listTitle } catch { $null } } | Where-Object { $_ })
        if (($have -join "|") -eq ($d.T -join "|")) { return $false }
        $pg = Get-PnPPage -Identity $Name
        $pg.ClearPage()
        $pg.AddSection("OneColumn", 1)
        $pg.AddSection("TwoColumn", 2)
        3..6 | ForEach-Object { $pg.AddSection("OneColumn", $_) }
        $null = $pg.Save()
        $base = $web.ServerRelativeUrl.TrimEnd('/')
        Add-PnPPageTextPart -Page $Name -Section 1 -Column 1 -Text ("<p><a href=""$base/Lists/Projects/NewForm.aspx""><strong>＋ $($d.New[0])</strong></a>&nbsp;&nbsp;&nbsp;&nbsp;" +
            "<a href=""$base/Lists/StatusReports/NewForm.aspx""><strong>＋ $($d.New[1])</strong></a></p>") | Out-Null
        for ($i = 0; $i -lt $parts.Count; $i++) {
            $x = $parts[$i]
            Add-PnPPageWebPart -Page $Name -DefaultWebPartType List -Section $x[2] -Column $x[3] -WebPartProperties @{
                isDocumentLibrary = $false; selectedListId = "$($x[0].Id)"; selectedListUrl = $x[0].RootFolder.ServerRelativeUrl
                selectedViewId = "$($x[1].Id)"; listTitle = $d.T[$i]; webpartHeightKey = 4; hideCommandBar = $true
            } | Out-Null
        }
        Set-PnPPage -Identity $Name -Publish | Out-Null
        return $true
    }
    try { $page = Get-PnPPage -Identity "Dashboard" -ErrorAction Stop } catch { $page = $null }
    if (-not $page) {
        $null = Add-PnPPage -Name "Dashboard" -Title "Панель проєктів" -LayoutType Article
        Set-PnPPage -Identity "Dashboard" -Publish | Out-Null
        Set-PnPHomePage -RootFolderRelativeUrl "SitePages/Dashboard.aspx"
        Write-Host "  + страница создана и назначена домашней" -ForegroundColor Green
    }
    if (Build-Dashboard "Dashboard") { Write-Host "  + главная собрана" -ForegroundColor Green }
    try {
        Enable-PnPFeature -Identity "24611c05-ee19-45da-955f-6602264abaf8" -Scope Web -ErrorAction SilentlyContinue
        # по полному пути: у переводов (SitePages/en/, SitePages/ru/) то же имя файла
        $item = Get-PnPListItem -List "SitePages" -Fields "FileRef" | Where-Object { $_["FileRef"] -like "*/SitePages/Dashboard.aspx" } | Select-Object -First 1
        # создаём только недостающие переводы: повторный create для существующего языка — ошибка
        $tr = Invoke-PnPSPRestMethod -Method Get -Url "/_api/sitepages/pages($($item.Id))/translations"
        $missing = @("en-us", "ru-ru") | Where-Object { $_ -in $tr.UntranslatedLanguages }
        if ($missing) {
            Invoke-PnPSPRestMethod -Method Post -Url "/_api/sitepages/pages($($item.Id))/translations/create" `
                -Content @{ request = @{ LanguageCodes = @($missing) } } | Out-Null
            Write-Host "  + переводы страницы: $($missing -join ', ')"
        }
        # SharePoint создаёт перевод черновиком с заголовком-заглушкой («Перекласти мовою …»):
        # задаём заголовок и публикуем. Уже переименованный перевод не трогаем — его мог править человек.
        foreach ($t in @(@("en", "Project dashboard"), @("ru", "Панель проектов"))) {
            $tp = Get-PnPPage -Identity "$($t[0])/Dashboard" -ErrorAction SilentlyContinue
            if ($tp -and $tp.PageTitle -ne $t[1] -and $tp.PageTitle -like "*Панель проєктів*") {
                Set-PnPPage -Identity "$($t[0])/Dashboard" -Title $t[1] -Publish | Out-Null
                Write-Host "  + перевод $($t[0]): «$($t[1])», опубликован"
            }
            if ($tp -and (Build-Dashboard "$($t[0])/Dashboard")) { Write-Host "  + перевод $($t[0]) собран" -ForegroundColor Green }
        }
    } catch {
        Write-Warning "Переводы страницы не созданы автоматически ($($_.Exception.Message)): страница → «Перевод» → «Создать» для English и Русский."
    }
}

Write-Host "`nГотово: $siteUrl" -ForegroundColor Yellow
Write-Host "Дальше:" -ForegroundColor Yellow
Write-Host "  1) добавьте участников в группу «$PMO_GROUP» и сотрудников компании — в участники сайта;"
Write-Host "  2) диаграммы на главной заполнит синхронизация (или сразу: Invoke-Env.ps1 -Action charts);"
Write-Host "  3) запустите Invoke-PMOSync.ps1 и поставьте его на расписание (см. README)."
