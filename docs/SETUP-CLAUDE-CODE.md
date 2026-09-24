# Подключение проекта к Claude Code (приложение Claude → вкладка Code)

Все сессии запускайте с окружением **Local** и папкой проекта: только так Claude Code видит сертификаты и может подключаться к SharePoint.

## Один раз на Mac
1. Открыть вкладку **Code** → **Local** → выбрать папку проекта.
2. Первой задачей попросить: «Проверь и установи зависимости проекта по docs/SETUP-CLAUDE-CODE.md». Нужны: git (`xcode-select --install`), Homebrew, `brew install powershell`, `brew install node`, модуль `Install-Module PnP.PowerShell -Scope CurrentUser`.
3. Зарегистрировать приложения Entra ID — в терминале (встроенном терминале Code или «Терминале»), нужен вход администратора в браузере. Если вход должен пройти в определённом браузере (не в браузере по умолчанию), добавьте `-DeviceLogin`: скрипт выведет код и адрес, откройте его в нужном браузере:
   - `pwsh -NoLogo -File scripts/Register-PMOApps.ps1 -Stage Deploy -Tenant <тенант>.onmicrosoft.com`
   - `pwsh -NoLogo -File scripts/Register-PMOApps.ps1 -Stage Automation -Tenant <тенант>.onmicrosoft.com -OutPath certs`
4. `cp config/environments.example.json config/environments.json` и заполнить ClientId и пути к сертификатам.
5. Пароли сертификатов — в «Связку ключей» (скрипты берут их оттуда сами):
   `security add-generic-password -a "$USER" -s PMO_AUTOMATION_CERT_PASSWORD -w`
6. В Code: `/deploy-test`.
7. После создания тестового сайта — приложение синхронизации:
   `pwsh -NoLogo -File scripts/Register-PMOApps.ps1 -Stage Sync -Tenant <тенант>.onmicrosoft.com -SiteUrl https://<тенант>.sharepoint.com/sites/pmo-test -DeployClientId <PMO Deploy> -OutPath certs`
   → заполнить `test.Sync` в конфиге, пароль в «Связку ключей» под именем из `CertificatePasswordEnv` → `/sync-dryrun test`.

## Работа
- Изменение: `/change <описание>` → проверка на тестовом сайте → «да» → push.
- Выпуск: `/release-prod` → подтверждение → развёртывание (вход в браузере).
- Режим разрешений в Code: «Ask» или «Accept edits». Режим обхода разрешений не включайте — прод и push должны спрашивать подтверждение.
