import { toCsv } from '../src/webparts/pmoPortal/logic/csv';

test('CSV: BOM, «;», кавычки и переводы строк', () => {
  const s = toCsv(['Назва', 'Стан'], [['CRM; етап 2', 'Жовтий'], ['Звіт "А"', 'рядок 1\nрядок 2']]);
  expect(s.startsWith('﻿')).toBe(true);
  expect(s.slice(1).split('\r\n')).toEqual(['Назва;Стан', '"CRM; етап 2";Жовтий', '"Звіт ""А""";"рядок 1\nрядок 2"']);
});
