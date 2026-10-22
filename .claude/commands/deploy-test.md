---
description: Проверить и развернуть текущую ветку на тестовый сайт
---
0. Ветка перебазирована на `origin/main` (`git fetch && git rebase origin/main`) — иначе на общий тестовый сайт уедет код без чужих изменений.
1. `pwsh -NoLogo -File tests/Test-Scripts.ps1` и `scripts/spfx.sh npm run test:unit` — при ошибках остановись и покажи их.
2. `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action deploy`; если менялось приложение — затем `-Env test -Action app`.
3. `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync-dryrun`, затем без DryRun: `-Action sync`.
4. Если менялся `Invoke-PMOSync.ps1` или `PMO.Common.ps1` — `scripts/Build-Runbook.ps1`, коммит, `scripts/Publish-Runbook.ps1 -Env test` (runbook `PMO-Sync-Test`; прод-runbook `PMO-Sync` не трогать).
5. Кратко сообщи: что создано или обновлено, предупреждения, что проверить на сайте.
