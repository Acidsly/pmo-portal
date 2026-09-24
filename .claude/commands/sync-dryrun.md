---
description: Пробный прогон синхронизации (ничего не меняет)
argument-hint: test | prod
---
Запусти `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env $ARGUMENTS (по умолчанию test) -Action sync-dryrun` и кратко перечисли: сколько отчётов будет применено, какие записи журнала появятся, у скольких элементов изменятся права, предупреждения.
