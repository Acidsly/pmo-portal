import * as S from '../src/webparts/pmoPortal/logic/status';

test('isArch / isActive', () => {
  expect(S.isArch('Архівний')).toBe(true); expect(S.isArch('Завершено')).toBe(true); expect(S.isArch('Реалізація')).toBe(false);
  expect(S.isActive('Скасовано')).toBe(false); expect(S.isActive('Призупинено')).toBe(true); expect(S.isActive('Архівний')).toBe(false);
});
test('freshness: >14 червоний, >8 жовтий', () => {
  const t = '2026-09-24';
  expect(S.freshness('', t)).toBe('na');
  expect(S.freshness('2026-09-16', t)).toBe('g');   // 8 дней
  expect(S.freshness('2026-09-15', t)).toBe('y');   // 9
  expect(S.freshness('2026-09-10', t)).toBe('y');   // 14
  expect(S.freshness('2026-09-09', t)).toBe('r');   // 15
});
test('сроки, прогноз, бюджет', () => {
  expect(S.isPlanLate('2026-09-23', 'Реалізація', '2026-09-24')).toBe(true);
  expect(S.isPlanLate('2026-09-23', 'Архівний', '2026-09-24')).toBe(false);
  expect(S.forecastDelta('2026-12-18', '2027-01-29')).toBe(42);
  expect(S.forecastDelta('', '2027-01-29')).toBeNull();
  expect(S.budgetUse(2400000, 1450000)).toBe(60); expect(S.budgetUse(0, 5)).toBe(0);
  expect(S.budgetLevel(101)).toBe('over'); expect(S.budgetLevel(91)).toBe('warn'); expect(S.budgetLevel(90)).toBe('');
});
test('риски', () => {
  expect(S.riskScore(5, 4)).toBe(20); expect(S.scoreLevel(15)).toBe('r'); expect(S.scoreLevel(8)).toBe('y'); expect(S.scoreLevel(7)).toBe('g');
});
test('порядок: стратегические, приоритет, название', () => {
  const xs = [
    { type: 'Звичайний', priority: '1 — Високий', title: 'Б' },
    { type: 'Стратегічний', priority: '2 — Середній', title: 'В' },
    { type: 'Стратегічний', priority: '1 — Високий', title: 'Я' },
    { type: 'Стратегічний', priority: '1 — Високий', title: 'А' }
  ];
  expect(xs.slice().sort(S.byOrder).map(x => x.title)).toEqual(['А', 'Я', 'В', 'Б']);
});
