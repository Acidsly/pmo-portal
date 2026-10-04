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
