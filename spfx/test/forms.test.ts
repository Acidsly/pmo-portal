import { nextCode, reportFromProject, keyChanged, validateReport, validateProject, validateRisk, cardDiff, ReportDraft, ProjectDraft, RiskDraft }
  from '../src/webparts/pmoPortal/logic/forms';
import { Project } from '../src/webparts/pmoPortal/data/types';

const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [],
  department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: '', canEdit: false, pending: false, ...x });
const p = P({ status: 'Реалізація', type: 'Звичайний', progress: 40, planEnd: '2026-12-01', actualCost: 100 });
const draft = (x: Partial<ProjectDraft>): ProjectDraft => ({ title: '', code: '', department: 'ІТ', links: [], type: 'Звичайний', priority: '2 — Середній',
  manager: null, owner: null, team: [], start: '', goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: '', ...x });

test('nextCode: максимальный PRJ + 1, трёхзначный', () => {
  expect(nextCode(['PRJ-001', 'PRJ-012', 'TEST-99', ''])).toBe('PRJ-013');
  expect(nextCode([])).toBe('PRJ-001');
  expect(nextCode(['PRJ-099'])).toBe('PRJ-100');
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
  const ok: ReportDraft = { ...reportFromProject(p, '2026-09-26'), schedule: 'Зелений', budget: 'Зелений', resources: 'Жовтий', title: 'Резюме' };
  expect(validateReport({ ...ok, resources: '' }, p)).toBe('errDims');
  expect(validateReport({ ...ok, title: ' ' }, p)).toBe('errSum');
  expect(validateReport({ ...ok, date: '' }, p)).toBe('errDate');
  expect(validateReport({ ...ok, status: 'Призупинено' }, p)).toBe('errKeyReason');
  expect(validateReport({ ...ok, status: 'Призупинено', keyReason: 'Пауза' }, p)).toBe('');
  expect(validateReport(ok, p)).toBe('');
});
test('проверки проекта и риска', () => {
  expect(validateProject(draft({ title: '' }))).toBe('errTitle');
  expect(validateProject(draft({ title: 'П' }))).toBe('errPM');
  expect(validateProject(draft({ title: 'П', manager: { id: 1, name: 'M', email: 'm@x.ua' } }))).toBe('');
  // код занят другим проектом (регистр и пробелы не важны); пустой код — назначится автоматически
  const m = { id: 1, name: 'M', email: 'm@x.ua' };
  expect(validateProject(draft({ title: 'П', manager: m, code: ' prj-911 ' }), ['PRJ-911'])).toBe('errCode');
  expect(validateProject(draft({ title: 'П', manager: m, code: '' }), ['PRJ-911'])).toBe('');
  expect(validateProject(draft({ title: 'П', manager: m, code: 'PRJ-912' }), ['PRJ-911'])).toBe('');
  const r: RiskDraft = { projectId: 1, title: ' ', type: 'Ризик', probability: 3, impact: 3, owner: null, status: 'Відкрито', due: '', mitigation: '', strategy: '', contingency: '' };
  expect(validateRisk(r)).toBe('errRiskTitle');
  expect(validateRisk({ ...r, title: 'Р' })).toBe('');
});
test('правка карточки: изменения без описания', () => {
  const before = P({ title: 'А', priority: '2 — Середній', department: 'ІТ', description: 'старое' });
  const diff = cardDiff(before, draft({ title: 'Б', priority: '1 — Високий', description: 'новое' }));
  expect(diff).toEqual([{ f: 'title', from: 'А', to: 'Б' }, { f: 'prio', from: '2 — Середній', to: '1 — Високий' }]);
});

describe('#27: уникальное название проекта', () => {
  const D = { title: 'CRM для продажів', code: '', department: 'ІТ', links: [], type: 'Звичайний', priority: '2 — Середній', manager: { id: 1, name: 'M', email: 'm@x' },
    owner: null, team: [], start: '', goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: '' };
  test('такое же название (регистр и пробелы не важны) — ошибка', () => {
    expect(validateProject({ ...D, title: '  crm  для ПРОДАЖІВ ' }, [], ['CRM для продажів'])).toBe('errTitleTaken');
  });
  test('другое название — можно; правка без смены названия существующего дубля — можно', () => {
    expect(validateProject({ ...D, title: 'CRM 2' }, [], ['CRM для продажів'])).toBe('');
    expect(validateProject(D, [], ['CRM для продажів'], 'CRM для продажів')).toBe('');
  });
});

// раунд 3: #40 все ошибки сразу, #52 «Завершено» — 100 %, #53 % 0–100 без молчаливой замены, #54 даты не раньше старта
import { datesBeforeStart, parseProgress, progressLocked, reportErrors, formErrorText } from '../src/webparts/pmoPortal/logic/forms';
test('#54: запуск, план и прогноз не раньше старта; пустые не проверяются', () => {
  expect(datesBeforeStart({ start: '2026-03-02', goLive: '2026-01-01', planEnd: '2026-01-01', forecastEnd: '2022-01-01' })).toEqual(['goLive', 'planEnd', 'forecastEnd']);
  expect(datesBeforeStart({ start: '2026-03-02', goLive: '2026-03-02', planEnd: '', forecastEnd: '2026-12-01' })).toEqual([]);
  expect(datesBeforeStart({ start: '', goLive: '2020-01-01', planEnd: '2020-01-01' })).toEqual([]);
});
test('#53: целое 0–100, ведущие нули допустимы, остальное — ошибка (без замены на 100)', () => {
  expect(parseProgress('00098')).toBe(98); expect(parseProgress('000')).toBe(0); expect(parseProgress('100')).toBe(100);
  expect(parseProgress('500')).toBeNull(); expect(parseProgress('-1')).toBeNull(); expect(parseProgress('12.5')).toBeNull(); expect(parseProgress('')).toBeNull(); expect(parseProgress('абв')).toBeNull();
});
test('#52: «Завершено» закрывает % (100), «Скасовано» — нет', () => { expect(progressLocked('Завершено')).toBe(true); expect(progressLocked('Скасовано')).toBe(false); expect(progressLocked('Реалізація')).toBe(false); });
test('#40: все незаполненные поля сразу и общее сообщение', () => {
  const p = { id: 1, status: 'Реалізація', type: 'Звичайний', start: '2026-03-02', goLive: '', planEnd: '2026-12-01', forecastEnd: '' } as any;
  const d = { ...reportFromProject({ ...p, progress: 40, actualCost: 0 }, '2026-10-04'), status: 'Призупинено', planEnd: '2026-01-01' };
  const e = reportErrors(d, p, '500');
  expect(e.map(x => x.f)).toEqual(['sched', 'budget', 'res', 'keyReason', 'title', 'progress', 'planEnd']);
  expect(formErrorText(e)).toBe('errReqAll');
  const ok = { ...d, schedule: 'Зелений' as const, budget: 'Зелений' as const, resources: 'Зелений' as const, title: 'Т', keyReason: 'Пауза' };
  expect(formErrorText(reportErrors(ok, p, '40'))).toBe('errBeforeStart');
  expect(reportErrors({ ...ok, planEnd: '2026-12-01' }, p, '40')).toEqual([]);
  expect(reportErrors({ ...ok, planEnd: '2026-12-01', status: 'Завершено' }, p, '500')).toEqual([]);   // при «Завершено» поле закрыто (100)
});
