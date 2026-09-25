import { GUIDE } from '../src/webparts/pmoPortal/help/guide';

// сверка трёх языков инструкции: одинаковые разделы, пункты заданий и строки таблицы прав
const count = (html: string, re: RegExp): number => (html.match(re) || []).length;
test.each([['h3', /<h3>/g], ['li', /<li>/g], ['tr', /<tr>/g], ['ol', /<ol>/g]])('uk / en / ru — одинаковое число %s', (_, re) => {
  const n = GUIDE.map(h => count(h, re as RegExp));
  expect(n[1]).toBe(n[0]); expect(n[2]).toBe(n[0]);
});
test('инструкция не пустая и без сырого Markdown', () => GUIDE.forEach(h => { expect(h.length).toBeGreaterThan(3000); expect(h).not.toMatch(/\*\*|^#|\n- /m); }));
