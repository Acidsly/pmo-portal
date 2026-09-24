import { Project, StatusReport } from '../src/webparts/pmoPortal/data/types';
import { applyPending } from '../src/webparts/pmoPortal/logic/overlay';
import { donutCounts, snapshots } from '../src/webparts/pmoPortal/logic/dynamics';

const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '2 — Середній', manager: null, owner: null,
  stakeholders: [], department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '',
  archivedAt: '', budget: 0, actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', loop: '', description: '',
  canEdit: false, pending: false, ...x });
const R = (x: Partial<StatusReport>): StatusReport => ({ id: 1, projectId: 1, date: '2026-09-20', period: '2 тижні', schedule: 'Зелений',
  budget: 'Зелений', resources: 'Зелений', status: '', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '',
  actualCost: null, keyReason: '', title: 'Звіт', done: '', next: '', issues: '', decision: false, decisionText: '', applied: false, author: null, ...x });

describe('applyPending — как шаг 1 Invoke-PMOSync.ps1', () => {
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
  test('«Завершено» -> «Архівний» и дата архивации', () => {
    const p = applyPending(P({}), [R({ status: 'Завершено', date: '2026-09-22' })]);
    expect(p.status).toBe('Архівний'); expect(p.archivedAt).toBe('2026-09-22');
  });
  test('отчёт старше «Останнього апдейту» не меняет стан и дату', () => {
    const p = applyPending(P({ lastUpdate: '2026-09-21', rag: 'Зелений', lastReport: 'Новый' }), [R({ date: '2026-09-15', budget: 'Червоний', progress: 10 })]);
    expect(p.rag).toBe('Зелений'); expect(p.lastUpdate).toBe('2026-09-21'); expect(p.lastReport).toBe('Новый'); expect(p.progress).toBe(10);
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
    const ps = [P({ id: 1 }), P({ id: 2, status: 'Архівний', archivedAt: '2026-09-01' })];
    const rs = [R({ projectId: 1, date: '2026-08-01', budget: 'Жовтий' }), R({ id: 2, projectId: 1, date: '2026-09-20', budget: 'Зелений' }),
                R({ id: 3, projectId: 2, date: '2026-08-20', budget: 'Червоний' })];
    const s = snapshots(ps, rs, today);
    expect(s.map(x => x.date)).toEqual(['2026-07-02', '2026-07-16', '2026-07-30', '2026-08-13', '2026-08-27', '2026-09-10', '2026-09-24']);
    expect(s[6]).toEqual({ date: '2026-09-24', g: 1, y: 0, r: 0 });
    expect(s[5]).toEqual({ date: '2026-09-10', g: 0, y: 1, r: 0 });
    expect(s[4]).toEqual({ date: '2026-08-27', g: 0, y: 1, r: 1 });
  });
});
