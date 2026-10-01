import { maskDmy, parseDmy, formatDmy } from '../src/webparts/pmoPortal/logic/dates';

describe('#26: поле даты с подсказкой на языке интерфейса', () => {
  test('маска: точки ставятся сами, лишнее отбрасывается', () => {
    expect(maskDmy('3')).toBe('3'); expect(maskDmy('300')).toBe('30.0'); expect(maskDmy('30092026')).toBe('30.09.2026');
    expect(maskDmy('30.09.2026x9')).toBe('30.09.2026'); expect(maskDmy('')).toBe('');
  });
  test('разбор: верные даты — ISO, пусто — пусто, неверные и неполные — null', () => {
    expect(parseDmy('30.09.2026')).toBe('2026-09-30'); expect(parseDmy('29.02.2028')).toBe('2028-02-29'); expect(parseDmy('')).toBe('');
    expect(parseDmy('29.02.2026')).toBeNull(); expect(parseDmy('31.04.2026')).toBeNull(); expect(parseDmy('00.01.2026')).toBeNull();
    expect(parseDmy('30.13.2026')).toBeNull(); expect(parseDmy('30.09.20')).toBeNull();
  });
  test('показ ISO — дд.мм.рррр', () => {
    expect(formatDmy('2026-09-30')).toBe('30.09.2026'); expect(formatDmy('2026-09-30T12:00:00Z')).toBe('30.09.2026'); expect(formatDmy('')).toBe('');
  });
});
