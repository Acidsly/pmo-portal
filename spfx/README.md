# pmo-portal — додаток SPFx порталу «PPM — Портфель проєктів»

Веб-частина `PmoPortalWebPart` (SPFx 1.23.2, React 17.0.1, TypeScript ~5.8, Heft 1.2.17, Node 22) на сторінці `SitePages/Portal.aspx` (`SingleWebPartAppPage`), пакет `pmo-portal.sppkg`. Працює від імені користувача через SharePoint REST. Архітектура — [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md#6-додаток-spfx), модель даних — [../docs/DATA-MODEL.md](../docs/DATA-MODEL.md), еталон інтерфейсу — `../prototype/pmo-prototype.html`.

## Будова

| Папка (`src/webparts/pmoPortal/`) | Що це |
|---|---|
| `logic/` | чисті правила (Jest, спільні з синхронізацією вектори `../tests/cases/*.json`) |
| `data/` | `SpRepo` — читання й запис SharePoint REST, тіла записів, значення форм за регіональними налаштуваннями сайту |
| `components/`, `pages/`, `panels/` | інтерфейс за прототипом: шапка, таблиці, головна, списки, картка, форми, сповіщення, «Довідка» |
| `i18n/` | `strings.ts` (згенеровано з прототипу), `values.ts` — переклади значень вибору |
| `theme/` | `prototype.scss` (згенеровано з прототипу), `overrides.scss` |
| `help/` | `guide.ts`, `releases.ts`, `overview.ts` — згенеровано |

## Згенеровані файли (вручну не правляться)

| Команда | Джерело → результат |
|---|---|
| `npm run extract` | `../prototype/pmo-prototype.html` → `i18n/strings.ts`, `theme/prototype.scss` |
| `npm run guide` | `../docs/USER-GUIDE.{uk,en,ru}.md` → `help/guide.ts`; `../docs/RELEASES.{uk,en,ru}.md` → `help/releases.ts` («Що змінилося») |
| `npm run overview` | `../docs/overview/overview.uk.html` → `help/overview.ts` |

## Команди

З кореня репозиторію, під Node 22 (`scripts/spfx.sh` підставляє `node@22` з Homebrew):

```bash
scripts/spfx.sh npm ci
scripts/spfx.sh npm run test:unit   # Jest: правила, рендер у jsdom, прототип у jsdom
scripts/spfx.sh npm run build       # перед комітом: лінтер збірки суворіший за tsc
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action app   # встановлення на тестовий сайт
```

Тести — `test/`; правило, яке є і в синхронізації, і в додатку, перевіряється спільними векторами `../tests/cases/*.json`.
