import ragCases from '../../tests/cases/rag.json';
import dateCases from '../../tests/cases/dates.json';
import { calcRag, Rag } from '../src/webparts/pmoPortal/logic/rag';
import { dateOnly, addDays, daysBetween, todayIso } from '../src/webparts/pmoPortal/logic/dates';

describe('calcRag — те же векторы, что у Invoke-PMOSync.ps1', () => {
  test.each(ragCases)('$s/$b/$r -> $out', c => {
    expect(calcRag(c.s as Rag, c.b as Rag, c.r as Rag)).toBe(c.out);
  });
});

describe('dateOnly', () => {
  test.each(dateCases)('$note', c => { expect(dateOnly(c.in)).toBe(c.out); });
  test('пусто', () => { expect(dateOnly(null)).toBe(''); expect(dateOnly('')).toBe(''); });
});

test('addDays / daysBetween / todayIso', () => {
  expect(addDays('2026-09-24', -14)).toBe('2026-09-10');
  expect(daysBetween('2026-09-10', '2026-09-24')).toBe(14);
  expect(todayIso(new Date(2026, 8, 24, 23, 30))).toBe('2026-09-24');
});
