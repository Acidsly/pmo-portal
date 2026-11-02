/** @jest-environment jsdom */
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { ReportForm } from '../src/webparts/pmoPortal/panels/ReportForm';
import { ReportView } from '../src/webparts/pmoPortal/panels/ReportView';
import { RiskForm } from '../src/webparts/pmoPortal/panels/RiskForm';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { setValueLang } from '../src/webparts/pmoPortal/i18n/values';
import { reportWarnings, reportMoneyAt, reportHasText, clearReportText, reportDirty, reportFromProject, PLAN_ALL_DONE } from '../src/webparts/pmoPortal/logic/forms';
import { reportView, latestReportIds, KV } from '../src/webparts/pmoPortal/logic/views';

// Доработки по отзывам R8 (#118, #120, #124, #125, #127, #128, #132–#136): общие векторы (приложение; прототип — r8Improvements-prototype.test.ts)
// и поведение компонентов в jsdom
const V = (f: string): any => JSON.parse(fs.readFileSync(path.join(__dirname, '../../tests/cases', f), 'utf8'));

describe('общие векторы', () => {
  for (const c of V('report-warn.json').cases as any[]) test('предупреждения формы: ' + c.name, () => {
    expect(reportWarnings(c.d, c.p, c.open, c.today)).toEqual(c.out);
  });
  for (const c of V('report-money.json').cases as any[]) test('суммы на дату отчёта: ' + c.name, () => {
    const reps = c.reports.map((r: any) => ({ projectId: 1, applied: false, ...r }));
    expect(reportMoneyAt(reps, c.p, reps.filter((r: any) => r.id === c.r)[0])).toEqual(c.out);
  });
  for (const c of V('decision.json').cases as any[]) test('«Потребують рішення»: ' + c.name, () => {
    const latest = latestReportIds(c.reports);
    expect(c.reports.filter((r: any) => reportView('decision', r, latest)).map((r: any) => r.id).sort()).toEqual(c.out);
  });
});

describe('текст и изменения формы (#133, #134, #120)', () => {
  const d0 = reportFromProject({ id: 1, status: 'Реалізація', type: 'Звичайний', progress: 40, start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: 0, budget: 0 } as any, '2026-10-30');
  test('текст — любое из полей PM; пробелы и «Усе виконано» от отметки — не текст', () => {
    expect(reportHasText(d0)).toBe(false);
    for (const k of ['title', 'done', 'notDone', 'next', 'issues', 'keyReason', 'decisionText']) expect([k, reportHasText({ ...d0, [k]: 'x' })]).toEqual([k, true]);
    expect(reportHasText({ ...d0, title: '   ' })).toBe(false);
    expect(reportHasText({ ...d0, notDone: PLAN_ALL_DONE })).toBe(false);
  });
  test('очистка текста — все поля PM и запрос рішення; показатели не трогает', () => {
    const d = clearReportText({ ...d0, title: 'a', done: 'b', notDone: 'c', next: 'd', issues: 'e', keyReason: 'f', decision: true, decisionText: 'g', progress: 70 });
    expect(reportHasText(d)).toBe(false); expect(d.decision).toBe(false); expect(d.progress).toBe(70);
  });
  test('изменена ли форма: оценки, показатели, тексты; без изменений — нет', () => {
    expect(reportDirty(d0, d0)).toBe(false);
    expect(reportDirty({ ...d0, schedule: 'Зелений' }, d0)).toBe(true);
    expect(reportDirty({ ...d0, actualCost: 5 }, d0)).toBe(true);
    expect(reportDirty({ ...d0, issues: 'x' }, d0)).toBe(true);
  });
});

test('#128: представление — «Високі ризики та проблеми» (в нём и проблемы с оценкой от 15)', () => { expect(KV.high).toBe('Високі ризики та проблеми'); });

// ---------- компоненты ----------
const tt = makeT(0);
let guard: (() => boolean) | null = null;
const ctx: any = { ...tt, lang: 0, today: '2026-10-30', me: 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openForm() { /* */ },
  openProject() { /* */ }, canCreate: true, reload: async () => undefined, toast() { /* */ }, setCloseGuard: (g: any) => { guard = g; },
  repo: { createIn: async () => 1, fresh: async () => ({}), loadChanges: async () => [] } };
const pj = (x: any = {}): any => ({ id: 1, code: 'PRJ-001', title: 'Проєкт А', type: 'Звичайний', priority: '2 — Середній', status: 'Реалізація', department: 'ІТ',
  manager: { id: 1, email: 'pm@x', name: 'PM' }, owner: null, stakeholders: [], team: [], links: [], budget: 500, forecastCost: null, description: 'опис', canEdit: true, rag: '',
  progress: 10, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', actualCost: 110, lastUpdate: '', lastReport: '', lastComment: '', pendingDate: '', parent: null, ...x });
const risk = (x: any = {}): any => ({ id: 3, projectId: 1, title: 'Затримка постачальника', type: 'Ризик', probability: 4, impact: 5, owner: null, status: 'Відкрито', due: '2026-10-01',
  mitigation: '', strategy: '', contingency: '', ...x });
const data = (projects: any[], reports: any[] = [], risks: any[] = []): any => ({ projects, reports, risks, comments: [], changes: [], team: [], approvals: [], canCreate: true, canApprove: false });
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); guard = null; });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); jest.restoreAllMocks(); });
const mount = (el: React.ReactElement): void => { act(() => { ReactDOM.render(<AppCtx.Provider value={ctx}>{el}</AppCtx.Provider>, root); }); };
const $ = (s: string): HTMLElement => root.querySelector(s) as HTMLElement;
const type = (s: string, v: string): void => { act(() => { Simulate.change($(s), { target: { value: v } } as any); }); };

test('#118: ризик архівного проєкту — причина «проєкт в архіві», а не «лише PM»', () => {
  mount(<RiskForm data={data([pj({ status: 'Завершено' })], [], [risk()])} projectId={1} riskId={3} onCancel={() => undefined} />);
  expect($('#k-ro').textContent).toBe('🔒 ' + tt.t('riskArchived'));
  ReactDOM.unmountComponentAtNode(root);
  mount(<RiskForm data={data([pj({ canEdit: false })], [], [risk()])} projectId={1} riskId={3} onCancel={() => undefined} />);
  expect($('#k-ro').textContent).toBe('🔒 ' + tt.t('readOnly'));
});

describe('форма звіту', () => {
  test('#127: прогноз завершення минув — попередження під полем; виправили — зникло', () => {
    mount(<ReportForm data={data([pj()])} projectId={1} onCancel={() => undefined} />);
    expect($('#w-forecastEnd')).toBeNull();
    type('#f-fc', '20.10.2026');
    expect($('#w-forecastEnd').textContent).toBe(tt.t('warnForecastPast'));
    type('#f-fc', '20.12.2026');
    expect($('#w-forecastEnd')).toBeNull();
  });
  test('#125: витрати на дату менші за погоджені — попередження з погодженою сумою; підказка «з початку проєкту» завжди', () => {
    mount(<ReportForm data={data([pj()])} projectId={1} onCancel={() => undefined} />);
    expect(root.textContent).toContain(tt.t('costHint'));
    expect($('#w-actualCost')).toBeNull();
    act(() => { Simulate.focus($('#f-c')); }); type('#f-c', '50'); act(() => { Simulate.blur($('#f-c')); });
    expect($('#w-actualCost').textContent!.replace(/[  ]/g, ' ')).toBe(tt.t('warnCostDown').replace('{v}', '110 $'));
  });
  test('#124 / #134: відкриті ризики — списком у формі; «Завершено» — попередження і список розкрито; закриті не показуються', () => {
    mount(<ReportForm data={data([pj()], [], [risk(), risk({ id: 4, title: 'Закритий', status: 'Закрито' }), risk({ id: 5, title: 'Проблема Б', type: 'Проблема', probability: 1, impact: 2, due: '' })])} projectId={1} onCancel={() => undefined} />);
    const det = $('#f-risks') as HTMLDetailsElement;
    expect(det.querySelector('summary')!.textContent).toBe(tt.t('openRisksT').replace('{n}', '2'));
    expect(Array.from(det.querySelectorAll('li b')).map(x => x.textContent)).toEqual(['Затримка постачальника', 'Проблема Б']);   // сначала высокие
    expect(det.querySelector('li .late')!.textContent).toBe('01.10.2026');
    expect(det.open).toBe(false); expect($('#w-status')).toBeNull();
    act(() => { Simulate.change($('#f-st'), { target: { value: 'Завершено' } } as any); });
    expect($('#w-status').textContent).toBe(tt.t('warnArchRisks').replace('{n}', '2'));
    expect(($('#f-risks') as HTMLDetailsElement).open).toBe(true);
  });
  test('#133: зміна проєкту з введеним текстом — питання; «ні» — проєкт і текст лишаються; «так» — інший проєкт, текст очищено', () => {
    const ask = jest.spyOn(window, 'confirm').mockReturnValue(false);
    mount(<ReportForm data={data([pj(), pj({ id: 2, title: 'Проєкт Б', code: 'PRJ-002' })])} projectId={0} onCancel={() => undefined} />);
    const sel = $('#f-p') as HTMLSelectElement; const first = sel.value; const other = first === '1' ? '2' : '1';
    // без текста — без вопроса
    act(() => { Simulate.change(sel, { target: { value: other } } as any); }); expect(ask).not.toHaveBeenCalled(); expect(sel.value).toBe(other);
    type('#f-t', 'Резюме проєкту'); type('#f-done', 'Зроблено');
    act(() => { Simulate.change(sel, { target: { value: first } } as any); });
    expect(ask).toHaveBeenCalledWith(tt.t('confirmSwitch'));
    expect([sel.value, ($('#f-t') as HTMLInputElement).value]).toEqual([other, 'Резюме проєкту']);
    ask.mockReturnValue(true);
    act(() => { Simulate.change(sel, { target: { value: first } } as any); });
    expect([sel.value, ($('#f-t') as HTMLInputElement).value, ($('#f-done') as HTMLTextAreaElement).value]).toEqual([first, '', '']);
  });
  test('#134: закрити змінену форму — питання (кнопки й панель через setCloseGuard); незмінену — без питання', () => {
    const ask = jest.spyOn(window, 'confirm').mockReturnValue(false);
    let closed = 0;
    mount(<ReportForm data={data([pj()])} projectId={1} onCancel={() => { closed++; }} />);
    expect(guard && guard()).toBe(true); expect(ask).not.toHaveBeenCalled();     // ничего не меняли — закрывается
    type('#f-t', 'Чернетка');
    act(() => { Simulate.click($('.ph .x')); });
    expect(ask).toHaveBeenCalledWith(tt.t('confirmClose')); expect(closed).toBe(0);
    expect(guard && guard()).toBe(false);                                         // Esc / фон панели — тот же вопрос
    ask.mockReturnValue(true);
    act(() => { Simulate.click(Array.from(root.querySelectorAll('.actions .btn')).filter(b => b.textContent === tt.t('cancel'))[0]); });
    expect(closed).toBe(1);
    act(() => { ReactDOM.unmountComponentAtNode(root); }); expect(guard).toBeNull();   // форма закрыта — вопрос снят
  });
  test('#120: «План виконано повністю» — поле «Не зроблено…» закрите, значення «Усе виконано», без обов’язковості', () => {
    const rep = { id: 9, projectId: 1, date: '2026-10-16', approval: 'Погоджено', applied: true, next: 'Розпочати планування' };
    mount(<ReportForm data={data([pj()], [rep])} projectId={1} onCancel={() => undefined} />);
    const nd = $('#f-nd') as HTMLTextAreaElement;
    expect($('label[for="f-nd"]').textContent).toMatch(/\*$/);
    act(() => { Simulate.change($('#f-pdone'), { target: { checked: true } } as any); });
    expect([nd.disabled, nd.value]).toEqual([true, 'Усе виконано']);
    expect($('label[for="f-nd"]').textContent).not.toMatch(/\*$/);
    act(() => { Simulate.change($('#f-pdone'), { target: { checked: false } } as any); });
    expect([nd.disabled, nd.value]).toEqual([false, '']);
  });
  test('#120 (кросс-ревью): зміна проєкту знімає «План виконано повністю» — не переходить на чужий план і не залипає без плану', () => {
    const reps = [{ id: 9, projectId: 1, date: '2026-10-16', approval: 'Погоджено', applied: true, next: 'План А' },
      { id: 10, projectId: 3, date: '2026-10-16', approval: 'Погоджено', applied: true, next: 'План В' }];
    mount(<ReportForm data={data([pj(), pj({ id: 2, title: 'Без плану', code: 'PRJ-002' }), pj({ id: 3, title: 'З планом', code: 'PRJ-003' })], reps)} projectId={0} onCancel={() => undefined} />);
    const sel = $('#f-p') as HTMLSelectElement;
    act(() => { Simulate.change(sel, { target: { value: '1' } } as any); });
    act(() => { Simulate.change($('#f-pdone'), { target: { checked: true } } as any); });
    act(() => { Simulate.change(sel, { target: { value: '2' } } as any); });
    expect($('#f-pdone')).toBeNull();
    expect([($('#f-nd') as HTMLTextAreaElement).disabled, ($('#f-nd') as HTMLTextAreaElement).value]).toEqual([false, '']);
    act(() => { Simulate.change(sel, { target: { value: '1' } } as any); });
    act(() => { Simulate.change($('#f-pdone'), { target: { checked: true } } as any); });
    act(() => { Simulate.change(sel, { target: { value: '3' } } as any); });
    expect(($('#f-pdone') as HTMLInputElement).checked).toBe(false);
  });
  test('#120: підказка під «Не зроблено…» веде до позначки «План виконано повністю», а не просить писати «усе виконано» вручну (uk / en / ru)', () => {
    [0, 1, 2].forEach(l => { const m = makeT(l as 0 | 1 | 2); expect(m.t('notDoneHint')).toContain(m.t('planAllDone')); expect(m.t('notDoneHint')).not.toMatch(/так і напишіть|say so|так и напишите/); });
  });
  test('#120: без плану в попередньому звіті позначки немає', () => {
    mount(<ReportForm data={data([pj()])} projectId={1} onCancel={() => undefined} />);
    expect($('#f-pdone')).toBeNull();
  });
});

describe('перегляд звіту (#135, #136)', () => {
  const R = (x: any): any => ({ projectId: 1, period: '', periodFrom: '', schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений', status: '', type: '', progress: null,
    start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: null, budgetPlan: null, forecastCost: null, keyReason: '', title: 'Звіт', done: '', next: '', issues: '',
    decision: false, decisionText: '', applied: true, author: { id: 1, email: 'pm@x', name: 'PM' }, approval: 'Погоджено', approvedBy: null, approvedAt: '', approvalNote: '', ...x });
  const r1 = R({ id: 1, date: '2026-10-16', next: 'Розпочати планування основних робіт', budgetPlan: 400, actualCost: 50 });
  const r2 = R({ id: 2, date: '2026-10-30', next: 'Новий план', notDone: 'Планування не розпочато' });
  const txt = (s: string): string => ($(s).textContent || '').replace(/[  ]/g, ' ');
  test('#135: суми, яких звіт не змінював, — на дату звіту з попереднього погодженого; #136 «Планувалось» — план попереднього з датою', async () => {
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={ctx}><ReportView data={data([pj({ budget: 500, actualCost: 110 })], [r1, r2])} report={r2} onCancel={() => undefined} /></AppCtx.Provider>, root); });
    expect(txt('#rv-budgetPlan')).toContain('400 $');
    expect(txt('#rv-actualCost')).toContain('50 $');
    expect(txt('#rv-forecastCost')).toContain('—');
    expect(txt('#rv-plan')).toContain('Розпочати планування основних робіт');
    expect(txt('#rv-plan')).toContain('16.10.2026');
  });
  test('#135: перший звіт без змінених сум — з картки (пізніше не змінювались); #136 — плану немає', async () => {
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={ctx}><ReportView data={data([pj({ budget: 500, actualCost: 110 })], [r2])} report={r2} onCancel={() => undefined} /></AppCtx.Provider>, root); });
    expect(txt('#rv-budgetPlan')).toContain('500 $'); expect(txt('#rv-actualCost')).toContain('110 $');
    expect($('#rv-plan')).toBeNull();
  });
  test('#120: «Усе виконано» у «Не зроблено…» — перекладом мовою інтерфейсу', async () => {
    const en = { ...ctx, ...makeT(1), lang: 1 }; setValueLang(1);   // как App: значения — на языке интерфейса
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={en}><ReportView data={data([pj()], [R({ id: 3, date: '2026-10-30', notDone: PLAN_ALL_DONE })])} report={R({ id: 3, date: '2026-10-30', notDone: PLAN_ALL_DONE })} onCancel={() => undefined} /></AppCtx.Provider>, root); });
    expect(root.textContent).toContain('All done'); setValueLang(0);
  });
});
