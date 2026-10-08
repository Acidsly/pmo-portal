import { Project, StatusReport } from '../src/webparts/pmoPortal/data/types';
import { applyPending } from '../src/webparts/pmoPortal/logic/overlay';
import { donutCounts, snapshots } from '../src/webparts/pmoPortal/logic/dynamics';

const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '2 — Середній', manager: { id: 1, name: 'Y', email: 'y@x' }, owner: null,
  stakeholders: [], department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '',
  archivedAt: '', budget: 0, actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: '',
  canEdit: false, pending: false, ...x });
const R = (x: Partial<StatusReport>): StatusReport => ({ id: 1, projectId: 1, date: '2026-09-20', period: '2 тижні', schedule: 'Зелений',
  budget: 'Зелений', resources: 'Зелений', status: '', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '',
  actualCost: null, keyReason: '', title: 'Звіт', done: '', next: '', issues: '', decision: false, decisionText: '', applied: false, author: { id: 1, name: 'Y', email: 'Y@x' },
  approval: 'Погоджено', approvedBy: null, approvedAt: '', approvalNote: '', ...x });

describe('applyPending — как шаг 1 Invoke-PMOSync.ps1', () => {
  test('не погоджений PMO или повернутий отчёт карточку не меняет', () => {
    const base = P({ lastUpdate: '2026-09-01', rag: 'Зелений' });
    expect(applyPending(base, [R({ approval: 'На погодженні', budget: 'Червоний' })])).toBe(base);
    expect(applyPending(base, [R({ approval: 'Повернуто', budget: 'Червоний' })])).toBe(base);
  });
  test('новый отчёт переносит показатели, стан, дату и «Останній апдейт»', () => {
    const p = applyPending(P({ lastUpdate: '2026-09-01', rag: 'Зелений' }),
      [R({ status: 'Призупинено', progress: 40, actualCost: 100, budget: 'Червоний', title: 'Стоп', planEnd: '2026-12-01' })]);
    expect(p).toMatchObject({ status: 'Призупинено', progress: 40, actualCost: 100, rag: 'Червоний', lastUpdate: '2026-09-20',
      lastReport: 'Стоп', planEnd: '2026-12-01', pending: true });
  });
  test('пустые поля отчёта не меняют карточку', () => {
    const p = applyPending(P({ progress: 30, planEnd: '2026-11-01' }), [R({})]);
    expect(p.progress).toBe(30); expect(p.planEnd).toBe('2026-11-01');
  });
  test('«Завершено» -> проект «Завершено» (архив) и дата архивации', () => {
    const p = applyPending(P({}), [R({ status: 'Завершено', date: '2026-09-22' })]);
    expect(p.status).toBe('Завершено'); expect(p.archivedAt).toBe('2026-09-22');
  });
  test('«Скасовано» -> проект «Скасовано» (архив) и дата архивации, как завершённый', () => {
    const p = applyPending(P({}), [R({ status: 'Скасовано', date: '2026-09-23' })]);
    expect(p.status).toBe('Скасовано'); expect(p.archivedAt).toBe('2026-09-23');
  });
  test('отчёт старше последнего применённого показатели не меняет (правило R4, как синхронизация)', () => {
    const p = applyPending(P({ lastUpdate: '2026-09-21', rag: 'Зелений', lastReport: 'Новый' }), [R({ date: '2026-09-15', budget: 'Червоний', progress: 10 })]);
    expect(p.rag).toBe('Зелений'); expect(p.lastUpdate).toBe('2026-09-21'); expect(p.lastReport).toBe('Новый'); expect(p.progress).toBe(0); expect(p.pending).toBeFalsy();
  });
  test('«Погоджено» без решения PMO не накладывается (правило R1)', () => {
    const p0 = P({ progress: 5 });
    expect(applyPending(p0, [R({ id: 9, progress: 80 })], {})).toEqual(p0);
    expect(applyPending(p0, [R({ id: 9, progress: 80 })], { 9: true }).progress).toBe(80);
  });
  test('проект в архиве: следующий погоджений отчёт не накладывается (правило R5)', () => {
    const p = applyPending(P({}), [R({ id: 1, date: '2026-09-20', status: 'Завершено' }), R({ id: 2, date: '2026-09-22', status: 'Реалізація', progress: 50 })]);
    expect(p.status).toBe('Завершено'); expect(p.progress).toBe(0);
  });
  test('применённые и чужие отчёты игнорируются', () => {
    const p0 = P({ progress: 5 });
    expect(applyPending(p0, [R({ applied: true, progress: 90 }), R({ projectId: 2, progress: 70 })])).toEqual(p0);
  });
  test('несколько отчётов — по дате, затем по id', () => {
    const p = applyPending(P({}), [R({ id: 2, date: '2026-09-20', progress: 50 }), R({ id: 1, date: '2026-09-20', progress: 20 }), R({ id: 3, date: '2026-09-10', progress: 10 })]);
    expect(p.progress).toBe(50);
  });
});

describe('кольцо и динамика — как в прототипе', () => {
  test('donutCounts считает только активные', () => {
    const c = donutCounts([P({ rag: 'Зелений' }), P({ rag: 'Червоний' }), P({ rag: '' }), P({ status: 'Архівний', rag: 'Зелений' }), P({ status: 'Скасовано', rag: 'Жовтий' })]);
    expect(c).toEqual({ g: 1, y: 0, r: 1, none: 1, total: 3 });
  });
  test('snapshots: 7 точек через 14 дней, последний отчёт на дату среза, архив — до даты архивации', () => {
    const today = '2026-09-24';
    const ps = [P({ id: 1 }), P({ id: 2, status: 'Завершено', archivedAt: '2026-09-01' })];
    const rs = [R({ projectId: 1, date: '2026-08-01', budget: 'Жовтий' }), R({ id: 2, projectId: 1, date: '2026-09-20', budget: 'Зелений' }),
                R({ id: 3, projectId: 2, date: '2026-08-20', budget: 'Червоний' })];
    const s = snapshots(ps, rs, today);
    expect(s.map(x => x.date)).toEqual(['2026-07-02', '2026-07-16', '2026-07-30', '2026-08-13', '2026-08-27', '2026-09-10', '2026-09-24']);
    expect(s[6]).toEqual({ date: '2026-09-24', g: 1, y: 0, r: 0, na: 0 });
    expect(s[5]).toEqual({ date: '2026-09-10', g: 0, y: 1, r: 0, na: 0 });
    expect(s[4]).toEqual({ date: '2026-08-27', g: 0, y: 1, r: 1, na: 0 });
    // 13.08: у проекта 1 уже есть отчёт, у проекта 2 — ещё нет: серый
    expect(s[3]).toEqual({ date: '2026-08-13', g: 0, y: 1, r: 0, na: 1 });
  });
  test('snapshots: проект без погодженого отчёта — серый; до даты создания — не считается', () => {
    const today = '2026-09-24';
    const ps = [P({ id: 1, created: '2026-06-01T10:00:00Z' }), P({ id: 2, created: '2026-09-20T10:00:00Z' }), P({ id: 3, status: 'Скасовано', created: '2026-06-01T10:00:00Z' })];
    const rs = [R({ projectId: 1, date: '2026-09-01', budget: 'Жовтий' })];
    const s = snapshots(ps, rs, today);
    expect(s[0]).toEqual({ date: '2026-07-02', g: 0, y: 0, r: 0, na: 1 });      // проект 1 есть, отчёта ещё нет; 2 ещё не создан
    expect(s[5]).toEqual({ date: '2026-09-10', g: 0, y: 1, r: 0, na: 0 });
    expect(s[6]).toEqual({ date: '2026-09-24', g: 0, y: 1, r: 0, na: 1 });      // проект 2 создан 20.09, отчёта нет
  });
  test('последний срез «Динаміки» совпадает с кольцом «Портфель за станом»', () => {
    const today = '2026-09-24';
    const ps = [P({ id: 1, rag: 'Жовтий', lastUpdate: '2026-09-01', created: '2026-06-01T10:00:00Z' }), P({ id: 2, rag: 'Зелений', lastUpdate: '2026-09-20', created: '2026-06-01T10:00:00Z' }),
      P({ id: 3, rag: '', created: '2026-09-22T10:00:00Z' }), P({ id: 4, status: 'Завершено', rag: 'Зелений', archivedAt: '2026-08-01', created: '2026-06-01T10:00:00Z' }),
      P({ id: 5, status: 'Скасовано', rag: '', created: '2026-06-01T10:00:00Z' })];
    const rs = [R({ projectId: 1, date: '2026-09-01', budget: 'Жовтий' }), R({ id: 2, projectId: 2, date: '2026-09-20' }), R({ id: 3, projectId: 4, date: '2026-07-20' })];
    const last = snapshots(ps, rs, today)[6]; const d = donutCounts(ps);
    expect({ g: last.g, y: last.y, r: last.r, na: last.na }).toEqual({ g: d.g, y: d.y, r: d.r, na: d.none });
    expect(last.g + last.y + last.r + last.na).toBe(d.total);
  });
  test('проект, ушедший в архив сегодня (завершён или отменён), в сегодняшний срез не входит', () => {
    const today = '2026-09-24';
    const ps = [P({ id: 1, rag: 'Жовтий' }), P({ id: 2, status: 'Скасовано', rag: 'Жовтий', archivedAt: today })];
    const rs = [R({ projectId: 1, date: '2026-09-01', budget: 'Жовтий' }), R({ id: 2, projectId: 2, date: '2026-09-10', budget: 'Жовтий' })];
    const s = snapshots(ps, rs, today);
    expect(s[6]).toEqual({ date: today, g: 0, y: 1, r: 0, na: 0 });
    expect(s[5]).toEqual({ date: '2026-09-10', g: 0, y: 2, r: 0, na: 0 });
  });
});

describe('история из неперенесённых отчётов — сразу, как запишет синхронизация', () => {
  test('событие «Статус-звіт» с изменёнными показателями и причиной', () => {
    const p = applyPending(P({ status: 'Планування', progress: 10, planEnd: '2027-04-12', rag: 'Зелений', lastUpdate: '2026-09-18' }),
      [R({ id: 7, date: '2026-09-24', progress: 10, planEnd: '2027-05-14', keyReason: 'Постачальник', title: 'Обрано CRM',
        author: { id: 1, name: 'Y', email: 'y@x' } })]);
    expect(p.pendingEvents).toHaveLength(1);
    expect(p.pendingEvents![0]).toMatchObject({ kind: 'report', reason: 'Постачальник · Обрано CRM', who: { name: 'Y' },
      diffs: [{ f: 'plan', from: '12.04.2027', to: '14.05.2027' }] });
  });
  test('без изменений показателей — события нет', () => {
    const p = applyPending(P({ progress: 10, rag: 'Зелений', lastUpdate: '2026-09-18' }), [R({ date: '2026-09-24', progress: 10 })]);
    expect(p.pendingEvents).toEqual([]);
  });
});

test('отчёт не от PM проекта карточку не меняет (как синхронизация)', () => {
  const p = applyPending(P({ progress: 10 }), [R({ progress: 90, author: { id: 2, name: 'Z', email: 'z@x' } })]);
  expect(p.progress).toBe(10); expect(p.pending).toBeFalsy();
});

describe('архив «Завершено» / «Скасовано» в динамике', () => {
  test('отменённый с датой архивации — учитывается до неё, как завершённый; прежнее «Архівний» — так же', () => {
    const today = '2026-10-01';
    const ps = [P({ id: 1, status: 'Скасовано', archivedAt: '2026-09-20', created: '2026-06-01T10:00:00Z' }), P({ id: 2, status: 'Архівний', archivedAt: '2026-09-20', created: '2026-06-01T10:00:00Z' })];
    const s = snapshots(ps, [], today);
    expect(s[5].na).toBe(2);   // 2026-09-17 — ещё не в архиве
    expect(s[6].na).toBe(0);   // 2026-10-01 — уже в архиве
  });
});

