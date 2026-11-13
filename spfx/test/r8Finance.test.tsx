/** @jest-environment jsdom */
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { renderInto, disposeRoot } from '../src/webparts/pmoPortal/components/reactRoot';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { ReportForm } from '../src/webparts/pmoPortal/panels/ReportForm';
import { RiskForm } from '../src/webparts/pmoPortal/panels/RiskForm';
import { ProjectForm } from '../src/webparts/pmoPortal/panels/ProjectForm';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { budgetRule, switchStatus, reportFromProject } from '../src/webparts/pmoPortal/logic/forms';
import { calcRag } from '../src/webparts/pmoPortal/logic/rag';

// Финансы и власник ризику по решениям PMO 02.11.2026 (#111 / #121 / #123 пустые суммы и «Не оцінено», #122 состав витрат,
// #137 правило оценки «Бюджет», #129 власник обязателен) — логика и поведение компонентов; прототип — r8Finance-prototype.test.ts
const tt = makeT(0);
const ctx: any = { ...tt, lang: 0, today: '2026-10-30', me: 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openForm() { /* */ },
  openProject() { /* */ }, canCreate: true, reload: async () => undefined, toast() { /* */ }, setCloseGuard() { /* */ },
  repo: { createIn: async () => 1, fresh: async () => ({}), loadChanges: async () => [], searchPeople: async () => [] } };
const pj = (x: any = {}): any => ({ id: 1, code: 'PRJ-001', title: 'Проєкт А', type: 'Звичайний', priority: '2 — Середній', status: 'Планування', department: 'ІТ',
  manager: { id: 1, email: 'pm@x', name: 'PM' }, owner: null, stakeholders: [], team: [], links: [], budget: 0, forecastCost: null, description: 'опис', canEdit: true, rag: '',
  progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', pendingDate: '', parent: null, ...x });
const data = (projects: any[]): any => ({ projects, reports: [], risks: [], comments: [], changes: [], team: [], approvals: [], canCreate: true, canApprove: false });
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { act(() => { disposeRoot(root); }); root.remove(); });
const mount = (el: React.ReactElement): void => { act(() => { renderInto(root, <AppCtx.Provider value={ctx}>{el}</AppCtx.Provider>); }); };
const $ = (s: string): HTMLElement => root.querySelector(s) as HTMLElement;
const naRadio = (): HTMLInputElement | null => root.querySelector('input[name="budget"][value="Не оцінено"]');

describe('#121 «Не оцінено» в оценке «Бюджет»', () => {
  test('загальний стан — найгірша з двох інших оцінок (як формула поля і синхронізація)', () => {
    expect(calcRag('Зелений', 'Не оцінено', 'Зелений')).toBe('Зелений');
    expect(calcRag('Жовтий', 'Не оцінено', 'Зелений')).toBe('Жовтий');
    expect(calcRag('Зелений', 'Не оцінено', 'Червоний')).toBe('Червоний');
  });
  test('«Планування» лишає «Не оцінено», «Реалізація» знімає — оцінку треба обрати заново', () => {
    const d = { ...reportFromProject(pj(), '2026-10-30'), budget: 'Не оцінено' as const };
    expect(switchStatus(d, null, 'Планування').d.budget).toBe('Не оцінено');
    expect(switchStatus(d, null, 'Реалізація').d.budget).toBe('');
  });
  test('у формі — варіант лише в «Ініціація» / «Планування»; зміна фази на «Реалізація» знімає вибір і варіант', () => {
    mount(<ReportForm data={data([pj()])} projectId={1} onCancel={() => undefined} />);
    expect(naRadio()).not.toBeNull();
    act(() => { Simulate.change(naRadio() as HTMLInputElement); });
    expect((naRadio() as HTMLInputElement).checked).toBe(true);
    expect($('.ragcalc').textContent).toContain('не оцінено');   // две другие ещё не выбраны
    act(() => { Simulate.change($('#f-st'), { target: { value: 'Реалізація' } } as any); });
    expect(naRadio()).toBeNull();
    expect(root.querySelector('input[name="budget"]:checked')).toBeNull();
  });
  test('у фазі «Реалізація» варіанта немає', () => {
    mount(<ReportForm data={data([pj({ status: 'Реалізація' })])} projectId={1} onCancel={() => undefined} />);
    expect(naRadio()).toBeNull();
  });
});

describe('#111 / #123 порожні суми', () => {
  test('форма звіту: бюджет і витрати не задано — поля порожні, а не «0»', () => {
    mount(<ReportForm data={data([pj()])} projectId={1} onCancel={() => undefined} />);
    expect([($('#f-c') as HTMLInputElement).value, ($('#f-bp') as HTMLInputElement).value, ($('#f-fcost') as HTMLInputElement).value]).toEqual(['', '', '']);
  });
  test('очистили суму й вийшли з поля — порожньо, нуль не з’являється (#111)', () => {
    mount(<ReportForm data={data([pj({ actualCost: 110 })])} projectId={1} onCancel={() => undefined} />);
    const c = $('#f-c') as HTMLInputElement;
    act(() => { Simulate.focus(c); }); act(() => { Simulate.change(c, { target: { value: '' } } as any); }); act(() => { Simulate.blur(c); });
    expect(c.value).toBe('');
  });
  test('новий проєкт: бюджет не задано — поле порожнє', () => {
    mount(<ProjectForm data={data([pj()])} onCancel={() => undefined} />);
    expect(($('#f-bud') as HTMLInputElement).value).toBe('');
  });
  test('#122: підказка — усі витрати проєкту разом, з початку проєкту', () => {
    mount(<ReportForm data={data([pj()])} projectId={1} onCancel={() => undefined} />);
    expect(root.textContent).toContain('Усі витрати проєкту разом, з початку проєкту');
  });
});

describe('#137 правило оцінки «Бюджет»', () => {
  test('межі: немає перевищення — нічого; до 9% — жовтий; від 10% — червоний', () => {
    expect(budgetRule(1000, 1000)).toBeNull();
    expect(budgetRule(1000, 1001)).toEqual({ n: 1, rag: 'Жовтий' });   // меньше 1% — «1%», а не «0%»
    expect(budgetRule(1000, 1099)).toEqual({ n: 9, rag: 'Жовтий' });
    expect(budgetRule(1000, 1100)).toEqual({ n: 10, rag: 'Червоний' });
    expect(budgetRule(0, 1100)).toBeNull();
  });
  test('у формі: підказка під «Бюджет»; обрано зеленішу — попередження «перевірте оцінку»', () => {
    mount(<ReportForm data={data([pj({ status: 'Реалізація', budget: 540000, forecastCost: 675000 })])} projectId={1} onCancel={() => undefined} />);
    const w = (): string => ($('#w-budget') || { textContent: '' }).textContent || '';
    expect(w()).toBe(tt.t('hintBudgetRule').replace('{n}', '25').replace('{rag}', 'червоний'));
    act(() => { Simulate.change(root.querySelector('input[name="budget"][value="Зелений"]') as HTMLInputElement); });
    expect(w()).toBe(tt.t('warnBudgetRule').replace('{n}', '25').replace('{rag}', 'червоний'));
    act(() => { Simulate.change(root.querySelector('input[name="budget"][value="Червоний"]') as HTMLInputElement); });
    expect(w()).toBe(tt.t('hintBudgetRule').replace('{n}', '25').replace('{rag}', 'червоний'));
  });
});

describe('#129 власник ризику', () => {
  test('у новому записі — PM за замовчуванням, позначка «*»', () => {
    mount(<RiskForm data={data([pj({ status: 'Реалізація' })])} projectId={1} riskId={0} onCancel={() => undefined} />);
    expect($('label[for="k-owner"]').textContent).toMatch(/\*$/);
    expect($('label[for="k-owner"]').parentElement!.textContent).toContain('PM');   // PM подставлен
  });
  test('власника прибрали — помилка «Вкажіть власника…»', () => {
    mount(<RiskForm data={data([pj({ status: 'Реалізація', manager: null })])} projectId={1} riskId={0} onCancel={() => undefined} />);
    act(() => { Simulate.change($('#k-title'), { target: { value: 'Ризик' } } as any); });
    act(() => { Simulate.change(root.querySelector('input[name="k-str"][value="Прийняття"]') as HTMLInputElement); });
    act(() => { Simulate.change($('#k-mit'), { target: { value: 'Заходи' } } as any); });
    act(() => { Simulate.change($('#k-cont'), { target: { value: 'План' } } as any); });
    act(() => { Simulate.submit($('form')); });
    expect(root.textContent).toContain(tt.t('errRiskOwner'));
  });
});

test('#121: PMO бачить «Не оцінено» обраною у формі погодження', async () => {
  const { ReportView } = require('../src/webparts/pmoPortal/panels/ReportView');
  const r: any = { id: 5, projectId: 1, date: '2026-10-30', title: 'Звіт', approval: 'На погодженні', applied: false, author: { id: 1, email: 'pm@x', name: 'PM' },
    schedule: 'Зелений', budget: 'Не оцінено', resources: 'Жовтий', status: 'Планування', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '',
    actualCost: null, budgetPlan: null, forecastCost: null, keyReason: '', done: '', next: '', issues: '', decision: false, decisionText: '', approvedBy: null, approvedAt: '', approvalNote: '' };
  const d = { ...data([pj()]), reports: [r], canApprove: true };
  await act(async () => { renderInto(root, <AppCtx.Provider value={ctx}><ReportView data={d} report={r} onCancel={() => undefined} /></AppCtx.Provider>); });
  expect((root.querySelector('input[name="ap-b"][value="Не оцінено"]') as HTMLInputElement).checked).toBe(true);
});
test('#121: «Не оцінено» є серед значень поля «Бюджет» у Deploy-PMO.ps1 (лише додається)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../scripts/Deploy-PMO.ps1'), 'utf8');
  expect(src).toMatch(/\$ragBudget = \$rag \+ @\("Не оцінено"\)/);
  expect(src).toMatch(/srBudget[^\n]*\(Choices \$ragBudget\)/);
});
