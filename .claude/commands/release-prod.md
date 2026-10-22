---
description: Выпуск на прод (с подтверждением человека)
---
1. Убедись, что ветка слита в main, рабочая копия чистая (`git status`), тесты проходят.
2. Покажи изменения с прошлого выпуска: `git log` и раздел CHANGELOG.md.
3. Выполни `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action sync-dryrun` и покажи итог.
4. Спроси: «Выкатываю на прод?» — и жди явного «да».
5. Только после «да»: если в выпуске менялась синхронизация — сначала `scripts/Publish-Runbook.ps1` (среда `PowerShell-7.6-PnP`; после выпуска проверить первое задание прода); затем `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env prod -Action deploy -ConfirmProduction` (откроется браузер для входа), затем `-Env prod -Action sync -ConfirmProduction`. Приложение SPFx на прод `Deploy-App.ps1` пока не ставит (только сайт `…-test`; каталог тенанта — этап 4).
6. Синхронизация прода в Azure (первый выпуск; только после «да», вход `Connect-AzAccount … -UseDeviceAuthentication`): `scripts/New-PMOAutomation.ps1 -CacheEnvs test,prod`, `scripts/Grant-PMOAutomation.ps1 -SiteUrl https://<тенант>.sharepoint.com/sites/ppm -DeployClientId <PMO Deploy> -SkipAppRoles`, `scripts/Publish-Runbook.ps1`, `scripts/Set-AzureSchedule.ps1 -SiteUrl https://<тенант>.sharepoint.com/sites/ppm -Env prod -Live -AlertEmail <e-mail>`.
7. Перенеси раздел «Не выпущено» CHANGELOG.md в `## <версия> — <дата>`, где версия — `solution.version` из `spfx/config/package-solution.json`; поставь тег `git tag v<версия>` и сообщи итог.
