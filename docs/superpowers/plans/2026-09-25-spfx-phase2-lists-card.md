# SPFx, этап 2: списки и карточка проекта — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Ход работ: задачи 1–7 выполнены 2026-09-25 (ветка `change/spfx-phase2`), версия 1.1.1.0 на `pmo-test`. Осталось: приёмка человеком. При проверке: панель начинается под полосой Microsoft 365 (`theme/overrides.scss`, класс `pmo-sp`).

**Goal:** На `pmo-test` вкладки «Проєкти» (таблица и плитки), «Статус-звіти», «Ризики та проблеми», «Архів» и карточка проекта (выдвижная панель, только чтение) работают как в прототипе.

**Architecture:** Движок таблицы (фильтры, сортировка, колонки) и представления — чистые функции в `logic/` с тестами. Журнал «Зміни показників» (строка на поле) собирается в события по правилу, покрытому тестами. React-компоненты повторяют разметку прототипа (`dataTable`, `openPop`, `tile`, `projectPanel`) — CSS прототипа уже перенесён на этапе 1.

**Tech Stack:** как на этапе 1 (SPFx 1.23.2, React 17.0.1, TypeScript, Jest 29).

**Spec:** `docs/superpowers/specs/2026-09-24-spfx-portal-design.md` (этап 2).

## Global Constraints

- Все ограничения этапа 1 (`docs/superpowers/plans/2026-09-24-spfx-phase1-shell-home.md`, «Global Constraints») действуют.
- Только чтение SharePoint; формы и запись — этап 3. Кнопки «Додати статус-звіт», «Редагувати», «Новий ризик» до этапа 3 ведут на стандартные формы списков.
- Раздел карточки «Доступ до картки» — этап 4 (нужны данные синхронизации); на этапе 2 не показывается.
- Настройки таблиц — в `localStorage` под ключом `pmo-table5-<projects|archive|reports|risks>` (как в прототипе), режим «Список/Плитки» — `pmo-projmode`.
- Ветка `change/spfx-phase2` от `main` после слияния этапа 1.

## Структура файлов этапа

```
spfx/src/webparts/pmoPortal/
  logic/table.ts          движок таблицы: TableState, applyTable, filterValues, toggleCol, moveCol, loadState/saveState
  logic/views.ts          представления PV / RV / KV, freshBucket, scoreBucket, participants
  logic/changes.ts        журнал -> события истории, FIELD_KEY
  data/types.ts           + Comment, ChangeEntry, ChangeEvent
  data/map.ts             + mapComment, mapChangeRow, COMMENT_SELECT, CHANGE_SELECT
  data/SpRepo.ts          + comments, changes в loadAll; jobTitle(email) с кэшем
  components/Pop.tsx      всплывающее окно у кнопки (фильтр, колонки)
  components/DataTable.tsx таблица прототипа: «Показано X з Y», чипы, сортировка, фильтр, шестерёнка
  components/defs.tsx     колонки PDEF / RDEF / KDEF
  components/Tiles.tsx    плитки проектов
  components/Panel.tsx    выдвижная панель (затемнение, Esc, возврат фокуса)
  panels/ProjectCard.tsx  карточка проекта
  pages/Projects.tsx, Archive.tsx, Reports.tsx, Risks.tsx
  components/App.tsx      вкладки + представление + открытая карточка; адрес в #hash
spfx/test/table.test.ts, views.test.ts, changes.test.ts, map2.test.ts
```

---

### Task 1: Движок таблицы

**Files:** Create `logic/table.ts`, `spfx/test/table.test.ts`

**Interfaces:**
- Produces:
```ts
export interface ColDef<R> {
  label: string;                                  // название (для шестерёнки, чипов, подсказок)
  sort?: (r: R) => string | number | null;        // '' / null / -1 — пустое, всегда внизу
  filter?: (r: R) => string | string[];           // значения для фильтра (массив — «хотя бы одно»)
}
export interface TableState { cols: string[]; sort: { id: string; dir: 'asc' | 'desc' } | null; filters: Record<string, string[]>; }
export function applyTable<R>(rows: R[], defs: Record<string, ColDef<R>>, st: TableState): R[];
export function filterValues<R>(rows: R[], def: ColDef<R>): string[];          // уникальные, по uk
export function nextSort(st: TableState, id: string): TableState;               // asc -> desc -> нет
export function toggleCol(st: TableState, id: string, lock: string): TableState;  // lock не снимается
export function moveCol(st: TableState, id: string, dir: -1 | 1, lock: string): TableState; // первая колонка закреплена
export function loadState(key: string, defaults: string[], known: string[], lock: string): TableState;
export function saveState(key: string, st: TableState): void;
```

- [x] **Step 1: Падающий тест** — `spfx/test/table.test.ts`:
```ts
import { applyTable, filterValues, nextSort, toggleCol, moveCol, ColDef, TableState } from '../src/webparts/pmoPortal/logic/table';

interface Row { id: number; t: string; n: number | null; tags: string[]; }
const rows: Row[] = [{ id: 1, t: 'Б', n: 2, tags: ['x'] }, { id: 2, t: 'А', n: null, tags: ['y', 'x'] }, { id: 3, t: 'В', n: 1, tags: [] }];
const defs: Record<string, ColDef<Row>> = {
  t: { label: 'T', sort: r => r.t, filter: r => r.t },
  n: { label: 'N', sort: r => r.n },
  tags: { label: 'Tags', filter: r => r.tags }
};
const st = (x: Partial<TableState>): TableState => ({ cols: ['t', 'n'], sort: null, filters: {}, ...x });

test('сортировка: числа как числа, пустые внизу в обоих направлениях', () => {
  expect(applyTable(rows, defs, st({ sort: { id: 'n', dir: 'asc' } })).map(r => r.id)).toEqual([3, 1, 2]);
  expect(applyTable(rows, defs, st({ sort: { id: 'n', dir: 'desc' } })).map(r => r.id)).toEqual([1, 3, 2]);
  expect(applyTable(rows, defs, st({ sort: { id: 't', dir: 'asc' } })).map(r => r.id)).toEqual([2, 1, 3]);
});
test('фильтр: значения и массивы (пересечение), без фильтра — все', () => {
  expect(applyTable(rows, defs, st({ filters: { t: ['А', 'В'] } })).map(r => r.id)).toEqual([2, 3]);
  expect(applyTable(rows, defs, st({ filters: { tags: ['x'] } })).map(r => r.id)).toEqual([1, 2]);
  expect(applyTable(rows, defs, st({ filters: { tags: [] } }))).toHaveLength(3);
});
test('filterValues — уникальные, по алфавиту', () => {
  expect(filterValues(rows, defs.tags)).toEqual(['x', 'y']);
  expect(filterValues(rows, defs.t)).toEqual(['А', 'Б', 'В']);
});
test('nextSort: asc -> desc -> нет; другая колонка — asc', () => {
  const a = nextSort(st({}), 't'); expect(a.sort).toEqual({ id: 't', dir: 'asc' });
  const b = nextSort(a, 't'); expect(b.sort).toEqual({ id: 't', dir: 'desc' });
  expect(nextSort(b, 't').sort).toBeNull();
  expect(nextSort(b, 'n').sort).toEqual({ id: 'n', dir: 'asc' });
});
test('колонки: закреплённую не снять; первую не сдвинуть; перемещение', () => {
  expect(toggleCol(st({ cols: ['s', 't', 'n'] }), 't', 't').cols).toEqual(['s', 't', 'n']);
  expect(toggleCol(st({ cols: ['s', 't', 'n'] }), 'n', 't').cols).toEqual(['s', 't']);
  expect(toggleCol(st({ cols: ['s', 't'] }), 'n', 't').cols).toEqual(['s', 't', 'n']);
  expect(moveCol(st({ cols: ['s', 't', 'n'] }), 't', -1, 't').cols).toEqual(['s', 't', 'n']);   // на позицию 0 нельзя
  expect(moveCol(st({ cols: ['s', 't', 'n', 'x'] }), 'n', 1, 't').cols).toEqual(['s', 't', 'x', 'n']);
  expect(moveCol(st({ cols: ['s', 't', 'n', 'x'] }), 'x', -1, 't').cols).toEqual(['s', 't', 'x', 'n']);
  expect(moveCol(st({ cols: ['s', 't', 'n'] }), 't', 1, 't').cols).toEqual(['s', 't', 'n']);   // закреплённая не вниз
});
```
Run: `scripts/spfx.sh npm run test:unit` → FAIL (модуля нет).

- [x] **Step 2: Реализация** — `logic/table.ts`:
```ts
export interface ColDef<R> { label: string; sort?: (r: R) => string | number | null; filter?: (r: R) => string | string[]; }
export interface TableState { cols: string[]; sort: { id: string; dir: 'asc' | 'desc' } | null; filters: Record<string, string[]>; }

const empty = (v: unknown): boolean => v === '' || v === null || v === undefined || v === -1;
const vals = (v: string | string[]): string[] => (Array.isArray(v) ? v.map(String) : [String(v)]);

/** Фильтры и сортировка — как applyTable прототипа: пустые значения всегда внизу, строки по uk. */
export function applyTable<R>(rows: R[], defs: Record<string, ColDef<R>>, st: TableState): R[] {
  let data = rows.filter(r => Object.keys(st.filters).every(id => {
    const want = st.filters[id]; const d = defs[id];
    return !want || !want.length || !d || !d.filter || vals(d.filter(r)).some(x => want.indexOf(x) >= 0);
  }));
  const sd = st.sort && defs[st.sort.id] && defs[st.sort.id].sort;
  if (st.sort && sd) {
    const dir = st.sort.dir === 'desc' ? -1 : 1;
    data = data.slice().sort((a, b) => {
      const x = sd(a), y = sd(b), ex = empty(x), ey = empty(y);
      if (ex && ey) return 0; if (ex) return 1; if (ey) return -1;
      return dir * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'uk'));
    });
  }
  return data;
}
export function filterValues<R>(rows: R[], def: ColDef<R>): string[] {
  const set: Record<string, true> = {};
  if (def.filter) rows.forEach(r => vals(def.filter!(r)).forEach(v => { set[v] = true; }));
  return Object.keys(set).sort((a, b) => a.localeCompare(b, 'uk'));
}
export function nextSort(st: TableState, id: string): TableState {
  const cur = st.sort && st.sort.id === id ? st.sort.dir : '';
  return { ...st, sort: cur === '' ? { id, dir: 'asc' } : cur === 'asc' ? { id, dir: 'desc' } : null };
}
export function toggleCol(st: TableState, id: string, lock: string): TableState {
  if (id === lock) return st;
  return { ...st, cols: st.cols.indexOf(id) >= 0 ? st.cols.filter(c => c !== id) : st.cols.concat(id) };
}
export function moveCol(st: TableState, id: string, dir: -1 | 1, lock: string): TableState {
  const i = st.cols.indexOf(id), j = i + dir;
  // как в прототипе: на первую позицию не сдвигается ничего, закреплённая колонка не сдвигается вниз
  if (i < 0 || j < 1 || j >= st.cols.length || (dir === 1 && id === lock)) return st;
  const cols = st.cols.slice(); cols[i] = cols[j]; cols[j] = id;
  return { ...st, cols };
}
/** Состояние из localStorage; неизвестные колонки отбрасываются, закреплённая всегда есть (позиция 2). */
export function loadState(key: string, defaults: string[], known: string[], lock: string): TableState {
  let st: TableState = { cols: defaults.slice(), sort: null, filters: {} };
  try { const raw = localStorage.getItem('pmo-table5-' + key); if (raw) st = { ...st, ...JSON.parse(raw) }; } catch { /* нет хранилища */ }
  st.cols = st.cols.filter(c => known.indexOf(c) >= 0);
  if (st.cols.indexOf(lock) < 0) st.cols.splice(Math.min(2, st.cols.length), 0, lock);
  return st;
}
export function saveState(key: string, st: TableState): void { try { localStorage.setItem('pmo-table5-' + key, JSON.stringify(st)); } catch { /* нет хранилища */ } }
```
- [x] **Step 3:** `scripts/spfx.sh npm run test:unit` → PASS.
- [x] **Step 4: Commit** — «SPFx: движок таблицы — фильтры, сортировка, колонки …».

---

### Task 2: Представления и корзины фильтров

**Files:** Create `logic/views.ts`, `spfx/test/views.test.ts`

**Interfaces:**
- Consumes: `isActive`, `isArch`, `freshness`, `riskScore`, `Project`, `StatusReport`, `Risk`.
- Produces:
```ts
export type ProjectView = 'all' | 'strat' | 'problem' | 'mine' | 'stale';
export type ReportView = 'all' | 'decision';
export type RiskView = 'open' | 'all';
export const PV: Record<ProjectView, string>;   // названия — украинские, как в прототипе: Усі проєкти, Стратегічні, Проблемні, Мої проєкти, Немає свіжого звіту
export const RV: Record<ReportView, string>;    // Усі звіти, Потребують рішення
export const KV: Record<RiskView, string>;      // Відкриті, Усі елементи
export function projectView(v: ProjectView, p: Project, today: string, me: string): boolean;   // me — e-mail пользователя
export const reportView = (v: ReportView, r: StatusReport): boolean;
export const riskView = (v: RiskView, k: Risk): boolean;
export const freshBucket = (lastUpdate: string, today: string): '0' | '1' | '2' | '3';     // g / y / r / нет отчёта
export const scoreBucket = (score: number): '0' | '1' | '2';                                // ≥15 / ≥8 / иначе
export const participants = (p: Project): string[];                                          // e-mail PM, собственника, стейкхолдеров
export function ofProject<T extends { projectId: number }>(items: T[], id: number): T[];      // записи проекта — для колонок и карточки
```

- [x] **Step 1: Падающий тест** — `spfx/test/views.test.ts`:
```ts
import { projectView, reportView, riskView, freshBucket, scoreBucket, participants, ofProject } from '../src/webparts/pmoPortal/logic/views';
import { Project, StatusReport, Risk } from '../src/webparts/pmoPortal/data/types';
const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [],
  department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', loop: '', description: '', canEdit: false, pending: false, ...x });
const me = 'a@x.ua', today = '2026-09-24';

test('представления проектов', () => {
  expect(projectView('strat', P({ type: 'Стратегічний' }), today, me)).toBe(true);
  expect(projectView('strat', P({ type: 'Стратегічний', status: 'Скасовано' }), today, me)).toBe(false);
  expect(projectView('problem', P({ rag: 'Жовтий' }), today, me)).toBe(true);
  expect(projectView('problem', P({ rag: 'Зелений' }), today, me)).toBe(false);
  expect(projectView('stale', P({ lastUpdate: '' }), today, me)).toBe(true);
  expect(projectView('stale', P({ lastUpdate: '2026-09-20' }), today, me)).toBe(false);
  expect(projectView('mine', P({ stakeholders: [{ id: 1, name: 'A', email: 'A@x.ua' }] }), today, me)).toBe(true);
  expect(projectView('mine', P({}), today, me)).toBe(false);
  expect(projectView('all', P({ status: 'Скасовано' }), today, me)).toBe(true);
});
test('отчёты и риски', () => {
  expect(reportView('decision', { decision: true } as StatusReport)).toBe(true);
  expect(reportView('decision', { decision: false } as StatusReport)).toBe(false);
  expect(riskView('open', { status: 'В роботі' } as Risk)).toBe(true);
  expect(riskView('open', { status: 'Закрито' } as Risk)).toBe(false);
  expect(riskView('all', { status: 'Закрито' } as Risk)).toBe(true);
});
test('корзины и участники', () => {
  expect(freshBucket('', today)).toBe('3'); expect(freshBucket('2026-09-20', today)).toBe('0');
  expect(freshBucket('2026-09-12', today)).toBe('1'); expect(freshBucket('2026-09-01', today)).toBe('2');
  expect(scoreBucket(15)).toBe('0'); expect(scoreBucket(8)).toBe('1'); expect(scoreBucket(7)).toBe('2');
  expect(participants(P({ manager: { id: 1, name: 'M', email: 'M@x.ua' }, owner: null }))).toEqual(['m@x.ua']);
  expect(ofProject([{ projectId: 1, n: 'a' }, { projectId: 2, n: 'b' }], 2).map(x => x.n)).toEqual(['b']);
});
```
Run → FAIL.

- [x] **Step 2: Реализация** — `logic/views.ts`:
```ts
import { Project, StatusReport, Risk } from '../data/types';
import { isActive, freshness } from './status';

export type ProjectView = 'all' | 'strat' | 'problem' | 'mine' | 'stale';
export type ReportView = 'all' | 'decision';
export type RiskView = 'open' | 'all';
// названия представлений — украинские во всех языках, как в прототипе (подсказка viewsNote)
export const PV: Record<ProjectView, string> = { all: 'Усі проєкти', strat: 'Стратегічні', problem: 'Проблемні', mine: 'Мої проєкти', stale: 'Немає свіжого звіту' };
export const RV: Record<ReportView, string> = { all: 'Усі звіти', decision: 'Потребують рішення' };
export const KV: Record<RiskView, string> = { open: 'Відкриті', all: 'Усі елементи' };

export const participants = (p: Project): string[] =>
  [p.manager, p.owner, ...p.stakeholders].filter(x => !!x && !!x.email).map(x => x!.email.toLowerCase());

export function projectView(v: ProjectView, p: Project, today: string, me: string): boolean {
  switch (v) {
    case 'strat': return isActive(p.status) && p.type === 'Стратегічний';
    case 'problem': return isActive(p.status) && (p.rag === 'Червоний' || p.rag === 'Жовтий');
    case 'mine': return participants(p).indexOf(me.toLowerCase()) >= 0;
    case 'stale': { const f = freshness(p.lastUpdate, today); return isActive(p.status) && (f === 'r' || f === 'na'); }
    default: return true;
  }
}
export const reportView = (v: ReportView, r: StatusReport): boolean => v !== 'decision' || r.decision;
export const riskView = (v: RiskView, k: Risk): boolean => v !== 'open' || k.status !== 'Закрито';
export function freshBucket(lastUpdate: string, today: string): '0' | '1' | '2' | '3' {
  const f = freshness(lastUpdate, today); return f === 'g' ? '0' : f === 'y' ? '1' : f === 'r' ? '2' : '3';
}
export const scoreBucket = (s: number): '0' | '1' | '2' => (s >= 15 ? '0' : s >= 8 ? '1' : '2');
export const ofProject = <T extends { projectId: number }>(items: T[], id: number): T[] => items.filter(x => x.projectId === id);
```
- [x] **Step 3:** тесты PASS. **Step 4: Commit** — «SPFx: представления проектов, отчётов и рисков …».

---

### Task 3: Комментарии, журнал изменений, должности

**Files:** Create `logic/changes.ts`, `spfx/test/changes.test.ts`, `spfx/test/map2.test.ts`; Modify `data/types.ts`, `data/map.ts`, `data/SpRepo.ts`

**Interfaces:**
- Produces (`types.ts`):
```ts
export interface Comment { id: number; projectId: number; text: string; author: Person | null; created: string; }  // created — ISO дата-время
export interface ChangeEntry { id: number; projectId: number; date: string; who: Person | null; kind: string; field: string; from: string; to: string; reason: string; }
export interface ChangeEvent { id: number; date: string; who: Person | null; kind: 'create' | 'key' | 'edit' | 'report'; reason: string; diffs: { f: string; from: string; to: string }[]; }
```
- Produces (`changes.ts`): `FIELD_KEY: Record<string, string>` (внутреннее имя SharePoint → ключ FLD прототипа); `toEvents(rows: ChangeEntry[]): ChangeEvent[]` — новые сверху.
- Produces (`map.ts`): `COMMENT_SELECT`, `COMMENT_EXPAND`, `CHANGE_SELECT`, `CHANGE_EXPAND`, `mapComment(raw)`, `mapChange(raw)`.
- Produces (`SpRepo.ts`): `PortalData` + `comments: Comment[]; changes: ChangeEntry[]`; `jobTitle(email: string): Promise<string>` (кэш в памяти).

На этапе 2 синхронизация пишет в журнал только ключевые показатели (`pmStatus`, `pmRAG`, `pmType`, `pmProgress`, даты) и `Title` при создании; остальные ключи `FIELD_KEY` и вид «Редагування картки» — задел для этапа 3 (правка карточки).

Правило сборки событий: строки журнала одного проекта с одинаковыми `kind`, `who`, `reason` и датой с точностью до минуты — одно событие; `kind` из списка: «Створення» → `create`, «Статус-звіт» → `report`, «Редагування картки» → `edit`; строка «Створення» даёт событие без изменений; `field` через `FIELD_KEY` (неизвестное поле — как есть).

- [x] **Step 1: Падающие тесты** — `spfx/test/changes.test.ts`:
```ts
import { toEvents } from '../src/webparts/pmoPortal/logic/changes';
import { ChangeEntry } from '../src/webparts/pmoPortal/data/types';
const who = { id: 1, name: 'PM', email: 'pm@x.ua' };
const E = (x: Partial<ChangeEntry>): ChangeEntry => ({ id: 1, projectId: 1, date: '2026-09-20T10:15:30Z', who, kind: 'Статус-звіт', field: 'pmStatus',
  from: 'Планування', to: 'Реалізація', reason: 'Звіт', ...x });

test('строки одного отчёта — одно событие, поля в ключи прототипа', () => {
  const ev = toEvents([E({ id: 1 }), E({ id: 2, field: 'pmProgress', from: '0%', to: '40%', date: '2026-09-20T10:15:59Z' })]);
  expect(ev).toHaveLength(1);
  expect(ev[0]).toMatchObject({ kind: 'report', reason: 'Звіт', diffs: [{ f: 'status', from: 'Планування', to: 'Реалізація' }, { f: 'progress', from: '0%', to: '40%' }] });
});
test('разные минуты, причины или виды — разные события; новые сверху', () => {
  const ev = toEvents([E({ id: 1, date: '2026-09-01T09:00:00Z', kind: 'Створення', field: 'Title', from: '—', to: 'P', reason: '' }),
                      E({ id: 2 }), E({ id: 3, reason: 'Інший', date: '2026-09-20T10:15:10Z' })]);
  expect(ev.map(e => e.kind)).toEqual(['report', 'report', 'create']);
  expect(ev[2].diffs).toEqual([]);
});
```
`spfx/test/map2.test.ts`:
```ts
import { mapComment, mapChange } from '../src/webparts/pmoPortal/data/map';
test('mapComment', () => {
  expect(mapComment({ Id: 4, cmProjectId: 7, cmText: 'Текст', Created: '2026-09-22T08:30:00Z', Author: { Id: 3, Title: 'A', EMail: 'a@x.ua' } }))
    .toEqual({ id: 4, projectId: 7, text: 'Текст', created: '2026-09-22T08:30:00Z', author: { id: 3, name: 'A', email: 'a@x.ua' } });
});
test('mapChange', () => {
  expect(mapChange({ Id: 9, kcProjectId: 7, kcDate: '2026-09-20T10:15:00Z', kcKind: 'Статус-звіт', kcField: 'pmRAG', kcFrom: 'Зелений', kcTo: 'Жовтий',
    kcReason: null, kcChangedBy: null })).toEqual({ id: 9, projectId: 7, date: '2026-09-20T10:15:00Z', who: null, kind: 'Статус-звіт', field: 'pmRAG',
    from: 'Зелений', to: 'Жовтий', reason: '' });
});
```
Run → FAIL.

- [x] **Step 2: Реализация**

`scripts/Invoke-PMOSync.ps1` — одно время на все строки журнала одного отчёта (иначе поля одного отчёта на границе минуты разойдутся в разные события): в цикле применения отчётов перед `foreach ($k in $changed.Keys)` добавить `$when = (Get-Date).ToUniversalTime().ToString("o")` и передавать `$when` последним аргументом `Add-Change` вместо `$null`. `tests/Test-Scripts.ps1` — без изменений (синтаксис проверяется).

`data/types.ts` — добавить три интерфейса из блока Interfaces.

`logic/changes.ts`:
```ts
import { ChangeEntry, ChangeEvent } from '../data/types';

/** Внутреннее имя поля проекта -> ключ FLD прототипа (подпись в истории изменений). */
export const FIELD_KEY: Record<string, string> = { Title: 'title', pmStatus: 'status', pmRAG: 'rag', pmType: 'type', pmProgress: 'progress',
  pmStart: 'start', pmGoLive: 'golive', pmPlanEnd: 'plan', pmForecastEnd: 'fc', pmActualCost: 'actual', pmPriority: 'prio', pmManager: 'pm',
  pmOwner: 'owner', pmStakeholders: 'stakeholders', pmDepartment: 'dept', pmLoop: 'loop', pmCode: 'code' };
const KIND: Record<string, ChangeEvent['kind']> = { 'Створення': 'create', 'Статус-звіт': 'report', 'Редагування картки': 'edit' };

/** Журнал «Зміни показників» (строка на поле) -> события истории прототипа, новые сверху. */
export function toEvents(rows: ChangeEntry[]): ChangeEvent[] {
  const map: Record<string, ChangeEvent> = {}; const order: string[] = [];
  rows.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).forEach(r => {
    const key = [r.projectId, r.kind, r.who ? r.who.email : '', r.reason, r.date.slice(0, 16)].join('|');
    let ev = map[key];
    if (!ev) { ev = map[key] = { id: r.id, date: r.date, who: r.who, kind: KIND[r.kind] || 'edit', reason: r.reason, diffs: [] }; order.push(key); }
    if (ev.kind !== 'create') ev.diffs.push({ f: FIELD_KEY[r.field] || r.field, from: r.from, to: r.to });
  });
  return order.map(k => map[k]).reverse();
}
```

`data/map.ts` — добавить:
```ts
export const COMMENT_SELECT = ['Id', 'cmProjectId', 'cmText', 'Created', ...people('Author')].join(',');
export const COMMENT_EXPAND = 'Author';
export const CHANGE_SELECT = ['Id', 'kcProjectId', 'kcDate', 'kcKind', 'kcField', 'kcFrom', 'kcTo', 'kcReason', ...people('kcChangedBy')].join(',');
export const CHANGE_EXPAND = 'kcChangedBy';
export const mapComment = (r: any): Comment => ({ id: r.Id, projectId: r.cmProjectId, text: s(r.cmText), created: s(r.Created), author: mapPerson(r.Author) });
export const mapChange = (r: any): ChangeEntry => ({ id: r.Id, projectId: r.kcProjectId, date: s(r.kcDate), who: mapPerson(r.kcChangedBy),
  kind: s(r.kcKind), field: s(r.kcField), from: s(r.kcFrom), to: s(r.kcTo), reason: s(r.kcReason) });
```
(и импорт `Comment, ChangeEntry` в `map.ts`; `tsconfig.jest.json` уже включает `data/map.ts`).

`data/SpRepo.ts` — в `loadAll` добавить параллельно `this.items('ProjectComments', COMMENT_SELECT, COMMENT_EXPAND)` и `this.items('KeyChanges', CHANGE_SELECT, CHANGE_EXPAND)`, вернуть `comments`, `changes`; в `PortalData` — поля `comments: Comment[]; changes: ChangeEntry[]`. Должность:
```ts
  private titles: Record<string, Promise<string>> = {};
  /** Должность из профиля SharePoint (для карточки: «роль · e-mail»); пусто, если профиль недоступен. */
  jobTitle(email: string): Promise<string> {
    const k = email.toLowerCase();
    if (!this.titles[k]) {
      const acc = encodeURIComponent(`'i:0#.f|membership|${k}'`);
      this.titles[k] = this.http.get(`${this.webUrl}/_api/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v=${acc}&$select=Title`,
        SPHttpClient.configurations.v1, { headers: { Accept: 'application/json;odata=nometadata' } })
        .then(r => (r.ok ? r.json() : { Title: '' })).then(j => String(j.Title || '')).catch(() => '');
    }
    return this.titles[k];
  }
```
- [x] **Step 3:** тесты PASS; `scripts/spfx.sh npm run build` → код 0. **Step 4: Commit** — «SPFx: комментарии, журнал изменений -> история, должности …».

---

### Task 4: Всплывающие окна и таблица прототипа

**Files:** Create `components/Pop.tsx`, `components/DataTable.tsx`, `components/defs.tsx`

**Interfaces:**
- Consumes: Task 1 (`applyTable`, `filterValues`, `nextSort`, `toggleCol`, `moveCol`, `loadState`, `saveState`, `ColDef`), Task 2 (`freshBucket`, `scoreBucket`), `Bits`, `Icons`.
- Produces:
```ts
// defs.tsx: колонка = данные для движка + отрисовка
export interface Col<R> extends ColDef<R> { head?: JSX.Element; cell: (r: R) => React.ReactNode; cls?: string; flabel?: (v: string) => React.ReactNode; }
export interface TableDefs<R> { lock: string; defaults: string[]; cols: Record<string, Col<R>>; }
export function projectDefs(x: DefsCtx, archive: boolean): TableDefs<Project>;
export function reportDefs(x: DefsCtx): TableDefs<StatusReport>;
export function riskDefs(x: DefsCtx): TableDefs<Risk>;
export interface DefsCtx { t(k: string): string; fl(k: string): string; today: string; byId: Record<number, Project>; open(id: number): void; }
// DataTable.tsx
export function DataTable<R extends { id: number }>(p: { tkey: string; defs: TableDefs<R>; rows: R[]; empty?: string; gearOpen: boolean; onGear(v: boolean): void }): JSX.Element;
// Pop.tsx
export const Pop: React.FC<{ anchor: HTMLElement; align: 'left' | 'right'; onClose(): void }>;
```

Колонки и порядок — **дословно** `PDEF` / `RDEF` / `KDEF` прототипа (строки 1003–1072), включая `_lock`, значения по умолчанию `TDEFAULTS` и корзины фильтров:
- проекты: `strat, title, code, type, pm, owner, product(стейкхолдеры), status, prio, rag, repDate, repAge, progress, start, golive, plan, fc, dev, budget, actual, use, update, comment(последний комментарий), cmtBy(автор последнего комментария), dept, loop, archived`; по умолчанию `strat,prio,title,pm,status,rag,repDate,progress,plan,update`; архив — `strat,prio,title,pm,owner,archived,plan,budget,actual`; `lock: 'title'`;
- отчёты: `strat, proj, code, date, period, prio, rag, sched, budget, res, title, done, next, issues, progress, status, author, decision, decText`; по умолчанию `strat,prio,proj,date,rag,sched,budget,res,title,author,decision`; `lock: 'proj'`;
- риски: `proj, prio, strat, code, title, type, score, prob, imp, owner, status, due`; по умолчанию `strat,prio,proj,title,type,score,owner,status,due`; `lock: 'proj'`.

Каждая колонка — `label` (`t(...)`/`fl(...)` с ключом прототипа), `sort`, `filter`, `flabel` и `cell` как в прототипе; значения с `clamp2` — `<span className="clamp2" title=...>`; деньги — `Math.round(n).toLocaleString('uk-UA') + ' ₴'`; `dev` — `+N` красным (`late`); `use` — класс `over`/`warn` (`budgetLevel`); `score` — `sort: -score`, `filter: scoreBucket`, `flabel: v => t('sc' + v)`; `repDate` — `filter: freshBucket`, `flabel: v => <><span className="dot sm" style=.../>{t('fr' + v)}</>`; стейкхолдеры — стопка аватаров (`astack`) и «+N» (`more-n`), как `peopleCell` прототипа.

`DataTable` — разметка `dataTable` прототипа (строки 1090–1103): строка `dt-bar` («Показано X з Y» + чипы `fchip` с «×»), `tablewrap dt`, заголовок `th` → `span.th` с кнопкой `sortb` (стрелка `↑`/`↓`) и `fbtn` (воронка, `on` при активном фильтре). Воронка открывает `Pop` с `pop-h`, поиском `pop-q` (если значений > 7), `pop-list` с чекбоксами `pop-row` и «Очистити» (`t('clear')`). Шестерёнка (`iconbtn gear-lg`, `t('cols')`) открывает `Pop` колонок (`col-row`: чекбокс, `mv` ↑↓ с правилами `toggleCol`/`moveCol`, «Як за замовчуванням» — `t('colsReset')`). Каждое изменение → `saveState(tkey, …)`.

`Pop` — `div.pmo-pop` c `position: fixed`, координаты как `openPop` прототипа (слева под кнопкой для фильтра, справа — для колонок, не выходит за окно; если не помещается снизу — над кнопкой); закрывается по Esc, по клику вне и при прокрутке.

- [x] **Step 1:** Реализовать `Pop.tsx`, `defs.tsx`, `DataTable.tsx` по описанию выше.
- [x] **Step 2:** `scripts/spfx.sh npm run build` → код 0, без предупреждений.
- [x] **Step 3: Commit** — «SPFx: таблица прототипа — сортировка, фильтры, выбор колонок …».

---

### Task 5: Страницы «Проєкти» (список и плитки), «Архів», «Статус-звіти», «Ризики»

**Files:** Create `components/Tiles.tsx`, `pages/Projects.tsx`, `pages/Archive.tsx`, `pages/Reports.tsx`, `pages/Risks.tsx`; Modify `components/App.tsx`, `components/ctx.ts`, `pages/Home.tsx`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `Ctx` + `me: string` (e-mail), `views: { projects: ProjectView; reports: ReportView; risks: RiskView }`, `setView(page, view)`, `openProject(id: number): void` — представление хранится отдельно для каждой вкладки (как `state.pv/rv/kv` прототипа) и не теряется при переключении; в адресе — представление активной вкладки; адрес `#<page>/<view>/<projectId>` (например `#projects/problem`, `#home//7`) — назад/вперёд браузера работает, ссылку на карточку можно отправить.

- [x] **Step 1: `Tiles.tsx`** — функция `tile` прототипа (строки 901–913): `div.tile[role=button][tabIndex=0]` (Enter/Space = клик), `tile-top` (код, щит, пилюля RAG `pill` с точкой или «не оцінено»), `tile-t`, `tile-prog` (`pl`: статус и `%`, `track` с полосой, зелёной при 100%), `tile-upd` (`ul`: точка свежести, `t('latestUpd') · дата` или `t('noReports')`; `tx`: «Останній апдейт»), `tile-f` (Loop ↗ или пусто, `tile-pm`: аватар и имя PM). Обёртка `div.tiles`; пусто — `p.empty`.
- [x] **Step 2: Страницы** — как `pageProjects` / `pageArchive` / `pageReports` / `pageRisks` прототипа (строки 1193–1221):
  - «Проєкти»: `hero` (заголовок `navProjects`, `visible` + число неархивных, кнопка «Новий проєкт»); `div.listcard` → `div.cmdbar`: переключатель `seg` «Список / Плитки» (`t('list')`, `t('tiles')`, иконки `iconList`/`iconTiles` прототипа строки 914–915; по умолчанию плитки; `localStorage['pmo-projmode']`), `span.spacer`, выбор представления `label.viewsel` (`t('view')`, `select` с `PV`, подсказка `title={t('viewsNote')}`), шестерёнка только в режиме списка; строки — неархивные, фильтр представления, `byOrder`; под списком `p.hint` `t('hintProjects')`.
  - «Архів»: `hero` (`navArchive`, `t('archiveSub') + ' · ' + N`); только шестерёнка; архивные, по дате архивации ↓.
  - «Статус-звіти»: `hero(navReports)`; кнопка `cmd primary` «Новий статус-звіт» (ссылка на `Lists/StatusReports/NewForm.aspx`), если есть активный проект с `canEdit`; `RV`; по дате ↓.
  - «Ризики»: `hero(navRisks)`; «Новий ризик» по тому же условию (ссылка на `Lists/RisksIssues/NewForm.aspx`); `KV` (по умолчанию `open`); риски неархивных проектов по оценке ↓; `p.hint` `t('hintRisks')`.
  - «Показати все» на главной передаёт представление: `go('projects', 'problem')` открывает «Проєкти» в режиме списка с `Проблемні`.
- [x] **Step 3: `App.tsx`** — состояние `{ page, view, projectId }` синхронизируется с `location.hash` (`hashchange`); названия проектов во всех таблицах и плитки открывают карточку (`openProject`); `Home` получает `openProject` вместо кнопки-заглушки.
- [x] **Step 4:** `scripts/spfx.sh npm run build` → код 0. **Step 5: Commit** — «SPFx: вкладки Проєкти, Архів, Статус-звіти, Ризики …».

---

### Task 6: Выдвижная панель и карточка проекта

**Files:** Create `components/Panel.tsx`, `panels/ProjectCard.tsx`; Modify `components/App.tsx`

**Interfaces:**
- Consumes: `PortalData` (projects, reports, risks, comments, changes), `toEvents`, `SpRepo.jobTitle`, логика этапа 1.
- Produces: `<Panel open onClose>` (`div.pmo-scrim` + `aside.pmo-panel[role=dialog][aria-modal]`, класс `open`, Esc закрывает, фокус возвращается на элемент, открывший панель, прокрутка страницы блокируется); `<ProjectCard project data repo onClose />`.

Разделы карточки — порядок `projectPanel` прототипа (строки 1289–1340), кроме «Доступ до картки» (этап 4):
1. `div.ph`: `code · t('listLabel') «t('navProjects')»`, `h2` название, крестик `x`.
2. `div.badges`: тип (`strat` для стратегического, иначе `badge`), пилюля RAG, статус, приоритет, «Відкрити в Loop ↗».
3. `div.actbar`, если `canEdit` и не архив: «Додати статус-звіт» (`btn primary`, до этапа 3 — ссылка на форму списка), «Редагувати» (ссылка на `Lists/Projects/EditForm.aspx?ID=<id>`); иначе `p.note.lock` «🔒 » + `t('archivedNote')` / `t('noEdit')`. Если `project.pending` — `p.note` `t('pendingNote')`.
4. `p.desc` — описание.
5. «Учасники» (`secPeople`): `pmcard` (аватар `lg`, имя, «должность · e-mail» — `jobTitle`, метка `pmRole`), `people2`: собственник и стейкхолдеры (`person` с должностью).
6. «Терміни» (`secDates`): `group` из `kv` — старт, запуск, план (красный при просрочке), прогноз `+N дн.` (`late`) или `−N дн.` (`muted`), дата архивации.
7. «Бюджет і виконання» (`secMoney`): % (полоса `prog`), свежесть отчёта, бюджет, факт · освоение %, направление.
8. «Історія змін» (`secChanges`): `toEvents` по проекту; 3 последних, «Показати всю історію (N)» / «Згорнути»; разметка `chg`, `chg-h`, `chg-k chg-<kind>` (`kCreate`/`kKey`/`kEdit`/`kReport`), `diffs`/`diff` (`<s>было</s> → стало`), `chg-r` — причина.
9. «Коментарі»: последний и «Показати всю історію (N)»; элемент `hist-c` (`who`: дата-время · автор; текст). Форма добавления — этап 3.
10. «Історія станів» (`secHistory`): таблица `matrix` по последним 8 отчётам: строки rag/sched/budget/res — точки, progress — число.
11. «Статус-звіти (N)» (`secReports`): новые сверху, `rep`: `rep-h` (дата, RAG, автор, `flag` «Потрібне рішення»), резюме, «Зроблено», «План», «Проблеми», «Потрібне рішення: …».
12. «Ризики та проблеми (N)» (`secRisks`): `rlist` строк `rrow` (оценка, название, «тип · статус»), по оценке ↓; пусто — `t('emptyRisks')`.

- [x] **Step 1:** Реализовать `Panel.tsx` и `ProjectCard.tsx` по описанию.
- [x] **Step 2:** `scripts/spfx.sh npm run build` → код 0. **Step 3: Commit** — «SPFx: карточка проекта (только чтение) …».

---

### Task 7: Установка на `pmo-test`, проверка, документация

**Files:** Modify `spfx/config/package-solution.json` (версия `1.1.0.0`), `docs/DEPLOYMENT.md`, `CHANGELOG.md`, план (отметки)

- [x] **Step 1:** `pwsh -NoLogo -File tests/Test-Scripts.ps1` и `scripts/spfx.sh npm run test:unit` → всё проходит.
- [x] **Step 2:** `pwsh -NoLogo -File scripts/Invoke-Env.ps1 -Env test -Action app` → «приложение обновлено до 1.1.0.0».
- [x] **Step 3: Проверка в Chrome рядом с прототипом** (светлая и тёмная тема, UA/EN/RU):
  - «Проєкти»: плитки по умолчанию, 9 плиток; «Список» — колонки по умолчанию; сортировка по «Стан» и «% виконання» (пустые внизу); фильтр «Статус» с чипом; шестерёнка: снять/вернуть колонку, сдвинуть, «Як за замовчуванням»; после перезагрузки настройки сохранены; представления «Проблемні» (5), «Немає свіжого звіту» (3), «Мої проєкти».
  - «Архів»: 1 проект (TEST-08).
  - «Статус-звіти»: 18, «Потребують рішення» — 2; «Ризики»: «Відкриті» — 11, «Усі елементи» — 12.
  - Карточка TEST-01: все разделы 1–12; история изменений собрана в события («Створення» и отчёты), комментарии — 2, матрица состояний — 3 отчёта, риски — 2; Esc закрывает, фокус возвращается; адрес `#…/1` открывает карточку после перезагрузки.
  - «Показати все» на главной открывает нужные представления.
- [x] **Step 4:** `docs/DEPLOYMENT.md` — в разделе «Приложение SPFx» перечислить вкладки и карточку; `CHANGELOG.md` — «SPFx, этап 2: списки, плитки, архив, карточка проекта (только чтение)».
- [x] **Step 5: Commit** — «SPFx, этап 2: установка на pmo-test, документация …».

## Приёмка этапа (человек)

- Вкладки и карточка на `pmo-test` визуально и по поведению совпадают с прототипом (кроме форм — этап 3 — и раздела «Доступ» — этап 4).
- Числа совпадают со списками сайта (перечислены в Task 7, Step 3).
