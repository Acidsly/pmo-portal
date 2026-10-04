import * as fs from 'fs';
import * as path from 'path';
import { VALUES } from '../src/webparts/pmoPortal/i18n/values';

// #4, #6, #7, #17 и правило CLAUDE.md «значения выбора одинаковы везде»: каждое значение поля «Вибір» из Deploy-PMO.ps1
// есть в словаре приложения (i18n/values.ts) и прототипа (VAL) — с тремя непустыми переводами
const root = path.join(__dirname, '../..');
const deploy = fs.readFileSync(path.join(root, 'scripts/Deploy-PMO.ps1'), 'utf8');
const proto = fs.readFileSync(path.join(root, 'prototype/pmo-prototype.html'), 'utf8');
const arr = (src: string): string[] => (src.match(/"([^"]*)"/g) || []).map(x => x.slice(1, -1));
const vars: Record<string, string[]> = {};
for (const m of deploy.matchAll(/^\s*\$(\w+)\s*=\s*@\(([^)]*)\)/gm)) vars[m[1]] = arr(m[2]);
const choice = new Set<string>();
for (const m of deploy.matchAll(/\(Choices (?:@\(([^)]*)\)|\$(\w+))/g)) (m[1] !== undefined ? arr(m[1]) : vars[m[2]] || []).forEach(v => choice.add(v));
// словарь прототипа: литерал const VAL = { ... } (так же берёт его tools/extract-prototype.mjs)
const a = proto.indexOf('const VAL = {'); let d = 0, j = proto.indexOf('{', a);
for (let i = j; i < proto.length; i++) { if (proto[i] === '{') d++; else if (proto[i] === '}' && --d === 0) { j = i; break; } }
const VAL = new Function(`return (${proto.slice(proto.indexOf('{', a), j + 1)});`)() as Record<string, string[]>;

test('в Deploy-PMO.ps1 найдены значения выбора', () => { expect(choice.size).toBeGreaterThan(30); });
// виды журнала «Зміни показників» на экран не выводятся: приложение переводит их в события истории (logic/changes.ts, KIND)
const NOT_SHOWN = ['Створення', 'Статус-звіт', 'Редагування картки', 'Погодження звіту'];
const all = Array.from(choice).filter(v => NOT_SHOWN.indexOf(v) < 0).sort();
test('виды журнала, которых нет в словаре, все известны logic/changes.ts', () => {
  const src = fs.readFileSync(path.join(root, 'spfx/src/webparts/pmoPortal/logic/changes.ts'), 'utf8');
  NOT_SHOWN.forEach(k => expect(src).toContain(`'${k}':`));
});
test.each(all)('«%s» — переведено в приложении и в прототипе (uk / en / ru)', v => {
  expect(VALUES[v]).toBeDefined();
  expect(VALUES[v].every(x => !!x && !!x.trim())).toBe(true);
  expect(VAL[v]).toBeDefined();
  expect(VAL[v].every(x => !!x && !!String(x).trim())).toBe(true);
  expect(VAL[v]).toEqual(VALUES[v]);   // одни и те же переводы
});
// списки значений в коде приложения (формы, страницы) — только из значений развёртывания (иначе SharePoint не примет значение)
test('константы значений в формах и страницах приложения — из Deploy-PMO.ps1', () => {
  const dirs = ['panels', 'pages', 'components'].map(d => path.join(root, 'spfx/src/webparts/pmoPortal', d));
  const bad: string[] = [];
  let n = 0;
  for (const d of dirs) for (const f of fs.readdirSync(d).filter(x => /\.tsx?$/.test(x))) {
    const src = fs.readFileSync(path.join(d, f), 'utf8');
    for (const m of src.matchAll(/const ([A-Z_]+) = \[((?:\s*'[^']*',?)+)\s*\]/g)) {
      if (m[1] === 'COLORS') continue;   // цвета аватаров, не значения
      n++;
      (m[2].match(/'([^']*)'/g) || []).map(x => x.slice(1, -1)).forEach(v => { if (!choice.has(v)) bad.push(`${f}:${m[1]}:${v}`); });
    }
  }
  expect(n).toBeGreaterThan(3);
  expect(bad).toEqual([]);
});
