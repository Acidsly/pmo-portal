import * as fs from 'fs';
import * as path from 'path';
import { OVERVIEW_CSS, OVERVIEW_HTML } from '../src/webparts/pmoPortal/help/overview';

// «Детальний огляд системи» в приложении сгенерирован из docs/overview/overview.uk.html (npm run overview) и не устарел
const src = fs.readFileSync(path.join(__dirname, '../../docs/overview/overview.uk.html'), 'utf8');
const count = (s: string, re: RegExp): number => (s.match(re) || []).length;
test('те же разделы и скриншоты, что в обзорном документе', () => {
  expect(count(OVERVIEW_HTML, /<h2/g)).toBe(count(src, /<h2/g));
  expect(count(OVERVIEW_HTML, /<img /g)).toBe(count(src, /<img /g));
  expect(count(OVERVIEW_HTML, /<figcaption>/g)).toBe(count(src, /<figcaption>/g));
});
test('картинки — с сайта, стили — только внутри .ovw, без печатных правил', () => {
  expect(OVERVIEW_HTML).not.toMatch(/src="img\//);
  expect(count(OVERVIEW_HTML, /\{\{BASE\}\}\/img\//g)).toBe(count(src, /src="img\//g));
  OVERVIEW_CSS.split('\n').forEach(r => expect(r).toMatch(/^\.ovw/));
  expect(OVERVIEW_CSS).not.toMatch(/@page|break-before|262mm/);
});
