import { groupDigits, parseMoney } from '../src/webparts/pmoPortal/logic/money';

// #41 / #45: суммы с пробелами между разрядами; значение — целое число
test('показ: «1 450 000», целые, без отрицательных', () => {
  expect(groupDigits(1450000)).toBe('1 450 000'); expect(groupDigits(2400000)).toBe('2 400 000');
  expect(groupDigits(950)).toBe('950'); expect(groupDigits(1000)).toBe('1 000'); expect(groupDigits(0)).toBe('0');
  expect(groupDigits(12.5)).toBe('13'); expect(groupDigits(-5)).toBe('0'); expect(groupDigits(NaN)).toBe('0');
});
test('ввод: цифры из текста (пробелы, вставка с разделителями); пусто — 0', () => {
  expect(parseMoney('1 450 000')).toBe(1450000); expect(parseMoney('1 450 000')).toBe(1450000);
  expect(parseMoney('2,400,000 $')).toBe(2400000); expect(parseMoney('')).toBe(0); expect(parseMoney('abc')).toBe(0);
  expect(parseMoney(groupDigits(987654321))).toBe(987654321);
});
test('формы отчёта и проекта используют поле суммы с разрядами', () => {
  const rd = (f: string): string => require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal', f), 'utf8');
  expect(rd('panels/ReportForm.tsx')).toMatch(/<MoneyIn id="f-c"/);
  expect(rd('panels/ProjectForm.tsx')).toMatch(/<MoneyIn id="f-bud"/);
  expect(rd('panels/ReportForm.tsx')).not.toMatch(/type="number" id="f-c"/);
});
test('кросс-ревью: вставка суммы с копейками — округление до целого, а не сумма в 100 раз больше', () => {
  expect(parseMoney('1450.50')).toBe(1451); expect(parseMoney('1 450,00')).toBe(1450); expect(parseMoney('1450,4')).toBe(1450);
  expect(parseMoney('2,400,000')).toBe(2400000); expect(parseMoney('12.5')).toBe(13); expect(parseMoney('0,49')).toBe(0);
  expect(parseMoney('1450,')).toBe(1450);
});
