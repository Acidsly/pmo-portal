import { parseAccess } from '../src/webparts/pmoPortal/logic/access';

const json = JSON.stringify({ v: 1, more: 0, people: [
  { e: 'pm@c', n: 'PM', j: 'Керівник проєкту', l: 'edit', r: 'pm' },
  { e: 'cio@c', n: 'CIO', j: 'CIO', l: 'read', r: 'pmMgr' }] });

test('разбор списка доступа', () => {
  const a = parseAccess(json, false)!;
  expect(a.people.map(x => `${x.e} ${x.l} ${x.r}`)).toEqual(['pm@c edit pm', 'cio@c read pmMgr']);
});
test('архив — всем просмотр, даже если синхронизация ещё не переписала список', () => {
  expect(parseAccess(json, true)!.people.every(x => x.l === 'read')).toBe(true);
});
test('пусто или битый JSON — null', () => {
  expect(parseAccess('', false)).toBeNull();
  expect(parseAccess('{oops', false)).toBeNull();
  expect(parseAccess('{"v":1}', false)).toBeNull();
});
test('«і ще N» и имя по умолчанию — e-mail', () => {
  const a = parseAccess(JSON.stringify({ more: 3, people: [{ e: 'x@c', l: 'read', r: 'stake' }] }), false)!;
  expect(a.more).toBe(3); expect(a.people[0].n).toBe('x@c');
});
