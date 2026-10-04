import cases from '../../tests/cases/assignments.json';
import { assignmentPlan, applyAssignments } from '../src/webparts/pmoPortal/logic/assign';
import { guard, Fresh } from '../src/webparts/pmoPortal/logic/guard';
import { Project, Assignment } from '../src/webparts/pmoPortal/data/types';

// «Призначення» (#43) — те же векторы, что у Get-AssignmentPlan синхронизации (Test-Scripts, раздел 3f)
const V = cases as any;
describe('смена PM / власника — правило с синхронизацией', () => {
  for (const c of V.cases) test(c.name, () => {
    const r = assignmentPlan(c.a, c.pm, c.owner, c.archived, V.pmo, V.owners);
    expect({ valid: r.valid, reason: r.reason, changes: r.changes.map(x => `${x.f}:${x.from}>${x.to}`) }).toEqual(c.out);
  });
});

const person = (e: string, n = e): any => ({ id: 1, email: e, name: n });
const proj = (x: Partial<Project> = {}): Project => ({ id: 5, code: 'PRJ-005', title: 'П', status: 'Реалізація', manager: person('pm@x', 'Старий PM'), owner: person('o@x', 'Власник'),
  pendingEvents: [], ...x } as Project);
const row = (x: Partial<Assignment> = {}): Assignment => ({ id: 1, projectId: 5, manager: person('new@x', 'Новий PM'), owner: null, note: 'Ротація', applied: false,
  author: person('pmo@x', 'PMO'), created: '2026-10-04T10:00:00Z', ...x });

describe('наложение «Призначення» на карточку (до синхронизации)', () => {
  test('новый PM виден сразу, событие истории «Призначення», признак ожидания', () => {
    const p = applyAssignments(proj(), [row()]);
    expect(p.manager!.email).toBe('new@x');
    expect(p.assignPending).toBe(true);
    expect(p.pendingEvents!.map(e => [e.kind, e.reason, e.diffs.map(d => `${d.f}:${d.from}>${d.to}`).join()])).toEqual([['assign', 'Ротація', 'pm:Старий PM>Новий PM']]);
  });
  test('применённое, чужой проект — не накладывается; без комментария — не меняет, но ожидание видно', () => {
    expect(applyAssignments(proj(), [row({ applied: true }), row({ projectId: 6 })])).toEqual(proj());
    const p = applyAssignments(proj(), [row({ note: ' ' })]);
    expect(p.manager!.email).toBe('pm@x'); expect(p.pendingEvents).toEqual([]); expect(p.assignPending).toBe(true);
  });
  test('архив — не меняется; по порядку записей: второе меняет власника', () => {
    expect(applyAssignments(proj({ status: 'Архівний' }), [row()]).manager!.email).toBe('pm@x');
    const p = applyAssignments(proj(), [row({ id: 2, manager: null, owner: person('o2@x', 'Новий власник') }), row({ id: 1 })]);
    expect([p.manager!.email, p.owner!.email]).toEqual(['new@x', 'o2@x']);
    expect(p.pendingEvents!.map(e => e.diffs[0].f)).toEqual(['pm', 'owner']);
  });
  test('события отчётов (applyPending) сохраняются', () => {
    const ev = { id: -7, date: '2026-10-01', who: null, kind: 'report' as const, reason: 'Р', diffs: [] };
    expect(applyAssignments(proj({ pendingEvents: [ev] }), [row()]).pendingEvents!.map(e => e.kind)).toEqual(['report', 'assign']);
  });
});

test('guard: «Призначення» — одно необработанное на проект, в архиве — нельзя; PM на месте не нужен', () => {
  const f = (x: Partial<Fresh>): Fresh => ({ project: proj(), etag: '', owner: false, pending: [], lastApprovedDate: '', ...x });
  expect(guard('assign', 'pmo@x', f({}))).toEqual({ ok: true });
  expect(guard('assign', 'pmo@x', f({ assigns: 1 }))).toEqual({ ok: false, key: 'gAssignPending' });
  expect(guard('assign', 'pmo@x', f({ project: proj({ status: 'Архівний' }) }))).toEqual({ ok: false, key: 'gArchived' });
});

test('правка карточки PM не пишет PM и власника (#43: только «Призначення»)', () => {
  const { projectEditBody } = require('../src/webparts/pmoPortal/data/write');
  const b = projectEditBody({ title: 'П', code: 'PRJ-005', department: 'ІТ', links: [], type: 'Звичайний', priority: '', manager: person('x@x'), owner: person('y@x'),
    team: [], start: '', goLive: '', planEnd: '', status: '', budget: 0, description: '' }, [], 'pm@x', '', '');
  expect(Object.keys(b)).not.toContain('pmManagerId');
  expect(Object.keys(b)).not.toContain('pmOwnerId');
});
test('загрузка и свежая проверка накладывают «Призначення» после отчётов', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal/data/SpRepo.ts'), 'utf8');
  expect(src).toMatch(/applyPending\(x, byProj\[x\.id\] \|\| \[\], ap \? approvedIds : undefined\)\)\.map\(x => applyAssignments\(x, assigns\)\)/);
  expect(src).toMatch(/const project = applyAssignments\(applyPending\(base, reports, aps \? approvedIds : undefined\), assigns\)/);
});
