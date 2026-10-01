import { guard, Fresh, cardFields, changedFields } from '../src/webparts/pmoPortal/logic/guard';
import { Project } from '../src/webparts/pmoPortal/data/types';

const P = (x: Partial<Project>): Project => ({ id: 1, code: 'PRJ-001', title: 'P', type: 'Звичайний', priority: '', manager: { id: 1, name: 'Дарина', email: 'pm@x' }, owner: null, stakeholders: [],
  department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: '', canEdit: true, pending: false, access: '{}', ...x });
const F = (x: Partial<Fresh> = {}, p: Partial<Project> = {}): Fresh => ({ project: P(p), etag: '"1"', owner: false, pending: [], lastApprovedDate: '', ...x });

describe('guard: устаревшая страница не может записать неактуальное', () => {
  test('PM на месте — можно всё', () => {
    for (const a of ['editCard', 'report', 'risk', 'team', 'comment'] as const) expect(guard(a, 'PM@x', F())).toEqual({ ok: true });
  });
  test('S1: PM сменили, у старого PM ещё есть права SharePoint — нельзя (до синхронизации)', () => {
    const g = guard('editCard', 'old@x', F({}, { canEdit: true }));
    expect(g).toEqual({ ok: false, key: 'gPmChanged', args: { pm: 'Дарина' } });
    expect(guard('risk', 'old@x', F()).ok).toBe(false); expect(guard('report', 'old@x', F()).ok).toBe(false); expect(guard('team', 'old@x', F()).ok).toBe(false);
  });
  test('S3: новый PM, права ещё не выданы — понятное сообщение', () => {
    expect(guard('report', 'pm@x', F({}, { canEdit: false }))).toEqual({ ok: false, key: 'gPmSoon' });
  });
  test('S5: проект ушёл в архив (по эталону/наложению) — только просмотр, комментарии тоже нельзя', () => {
    for (const a of ['editCard', 'report', 'risk', 'team', 'comment', 'approve', 'return'] as const) expect(guard(a, 'pm@x', F({}, { status: 'Архівний' })).ok).toBe(false);
    expect(guard('comment', 'any@x', F({}, { status: 'Архівний' }))).toEqual({ ok: false, key: 'gArchived' });
  });
  test('S4: по проекту уже есть отчёт на погодженні — второй нельзя', () => {
    expect(guard('report', 'pm@x', F({ pending: [{ id: 5, date: '2026-09-28', author: 'pm@x' }] }))).toEqual({ ok: false, key: 'gPending', args: { date: '28.09.2026' } });
    expect(guard('risk', 'pm@x', F({ pending: [{ id: 5, date: '2026-09-28', author: 'pm@x' }] })).ok).toBe(true);
  });
  test('дата отчёта раньше последнего погодженого — нельзя', () => {
    expect(guard('report', 'pm@x', F({ lastApprovedDate: '2026-09-25' }), { reportDate: '2026-09-20' })).toEqual({ ok: false, key: 'gOldDate', args: { date: '25.09.2026' } });
    expect(guard('report', 'pm@x', F({ lastApprovedDate: '2026-09-25' }), { reportDate: '2026-09-25' }).ok).toBe(true);
  });
  test('S6: отчёт уже вирішено (другой PMO / вкладка) — повторно нельзя', () => {
    expect(guard('approve', 'pmo@x', F({ report: { id: 5, approval: 'Погоджено', author: 'pm@x', decisions: 1 } }))).toEqual({ ok: false, key: 'gDecided', args: { state: 'Погоджено' } });
    expect(guard('return', 'pmo@x', F({ report: { id: 5, approval: '', author: 'pm@x', decisions: 1 } })).ok).toBe(false);
    expect(guard('approve', 'pmo@x', F({ report: { id: 5, approval: 'На погодженні', author: 'pm@x', decisions: 0 } })).ok).toBe(true);
  });
  test('S2: автор отчёта уже не PM — погодити нельзя, вернуть можно', () => {
    const f = F({ report: { id: 5, approval: '', author: 'old@x', decisions: 0 } });
    expect(guard('approve', 'pmo@x', f)).toEqual({ ok: false, key: 'gNotPmAuthor' }); expect(guard('return', 'pmo@x', f).ok).toBe(true);
  });
  test('владелец сайта — правила PM не применяются', () => {
    expect(guard('editCard', 'own@x', F({ owner: true })).ok).toBe(true);
  });
});
test('S7: конфликт правок карточки — изменённые поля', () => {
  const a = cardFields(P({ title: 'А', budget: 100 })), b = cardFields(P({ title: 'Б', budget: 100 }));
  expect(changedFields(a, b)).toEqual(['title']); expect(changedFields(a, a)).toEqual([]);
});
