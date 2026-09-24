import { reportBody, projectBody, projectEditBody, riskBody, commentBody, spDate } from '../src/webparts/pmoPortal/data/write';
import { reportFromProject, ProjectDraft } from '../src/webparts/pmoPortal/logic/forms';
import { Project } from '../src/webparts/pmoPortal/data/types';
import editCases from '../../tests/cases/card-edit.json';

const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [],
  department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', loop: '', description: '', canEdit: false, pending: false, ...x });
const p = P({ progress: 40, planEnd: '2026-12-01', actualCost: 100 });
const d = { ...reportFromProject(p, '2026-09-26'), schedule: 'Зелений' as const, budget: 'Зелений' as const, resources: 'Жовтий' as const, title: 'Резюме' };
const draft = (x: Partial<ProjectDraft>): ProjectDraft => ({ title: 'Н', code: '', department: 'ІТ', loop: '', type: 'Звичайний', priority: '2 — Середній',
  manager: { id: 5, name: 'M', email: 'm@x.ua' }, owner: null, stakeholders: [], start: '2026-09-26', goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: '', ...x });

test('отчёт: только изменённые ключевые показатели, srApplied=false, даты — полдень UTC', () => {
  const b = reportBody({ ...d, progress: 55, planEnd: '2027-01-15', keyReason: 'Зсув' }, p);
  expect(b).toMatchObject({ srProjectId: 1, srDate: '2026-09-26T12:00:00Z', srPeriod: '2 тижні', srSchedule: 'Зелений', srBudget: 'Зелений',
    srResources: 'Жовтий', srProgress: 55, srPlanEnd: '2027-01-15T12:00:00Z', srKeyReason: 'Зсув', srApplied: false, Title: 'Резюме', srDecision: false });
  expect(b).not.toHaveProperty('srStatus');
  expect(b).not.toHaveProperty('srActualCost');
  expect(b).not.toHaveProperty('srStart');
  expect(reportBody(d, p).srProgress).toBe(40);   // % пишется и без изменения
});
test('новый проект', () => {
  expect(projectBody(draft({ stakeholders: [{ id: 6, name: 'A', email: 'a@x' }, { id: 7, name: 'B', email: 'b@x' }], loop: 'https://loop/x' }), 'PRJ-011'))
    .toMatchObject({ Title: 'Н', pmCode: 'PRJ-011', pmType: 'Звичайний', pmManagerId: 5, pmStakeholdersId: [6, 7], pmStatus: 'Ініціація',
      pmStart: '2026-09-26T12:00:00Z', pmGoLive: null, pmProgress: 0, pmLoop: { Url: 'https://loop/x', Description: 'Loop' } });
});
test('правка карточки: без ключевых показателей, журнал дописывается', () => {
  const e = projectEditBody(draft({ title: 'Б' }), [{ f: 'title', from: 'А', to: 'Б' }], 'pm@x.ua', '', '');
  expect(e).not.toHaveProperty('pmStatus'); expect(e).not.toHaveProperty('pmStart'); expect(e).not.toHaveProperty('pmType');
  const log = JSON.parse(String(e.pmEditLog));
  expect(log.entries).toHaveLength(1);
  expect(log.entries[0]).toMatchObject({ who: 'pm@x.ua', reason: '', diffs: [{ f: 'title', from: 'А', to: 'Б' }] });
  const e2 = projectEditBody(draft({ title: 'В' }), [{ f: 'title', from: 'Б', to: 'В' }], 'pm@x.ua', '', String(e.pmEditLog));
  expect(JSON.parse(String(e2.pmEditLog)).entries).toHaveLength(2);
  expect(projectEditBody(draft({}), [], 'pm@x.ua', '', '')).not.toHaveProperty('pmEditLog');   // нет изменений — журнал не трогаем
});
test('риск и комментарий', () => {
  expect(riskBody({ projectId: 1, title: 'Р', type: 'Ризик', probability: 4, impact: 5, owner: { id: 9, name: 'O', email: 'o@x' }, status: 'Відкрито', due: '', mitigation: '' }))
    .toEqual({ riProjectId: 1, Title: 'Р', riType: 'Ризик', riProbability: 4, riImpact: 5, riOwnerId: 9, riStatus: 'Відкрито', riDue: null, riMitigation: '' });
  expect(commentBody(1, 'Текст')).toEqual({ cmProjectId: 1, cmText: 'Текст' });
  expect(spDate('')).toBeNull(); expect(spDate('2026-03-05')).toBe('2026-03-05T12:00:00Z');
});

test('формат pmEditLog совпадает с тем, что разбирает синхронизация (tests/cases/card-edit.json)', () => {
  const ours = JSON.parse(String(projectEditBody(draft({ title: 'Б' }), [{ f: 'title', from: 'А', to: 'Б' }], 'pm@x.ua', '', '').pmEditLog));
  const theirs = JSON.parse(editCases[0].log);
  expect(Object.keys(ours)).toEqual(Object.keys(theirs));
  expect(Object.keys(ours.entries[0]).sort()).toEqual(Object.keys(theirs.entries[0]).sort());
  expect(Object.keys(ours.entries[0].diffs[0]).sort()).toEqual(Object.keys(theirs.entries[0].diffs[0]).sort());
});
