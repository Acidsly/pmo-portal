# Работа над PPM в команде

Для разработчика, который ведёт задачи с Claude Code, и для владельца, который принимает их работу. Правила, которые соблюдает Claude, — `CLAUDE.md` и `.claude/rules/` (подхватываются автоматически).

## Роли

- **Владелец** — тенант, сайты, Entra ID, Azure, прод, слияние в `main`, выпуски.
- **Разработчик** — задачи из GitHub Issues: ветка → код и тесты → проверка на тестовом сайте → PR. Доступа к проду и Azure нет — и не нужно.

Таблица «кто что делает» — [.claude/rules/team.md](.claude/rules/team.md).

## Подключение разработчика

### Что делает владелец (один раз)

1. **GitHub.** Добавить разработчика в репозиторий с ролью **Write** (не Admin / Maintain) и включить защиту `main` — см. «Защита main» ниже.
2. **Сертификат PMO Dev** — права только на тестовый сайт:
   ```bash
   pwsh -NoLogo -File scripts/Register-PMOApps.ps1 -Stage Dev -Tenant smarthrua.onmicrosoft.com -SiteUrl https://smarthrua.sharepoint.com/sites/pmo-test -DeployClientId <PMO Deploy> -OutPath certs/dev
   ```
   Передать разработчику `PMO Dev.pfx` и ClientId, пароль — отдельным каналом. Отозвать доступ — удалить приложение «PMO Dev» в Entra ID. Принятый риск: User.Read.All — чтение каталога Entra ID всего тенанта (нужно синхронизации для руководителей).
3. **Учётная запись M365** разработчика — участник тестового сайта (чтобы открывать портал в браузере); на прод — не добавлять.
4. По желанию — права на публикацию `PMO-Sync-Test`: Azure RBAC на уровне runbook (`Automation Contributor` на ресурс `aa-pmo-sync/runbooks/PMO-Sync-Test`) + `Automation Job Operator` на учётную запись. Без этого runbook теста публикует владелец после слияния.

### Что делает разработчик (один раз, Mac)

1. Claude (вкладка Code) → **Local** → папка клона репозитория. Попросить: «Проверь и установи зависимости по CONTRIBUTING.md»: git, Homebrew, `brew install powershell node@22`, `Install-Module PnP.PowerShell -Scope CurrentUser`.
2. При первом запуске принять плагин **superpowers** (предложит `.claude/settings.json`).
3. `cp config/environments.dev.example.json config/environments.json`, вписать ClientId PMO Dev; файл `PMO Dev.pfx` → `certs/`.
4. Пароль сертификата — в «Связку ключей»: `security add-generic-password -a "$USER" -s PMO_DEV_CERT_PASSWORD -w`.
5. Проверка: `pwsh -NoLogo -File tests/Test-Scripts.ps1`, `scripts/spfx.sh npm ci`, `scripts/spfx.sh npm run test:unit`, затем `/sync-dryrun test`.

Режим разрешений в Code — «Ask» или «Accept edits», не обход разрешений.

## Цикл задачи

1. Задача в GitHub Issues (пункт [docs/ROADMAP.md](docs/ROADMAP.md), критерии приёмки).
2. `/change <номер и описание задачи>` — Claude ведёт по «Порядку работы» и [.claude/rules/workflow.md](.claude/rules/workflow.md): для средней и сложной задачи сначала план и одобрение.
3. Проверка на тестовом сайте (`/deploy-test`); перед этим — `git rebase origin/main`.
4. `git push -u origin change/<…>` и PR в `main` по шаблону. CI (`validate`) должен быть зелёным.
5. Владелец ревьюит и сливает (squash или merge). Прод выкатывает владелец (`/release-prod`), включая `Publish-Runbook.ps1 -Env prod`.

## Защита main (GitHub)

Settings → Rules → Rulesets → **New branch ruleset**: имя `main`, Enforcement **Active**, Target — default branch.

- Restrict deletions; Block force pushes.
- Require a pull request before merging: 1 approval, **Require review from Code Owners**, Dismiss stale approvals.
- Require status checks to pass: `test` и `spfx` (задания `.github/workflows/validate.yml`), «Require branches to be up to date».
- Bypass list: **Repository admin** — владелец может слить свой PR без второго ревьюера (свой PR сам себе не одобрить).

Для приватного репозитория на личном бесплатном аккаунте GitHub правила не применяет — нужен GitHub Pro или организация (Team). Планируемый перенос в корпоративный GitHub это решает; там же — Environments с подтверждением для прода.

`.github/CODEOWNERS` делает владельца обязательным ревьюером; без защиты main он только подсказывает.

## Конфликты: как их не создавать

| Файл | Правило |
|---|---|
| Любой | короткие ветки (дни), `git rebase origin/main` перед проверкой на тесте и перед PR |
| `CHANGELOG.md` | только «Не выпущено», строка сверху; `merge=union` в `.gitattributes` склеивает обе стороны при локальном rebase (кнопка слияния на GitHub его не знает — поэтому rebase до PR) |
| `runbooks/Invoke-PMOSync.ps1` | собирается, руками не сливается: любую сторону → `scripts/Build-Runbook.ps1`; совпадение проверяют тесты и CI |
| `spfx/config/package-solution.json` (версия), `docs/RELEASES.*` | последний коммит ветки после rebase: версия = следующая после `main` |
| `docs/USER-GUIDE.*`, прототип, `i18n/strings.ts` | генерируемое (`npm run guide`, `npm run extract`) — после rebase пересобрать, а не сливать руками |
| `Deploy-PMO.ps1`, `Invoke-PMOSync.ps1` | крупные файлы — задачи владельца и разработчика по возможности в разных разделах; пересечение — обсудить до начала |

## Чего не делать

- Прод, Azure прода, Entra ID, `Register-PMOApps.ps1`, `config/*.json` с e-mail сотрудников — только владелец.
- Не коммитить `config/environments.json`, `certs/`, `*.pfx`.
- Не удалять сайты, списки, элементы; поля — только добавлять (смена типа — миграция).
- Не сливать в `main` и не пушить в `main` напрямую.
