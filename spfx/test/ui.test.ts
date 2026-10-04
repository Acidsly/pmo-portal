/** @jest-environment jsdom */
import { pickerKey, createWithCode, isUniqueError, nextLock, cellText } from '../src/webparts/pmoPortal/logic/ui';
import { nextCode } from '../src/webparts/pmoPortal/logic/forms';

test('#8: Enter выбирает подсвеченного и не отправляет форму; стрелки в пределах списка; Esc — сброс', () => {
  expect(pickerKey('Enter', 1, 3)).toEqual({ hi: 1, pick: 1, clear: false, prevent: true });
  expect(pickerKey('Enter', 0, 0)).toEqual({ hi: 0, pick: null, clear: false, prevent: true });   // пустой список — ничего, но форма не уходит
  expect(pickerKey('ArrowDown', 2, 3).hi).toBe(2); expect(pickerKey('ArrowDown', 0, 3).hi).toBe(1);
  expect(pickerKey('ArrowUp', 0, 3).hi).toBe(0);
  expect(pickerKey('Escape', 1, 3)).toMatchObject({ clear: true, pick: null });
  expect(pickerKey('a', 1, 3).prevent).toBe(false);
});
test('#10: занятый номер — следующий; другая ошибка — сразу; не больше 6 попыток', async () => {
  const tried: string[] = [];
  const id = await createWithCode(['PRJ-001', 'PRJ-002'], nextCode, async code => { tried.push(code); if (code !== 'PRJ-005') throw new Error('The value must be unique'); return 42; });
  expect(id).toBe(42); expect(tried).toEqual(['PRJ-003', 'PRJ-004', 'PRJ-005']);
  await expect(createWithCode([], nextCode, async () => { throw new Error('Access denied'); })).rejects.toThrow('Access denied');
  let n = 0; await expect(createWithCode([], nextCode, async () => { n++; throw new Error('duplicate'); })).rejects.toThrow('duplicate'); expect(n).toBe(6);
  expect(isUniqueError(new Error('Значення має бути унікальним'))).toBe(true);
});
test('#33: ширины закрепляются один раз на набор колонок; на узком экране — нет; нулевые замеры не закрепляются', () => {
  const a = nextLock(1200, null, 'a,b', 2, [100, 200]);
  expect(a).toEqual({ key: 'a,b', w: [100, 200] });
  expect(nextLock(1200, a, 'a,b', 2, [150, 150])).toBe(a);            // фильтры и вид не меняют закреплённые ширины
  expect(nextLock(1200, a, 'a,b,c', 3, [80, 80, 80])).toEqual({ key: 'a,b,c', w: [80, 80, 80] });
  expect(nextLock(800, a, 'a,b', 2, [100, 200])).toBeNull();          // телефон, планшет — как раньше
  expect(nextLock(1200, null, 'a,b', 2, [0, 200])).toBeNull();        // скрытая вкладка
  expect(nextLock(1200, null, 'a,b', 2, [100])).toBeNull();
});
test('#15: CSV — текст ячейки, у значка без текста — подсказка', () => {
  const td = document.createElement('td'); td.innerHTML = '<span title="Стратегічний">🛡</span>';
  expect(cellText(td)).toBe('🛡');
  const td2 = document.createElement('td'); td2.innerHTML = '<span class="dot" title="Жовтий"></span>';
  expect(cellText(td2)).toBe('Жовтий');
  const td3 = document.createElement('td'); td3.textContent = '  12.10.2026  ';
  expect(cellText(td3)).toBe('12.10.2026');
});
test('компоненты используют вынесенные решения', () => {
  const rd = (f: string): string => require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal', f), 'utf8');
  expect(rd('components/fields.tsx')).toMatch(/pickerKey\(e\.key, hi, found\.length\)/);
  expect(rd('panels/ProjectForm.tsx')).toMatch(/createWithCode\(/);
  expect(rd('components/DataTable.tsx')).toMatch(/nextLock\(window\.innerWidth/);
  expect(rd('components/DataTable.tsx')).toMatch(/tr\.children, cellText/);
});
