import * as fs from 'fs';
import * as path from 'path';

// #58: на телефоне статус-звіти и ризики — карточками: CSS (из прототипа) скрывает таблицу и показывает карточки до 600 px
const scss = fs.readFileSync(path.join(__dirname, '../src/webparts/pmoPortal/theme/prototype.scss'), 'utf8');
const rd = (f: string): string => fs.readFileSync(path.join(__dirname, '../src/webparts/pmoPortal', f), 'utf8');
test('стили: карточки скрыты на широком экране, на узком — вместо таблицы', () => {
  expect(scss).toMatch(/\.mcards\{display:none\}/);
  expect(scss).toMatch(/@media \(max-width:600px\)\{\.tablewrap\.dt\.has-cards\{display:none\}\.mcards\{display:grid/);
});
test('«Статус-звіти» и «Ризики» передают карточку строки в таблицу', () => {
  expect(rd('pages/Reports.tsx')).toMatch(/card=\{reportCard\(x\)\}/);
  expect(rd('pages/Risks.tsx')).toMatch(/card=\{riskCard\(x\)\}/);
  expect(rd('components/DataTable.tsx')).toMatch(/'tablewrap dt' \+ \(p\.card \? ' has-cards' : ''\)/);
});
