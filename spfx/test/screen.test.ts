import { screenLabel } from '../src/webparts/pmoPortal/logic/screen';

const t = (k: string): string => ({ navHome: 'Головна', navProjects: 'Проєкти', navRisks: 'Ризики', navArchive: 'Архів', scrCard: 'картка проєкту',
  newReport: 'Новий статус-звіт', secRisks: 'Ризики та проблеми' } as Record<string, string>)[k] || k;
const tv = (v: string): string => v;

test('экран отзыва — понятная подпись', () => {
  expect(screenLabel('#home', t, tv)).toBe('Головна');
  expect(screenLabel('#projects/all', t, tv)).toBe('Проєкти · Усі проєкти');
  expect(screenLabel('#projects/all/12', t, tv)).toBe('Проєкти · Усі проєкти · картка проєкту');
  expect(screenLabel('#projects/all/12/report', t, tv)).toBe('Проєкти · Усі проєкти · картка проєкту · Новий статус-звіт');
  expect(screenLabel('#risks/open/3/risk:7', t, tv)).toBe('Ризики · Відкриті · картка проєкту · Ризики та проблеми');
  expect(screenLabel('#archive', t, tv)).toBe('Архів');
  expect(screenLabel('', t, tv)).toBe('Головна');
});
