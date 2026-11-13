# Обновление стека (ноябрь 2026): SPFx 1.24.1, React 18.3.1, Node 26, PnP.PowerShell 3.5.0 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** перевести приложение на SPFx 1.24.1 / React 18.3.1 и сборку на Node 26 LTS, синхронизацию — на PnP.PowerShell 3.5.0, без изменения поведения портала для пользователей.

**Architecture:** функциональность не меняется. Единственное изменение кода приложения — способ монтирования React (`createRoot` вместо `ReactDom.render`), вынесенный в один модуль `reactRoot.ts`, которым пользуются и веб-часть, и тесты. PnP.PowerShell обновляется через **новую** среду выполнения Azure рядом с действующей: тест переключается первым, прод — после проверки, прежняя среда удаляется в конце.

**Tech Stack:** SPFx 1.24.1 (Heft), React 18.3.1, TypeScript ~5.8, Jest 29 + ts-jest, Node 26 LTS, PowerShell 7.6, PnP.PowerShell 3.5.0, Azure Automation, GitHub Actions.

**Spec:** отдельного ТЗ нет — требования к порталу не меняются (`docs/SPEC.md` не трогаем). Основание — сверка версий 13.11.2026 и документы Microsoft:
- https://learn.microsoft.com/en-us/sharepoint/dev/spfx/react-18-upgrade
- https://learn.microsoft.com/en-us/sharepoint/dev/spfx/release-1.24.0 и `release-1.24.1`
- https://learn.microsoft.com/en-us/sharepoint/dev/spfx/compatibility

## Постановка

| Компонент | Сейчас | Цель | Почему |
|---|---|---|---|
| SPFx (все пакеты `@microsoft/sp-*`, `spfx-*`, `eslint-*-spfx`) | 1.23.2 | 1.24.1 | текущий выпуск; условие для React 18 и Node 24 / 26 |
| `react`, `react-dom` | 17.0.1 | 18.3.1 (ровно) | версия, которую поддерживает SPFx 1.24 |
| `@types/react`, `@types/react-dom` | 17.0.45 / 17.0.17 | `^18.3.0` | типы под React 18 |
| `@rushstack/heft` (зависимость и `overrides`) | 1.2.17 | версия из шаблона 1.24.1 (rig требует 1.3.2) | сборочный набор |
| TypeScript | ~5.8.0 | ~5.8.0 | максимум, который поддерживает SPFx 1.24 |
| Node (локально, CI) | 22 | 26 LTS | LTS с 28.10.2026, рекомендован Microsoft для 1.24; поддержка Node 22 заканчивается в апреле 2027 |
| `@azure/msal-browser` | 5.22.0 | 5.29.1 | минорные исправления |
| `@microsoft/agents-copilotstudio-client` | 1.9.1 | 1.10.1 | минорные исправления |
| PnP.PowerShell (локально и в Azure) | 3.4.1 | 3.5.0 | текущий выпуск (11.11.2026) |
| Az.Accounts / Az.Resources (локально) | 5.5.3 / 10.2.1 | 5.5.4 / 10.2.2 | мелкие исправления |

Не входит (YAGNI): React 19, TypeScript 7, ESLint 10, Jest 30 для наших тестов, Fluent UI v9, новые возможности React 18 (transitions, Suspense), Copilot UX components.

Известный остаток: уязвимость `zod` (GHSA-mrhx-c7xc-m3w5) внутри клиента Copilot Studio — исправление только в `zod` 4.6.6, клиент 1.10.1 закрепляет `zod` 3.25.75. Подмена на 4.x — смена мажорной версии чужой зависимости, не делаем; фиксируем в `CHANGELOG.md` как принятый риск (клиент разбирает ответы только нашего агента Copilot Studio) и проверяем на следующем обновлении стека.

## Global Constraints

- **Старт — только после выпуска «Підтримка» 1.7.12 на прод** (решение владельца 13.11.2026). Ветка `change/stack-2026-11` — от свежего `origin/main`.
- Поведение портала не меняется: ни одно ожидание (`expect`) в существующих тестах не ослабляется и не удаляется. Тест упал после перехода — разбираем причину (`superpowers:systematic-debugging`), а не правим ожидание.
- `react` и `react-dom` — ровно `18.3.1` (без `^`). Все пакеты SPFx — ровно `1.24.1`.
- Никогда: `npm audit fix --force`, `npm install --force`, `--legacy-peer-deps`.
- Все команды в `spfx/` — через `scripts/spfx.sh`. Перед каждым коммитом кода `spfx/` — `scripts/spfx.sh npm run build`.
- После каждого этапа: `pwsh -NoLogo -File tests/Test-Scripts.ps1` и `scripts/spfx.sh npm run test:unit` проходят.
- Прод (`-Env prod`, `Publish-Runbook.ps1 -Env prod`, слияние в `main`) — только владелец после явного «да». `certs/`, `*.pfx`, `config/environments.json` не читать и не выводить.
- Версия приложения и выпуск в `docs/RELEASES.{uk,en,ru}.md` — последним коммитом ветки, после rebase.
- Сообщения коммитов — на русском, с `Co-Authored-By`.

## Файлы

| Файл | Что меняется |
|---|---|
| `spfx/package.json`, `spfx/package-lock.json` | версии, `overrides`, `resolutions`, `engines` |
| `spfx/.yo-rc.json` | `version`, `nodeVersion` |
| `spfx/src/webparts/pmoPortal/components/reactRoot.ts` | **новый**: один корень React на контейнер (`renderInto`, `disposeRoot`) |
| `spfx/src/webparts/pmoPortal/PmoPortalWebPart.ts` | монтирование через `reactRoot` |
| `spfx/src/**/*.tsx` | явное `children` там, где укажет компилятор |
| `spfx/test/reactRoot.test.tsx` | **новый**: поведение корня |
| `spfx/test/react18-guard.test.ts` | **новый**: в коде не осталось прежнего API |
| `spfx/test/*.test.tsx` (16 файлов с рендером) | `renderInto` / `disposeRoot`, `act` из `react` |
| `spfx/jest.config.js` | `IS_REACT_ACT_ENVIRONMENT` |
| `scripts/spfx.sh`, `.github/workflows/validate.yml` | Node 26 |
| `scripts/New-PMOAutomation.ps1`, `scripts/Publish-Runbook.ps1` | значения по умолчанию: среда `PowerShell-7.6-PnP35`, PnP 3.5.0 |
| `README.md`, `spfx/README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/SETUP-CLAUDE-CODE.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/commands/release-prod.md` | версии стека, имя среды Azure |
| `CHANGELOG.md`, `docs/RELEASES.{uk,en,ru}.md`, `spfx/config/package-solution.json` | запись и выпуск |

---

### Task 0: Исходная точка

**Files:** ничего не меняется (заметки — в scratchpad сессии).

- [x] **Step 1: Ветка от свежего main**

```bash
export SCRATCH=<каталог scratchpad сессии>   # задать в каждой новой оболочке; всё временное — только туда
git fetch origin && git switch -c change/stack-2026-11 origin/main
```
Проверить: `grep -n '"version"' spfx/config/package-solution.json` — версия уже с «Підтримкою» (1.7.12.x). Если нет — стоп, выпуск ещё не слит.

- [x] **Step 2: Исходные показатели**

```bash
scripts/spfx.sh npm ci
scripts/spfx.sh npm run test:unit 2>&1 | tail -6     # записать: наборов и тестов
scripts/spfx.sh npm run build 2>&1 | tail -15         # записать: предупреждения
ls -l spfx/sharepoint/solution/pmo-portal.sppkg
(cd spfx/dist && shasum -a 256 *.js | sort) > "$SCRATCH/dist-before.txt"
scripts/spfx.sh npm audit --omit=dev 2>&1 | tail -4
scripts/spfx.sh npm audit 2>&1 | tail -4
pwsh -NoLogo -File tests/Test-Scripts.ps1
```
Сохранить копию `pmo-portal.sppkg` в scratchpad — известный рабочий пакет для отката.

- [x] **Step 3: Отчёт об обновлении и проект для сравнения**

```bash
cd spfx && npx -p @pnp/cli-microsoft365@latest m365 spfx project upgrade --toVersion 1.24.1 --output md > "$SCRATCH/upgrade-report.md"
```
В пустой папке scratchpad сгенерировать проект 1.24.1 (веб-часть, React) — только для сравнения `package.json`, `tsconfig.json`, `eslint.config.js`, `config/*.json`:
```bash
mkdir "$SCRATCH/spfx-1241" && cd "$SCRATCH/spfx-1241" && npx -p yo -p @microsoft/generator-sharepoint@1.24.1 yo @microsoft/sharepoint --solution-name cmp --component-type webpart --component-name Cmp --framework react --skip-install
```
Выписать из шаблона точные версии: `@rushstack/heft`, `typescript`, `eslint`, `@types/webpack-env`, `css-loader`, `@microsoft/eslint-*`, содержимое `overrides` / `resolutions`, отличия в `config/` и `tsconfig.json`. Поверх существующего проекта генератор не запускать.

**Критерий приёмки:** записаны число тестов, предупреждения сборки, хэши `dist`, итоги `npm audit`; есть отчёт и проект для сравнения.

---

### Task 1: Пакеты SPFx 1.24.1 и React 18.3.1

**Files:** Modify `spfx/package.json`, `spfx/package-lock.json`, `spfx/.yo-rc.json`, компоненты в `spfx/src/**` (только типы `children`), при необходимости `spfx/config/*.json`, `spfx/tsconfig.json`.

**Interfaces:** Produces — проект собирается на SPFx 1.24.1 / React 18.3.1; рендер пока прежний (`ReactDom.render` в React 18 работает с предупреждением) — его меняет Task 2.

- [x] **Step 1: Версии в package.json (до установки)**

```bash
cd spfx
for p in sp-component-base sp-core-library sp-lodash-subset sp-office-ui-fabric-core sp-property-pane sp-webpart-base; do npm pkg set "dependencies.@microsoft/$p=1.24.1"; done
for p in eslint-config-spfx eslint-plugin-spfx sp-module-interfaces spfx-heft-plugins spfx-web-build-rig; do npm pkg set "devDependencies.@microsoft/$p=1.24.1"; done
npm pkg set "dependencies.react=18.3.1" "dependencies.react-dom=18.3.1"
npm pkg set "devDependencies.@types/react=^18.3.0" "devDependencies.@types/react-dom=^18.3.0"
npm pkg set "resolutions.@types/react=^18.3.0"
```
`resolutions` — механизм Yarn, npm его не применяет: строка остаётся только ради совпадения с шаблоном. `engines.node` на этом этапе не трогаем (сборка пока на Node 22, диапазон `>=22.14.0 < 23.0.0` верен) — его меняет Task 5.
`@rushstack/heft` — в `devDependencies` **и** в `overrides` поставить версию из шаблона (Task 0, Step 3). Остальные сборочные зависимости (`typescript`, `eslint`, `@types/webpack-env`, `css-loader`) — привести к шаблону, только если шаблон отличается; `typescript` выше `~5.8` не поднимать.

- [x] **Step 2: Установка и проверка дерева**

```bash
scripts/spfx.sh npm install
scripts/spfx.sh npm ls react react-dom @types/react @types/react-dom
```
Ожидается: у проекта `react@18.3.1`, `react-dom@18.3.1`, **одна** версия `@types/react` 18.x (без дубля 17.x; если дубль есть — добавить `overrides.@types/react` = `^18.3.0` и переустановить), без `invalid` / `ERESOLVE`. Собственные вложенные `react@17.0.1` у пакетов `@microsoft/sp-*` — допустимы, не подменять (так сказано в руководстве Microsoft). Конфликт пиров — разобраться с конкретной библиотекой, не `--force`.

- [x] **Step 3: Применить отличия конфигурации**

Пройти `upgrade-report.md` и сравнение с шаблоном: каждое отличие в `config/*.json`, `tsconfig.json`, `eslint.config.js` либо перенести, либо записать, почему не нужно (наши настройки: `config/webpack-patch.*`, `tsconfig.jest.json`, свой `jest.config.js` — сохранить). В `.yo-rc.json`: `"version": "1.24.1"`.

- [x] **Step 4: Типы — явное `children`**

```bash
scripts/spfx.sh npx tsc --noEmit -p tsconfig.json 2>&1 | tee "$SCRATCH/tsc-18.txt" | tail -40
```
Для каждой ошибки вида `Property 'children' does not exist on type …` — добавить в пропсы компонента `children?: React.ReactNode` (обязательное `children: React.ReactNode`, если компонент без содержимого не имеет смысла). Без `any`, приведений и `@ts-ignore`. Другие ошибки типов (`ReactNode`, JSX) — сначала `scripts/spfx.sh npm explain @types/react` (две версии типов?), потом правка.

- [x] **Step 5: Тесты и сборка**

```bash
scripts/spfx.sh npm run test:unit 2>&1 | tail -8
scripts/spfx.sh npm run build 2>&1 | tail -20
```
Ожидается: то же число тестов, все проходят (в выводе допустимы предупреждения `ReactDOM.render is no longer supported` и об `act` из `react-dom/test-utils` — уйдут в Task 2–3); сборка даёт `pmo-portal.sppkg`. Тест упал — причина в поведении React 18, а не в рендере? Тогда `superpowers:systematic-debugging`; ожидание не менять.

- [x] **Step 6: Коммит**

```bash
git add spfx/package.json spfx/package-lock.json spfx/.yo-rc.json spfx/src spfx/config spfx/tsconfig.json
git commit -m "Стек: SPFx 1.24.1, React 18.3.1 (пакеты и типы)"
```

**Критерий приёмки:** `npm ls` чистый; `tsc`, тесты и сборка проходят; ожидания тестов не тронуты (`git diff origin/main -- spfx/test` пуст).

---

### Task 2: Один корень React — `reactRoot.ts` и веб-часть

**Files:**
- Create: `spfx/src/webparts/pmoPortal/components/reactRoot.ts`
- Create: `spfx/test/reactRoot.test.tsx`
- Modify: `spfx/src/webparts/pmoPortal/PmoPortalWebPart.ts:1-2,47-53`
- Modify: `spfx/jest.config.js`

**Interfaces:** Produces —
```ts
export function renderInto(container: Element, element: React.ReactElement): void; // создаёт корень один раз, дальше обновляет
export function disposeRoot(container: Element): void;                             // размонтирует и забывает корень; повторный вызов безопасен
```
Ими пользуются веб-часть и (Task 3) все тесты с рендером.

- [x] **Step 1: Тест, который падает**

`spfx/test/reactRoot.test.tsx`:
```tsx
/** @jest-environment jsdom */
import * as React from 'react';
import { act } from 'react';
import { renderInto, disposeRoot } from '../src/webparts/pmoPortal/components/reactRoot';

// Корень React создаётся один раз на контейнер: повторный render() веб-части обновляет дерево, а не пересоздаёт его
let mounts = 0; let cleanups = 0;
const Probe: React.FC<{ label: string }> = ({ label }) => {
  const [n, setN] = React.useState(0);
  React.useEffect(() => { mounts++; return () => { cleanups++; }; }, []);
  return <button id="b" onClick={() => setN(n + 1)}>{label}:{n}</button>;
};
let box: HTMLDivElement;
beforeEach(() => { mounts = 0; cleanups = 0; box = document.createElement('div'); document.body.appendChild(box); });
afterEach(() => { act(() => { disposeRoot(box); }); box.remove(); });
const click = (): void => { act(() => { (box.querySelector('#b') as HTMLButtonElement).click(); }); };

test('повторный renderInto обновляет пропсы и сохраняет состояние — без повторного монтирования', () => {
  act(() => { renderInto(box, <Probe label="a" />); });
  click();
  expect(box.textContent).toBe('a:1');
  act(() => { renderInto(box, <Probe label="b" />); });
  expect(box.textContent).toBe('b:1');
  expect(mounts).toBe(1);
});

test('disposeRoot размонтирует (эффекты убраны, контейнер пуст); повторный вызов безопасен', () => {
  act(() => { renderInto(box, <Probe label="a" />); });
  act(() => { disposeRoot(box); });
  expect(cleanups).toBe(1);
  expect(box.innerHTML).toBe('');
  expect(() => disposeRoot(box)).not.toThrow();
});

test('после disposeRoot renderInto создаёт новый корень', () => {
  act(() => { renderInto(box, <Probe label="a" />); });
  act(() => { disposeRoot(box); });
  act(() => { renderInto(box, <Probe label="c" />); });
  expect(box.textContent).toBe('c:0');
  expect(mounts).toBe(2);
});

test('два контейнера — два независимых корня', () => {
  const other = document.createElement('div'); document.body.appendChild(other);
  act(() => { renderInto(box, <Probe label="a" />); renderInto(other, <Probe label="z" />); });
  act(() => { disposeRoot(other); });
  expect(box.textContent).toBe('a:0');
  expect(other.innerHTML).toBe('');
  other.remove();
});
```

В `spfx/jest.config.js` добавить в `module.exports`:
```js
  globals: { IS_REACT_ACT_ENVIRONMENT: true },
```

- [x] **Step 2: Убедиться, что падает**

Run: `scripts/spfx.sh npx jest test/reactRoot.test.tsx`
Expected: FAIL — `Cannot find module '../src/webparts/pmoPortal/components/reactRoot'`.

- [x] **Step 3: Реализация**

`spfx/src/webparts/pmoPortal/components/reactRoot.ts`:
```ts
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';

/** Корни React по контейнерам: корень создаётся один раз, повторный рендер обновляет дерево (React 18). */
const roots = new WeakMap<Element, Root>();

/** Нарисовать элемент в контейнере: первый вызов создаёт корень, следующие — обновляют его, состояние сохраняется. */
export function renderInto(container: Element, element: React.ReactElement): void {
  let root = roots.get(container);
  if (!root) { root = createRoot(container); roots.set(container, root); }
  root.render(element);
}

/** Размонтировать дерево контейнера и забыть корень; без корня — ничего не делает. */
export function disposeRoot(container: Element): void {
  const root = roots.get(container);
  if (!root) return;
  root.unmount();
  roots.delete(container);
}
```

- [x] **Step 4: Убедиться, что проходит**

Run: `scripts/spfx.sh npx jest test/reactRoot.test.tsx`
Expected: PASS, 4 теста, без предупреждений React в выводе.

- [x] **Step 5: Веб-часть**

В `spfx/src/webparts/pmoPortal/PmoPortalWebPart.ts`:
- строку `import * as ReactDom from 'react-dom';` заменить на `import { renderInto, disposeRoot } from './components/reactRoot';`
- в `renderApp()`: `ReactDom.render(React.createElement(App, { … }), this.domElement);` → `renderInto(this.domElement, React.createElement(App, { … }));` (пропсы без изменений);
- `onDispose()`: `ReactDom.unmountComponentAtNode(this.domElement);` → `disposeRoot(this.domElement);`

- [x] **Step 6: Сборка и коммит**

```bash
scripts/spfx.sh npm run build 2>&1 | tail -15
git add spfx/src/webparts/pmoPortal/components/reactRoot.ts spfx/src/webparts/pmoPortal/PmoPortalWebPart.ts spfx/test/reactRoot.test.tsx spfx/jest.config.js
git commit -m "Стек: рендер React 18 — один корень на контейнер (reactRoot)"
```

**Критерий приёмки:** `grep -rn "react-dom'" spfx/src` находит только `react-dom/client` в `reactRoot.ts`; 4 новых теста проходят; сборка проходит.

---

### Task 3: Тесты с рендером — на React 18, и тест-сторож

**Files:**
- Create: `spfx/test/react18-guard.test.ts`
- Modify (16): `spfx/test/{aiEvalPage,aiSwitch,budgetUi,components,countriesPanel,feedbackSend,parentUi,r5coverage,r8Finance,r8Improvements,regression-r1,regression-r2,regression-r3,regression-r4,reportAi,support}.test.tsx`

**Interfaces:** Consumes — `renderInto(container, element)`, `disposeRoot(container)` из Task 2.

- [x] **Step 1: Тест-сторож (падает)**

`spfx/test/react18-guard.test.ts`:
```ts
import * as fs from 'fs';
import * as path from 'path';

// Класс ошибки: рендер прежним API React 17 оставляет дерево в режиме совместимости (и тесты проверяют не то, что работает на портале)
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
const root = path.join(__dirname, '..');
const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'test'))].filter(f => !f.endsWith('react18-guard.test.ts'));
// 'react-dom' целиком запрещён (любой алиас и именованный импорт render); разрешены только react-dom/client в reactRoot.ts
// и react-dom/test-utils ради Simulate
const legacy: [string, RegExp][] = [
  ['импорт react-dom', /from\s*['"]react-dom['"]|require\(\s*['"]react-dom['"]\s*\)/],
  ['unmountComponentAtNode', /unmountComponentAtNode/],
  ['act из react-dom/test-utils', /import\s*\{[^}]*\bact\b[^}]*\}\s*from\s*['"]react-dom\/test-utils['"]/],
  ['createRoot вне reactRoot.ts', /\bcreateRoot\(|from\s*['"]react-dom\/client['"]/]
];

test('в приложении и тестах нет прежнего API рендера React 17; createRoot — только в reactRoot.ts', () => {
  const found: string[] = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const [name, re] of legacy) {
      if (name.startsWith('createRoot') && f.endsWith(path.join('components', 'reactRoot.ts'))) continue;
      if (re.test(text)) found.push(path.relative(root, f) + ': ' + name);
    }
  }
  expect(found).toEqual([]);
});

test('сторож видит файлы (не пустой обход)', () => {
  expect(files.length).toBeGreaterThan(100);
});
```
Run: `scripts/spfx.sh npx jest test/react18-guard.test.ts` → FAIL со списком 16 файлов тестов.
(Порог `100` сверить с фактом: `find spfx/src spfx/test -name '*.ts' -o -name '*.tsx' | wc -l`; поставить число чуть ниже фактического.)

- [x] **Step 2: Перевести файлы тестов (в каждом из 16 — одинаково)**

| Было | Стало |
|---|---|
| `import * as ReactDOM from 'react-dom';` | удалить; добавить `import { renderInto, disposeRoot } from '../src/webparts/pmoPortal/components/reactRoot';` |
| `import { act, Simulate } from 'react-dom/test-utils';` | `import { act } from 'react';` и `import { Simulate } from 'react-dom/test-utils';` |
| `ReactDOM.render(<X />, root)` | `renderInto(root, <X />)` (остаётся внутри того же `act`) |
| `ReactDOM.unmountComponentAtNode(root)` внутри `act` | `disposeRoot(root)` |
| `ReactDOM.unmountComponentAtNode(root)` вне `act` | `act(() => { disposeRoot(root); })` |
| действие, меняющее состояние, вне `act`: `document.dispatchEvent(…)`, `el.click()`, `window.dispatchEvent(…)`, таймер (пример — `regression-r2.test.tsx:43-47`, `visibilitychange`) | то же действие внутри `act(() => { … })` |

Сначала перевести **один** файл (`parentUi.test.tsx`) и прогнать его: убедиться, что `act` из `react` вместе с `Simulate` из `react-dom/test-utils` не даёт предупреждений в React 18.3.1. Даёт — стоп: заменить `Simulate` в общем решении (и сообщить пользователю), а не править 16 файлов вслепую.

Больше ничего в тестах не менять: ни ожидания, ни сценарии. Если файл использует из `react-dom` что-то ещё (`createPortal`) — оставить именованный импорт только этого.

- [x] **Step 3: Прогон и разбор**

```bash
scripts/spfx.sh npm run test:unit 2>&1 | tee "$SCRATCH/jest-18.txt" | tail -12
grep -cE "Warning:|not wrapped in act|is no longer supported|deprecated" "$SCRATCH/jest-18.txt"
```
Ожидается: число тестов = исходное + 6 (4 + 2), все проходят, счётчик предупреждений — 0.
- Тест упал: вероятные причины — обновление состояния после `await` теперь объединяется (нужно дождаться внутри `await act(async () => { … })`), или эффект срабатывает позже. Править **способ ожидания** в тесте (обернуть действие в `act`, дождаться промиса), не ожидаемое значение. Если падение показывает реальное изменение поведения компонента — это находка: стоп, `superpowers:systematic-debugging`, сообщить пользователю.
- Предупреждение `not wrapped in act` — действие теста вне `act`: обернуть.

- [x] **Step 4: Проверить, что сторож ловит**

Временно вернуть `ReactDOM.render` в один тест → `react18-guard` падает с именем файла → вернуть обратно. Записать в итог как доказательство.

- [x] **Step 5: Сборка и коммит**

```bash
scripts/spfx.sh npm run build 2>&1 | tail -15
git add spfx/test
git commit -m "Стек: тесты с рендером — на корне React 18, тест-сторож прежнего API"
```

**Критерий приёмки:** все тесты проходят; 0 предупреждений React в выводе Jest; набор ожиданий не изменился — для каждого из 16 файлов список вхождений `expect(…)` до и после совпадает:
```bash
for f in $(git diff --name-only origin/main -- spfx/test | grep -vE 'reactRoot|react18-guard'); do
  diff <(git show origin/main:$f | grep -oE 'expect\(.*' ) <(grep -oE 'expect\(.*' $f) >/dev/null || echo "ИЗМЕНЕНЫ ОЖИДАНИЯ: $f"
done
```
(строки, где `expect` стоит после `unmountComponentAtNode` на той же строке, как `r8Improvements.test.tsx:136`, сравниваются с позиции `expect(` — правка рендера на них не влияет). Вывод пуст.

---

### Task 4: Минорные зависимости и аудит

**Files:** Modify `spfx/package.json`, `spfx/package-lock.json`.

- [x] **Step 1: Обновить**

```bash
cd spfx
npm pkg set "dependencies.@azure/msal-browser=5.29.1" "dependencies.@microsoft/agents-copilotstudio-client=1.10.1"
cd .. && scripts/spfx.sh npm install && scripts/spfx.sh npm update @fluentui/react
```
Перед этим прочитать заметки о выпусках `@azure/msal-browser` 5.23–5.29 (https://github.com/AzureAD/microsoft-authentication-library-for-js/releases) на изменения всплывающего окна, `redirect-bridge` и кэша — их использует `ai/aiAgent`. Есть изменение поведения — оставить 5.22.0 и записать причину.

- [x] **Step 2: Пересмотреть `overrides`**

Для каждой строки `overrides` (`follow-redirects`, `launch-editor`, `postcss-selector-parser`, `qs`, `shell-quote`, `source-map-js`, `uuid`): временно убрать → `npm install` → `npm audit`. Уязвимость не вернулась — строку удалить (SPFx 1.24.1 сам принёс исправление); вернулась — оставить. Итог — таблицей «пакет → оставлен / убран / почему».

- [x] **Step 3: Аудит, тесты, сборка, коммит**

```bash
scripts/spfx.sh npm audit --omit=dev 2>&1 | tail -6
scripts/spfx.sh npm audit 2>&1 | tail -6
scripts/spfx.sh npm run test:unit 2>&1 | tail -6 && scripts/spfx.sh npm run build 2>&1 | tail -10
git add spfx/package.json spfx/package-lock.json
git commit -m "Стек: msal-browser 5.29.1, клиент Copilot Studio 1.10.1, пересмотр overrides"
```

**Критерий приёмки:** в рабочих зависимостях остаётся только цепочка `zod` (принятый риск); число уязвимостей с инструментами сборки — не больше исходных 40, разница записана.

---

### Task 5: Node 26 LTS

**Files:** Modify `scripts/spfx.sh`, `.github/workflows/validate.yml`, `spfx/.yo-rc.json`, `spfx/package.json` (`engines`).

- [x] **Step 1: Собрать на Node 22 — эталон, и проверить, что сборка воспроизводима**

```bash
scripts/spfx.sh npm run build >/dev/null 2>&1 && (cd spfx/dist && shasum -a 256 * | sort -k2) > "$SCRATCH/dist-node22.txt"
scripts/spfx.sh npm run build >/dev/null 2>&1 && (cd spfx/dist && shasum -a 256 * | sort -k2) > "$SCRATCH/dist-node22-b.txt"
diff "$SCRATCH/dist-node22.txt" "$SCRATCH/dist-node22-b.txt" && echo "сборка воспроизводима"
```
Два прогона на одном Node различаются — сравнение с Node 26 ничего не докажет: записать это и в Step 4 сравнение пропустить.

- [x] **Step 2: `scripts/spfx.sh` — Node 26**

```bash
#!/usr/bin/env bash
# Запускает команду в spfx/ под Node 26 LTS (SPFx 1.24 поддерживает 22, 24 и 26). Системный Node не трогается.
set -euo pipefail
if command -v brew >/dev/null 2>&1 && [ -x "$(brew --prefix node@26 2>/dev/null)/bin/node" ]; then
  export PATH="$(brew --prefix node@26)/bin:$PATH"
fi
node -v | grep -q '^v26\.' || { echo "Нужен Node 26: brew install node@26" >&2; exit 1; }
cd "$(dirname "$0")/../spfx"
exec "$@"
```
Перед правкой: `brew install node@26` и `"$(brew --prefix node@26)/bin/node" -v` → `v26.13.x` или новее (не `alpha`). `node@22` не удалять до конца выпуска.

- [x] **Step 3: Остальное**

- `.github/workflows/validate.yml`: `node-version: 22` → `node-version: 26` (оба задания).
- `spfx/package.json`: `"engines": { "node": ">=26.0.0 <27.0.0" }` (единственная правка `engines` в плане).
- `spfx/.yo-rc.json`: `"nodeVersion"` — фактический вывод `node -v` без `v`.

- [x] **Step 4: Чистая установка, тесты, сборка, сравнение**

```bash
# 1) тот же node_modules, другой Node — чистое сравнение
scripts/spfx.sh npm run build 2>&1 | tail -10
(cd spfx/dist && shasum -a 256 * | sort -k2) > "$SCRATCH/dist-node26.txt"
diff "$SCRATCH/dist-node22.txt" "$SCRATCH/dist-node26.txt" && echo "бандл не изменился"
# 2) чистая установка под Node 26 — как в CI
rm -rf spfx/node_modules && scripts/spfx.sh npm ci
scripts/spfx.sh npm run test:unit 2>&1 | tail -6
scripts/spfx.sh npm run build 2>&1 | tail -10
pwsh -NoLogo -File tests/Test-Scripts.ps1
```
Ожидается: тесты и сборка проходят под Node 26 — это главный критерий; `package-lock.json` после `npm ci` не изменён (`git status`). Если сборка воспроизводима (Step 1), а `diff` не пуст — разобраться, в чём отличие, и записать вывод (это повод посмотреть, а не автоматический провал).

- [x] **Step 5: Коммит**

```bash
git add scripts/spfx.sh .github/workflows/validate.yml spfx/package.json spfx/.yo-rc.json
git commit -m "Стек: сборка и CI на Node 26 LTS"
```

**Критерий приёмки:** тесты, сборка и `Test-Scripts.ps1` проходят под Node 26 после чистой `npm ci` (пояс `Europe/Kyiv` в `jest.config.js` работает); сравнение бандла с Node 22 выполнено и его итог записан (совпал / отличие объяснено / сборка невоспроизводима).

---

### Task 6: PnP.PowerShell 3.5.0 — локально и новая среда Azure (тест)

**Files:** Modify `scripts/New-PMOAutomation.ps1:24-25`, `scripts/Publish-Runbook.ps1:21`; при правке `PMO.Common.ps1` / `Invoke-PMOSync.ps1` — `runbooks/Invoke-PMOSync.ps1` только через `scripts/Build-Runbook.ps1`.

Действующая среда `PowerShell-7.6-PnP` общая для `PMO-Sync` (прод) и `PMO-Sync-Test`: менять пакет в ней нельзя — прод сразу получил бы непроверенную версию. Поэтому — новая среда.

- [ ] **Step 1: Прочитать заметки о выпуске**

https://github.com/pnp/powershell/releases (3.5.0): выписать breaking changes и изменения командлетов, которые мы используем (`grep -ohE '\b(Get|Set|Add|New|Remove|Invoke|Connect|Grant|Revoke|Move|Copy)-PnP[A-Za-z]+' scripts/*.ps1 | sort -u` — сверить весь список с заметками: таблица «командлет → затронут / нет»).

- [ ] **Step 2: Локально**

```powershell
Install-Module PnP.PowerShell -RequiredVersion 3.5.0 -Scope CurrentUser -Force
Update-Module Az.Accounts, Az.Resources -Scope CurrentUser
Get-Module -ListAvailable Az.Automation | Select-Object Version   # 1.12.1 — последняя на 13.11.2026; новее в галерее — обновить тоже
```
`pwsh -NoLogo -File tests/Test-Scripts.ps1` → проходит. `Get-Module -ListAvailable PnP.PowerShell` — 3.5.0 и 3.4.1 (прежнюю не удалять до конца выпуска).

- [ ] **Step 3: Тестовый сайт на 3.5.0 (до и после — права)**

```bash
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action acl-export -File "$SCRATCH/acl-before.json"
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action deploy
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync-dryrun
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action sync
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action rebuild-permissions
pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action acl-export -File "$SCRATCH/acl-after.json"
```
Сравнить два файла: различий в правах быть не должно (кроме записей, созданных за это время). `deploy` повторно — без изменений (идемпотентность). Расписания `PMO-Sync-Test` выключены по умолчанию (память `test-sync-on-demand`) — на время проверки не включать, чтобы Azure не писал параллельно.

- [ ] **Step 4: Значения по умолчанию в скриптах**

- `scripts/New-PMOAutomation.ps1`: `$RuntimeName = "PowerShell-$PsVersion-PnP35"`, `$PnPVersion = "3.5.0"`; в шапке — строка «С <дата> — среда `PowerShell-7.6-PnP35` (PnP.PowerShell 3.5.0); прежняя `PowerShell-7.6-PnP` удаляется после перевода прода».
- `scripts/Publish-Runbook.ps1`: `$RuntimeName = "PowerShell-7.6-PnP35"`.

`pwsh -NoLogo -File tests/Test-Scripts.ps1` → проходит. Коммит: `Стек: PnP.PowerShell 3.5.0, среда Azure PowerShell-7.6-PnP35`.

- [ ] **Step 5: Создать среду в Azure (владелец; меняет только новый ресурс)**

`scripts/New-PMOAutomation.ps1 -Wait` — создаёт `PowerShell-7.6-PnP35` и импортирует PnP 3.5.0 (10–30 минут); существующие runbook и расписания не трогает (проверить по выводу: только строки `+ среда выполнения`, `+ импорт`). Только в сессии владельца и после его «да» (`team.md`: ресурсы Azure — владелец); в сессии разработчика — подготовить команду и описание для владельца, не запускать.

- [ ] **Step 6: Runbook теста на новой среде**

```bash
pwsh -NoLogo -File scripts/Build-Runbook.ps1
pwsh -NoLogo -File scripts/Publish-Runbook.ps1 -Env test
```
Смена среды у **существующего** runbook через `PUT` (`Publish-Runbook.ps1:59`) раньше не делалась, а строка «Опубликовано: … ($RuntimeName)» печатает параметр, а не ответ Azure. Поэтому проверить фактическое состояние (только чтение):
```powershell
$sub = (Get-AzContext).Subscription.Id
$rb = "/subscriptions/$sub/resourceGroups/rg-pmo-automation/providers/Microsoft.Automation/automationAccounts/aa-pmo-sync/runbooks"
foreach ($n in "PMO-Sync-Test", "PMO-Sync") { "{0}: {1}" -f $n, ((Invoke-AzRestMethod -Method GET -Path "$rb/$n`?api-version=2023-05-15-preview").Content | ConvertFrom-Json).properties.runtimeEnvironment }
Get-AzAutomationScheduledRunbook -ResourceGroupName rg-pmo-automation -AutomationAccountName aa-pmo-sync | Select-Object RunbookName, ScheduleName
```
(версия API — та же, что `$API` в `Publish-Runbook.ps1:25`.) Ожидается: `PMO-Sync-Test: PowerShell-7.6-PnP35`, `PMO-Sync: PowerShell-7.6-PnP`, привязки расписаний — те же, что до публикации (снять список до Step 6 и сравнить). Если `PUT` среду не сменил — стоп: доработать `Publish-Runbook.ps1` (PATCH `properties.runtimeEnvironment`) отдельным коммитом с проверкой в `tests/Test-Scripts.ps1`, согласовать с пользователем. Тем же способом проверить откат: `Publish-Runbook.ps1 -Env test -RuntimeName PowerShell-7.6-PnP` → среда вернулась → снова опубликовать на `PnP35`.

Проверочный runbook на новой среде публикуется отдельно (у него нет расписания): `pwsh -NoLogo -File scripts/Publish-Runbook.ps1 -Name PMO-WhoAmI -RuntimeName PowerShell-7.6-PnP35` (`-Name` принимает `PMO-Sync` и `PMO-WhoAmI`, `Publish-Runbook.ps1:17`), запустить вручную для тестового сайта.

Затем: один запуск `PMO-Sync-Test` в пробном режиме и один рабочий (включить расписание теста по правилу `test-sync-on-demand`, дождаться одного запуска по расписанию, выключить). В журнале задания — без ошибок и предупреждений о модулях; повторный `acl-export` совпадает с `acl-after.json`.

**Критерий приёмки:** таблица командлетов «N/N, 0 затронутых без проверки»; права на тесте до и после совпадают; `PMO-Sync-Test` отработал на `PowerShell-7.6-PnP35` по расписанию; `PMO-Sync` (прод) по-прежнему на прежней среде.

---

### Task 7: Тестовый сайт — приложение

**Files:** нет (выкладка и проверка).

- [ ] **Step 1: Версия — до выкладки.** `git fetch && git rebase origin/main`. `Deploy-App.ps1` обновляет приложение на сайте только при более высокой версии пакета, а 1.7.12.x на тесте уже стоит: с прежней версией проверка прошла бы на старом бандле. Поэтому поднять версию сейчас: `spfx/config/package-solution.json` (оба места) — следующая после той, что в `main` (ожидаемо `1.7.13.0`); выпуск во все три `docs/RELEASES.{uk,en,ru}.md`: «Технічне оновлення: новіші версії складових порталу. Для користувачів нічого не змінилося.» (en / ru — перевод); `scripts/spfx.sh npm run guide`; тесты; сборка; коммит «Версия 1.7.13.0: заметки о выпуске (uk / en / ru)».
- [ ] **Step 1a: Выкладка и проверка, что на сайте новый код.** `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action app`. В браузере: версия в «Довідка» = новая; имя загруженного файла `pmo-portal-web-part_<хэш>.js` (вкладка сети) совпадает с файлом в `spfx/dist/`.
- [ ] **Step 2: Проверка в браузере** (встроенный браузер, `/sites/pmo-test`; консоль открыта):
  - консоль без `ReactDOM.render is no longer supported`, `createRoot() on a container that has already been passed`, `Invalid hook call`, необработанных ошибок;
  - главная (поточні / підтримка / архів), карточка проекта, фильтры в заголовках таблиц, сортировка;
  - новый проект (PMO), правка карточки, «Призначення»;
  - статус-отчёт с изменением показателей и причиной → погодження PMO → после `sync` показатели в карточке;
  - риск, комментарий, команда проекта, «Країни і CEO»;
  - колокольчик: событие открывается и помечается прочитанным;
  - «Помічник ШІ»: включение (всплывающее окно MSAL), «Чернетка», «Перевірка»;
  - «Довідка», «Що змінилося», отзыв со скриншотом;
  - три языка, светлая и тёмная тема, ширина телефона (375 px);
  - изменение размера окна и переход между экранами не сбрасывают введённое в форму.
- [ ] **Step 3:** владелец проверяет на iPhone вход «Помічник ШІ» с переходом на страницу Microsoft (ветка `aiHandleRedirect` в веб-части) — в jsdom не покрыта.
- [ ] **Step 4:** сообщить пользователю: на тесте код ветки `change/stack-2026-11`, а не `main`; перечислить, что изменилось.

**Критерий приёмки:** все сценарии пройдены, консоль чистая; находки — сначала тест, потом исправление.

---

### Task 8: Документация, сверка, версия

**Files:** `README.md`, `spfx/README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/SETUP-CLAUDE-CODE.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `.claude/commands/release-prod.md`, `CHANGELOG.md`, `docs/RELEASES.{uk,en,ru}.md`, `spfx/config/package-solution.json`.

- [ ] **Step 1: Версии в документации**

Заменить: SPFx `1.23.2` → `1.24.1`; React `17.0.1` / «React 17» → `18.3.1`; Heft `1.2.17` → фактическая; Node `22` / `node@22` / `>=22.14.0 <23` → `26` / `node@26` / `>=26 <27`; PnP.PowerShell `3.4.1` → `3.5.0`; среда `PowerShell-7.6-PnP` → `PowerShell-7.6-PnP35`. `docs/superpowers/specs/*` и прежние планы — история, не править.

- [ ] **Step 2: Сверка покрытия (отдельный проход)**

```bash
grep -rnE "1\.23\.2|React 17|17\.0\.1|Node(\.js)? ?22|node@22|22\.14|3\.4\.1|PowerShell-7\.6-PnP\b|1\.2\.17" --include='*.md' --include='*.sh' --include='*.ps1' --include='*.yml' --include='*.json' . .claude | grep -vE 'node_modules|package-lock|CHANGELOG|RELEASES|superpowers/(plans|specs)|docs/research|runbooks/'
```
Таблица «упоминание → исправлено / оставлено намеренно (почему)»; повторять до «N/N, 0 расхождений». `runbooks/` проверяется пересборкой (`Build-Runbook.ps1`), не правкой.

- [ ] **Step 3: CHANGELOG**

Раздел «Не выпущено», сверху: «**Обновление стека (ноябрь 2026):** SPFx 1.24.1, React 18.3.1 (один корень React — `reactRoot.ts`), сборка и CI на Node 26 LTS, `@azure/msal-browser` 5.29.1, клиент Copilot Studio 1.10.1, PnP.PowerShell 3.5.0 в новой среде Azure `PowerShell-7.6-PnP35`. Поведение портала не менялось. Принятый риск: `zod` < 4.6.6 в клиенте Copilot Studio (нет исправления от поставщика).»

- [ ] **Step 4: Версия остаётся последним коммитом**

Версия поднята в Task 7 Step 1. Коммиты этого этапа (документация) и исправления по итогам проверки идут после неё — поэтому в конце: поднять четвёртую цифру (`1.7.13.1`) с тем же текстом выпуска отдельным последним коммитом после `git rebase origin/main`, `scripts/spfx.sh npm run guide`, тесты, сборка, `-Env test -Action app` и повторить короткую проверку: версия в «Довідка», имя файла бандла, чистая консоль, открытие карточки и формы отчёта. В `RELEASES` остаётся один выпуск этой работы — с итоговой версией.

**Критерий приёмки:** сверка — 0 расхождений; Jest проверяет совпадение версии пакета и первого выпуска в `RELEASES`; на тесте — пакет с новой версией.

---

### Task 9: Ревью и ворота

- [ ] **Step 1: Независимое ревью кода** — агент на Sonnet: `git diff origin/main...HEAD`, находки с severity и вердикт. Найденное — исправить с тестом или согласовать как долг.
- [ ] **Step 2: Ворота 1** — показать пользователю diff, итоги тестов и теста на сайте, честный список: какие найденные ошибки покрыты тестом. `git push` и PR — после «да»; слияние — владелец.
- [ ] **Step 3: Ворота 2 — прод (владелец, `/release-prod`, после отдельного «да»):**
  1. `-Env prod -Action sync-dryrun` из `main`;
  2. `-Env prod -Action deploy -ConfirmProduction` и установка приложения на прод по порядку `/release-prod`;
  3. `scripts/Publish-Runbook.ps1 -Env prod` — `PMO-Sync` переходит на `PowerShell-7.6-PnP35`; проверить фактическую среду и привязки расписаний запросом из Task 6 Step 6; `PMO-WhoAmI` для прода — на новой среде; дождаться запуска по расписанию без ошибок;
  4. проверка здоровья: расписания ↔ runbook, `PMO-WhoAmI` на обоих сайтах, письмо при сбое, версии приложения на тесте и проде, срок сертификатов приложений Entra ID (в портале Entra, файлы `certs/` не читать).
- [ ] **Step 4: Уборка (после недели работы прода без сбоев, после «да»):** удалить среду `PowerShell-7.6-PnP` в Azure; `brew uninstall node@22`; `Uninstall-Module PnP.PowerShell -RequiredVersion 3.4.1`.
- [ ] **Step 5:** обновить память `stack-update-routine` (новая исходная точка и даты) и `docs/ROADMAP.md`.

## Ход выполнения

**13.11.2026 — Task 0–5 выполнены заранее** (решение владельца: подготовка до выпуска 1.7.12), в рабочей копии `.claude/worktrees/stack-2026-11`, ветка `change/stack-2026-11` от `change/support-status` (после слияния 1.7.12 в `main` — `git rebase origin/main`). На сайты и в Azure ничего не выкладывалось, ветка не запушена.

Итоги: 1944 теста проходят (+6 новых), сборка проходит, предупреждений линтера 11 (как было), предупреждений React в тестах 0; `npm audit` 34 (было 40), в рабочих зависимостях — только цепочка `zod`; бандл на Node 26 побайтно равен бандлу на Node 22; манифест веб-части ссылается на React 18.3.1 от SharePoint.

Отклонения от плана:
- **Ошибок типов `children` не оказалось** (0 ошибок `tsc`) — правок компонентов не потребовалось.
- **Heft 1.3.2: линтер сборки стал проверять `test/`** и падал (тесты вне программы сборки) — в `eslint.config.js` добавлено `ignores: ['test/**']`; прежде линтер их не видел, поведение то же.
- **`support.test.tsx`, тест плиток главной:** кликал по узлам DOM, размонтированным предыдущим шагом цикла; React 17 это допускал, React 18 — нет. Плитка теперь берётся из текущего DOM; ожидания не менялись.
- **`parentUi.test.tsx`:** карточка проекта дочитывает журнал после монтирования — тесты ждут это внутри `act` (предупреждение было и на React 17).
- **Отчёт CLI for Microsoft 365 и запуск генератора не делались:** вместо этого прочитан шаблон из пакета `@microsoft/generator-sharepoint@1.24.1` (`lib/common/dependencies.json`, шаблоны конфигурации) — без запуска стороннего кода. Отличие конфигурации одно: `watchOptions` для Copilot-компонентов, нам не нужно.
- **`@types/react`:** шаблон закрепляет 18.2.79, руководство Microsoft — `^18.3.0`; взято `^18.3.0` (установлено 18.3.31).
- **`overrides`:** убраны `follow-redirects`, `launch-editor`, `postcss-selector-parser`, `shell-quote`, `source-map-js` (не нужны с 1.24.1); оставлены `qs`, `uuid`; добавлена `serialize-javascript` из шаблона; `follow-redirects` 1.16.3 и `body-parser` 1.20.9 — обновлением в своих диапазонах.
- **`msal-browser` 5.29.1:** ломающих изменений в журнале нет, но 5.23–5.29 меняют всплывающее окно (`pocd`), очистку адреса после возврата и одновременные тихие запросы — вход «Помічник ШІ» (окно и переход на iPhone) обязательно проверить на тесте (Task 7).
- **Homebrew:** отдельной формулы `node@26` пока нет — это псевдоним формулы `node` (26.13.1); `scripts/spfx.sh` через `brew --prefix node@26` работает.
- **Node 26:** в выводе Jest одно предупреждение самого Node (`ExperimentalWarning: localStorage is not available…`) — не React, на тесты не влияет.

**14.11.2026 — после выпуска 1.7.12.0 на прод:** ветка перебазирована на `main` (1954 теста, сборка, `Test-Scripts.ps1` — проходят).
- **Task 6 (без среды Azure):** сверка командлетов с журналом PnP.PowerShell 3.5.0 — 67/67, ни один не затронут (изменения 3.5.0 — телеметрия, Syntex, контейнеры SPE, переименование тенанта, geo; у `-ManagedIdentity` меняется только поведение с `-AzureEnvironment`, мы его не передаём). Локально PnP 3.5.0 (3.4.1 оставлен), Az.Accounts 5.5.4, Az.Resources 10.2.2. Тестовый сайт на 3.5.0: `deploy`, `sync-dryrun`, `sync`, `rebuild-permissions` — без ошибок; `acl-export` до и после — 751/751 записей, 0 различий; повторный `deploy` — 0 изменений. Значения по умолчанию скриптов — среда `PowerShell-7.6-PnP35`, PnP 3.5.0. Среда в Azure ещё не создана (ждёт «да» владельца).
- **Task 7:** версия 1.7.13.0 поднята до выкладки (как требует ревью плана); приложение на тесте. **Найдена ошибка, которую тесты не ловят:** SPFx 1.24 включил в `sass.json` `preserveIcssExports: true` — CSS шёл в бандл с обёрткой `:global`, браузер отбрасывал все правила, приложение на тесте было без оформления (~15 минут). Исправлено `preserveIcssExports: false` в `config/sass.json` (CSS совпадает с 1.23, кроме хэш-суффиксов трёх анимаций); `npm run build` теперь проверяет бандл (`tools/check-bundle.mjs`; на сломанном бандле падает — проверено). Повторная выкладка той же версии обновила файлы (каталог перезаписывает пакет), на сайте загружен новый бандл. Проверено в браузере: главная, «Проєкти підтримки», карточка проекта — оформление на месте; в консоли нет ошибок приложения и React (есть ошибки `activitymonitor.js` самого SharePoint).
- **Ещё один зависящий от времени тест:** колокольчик прототипа в день выпуска до 09:00 считал выпуск новым (упал в 00:40 после поднятия версии) — тесты открывают прототип с «сегодня» = день последнего выпуска, 12:00.
- Версия осталась 1.7.13.0: `main` после поднятия не менялся, поэтому `.1` по Task 8 Step 4 не нужен, если `main` не сдвинется до слияния.

- **Task 6 завершён (14.11, «да» владельца):** `New-PMOAutomation.ps1 -Wait` создал среду `PowerShell-7.6-PnP35`, PnP 3.5.0 импортирован (`Succeeded`). `PMO-Sync-Test` и `PMO-WhoAmI` опубликованы в ней; фактическая среда по ответу Azure — `PowerShell-7.6-PnP35`, `PMO-Sync` (прод) — прежняя `PowerShell-7.6-PnP`; привязки расписаний до и после совпадают. Откат проверен: `-RuntimeName PowerShell-7.6-PnP` → среда сменилась → возврат на PnP35. `PMO-WhoAmI` на тесте — все проверки пройдены; плановый `PMO-Sync-Test` 01:00 — `Completed`, 0 ошибок, 0 предупреждений. Среда для прода уже существует — `Publish-Runbook.ps1 -Env prod` при выпуске её найдёт.
- **Task 8:** версии в документации обновлены, сверка упоминаний — 0 расхождений, кроме намеренных (описание отката на прежнюю среду). **Task 9, Step 1:** независимое ревью кода (Sonnet) — «одобрить», critical/high нет; внесены: флаг `disposed` в веб-части (отложенный `renderApp` после `onDispose`), проверка бандла устойчива к минификации (`/:global\s*[{.#\[]/`, `/\.pmo-app\s*\{\s*--theme/`; на сломанном бандле падает — проверено).
- **Осталось:** проверка владельцем входа «Помічник ШІ» (окно и iPhone), push и PR, выпуск на прод (приложение; runbook прода — отдельным шагом через день), уборка через неделю.

Не относится к обновлению стека: тест прототипа `prototypeForms2.test.ts` «#73 фильтр колонки „Звіт“» падает и на исходной ветке `change/support-status` (до любых правок этой ветки) — зависит от текущей даты.

## Откат

- Приложение: каталог не понижает версию, поэтому откат — пересобрать из `main` (код до слияния) с версией **выше** текущей на сайте и установить; сохранённый в Task 0 `pmo-portal.sppkg` — эталон для сравнения поведения. Данных приложение не мигрирует, откат безопасен.
- Синхронизация: `scripts/Publish-Runbook.ps1 -Env <test|prod> -RuntimeName PowerShell-7.6-PnP` — возврат на прежнюю среду с PnP 3.4.1 (поэтому её не удаляем до Task 9, Step 4).
- Node: вернуть `scripts/spfx.sh` и CI на 22 одним коммитом (`node@22` остаётся установленным).

## Сроки

| Этап | Кто | Наша работа | Календарное ожидание |
|---|---|---|---|
| Task 0–3 (SPFx, React 18, тесты) | Claude | 1 сессия | — |
| Task 4–5 (минорные, Node 26) | Claude | 0,5 сессии | — |
| Task 6 (PnP, среда Azure, тест) | Claude; владелец — «да» на создание среды | 0,5 сессии | импорт пакета 10–30 мин, запуск по расписанию ~15 мин |
| Task 7–8 (тест-сайт, документация) | Claude; владелец — iPhone | 0,5 сессии | проверка владельцем — в тот же день |
| Task 9 (ревью, PR, прод, уборка) | владелец + Claude | 0,5 сессии | ревью PR; уборка — через неделю после прода |

Итого: 2–3 сессии работы (1,5–2 дня), начало — после выпуска 1.7.12 на прод.

## Решения владельца (13.11.2026)

План одобрен владельцем 13.11.2026 с рекомендованными вариантами:

1. **Node 26 LTS — в этом же выпуске** (отдельным коммитом, откат — один коммит).
2. **PnP.PowerShell 3.5.0 — сейчас**, через новую среду `PowerShell-7.6-PnP35`; прод переключается последним.
3. **Одна ветка**; runbook прода переключается отдельным шагом — через день после того, как приложение отработало на проде.

Начало работ — после выпуска «Підтримка» 1.7.12 на прод.
