# SPFx, этап 1: каркас и главная — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Приложение SPFx на `pmo-test` открывается главной страницей сайта на весь экран и показывает шапку (вкладки, UA/EN/RU, тема) и главную 1:1 с прототипом по данным пользователя.

**Architecture:** Решение SPFx 1.23.2 (Heft) в `spfx/`. Чистая логика (`logic/`) и сопоставление данных (`data/map.ts`) покрыты Jest; общие тест-векторы в `tests/cases/*.json` читают и Jest, и `tests/Test-Scripts.ps1`. React 17 рисует разметку с классами прототипа; CSS прототипа переносится генератором и изолируется под `.pmo-app`. Данные — REST SharePoint от имени пользователя.

**Tech Stack:** SPFx 1.23.2, Node 22 (Homebrew `node@22`), React 17.0.1, TypeScript, Jest 29 + ts-jest, PnP.PowerShell 3.4.1.

**Spec:** `docs/superpowers/specs/2026-09-24-spfx-portal-design.md`

## Global Constraints

- Node.js **22.x** (`>=22.14.0 <23`), только через `scripts/spfx.sh` — системный Node 26 не трогаем.
- `@microsoft/generator-sharepoint@1.23.2`, React **17.0.1** ровно (`--save-exact`).
- Значения выбора — украинские, как в `CLAUDE.md` и `Deploy-PMO.ps1`: `Зелений / Жовтий / Червоний`; статусы `Ініціація, Планування, Реалізація, Призупинено, Скасовано, Архівний`; «Завершено» — только в отчёте.
- Внутренние имена полей — из `CLAUDE.md` («Модель данных»); не переименовываются.
- Даты «только дата»: полдень UTC — дата UTC; иначе +12 часов (как `DateOnly` в `Invoke-PMOSync.ps1`).
- Всё, что меняет SharePoint, — только `-Env test`. Прод и каталог тенанта — вне этого этапа.
- Секреты (`certs/`, пароли) не читать и не выводить.
- Коммиты на русском, с `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; работа в ветке `change/spfx-phase1`.

## Структура файлов этапа

```
scripts/spfx.sh                               запуск команд в spfx/ под Node 22
scripts/Deploy-App.ps1                        сборка -> каталог приложений сайта -> страница Portal -> главная
scripts/Invoke-Env.ps1                        + действие "app"
tests/cases/rag.json, tests/cases/dates.json  общие тест-векторы
tests/Test-Scripts.ps1                        читает тест-векторы вместо встроенных случаев
spfx/                                         решение SPFx (сгенерировано, затем дополнено)
  jest.config.js, tsconfig.jest.json          модульные тесты вне сборки Heft
  test/*.test.ts                              тесты логики и сопоставления
  tools/extract-prototype.mjs                 генератор словарей и CSS из прототипа
  src/webparts/pmoPortal/
    PmoPortalWebPart.ts (+ .manifest.json)
    logic/rag.ts, dates.ts, status.ts, overlay.ts, dynamics.ts
    data/types.ts, map.ts, SpRepo.ts
    i18n/strings.ts (генерируется), i18n.ts
    theme/prototype.scss (генерируется), theme.ts
    components/App.tsx, Header.tsx, Icons.tsx, Bits.tsx, Donut.tsx, Dynamics.tsx, Wp.tsx, SimpleTable.tsx
    pages/Home.tsx, Soon.tsx
.github/workflows/validate.yml                + job spfx
```

---

### Task 1: Node 22, каркас решения SPFx, модульные тесты

**Files:**
- Create: `scripts/spfx.sh`, `spfx/**` (генератор), `spfx/jest.config.js`, `spfx/tsconfig.jest.json`, `spfx/test/smoke.test.ts`
- Modify: `.gitignore`, `spfx/package.json` (scripts, devDependencies), `spfx/src/webparts/pmoPortal/PmoPortalWebPart.manifest.json`, `spfx/config/package-solution.json`

**Interfaces:**
- Produces: `scripts/spfx.sh <команда>` — выполняет команду в `spfx/` под Node 22; `npm run test:unit` — Jest; `npm run build` — `.sppkg` в `spfx/sharepoint/solution/`.

- [ ] **Step 1: Установить Node 22 рядом с текущим**

Run: `brew install node@22` (keg-only, не меняет системный `node`).
Expected: `"$(brew --prefix node@22)/bin/node" -v` → `v22.x`.

- [ ] **Step 2: Обёртка `scripts/spfx.sh`**

```bash
#!/usr/bin/env bash
# Запускает команду в spfx/ под Node 22 (SPFx 1.23 требует >=22.14 <23). Системный Node не трогается.
set -euo pipefail
if command -v brew >/dev/null 2>&1 && [ -x "$(brew --prefix node@22 2>/dev/null)/bin/node" ]; then
  export PATH="$(brew --prefix node@22)/bin:$PATH"
fi
node -v | grep -q '^v22\.' || { echo "Нужен Node 22: brew install node@22" >&2; exit 1; }
cd "$(dirname "$0")/../spfx"
exec "$@"
```

Run: `chmod +x scripts/spfx.sh`

- [ ] **Step 3: Сгенерировать решение во временной папке и перенести в `spfx/`**

Сначала: `export PATH="$(brew --prefix node@22)/bin:$PATH"; npx --yes -p yo -p @microsoft/generator-sharepoint@1.23.2 -- yo @microsoft/sharepoint --help` — сверить имена флагов. Если генератор всё равно задаёт вопрос, отвечать: тип — WebPart, имя — PmoPortal, шаблон — React.

```bash
T="$(mktemp -d)"; export PATH="$(brew --prefix node@22)/bin:$PATH"
( cd "$T" && npx --yes -p yo -p @microsoft/generator-sharepoint@1.23.2 -- yo @microsoft/sharepoint \
    --solution-name pmo-portal --component-type webpart --component-name PmoPortal \
    --framework react --environment spo --package-manager npm --skip-install --no-insight )
mkdir -p spfx && rsync -a "$T/pmo-portal/" spfx/ && rm -rf "$T"
```
Expected: `spfx/package.json`, `spfx/src/webparts/pmoPortal/PmoPortalWebPart.ts`, `spfx/config/package-solution.json` существуют.

- [ ] **Step 4: `.gitignore` для решения**

Добавить в корневой `.gitignore`:
```
# SPFx
spfx/node_modules/
spfx/lib/
spfx/lib-commonjs/
spfx/lib-esm/
spfx/temp/
spfx/dist/
spfx/release/
spfx/sharepoint/solution/
spfx/coverage/
```

- [ ] **Step 5: Манифест — главная на весь экран и Teams**

В `PmoPortalWebPart.manifest.json` задать:
```json
"supportedHosts": ["SharePointWebPart", "SharePointFullPage", "TeamsPersonalApp", "TeamsTab"],
"supportsFullBleed": true,
```
и в `preconfiguredEntries[0]`: `"title": { "default": "Портфель проєктів" }`, `"description": { "default": "Портфель проєктів" }`, `"group": { "default": "PMO" }`.

В `config/package-solution.json`: `"name": "pmo-portal"`, `"skipFeatureDeployment": true`, `"isDomainIsolated": false`, версия `"1.0.0.0"`.

- [ ] **Step 6: Jest вне сборки Heft**

Run: `scripts/spfx.sh npm install --save-dev --save-exact jest@29.7.0 ts-jest@29.2.5 @types/jest@29.5.14`

`spfx/jest.config.js`:
```js
/** Модульные тесты логики и сопоставления данных. Отдельно от heft: тесты лежат в test/, не в src/. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }] }
};
```

`spfx/tsconfig.jest.json`:
```json
{
  "compilerOptions": {
    "target": "es2019", "module": "commonjs", "moduleResolution": "node", "strict": true,
    "esModuleInterop": true, "resolveJsonModule": true, "jsx": "react", "types": ["jest", "node"], "skipLibCheck": true
  },
  "include": ["test/**/*.ts", "src/webparts/pmoPortal/logic/**/*.ts", "src/webparts/pmoPortal/data/types.ts", "src/webparts/pmoPortal/data/map.ts", "src/webparts/pmoPortal/i18n/**/*.ts"]
}
```

В `spfx/package.json` → `scripts`: `"test:unit": "jest"`.

`spfx/test/smoke.test.ts`:
```ts
test('jest работает', () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 7: Установить и проверить сборку**

Run: `scripts/spfx.sh npm install` → затем `scripts/spfx.sh npm ls react react-dom` → Expected: ровно `17.0.1` (иначе `npm install --save-exact react@17.0.1 react-dom@17.0.1`).
Run: `scripts/spfx.sh npm run test:unit` → Expected: `1 passed`.

Run: `scripts/spfx.sh npm run build`
Expected: код выхода 0, файл `spfx/sharepoint/solution/pmo-portal.sppkg` существует. Если в `package.json` нет скрипта `build`, выполнить `scripts/spfx.sh npx heft test --clean --production` и `scripts/spfx.sh npx heft package-solution --production` и добавить `"build": "heft test --clean --production && heft package-solution --production"`.

- [ ] **Step 8: Commit**

```bash
git switch -c change/spfx-phase1
git add .gitignore scripts/spfx.sh spfx
git commit -m "SPFx: каркас решения pmo-portal (1.23.2, Node 22), Jest для логики

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Общие тест-векторы, `logic/rag.ts` и `logic/dates.ts`

**Files:**
- Create: `tests/cases/rag.json`, `tests/cases/dates.json`, `spfx/src/webparts/pmoPortal/logic/rag.ts`, `spfx/src/webparts/pmoPortal/logic/dates.ts`, `spfx/test/rag-dates.test.ts`
- Modify: `tests/Test-Scripts.ps1` (разделы 4 и 4a читают JSON)

**Interfaces:**
- Produces: `type Rag = 'Зелений' | 'Жовтий' | 'Червоний' | ''`; `calcRag(s: Rag, b: Rag, r: Rag): Rag`; `dateOnly(value: string | null | undefined): string` (`'YYYY-MM-DD'` или `''`); `addDays(d: string, n: number): string`; `daysBetween(a: string, b: string): number` (b − a в днях); `todayIso(now?: Date): string`.

- [ ] **Step 1: Тест-векторы**

`tests/cases/rag.json`:
```json
[
  { "s": "Зелений", "b": "Зелений", "r": "Зелений", "out": "Зелений" },
  { "s": "Жовтий", "b": "Зелений", "r": "Зелений", "out": "Жовтий" },
  { "s": "Зелений", "b": "Червоний", "r": "Зелений", "out": "Червоний" },
  { "s": "Жовтий", "b": "Червоний", "r": "Жовтий", "out": "Червоний" },
  { "s": "Зелений", "b": "", "r": "Зелений", "out": "" }
]
```

`tests/cases/dates.json`:
```json
[
  { "in": "2026-09-21T12:00:00Z", "out": "2026-09-21", "note": "записано синхронизацией (полдень UTC)" },
  { "in": "2026-09-20T21:00:00Z", "out": "2026-09-21", "note": "введено в форме, сайт UTC+3" },
  { "in": "2026-01-20T22:00:00Z", "out": "2026-01-21", "note": "введено в форме, сайт UTC+2 (зима)" },
  { "in": "2026-09-21T04:00:00Z", "out": "2026-09-21", "note": "введено в форме, сайт UTC-4" },
  { "in": "2026-03-05T12:00:00Z", "out": "2026-03-05", "note": "ToSpDate -> DateOnly без сдвига" }
]
```

- [ ] **Step 2: Падающий тест**

`spfx/test/rag-dates.test.ts`:
```ts
import ragCases from '../../tests/cases/rag.json';
import dateCases from '../../tests/cases/dates.json';
import { calcRag, Rag } from '../src/webparts/pmoPortal/logic/rag';
import { dateOnly, addDays, daysBetween, todayIso } from '../src/webparts/pmoPortal/logic/dates';

describe('calcRag — те же векторы, что у Invoke-PMOSync.ps1', () => {
  test.each(ragCases)('$s/$b/$r -> $out', c => {
    expect(calcRag(c.s as Rag, c.b as Rag, c.r as Rag)).toBe(c.out);
  });
});

describe('dateOnly', () => {
  test.each(dateCases)('$note', c => { expect(dateOnly(c.in)).toBe(c.out); });
  test('пусто', () => { expect(dateOnly(null)).toBe(''); expect(dateOnly('')).toBe(''); });
});

test('addDays / daysBetween / todayIso', () => {
  expect(addDays('2026-09-24', -14)).toBe('2026-09-10');
  expect(daysBetween('2026-09-10', '2026-09-24')).toBe(14);
  expect(todayIso(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24');
});
```

Run: `scripts/spfx.sh npm run test:unit` → Expected: FAIL «Cannot find module .../logic/rag».

- [ ] **Step 3: Реализация**

`logic/rag.ts`:
```ts
export type Rag = 'Зелений' | 'Жовтий' | 'Червоний' | '';
export const RAGS: Rag[] = ['Зелений', 'Жовтий', 'Червоний'];

/** Общий стан — худшая из трёх оценок; если оценки нет — пусто (как CalcRag в Invoke-PMOSync.ps1). */
export function calcRag(s: Rag, b: Rag, r: Rag): Rag {
  const v = [s, b, r];
  if (v.some(x => !x)) return '';
  if (v.indexOf('Червоний') >= 0) return 'Червоний';
  if (v.indexOf('Жовтий') >= 0) return 'Жовтий';
  return 'Зелений';
}
```

`logic/dates.ts`:
```ts
const DAY = 86400000;
const pad = (n: number): string => (n < 10 ? '0' : '') + n;
const isoUtc = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Дата поля «только дата». 12:00 UTC — записано синхронизацией: дата UTC; иначе полночь по поясу сайта: +12 ч. */
export function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  if (d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return isoUtc(d);
  return isoUtc(new Date(d.getTime() + 12 * 3600000));
}
export function addDays(iso: string, n: number): string {
  return isoUtc(new Date(Date.parse(iso + 'T12:00:00Z') + n * DAY));
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
}
/** Сегодня по часам браузера. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
```

- [ ] **Step 4: Тесты проходят**

Run: `scripts/spfx.sh npm run test:unit` → Expected: PASS (все случаи).

- [ ] **Step 5: `Test-Scripts.ps1` читает те же векторы**

В разделе 4 заменить массив `$cases = @(...)` и цикл на:
```powershell
$cases = Get-Content -Raw (Join-Path $root "tests/cases/rag.json") | ConvertFrom-Json
foreach ($c in $cases) { $r = CalcRag $c.s $c.b $c.r; if ($r -eq $c.out) { Ok "$($c.s)/$($c.b)/$($c.r) -> $r" } else { Bad "$($c.s)/$($c.b)/$($c.r) -> $r, ожидалось $($c.out)" } }
```
В разделе 4a заменить `$dcases = @(...)` и цикл на:
```powershell
$dcases = Get-Content -Raw (Join-Path $root "tests/cases/dates.json") | ConvertFrom-Json
foreach ($c in $dcases) {
    $d = [datetime]::Parse($c.in, [cultureinfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AdjustToUniversal -bor [System.Globalization.DateTimeStyles]::AssumeUniversal)
    $r = DateOnly $d; if ($r -eq $c.out) { Ok "$($c.note): $r" } else { Bad "$($c.note): $r, ожидалось $($c.out)" }
}
```
и в разделе 2 добавить `"tests/cases/rag.json", "tests/cases/dates.json"` в список проверяемых JSON.

Run: `pwsh -NoLogo -File tests/Test-Scripts.ps1` → Expected: «Все проверки пройдены».

- [ ] **Step 6: Commit** — `git add tests spfx/test spfx/src/webparts/pmoPortal/logic && git commit -m "SPFx: общий стан и даты; общие тест-векторы для PowerShell и Jest …"`

---

### Task 3: `logic/status.ts` — статусы, свежесть, сроки, бюджет, риски, порядок

**Files:**
- Create: `spfx/src/webparts/pmoPortal/logic/status.ts`, `spfx/test/status.test.ts`

**Interfaces:**
- Consumes: `daysBetween`, `Rag` (Task 2).
- Produces:
```ts
isArch(status: string): boolean            // 'Архівний' | 'Завершено'
isActive(status: string): boolean          // !isArch && !== 'Скасовано'
type Fresh = 'g' | 'y' | 'r' | 'na'
freshness(lastUpdate: string, today: string): Fresh     // '' -> na; >14 дн. r; >8 y; иначе g
isPlanLate(planEnd: string, status: string, today: string): boolean   // plan < today && isActive
forecastDelta(planEnd: string, forecastEnd: string): number | null     // дни fc − plan
budgetUse(budget: number, actual: number): number        // round(actual/budget*100), 0 при budget=0
budgetLevel(use: number): '' | 'warn' | 'over'            // >100 over, >90 warn
riskScore(p: number, i: number): number; scoreLevel(score): 'r' | 'y' | 'g'  // ≥15 r, ≥8 y
byOrder(a: {type,priority,title}, b): number               // стратегические, приоритет, название (uk)
```

- [ ] **Step 1: Падающий тест** — `spfx/test/status.test.ts`:
```ts
import * as S from '../src/webparts/pmoPortal/logic/status';

test('isArch / isActive', () => {
  expect(S.isArch('Архівний')).toBe(true); expect(S.isArch('Завершено')).toBe(true); expect(S.isArch('Реалізація')).toBe(false);
  expect(S.isActive('Скасовано')).toBe(false); expect(S.isActive('Призупинено')).toBe(true); expect(S.isActive('Архівний')).toBe(false);
});
test('freshness: >14 червоний, >8 жовтий', () => {
  const t = '2026-09-24';
  expect(S.freshness('', t)).toBe('na');
  expect(S.freshness('2026-09-16', t)).toBe('g');   // 8 дней
  expect(S.freshness('2026-09-15', t)).toBe('y');   // 9
  expect(S.freshness('2026-09-10', t)).toBe('y');   // 14
  expect(S.freshness('2026-09-09', t)).toBe('r');   // 15
});
test('сроки, прогноз, бюджет', () => {
  expect(S.isPlanLate('2026-09-23', 'Реалізація', '2026-09-24')).toBe(true);
  expect(S.isPlanLate('2026-09-23', 'Архівний', '2026-09-24')).toBe(false);
  expect(S.forecastDelta('2026-12-18', '2027-01-29')).toBe(42);
  expect(S.forecastDelta('', '2027-01-29')).toBeNull();
  expect(S.budgetUse(2400000, 1450000)).toBe(60); expect(S.budgetUse(0, 5)).toBe(0);
  expect(S.budgetLevel(101)).toBe('over'); expect(S.budgetLevel(91)).toBe('warn'); expect(S.budgetLevel(90)).toBe('');
});
test('риски', () => {
  expect(S.riskScore(5, 4)).toBe(20); expect(S.scoreLevel(15)).toBe('r'); expect(S.scoreLevel(8)).toBe('y'); expect(S.scoreLevel(7)).toBe('g');
});
test('порядок: стратегические, приоритет, название', () => {
  const xs = [
    { type: 'Звичайний', priority: '1 — Високий', title: 'Б' },
    { type: 'Стратегічний', priority: '2 — Середній', title: 'В' },
    { type: 'Стратегічний', priority: '1 — Високий', title: 'Я' },
    { type: 'Стратегічний', priority: '1 — Високий', title: 'А' }
  ];
  expect(xs.slice().sort(S.byOrder).map(x => x.title)).toEqual(['А', 'Я', 'В', 'Б']);
});
```
Run: `scripts/spfx.sh npm run test:unit` → FAIL (модуль не найден).

- [ ] **Step 2: Реализация** — `logic/status.ts`:
```ts
import { daysBetween } from './dates';

export const isArch = (status: string): boolean => status === 'Архівний' || status === 'Завершено';
export const isActive = (status: string): boolean => !isArch(status) && status !== 'Скасовано';

export type Fresh = 'g' | 'y' | 'r' | 'na';
export function freshness(lastUpdate: string, today: string): Fresh {
  if (!lastUpdate) return 'na';
  const age = daysBetween(lastUpdate, today);
  return age > 14 ? 'r' : age > 8 ? 'y' : 'g';
}
export const isPlanLate = (planEnd: string, status: string, today: string): boolean => !!planEnd && planEnd < today && isActive(status);
export const forecastDelta = (planEnd: string, forecastEnd: string): number | null =>
  planEnd && forecastEnd ? daysBetween(planEnd, forecastEnd) : null;
export const budgetUse = (budget: number, actual: number): number => (budget ? Math.round((actual || 0) / budget * 100) : 0);
export const budgetLevel = (use: number): '' | 'warn' | 'over' => (use > 100 ? 'over' : use > 90 ? 'warn' : '');
export const riskScore = (p: number, i: number): number => (p || 0) * (i || 0);
export const scoreLevel = (s: number): 'r' | 'y' | 'g' => (s >= 15 ? 'r' : s >= 8 ? 'y' : 'g');

interface Orderable { type: string; priority: string; title: string; }
export function byOrder(a: Orderable, b: Orderable): number {
  if (a.type !== b.type) return a.type === 'Стратегічний' ? -1 : b.type === 'Стратегічний' ? 1 : 0;
  return (a.priority || '').localeCompare(b.priority || '') || a.title.localeCompare(b.title, 'uk');
}
```
- [ ] **Step 3:** `scripts/spfx.sh npm run test:unit` → PASS.
- [ ] **Step 4: Commit** — `git add spfx && git commit -m "SPFx: правила статусов, свежести, сроков, бюджета и рисков …"`

---

### Task 4: Модель, наложение неприменённых отчётов, кольцо и динамика

**Files:**
- Create: `spfx/src/webparts/pmoPortal/data/types.ts`, `logic/overlay.ts`, `logic/dynamics.ts`, `spfx/test/overlay-dynamics.test.ts`

**Interfaces:**
- Consumes: `calcRag`, `Rag`, `isArch`, `isActive`, `addDays`.
- Produces (`data/types.ts`):
```ts
export interface Person { id: number; name: string; email: string; }
export interface Project {
  id: number; code: string; title: string; type: string; priority: string;
  manager: Person | null; owner: Person | null; stakeholders: Person[]; department: string;
  status: string; rag: Rag; progress: number; start: string; goLive: string; planEnd: string; forecastEnd: string;
  archivedAt: string; budget: number; actualCost: number; lastUpdate: string; lastReport: string; lastComment: string;
  loop: string; description: string; canEdit: boolean; pending: boolean;   // pending — на экране есть неприменённый отчёт
}
export interface StatusReport {
  id: number; projectId: number; date: string; period: string; schedule: Rag; budget: Rag; resources: Rag;
  status: string; type: string; progress: number | null; start: string; goLive: string; planEnd: string; forecastEnd: string;
  actualCost: number | null; keyReason: string; title: string; done: string; next: string; issues: string;
  decision: boolean; decisionText: string; applied: boolean; author: Person | null;
}
export interface Risk { id: number; projectId: number; title: string; type: string; probability: number; impact: number;
  owner: Person | null; status: string; due: string; mitigation: string; }
```
- Produces (`logic`): `applyPending(p: Project, reports: StatusReport[]): Project`; `donutCounts(projects: Project[]): { g: number; y: number; r: number; none: number; total: number }`; `snapshots(projects: Project[], reports: StatusReport[], today: string): { date: string; g: number; y: number; r: number }[]` (7 точек, последняя — сегодня).

- [ ] **Step 1: Падающий тест** — `spfx/test/overlay-dynamics.test.ts`:
```ts
import { Project, StatusReport } from '../src/webparts/pmoPortal/data/types';
import { applyPending } from '../src/webparts/pmoPortal/logic/overlay';
import { donutCounts, snapshots } from '../src/webparts/pmoPortal/logic/dynamics';

const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '2 — Середній', manager: null, owner: null,
  stakeholders: [], department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '',
  archivedAt: '', budget: 0, actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', loop: '', description: '',
  canEdit: false, pending: false, ...x });
const R = (x: Partial<StatusReport>): StatusReport => ({ id: 1, projectId: 1, date: '2026-09-20', period: '2 тижні', schedule: 'Зелений',
  budget: 'Зелений', resources: 'Зелений', status: '', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '',
  actualCost: null, keyReason: '', title: 'Звіт', done: '', next: '', issues: '', decision: false, decisionText: '', applied: false, author: null, ...x });

describe('applyPending — как шаг 1 Invoke-PMOSync.ps1', () => {
  test('новый отчёт переносит показатели, стан, дату и «Останній апдейт»', () => {
    const p = applyPending(P({ lastUpdate: '2026-09-01', rag: 'Зелений' }),
      [R({ status: 'Призупинено', progress: 40, actualCost: 100, budget: 'Червоний', title: 'Стоп', planEnd: '2026-12-01' })]);
    expect(p).toMatchObject({ status: 'Призупинено', progress: 40, actualCost: 100, rag: 'Червоний', lastUpdate: '2026-09-20',
      lastReport: 'Стоп', planEnd: '2026-12-01', pending: true });
  });
  test('пустые поля отчёта не меняют карточку', () => {
    const p = applyPending(P({ progress: 30, planEnd: '2026-11-01' }), [R({})]);
    expect(p.progress).toBe(30); expect(p.planEnd).toBe('2026-11-01');
  });
  test('«Завершено» -> «Архівний» и дата архивации', () => {
    const p = applyPending(P({}), [R({ status: 'Завершено', date: '2026-09-22' })]);
    expect(p.status).toBe('Архівний'); expect(p.archivedAt).toBe('2026-09-22');
  });
  test('отчёт старше «Останнього апдейту» не меняет стан и дату', () => {
    const p = applyPending(P({ lastUpdate: '2026-09-21', rag: 'Зелений', lastReport: 'Новый' }), [R({ date: '2026-09-15', budget: 'Червоний', progress: 10 })]);
    expect(p.rag).toBe('Зелений'); expect(p.lastUpdate).toBe('2026-09-21'); expect(p.lastReport).toBe('Новый'); expect(p.progress).toBe(10);
  });
  test('применённые и чужие отчёты игнорируются', () => {
    const p0 = P({ progress: 5 });
    expect(applyPending(p0, [R({ applied: true, progress: 90 }), R({ projectId: 2, progress: 70 })])).toEqual(p0);
  });
  test('несколько отчётов — по дате, затем по id', () => {
    const p = applyPending(P({}), [R({ id: 2, date: '2026-09-20', progress: 50 }), R({ id: 1, date: '2026-09-20', progress: 20 }), R({ id: 3, date: '2026-09-10', progress: 10 })]);
    expect(p.progress).toBe(50);
  });
});

describe('кольцо и динамика — как в прототипе', () => {
  test('donutCounts считает только активные', () => {
    const c = donutCounts([P({ rag: 'Зелений' }), P({ rag: 'Червоний' }), P({ rag: '' }), P({ status: 'Архівний', rag: 'Зелений' }), P({ status: 'Скасовано', rag: 'Жовтий' })]);
    expect(c).toEqual({ g: 1, y: 0, r: 1, none: 1, total: 3 });
  });
  test('snapshots: 7 точек через 14 дней, последний отчёт на дату среза, архив — до даты архивации', () => {
    const today = '2026-09-24';
    const ps = [P({ id: 1 }), P({ id: 2, status: 'Архівний', archivedAt: '2026-09-01' })];
    const rs = [R({ projectId: 1, date: '2026-08-01', budget: 'Жовтий' }), R({ id: 2, projectId: 1, date: '2026-09-20', budget: 'Зелений' }),
                R({ id: 3, projectId: 2, date: '2026-08-20', budget: 'Червоний' })];
    const s = snapshots(ps, rs, today);
    expect(s.map(x => x.date)).toEqual(['2026-07-02', '2026-07-16', '2026-07-30', '2026-08-13', '2026-08-27', '2026-09-10', '2026-09-24']);
    expect(s[6]).toEqual({ date: '2026-09-24', g: 1, y: 0, r: 0 });   // проект 2 в архиве с 01.09
    expect(s[5]).toEqual({ date: '2026-09-10', g: 0, y: 1, r: 0 });
    expect(s[4]).toEqual({ date: '2026-08-27', g: 0, y: 1, r: 1 });
  });
});
```
Run: `scripts/spfx.sh npm run test:unit` → FAIL.

- [ ] **Step 2: Реализация**

`data/types.ts` — интерфейсы из блока Interfaces (с `import { Rag } from '../logic/rag';`).

`logic/overlay.ts`:
```ts
import { Project, StatusReport } from '../data/types';
import { calcRag } from './rag';

/** Накладывает неприменённые отчёты (srApplied = нет) на карточку — те же правила, что шаг 1 Invoke-PMOSync.ps1. */
export function applyPending(project: Project, reports: StatusReport[]): Project {
  const pending = reports.filter(r => r.projectId === project.id && !r.applied)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  if (!pending.length) return project;
  const p: Project = { ...project, pending: true };
  for (const r of pending) {
    if (r.status) p.status = r.status;
    if (r.type) p.type = r.type;
    if (r.progress !== null) p.progress = r.progress;
    if (r.start) p.start = r.start;
    if (r.goLive) p.goLive = r.goLive;
    if (r.planEnd) p.planEnd = r.planEnd;
    if (r.forecastEnd) p.forecastEnd = r.forecastEnd;
    if (r.actualCost !== null) p.actualCost = r.actualCost;
    if (p.status === 'Завершено') { p.status = 'Архівний'; p.archivedAt = r.date; }
    if (!p.lastUpdate || r.date >= p.lastUpdate) {
      const rag = calcRag(r.schedule, r.budget, r.resources);
      if (rag) p.rag = rag;
      p.lastUpdate = r.date; p.lastReport = r.title;
    }
  }
  return p;
}
```

`logic/dynamics.ts`:
```ts
import { Project, StatusReport } from '../data/types';
import { calcRag, Rag } from './rag';
import { isActive, isArch } from './status';
import { addDays } from './dates';

export function donutCounts(projects: Project[]): { g: number; y: number; r: number; none: number; total: number } {
  const act = projects.filter(p => isActive(p.status));
  const n = (v: Rag): number => act.filter(p => p.rag === v).length;
  return { g: n('Зелений'), y: n('Жовтий'), r: n('Червоний'), none: n(''), total: act.length };
}

/** 7 срезов через 14 дней (последний — сегодня): стан каждого проекта по последнему отчёту на дату среза. */
export function snapshots(projects: Project[], reports: StatusReport[], today: string): { date: string; g: number; y: number; r: number }[] {
  const out: { date: string; g: number; y: number; r: number }[] = [];
  for (let k = 6; k >= 0; k--) {
    const tt = addDays(today, -14 * k);
    const c = { g: 0, y: 0, r: 0 };
    for (const p of projects) {
      if (p.status === 'Скасовано') continue;
      if (isArch(p.status) && (p.archivedAt || p.lastUpdate) && tt > (p.archivedAt || p.lastUpdate)) continue;
      const rs = reports.filter(r => r.projectId === p.id && r.date <= tt)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
      if (!rs.length) continue;
      const last = rs[rs.length - 1];
      const rag = calcRag(last.schedule, last.budget, last.resources);
      if (rag === 'Зелений') c.g++; else if (rag === 'Жовтий') c.y++; else if (rag === 'Червоний') c.r++;
    }
    out.push({ date: tt, ...c });
  }
  return out;
}
```
- [ ] **Step 3:** `scripts/spfx.sh npm run test:unit` → PASS.
- [ ] **Step 4: Commit** — «SPFx: модель, наложение неприменённых отчётов, кольцо и динамика …».

---

### Task 5: Сопоставление REST → модель и репозиторий SharePoint

**Files:**
- Create: `spfx/src/webparts/pmoPortal/data/map.ts`, `data/SpRepo.ts`, `spfx/test/map.test.ts`, `spfx/test/fixtures/project.json`, `spfx/test/fixtures/report.json`

**Interfaces:**
- Consumes: `dateOnly`, типы Task 4.
- Produces:
```ts
// map.ts
PROJECT_SELECT: string; PROJECT_EXPAND: string; REPORT_SELECT: string; REPORT_EXPAND: string; RISK_SELECT: string; RISK_EXPAND: string
canEdit(perm: { High: string; Low: string } | undefined): boolean    // EditListItems — бит 0x4 в Low
mapProject(raw: any): Project; mapReport(raw: any): StatusReport; mapRisk(raw: any): Risk; mapPerson(raw: any): Person | null
// SpRepo.ts
class SpRepo { constructor(http: SPHttpClient, webUrl: string, webRelUrl: string);
  loadAll(): Promise<{ projects: Project[]; reports: StatusReport[]; risks: Risk[] }> }   // projects уже с applyPending
```

- [ ] **Step 1: Фикстуры** — ответ REST с `odata=nometadata`:

`spfx/test/fixtures/project.json`:
```json
{ "Id": 7, "Title": "Портал", "pmCode": "PRJ-007", "pmType": "Стратегічний", "pmPriority": "1 — Високий",
  "pmManager": { "Id": 11, "Title": "Test Kovalenko", "EMail": "test.kovalenko@smarthr.kz" },
  "pmOwner": null, "pmStakeholders": [ { "Id": 12, "Title": "test burbega", "EMail": "test.burbega@fillin.kz" } ],
  "pmDepartment": "ІТ", "pmStatus": "Реалізація", "pmRAG": "Червоний", "pmProgress": 35,
  "pmStart": "2026-04-27T12:00:00Z", "pmGoLive": null, "pmPlanEnd": "2026-11-07T21:00:00Z", "pmForecastEnd": null, "pmArchivedAt": null,
  "pmBudget": 1800000, "pmActualCost": 1350000, "pmLastUpdate": "2026-09-19T12:00:00Z",
  "pmLastReport": "Інтеграція затримується", "pmLastComment": null,
  "pmLoop": { "Url": "https://loop.cloud.microsoft/p/x", "Description": "Loop" }, "pmDescription": "Опис",
  "EffectiveBasePermissions": { "High": "432", "Low": "1011028719" } }
```
`spfx/test/fixtures/report.json`:
```json
{ "Id": 3, "Title": "Звіт", "srProjectId": 7, "srDate": "2026-09-19T12:00:00Z", "srPeriod": "2 тижні",
  "srSchedule": "Червоний", "srBudget": "Червоний", "srResources": "Жовтий", "srStatus": null, "srType": null,
  "srProgress": 35, "srStart": null, "srGoLive": null, "srPlanEnd": null, "srForecastEnd": "2027-01-12T12:00:00Z",
  "srActualCost": null, "srKeyReason": "Затримка", "srDone": "Зроблено", "srNext": null, "srIssues": null,
  "srDecision": true, "srDecisionText": "Погодити бюджет", "srApplied": false,
  "Author": { "Id": 11, "Title": "Test Kovalenko", "EMail": "test.kovalenko@smarthr.kz" } }
```

- [ ] **Step 2: Падающий тест** — `spfx/test/map.test.ts`:
```ts
import projectRaw from './fixtures/project.json';
import reportRaw from './fixtures/report.json';
import { mapProject, mapReport, canEdit } from '../src/webparts/pmoPortal/data/map';

test('mapProject', () => {
  const p = mapProject(projectRaw);
  expect(p).toMatchObject({ id: 7, code: 'PRJ-007', type: 'Стратегічний', status: 'Реалізація', rag: 'Червоний', progress: 35,
    start: '2026-04-27', planEnd: '2026-11-08', goLive: '', lastUpdate: '2026-09-19', loop: 'https://loop.cloud.microsoft/p/x',
    budget: 1800000, actualCost: 1350000, lastComment: '', canEdit: true, pending: false });
  expect(p.manager).toEqual({ id: 11, name: 'Test Kovalenko', email: 'test.kovalenko@smarthr.kz' });
  expect(p.owner).toBeNull(); expect(p.stakeholders).toHaveLength(1);
});
test('mapReport', () => {
  expect(mapReport(reportRaw)).toMatchObject({ id: 3, projectId: 7, date: '2026-09-19', schedule: 'Червоний', status: '',
    progress: 35, actualCost: null, forecastEnd: '2027-01-12', decision: true, applied: false, next: '' });
});
test('canEdit: бит EditListItems (0x4) в Low', () => {
  expect(canEdit({ High: '176', Low: '138612833' })).toBe(false);   // «Читання»
  expect(canEdit({ High: '432', Low: '1011028719' })).toBe(true);   // «Редагування»
  expect(canEdit(undefined)).toBe(false);
});
```
Run → FAIL.

- [ ] **Step 3: Реализация** — `data/map.ts`:
```ts
import { Person, Project, StatusReport, Risk } from './types';
import { dateOnly } from '../logic/dates';
import { Rag } from '../logic/rag';

const PERSON = 'Id,Title,EMail';
export const PROJECT_SELECT = ['Id', 'Title', 'pmCode', 'pmType', 'pmPriority', 'pmDepartment', 'pmStatus', 'pmRAG', 'pmProgress',
  'pmStart', 'pmGoLive', 'pmPlanEnd', 'pmForecastEnd', 'pmArchivedAt', 'pmBudget', 'pmActualCost', 'pmLastUpdate', 'pmLastReport',
  'pmLastComment', 'pmLoop', 'pmDescription', 'EffectiveBasePermissions',
  ...['pmManager', 'pmOwner', 'pmStakeholders'].map(f => PERSON.split(',').map(x => `${f}/${x}`).join(','))].join(',');
export const PROJECT_EXPAND = 'pmManager,pmOwner,pmStakeholders';
export const REPORT_SELECT = ['Id', 'Title', 'srProjectId', 'srDate', 'srPeriod', 'srSchedule', 'srBudget', 'srResources', 'srStatus', 'srType',
  'srProgress', 'srStart', 'srGoLive', 'srPlanEnd', 'srForecastEnd', 'srActualCost', 'srKeyReason', 'srDone', 'srNext', 'srIssues',
  'srDecision', 'srDecisionText', 'srApplied', 'Author/Id', 'Author/Title', 'Author/EMail'].join(',');
export const REPORT_EXPAND = 'Author';
export const RISK_SELECT = ['Id', 'Title', 'riProjectId', 'riType', 'riProbability', 'riImpact', 'riStatus', 'riDue', 'riMitigation',
  'riOwner/Id', 'riOwner/Title', 'riOwner/EMail'].join(',');
export const RISK_EXPAND = 'riOwner';

const s = (v: any): string => (v === null || v === undefined ? '' : String(v));
const n = (v: any): number => (typeof v === 'number' ? v : 0);
const nn = (v: any): number | null => (typeof v === 'number' ? v : null);
export const mapPerson = (v: any): Person | null => (v && v.Id ? { id: v.Id, name: s(v.Title), email: s(v.EMail) } : null);
export function canEdit(perm: { High: string; Low: string } | undefined): boolean {
  return !!perm && (Number(perm.Low) & 0x4) !== 0;
}
export function mapProject(r: any): Project {
  return { id: r.Id, code: s(r.pmCode), title: s(r.Title), type: s(r.pmType), priority: s(r.pmPriority),
    manager: mapPerson(r.pmManager), owner: mapPerson(r.pmOwner), stakeholders: (r.pmStakeholders || []).map(mapPerson).filter(Boolean) as Person[],
    department: s(r.pmDepartment), status: s(r.pmStatus), rag: s(r.pmRAG) as Rag, progress: n(r.pmProgress),
    start: dateOnly(r.pmStart), goLive: dateOnly(r.pmGoLive), planEnd: dateOnly(r.pmPlanEnd), forecastEnd: dateOnly(r.pmForecastEnd),
    archivedAt: dateOnly(r.pmArchivedAt), budget: n(r.pmBudget), actualCost: n(r.pmActualCost), lastUpdate: dateOnly(r.pmLastUpdate),
    lastReport: s(r.pmLastReport), lastComment: s(r.pmLastComment), loop: r.pmLoop ? s(r.pmLoop.Url) : '', description: s(r.pmDescription),
    canEdit: canEdit(r.EffectiveBasePermissions), pending: false };
}
export function mapReport(r: any): StatusReport {
  return { id: r.Id, projectId: r.srProjectId, date: dateOnly(r.srDate), period: s(r.srPeriod),
    schedule: s(r.srSchedule) as Rag, budget: s(r.srBudget) as Rag, resources: s(r.srResources) as Rag,
    status: s(r.srStatus), type: s(r.srType), progress: nn(r.srProgress), start: dateOnly(r.srStart), goLive: dateOnly(r.srGoLive),
    planEnd: dateOnly(r.srPlanEnd), forecastEnd: dateOnly(r.srForecastEnd), actualCost: nn(r.srActualCost), keyReason: s(r.srKeyReason),
    title: s(r.Title), done: s(r.srDone), next: s(r.srNext), issues: s(r.srIssues), decision: r.srDecision === true,
    decisionText: s(r.srDecisionText), applied: r.srApplied === true, author: mapPerson(r.Author) };
}
export function mapRisk(r: any): Risk {
  return { id: r.Id, projectId: r.riProjectId, title: s(r.Title), type: s(r.riType), probability: n(r.riProbability), impact: n(r.riImpact),
    owner: mapPerson(r.riOwner), status: s(r.riStatus), due: dateOnly(r.riDue), mitigation: s(r.riMitigation) };
}
```

`data/SpRepo.ts` (без модульных тестов — проверяется на сайте в Task 8):
```ts
import { SPHttpClient } from '@microsoft/sp-http';
import { Project, StatusReport, Risk } from './types';
import { mapProject, mapReport, mapRisk, PROJECT_SELECT, PROJECT_EXPAND, REPORT_SELECT, REPORT_EXPAND, RISK_SELECT, RISK_EXPAND } from './map';
import { applyPending } from '../logic/overlay';

export class SpRepo {
  constructor(private http: SPHttpClient, private webUrl: string, private webRelUrl: string) {}
  private async items(list: string, select: string, expand: string): Promise<any[]> {
    let url = `${this.webUrl}/_api/web/GetList('${this.webRelUrl.replace(/\/$/, '')}/Lists/${list}')/items?$select=${select}&$expand=${expand}&$top=2000`;
    const out: any[] = [];
    while (url) {
      const res = await this.http.get(url, SPHttpClient.configurations.v1, { headers: { Accept: 'application/json;odata=nometadata' } });
      if (!res.ok) throw new Error(`${list}: ${res.status} ${await res.text()}`);
      const j = await res.json();
      out.push(...j.value);
      url = j['odata.nextLink'] || '';
    }
    return out;
  }
  async loadAll(): Promise<{ projects: Project[]; reports: StatusReport[]; risks: Risk[] }> {
    const [p, r, k] = await Promise.all([
      this.items('Projects', PROJECT_SELECT, PROJECT_EXPAND),
      this.items('StatusReports', REPORT_SELECT, REPORT_EXPAND),
      this.items('RisksIssues', RISK_SELECT, RISK_EXPAND)]);
    const reports = r.map(mapReport);
    return { projects: p.map(mapProject).map(x => applyPending(x, reports)), reports, risks: k.map(mapRisk) };
  }
}
```
- [ ] **Step 4:** `scripts/spfx.sh npm run test:unit` → PASS.
- [ ] **Step 5: Commit** — «SPFx: сопоставление данных SharePoint и чтение списков …».

---

### Task 6: Словари и CSS из прототипа, язык и тема

**Files:**
- Create: `spfx/tools/extract-prototype.mjs`, `spfx/src/webparts/pmoPortal/i18n/strings.ts` (генерируется), `i18n/i18n.ts`, `theme/prototype.scss` (генерируется), `theme/theme.ts`, `spfx/test/i18n-css.test.ts`
- Modify: `spfx/package.json` (`"extract": "node tools/extract-prototype.mjs"`)

**Interfaces:**
- Produces: `T`, `FLD`: `Record<string, [string, string, string]>`, `EXTRA` (строки приложения, которых нет в прототипе); `type Lang = 0 | 1 | 2` (uk, en, ru); `langFromCulture(name: string): Lang`; `makeT(lang: Lang): { t(k: string): string; fl(k: string): string }`; `readTheme(): 'light' | 'dark' | ''`; `saveTheme(v)`; `readLang(): Lang | null`; `saveLang(l)`. Корневой класс `.pmo-app`, атрибут `data-theme`.

- [ ] **Step 1: Падающий тест** — `spfx/test/i18n-css.test.ts`:
```ts
import * as fs from 'fs';
import * as path from 'path';
import { T, FLD, EXTRA } from '../src/webparts/pmoPortal/i18n/strings';
import { makeT, langFromCulture } from '../src/webparts/pmoPortal/i18n/i18n';

test('словари перенесены из прототипа', () => {
  expect(T.dash).toEqual(['Панель проєктів', 'Project dashboard', 'Панель проектов']);
  expect(T.wpHealth[1]).toBe('Portfolio by health');
  expect(FLD.pm).toBeDefined();
  expect(EXTRA.soon).toHaveLength(3);
});
test('t / fl / язык из профиля', () => {
  const { t } = makeT(1); expect(t('dash')).toBe('Project dashboard'); expect(t('нет такого')).toBe('нет такого');
  expect(langFromCulture('uk-UA')).toBe(0); expect(langFromCulture('en-US')).toBe(1); expect(langFromCulture('ru-RU')).toBe(2); expect(langFromCulture('de-DE')).toBe(0);
});
test('CSS изолирован под .pmo-app', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/webparts/pmoPortal/theme/prototype.scss'), 'utf8');
  expect(css).toContain('.pmo-app[data-theme="dark"]');
  expect(css).not.toMatch(/(^|[\s,}]):root/);
  expect(css).not.toMatch(/(^|[\s,}])body\s*\{/);
});
```
Run → FAIL.

- [ ] **Step 2: Генератор** — `spfx/tools/extract-prototype.mjs`:
```js
// Переносит словари (T, FLD) и CSS прототипа в приложение. Запуск: npm run extract. Результат коммитится.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../../prototype/pmo-prototype.html'), 'utf8');
const out = p => path.join(here, '../src/webparts/pmoPortal', p);

// --- словари: объекты T и FLD — литералы; вычисляем их в изолированной функции
const grab = name => { const a = src.indexOf(`const ${name} = {`); let i = src.indexOf('{', a), d = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  return new Function(`return (${src.slice(i, j + 1)});`)(); };
const EXTRA = {
  soon: ['Цей розділ з’явиться на наступному етапі.', 'This section is coming in the next stage.', 'Этот раздел появится на следующем этапе.'],
  loadErr: ['Не вдалося завантажити дані', 'Could not load data', 'Не удалось загрузить данные'],
  pendingNote: ['Оновлюється зі статус-звіту', 'Updating from a status report', 'Обновляется из статус-отчёта']
};
const ts = `// Сгенерировано tools/extract-prototype.mjs из prototype/pmo-prototype.html — не править вручную.\n` +
  `export type L3 = [string, string, string];\n` +
  `export const T: Record<string, L3> = ${JSON.stringify(grab('T'), null, 1)};\n` +
  `export const FLD: Record<string, L3> = ${JSON.stringify(grab('FLD'), null, 1)};\n` +
  `export const EXTRA: Record<string, L3> = ${JSON.stringify(EXTRA, null, 1)};\n`;
fs.mkdirSync(out('i18n'), { recursive: true }); fs.writeFileSync(out('i18n/strings.ts'), ts);

// --- CSS: темы на .pmo-app, остальное вложено в .pmo-app { … }, id-элементы -> классы
let css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
css = css.replace(/:root:not\(\[data-theme="light"\]\)/g, '.pmo-app:not([data-theme="light"])')
         .replace(/:root\[data-theme="dark"\]/g, '.pmo-app[data-theme="dark"]')
         .replace(/(^|\})\s*:root\s*\{/g, '$1\n.pmo-app{')
         .replace(/(^|\})\s*html\s*\{[^}]*\}/g, '$1')
         .replace(/(^|\})\s*body\s*\{/g, '$1\n&{')
         .replace(/#(scrim|panel|toast|pop)\b/g, '.pmo-$1')                 // id-селекторы прототипа -> классы
         .replace(/(^|[\s,}])main(?=[\s,{])/g, '$1.pmo-main');             // «main{…}» и «main,.top-in{…}»
// html{scroll-padding-top} отброшен сознательно: страница прокручивается SharePoint, а не приложением
// блоки тем (.pmo-app{…}, @media … .pmo-app:not…, .pmo-app[data-theme]) остаются снаружи, остальное — внутрь
const themeEnd = css.indexOf('.pmo-app[data-theme="dark"]'); const afterTheme = css.indexOf('}', themeEnd) + 1;
const scss = `// Сгенерировано tools/extract-prototype.mjs — не править вручную.\n${css.slice(0, afterTheme)}\n.pmo-app{\n${css.slice(afterTheme)}\n}\n`;
fs.mkdirSync(out('theme'), { recursive: true }); fs.writeFileSync(out('theme/prototype.scss'), scss);
console.log('i18n/strings.ts и theme/prototype.scss обновлены');
```
Run: `scripts/spfx.sh npm run extract` → Expected: два файла созданы.

- [ ] **Step 3: `i18n/i18n.ts` и `theme/theme.ts`**
```ts
// i18n/i18n.ts
import { T, FLD, EXTRA } from './strings';
export type Lang = 0 | 1 | 2;
export const langFromCulture = (name: string): Lang => (/^en/i.test(name) ? 1 : /^ru/i.test(name) ? 2 : 0);
export function makeT(lang: Lang): { t(k: string): string; fl(k: string): string } {
  return { t: k => (T[k] || EXTRA[k] || [k, k, k])[lang], fl: k => (FLD[k] || T[k] || [k, k, k])[lang] };
}
const KEY = 'pmo-lang';
export const readLang = (): Lang | null => { try { const v = localStorage.getItem(KEY); return v === null ? null : (Number(v) as Lang); } catch (e) { return null; } };
export const saveLang = (l: Lang): void => { try { localStorage.setItem(KEY, String(l)); } catch (e) { /* приватный режим */ } };
```
```ts
// theme/theme.ts
import './prototype.scss';
const KEY = 'pmo-theme';
export const readTheme = (): 'light' | 'dark' | '' => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : ''; } catch (e) { return ''; } };
export const saveTheme = (v: 'light' | 'dark'): void => { try { localStorage.setItem(KEY, v); } catch (e) { /* приватный режим */ } };
```
- [ ] **Step 4:** `scripts/spfx.sh npm run test:unit` → PASS; `scripts/spfx.sh npm run build` → код 0 (SCSS компилируется).
- [ ] **Step 5: Commit** — «SPFx: словари и CSS прототипа, язык и тема …».

---

### Task 7: Шапка, иконки и главная 1:1 с прототипом

**Files:**
- Create: `components/Icons.tsx`, `components/Bits.tsx`, `components/Donut.tsx`, `components/Dynamics.tsx`, `components/Wp.tsx`, `components/SimpleTable.tsx`, `components/Header.tsx`, `components/App.tsx`, `pages/Home.tsx`, `pages/Soon.tsx`
- Modify: `PmoPortalWebPart.ts` (рендер `App`), удалить сгенерированный `components/PmoPortal.tsx` и его scss/props

**Interfaces:**
- Consumes: всё из Tasks 2–6.
- Produces: `type Page = 'home' | 'projects' | 'reports' | 'risks' | 'archive'`; `<App repo={SpRepo} culture={string} userName={string} userEmail={string} webUrl={string} />`; `interface Ctx { t; fl; lang; today: string; go(page: Page, view?: string): void }` через `React.createContext`.

Разметка и классы — как у функций прототипа (`hero`, `wp`, `table`, `ragDot`, `person`, `freshHtml`, `donut`, `dynamics`, шапка строк 465–481): тогда CSS прототипа применяется без изменений.

- [ ] **Step 1: `Icons.tsx`** — щит с мечом, приоритеты, компас, флаг, плюс, солнце, луна; пути `d` — дословно из прототипа (`SHIELD_D`, `SWORD_D`, `PRIO_I`, `icoCompass`, `icoFlag`, `iconPlus`, иконки темы в строке 477):
```tsx
import * as React from 'react';
export const SHIELD_D = 'M12 2 4 5v6.2c0 4.9 3.4 9.3 8 10.8 4.6-1.5 8-5.9 8-10.8V5z';
export const SWORD_D = 'M12 4.6l.9 1.3v7.2h2.3v1.4h-2.3v2h.5v1.2h-2.8v-1.2h.5v-2H8.8v-1.4h2.3V5.9z';
export const Strat: React.FC<{ on: boolean }> = ({ on }) => on ? (
  <svg className="stratico" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path d={SHIELD_D} fill="currentColor" /><path d={SWORD_D} fill="#fff" /></svg>) : null;
export const Prio: React.FC<{ v: string }> = ({ v }) =>
  v.charAt(0) === '1' ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--r)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8l4-4 4 4M4 12.5l4-4 4 4" /></svg>
  : v.charAt(0) === '2' ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--y)" strokeWidth="2" strokeLinecap="round"><path d="M3.5 6h9M3.5 10h9" /></svg>
  : v.charAt(0) === '3' ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--theme)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg> : null;
export const Compass: React.FC = () => <svg className="hico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" fillOpacity=".25" /></svg>;
export const Flag: React.FC = () => <svg className="hico" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></svg>;
```
Иконки плюса и темы (прототип, строки 916 и 477):
```tsx
export const Plus: React.FC = () => <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 2.5v11M2.5 8h11" /></svg>;
export const Sun: React.FC = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></svg>;
export const Moon: React.FC = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z" /></svg>;
```

- [ ] **Step 2: `Bits.tsx`** — мелкие элементы с классами прототипа:
```tsx
import * as React from 'react';
import { Rag } from '../logic/rag';
import { Fresh } from '../logic/status';
import { Person } from '../data/types';
const RC: Record<string, string> = { 'Зелений': 'var(--g)', 'Жовтий': 'var(--y)', 'Червоний': 'var(--r)' };
const FC: Record<Fresh, string> = { g: 'var(--g)', y: 'var(--y)', r: 'var(--r)', na: 'var(--na)' };
const COLORS = ['#8764b8', '#038387', '#ca5010', '#0078d4', '#498205', '#c239b3', '#986f0b', '#4f6bed'];
export const fmtDate = (iso: string): string => (iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('uk-UA') : '');
export const RagDot: React.FC<{ v: Rag; notRated: string }> = ({ v, notRated }) =>
  <span className="ragdot" title={v || notRated} aria-label={v || notRated} style={{ background: v ? RC[v] : 'var(--na)' }} />;
export const FreshDate: React.FC<{ iso: string; fresh: Fresh; none: string }> = ({ iso, fresh, none }) =>
  <span className="rag"><span className="dot sm" style={{ background: FC[fresh] }} />{iso ? fmtDate(iso) : <span className="muted">{none}</span>}</span>;
export const Avatar: React.FC<{ name: string }> = ({ name }) => {
  const c = COLORS[Array.from(name).reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];
  return <span className="pav" style={{ background: c }} aria-hidden="true">{name.split(' ').map(x => x.charAt(0)).join('').slice(0, 2)}</span>;
};
export const PersonCell: React.FC<{ p: Person | null }> = ({ p }) => p
  ? <span className="person" title={p.email}><Avatar name={p.name} /><span className="pn"><b>{p.name}</b></span></span>
  : <span className="muted">—</span>;
export const Score: React.FC<{ s: number }> = ({ s }) =>
  <span className="chip" style={{ background: s >= 15 ? 'var(--r)' : s >= 8 ? 'var(--y)' : 'var(--g)' }}>{s}</span>;
```

- [ ] **Step 3: `Donut.tsx` и `Dynamics.tsx`** — геометрия прототипа (строки 924–956):
```tsx
// Donut.tsx
import * as React from 'react';
export const Donut: React.FC<{ c: { g: number; y: number; r: number; none: number; total: number }; label: string; active: string; notRated: string }> = ({ c, label, active, notRated }) => {
  const R = 76, C = 2 * Math.PI * R, total = c.total || 1;
  const segs: [number, string, string][] = [[c.g, 'var(--g)', 'Зелений'], [c.y, 'var(--y)', 'Жовтий'], [c.r, 'var(--r)', 'Червоний'], [c.none, 'var(--na)', notRated]];
  let off = 0;
  return <div className="donut-wrap">
    <svg className="donut" viewBox="0 0 200 200" role="img" aria-label={label}>
      <circle r={R} cx="100" cy="100" fill="none" stroke="var(--track)" strokeWidth="24" />
      {segs.map(([v, cl], i) => { const len = v / total * C; const el = len > 0 ? <circle key={i} r={R} cx="100" cy="100" fill="none" stroke={cl} strokeWidth="24"
        strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 100 100)" /> : null; off += len; return el; })}
      <text x="100" y="100" textAnchor="middle" fontSize="40" fontWeight="600" fill="var(--text)">{c.total}</text>
      <text x="100" y="124" textAnchor="middle" fontSize="14" fill="var(--text-2)">{active}</text>
    </svg>
    <ul className="legend">{segs.filter((s, i) => i < 3 || s[0] > 0).map(([v, cl, l], i) => <li key={i}><span className="dot" style={{ background: cl }} /><b>{v}</b>{l}</li>)}</ul>
  </div>;
};
```
```tsx
// Dynamics.tsx
import * as React from 'react';
import { fmtDate } from './Bits';
export const Dynamics: React.FC<{ pts: { date: string; g: number; y: number; r: number }[]; label: string; today: string; hint: string }> = ({ pts, label, today, hint }) => {
  const W = 500, H = 230, L = 30, B = 30, TP = 12;
  const max = Math.max(1, ...pts.map(p => p.g + p.y + p.r));
  const slot = (W - L - 8) / pts.length, bw = slot * 0.5, y = (v: number): number => H - B - v / max * (H - B - TP);
  const K: [keyof typeof pts[0], string, string][] = [['g', 'var(--g)', 'Зелений'], ['y', 'var(--y)', 'Жовтий'], ['r', 'var(--r)', 'Червоний']];
  return <>
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, Math.ceil(max / 2), max].map(v => <g key={'l' + v}><line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} stroke="var(--line)" />
        <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-2)">{v}</text></g>)}
      {pts.map((p, i) => { const x = L + i * slot + (slot - bw) / 2; let base = 0;
        return <g key={p.date}>{K.map(([k, cl, name]) => { const v = p[k] as number; if (!v) return null; const y1 = y(base + v), h = y(base) - y1; base += v;
          return <g key={k}><rect x={x} y={y1} width={bw} height={Math.max(h - 2, 1)} rx="5" fill={cl}><title>{`${fmtDate(p.date)}: ${name} — ${v}`}</title></rect>
            {h > 16 ? <text x={x + bw / 2} y={y1 + h / 2 + 3} textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">{v}</text> : null}</g>; })}
          <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--text-2)">{i === pts.length - 1 ? today : fmtDate(p.date).slice(0, 5)}</text></g>; })}
    </svg><p className="hint">{hint}</p></>;
};
```

- [ ] **Step 4: `Wp.tsx`, `SimpleTable.tsx`**
```tsx
// Wp.tsx — блок главной (функция wp прототипа)
import * as React from 'react';
export const Wp: React.FC<{ title: string; more?: () => void; moreLabel?: string }> = ({ title, more, moreLabel, children }) =>
  <section className="wp"><div className="wp-h"><h2>{title}</h2><span>{more ? <button className="more" onClick={more}>{moreLabel}</button> : null}</span></div>{children}</section>;
```
```tsx
// SimpleTable.tsx — функция table прототипа (без группировок)
import * as React from 'react';
export interface Col<R> { head: React.ReactNode; cell: (r: R) => React.ReactNode; cls?: string; }
export function SimpleTable<R extends { id: number }>(p: { cols: Col<R>[]; rows: R[]; empty: string }): JSX.Element {
  if (!p.rows.length) return <p className="empty">{p.empty}</p>;
  return <div className="tablewrap"><table><thead><tr>{p.cols.map((c, i) => <th key={i} className={c.cls || ''}>{c.head}</th>)}</tr></thead>
    <tbody>{p.rows.map(r => <tr key={r.id} className="row">{p.cols.map((c, i) => <td key={i} className={c.cls || ''}>{c.cell(r)}</td>)}</tr>)}</tbody></table></div>;
}
```

- [ ] **Step 5: `Header.tsx`, `App.tsx`, `Soon.tsx`** — шапка строк 465–481 и `renderChrome` (строки 1226–1236):
```tsx
// Header.tsx
import * as React from 'react';
import { AppCtx, Page } from './App';
import { Lang } from '../i18n/i18n';
import { Avatar } from './Bits';
import { Sun, Moon } from './Icons';
const NAV: [Page, string][] = [['home', 'navHome'], ['projects', 'navProjects'], ['reports', 'navReports'], ['risks', 'navRisks'], ['archive', 'navArchive']];
export const Header: React.FC<{ page: Page; lang: Lang; theme: 'light' | 'dark' | ''; userName: string; userEmail: string;
  onPage(p: Page): void; onLang(l: Lang): void; onTheme(v: 'light' | 'dark'): void }> = p => {
  const { t } = React.useContext(AppCtx);
  const dark = p.theme === 'dark' || (p.theme === '' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return <header className="top"><div className="top-in">
    <div className="brand"><div className="logo" aria-hidden="true">ПП</div>
      <div><div className="brand-name">{t('siteTitle')}</div><div className="brand-sub">SharePoint · Microsoft 365</div></div></div>
    <nav className="nav" aria-label="Navigation">{NAV.map(([pg, k]) =>
      <button key={pg} aria-current={p.page === pg ? 'page' : undefined} onClick={() => p.onPage(pg)}>{t(k)}</button>)}</nav>
    <div className="controls">
      <div className="seg" role="group" aria-label="Мова / Language / Язык">{(['UA', 'EN', 'RU'] as const).map((l, i) =>
        <button key={l} lang={['uk', 'en', 'ru'][i]} aria-pressed={p.lang === i} onClick={() => p.onLang(i as Lang)}>{l}</button>)}</div>
      <div className="seg" role="group" aria-label="Theme">
        <button aria-pressed={!dark} title={t('themeLight')} aria-label={t('themeLight')} onClick={() => p.onTheme('light')}><Sun /></button>
        <button aria-pressed={dark} title={t('themeDark')} aria-label={t('themeDark')} onClick={() => p.onTheme('dark')}><Moon /></button></div>
      <button className="me" title={`${t('signedIn')}: ${p.userName} · ${p.userEmail}`} aria-label={`${t('signedIn')}: ${p.userName}`}><Avatar name={p.userName} /></button>
    </div></div></header>;
};
```
В `App.tsx` передать `userEmail={p.userEmail}` в `Header`.
```tsx
// App.tsx (сокращённо до сути: состояние, загрузка, контекст)
import * as React from 'react';
import { SpRepo } from '../data/SpRepo';
import { Project, StatusReport, Risk } from '../data/types';
import { Lang, langFromCulture, makeT, readLang, saveLang } from '../i18n/i18n';
import { readTheme, saveTheme } from '../theme/theme';
import { todayIso } from '../logic/dates';
import { Header } from './Header';
import { Home } from '../pages/Home';
import { Soon } from '../pages/Soon';
export type Page = 'home' | 'projects' | 'reports' | 'risks' | 'archive';
export interface Ctx { t(k: string): string; fl(k: string): string; lang: Lang; today: string; go(page: Page, view?: string): void; }
export const AppCtx = React.createContext<Ctx>(null as any);
export interface Data { projects: Project[]; reports: StatusReport[]; risks: Risk[]; }

export const App: React.FC<{ repo: SpRepo; culture: string; userName: string; userEmail: string; webUrl: string }> = p => {
  const [lang, setLang] = React.useState<Lang>(readLang() ?? langFromCulture(p.culture));
  const [theme, setTheme] = React.useState<'light' | 'dark' | ''>(readTheme());
  const [page, setPage] = React.useState<Page>('home');
  const [data, setData] = React.useState<Data | null>(null);
  const [err, setErr] = React.useState('');
  React.useEffect(() => { p.repo.loadAll().then(setData, e => setErr(String(e && e.message || e))); }, []);
  const tt = makeT(lang);
  const ctx: Ctx = { ...tt, lang, today: todayIso(), go: pg => { setPage(pg); window.scrollTo(0, 0); } };
  return <AppCtx.Provider value={ctx}>
    <div className="pmo-app" data-theme={theme || undefined} lang={['uk', 'en', 'ru'][lang]}>
      <Header page={page} lang={lang} theme={theme} userName={p.userName} userEmail={p.userEmail}
        onPage={ctx.go} onLang={l => { setLang(l); saveLang(l); }} onTheme={v => { setTheme(v); saveTheme(v); }} />
      <main className="pmo-main">
        {err ? <p className="empty">{tt.t('loadErr')}: {err}</p>
          : !data ? <p className="empty">…</p>
          : page === 'home' ? <Home data={data} webUrl={p.webUrl} /> : <Soon />}
      </main>
    </div>
  </AppCtx.Provider>;
};
```
`Soon.tsx`: `<div className="wp empty-state"><p>{t('soon')}</p></div>` через `React.useContext(AppCtx)`.

- [ ] **Step 6: `pages/Home.tsx`** — порядок и колонки `pageHome` прототипа (строки 1167–1190):
```tsx
import * as React from 'react';
import { AppCtx, Data } from '../components/App';
import { Project, StatusReport, Risk } from '../data/types';
import { isArch, isActive, freshness, riskScore, byOrder } from '../logic/status';
import { donutCounts, snapshots } from '../logic/dynamics';
import { Wp } from '../components/Wp';
import { SimpleTable, Col } from '../components/SimpleTable';
import { Donut } from '../components/Donut';
import { Dynamics } from '../components/Dynamics';
import { RagDot, FreshDate, PersonCell, Score, fmtDate } from '../components/Bits';
import { Strat, Prio, Compass, Flag, Plus } from '../components/Icons';

export const Home: React.FC<{ data: Data; webUrl: string }> = ({ data, webUrl }) => {
  const { t, fl, today, go } = React.useContext(AppCtx);
  const byId: Record<number, Project> = {}; data.projects.forEach(p => { byId[p.id] = p; });
  const vis = data.projects.filter(p => !isArch(p.status)).sort(byOrder);
  const prob = vis.filter(p => isActive(p.status) && (p.rag === 'Червоний' || p.rag === 'Жовтий'))
    .sort((a, b) => (a.rag === 'Червоний' ? 0 : 1) - (b.rag === 'Червоний' ? 0 : 1));
  const stale = vis.filter(p => isActive(p.status) && ['r', 'na'].indexOf(freshness(p.lastUpdate, today)) >= 0);   // старше 14 дней или отчётов нет
  const dec = data.reports.filter(r => r.decision && byId[r.projectId] && !isArch(byId[r.projectId].status))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const open = data.risks.filter(k => k.status !== 'Закрито' && byId[k.projectId] && !isArch(byId[k.projectId].status))
    .sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact)).slice(0, 6);
  const P = (id: number): Project => byId[id];
  const link = (p: Project): JSX.Element => <button className="link">{p.title}</button>;
  const S: Col<Project> = { head: <span className="ico" title={t('cStrat')}><Compass /></span>, cell: p => <span className="ico"><Strat on={p.type === 'Стратегічний'} /></span>, cls: 'c-ico' };
  const PR: Col<Project> = { head: <span className="ico" title={t('cPrio')}><Flag /></span>, cell: p => <span className="ico" title={p.priority}><Prio v={p.priority} /></span>, cls: 'c-ico' };
  const SX = <R extends { projectId: number }>(): Col<R> => ({ head: S.head, cell: r => S.cell(P(r.projectId)), cls: 'c-ico' });
  const PX = <R extends { projectId: number }>(): Col<R> => ({ head: PR.head, cell: r => PR.cell(P(r.projectId)), cls: 'c-ico' });
  const probCols: Col<Project>[] = [S, PR, { head: fl('title'), cell: link }, { head: t('cHealth'), cell: p => <RagDot v={p.rag} notRated={t('notRated')} />, cls: 'c-ico' },
    { head: fl('pm'), cell: p => <PersonCell p={p.manager} /> }, { head: fl('lastReport'), cell: p => <span title={p.lastReport}>{p.lastReport}</span>, cls: 'wide' },
    { head: t('cRepDate'), cell: p => fmtDate(p.lastUpdate) }];
  const staleCols: Col<Project>[] = [S, PR, { head: fl('title'), cell: link }, { head: fl('pm'), cell: p => <PersonCell p={p.manager} /> },
    { head: fl('last'), cell: p => <FreshDate iso={p.lastUpdate} fresh={freshness(p.lastUpdate, today)} none={t('noReports')} /> },
    { head: t('cStatusOnly'), cell: p => p.status }];
  const decCols: Col<StatusReport>[] = [SX<StatusReport>(), PX<StatusReport>(), { head: fl('rProj'), cell: r => link(P(r.projectId)) },
    { head: fl('rDate'), cell: r => fmtDate(r.date) }, { head: fl('rDecText'), cell: r => r.decisionText, cls: 'wide' }, { head: fl('rAuthor'), cell: r => <PersonCell p={r.author} /> }];
  const riskCols: Col<Risk>[] = [SX<Risk>(), PX<Risk>(), { head: fl('rProj'), cell: k => link(P(k.projectId)) }, { head: fl('kTitle'), cell: k => k.title, cls: 'wide' },
    { head: fl('kType'), cell: k => k.type }, { head: fl('kScore'), cell: k => <Score s={riskScore(k.probability, k.impact)} /> },
    { head: fl('kOwner'), cell: k => <PersonCell p={k.owner} /> },
    { head: fl('kDue'), cell: k => k.due && k.due < today && k.status !== 'Закрито' ? <span className="late">{fmtDate(k.due)}</span> : fmtDate(k.due) }];
  return <>
    <div className="hero"><div><h1 className="page-title">{t('dash')}</h1><p className="page-sub">{t('visible') + vis.length}</p></div>
      {/* форма нового проекта — этап 3; до тех пор стандартная форма списка */}
      <a className="btn primary" href={`${webUrl}/Lists/Projects/NewForm.aspx`}><Plus />{t('newProject')}</a></div>
    <div className="grid2">
      <Wp title={t('wpHealth')}><Donut c={donutCounts(vis)} label={t('wpHealth')} active={t('active')} notRated={t('notRated')} /></Wp>
      <Wp title={t('wpDyn')}><Dynamics pts={snapshots(data.projects, data.reports, today)} label={t('wpDyn')} today={t('today')} hint={t('dynHint')} /></Wp>
    </div>
    <div className="dash">
      <Wp title={t('wpProblem')} more={() => go('projects', 'problem')} moreLabel={t('showAll')}><SimpleTable cols={probCols} rows={prob} empty={t('emptyProblem')} /></Wp>
      <Wp title={t('wpStale')} more={() => go('projects', 'stale')} moreLabel={t('showAll')}><SimpleTable cols={staleCols} rows={stale} empty={t('emptyStale')} /></Wp>
      <Wp title={t('wpDecision')} more={() => go('reports', 'decision')} moreLabel={t('showAll')}><SimpleTable cols={decCols} rows={dec} empty={t('emptyDecision')} /></Wp>
      <Wp title={t('wpRisks')} more={() => go('risks', 'open')} moreLabel={t('showAll')}><SimpleTable cols={riskCols} rows={open} empty={t('emptyRisks')} /></Wp>
    </div></>;
};
```
В `App.tsx` передать `webUrl` (из `pageContext.web.absoluteUrl`) в `App` и дальше в `<Home data={data} webUrl={p.webUrl} />`; в `PmoPortalWebPart.ts` добавить `webUrl: pc.web.absoluteUrl` в свойства `App`.

- [ ] **Step 7: Точка входа** — `PmoPortalWebPart.ts`:
```ts
import * as React from 'react';
import * as ReactDom from 'react-dom';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { App } from './components/App';
import { SpRepo } from './data/SpRepo';

export default class PmoPortalWebPart extends BaseClientSideWebPart<{}> {
  public render(): void {
    const pc = this.context.pageContext;
    const repo = new SpRepo(this.context.spHttpClient, pc.web.absoluteUrl, pc.web.serverRelativeUrl);
    ReactDom.render(React.createElement(App, { repo, culture: pc.cultureInfo.currentUICultureName,
      userName: pc.user.displayName, userEmail: pc.user.email, webUrl: pc.web.absoluteUrl }), this.domElement);
  }
  protected onDispose(): void { ReactDom.unmountComponentAtNode(this.domElement); }
}
```
Удалить сгенерированные `components/PmoPortal.tsx`, `IPmoPortalProps.ts`, `PmoPortal.module.scss`, строки локализации генератора, которые больше не используются.

- [ ] **Step 8:** `scripts/spfx.sh npm run test:unit` → PASS; `scripts/spfx.sh npm run build` → код 0, `.sppkg` пересобран.
- [ ] **Step 9: Commit** — «SPFx: шапка и главная по прототипу …».

---

### Task 8: Установка на `pmo-test`, главная страница, CI и документация

**Files:**
- Create: `scripts/Deploy-App.ps1`
- Modify: `scripts/Invoke-Env.ps1` (действие `app`), `.github/workflows/validate.yml`, `docs/DEPLOYMENT.md`, `CLAUDE.md`, `CHANGELOG.md`, `.claude/settings.json` (разрешить `scripts/spfx.sh:*` и `Invoke-Env.ps1 -Env test -Action app`)

**Interfaces:**
- Consumes: `spfx/sharepoint/solution/pmo-portal.sppkg`, конфиг `test` из `config/environments.json`.
- Produces: `Invoke-Env.ps1 -Env test -Action app` — сборка, каталог приложений сайта, установка/обновление приложения, страница `SitePages/Portal.aspx` (одна веб-часть на весь экран) — главная сайта.

- [ ] **Step 1: `scripts/Deploy-App.ps1`**
```powershell
#Requires -Version 7.2
#Requires -Modules PnP.PowerShell
<#
.SYNOPSIS  Собирает приложение SPFx и ставит его на сайт: каталог приложений сайта -> приложение -> страница Portal -> главная.
.DESCRIPTION Этап 1 — только тестовый сайт (…-test). Каталог тенанта и прод — на этапе 4, с подтверждением человека.
#>
param(
    [Parameter(Mandatory)][string]$SiteUrl, [Parameter(Mandatory)][string]$TenantName, [Parameter(Mandatory)][string]$ClientId,
    [string]$Tenant, [string]$Thumbprint, [string]$CertificatePath, [SecureString]$CertificatePassword, [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
if ($SiteUrl -notmatch '-test/?$') { throw "Этап 1: только тестовый сайт, получено $SiteUrl" }
$root = Split-Path -Parent $PSScriptRoot
$pkg = Join-Path $root "spfx/sharepoint/solution/pmo-portal.sppkg"
if (-not $SkipBuild) { & (Join-Path $PSScriptRoot "spfx.sh") npm run build; if ($LASTEXITCODE) { throw "Сборка SPFx не прошла" } }
if (-not (Test-Path $pkg)) { throw "Нет пакета $pkg" }
function Connect-To([string]$Url) {
    if ($Thumbprint) { Connect-PnPOnline -Url $Url -ClientId $ClientId -Tenant $Tenant -Thumbprint $Thumbprint }
    else { Connect-PnPOnline -Url $Url -ClientId $ClientId -Tenant $Tenant -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword }
}
# 1. каталог приложений сайта (один раз; нужны права администратора SharePoint)
Connect-To "https://$TenantName-admin.sharepoint.com"
$has = Get-PnPSiteCollectionAppCatalog -CurrentSite:$false | Where-Object { $_.AbsoluteUrl.TrimEnd('/') -eq $SiteUrl.TrimEnd('/') }
if (-not $has) { Add-PnPSiteCollectionAppCatalog -Site $SiteUrl; Write-Host "  + каталог приложений сайта" -ForegroundColor Green }
# 2. приложение: загрузить (перезаписать), опубликовать, установить или обновить
Connect-To $SiteUrl
$app = Add-PnPApp -Path $pkg -Scope Site -Overwrite -Publish
$inst = Get-PnPApp -Identity $app.Id -Scope Site
if (-not $inst.InstalledVersion) { Install-PnPApp -Identity $app.Id -Scope Site -Wait; Write-Host "  + приложение установлено" -ForegroundColor Green }
elseif ($inst.CanUpgrade) { Update-PnPApp -Identity $app.Id -Scope Site; Write-Host "  приложение обновлено до $($inst.AppCatalogVersion)" }
# 3. страница приложения на весь экран и главная
if (-not (Get-PnPPage -Identity "Portal" -ErrorAction SilentlyContinue)) {
    $null = Add-PnPPage -Name "Portal" -Title "Портфель проєктів" -LayoutType SingleWebPartAppPage
    Add-PnPPageWebPart -Page "Portal" -Component "Портфель проєктів" | Out-Null
    Set-PnPPage -Identity "Portal" -Publish | Out-Null
    Write-Host "  + страница Portal" -ForegroundColor Green
}
Set-PnPHomePage -RootFolderRelativeUrl "SitePages/Portal.aspx"
Write-Host "Готово: $SiteUrl (прежняя главная — SitePages/Dashboard.aspx)" -ForegroundColor Yellow
```

- [ ] **Step 2: Действие `app` в `Invoke-Env.ps1`** — `ValidateSet` + ветка:
```powershell
} elseif ($Action -eq "app") {
    if ($Env -ne "test") { throw "Действие «app» на этапе 1 — только для test." }
    $a = Get-Auth $cfg.Deploy
    $a.SiteUrl = $siteUrl; $a.TenantName = $cfg.TenantName
    & (Join-Path $PSScriptRoot "Deploy-App.ps1") @a
```

- [ ] **Step 3: Установить и проверить**

Run: `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action app`
Expected: «Готово». Если `Add-PnPSiteCollectionAppCatalog` отказывает по правам приложения — остановиться и попросить пользователя выполнить в терминале `Connect-PnPOnline -Url https://smarthrua-admin.sharepoint.com -ClientId a6293d9d-37bc-4c55-8d67-e080dbc16a26 -DeviceLogin; Add-PnPSiteCollectionAppCatalog -Site https://smarthrua.sharepoint.com/sites/pmo-test`, затем повторить.

Проверка в Chrome (`https://smarthrua.sharepoint.com/sites/pmo-test`) рядом с прототипом (`http://127.0.0.1:8765/pmo-prototype.html`):
- главная открывается на весь экран, шапка «ПП», вкладки, UA/EN/RU, тема;
- «Доступних вам проєктів: 9», кольцо 3/3/2/1 в цветах светофора, динамика 7 столбцов (последний — «сьогодні»), четыре блока с теми же строками, что на стандартной главной;
- тёмная тема и три языка переключаются, выбор сохраняется после перезагрузки;
- проверить, что `EffectiveBasePermissions` приходит в ответе (консоль Chrome, сеть: запрос `items?$select=…EffectiveBasePermissions`); если нет — записать в план этапа 2 отдельный запрос прав.

- [ ] **Step 4: CI** — в `.github/workflows/validate.yml` добавить job:
```yaml
  spfx:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: spfx } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: spfx/package-lock.json }
      - run: npm ci
      - run: npm run test:unit
      - run: npm run build
```

- [ ] **Step 5: Документация**
  - `docs/DEPLOYMENT.md`: раздел «Приложение SPFx» — что это, `brew install node@22`, `scripts/spfx.sh npm run build`, `Invoke-Env.ps1 -Env test -Action app`, прежняя главная `SitePages/Dashboard.aspx`, ограничения (полоса Microsoft 365, hosted workbench до 2026-12-01).
  - `CLAUDE.md`: строки таблицы структуры для `spfx/`, `scripts/spfx.sh`, `scripts/Deploy-App.ps1`, `tests/cases/`; в «Порядок работы» — `scripts/spfx.sh npm run test:unit` рядом с `Test-Scripts.ps1`; правило: бизнес-правила, которые есть и в PowerShell, и в TypeScript, проверяются общими векторами `tests/cases/`.
  - `CHANGELOG.md`: «SPFx, этап 1: каркас, главная по прототипу на `pmo-test`».

- [ ] **Step 6: Проверки и commit**

Run: `pwsh -NoLogo -File tests/Test-Scripts.ps1` → «Все проверки пройдены»; `scripts/spfx.sh npm run test:unit` → PASS.
```bash
git add scripts docs CLAUDE.md CHANGELOG.md .github .claude/settings.json spfx
git commit -m "SPFx, этап 1: установка на pmo-test, главная страница приложения, CI …"
```

---

## Приёмка этапа (человек)

- Главная `pmo-test` в Chrome визуально совпадает с главной прототипа в светлой и тёмной теме, на трёх языках.
- Числа кольца и блоков совпадают с данными сайта (9 активных; «Проблемні» — 5; «Немає свіжого звіту» — 3; «Потребують рішення» — 2; «Відкриті ризики» — 6 первых из 11).
- Решение о переходе к этапу 2 — после этого.
