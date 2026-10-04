import { toEvents } from '../src/webparts/pmoPortal/logic/changes';
import { ChangeEntry } from '../src/webparts/pmoPortal/data/types';
const who = { id: 1, name: 'PM', email: 'pm@x.ua' };
const E = (x: Partial<ChangeEntry>): ChangeEntry => ({ id: 1, projectId: 1, date: '2026-09-20T10:15:30Z', who, kind: 'Статус-звіт', field: 'pmStatus',
  from: 'Планування', to: 'Реалізація', reason: 'Звіт', ...x });

test('строки одного отчёта — одно событие, поля в ключи прототипа', () => {
  const ev = toEvents([E({ id: 1 }), E({ id: 2, field: 'pmProgress', from: '0%', to: '40%', date: '2026-09-20T10:15:59Z' })]);
  expect(ev).toHaveLength(1);
  expect(ev[0]).toMatchObject({ kind: 'report', reason: 'Звіт', diffs: [{ f: 'status', from: 'Планування', to: 'Реалізація' }, { f: 'progress', from: '0%', to: '40%' }] });
});
test('разные минуты, причины или виды — разные события; новые сверху', () => {
  const ev = toEvents([E({ id: 1, date: '2026-09-01T09:00:00Z', kind: 'Створення', field: 'Title', from: '—', to: 'P', reason: '' }),
                      E({ id: 2 }), E({ id: 3, reason: 'Інший', date: '2026-09-20T10:15:10Z' })]);
  expect(ev.map(e => e.kind)).toEqual(['report', 'report', 'create']);
  expect(ev[2].diffs).toEqual([]);
});

import { editLogEvents } from '../src/webparts/pmoPortal/logic/changes';
test('необработанные правки карточки (pmEditLog) — события «Редагування картки»', () => {
  const log = JSON.stringify({ entries: [{ when: '2026-09-24T20:03:14Z', who: 'j.pochobut@eclectic.group', reason: '', diffs: [{ f: 'prio', from: '2 — Середній', to: '1 — Високий' }] }] });
  const ev = editLogEvents(log, [{ id: 3, name: 'Yurii', email: 'J.Pochobut@eclectic.group' }]);
  expect(ev).toEqual([{ id: -1, date: '2026-09-24T20:03:14Z', who: { id: 3, name: 'Yurii', email: 'J.Pochobut@eclectic.group' }, kind: 'edit', reason: '',
    diffs: [{ f: 'prio', from: '2 — Середній', to: '1 — Високий' }] }]);
  expect(editLogEvents('', [])).toEqual([]);
  expect(editLogEvents('{битый', [])).toEqual([]);
});

// #46 / #48: события отчётов и рисков из журнала — со ссылкой на запись, подписи полей риска
test('«Подання звіту» и «Ризик» — свои виды, ссылка на отчёт / риск (kcItem)', () => {
  const ev = toEvents([
    E({ id: 1, kind: 'Подання звіту', field: 'srApproval', from: 'Повернуто', to: 'На погодженні', reason: 'Новий звіт на основі повернутого від 20.09.2026 · Етап', item: 12 }),
    E({ id: 2, kind: 'Ризик', field: 'riStatus', from: 'Відкрито', to: 'Закрито', reason: 'Закрито: Р', item: 5, date: '2026-09-21T10:00:00Z' }),
    E({ id: 3, kind: 'Ризик', field: 'riScore', from: '12', to: '20', reason: 'Закрито: Р', item: 5, date: '2026-09-21T10:00:20Z' }),
    E({ id: 4, kind: 'Ризик', field: 'riCreated', from: '', to: 'Проблема', reason: 'Додано: Р2', item: 6, date: '2026-09-21T10:00:30Z' })]);
  expect(ev.map(e => [e.kind, e.ref])).toEqual([['risk', { type: 'risk', id: 6 }], ['risk', { type: 'risk', id: 5 }], ['submit', { type: 'report', id: 12 }]]);
  expect(ev[1].diffs.map(d => d.f)).toEqual(['kStatus', 'kScore']);
  expect(ev[0].diffs.map(d => d.f)).toEqual(['kNew']);
  expect(ev[2].diffs).toEqual([{ f: 'apStatus', from: 'Повернуто', to: 'На погодженні' }]);
});
test('разные риски в одну минуту с одной причиной — разные события; без kcItem — без ссылки', () => {
  const ev = toEvents([E({ id: 1, kind: 'Ризик', field: 'riStatus', reason: 'Р', item: 5 }), E({ id: 2, kind: 'Ризик', field: 'riStatus', reason: 'Р', item: 6 }),
    E({ id: 3, kind: 'Статус-звіт', item: undefined })]);
  expect(ev).toHaveLength(3);
  expect(ev.filter(e => e.kind === 'report')[0].ref).toBeUndefined();
});
test('подписи всех полей риска есть в словаре полей (FLD) приложения', () => {
  const { FIELD_KEY } = require('../src/webparts/pmoPortal/logic/changes');
  const { FLD } = require('../src/webparts/pmoPortal/i18n/strings');
  ['riCreated', 'riTitle', 'riType', 'riProbability', 'riImpact', 'riScore', 'riStatus', 'riStrategy', 'riOwner', 'riDue'].forEach(f => {
    expect(FIELD_KEY[f]).toBeDefined(); expect(FLD[FIELD_KEY[f]]).toBeDefined();
  });
});
test('поле kcItem читается из журнала', () => {
  const { mapChange, CHANGE_SELECT } = require('../src/webparts/pmoPortal/data/map');
  expect(CHANGE_SELECT).toContain('kcItem');
  expect(mapChange({ Id: 1, kcProjectId: 2, kcItem: 7 }).item).toBe(7);
  expect(mapChange({ Id: 1, kcProjectId: 2, kcItem: null }).item).toBeUndefined();
});
test('#46: новый отчёт на основе повернутого записывает srBasedOn; обычный — нет', () => {
  const { reportBody } = require('../src/webparts/pmoPortal/data/write');
  const { reportFromProject, reportFromReturned } = require('../src/webparts/pmoPortal/logic/forms');
  const p = { id: 1, status: 'Реалізація', type: 'Звичайний', progress: 40, actualCost: 0, start: '', goLive: '', planEnd: '', forecastEnd: '' };
  const r = { id: 33, projectId: 1, status: '', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: null, title: 'Т', done: '', next: '', issues: '',
    decision: false, decisionText: '', keyReason: '', schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений', period: '' };
  expect(reportBody(reportFromReturned(r, p, '2026-10-04'), p).srBasedOn).toBe(33);
  expect(reportBody(reportFromProject(p, '2026-10-04'), p).srBasedOn).toBeUndefined();
});
