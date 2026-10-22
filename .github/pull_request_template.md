## Задача

Closes #

## Что изменено

-

## Проверки

- [ ] `pwsh -NoLogo -File tests/Test-Scripts.ps1`
- [ ] `scripts/spfx.sh npm run test:unit`
- [ ] `scripts/spfx.sh npm run build` (если менялось приложение)
- [ ] Найденные ошибки покрыты тестом, который без исправления падает
- [ ] Ветка перебазирована на `main`, `runbooks/Invoke-PMOSync.ps1` пересобран (если менялась синхронизация)

## Согласованность

- [ ] Прототип, скрипты, `docs/SPEC.md` / `docs/DEPLOYMENT.md` — по необходимости
- [ ] `docs/USER-GUIDE.{uk,en,ru}.md` + `npm run guide` (если менялся интерфейс)
- [ ] Версия и `docs/RELEASES.{uk,en,ru}.md` — последним коммитом (если менялось приложение)
- [ ] `CHANGELOG.md` — «Не выпущено»
- [ ] Поля и списки только добавлены; смена типа / удаление — с миграцией

## Тестовый сайт

Что развёрнуто (`deploy` / `app` / `PMO-Sync-Test`) и что проверено руками:

## Выкладка на прод (для владельца)

Порядок: `Publish-Runbook.ps1 -Env prod` / `deploy` / `app` / `sync` / `rebuild-permissions` — что нужно и в каком порядке:
