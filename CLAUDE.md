# Портфель проєктів — инструкции для Claude Code

Портал управления портфелем проектов компании на SharePoint Online (Microsoft 365).
Общайся с пользователем по-русски. Значения полей, названия списков и представлений на сайте — украинские (язык сайта по умолчанию).

## Структура репозитория

| Путь | Что это |
|---|---|
| `scripts/Deploy-PMO.ps1` | Развёртывание и обновление всех компонентов SharePoint. Идемпотентен |
| `scripts/Invoke-PMOSync.ps1` | Логика по расписанию: отчёт → карточка, журнал, архив, комментарии, права по иерархии, напоминания, правки карточки → журнал |
| `scripts/Register-PMOApps.ps1` | Регистрация приложений Entra ID (выполняет человек) |
| `scripts/Invoke-Env.ps1` | **Единственный способ запускать скрипты против SharePoint**: берёт параметры из `config/environments.json` |
| `scripts/Seed-TestData.ps1` | Демонстрационные данные для тестового сайта (`-Env test -Action seed`). На прод не запускается |
| `spfx/` | Приложение SPFx (React) по прототипу: `logic/` — правила с тестами, `data/` — чтение SharePoint, `components/`, `pages/`. Спецификация и планы — `docs/superpowers/` |
| `scripts/spfx.sh` | Команды в `spfx/` под Node 22: `scripts/spfx.sh npm run test:unit`, `scripts/spfx.sh npm run build` |
| `scripts/Deploy-App.ps1` | Установка приложения на сайт (`-Env test -Action app`): каталог приложений сайта, страница `Portal` на весь экран — главная |
| `tests/cases/` | Общие тест-векторы: их проверяют и `tests/Test-Scripts.ps1`, и Jest в `spfx/test` |
| `tests/Test-Scripts.ps1` | Проверки без доступа к SharePoint. Запускай после каждого изменения |
| `prototype/pmo-prototype.html` | Прототип интерфейса — эталон UX ([docs/PROTOTYPE.md](docs/PROTOTYPE.md), скриншоты в `docs/img/`) |
| `docs/SPEC.md` | Полное техническое задание — обновляй вместе с изменением требований |
| `docs/USER-GUIDE.{uk,en,ru}.md` | Инструкция пользователя — источник «Довідки» в приложении. Меняешь интерфейс — меняй все три и запускай `scripts/spfx.sh npm run guide`; Jest сверяет, что разделы совпадают |
| `docs/DEPLOYMENT.md` | Документация для людей: установка, доступ, синхронизация |
| `CHANGELOG.md` | Журнал изменений — обновляй в каждом изменении |

## Окружения

- `test` — `/sites/pmo-test`, вход по сертификату, можно работать самостоятельно.
- `prod` — `/sites/pmo`, развёртывание только после явного «да» пользователя в чате; вход через браузер (человек подтверждает).

```bash
pwsh -NoLogo -File tests/Test-Scripts.ps1
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action deploy
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync-dryrun
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action seed          # демонстрационные данные, повторный запуск ничего не дублирует
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action sync-dryrun
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action deploy -ConfirmProduction   # только после подтверждения
```

## Порядок работы над изменением

1. **Анализ.** Уточни требование, если оно неоднозначно. Найди все места, которых оно касается: прототип, поля и представления в `Deploy-PMO.ps1`, логика в `Invoke-PMOSync.ps1`, `docs/DEPLOYMENT.md`.
2. **Ветка.** `git switch -c change/<кратко>`.
3. **Реализация.** Меняй согласованно прототип, скрипты и документацию — одно требование не должно жить только в одном месте.
4. **Проверки.** `tests/Test-Scripts.ps1` и `scripts/spfx.sh npm run test:unit` должны проходить. Правило, которое есть и в синхронизации, и в приложении, проверяется общими векторами `tests/cases/*.json`.
5. **Тест-сайт.** `-Env test -Action deploy`, затем `sync-dryrun` и `sync`. Проверь результат и перечисли пользователю, что изменилось на сайте.
6. **Коммит.** Понятное сообщение на русском, запись в `CHANGELOG.md`.
7. **Ворота 1 — ревью человеком.** Покажи diff и итоги теста. `git push` и слияние — только после «да».
8. **Ворота 2 — прод.** `-Env prod -Action deploy -ConfirmProduction` — только после отдельного «да». Перед этим `-Env prod -Action sync-dryrun`.

## Правила, которые нельзя нарушать

- **Имена переменных PowerShell не различаются по регистру**: `$p` и `$P` — одна переменная. Не называй так коллекцию и переменную цикла; `tests/Test-Scripts.ps1` это проверяет.
- **Даты «только дата»** синхронизация пишет как полдень UTC (`ToSpDate`) и читает через `DateOnly`, который понимает и полдень UTC, и полночь по поясу сайта (значения из форм).

- **Идемпотентность.** Любой скрипт можно запустить повторно без дублей. Новые поля добавляй через функцию `F`, представления — через `Ensure-View`.
- **Внутренние имена полей не переименовываются** (`pmStatus`, `srRAG`, …). Меняются только отображаемые названия и переводы (uk / en / ru).
- **Данные не теряются.** Удаление или смена типа поля — только через блок миграции в `Deploy-PMO.ps1` с переносом значений. Никогда не удаляй сайт, список или элементы.
- **Значения выбора** (статусы, RAG, типы, приоритеты) одинаковы в прототипе, `Deploy-PMO.ps1`, CAML-представлениях, JSON-форматировании и `Invoke-PMOSync.ps1`. Меняешь в одном — меняй везде.
- **Секреты.** Не читай и не выводи `certs/`, `*.pfx`, `.env`, пароли. Не коммить `config/environments.json`.
- **Прод** — только по явному подтверждению в чате, даже если команда разрешена.
- **Приложение SPFx не пишет** ключевые показатели, журнал, права и `pmoAcl` — только синхронизация; отчёт из приложения сохраняется с `srApplied = нет`.

## Модель данных (кратко)

- **Проєкти** (`Lists/Projects`): `pmType`, `pmPriority`, `pmManager` (PM), `pmOwner`, `pmStakeholders` (несколько пользователей), `pmStatus`, `pmRAG`, `pmProgress`, `pmStart`, `pmGoLive`, `pmPlanEnd`, `pmForecastEnd`, `pmArchivedAt`, `pmBudget`, `pmActualCost`, `pmLastUpdate`, `pmLastReport`, `pmLastComment`, `pmLoop`, `pmCode`, `pmDepartment`, `pmDescription`; служебные `pmoAcl`, `pmAccess` (кто и с каким правом — JSON для «Доступ до картки») и `pmEditLog` (правки карточки из приложения до переноса в журнал).
- **Статус-звіти** (`Lists/StatusReports`): `srProject`, `srDate`, `srPeriod`, оценки `srSchedule` / `srBudget` / `srResources`, вычисляемое `srRAG`, ключевые показатели `srStatus` / `srType` / `srProgress` / `srStart` / `srGoLive` / `srPlanEnd` / `srForecastEnd` / `srActualCost`, `srKeyReason`, `srDone` / `srNext` / `srIssues`, `srDecision` / `srDecisionText`, копии `srProjectType` / `srProjectPriority`, служебные `srApplied`, `pmoAcl`.
- **Ризики та проблеми** (`Lists/RisksIssues`): `riProject`, `riType`, `riProbability` 1–5, `riImpact` 1–5, вычисляемое `riScore` = P × I, `riOwner`, `riStatus`, `riDue`, `riMitigation`, копии `riProjectType` / `riProjectPriority`.
- **Зміни показників** (`Lists/KeyChanges`) — журнал; **Коментарі** (`Lists/ProjectComments`); **Відгуки** (`Lists/Feedback`, только на тесте, `Deploy-PMO.ps1 -Feedback`): `fbText`, `fbScreen`, `fbDevice`, `fbStatus` (Новий / Прийнято / Відхилено / Зроблено), `fbAnswer`, скриншоты — вложения; каждый видит только свои, PMO — все. Остатки прежнего интерфейса на уже развёрнутых сайтах (`Dashboard.aspx`, `Lists/PortfolioStats`, `pmKState` / `pmKDates` / `pmKMoney` / `pmCardInfo`, форматирование столбцов) убирает раздел 9 `Deploy-PMO.ps1` (`#region legacy-cleanup`) — см. конец `docs/DEPLOYMENT.md`; в остальной код их не возвращай.

## Бизнес-правила

- Статусы проекта: Ініціація, Планування, Реалізація, Призупинено, Скасовано, Архівний. Группировок по статусам нет.
- Ключевые показатели (статус, состояние, тип, %, даты, затраты) меняются **только через статус-отчёт**; в форме карточки скрыты.
- Статус «Завершено» в отчёте → проект получает «Архівний» и дату архивации, уходит в архив.
- Общее состояние отчёта — **худшая из трёх оценок**: хотя бы одна красная → Червоний; иначе хотя бы одна жёлтая → Жовтий; иначе Зелений. Состояние проекта = состояние последнего отчёта.
- Оценка риска = вероятность × влияние: 15–25 высокий, 8–14 средний, 1–7 низкий.
- Доступ: править проект, отчёты и риски — **только PM**; руководители PM (Entra ID), собственник, стейкхолдеры и их руководители — просмотр и комментарии; `PMO-адміністратори` — просмотр всех проектов и создание новых; владельцы сайта — всё. Проект в архиве — только просмотр для всех. Права и `pmAccess` выдаёт `Invoke-PMOSync.ps1` (`Get-Access`, векторы `tests/cases/acl.json`).
- Порядок колонок во всех списках: стратегический (щит с мечом), приоритет, название, остальные.

## Как проверять изменения прототипа

Открой `prototype/pmo-prototype.html` в браузере. Данные прототипа живут в памяти страницы (или в базе артефакта claude.ai). После изменения экранов пересними скриншоты в `docs/img/`. Проверь сценарии: новый проект, редактирование, статус-отчёт с изменением показателей, архив, риск, комментарий, «войти как другой пользователь», светлая и тёмная темы, три языка.
