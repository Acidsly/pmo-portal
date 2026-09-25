# SPFx, этап 3: формы и запись — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Ход работ: задачи 1–8 выполнены 2026-09-26 (ветка `change/spfx-phase3` от `change/spfx-phase2`), версия 1.2.2.0 на `pmo-test`; кросс-ревью задач 5–8 проведено. Проверено вживую: отчёт с причиной, комментарий, правка карточки (pmEditLog), новый проект PRJ-001, риск 5×4. Ждут синхронизации: перенос в списки, журнал, права, архив. «Завершено» → проект сразу в «Архів» на экране (наложение), в списках — после синхронизации.

**Goal:** В приложении на `pmo-test` работают формы прототипа: новый проект и правка карточки, статус-отчёт (подстановка показателей, живой расчёт стану, обязательная причина), риск (создание, правка, просмотр) и комментарий; сохранённое сразу видно на экране, а журнал и права обновляет синхронизация.

**Architecture:** Проверки, «изменились ли ключевые показатели», следующий код `PRJ-###` и сборка тела запроса REST — чистые функции (`logic/forms.ts`, `data/write.ts`) с тестами. Запись — `SpRepo` от имени пользователя (POST / MERGE через `SPHttpClient`). Формы — панели с разметкой прототипа (`projectForm`, `reportForm`, `riskForm`, форма комментария в `projectPanel`). Правка карточки записывает «было / стало» в скрытое поле `pmEditLog`; синхронизация переносит его в журнал «Зміни показників» (вид «Редагування картки») и очищает поле.

**Tech Stack:** как на этапах 1–2; PnP.PowerShell для изменений `Deploy-PMO.ps1` / `Invoke-PMOSync.ps1`.

**Spec:** `docs/superpowers/specs/2026-09-24-spfx-portal-design.md` (этап 3; решение «Отчёт → карточка»: на экране сразу, в списки — синхронизация).

## Global Constraints

- Ограничения этапов 1–2 действуют. Ветка `change/spfx-phase3` от `main` после слияния этапа 2.
- Приложение **не пишет** ключевые показатели в карточку (`pmStatus`, `pmRAG`, `pmType`, `pmProgress`, даты, `pmActualCost`, `pmLastUpdate`, `pmLastReport`), журнал «Зміни показників», права и `pmoAcl` — это синхронизация. Новый отчёт сохраняется с `srApplied = нет`.
- Даты записываются как полдень UTC (`YYYY-MM-DDT12:00:00Z`), как `ToSpDate` синхронизации.
- Значения выбора — украинские, как в `Deploy-PMO.ps1`; «Завершено» — только в отчёте.
- Тексты и сообщения — ключи словарей прототипа (`errDims`, `errSum`, `errDate`, `errKeyReason`, `errTitle`, `errPM`, `errRiskTitle`, `errCmt`, `completeHint`, `keyReason`, `reasonPh`, `summaryPh`, `accessRecalc`, `readOnly`, `p1…p5`, `i1…i5`, `sc0…sc2`, `save`, `cancel`, тосты сохранения); недостающие — в `EXTRA` генератора.
- Поле `pmEditLog` — новое скрытое поле; добавляется только через `F` в `Deploy-PMO.ps1` (идемпотентно), внутренние имена не переименовываются.

## Структура файлов этапа

```
spfx/src/webparts/pmoPortal/
  logic/forms.ts         nextCode, keyChanged, validateReport / Project / Risk / Comment, cardDiff
  data/write.ts          тела запросов REST: reportBody, projectBody, projectEditBody, riskBody, commentBody
  data/SpRepo.ts         + create, update, ensureUser, searchPeople
  components/fields.tsx  поля форм прототипа: Frow, SegPick (RAG, тип), DateIn, PeoplePicker, Err
  components/Toast.tsx   всплывающее сообщение (4,2 с)
  panels/ReportForm.tsx, ProjectForm.tsx, RiskForm.tsx; ProjectCard.tsx + форма комментария
  components/App.tsx     панель: карточка | форма; перезагрузка данных после сохранения
scripts/Deploy-PMO.ps1   + поле pmEditLog (скрытое, Note)
scripts/Invoke-PMOSync.ps1 + pmEditLog -> журнал «Редагування картки», очистка
tests/cases/card-edit.json  общие векторы: pmEditLog -> строки журнала (Jest и Test-Scripts.ps1)
spfx/test/forms.test.ts, write.test.ts
```

---

### Task 1: Правила форм

**Files:** Create `logic/forms.ts`, `spfx/test/forms.test.ts`

**Interfaces:**
```ts
export interface ReportDraft { projectId: number; date: string; period: string; schedule: Rag; budget: Rag; resources: Rag;
  status: string; type: string; progress: number; start: string; goLive: string; planEnd: string; forecastEnd: string; actualCost: number;
  title: string; done: string; next: string; issues: string; decision: boolean; decisionText: string; keyReason: string; }
export interface ProjectDraft { title: string; code: string; department: string; loop: string; type: string; priority: string;
  manager: Person | null; owner: Person | null; stakeholders: Person[]; start: string; goLive: string; planEnd: string; status: string;
  budget: number; description: string; }
export interface RiskDraft { projectId: number; title: string; type: string; probability: number; impact: number; owner: Person | null;
  status: string; due: string; mitigation: string; }
export function nextCode(codes: string[]): string;                                   // max PRJ-NNN + 1, трёхзначный
export function reportFromProject(p: Project, today: string): ReportDraft;            // подстановка текущих показателей
export function keyChanged(d: ReportDraft, p: Project): boolean;                      // статус, тип, даты (не % и не затраты)
export function validateReport(d: ReportDraft, p: Project): string | '';              // ключ ошибки: errDims -> errSum -> errDate -> errKeyReason
export function validateProject(d: ProjectDraft): string | '';                         // errTitle -> errPM
export function validateRisk(d: RiskDraft): string | '';                               // errRiskTitle
export function cardDiff(before: Project, d: ProjectDraft): { f: string; from: string; to: string }[];  // правка карточки, без описания
```

- [x] **Step 1: Падающий тест** — `spfx/test/forms.test.ts` (фабрика `P` — как в `views.test.ts`):
```ts
import { nextCode, reportFromProject, keyChanged, validateReport, validateProject, validateRisk, cardDiff } from '../src/webparts/pmoPortal/logic/forms';
// … фабрика P(x: Partial<Project>) как в views.test.ts
const p = P({ status: 'Реалізація', type: 'Звичайний', progress: 40, planEnd: '2026-12-01', actualCost: 100 });

test('nextCode', () => {
  expect(nextCode(['PRJ-001', 'PRJ-012', 'TEST-99', ''])).toBe('PRJ-013');
  expect(nextCode([])).toBe('PRJ-001');
});
test('подстановка и «изменились ли показатели» (как keyChanged прототипа)', () => {
  const d = reportFromProject(p, '2026-09-26');
  expect(d).toMatchObject({ projectId: 1, date: '2026-09-26', period: '2 тижні', status: 'Реалізація', progress: 40, planEnd: '2026-12-01', actualCost: 100 });
  expect(keyChanged(d, p)).toBe(false);
  expect(keyChanged({ ...d, progress: 60, actualCost: 500 }, p)).toBe(false);   // % и затраты причины не требуют
  expect(keyChanged({ ...d, planEnd: '2027-01-15' }, p)).toBe(true);
  expect(keyChanged({ ...d, type: 'Стратегічний' }, p)).toBe(true);
});
test('проверки отчёта в порядке прототипа', () => {
  const ok = { ...reportFromProject(p, '2026-09-26'), schedule: 'Зелений', budget: 'Зелений', resources: 'Жовтий', title: 'Резюме' } as const;
  expect(validateReport({ ...ok, resources: '' }, p)).toBe('errDims');
  expect(validateReport({ ...ok, title: ' ' }, p)).toBe('errSum');
  expect(validateReport({ ...ok, date: '' }, p)).toBe('errDate');
  expect(validateReport({ ...ok, status: 'Призупинено' }, p)).toBe('errKeyReason');
  expect(validateReport({ ...ok, status: 'Призупинено', keyReason: 'Пауза' }, p)).toBe('');
});
test('проверки проекта и риска', () => {
  expect(validateProject({ title: '', manager: null } as never)).toBe('errTitle');
  expect(validateProject({ title: 'П', manager: null } as never)).toBe('errPM');
  expect(validateRisk({ title: ' ' } as never)).toBe('errRiskTitle');
});
test('правка карточки: изменения без описания', () => {
  const before = P({ title: 'А', priority: '2 — Середній', department: 'ІТ', description: 'старое' });
  const diff = cardDiff(before, { title: 'Б', code: '', department: 'ІТ', loop: '', type: 'Звичайний', priority: '1 — Високий', manager: null, owner: null,
    stakeholders: [], start: '', goLive: '', planEnd: '', status: '', budget: 0, description: 'новое' });
  expect(diff).toEqual([{ f: 'title', from: 'А', to: 'Б' }, { f: 'prio', from: '2 — Середній', to: '1 — Високий' }]);
});
```
Run: `scripts/spfx.sh npm run test:unit` → FAIL.

- [x] **Step 2: Реализация** — `logic/forms.ts`:
```ts
import { Project, Person } from '../data/types';
import { Rag } from './rag';

export interface ReportDraft { /* как в Interfaces */ projectId: number; date: string; period: string; schedule: Rag; budget: Rag; resources: Rag;
  status: string; type: string; progress: number; start: string; goLive: string; planEnd: string; forecastEnd: string; actualCost: number;
  title: string; done: string; next: string; issues: string; decision: boolean; decisionText: string; keyReason: string; }
export interface ProjectDraft { title: string; code: string; department: string; loop: string; type: string; priority: string;
  manager: Person | null; owner: Person | null; stakeholders: Person[]; start: string; goLive: string; planEnd: string; status: string; budget: number; description: string; }
export interface RiskDraft { projectId: number; title: string; type: string; probability: number; impact: number; owner: Person | null; status: string; due: string; mitigation: string; }

export function nextCode(codes: string[]): string {
  const n = codes.map(c => /^PRJ-(\d+)$/.exec(c || '')).filter(Boolean).map(m => Number(m![1]));
  const next = (n.length ? Math.max(...n) : 0) + 1;
  return 'PRJ-' + (next < 10 ? '00' : next < 100 ? '0' : '') + next;
}
export function reportFromProject(p: Project, today: string): ReportDraft {
  return { projectId: p.id, date: today, period: '2 тижні', schedule: '', budget: '', resources: '', status: p.status, type: p.type,
    progress: p.progress, start: p.start, goLive: p.goLive, planEnd: p.planEnd, forecastEnd: p.forecastEnd, actualCost: p.actualCost,
    title: '', done: '', next: '', issues: '', decision: false, decisionText: '', keyReason: '' };
}
const KEYS: (keyof ReportDraft & keyof Project)[] = ['status', 'type', 'start', 'goLive', 'planEnd', 'forecastEnd'];
export const keyChanged = (d: ReportDraft, p: Project): boolean => KEYS.some(k => String(d[k] || '') !== String(p[k] || ''));
export function validateReport(d: ReportDraft, p: Project): string {
  if (!d.schedule || !d.budget || !d.resources) return 'errDims';
  if (!d.title.trim()) return 'errSum';
  if (!d.date) return 'errDate';
  if (keyChanged(d, p) && !d.keyReason.trim()) return 'errKeyReason';
  return '';
}
export const validateProject = (d: ProjectDraft): string => (!d.title.trim() ? 'errTitle' : !d.manager ? 'errPM' : '');
export const validateRisk = (d: RiskDraft): string => (!d.title.trim() ? 'errRiskTitle' : '');

const names = (xs: Person[]): string => xs.map(x => x.name).join(', ');
/** Изменения карточки для журнала (как «edit» прототипа): описание не журналируется. */
export function cardDiff(b: Project, d: ProjectDraft): { f: string; from: string; to: string }[] {
  const pairs: [string, string, string][] = [
    ['title', b.title, d.title], ['code', b.code, d.code], ['dept', b.department, d.department], ['loop', b.loop, d.loop],
    ['prio', b.priority, d.priority], ['pm', b.manager ? b.manager.name : '', d.manager ? d.manager.name : ''],
    ['owner', b.owner ? b.owner.name : '', d.owner ? d.owner.name : ''], ['stakeholders', names(b.stakeholders), names(d.stakeholders)],
    ['budget', String(b.budget || 0), String(d.budget || 0)]];
  return pairs.filter(x => x[1] !== x[2]).map(([f, from, to]) => ({ f, from, to }));
}
```
- [x] **Step 3:** тесты PASS. **Step 4: Commit** — «SPFx: правила форм — проверки, подстановка, изменения карточки …».

---

### Task 2: Тела запросов и запись в SharePoint

**Files:** Create `data/write.ts`, `spfx/test/write.test.ts`; Modify `data/SpRepo.ts`

**Interfaces:**
```ts
// write.ts — только внутренние имена полей; люди — Id (после ensureUser), даты — полдень UTC
export const spDate = (iso: string): string | null;                                   // '' -> null
export function reportBody(d: ReportDraft, p: Project): Record<string, unknown>;       // пишет только изменённые ключевые показатели; srApplied=false
export function projectBody(d: ProjectDraft, code: string): Record<string, unknown>;   // новый проект: pmStatus/pmType/даты задаются, pmProgress 0
export function projectEditBody(d: ProjectDraft, diff: { f: string; from: string; to: string }[], who: string, reason: string, prevLog: string): Record<string, unknown>; // без ключевых показателей; pmEditLog {entries:[…]} дописывается к prevLog; нет изменений — pmEditLog не трогается
export function riskBody(d: RiskDraft): Record<string, unknown>;
export function commentBody(projectId: number, text: string): Record<string, unknown>;
// SpRepo
create(list: 'Projects' | 'StatusReports' | 'RisksIssues' | 'ProjectComments', body: Record<string, unknown>): Promise<number>;  // Id
update(list: …, id: number, body: Record<string, unknown>): Promise<void>;     // MERGE, IF-MATCH *
ensureUser(email: string): Promise<number>;                                   // /_api/web/ensureuser
searchPeople(q: string): Promise<Person[]>;                                   // ClientPeoplePickerSearchUser, до 8 человек
```
Поля «Користувач» пишутся как `<поле>Id` (один) или `<поле>Id: [..]` (несколько, `odata=nometadata`); подстановка проекта — `srProjectId` / `riProjectId` / `cmProjectId`.

- [x] **Step 1: Падающий тест** — `spfx/test/write.test.ts`:
```ts
import { reportBody, projectBody, projectEditBody, riskBody, commentBody, spDate } from '../src/webparts/pmoPortal/data/write';
// … фабрика P и отчёт d из reportFromProject(p, '2026-09-26') с оценками и резюме
test('отчёт: только изменённые ключевые показатели, srApplied=false, даты — полдень UTC', () => {
  const b = reportBody({ ...d, progress: 55, planEnd: '2027-01-15', keyReason: 'Зсув' }, p);
  expect(b).toMatchObject({ srProjectId: 1, srDate: '2026-09-26T12:00:00Z', srSchedule: 'Зелений', srProgress: 55,
    srPlanEnd: '2027-01-15T12:00:00Z', srKeyReason: 'Зсув', srApplied: false, Title: 'Резюме' });
  expect(b).not.toHaveProperty('srStatus');       // не менялся — не пишем (синхронизация берёт только заполненное)
  expect(b).not.toHaveProperty('srActualCost');
});
test('новый проект и правка карточки', () => {
  expect(projectBody({ title: 'Н', code: '', manager: { id: 5 } as never, owner: null, stakeholders: [{ id: 6 }, { id: 7 }] as never,
    type: 'Звичайний', priority: '2 — Середній', department: 'ІТ', loop: '', status: 'Ініціація', start: '2026-09-26', goLive: '', planEnd: '', budget: 0, description: '' }, 'PRJ-011'))
    .toMatchObject({ Title: 'Н', pmCode: 'PRJ-011', pmManagerId: 5, pmStakeholdersId: [6, 7], pmStatus: 'Ініціація', pmStart: '2026-09-26T12:00:00Z', pmProgress: 0 });
  const e = projectEditBody({ title: 'Б' } as never, [{ f: 'title', from: 'А', to: 'Б' }], 'pm@x.ua', '');
  expect(e).not.toHaveProperty('pmStatus');
  expect(JSON.parse(String(e.pmEditLog))).toMatchObject({ who: 'pm@x.ua', diffs: [{ f: 'title', from: 'А', to: 'Б' }] });
});
test('риск и комментарий', () => {
  expect(riskBody({ projectId: 1, title: 'Р', type: 'Ризик', probability: 4, impact: 5, owner: { id: 9 } as never, status: 'Відкрито', due: '', mitigation: '' }))
    .toEqual({ riProjectId: 1, Title: 'Р', riType: 'Ризик', riProbability: 4, riImpact: 5, riOwnerId: 9, riStatus: 'Відкрито', riDue: null, riMitigation: '' });
  expect(commentBody(1, 'Текст')).toEqual({ cmProjectId: 1, cmText: 'Текст' });
  expect(spDate('')).toBeNull();
});
```
Run → FAIL. **Step 2:** реализовать `write.ts` по интерфейсам; `pmEditLog` = `JSON.stringify({ when: new Date().toISOString(), who, reason, diffs })`. `SpRepo.create/update` — `POST {web}/_api/web/GetList(@u)/items` с телом JSON и `Accept/Content-Type: application/json;odata=nometadata`; `update` — тот же адрес `/items(<id>)` с заголовками `X-HTTP-Method: MERGE`, `IF-MATCH: *`; ошибка — исключение с текстом ответа. `ensureUser` — `POST /_api/web/ensureuser` `{ logonName: 'i:0#.f|membership|<email>' }` → `Id`. `searchPeople` — `POST /_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser` `{ queryParams: { QueryString: q, MaximumEntitySuggestions: 8, PrincipalType: 1, AllowEmailAddresses: true } }` → разобрать строку-JSON `value` в `Person[]` (`EntityData.Email`, `DisplayText`; `id: 0` до `ensureUser`).
- [x] **Step 3:** тесты PASS; сборка — код 0. **Step 4: Commit** — «SPFx: запись в SharePoint — тела запросов, создание, правка, люди …».

---

### Task 3: Журнал правок карточки через синхронизацию

**Files:** Modify `scripts/Deploy-PMO.ps1`, `scripts/Invoke-PMOSync.ps1`, `tests/Test-Scripts.ps1`; Create `tests/cases/card-edit.json`

**Interfaces:**
- Produces: поле проекта `pmEditLog` (Note, `Hidden='TRUE'`, скрыто из форм); функция синхронизации `EditLogRows($json)` → строки журнала `{ field, from, to, who, reason, when }`; шаг синхронизации «Правки карточки»: для каждого проекта с непустым `pmEditLog` — строки в «Зміни показників» с видом «Редагування картки» (время — `when` из записи), затем `pmEditLog` очищается (`SystemUpdate`). Правка поверх необработанной — записи объединяются: приложение читает текущий `pmEditLog` и дописывает в массив `entries`.

- [x] **Step 1:** `tests/cases/card-edit.json` — вход `pmEditLog` (одна и две записи) и ожидаемые строки журнала; раздел `Test-Scripts.ps1` «4b. Правки карточки» вызывает `EditLogRows` (через AST, как `CalcRag`) и сравнивает. Run → FAIL.
- [x] **Step 2:** `Deploy-PMO.ps1`: `F $P pmEditLog Note "Службове: правки картки" "System: card edits" "Служебное: правки карточки" "Hidden='TRUE' NumLines='6' RichText='FALSE'"`; `Set-FormVisibility $P @("pmEditLog") $false $false`. `Invoke-PMOSync.ps1`: `EditLogRows` + шаг после «Отчёт → карточка»; `pmEditLog` добавить в загружаемые значения проекта; в `-DryRun` — только журнал в консоль. Формат `pmEditLog`: `{"entries":[{"when":"…","who":"e-mail","reason":"…","diffs":[{"f":"title","from":"А","to":"Б"}]}]}` — `write.ts` пишет этот же формат (обновить тест Task 2: `entries[0]`).
- [x] **Step 3:** `Test-Scripts.ps1` → «Все проверки пройдены»; `-Env test -Action deploy` → поле создано; `-Env test -Action sync-dryrun` (после регистрации PMO Sync) или проверка на копии, как на этапе 1.
- [x] **Step 4: Commit** — «Синхронизация: правки карточки из приложения -> журнал «Редагування картки» …».

---

### Task 4: Поля форм и тост

**Files:** Create `components/fields.tsx`, `components/Toast.tsx`

**Interfaces:**
```tsx
Frow: React.FC<{ label: string; req?: boolean; hint?: string; children }>          // div.frow > label.t (+ «*»), подсказка p.hint
SegPick<V>: (p: { name: string; options: V[]; value: V; onChange(v: V): void; render?(v: V): ReactNode })  // fieldset.ragpick / segPick прототипа
RagPick: (p: { name: string; value: Rag; onChange(v: Rag): void })                  // три точки-кнопки RAG
DateIn: React.FC<{ value: string; onChange(v: string): void; id: string }>          // input type=date, значение YYYY-MM-DD
PeoplePicker: React.FC<{ value: Person[]; multi: boolean; onChange(v: Person[]): void; search(q): Promise<Person[]> }>  // чипы + поиск от 2 символов, стрелки и Enter
Err: React.FC<{ msg: string }>                                                       // p.err
Toast: React.FC<{ msg: string }> + useToast(): [msg, show(m)]                       // #toast прототипа, 4200 мс
```
Разметка и классы — `frow`, `fgrid2`, `ragpick`, `segPick`, `check`, `err`, `actions`, `btn primary` прототипа (`projectForm` / `reportForm` / `riskForm`, строки 1353–1550). `PeoplePicker` — классы `person`, `pav`, `pop-list`/`pop-row` (выпадающий список под полем).

- [x] **Step 1:** реализовать; **Step 2:** сборка — код 0; **Step 3: Commit** — «SPFx: поля форм и сообщения …».

---

### Task 5: Форма статус-отчёта

**Files:** Create `panels/ReportForm.tsx`; Modify `components/App.tsx`, `panels/ProjectCard.tsx`, `pages/Reports.tsx`

**Interfaces:** `<ReportForm projectId?: number; data; repo; onDone(saved: boolean) />`; `App` — состояние панели `{ kind: 'card' | 'report' | 'project' | 'risk', … }` в адресе (`#…/<id>/report`), после сохранения — `repo.loadAll()` и тост.

Поведение `reportForm` прототипа (строки 1470–1550):
- выбор проекта — активные с `canEdit`; смена проекта заново подставляет показатели (`reportFromProject`);
- дата (сегодня), период (Тиждень / 2 тижні / Місяць / Квартал);
- три оценки `RagPick` и блок `ragcalc` с живым `calcRag`;
- «Ключові показники»: статус (`REPORT_STATUSES` + «Завершено — перенести в архів»), %, тип (`SegPick`), старт, запуск, план, прогноз, затраты; подсказка `completeHint` при «Завершено»; поле «Причина зміни показників *» видно, только если `keyChanged`;
- резюме *, зроблено, план, проблеми; «Потрібне рішення керівництва» — чекбокс, «Яке рішення потрібне» видно только при отметке;
- «Зберегти» → `validateReport` (ошибка — `Err`, фокус на поле) → `create('StatusReports', reportBody(...))` → тост «Статус-звіт збережено» → карточка проекта: показатели уже новые (наложение неприменённого отчёта) и заметка `pendingNote`.
- Кнопки «Додати статус-звіт» (карточка) и «Новий статус-звіт» (вкладка) открывают эту форму вместо стандартной.

- [x] **Step 1:** реализовать; **Step 2:** сборка; **Step 3:** на `pmo-test`: отчёт по TEST-04 с изменением плановой даты без причины — ошибка `errKeyReason`; с причиной — сохранён, в карточке новый стан и дата, в «Статус-звіти» новая строка; **Step 4: Commit**.

---

### Task 6: Новый проект и правка карточки

**Files:** Create `panels/ProjectForm.tsx`; Modify `components/App.tsx`, `pages/common.tsx`, `panels/ProjectCard.tsx`

Поведение `projectForm` прототипа (строки 1353–1418):
- новый: значения по умолчанию — PM = текущий пользователь, «Звичайний», «Ініціація», «2 — Середній», «ІТ», старт = сегодня; разделы «Основне» (назва *, код — подсказка «присвоїться автоматично», напрям, Loop, тип), «Учасники» (PM *, власник, стейкхолдери — `PeoplePicker`), «Терміни» (старт, запуск, план, статус), «Бюджет і виконання» (пріоритет, бюджет, опис); код пустой → `nextCode(все коды)`; `create('Projects', projectBody(...))`;
- правка (кнопка «Редагувати» в карточке, только `canEdit`): без типа, дат и статуса (меняются только отчётом); заметка `accessRecalc`; нет изменений — просто вернуться в карточку; иначе `update('Projects', id, projectEditBody(d, cardDiff(...), me, ''))` с дописыванием к текущему `pmEditLog`;
- люди: перед записью `ensureUser` для каждого выбранного без `id`;
- после сохранения — тост, перезагрузка данных, карточка проекта. Новый проект до синхронизации виден по правам списка; заметка в тосте: «Права обновятся после синхронизации».

- [x] **Step 1:** реализовать; **Step 2:** сборка; **Step 3:** на `pmo-test`: новый проект без PM — `errPM`; с PM — `PRJ-001` (первый код PRJ), карточка открывается; правка названия и приоритета — в `pmEditLog` запись с двумя изменениями; **Step 4: Commit**.

---

### Task 7: Риск и комментарий

**Files:** Create `panels/RiskForm.tsx`; Modify `panels/ProjectCard.tsx`, `pages/Risks.tsx`, `components/defs.tsx`

- Риск (`riskForm` прототипа, строки 1419–1469): проект — список (новый со вкладки) или текст (из карточки); назва * (textarea), тип Ризик/Проблема, ймовірність и вплив 1–5 с описаниями `p1…p5` / `i1…i5`, живая оценка (чип, `sc0…2`, «= p × i»), власник (по умолчанию PM), статус (Відкрито / В роботі / Закрито), термін, заходи; без `canEdit` — `readOnly`, поля выключены, «Закрити»; сохранение — `create` / `update('RisksIssues', …)`; строки рисков в карточке и названия во вкладке «Ризики» открывают форму риска.
- Комментарий (форма `cmform` в карточке): textarea `cmtPh`, «Додати коментар»; пусто — `errCmt`; `create('ProjectComments', commentBody(...))` → тост `cmtSaved`, комментарий сверху списка (перезагрузка данных).

- [x] **Step 1:** реализовать; **Step 2:** сборка; **Step 3:** на `pmo-test`: риск 5 × 4 = 20 (красный) создан и открывается на правку; пустой комментарий — ошибка, непустой — появился в карточке; **Step 4: Commit**.

---

### Task 8: Установка, сценарии, документация

- [x] **Step 1:** `Test-Scripts.ps1`, `npm run test:unit` → всё проходит; версия пакета `1.2.0.0`; `-Env test -Action deploy` (поле `pmEditLog`) и `-Env test -Action app`.
- [x] **Step 2: Сценарии** из `CLAUDE.md` («Как проверять изменения прототипа») на `pmo-test` в Chrome: новый проект, редактирование, статус-отчёт с изменением показателей, архив («Завершено» → после синхронизации проект в «Архів»), риск, комментарий, светлая и тёмная темы, три языка. Для сценариев, где нужна синхронизация (перенос отчёта, журнал, права, архив), — после регистрации PMO Sync, иначе отметить как «проверено на экране, запись — после синхронизации».
- [x] **Step 3:** `docs/DEPLOYMENT.md` (формы приложения, `pmEditLog`), `CLAUDE.md` (поле `pmEditLog` в модели данных; правило: ключевые показатели приложение не пишет), `CHANGELOG.md`.
- [x] **Step 4: Commit**; план — отметки выполнения.

## Приёмка этапа (человек)

- Формы визуально и по поведению совпадают с прототипом (подстановка, живой стан, условные поля, порядок ошибок).
- Сохранённое сразу видно в приложении; после синхронизации — в журнале и в карточке списка.

## Зависимость

Сценарии «перенос отчёта в карточку», «журнал», «права», «архив» полностью проверяются только с работающей синхронизацией — до начала Task 8 нужна регистрация приложения PMO Sync (`Register-PMOApps.ps1 -Stage Sync`, выполняет человек).
