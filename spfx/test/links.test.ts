import * as fs from 'fs';
import * as path from 'path';

// #25: внешние ссылки (блок «Посилання», вложения, PDF обзора) — в новой вкладке, SharePoint их не перехватывает
const base = path.join(__dirname, '../src/webparts/pmoPortal');
const files = ['components', 'pages', 'panels'].flatMap(d => fs.readdirSync(path.join(base, d)).filter(f => f.endsWith('.tsx')).map(f => path.join(base, d, f)));
const tags: { f: string; tag: string }[] = [];
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/<a\s[^>]*>/g)) tags.push({ f: path.basename(f), tag: m[0] });

test('ссылки на адреса из данных найдены', () => { expect(tags.filter(x => /href=\{/.test(x.tag)).length).toBeGreaterThanOrEqual(5); });
test('каждая ссылка с адресом из данных — target=_blank, data-interception=off, rel=noopener', () => {
  const bad = tags.filter(x => /href=\{/.test(x.tag) && !(/target="_blank"/.test(x.tag) && /data-interception="off"/.test(x.tag) && /rel="noopener[^"]*"/.test(x.tag)));
  expect(bad.map(x => `${x.f}: ${x.tag.slice(0, 90)}`)).toEqual([]);
});
