---
description: Выпуск на прод (с подтверждением человека)
---
0. Только сессия владельца (в `config/environments.json` есть `prod`). У разработчика — остановись и объясни, что выпуск делает владелец.
1. Убедись, что ветка слита в main через PR, локальный `main` = `origin/main` (`git switch main && git pull`), рабочая копия чистая, тесты проходят.
2. Покажи изменения с прошлого выпуска: `git log` и раздел CHANGELOG.md.
3. Выполни `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action sync-dryrun` и покажи итог.
4. Спроси: «Выкатываю на прод?» — и жди явного «да».
5. Только после «да»: если в выпуске менялась синхронизация — сначала `scripts/Publish-Runbook.ps1 -Env prod` (только из `main`, совпадающего с `origin/main`; среда `PowerShell-7.6-PnP`; после выпуска проверить первое задание прода); затем `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action deploy -ConfirmProduction` (откроется браузер для входа), затем `-Env prod -Action app -ConfirmProduction` (приложение — каталог приложений сайта `/sites/ppm`), затем `-Env prod -Action sync -ConfirmProduction`. Если выпуск меняет права (новые роли, модель прав) — `-Env prod -Action rebuild-permissions -ConfirmProduction`, а до и после — `-Action acl-export` и сравнение. Порядок конкретного выпуска (что раньше — поля или синхронизация) — в `docs/DEPLOYMENT.md`, «Обновление с предыдущей версии скрипта».
6. Синхронизация прода в Azure (первый выпуск; только после «да», вход `Connect-AzAccount … -UseDeviceAuthentication`): `scripts/New-PMOAutomation.ps1 -CacheEnvs test,prod`, `scripts/Grant-PMOAutomation.ps1 -SiteUrl https://<тенант>.sharepoint.com/sites/ppm -DeployClientId <PMO Deploy> -SkipAppRoles`, `scripts/Publish-Runbook.ps1`, `scripts/Set-AzureSchedule.ps1 -SiteUrl https://<тенант>.sharepoint.com/sites/ppm -Env prod -Live -AlertEmail <e-mail>`.
7. Перенеси раздел «Не выпущено» CHANGELOG.md в `## <версия> — <дата>`, где версия — `solution.version` из `spfx/config/package-solution.json`; поставь тег `git tag v<версия>` и сообщи итог.
