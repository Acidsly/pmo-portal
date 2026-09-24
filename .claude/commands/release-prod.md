---
description: Выпуск на прод (с подтверждением человека)
---
1. Убедись, что ветка слита в main, рабочая копия чистая (`git status`), тесты проходят.
2. Покажи изменения с прошлого выпуска: `git log` и раздел CHANGELOG.md.
3. Выполни `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action sync-dryrun` и покажи итог.
4. Спроси: «Выкатываю на прод?» — и жди явного «да».
5. Только после «да»: `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action deploy -ConfirmProduction` (откроется браузер для входа), затем `-Env prod -Action sync -ConfirmProduction`.
6. Поставь тег версии из CHANGELOG.md (`git tag vX.Y.Z`) и сообщи итог.
