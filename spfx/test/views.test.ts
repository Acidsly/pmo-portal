import { projectView, reportView, riskView, riskInView, freshBucket, scoreBucket, participants, ofProject } from '../src/webparts/pmoPortal/logic/views';
import { Project, StatusReport, Risk } from '../src/webparts/pmoPortal/data/types';
const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [],
  department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: '', canEdit: false, pending: false, ...x });
const me = 'a@x.ua', today = '2026-09-24';

test('представления проектов', () => {
  expect(projectView('strat', P({ type: 'Стратегічний' }), today, me)).toBe(true);
  expect(projectView('strat', P({ type: 'Стратегічний', status: 'Скасовано' }), today, me)).toBe(false);
  expect(projectView('problem', P({ rag: 'Жовтий' }), today, me)).toBe(true);
  expect(projectView('problem', P({ rag: 'Зелений' }), today, me)).toBe(false);
  expect(projectView('stale', P({ lastUpdate: '' }), today, me)).toBe(true);
  expect(projectView('stale', P({ lastUpdate: '2026-09-20' }), today, me)).toBe(false);
  expect(projectView('mine', P({ stakeholders: [{ id: 1, name: 'A', email: 'A@x.ua' }] }), today, me)).toBe(true);
  expect(projectView('mine', P({}), today, me)).toBe(false);
  expect(projectView('all', P({ status: 'Скасовано' }), today, me)).toBe(true);
});
test('отчёты и риски', () => {
  expect(reportView('decision', { decision: true } as StatusReport)).toBe(true);
  expect(reportView('decision', { decision: false } as StatusReport)).toBe(false);
  expect(riskView('open', { status: 'В роботі' } as Risk)).toBe(true);
  expect(riskView('open', { status: 'Закрито' } as Risk)).toBe(false);
  expect(riskView('all', { status: 'Закрито' } as Risk)).toBe(true);
});
test('корзины и участники', () => {
  // 1.7.12: корзины свежести — по дням подачи категории (векторы правила — tests/cases/fresh.json)
  const cur = (lastUpdate: string): { lastUpdate: string; status: string } => ({ lastUpdate, status: 'Реалізація' });
  expect(freshBucket(cur(''), '2026-11-09')).toBe('3'); expect(freshBucket(cur('2026-11-05'), '2026-11-09')).toBe('0');
  expect(freshBucket(cur('2026-11-05'), '2026-11-10')).toBe('1'); expect(freshBucket(cur('2026-11-05'), '2026-11-13')).toBe('2');
  expect(freshBucket({ lastUpdate: '2026-11-05', status: 'Підтримка' }, '2026-11-12')).toBe('0');   // підтримка — только четверги
  expect(freshBucket({ lastUpdate: '2026-11-05', status: 'Підтримка' }, '2026-11-13')).toBe('1');
  expect(scoreBucket(15)).toBe('0'); expect(scoreBucket(8)).toBe('1'); expect(scoreBucket(7)).toBe('2');
  expect(participants(P({ manager: { id: 1, name: 'M', email: 'M@x.ua' }, owner: null }))).toEqual(['m@x.ua']);
  expect(ofProject([{ projectId: 1, n: 'a' }, { projectId: 2, n: 'b' }], 2).map(x => x.n)).toEqual(['b']);
});

test('#32: риски архивных проектов — только в своём представлении', () => {
  const k = { status: 'Відкрито', probability: 5, impact: 5 } as Risk;
  expect(riskInView('archived', k, true)).toBe(true); expect(riskInView('archived', k, false)).toBe(false);
  expect(riskInView('open', k, true)).toBe(false); expect(riskInView('high', k, false)).toBe(true);
});

// #36: «Мої проєкти (усі)» — любая роль; «Я PM» — только PM
test('#36: «Я PM» — только проекты, где я PM; «Мої проєкти (усі)» — и владелец, и команда', () => {
  const pm = { id: 1, name: 'A', email: 'A@x.ua' }, other = { id: 2, name: 'B', email: 'b@x.ua' };
  expect(projectView('pm', P({ manager: pm }), today, me)).toBe(true);
  expect(projectView('pm', P({ manager: other, owner: pm }), today, me)).toBe(false);
  expect(projectView('mine', P({ manager: other, owner: pm }), today, me)).toBe(true);
  expect(projectView('pm', P({ manager: other, stakeholders: [pm] }), today, me)).toBe(false);
  expect(projectView('pm', P({ manager: null }), today, me)).toBe(false);
});
