# Портфель проєктів

Портал управления портфелем проектов на SharePoint Online.

- Как развернуть и как всё устроено — [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Как работает Claude Code с этим репозиторием — [CLAUDE.md](CLAUDE.md)
- Прототип интерфейса — [prototype/pmo-prototype.html](prototype/pmo-prototype.html)
- История изменений — [CHANGELOG.md](CHANGELOG.md)

## Быстрый старт

```bash
cp config/environments.example.json config/environments.json   # заполнить; файл не попадает в git
pwsh -NoLogo -File tests/Test-Scripts.ps1
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action deploy
```

Изменения вносятся через Claude Code по порядку работы из `CLAUDE.md`: ветка → тест-сайт → ревью → прод.
