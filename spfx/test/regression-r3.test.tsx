/** @jest-environment jsdom */
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { DataTable } from '../src/webparts/pmoPortal/components/DataTable';
import { TableDefs, projectDefs } from '../src/webparts/pmoPortal/components/defs';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { T } from '../src/webparts/pmoPortal/i18n/strings';
import { RiskForm } from '../src/webparts/pmoPortal/panels/RiskForm';
import { ReportForm } from '../src/webparts/pmoPortal/panels/ReportForm';
import { ProjectForm } from '../src/webparts/pmoPortal/panels/ProjectForm';
import { Archive } from '../src/webparts/pmoPortal/pages/Archive';
import { reportFromProject, reportFromReturned } from '../src/webparts/pmoPortal/logic/forms';
import { reportBody } from '../src/webparts/pmoPortal/data/write';

// Сверка покрытия отзывов (#54–#88, раунд 3 сверки): поведение приложения, которое не проверял ни один тест.
// Прототип — regression-r3-prototype.test.ts.
const tt = makeT(0);
const ctx: any = { ...tt, lang: 0, today: '2026-10-04', me: 'pm@x', webUrl: '', views: { archive: 'all' }, go() { /* */ }, setView() { /* */ }, openProject() { /* */ },
  openForm() { /* */ }, repo: { loadChanges: async () => [], jobTitle: async () => '' }, canCreate: true, reload: async () => undefined, toast() { /* */ } };
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); localStorage.clear(); });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const mount = (el: React.ReactElement): void => { act(() => { ReactDOM.render(<AppCtx.Provider value={ctx}>{el}</AppCtx.Provider>, root); }); };
const $ = (s: string): HTMLElement => root.querySelector(s) as HTMLElement;
const typeDate = (id: string, v: string): void => { act(() => { Simulate.change($('#' + id), { target: { value: v } } as any); }); };
const dmy = (iso: string): string => iso.split('-').reverse().join('.');
const pr = (x: any = {}): any => ({ id: 5, code: 'PRJ-005', title: 'Проєкт П', status: 'Реалізація', type: 'Звичайний', priority: '2 — Середній', progress: 40, actualCost: 0,
  start: '2026-03-02', goLive: '', planEnd: '2026-12-01', forecastEnd: '', archivedAt: '', budget: 0, rag: '', department: 'ІТ', lastUpdate: '', lastReport: '', lastComment: '',
  canEdit: true, manager: { id: 1, email: 'pm@x', name: 'PM' }, owner: null, stakeholders: [], team: [], links: [], description: '', pending: false, parent: null, ...x });
const data = (projects: any[], reports: any[] = []): any => ({ projects, reports, risks: [], comments: [], changes: [], team: [], approvals: [], canCreate: true, canApprove: false });
const read = (f: string): string => fs.readFileSync(path.join(__dirname, f), 'utf8');

describe('#54 / #64 фактическая дата: проверка сразу при вводе, а не только при сохранении', () => {
  const open = (): void => {
    mount(<ReportForm data={data([pr()])} projectId={5} onCancel={() => undefined} />);
    act(() => { Simulate.change($('#f-st'), { target: { value: 'Скасовано' } } as any); });
  };
  test('раньше старта — сообщение с датой старта у поля до отправки; исправили — сообщение и подсветка уходят', () => {
    open();
    typeDate('f-ae', '01.02.2026');
    expect(root.textContent).toContain(T.errBeforeStartOn[0].replace('{date}', '02.03.2026'));
    expect($('#f-ae').getAttribute('aria-invalid')).toBe('true');
    typeDate('f-ae', '02.03.2026');   // = старт — можно
    expect(root.textContent).not.toContain('Не може бути раніше дати старту');
    expect($('#f-ae').getAttribute('aria-invalid')).toBeNull();
  });
  test('класс: несколько дат раньше старта и позже сегодня — ошибка; между ними (досрочно) — нет', () => {
    open();
    for (const v of ['01.01.2000', '01.03.2026']) { typeDate('f-ae', v); expect($('#f-ae').getAttribute('aria-invalid')).toBe('true'); }
    // досрочно (раньше плана 01.12.2026) — можно; день старта и вчера — можно
    for (const v of ['15.06.2026', '02.03.2026']) { typeDate('f-ae', v); expect($('#f-ae').getAttribute('aria-invalid')).toBeNull(); }
  });
});

test('#54 синхронизация: «Дата завершення (факт)» переносится из отчёта в карточку и попадает в журнал («Історія змін»)', () => {
  const sync = read('../../scripts/Invoke-PMOSync.ps1');
  expect(sync).toMatch(/actualEnd = "pmActualEnd"/);                       // цель переноса отчёта
  expect(sync).toMatch(/pmActualEnd = "Дата завершення \(факт\)"/);        // $DISPLAY — поля, которые пишутся в журнал
  expect(sync).toMatch(/\$DATE_FIELDS = @\([^)]*"pmActualEnd"/);            // в журнале — как дата
  expect(sync).toMatch(/actualEnd = \(Norm \$r\["srActualEnd"\]\)/);        // читается из отчёта
});

test('#54 приложение: погоджений отчёт «Завершено» / «Скасовано» — фактическая дата в событии «Історії змін» (до синхронизации)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { applyPending } = require('../src/webparts/pmoPortal/logic/overlay');
  const R = (x: any): any => ({ id: 1, projectId: 5, date: '2026-10-01', schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений', status: '', type: '', progress: null, start: '',
    goLive: '', planEnd: '', forecastEnd: '', actualCost: null, keyReason: '', title: 'Звіт', done: '', next: '', issues: '', decision: false, decisionText: '', applied: false,
    author: { id: 1, name: 'PM', email: 'pm@x' }, approval: 'Погоджено', approvedBy: null, approvedAt: '', approvalNote: '', ...x });
  for (const status of ['Завершено', 'Скасовано']) {
    const p = applyPending(pr({ lastUpdate: '2026-09-01' }), [R({ status, actualEnd: '2026-09-28' })]);
    expect(p.actualEnd).toBe('2026-09-28');
    const diffs = (p.pendingEvents || []).reduce((a: any[], e: any) => a.concat(e.diffs), []);
    expect(diffs.filter((d: any) => d.f === 'ae').map((d: any) => d.to)).toEqual(['28.09.2026']);
  }
  // обычный статус — фактическая дата не переносится и в историю не попадает
  const p2 = applyPending(pr({ lastUpdate: '2026-09-01' }), [R({ status: 'Реалізація', actualEnd: '2026-09-28' })]);
  expect((p2.pendingEvents || []).reduce((a: any[], e: any) => a.concat(e.diffs), []).some((d: any) => d.f === 'ae')).toBe(false);
});

describe('#55 форма риска из общего раздела «Ризики та проблеми» — та же, что из карточки', () => {
  test('выбор проекта; тип — перед «Опис»; заголовок и метка — по типу; кнопка сохранения — «ризик / проблему»', () => {
    mount(<RiskForm data={data([pr(), pr({ id: 6, title: 'Проєкт Q' })])} projectId={0} riskId={0} onCancel={() => undefined} />);
    expect(root.querySelector('select#k-p')).not.toBeNull();                  // общий раздел — проект выбирается
    const ty = $('fieldset.ragpick'), ta = $('#k-title');
    expect(ty.compareDocumentPosition(ta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect($('label[for="k-title"]').textContent).toContain('Опис');
    expect($('.ph h2').textContent).toBe('Новий ризик');
    act(() => { Simulate.change(root.querySelector('input[name="k-type"][value="Проблема"]') as HTMLInputElement); });
    expect($('.ph h2').textContent).toBe('Нова проблема');
    expect($('.ph .ent').textContent).toBe('Проблема');
  });
});

describe('#58 карточки на телефоне: сортировка и фильтр таблицы действуют и в карточках', () => {
  type Row = { id: number; a: string; b: string };
  const defs: TableDefs<Row> = { lock: 'a', defaults: ['a', 'b'], cols: {
    a: { label: 'A', cell: (r: Row) => r.a, sort: (r: Row) => r.a, filter: (r: Row) => r.b },
    b: { label: 'B', cell: (r: Row) => r.b, sort: (r: Row) => r.b, filter: (r: Row) => r.b } } } as any;
  const rows: Row[] = [{ id: 1, a: 'в', b: 'x' }, { id: 2, a: 'а', b: 'y' }, { id: 3, a: 'б', b: 'x' }, { id: 4, a: 'г', b: 'y' }];
  const cards = (): string[] => Array.from(root.querySelectorAll('.mcards .mcard')).map(x => x.textContent || '');
  const table = (): string[] => Array.from(root.querySelectorAll('tbody tr')).map(tr => tr.children[0].textContent || '');
  test('сортировка по колонке (по возрастанию и убыванию) и фильтр — карточки в том же порядке и том же составе', () => {
    mount(<DataTable tkey="r3cards" defs={defs} rows={rows} card={r => <button className="mcard">{r.a}</button>} />);
    const sortA = (): void => { act(() => { (root.querySelectorAll('.sortb')[0] as HTMLButtonElement).click(); }); };
    sortA();
    expect(table()).toEqual(['а', 'б', 'в', 'г']); expect(cards()).toEqual(table());
    sortA();
    expect(table()).toEqual(['г', 'в', 'б', 'а']); expect(cards()).toEqual(table());
    // фильтр «B = x»
    act(() => { (root.querySelectorAll('.fbtn')[1] as HTMLButtonElement).click(); });
    const opt = Array.from(document.querySelectorAll('.pop-list input[type="checkbox"]')).filter(x => (x.parentElement!.textContent || '').indexOf('x') >= 0)[0] as HTMLInputElement;
    expect(opt).toBeDefined();
    act(() => { opt.click(); });
    expect(table()).toEqual(['в', 'б']); expect(cards()).toEqual(table());
  });
});

describe('#62 дата подання: не вводится, это день сохранения', () => {
  test('в форме нет поля даты отчёта — дата подання только показывается (сегодня формы)', () => {
    mount(<ReportForm data={data([pr()])} projectId={5} onCancel={() => undefined} />);
    expect(Array.from(root.querySelectorAll('#f-sub input, #f-sub select')).length).toBe(0);
    expect(root.querySelector('#f-date, #f-d, input[name="date"]')).toBeNull();
    expect($('#f-sub').textContent).toContain(`${tt.fl('rDate')}: ${dmy(ctx.today)}`);
  });
  test('новый отчёт на основе повернутого — своя дата подання (сегодня), а не дата повернутого', () => {
    const ret: any = { id: 7, projectId: 5, date: '2026-09-01', status: 'Реалізація', type: 'Звичайний', progress: 40, start: '', goLive: '', planEnd: '', forecastEnd: '',
      actualCost: null, schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений', title: 'Т', done: '', next: '', issues: '', decision: false, decisionText: '', keyReason: '' };
    for (const today of ['2026-09-02', '2026-10-04', '2027-01-15']) {
      const d = reportFromReturned(ret, pr(), today);
      expect(d.date).toBe(today);
      expect(reportBody(d, pr()).srDate).toBe(`${today}T12:00:00Z`);
    }
  });
});

test('#63 все переключатели форм отчёта и риска — input + label в .ragpick или шкале 1–5 (на них действует оформление «вибрано» / наведение / недоступно)', () => {
  const check = (): number => {
    const radios = Array.from(root.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
    radios.forEach(r => {
      expect(r.closest('.ragpick, .opts.scale')).not.toBeNull();
      expect(r.nextElementSibling && r.nextElementSibling.tagName).toBe('LABEL');
      expect((r.nextElementSibling as HTMLLabelElement).htmlFor).toBe(r.id);
    });
    return radios.length;
  };
  mount(<ReportForm data={data([pr()])} projectId={5} onCancel={() => undefined} />);
  expect(check()).toBeGreaterThanOrEqual(9);   // три оценки по 3 + тип
  ReactDOM.unmountComponentAtNode(root);
  mount(<RiskForm data={data([pr()])} projectId={5} riskId={0} onCancel={() => undefined} />);
  expect(check()).toBeGreaterThanOrEqual(2 + 5 + 5 + 4);   // тип, вероятность, влияние, стратегия
  // стили приложения (= прототипа): выбранный — рамка и ✓, наведение — только у невыбранных и доступных, недоступно — бледно
  const css = read('../src/webparts/pmoPortal/theme/prototype.scss');
  expect(css).toMatch(/\.ragpick input:checked \+ label\{/);
  expect(css).toMatch(/\.ragpick input:checked \+ label::before\{content:'✓'/);
  expect(css).toMatch(/\.ragpick input:disabled \+ label\{/);
  // шкала вероятности / влияния — свои три состояния
  expect(css).toMatch(/\.opts\.scale input:checked \+ label\{/);
  expect(css).toMatch(/\.opts\.scale input:not\(:checked\):not\(:disabled\) \+ label:hover\{/);
  expect(css).toMatch(/\.opts\.scale input:disabled \+ label\{/);
});

test('#66 «Довідка»: когда позначати «Потрібне рішення керівництва» — на трёх языках', () => {
  const g = (l: string): string => read(`../../docs/USER-GUIDE.${l}.md`);
  expect(g('uk')).toMatch(/\*\*Потрібне рішення керівництва\*\* — позначайте, якщо[^\n]*поза повноваженнями PM[^\n]*Звичайне погодження статус-звіту PMO цієї позначки не потребує/);
  expect(g('en')).toMatch(/\*\*Management decision needed\*\* — tick it if[^\n]*beyond the PM's authority[^\n]*does not need this tick/);
  expect(g('ru')).toMatch(/\*\*Требуется решение руководства\*\* — отмечайте, если[^\n]*вне полномочий PM[^\n]*этой отметки не требует/);
});

describe('#68 «Яке рішення потрібне»: звёздочка и проверка у поля', () => {
  test('галочка — поле со звёздочкой; пусто или пробелы после выхода из поля — сообщение у поля; галочку сняли — поля нет', () => {
    mount(<ReportForm data={data([pr()])} projectId={5} onCancel={() => undefined} />);
    expect(root.querySelector('#f-dect')).toBeNull();
    const dec = (): HTMLInputElement => Array.from(root.querySelectorAll('label.check')).filter(l => (l.textContent || '').indexOf(tt.fl('rDec')) >= 0)[0].querySelector('input') as HTMLInputElement;
    act(() => { Simulate.change(dec(), { target: { checked: true } } as any); });
    expect($('label[for="f-dect"]').textContent).toMatch(/\*/);
    for (const v of ['', '   ', '\n\t ']) {
      act(() => { Simulate.change($('#f-dect'), { target: { value: v } } as any); });
      act(() => { Simulate.blur($('#f-dect')); });
      expect(root.textContent).toContain(T.errDecision[0]);
      expect($('#f-dect').getAttribute('aria-invalid')).toBe('true');
    }
    act(() => { Simulate.change($('#f-dect'), { target: { value: 'Погодити бюджет' } } as any); });
    expect(root.textContent).not.toContain(T.errDecision[0]);
    act(() => { Simulate.change(dec(), { target: { checked: false } } as any); });
    expect(root.querySelector('#f-dect')).toBeNull();
  });
});

test('#69 период не выбирается: в форме нет выбора периода, показано «з … по …» от последнего погодженого', () => {
  const reps = [{ id: 1, projectId: 5, date: '2026-09-20', approval: 'Погоджено', applied: true }, { id: 2, projectId: 5, date: '2026-09-28', approval: 'Повернуто' }];
  mount(<ReportForm data={data([pr()], reps)} projectId={5} onCancel={() => undefined} />);
  expect(root.querySelector('#f-per, #f-period, select[name="period"]')).toBeNull();
  Array.from(root.querySelectorAll('select')).forEach(s => expect(s.textContent).not.toMatch(/Квартал|Тиждень|Місяць/));
  expect($('#f-sub').textContent).toContain(`${tt.fl('rPeriod')}: з 20.09.2026 по ${dmy(ctx.today)}`);
});

describe('#76 «Архів»: проекты «Завершено» / «Скасовано», колонка показывает, какой именно', () => {
  test('в архиве только архивные статусы; в колонке «Фаза проєкту» — «Завершено» или «Скасовано», не «Архівний»', () => {
    const ps = [pr({ id: 1, title: 'Активний', status: 'Реалізація' }), pr({ id: 2, title: 'Готовий', status: 'Завершено', archivedAt: '2026-09-01' }),
      pr({ id: 3, title: 'Скасований', status: 'Скасовано', archivedAt: '2026-09-02' }), pr({ id: 4, title: 'Пауза', status: 'Призупинено' })];
    mount(<Archive data={data(ps)} />);
    const rows = Array.from(root.querySelectorAll('tbody tr'));
    expect(rows.map(r => r.textContent).join('|')).not.toMatch(/Активний|Пауза|Архівний/);
    const heads = Array.from(root.querySelectorAll('thead th')).map(h => h.textContent || '');
    const si = heads.findIndex(h => h.indexOf('Фаза проєкту') === 0);
    expect(si).toBeGreaterThanOrEqual(0);
    expect(rows.map(r => (r.children[si].textContent || '').trim()).sort()).toEqual(['Завершено', 'Скасовано']);
  });
});

test('#77 отчёт на основе повернутого: фаза и тип записываются, даже если равны карточке (класс: любые фаза / тип)', () => {
  for (const status of ['Ініціація', 'Планування', 'Реалізація', 'Призупинено']) for (const type of ['Звичайний', 'Стратегічний']) {
    const p = pr({ status, type });
    const ret: any = { id: 7, projectId: 5, date: '2026-09-01', status, type, progress: 40, start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: null,
      schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений', title: 'Т', done: '', next: '', issues: '', decision: false, decisionText: '', keyReason: '' };
    // и из повернутого, и с пустыми полями повернутого (берутся из карточки) — в записи srStatus / srType
    for (const r of [ret, { ...ret, status: '', type: '' }]) {
      const b = reportBody(reportFromReturned(r, p, '2026-10-04'), p);
      expect([b.srStatus, b.srType]).toEqual([status, type]);
    }
    expect(reportBody({ ...reportFromProject(p, '2026-10-04'), title: 'Т' } as any, p)).toMatchObject({ srStatus: status, srType: type });
  }
});

describe('#78 «Статус» проекта — «Фаза проєкту» в форме отчёта, списке и «Довідці»', () => {
  test('форма отчёта и колонка списка проектов', () => {
    mount(<ReportForm data={data([pr()])} projectId={5} onCancel={() => undefined} />);
    expect($('label[for="f-st"]').textContent).toContain('Фаза проєкту');
    const defs = projectDefs({ t: tt.t, fl: tt.fl, today: '2026-10-04', byId: {}, comments: [], open() { /* */ }, openRisk() { /* */ }, openReport() { /* */ } } as any, false);
    expect(defs.cols.status.label).toBe('Фаза проєкту');
  });
  test('«Довідка» (uk): «Фаза проєкту» — этап проекта', () => {
    expect(read('../../docs/USER-GUIDE.uk.md')).toContain('Фаза проєкту');
  });
});

test('#83 форма проекта: под командой — права обновятся в течение ~15 минут (у нового проекта — нет)', () => {
  mount(<ProjectForm data={data([pr()])} project={pr()} onCancel={() => undefined} />);
  expect(root.textContent).toContain(T.accessRecalc[0]);
  ReactDOM.unmountComponentAtNode(root);
  mount(<ProjectForm data={data([pr()])} onCancel={() => undefined} />);
  expect(root.textContent).not.toContain(T.accessRecalc[0]);
});

test('#87 «Довідка»: ризики не погоджуються, PMO бачить високі ризики й проблеми у сповіщеннях, зворотний зв\'язок — коментарем', () => {
  const g = read('../../docs/USER-GUIDE.uk.md');
  expect(g).toMatch(/не погоджуються/);
  expect(g).toMatch(/від 15/);
  expect(g).toMatch(/коментар/);
});
