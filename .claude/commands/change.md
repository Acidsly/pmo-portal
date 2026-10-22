---
description: Внести изменение в портал по описанию (прототип, скрипты, документация, тест-сайт)
argument-hint: <описание изменения>
---
Требуется изменение портала: $ARGUMENTS

Действуй строго по разделу «Порядок работы над изменением» в CLAUDE.md:
1. Разбери требование и перечисли, какие файлы и компоненты SharePoint оно затрагивает. Если есть неоднозначность — задай один уточняющий вопрос и остановись.
2. Создай ветку `change/<номер задачи>-<кратко>` от свежего `origin/main`. Средняя и сложная задача — сначала план и одобрение (`.claude/rules/workflow.md`).
3. Внеси согласованные правки в прототип, `scripts/`, `docs/DEPLOYMENT.md`, `CHANGELOG.md`; при смене типа или удалении поля — добавь миграцию без потери данных.
4. Запусти `pwsh -NoLogo -File tests/Test-Scripts.ps1` и `scripts/spfx.sh npm run test:unit`, перед коммитом кода приложения — `scripts/spfx.sh npm run build`; исправь ошибки.
5. Разверни на тест: `-Env test -Action deploy` → если менялось приложение — `-Env test -Action app` → `-Env test -Action sync-dryrun` → `sync`; если менялся `Invoke-PMOSync.ps1` или `PMO.Common.ps1` — `scripts/Build-Runbook.ps1`, коммит, `scripts/Publish-Runbook.ps1 -Env test` (никогда `-Env prod` из ветки). Перед развёртыванием — `git rebase origin/main`.
6. Закоммить и покажи итог: что изменено, результат тестов и развёртывания, что проверить руками. На прод не выкатывай. После «да» — `git push -u origin <ветка>` и PR в `main` по шаблону `.github/pull_request_template.md`.
