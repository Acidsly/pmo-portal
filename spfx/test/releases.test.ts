import { groupReleases, isTechRelease, dateRange } from '../src/webparts/pmoPortal/logic/releases';
import { RELEASES } from '../src/webparts/pmoPortal/help/releases';

// #95: «Що змінилося» — технические выпуски подряд — один свёрнутый блок
const tech = (ver: string, date: string, l = 0): any => ({ ver, date, html: ['<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>',
  '<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>', '<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>'][l] });
const rel = (ver: string, date: string): any => ({ ver, date, html: '<p><b>Нове</b></p>\n<ul>\n<li>Щось нове.</li>\n</ul>' });

test('технический выпуск — только фраза «Технічне оновлення…» (три языка); с другими пунктами — нет', () => {
  expect([0, 1, 2].map(l => isTechRelease(tech('1', '1', l)))).toEqual([true, true, true]);
  expect(isTechRelease(rel('1', '1'))).toBe(false);
  expect(isTechRelease({ ver: '1', date: '1', html: '<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n<li>Ще пункт.</li>\n</ul>' })).toBe(false);
});
test('подряд идущие технические — один блок с диапазоном версий и дат; содержательные — отдельно; порядок сохраняется', () => {
  const g = groupReleases([tech('1.7.3.2', '14.10.2026'), rel('1.7.3.1', '14.10.2026'), tech('1.7.2.31', '14.10.2026'), tech('1.7.2.13', '13.10.2026'),
    tech('1.7.2.12', '13.10.2026'), rel('1.7.2.11', '13.10.2026')]);
  expect(g.map(x => (x.kind === 'tech' ? `T:${x.vers}:${x.dates}:${x.list.length}` : `R:${x.r.ver}`)))
    .toEqual(['T:1.7.3.2:14.10.2026:1', 'R:1.7.3.1', 'T:1.7.2.12–1.7.2.31:13–14.10.2026:3', 'R:1.7.2.11']);
});
test('диапазон дат: день; месяц; разные месяцы', () => {
  expect(dateRange('14.10.2026', '14.10.2026')).toBe('14.10.2026');
  expect(dateRange('14.10.2026', '13.10.2026')).toBe('13–14.10.2026');
  expect(dateRange('01.10.2026', '30.09.2026')).toBe('30.09.2026–01.10.2026');
});
test('настоящие заметки: технических блоков меньше, чем технических выпусков; ни один выпуск не потерян', () => {
  for (const l of [0, 1, 2]) {
    const g = groupReleases(RELEASES[l]);
    const n = g.reduce((s, x) => s + (x.kind === 'tech' ? x.list.length : 1), 0);
    expect(n).toBe(RELEASES[l].length);
    expect(g.length).toBeLessThan(RELEASES[l].length);
  }
});
