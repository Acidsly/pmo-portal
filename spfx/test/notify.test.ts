import cases from '../../tests/cases/notify.json';
import { notifyKind, notifyFor, notifyList, marksAfterView, marksAfterOpen, mergeMarks, pruneSeen, SEEN_MAX, NotifyItem } from '../src/webparts/pmoPortal/logic/notify';

// Сповіщення: кто что видит — общие векторы (часть 2 — синхронизация для писем)
const V = cases as any;
describe('вид события', () => {
  for (const c of V.kinds) test(c.name, () => { expect(notifyKind({ kind: c.kind, diffs: c.diffs })).toBe(c.out); });
});
describe('кто видит событие', () => {
  for (const c of V.recipients) test(c.name, () => {
    expect(notifyFor(c.kind, c.author, c.diffs, c.project, { me: c.me, isPmo: c.isPmo, risk: c.risk })).toBe(c.out);
  });
});

const it = (source: 'journal' | 'comment', id: number, date: string): Omit<NotifyItem, 'unread'> =>
  ({ key: source + id, source, id, projectId: 1, kind: source === 'journal' ? 'applied' : 'comment', date, who: null });
test('новое — номер больше метки; журнал и комментарии — свои метки; новые сверху', () => {
  const l = notifyList([it('journal', 10, '2026-10-01T10:00:00Z'), it('journal', 12, '2026-10-03T10:00:00Z'), it('comment', 5, '2026-10-02T10:00:00Z')], { readId: 10, readCmId: 5 });
  expect(l.map(x => [x.key, x.unread])).toEqual([['journal12', true], ['comment5', false], ['journal10', false]]);
});
test('строки «Прочитане» ещё нет — ничего не новое', () => {
  expect(notifyList([it('journal', 10, '2026-10-01T10:00:00Z')], null)[0].unread).toBe(false);
});
test('после просмотра метки только растут', () => {
  const l = notifyList([it('journal', 12, '2026-10-03T10:00:00Z'), it('comment', 3, '2026-10-02T10:00:00Z')], { readId: 10, readCmId: 7 });
  expect(marksAfterView(l, { readId: 10, readCmId: 7 })).toEqual({ readId: 12, readCmId: 7, seen: [] });
});
test('событие, дописанное после прочтения (номер события — наибольший номер строк), снова новое целиком', () => {
  // прочитали при номере 11; синхронизация дописала строку 13 того же события — номер события 13
  expect(notifyList([it('journal', 13, '2026-10-03T10:00:00Z')], { readId: 11, readCmId: 0 })[0].unread).toBe(true);
});

import { notifyItems } from '../src/webparts/pmoPortal/logic/notify';
describe('строки колокольчика из данных приложения', () => {
  const person = (e: string): any => ({ id: 1, email: e, name: e });
  const proj = (id: number, x: any = {}): any => ({ id, code: 'PRJ-00' + id, title: 'П' + id, status: 'Реалізація', manager: person('pm@x'), owner: person('own@x'), team: [], stakeholders: [], ...x });
  const row = (id: number, x: any = {}): any => ({ id, projectId: 1, date: '2026-10-07T10:00:00Z', who: person('au@x'), kind: 'Статус-звіт', field: 'pmStatus', from: 'А', to: 'Б', reason: 'R', ...x });
  const d = (x: any = {}): any => ({ projects: [proj(1)], risks: [], comments: [], recent: [], ...x });
  test('строки одного действия — одно событие, номер — наибольший', () => {
    const it = notifyItems(d({ recent: [row(10), row(12, { field: 'pmProgress', date: '2026-10-07T10:00:20Z' })] }), 'pm@x', false, '2026-10-01');
    expect(it.map(x => [x.source, x.id, x.kind])).toEqual([['journal', 12, 'applied']]);
  });
  test('проект, которого я не вижу (нет в данных), — не показывается', () => {
    expect(notifyItems(d({ recent: [row(10, { projectId: 9 })] }), 'pm@x', false, '2026-10-01')).toEqual([]);
  });
  test('риск: оценка — текущая из записи риска', () => {
    const risks = [{ id: 5, projectId: 1, probability: 4, impact: 4, owner: person('pm@x') }];
    const r = row(20, { kind: 'Ризик', field: 'riStatus', item: 5 });
    expect(notifyItems(d({ recent: [r], risks, projects: [proj(1, { team: [{ user: person('tm@x') }] })] }), 'tm@x', false, '2026-10-01').length).toBe(1);
    expect(notifyItems(d({ recent: [r], risks: [{ ...risks[0], impact: 2 }], projects: [proj(1, { team: [{ user: person('tm@x') }] })] }), 'tm@x', false, '2026-10-01').length).toBe(0);
  });
  test('комментарии — за окно, своё — нет', () => {
    const comments = [{ id: 3, projectId: 1, text: 'Т', author: person('au@x'), created: '2026-10-07T09:00:00Z' }, { id: 4, projectId: 1, text: 'старий', author: person('au@x'), created: '2026-09-01T09:00:00Z' },
      { id: 5, projectId: 1, text: 'мій', author: person('pm@x'), created: '2026-10-07T09:00:00Z' }];
    expect(notifyItems(d({ comments }), 'pm@x', false, '2026-09-24').map(x => x.key)).toEqual(['c3']);
  });
  test('PMO по чужому проекту — только подача отчёта', () => {
    const it = notifyItems(d({ recent: [row(10), row(11, { kind: 'Подання звіту', field: 'srApproval', date: '2026-10-07T11:00:00Z' })] }), 'pmo@x', true, '2026-10-01');
    expect(it.map(x => x.kind)).toEqual(['submitted']);
  });
});

describe('открыл событие — прочитано оно (nsReadSet)', () => {
  const it0 = (key: string, id: number, source: 'journal' | 'comment' = 'journal'): any => ({ key, source, id, projectId: 1, kind: 'comment', date: '2026-10-0' + (id % 9), who: null });
  test('открытое поверх метки — не новое, остальные — новые', () => {
    const l = notifyList([it0('j21', 21), it0('j22', 22), it0('c8', 8, 'comment')], { readId: 20, readCmId: 7, seen: ['j22'] });
    expect(l.filter(x => x.unread).map(x => x.key).sort()).toEqual(['c8', 'j21']);
  });
  test('marksAfterOpen: метки не двигаются, ключ добавлен один раз', () => {
    const m = marksAfterOpen({ ...it0('j21', 21), unread: true }, { readId: 20, readCmId: 7, seen: ['j22'] });
    expect(m).toEqual({ readId: 20, readCmId: 7, seen: ['j22', 'j21'] });
    expect(marksAfterOpen({ ...it0('j21', 21), unread: true }, m).seen).toEqual(['j22', 'j21']);
  });
  test('pruneSeen: ниже метки и мусор — убираются; не больше SEEN_MAX новейших', () => {
    expect(pruneSeen(['j5', 'j25', 'c3', 'c9', 'x1', 'j25'], 20, 7)).toEqual(['j25', 'c9']);
    const many = Array.from({ length: SEEN_MAX + 10 }, (_, i) => 'j' + (100 + i));
    const p = pruneSeen(many, 0, 0); expect(p.length).toBe(SEEN_MAX); expect(p[0]).toBe('j' + (100 + SEEN_MAX + 9));
  });
  test('«Позначити все прочитаним» — метки до показанного, открытые ниже метки отпадают', () => {
    const items = notifyList([it0('j21', 21), it0('j30', 30)], { readId: 20, readCmId: 7, seen: ['j21', 'j40'] });
    expect(marksAfterView(items, { readId: 20, readCmId: 7, seen: ['j21', 'j40'] })).toEqual({ readId: 30, readCmId: 7, seen: ['j40'] });
  });
  test('mergeMarks: к свежей версии — максимум меток и объединение открытых', () => {
    expect(mergeMarks({ readId: 25, readCmId: 7, seen: ['j27'] }, { readId: 20, readCmId: 9, seen: ['j26', 'j21'] })).toEqual({ readId: 25, readCmId: 9, seen: ['j27', 'j26'] });
  });
});
