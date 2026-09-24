---
description: Проверить и развернуть текущую ветку на тестовый сайт
---
1. `pwsh -NoLogo -File tests/Test-Scripts.ps1` — при ошибках остановись и покажи их.
2. `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action deploy`
3. `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync-dryrun`, затем без DryRun: `-Action sync`.
4. Кратко сообщи: что создано или обновлено, предупреждения, что проверить на сайте.
