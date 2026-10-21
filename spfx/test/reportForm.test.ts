import * as fs from 'fs';
import * as path from 'path';
import { reportFromProject, reportErrors, formErrorText, initialReport, switchStatus, switchProject, reportToSave, reportProjectChoice, progressLocked, ReportDraft } from '../src/webparts/pmoPortal/logic/forms';
import { Project } from '../src/webparts/pmoPortal/data/types';

// Общие векторы формы статус-отчёта: те же сценарии прогоняет prototypeForm.test.ts на прототипе
const V = JSON.parse(fs.readFileSync(path.join(__dirname, '../../tests/cases/report-form.json'), 'utf8'));
const proj = (x: Partial<Project> = {}): Project => ({ id: 1, code: 'PRJ-001', title: 'П', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [], department: '',
  status: 'Реалізація', rag: '', progress: 40, start: '2000-01-01', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0, actualCost: 0,
  lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: '', canEdit: true, pending: false, ...x } as Project);

describe('статус и % (#52)', () => {
  for (const c of V.status) test(c.name, () => {
    let d: ReportDraft = initialReport({ ...reportFromProject(proj(), '2026-10-04'), status: c.start.status, progress: c.start.progress });
    let prev: number | null = null;
    for (const st of c.steps) { const r = switchStatus(d, prev, st); d = r.d; prev = r.prev; }
    expect(d.progress).toBe(c.out.progress);
    expect(progressLocked(d.status)).toBe(c.out.locked);
    expect(reportToSave(d).progress).toBe(c.out.locked ? 100 : c.out.progress);
  });
});
describe('проверка формы (#40, #53, #54)', () => {
  for (const c of V.validation) test(c.name, () => {
    const p = proj();
    const d = { ...reportFromProject(p, '2026-10-04'), ...c.draft };
    const e = reportErrors(d, p, c.progressText);
    expect(e.map(x => x.f).sort()).toEqual([...c.out].sort());
    expect(formErrorText(e)).toBe(c.message);
    // #67: в сообщении — дата, с которой сравнили
    if (c.messageDate) expect((e.filter(x => x.k === c.message)[0] || {} as any).a).toBe(c.messageDate);
  });
});
test('#37 из карточки — проект зафиксирован; #51 по умолчанию — без отчёта на погодженні, такие недоступны', () => {
  const a = proj({ id: 1, pendingDate: '2026-10-02' }), b = proj({ id: 2 }), c = proj({ id: 3, pendingDate: '2026-10-01' });
  expect(reportProjectChoice([a, b, c], 1)).toEqual({ fixed: a, first: a, disabled: [3] });
  expect(reportProjectChoice([a, b, c], 0)).toEqual({ fixed: undefined, first: b, disabled: [1, 3] });
  expect(reportProjectChoice([a, c], 0).first).toBe(a);   // все на погодженні — первый, сохранение заблокирует плашка
});
describe('смена проекта', () => {
  for (const c of V.projectSwitch) test(c.name, () => {
    let d: ReportDraft = initialReport(reportFromProject(proj({ id: 1, progress: 40 }), '2026-10-04'));
    d = switchStatus(d, null, c.status).d;
    const np = proj({ id: 2, progress: 70, status: 'Планування' });
    const nd = switchProject({ ...d, title: 'Резюме', schedule: 'Зелений' }, np);
    expect(progressLocked(nd.status)).toBe(c.out.locked);
    expect(nd.progress).toBe(70); expect(nd.status).toBe('Планування');
    expect(nd.title).toBe('Резюме'); expect(nd.schedule).toBe('Зелений');   // введённое не теряется
  });
});

// 1.7.7: бюджет и прогноз — с причиной; «Завершено» / «Скасовано» — прогноз = витрати; «Планувалось» — план прошлого погодженого
import { keyChanged, lastPlan, withPlan } from '../src/webparts/pmoPortal/logic/forms';
import { reportBody } from '../src/webparts/pmoPortal/data/write';
import { paceForecast } from '../src/webparts/pmoPortal/logic/status';
describe('1.7.7 бюджет, прогноз витрат, план / факт', () => {
  const p = proj({ budget: 95000, actualCost: 71000, forecastCost: 95000, start: '', goLive: '', planEnd: '', forecastEnd: '' });
  const d0 = reportFromProject(p, '2026-10-20');
  test('из карточки: бюджет и прогноз; без изменений — причина не нужна', () => {
    expect([d0.budgetPlan, d0.forecastCost, d0.notDone]).toEqual([95000, 95000, '']);
    expect(keyChanged(d0, p)).toBe(false);
  });
  test('кросс-ревью: обнуление прогноза — «не задан», причина не нужна (не переносится)', () => {
    expect(keyChanged({ ...d0, forecastCost: 0 }, p)).toBe(false);
  });
  test('изменение бюджета или прогноза — нужна причина; витрати на дату — нет', () => {
    expect(keyChanged({ ...d0, budgetPlan: 120000 }, p)).toBe(true);
    expect(keyChanged({ ...d0, forecastCost: 120000 }, p)).toBe(true);
    expect(keyChanged({ ...d0, actualCost: 80000 }, p)).toBe(false);
  });
  test('запись: только изменённые бюджет и прогноз; «Не зроблено» — только непустое (кросс-ревью: поля до deploy)', () => {
    const b1 = reportBody(d0, p); expect('srBudgetPlan' in b1).toBe(false); expect('srForecastCost' in b1).toBe(false); expect('srNotDone' in b1).toBe(false);
    const b2 = reportBody({ ...d0, budgetPlan: 120000.5, forecastCost: 130000, notDone: 'UAT' }, p);
    expect([b2.srBudgetPlan, b2.srForecastCost, b2.srNotDone]).toEqual([120001, 130000, 'UAT']);
  });
  test('«Завершено» / «Скасовано» — прогноз = витрати на дату', () => {
    expect(reportToSave({ ...d0, status: 'Скасовано', forecastCost: 200000 }).forecastCost).toBe(71000);
    expect(reportToSave({ ...d0, status: 'Реалізація', forecastCost: 200000 }).forecastCost).toBe(200000);
  });
  test('подсказка темпа: витрати ÷ % виконання; 0 % — нет', () => {
    expect(paceForecast(71000, 40)).toBe(177500); expect(paceForecast(71000, 0)).toBeNull(); expect(paceForecast(0, 40)).toBeNull();
  });
  test('«Планувалось» — последний погоджений отчёт проекта; повернутые, чужие и сам возвращённый — нет', () => {
    const r = (x: any): any => ({ id: 1, projectId: 1, date: '2026-10-01', approval: 'Погоджено', next: 'План A', ...x });
    const reps = [r({ id: 1, date: '2026-09-01', next: 'План старий' }), r({ id: 2, date: '2026-10-01', next: ' План A ' }),
      r({ id: 3, date: '2026-10-10', approval: 'Повернуто', next: 'План B' }), r({ id: 4, projectId: 2, date: '2026-10-15', next: 'Чужий' })];
    expect(lastPlan(reps, 1)).toEqual({ text: 'План A', date: '2026-10-01' });
    expect(lastPlan(reps, 1, 2)).toEqual({ text: 'План старий', date: '2026-09-01' });
    expect(lastPlan([r({ next: '' })], 1)).toEqual({ text: '', date: '' });
    expect(withPlan(d0, { text: 'План A', date: '2026-10-01' }).planned).toBe('План A');
  });
});
