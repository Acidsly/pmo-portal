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
    [string]$SiteAlias = "ppm",
    [string]$SiteTitle = "PPM — Портфель проєктів",
    [string]$Owner,
    [string]$Tenant,
    [string]$Thumbprint,
    [string]$CertificatePath,
    [SecureString]$CertificatePassword,
    # список «Відгуки» и кнопка «Відгук» в приложении — для теста с фокус-группой (Invoke-Env передаёт только для test)
    [switch]$Feedback
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "PMO.Common.ps1")
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
Set-Loc $web "PPM — Портфель проєктів" "PPM — Project Portfolio" "PPM — Портфель проектов"
$web.Update()
Invoke-PnPQuery
Write-Host "  языки: uk-UA (по умолчанию), en-US, ru-RU"

$ROLE_FULL = Get-RoleName "Administrator"
$ROLE_EDIT = Get-RoleName "Contributor"
$ROLE_READ = Get-RoleName "Reader"
# «только добавление»: создать запись в папке проекта и читать, но не править и не удалять (отчёты, комментарии, погодження).
# Созданную запись меняет только синхронизация. Имя — как $ROLE_ADD_NAME в Invoke-PMOSync.ps1.
$ROLE_ADD = "Додавання (портал)"
if (-not (Get-PnPRoleDefinition | Where-Object Name -eq $ROLE_ADD)) {
    Add-PnPRoleDefinition -RoleName $ROLE_ADD -Description "Портфель проєктів: додавати й переглядати записи без зміни та видалення" `
        -Include ViewListItems, AddListItems, OpenItems, ViewVersions, ViewFormPages, ViewPages, Open, BrowseUserInfo, UseRemoteAPIs, UseClientIntegration | Out-Null
    Write-Host "  + уровень прав «$ROLE_ADD»" -ForegroundColor Green
}

# «только правка своей записи»: сповіщення — человек отмечает прочитанное в своей строке «Прочитане», не добавляет и не удаляет.
# Имя — как $ROLE_UPDATE_NAME в Invoke-PMOSync.ps1.
$ROLE_UPDATE = "Оновлення (портал)"
if (-not (Get-PnPRoleDefinition | Where-Object Name -eq $ROLE_UPDATE)) {
    Add-PnPRoleDefinition -RoleName $ROLE_UPDATE -Description "Портфель проєктів: переглядати й змінювати свій запис без додавання та видалення" `
        -Include ViewListItems, EditListItems, OpenItems, ViewFormPages, ViewPages, Open, BrowseUserInfo, UseRemoteAPIs, UseClientIntegration | Out-Null
    Write-Host "  + уровень прав «$ROLE_UPDATE»" -ForegroundColor Green
}

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
F $P pmActualEnd   DateTime "Дата завершення (факт)" "Actual completion date" "Дата завершения (факт)" "Format='DateOnly'"
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
# Посилання картки (JSON [{ "t": назва, "u": адреса }]) — вместо одной ссылки на Loop; правит PM в приложении
F $P pmLinks       Note     "Посилання"          "Links"               "Ссылки"               "Hidden='TRUE' NumLines='6' RichText='FALSE'"
# отметки одноразовой миграции проекта (team, links): повторный запуск удалённое PM не возвращает
F $P pmMigrated    Text     "Службове: міграція" "System: migration"   "Служебное: миграция"  "Hidden='TRUE' MaxLength='100'"
F $P pmEditLog     Note     "Службове: правки картки" "System: card edits" "Служебное: правки карточки" "Hidden='TRUE' NumLines='6' RichText='FALSE'"
$script:Loc += , @($P, "Title", "Назва проєкту", "Project name", "Название проекта")
# код проекта уникален (индекс + запрет дублей); если дубли уже есть — предупреждение, их правят вручную
$codeF = Get-PnPField -List $P -Identity pmCode
if (-not $codeF.EnforceUniqueValues) {
    $dups = @(Get-PnPListItem -List $P -PageSize 500 -Fields "pmCode" | Where-Object { $_["pmCode"] } | Group-Object { ([string]$_["pmCode"]).Trim().ToUpperInvariant() } | Where-Object Count -gt 1)
    if ($dups) { Write-Warning ("  коды проектов повторяются ({0}) — запрет дублей не включён" -f (($dups | ForEach-Object Name) -join ", ")) }
    else {
        Set-PnPField -List $P -Identity pmCode -Values @{ Indexed = $true } | Out-Null
        Set-PnPField -List $P -Identity pmCode -Values @{ EnforceUniqueValues = $true } | Out-Null
        Write-Host "  код проекта: запрет дублей"
    }
}

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
# #46: новый отчёт на основе повернутого — номер повернутого (пишет приложение при создании; синхронизация проверяет)
F $R srBasedOn     Number   "На основі звіту"    "Based on report"     "На основе отчёта"     "Decimals='0'"
F $R srActualEnd   DateTime "Дата завершення (факт)" "Actual completion date" "Дата завершения (факт)" "Format='DateOnly'"
F $R srActualCost  Currency "Витрати на дату"    "Cost to date"        "Затраты на дату"      "LCID='1058' Decimals='0'"
F $R srKeyReason   Note     "Причина зміни показників" "Reason for changing indicators" "Причина изменения показателей" "NumLines='3' RichText='FALSE'"
F $R srDone        Note     "Зроблено за період" "Done this period"    "Сделано за период"    "NumLines='5' RichText='FALSE'"
F $R srNext        Note     "План на наступний період" "Plan for next period" "План на следующий период" "NumLines='5' RichText='FALSE'"
F $R srIssues      Note     "Проблеми та ризики" "Issues and risks"    "Проблемы и риски"     "NumLines='5' RichText='FALSE'"
F $R srDecision    Boolean  "Потрібне рішення керівництва" "Management decision needed" "Требуется решение руководства" "" "<Default>0</Default>"
F $R srDecisionText Note    "Яке рішення потрібне" "Decision required" "Какое решение нужно"  "NumLines='3' RichText='FALSE'"
F $R srApplied     Boolean  "Службове: застосовано" "System: applied"  "Служебное: применено" "Hidden='TRUE'" "<Default>0</Default>"
F $R pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
# погодження PMO: пишет синхронизация из «Погодження звітів»; в карточку попадает только «Погоджено»
$hadApproval = [bool](Test-Field $R "srApproval")
F $R srApproval    Choice   "Погодження"         "Approval"            "Согласование"         "Format='Dropdown'" (Choices @("На погодженні","Погоджено","Повернуто") "На погодженні")
F $R srApprovedBy  User     "Погодив"            "Approved by"         "Согласовал"           "UserSelectionMode='PeopleOnly'"
F $R srApprovedAt  DateTime "Дата погодження"    "Approval date"       "Дата согласования"    "Format='DateTime'"
F $R srApprovalNote Note    "Коментар PMO"       "PMO comment"         "Комментарий PMO"      "NumLines='3' RichText='FALSE'"
$script:Loc += , @($R, "Title", "Резюме одним рядком", "One-line summary", "Резюме одной строкой")

if (-not $hadApplied) {
    # Отчёты, созданные до появления синхронизации, считаем уже применёнными — чтобы не задвоить историю
    $existing = @(Get-PnPListItem -List $R -PageSize 500 -Fields "ID" | Where-Object { [string]$_.FileSystemObjectType -ne "Folder" })
    foreach ($it in $existing) { Set-PnPListItem -List $R -Identity $it.Id -Values @{ srApplied = $true } -UpdateType SystemUpdate | Out-Null }
    if ($existing.Count) { Write-Host "  существующие отчёты ($($existing.Count)) отмечены как применённые" }
}
if (-not $hadApproval) {
    # Миграция: отчёты, уже перенесённые в карточку до появления погодження, — «Погоджено»; остальные ждут PMO
    $n = 0
    foreach ($it in (Get-PnPListItem -List $R -PageSize 500 -Fields "ID","srApplied" | Where-Object { [string]$_.FileSystemObjectType -ne "Folder" })) {
        $v = if ($it["srApplied"] -eq $true) { "Погоджено" } else { "На погодженні" }
        Set-PnPListItem -List $R -Identity $it.Id -Values @{ srApproval = $v } -UpdateType SystemUpdate | Out-Null; $n++
    }
    if ($n) { Write-Host "  миграция: погодження для $n отчётов (применённые — «Погоджено»)" }
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
F $K riDue         DateTime "Термін виконання заходів" "Mitigation due date" "Срок выполнения мер" "Format='DateOnly'"
F $K riStrategy    Choice   "Стратегія реагування" "Response strategy" "Стратегия реагирования" "" (Choices @("Уникнення", "Зниження (пом'якшення)", "Передача", "Прийняття") "")
F $K riMitigation  Note     "Заходи для зниження ризику" "Risk reduction actions" "Меры по снижению риска" "NumLines='4' RichText='FALSE'"
F $K riContingency Note     "План дій у разі настання" "Contingency plan" "План действий при наступлении" "NumLines='4' RichText='FALSE'"
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
$kinds = @("Створення","Статус-звіт","Редагування картки","Погодження звіту","Призначення","Подання звіту","Ризик")
F $C kcKind        Choice   "Тип зміни"          "Change type"         "Тип изменения"        "Format='Dropdown'" (Choices $kinds "Статус-звіт")
$cur = Get-PnPField -List $C -Identity kcKind
if (@($kinds | Where-Object { $cur.Choices -notcontains $_ }).Count) { Set-PnPField -List $C -Identity kcKind -Values @{ Choices = [string[]]$kinds } | Out-Null; Write-Host "    типы изменений: $($kinds -join ', ')" }
F $C kcField       Text     "Поле (внутр.)"      "Field (internal)"    "Поле (внутр.)"        "MaxLength='64'"
# приложение читает из журнала только переносы плановой даты (фильтр по kcField) — без индекса фильтр по большому списку упрётся в порог 5000
if (-not (Get-PnPField -List $C -Identity kcField).Indexed) { Set-PnPField -List $C -Identity kcField -Values @{ Indexed = $true } | Out-Null; Write-Host "    индекс kcField" }
F $C kcFrom        Note     "Було"               "Old value"           "Было"                 "NumLines='2' RichText='FALSE'"
F $C kcTo          Note     "Стало"              "New value"           "Стало"                "NumLines='2' RichText='FALSE'"
F $C kcReason      Note     "Причина зміни"      "Reason"              "Причина изменения"    "NumLines='3' RichText='FALSE'"
# #46 / #48: номер отчёта или риска события — история карточки открывает запись
F $C kcItem        Number   "Запис"              "Item"                "Запись"               "Decimals='0'"
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

# 6c. Погодження звітів — решение PMO по статус-отчёту: только цвета, решение, комментарий (сам отчёт PMO не правит)
Write-Host "6c. Список «Погодження звітів»" -ForegroundColor Cyan
$AP = Ensure-List "Lists/ReportApprovals" "Погодження звітів" "Report approvals" "Согласование отчётов"
$repLookup = "List='{$($R.Id)}' ShowField='ID' Required='TRUE' Indexed='TRUE' RelationshipDeleteBehavior='Restrict'"
F $AP apReport      Lookup   "Статус-звіт"        "Status report"       "Статус-отчёт"         $repLookup
F $AP apProject     Lookup   "Проєкт"             "Project"             "Проект"               $lookup
F $AP apDecision    Choice   "Рішення"            "Decision"            "Решение"              "Format='Dropdown' Required='TRUE'" (Choices @("Погоджено","Повернуто"))
F $AP apSchedule    Choice   "Терміни (PMO)"      "Schedule (PMO)"      "Сроки (PMO)"          "Format='Dropdown'" (Choices $rag)
F $AP apBudget      Choice   "Бюджет (PMO)"       "Budget (PMO)"        "Бюджет (PMO)"         "Format='Dropdown'" (Choices $rag)
F $AP apResources   Choice   "Ресурси (PMO)"      "Resources (PMO)"     "Ресурсы (PMO)"        "Format='Dropdown'" (Choices $rag)
F $AP apNote        Note     "Коментар"           "Comment"             "Комментарий"          "NumLines='4' RichText='FALSE'"
F $AP apApplied     Boolean  "Службове: застосовано" "System: applied"  "Служебное: применено" "Hidden='TRUE'" "<Default>0</Default>"
F $AP pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
$script:Loc += , @($AP, "Title", "Коротко", "Summary", "Кратко")
Set-PnPField -List $AP -Identity "Title" -Values @{ Required = $false } | Out-Null

# 6d. Призначення (#43) — решение PMO о смене PM / власника после создания проекта; переносит синхронизация (сама карточка PM не меняется)
# 6e. Прочитане — сповіщення в приложении: строка на человека, «прочитано до» (номер записи журнала и комментариев).
#     Строку и права на неё (только этому человеку, «Оновлення (портал)») создаёт синхронизация, раздел 7.
Write-Host "6e. Список «Прочитане»" -ForegroundColor Cyan
$NS = Ensure-List "Lists/NotifyState" "Прочитане" "Read marks" "Прочитанное"
F $NS nsUser        User     "Користувач"         "User"                "Пользователь"         "UserSelectionMode='PeopleOnly'"
F $NS nsReadId      Number   "Прочитано до (журнал)" "Read up to (log)" "Прочитано до (журнал)" "Decimals='0'" "<Default>0</Default>"
F $NS nsReadCmId    Number   "Прочитано до (коментарі)" "Read up to (comments)" "Прочитано до (комментарии)" "Decimals='0'" "<Default>0</Default>"
F $NS pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='255'"
$script:Loc += , @($NS, "Title", "E-mail", "E-mail", "E-mail")

Write-Host "6d. Список «Призначення»" -ForegroundColor Cyan
$PA = Ensure-List "Lists/ProjectAssignments" "Призначення" "Assignments" "Назначения"
F $PA paProject     Lookup   "Проєкт"             "Project"             "Проект"               $lookup
F $PA paManager     User     "Новий PM"           "New PM"              "Новый PM"             "UserSelectionMode='PeopleOnly'"
F $PA paOwner       User     "Новий власник"      "New owner"           "Новый владелец"       "UserSelectionMode='PeopleOnly'"
F $PA paNote        Note     "Коментар"           "Comment"             "Комментарий"          "NumLines='4' RichText='FALSE'"
F $PA paApplied     Boolean  "Службове: застосовано" "System: applied"  "Служебное: применено" "Hidden='TRUE'" "<Default>0</Default>"
F $PA pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
$script:Loc += , @($PA, "Title", "Коротко", "Summary", "Кратко")
Set-PnPField -List $PA -Identity "Title" -Values @{ Required = $false } | Out-Null

# 6a. Команда проєкту — стейкхолдеры таблицей: пользователь, роль в проекте, с каких вопросов обращаться
Write-Host "6a. Список «Команда проєкту»" -ForegroundColor Cyan
$TM = Ensure-List "Lists/ProjectTeam" "Команда проєкту" "Project team" "Команда проекта"
F $TM tmProject     Lookup   "Проєкт"             "Project"             "Проект"               $lookup
F $TM tmUser        User     "Учасник"            "Member"              "Участник"             "Required='TRUE' UserSelectionMode='PeopleOnly'"
F $TM tmRole        Text     "Роль у проєкті"     "Role in the project" "Роль в проекте"       "Required='TRUE' MaxLength='255'"
F $TM tmTopics      Note     "З яких питань звертатися" "Contact about"  "По каким вопросам обращаться" "NumLines='3' RichText='FALSE'"
F $TM pmoAcl        Text     "Службове: права"    "System: access"      "Служебное: права"     "Hidden='TRUE' MaxLength='64'"
$script:Loc += , @($TM, "Title", "Коротко", "Summary", "Кратко")
Set-PnPField -List $TM -Identity "Title" -Values @{ Required = $false } | Out-Null

# Миграция (один раз на проект, по отметке pmMigrated): стейкхолдеры → строки команды с ролью «Стейкхолдер»; pmLoop → pmLinks;
# отменённый проект → архив (как завершённый): «Архівний», дата архивации = дата последнего отчёта, строка журнала
$teamOf = @{}
foreach ($x in (Get-PnPListItem -List "Lists/ProjectTeam" -PageSize 500 -Fields "tmProject" | Where-Object { [string]$_.FileSystemObjectType -ne "Folder" })) { if ($x["tmProject"]) { $teamOf[$x["tmProject"].LookupId] = $true } }
foreach ($it in (Get-PnPListItem -List "Lists/Projects" -PageSize 500 -Fields "Title","pmStakeholders","pmLoop","pmLinks","pmMigrated","pmStatus","pmLastUpdate","pmArchivedAt")) {
    $marks = @(([string]$it["pmMigrated"]).Split(",") | Where-Object { $_ })
    $vals = @{}
    if ($marks -notcontains "team") {
        if (-not $teamOf[$it.Id]) {
            foreach ($u in @($it["pmStakeholders"])) { if ($u -and $u.Email) {
                Add-PnPListItem -List "Lists/ProjectTeam" -Values @{ tmProject = $it.Id; tmUser = $u.Email; tmRole = "Стейкхолдер" } | Out-Null } }
        }
        $marks += "team"
    }
    if ($marks -notcontains "links") {
        $loop = $it["pmLoop"]
        if ($loop -and $loop.Url -and -not [string]$it["pmLinks"]) { $vals.pmLinks = (ConvertTo-Json -InputObject @([ordered]@{ t = "Loop"; u = $loop.Url }) -Compress) }
        $marks += "links"
    }
    if ($it["pmStatus"] -eq "Скасовано") {
        $last = $it["pmLastUpdate"]
        $day = if ($last) { [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId(([datetime]$last).ToUniversalTime(), "Europe/Kyiv").ToString("yyyy-MM-dd") } else { (Get-Date).ToString("yyyy-MM-dd") }
        $vals.pmStatus = "Архівний"
        if (-not $it["pmArchivedAt"]) { $vals.pmArchivedAt = "$($day)T12:00:00Z" }
        Add-PnPListItem -List "Lists/KeyChanges" -Values @{ Title = "Статус"; kcProject = $it.Id; kcDate = (Get-Date).ToUniversalTime().ToString("o")
            kcKind = "Редагування картки"; kcField = "pmStatus"; kcFrom = "Скасовано"; kcTo = "Архівний"; kcReason = "Скасований проєкт переведено в архів" } | Out-Null
        Write-Host "    миграция «$($it["Title"])»: Скасовано -> Архівний"
    }
    $newMarks = ($marks | Select-Object -Unique) -join ","
    if ($newMarks -ne [string]$it["pmMigrated"] -or $vals.pmStatus) {
        $vals.pmMigrated = $newMarks
        Set-PnPListItem -List "Lists/Projects" -Identity $it.Id -Values $vals -UpdateType SystemUpdate | Out-Null
        if ($vals.pmStatus) { Sync-ProjectStateFromCard $it.Id }   # статус — ключевое поле: эталон = результат миграции
        Write-Host "    миграция «$($it["Title"])»: $newMarks"
    }
}

# 6a2. Еталон показників — ключевые поля каждого проекта после последнего законного изменения (пишет только синхронизация).
# Если поле карточки изменили в обход статус-отчёта, синхронизация вернёт значение эталона; приложение показывает эталон.
Write-Host "6a2. Список «Еталон показників»" -ForegroundColor Cyan
$PS = Ensure-List "Lists/ProjectState" "Еталон показників" "Indicator baseline" "Эталон показателей"
F $PS psProject     Number   "Проєкт (ID)"        "Project (ID)"        "Проект (ID)"          "Indexed='TRUE' EnforceUniqueValues='TRUE' Decimals='0'"
F $PS psState       Note     "Ключові показники"  "Key indicators"      "Ключевые показатели"  "NumLines='6' RichText='FALSE'"
F $PS psEditDone    Note     "Перенесені правки"  "Journaled edits"     "Перенесённые правки"  "NumLines='3' RichText='FALSE'"
F $PS psLastApplied Text     "Останній застосований звіт" "Last applied report" "Последний применённый отчёт" "MaxLength='40'"
# #46 / #48: снимок учтённых отчётов и рисков для истории (пишет только синхронизация)
F $PS psHistory     Note     "Історія: знімок"    "History snapshot"    "История: снимок"      "NumLines='3' RichText='FALSE'"

# 6b. Відгуки — замечания фокус-группы из приложения (текст, экран, устройство, скриншоты-вложения)
if ($Feedback) {
    Write-Host "6b. Список «Відгуки»" -ForegroundColor Cyan
    $FB = Ensure-List "Lists/Feedback" "Відгуки" "Feedback" "Отзывы"
    F $FB fbText    Note   "Відгук"             "Feedback"            "Отзыв"                "NumLines='6' RichText='FALSE' Required='TRUE'"
    F $FB fbScreen  Text   "Екран"              "Screen"              "Экран"                "MaxLength='255'"
    F $FB fbDevice  Text   "Пристрій"           "Device"              "Устройство"           "MaxLength='255'"
    $fbStatuses = @("Новий", "Прийнято", "Зроблено", "Прокоментовано", "Відхилено")
    F $FB fbStatus  Choice "Статус розгляду"    "Review status"       "Статус рассмотрения"  "" (Choices $fbStatuses "Новий")
    # новые варианты статуса на уже созданном поле (F не меняет существующие поля)
    $cur = Get-PnPField -List $FB -Identity fbStatus
    if (@($fbStatuses | Where-Object { $cur.Choices -notcontains $_ }).Count) { Set-PnPField -List $FB -Identity fbStatus -Values @{ Choices = [string[]]$fbStatuses } | Out-Null; Write-Host "    статусы отзывов: $($fbStatuses -join ', ')" }
    F $FB fbAnswer  Note   "Відповідь"          "Answer"              "Ответ"                "NumLines='4' RichText='FALSE'"
    $script:Loc += , @($FB, "Title", "Коротко", "Summary", "Кратко")
    Set-PnPField -List $FB -Identity "Title" -Values @{ Required = $false } | Out-Null
    # каждый видит и правит только свои отзывы; все отзывы и ответы — на странице «Відгуки»; статусы и ответы — владельцы сайта
    Set-PnPList -Identity "Lists/Feedback" -ReadSecurity AllUsersReadAccessOnItemsTheyCreate -WriteSecurity WriteOnlyMyItems -EnableAttachments $true | Out-Null
    # Відгуки — загальні: копия без скриншотов для страницы «Відгуки» (все видят все отзывы и ответы); пишет только синхронизация
    $FP = Ensure-List "Lists/FeedbackPublic" "Відгуки — загальні" "Feedback — shared" "Отзывы — общие"
    F $FP fpId      Number   "Номер відгуку"      "Feedback no."        "Номер отзыва"         "Indexed='TRUE' Decimals='0'"
    F $FP fpCreated DateTime "Дата"               "Date"                "Дата"                 "Format='DateTime'"
    F $FP fpAuthor  Text     "Автор"              "Author"              "Автор"                "MaxLength='255'"
    F $FP fpScreen  Text     "Екран"              "Screen"              "Экран"                "MaxLength='255'"
    F $FP fpText    Note     "Відгук"             "Feedback"            "Отзыв"                "NumLines='6' RichText='FALSE'"
    F $FP fpStatus  Text     "Статус розгляду"    "Review status"       "Статус рассмотрения"  "MaxLength='50'"
    F $FP fpAnswer  Note     "Відповідь"          "Answer"              "Ответ"                "NumLines='4' RichText='FALSE'"
    F $FP fpShots   Number   "Скриншотів"         "Screenshots"         "Скриншотов"           "Decimals='0'"
    $script:Loc += , @($FP, "Title", "Коротко", "Summary", "Кратко")
    Set-PnPField -List $FP -Identity "Title" -Values @{ Required = $false } | Out-Null
    #region feedback-format
    # цветные метки «Статус розгляду» в списке — PMO разбирает отзывы в стандартном списке
    $fbColors = @{ "Новий" = "#0a64d6"; "Прийнято" = "#8a5a00"; "Відхилено" = "#6b7280"; "Зроблено" = "#1e7d34"; "Прокоментовано" = "#6b3fb8" }
    $fbBg     = @{ "Новий" = "#e3eefc"; "Прийнято" = "#fdf1d8"; "Відхилено" = "#eceef1"; "Зроблено" = "#e2f4e6"; "Прокоментовано" = "#efe7fb" }
    $pick = { param($map) $e = "''"; foreach ($st in $map.Keys) { $e = "if([`$fbStatus]=='$st','$($map[$st])',$e)" }; "=$e" }
    $fmt = @{ '$schema' = "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json"; elmType = "div"; txtContent = "[`$fbStatus]"
              style = @{ color = (& $pick $fbColors); "background-color" = (& $pick $fbBg); padding = "2px 10px"; "border-radius" = "10px"; "font-weight" = "600"; display = "inline-block" } }
    Set-PnPField -List "Lists/Feedback" -Identity fbStatus -Values @{ CustomFormatter = [string]($fmt | ConvertTo-Json -Depth 5 -Compress) } | Out-Null
    #endregion feedback-format
}

# ---------------------------------------------------------------------------
# Подсказки к полям (описания столбцов, uk / en / ru)
# ---------------------------------------------------------------------------
$keep = @("Залиште порожнім, якщо не змінюється.", "Leave empty if unchanged.", "Оставьте пустым, если не меняется.")
foreach ($n in @("srType","srProgress","srStart","srGoLive","srPlanEnd","srForecastEnd","srActualCost")) { Desc $R $n $keep[0] $keep[1] $keep[2] }
Desc $R srStatus "Залиште порожнім, якщо не змінюється. «Завершено» переводить проєкт в архів." "Leave empty if unchanged. «Завершено» moves the project to the archive." "Оставьте пустым, если не меняется. «Завершено» переводит проект в архив."
Desc $R srActualEnd "Обов'язково для «Завершено» і «Скасовано»: коли проєкт фактично завершено або скасовано (не раніше старту, не пізніше дати звіту)." "Required for «Завершено» and «Скасовано»: when the project was actually completed or cancelled (not before the start, not after the report date)." "Обязательно для «Завершено» и «Скасовано»: когда проект фактически завершён или отменён (не раньше старта, не позже даты отчёта)."
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
Set-FormVisibility $P @("pmStatus","pmRAG","pmType","pmProgress","pmStart","pmGoLive","pmPlanEnd","pmForecastEnd","pmActualEnd",
                        "pmActualCost","pmArchivedAt","pmLastUpdate","pmLastReport","pmLastComment") $true $false
Set-FormVisibility $P @("pmRAG","pmForecastEnd","pmActualEnd","pmActualCost","pmArchivedAt","pmLastUpdate","pmLastReport","pmLastComment") $false $false
# «Стратегічний» в отчётах и рисках заполняет синхронизация
# «Стратегічний» и «Пріоритет» в отчётах и рисках — копия из проекта, заполняет синхронизация
Set-FormVisibility $R @("srProjectType","srProjectPriority","srApproval","srApprovedBy","srApprovedAt","srApprovalNote") $false $false
Set-FormVisibility $K @("riProjectType","riProjectPriority") $false $false

# Права списков. Участники сайта: «Проєкти» — только чтение (новый проект заводит PMO), журнал — только чтение (пишет синхронизация);
# дочерние списки — чтение на уровне списка, права на запись выдаются папкам проектов (ниже, модель v2).
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
# Дочерние списки (модель прав v2): на уровне списка — только чтение; записи создаются сразу в папке проекта P<ID>,
# права папки выдаёт синхронизация: PM — отчёты «додавання», риски и команда — правка; комментарии — «додавання» всем,
# кто видит активный проект; погодження — «додавання» PMO. В чужой проект запись не создать; в корне — тоже.
Set-ListRoles "Lists/StatusReports"   @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }
Set-ListRoles "Lists/RisksIssues"     @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }
Set-ListRoles "Lists/ProjectComments" @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }
# команду нового проекта при создании записывает PMO (папки ещё нет) — в корень; синхронизация перенесёт в папку
Set-ListRoles "Lists/ProjectTeam"     @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_EDIT }
Set-ListRoles "Lists/ReportApprovals" @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }
# призначення — «додавання» PMO на папке активного проекта (синхронизация); PM и остальные — чтение
Set-ListRoles "Lists/ProjectAssignments" @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }
# прочитане — у каждой строки свои права (только этот человек); на уровне списка — чтение (строки без прав не видны)
Set-ListRoles "Lists/NotifyState" @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }
Set-ListRoles "Lists/ProjectState"    @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }
# свежие проверки приложения перед записью — фильтры по индексированным полям
foreach ($ix in @(@("Lists/Projects", "Title"), @("Lists/StatusReports", "srProject"), @("Lists/RisksIssues", "riProject"), @("Lists/ProjectComments", "cmProject"),
                  @("Lists/ProjectTeam", "tmProject"), @("Lists/ReportApprovals", "apReport"), @("Lists/ReportApprovals", "apProject"), @("Lists/ProjectAssignments", "paProject"), @("Lists/NotifyState", "Title"), @("Lists/KeyChanges", "kcDate"))) {
    $fx = Get-PnPField -List $ix[0] -Identity $ix[1]
    if (-not $fx.Indexed) { Set-PnPField -List $ix[0] -Identity $ix[1] -Values @{ Indexed = $true } | Out-Null; Write-Host "    индекс $($ix[0]).$($ix[1])" }
}
# отзывы: участники и PMO — добавлять и читать свои; статусы и ответы ставят только владельцы сайта; общий список — только чтение
if ($Feedback) {
    Set-ListRoles "Lists/Feedback"       @{ $members.Title = $ROLE_EDIT; $PMO_GROUP = $ROLE_EDIT }
    Set-ListRoles "Lists/FeedbackPublic" @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ }
}

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

$rFields = @("srProjectType","srProjectPriority","srProject","srDate","srRAG","srSchedule","srBudget","srResources","LinkTitle","Author","srDecision","srApproval")
$null      = Set-BaseView $R "Усі звіти" $rFields "<OrderBy><FieldRef Name='srDate' Ascending='FALSE'/></OrderBy>"
$null      = Ensure-View $R "Потребують рішення" @("srProjectType","srProjectPriority","srProject","srDate","srDecisionText","Author") `
    "<OrderBy><FieldRef Name='srDate' Ascending='FALSE'/></OrderBy><Where><Eq><FieldRef Name='srDecision'/><Value Type='Boolean'>1</Value></Eq></Where>"

$kFields = @("riProjectType","riProjectPriority","riProject","LinkTitle","riType","riScore","riOwner","riStatus","riDue")
$null   = Set-BaseView $K "Усі ризики" $kFields "<OrderBy><FieldRef Name='riScore' Ascending='FALSE'/></OrderBy>"
$vRisks = Ensure-View $K "Відкриті" $kFields `
    "<OrderBy><FieldRef Name='riScore' Ascending='FALSE'/></OrderBy><Where><Neq><FieldRef Name='riStatus'/><Value Type='Choice'>Закрито</Value></Neq></Where>"

$null = Set-BaseView $C "Усі зміни" @("kcProject","kcDate","kcChangedBy","kcKind","LinkTitle","kcFrom","kcTo","kcReason") "<OrderBy><FieldRef Name='kcDate' Ascending='FALSE'/></OrderBy>"
$null = Set-BaseView $NS "Усі" @("LinkTitle","nsUser","nsReadId","nsReadCmId","Modified") "<OrderBy><FieldRef Name='Title'/></OrderBy>"
$null = Set-BaseView $PA "Усі призначення" @("paProject","paManager","paOwner","paNote","Author","Created") "<OrderBy><FieldRef Name='Created' Ascending='FALSE'/></OrderBy>"
$null = Set-BaseView $AP "Усі погодження" @("apProject","apReport","apDecision","apSchedule","apBudget","apResources","apNote","Author","Created") "<OrderBy><FieldRef Name='Created' Ascending='FALSE'/></OrderBy>"
$null = Set-BaseView $TM "Уся команда" @("tmProject","tmUser","tmRole","tmTopics") "<OrderBy><FieldRef Name='tmProject'/></OrderBy>"
$null = Set-BaseView $M "Усі коментарі" @("cmProject","cmText","Author","Created") "<OrderBy><FieldRef Name='Created' Ascending='FALSE'/></OrderBy>"
if ($Feedback) { $null = Set-BaseView $FB "Усі відгуки" @("Created","Author","fbStatus","fbScreen","fbText","Attachments","fbDevice","fbAnswer") "<OrderBy><FieldRef Name='Created' Ascending='FALSE'/></OrderBy>" }

# По умолчанию: «Проєкти» — «Усі проєкти» (без архива), «Ризики» — «Відкриті»
Set-PnPView -List $P -Identity $vAll.Id -Values @{ DefaultView = $true } | Out-Null
Set-PnPView -List $K -Identity $vRisks.Id -Values @{ DefaultView = $true } | Out-Null

# Дочерние списки разложены по папкам проектов P<ID> (права папки — синхронизация): все представления показывают записи
# всех папок плоским списком, без самих папок
foreach ($lst in @($R, $K, $C, $M, $AP, $TM)) {
    foreach ($v in (Get-PnPView -List $lst)) {
        if ($v.Scope -ne [Microsoft.SharePoint.Client.ViewScope]::Recursive) {
            Set-PnPView -List $lst -Identity $v.Id -Values @{ Scope = [Microsoft.SharePoint.Client.ViewScope]::Recursive } | Out-Null
            Write-Host "    представление «$($v.Title)» ($($lst.Title)): все папки"
        }
    }
}

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

# ===========================================================================
# 8a. Изменения — только через приложение (кроме владельцев сайта)
# ===========================================================================
Write-Host "  закрытие сайта: изменения только через приложение" -ForegroundColor Cyan
# участники сайта — «Участь» (добавлять и править записи, где есть права), а не «Редагування»:
# нельзя создавать и удалять списки, менять колонки, представления и страницы
$ctx = Get-PnPContext; $ra = $ctx.Web.RoleAssignments; $ctx.Load($ra); Invoke-PnPQuery
foreach ($a in $ra) { $ctx.Load($a.Member); $ctx.Load($a.RoleDefinitionBindings) }; Invoke-PnPQuery
$memRoles = @(); foreach ($a in $ra) { if ($a.Member.Title -eq $members.Title) { $memRoles = @($a.RoleDefinitionBindings | Where-Object { -not $_.Hidden } | ForEach-Object { $_.Name }) } }
foreach ($x in $memRoles) { if ($x -ne $ROLE_EDIT) { Set-PnPGroupPermissions -Identity $members.Title -RemoveRole $x | Out-Null; Write-Host "  $($members.Title) : снят уровень «$x» на сайте" } }
if ($memRoles -notcontains $ROLE_EDIT) { Set-PnPGroupPermissions -Identity $members.Title -AddRole $ROLE_EDIT | Out-Null; Write-Host "  $($members.Title) : «$ROLE_EDIT» на сайте" }
# страницы и файлы сайта — только чтение (страницу приложения никто, кроме владельцев, не правит)
foreach ($lib in @("SitePages", "SiteAssets", "Shared Documents")) {
    if (Get-PnPList -Identity $lib -ErrorAction SilentlyContinue) { Set-ListRoles $lib @{ $members.Title = $ROLE_READ; $PMO_GROUP = $ROLE_READ } }
}
# списки портала не видны в «Вміст сайту» и поиске по сайту; приложение и владельцы открывают их по адресу
$portalLists = @("Lists/Projects", "Lists/StatusReports", "Lists/RisksIssues", "Lists/KeyChanges", "Lists/ProjectComments", "Lists/ProjectTeam", "Lists/ReportApprovals", "Lists/ProjectAssignments", "Lists/NotifyState", "Lists/ProjectState") + $(if ($Feedback) { @("Lists/Feedback", "Lists/FeedbackPublic") } else { @() })
foreach ($u in $portalLists) {
    $l = Get-PnPList -Identity $u -Includes Hidden
    if (-not $l.Hidden) { Set-PnPList -Identity $u -Hidden $true | Out-Null; Write-Host "    скрыт список $u" }
}
# меню сайта SharePoint выключено: навигация — только в приложении
$w = Get-PnPWeb -Includes QuickLaunchEnabled
if ($w.QuickLaunchEnabled) { $w.QuickLaunchEnabled = $false; $w.Update(); Invoke-PnPQuery; Write-Host "    меню сайта SharePoint выключено" }

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
