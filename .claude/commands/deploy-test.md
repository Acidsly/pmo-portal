---
description: Проверить и развернуть текущую ветку на тестовый сайт
---
1. `pwsh -NoLogo -File tests/Test-Scripts.ps1` и `scripts/spfx.sh npm run test:unit` — при ошибках остановись и покажи их.
2. `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action deploy`; если менялось приложение — затем `-Env test -Action app`.
3. `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync-dryrun`, затем без DryRun: `-Action sync`.
4. Если менялся `Invoke-PMOSync.ps1` или `PMO.Common.ps1` — `scripts/Build-Runbook.ps1`, коммит, `scripts/Publish-Runbook.ps1` (иначе Azure Automation продолжит прежний код).
5. Кратко сообщи: что создано или обновлено, предупреждения, что проверить на сайте.
