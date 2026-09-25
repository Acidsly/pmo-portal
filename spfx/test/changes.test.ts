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
