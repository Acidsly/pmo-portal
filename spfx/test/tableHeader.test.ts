import * as fs from 'fs';
import * as path from 'path';

// Заголовки таблиц (09.11.2026, прод: «Статус-звіти» на экране до 1440 px): воронка фильтра всегда справа от названия,
// во всех колонках одинаково. Раньше в узких колонках (.w-ico: Стан, Терміни, Бюджет, Ресурси, щит, флажок) она переносилась
// под название (flex-wrap) — строка заголовков «скакала». Проверяем CSS прототипа и сгенерированный CSS приложения.
const root = path.join(__dirname, '../..');
const sources: [string, string][] = [
  ['prototype/pmo-prototype.html', fs.readFileSync(path.join(root, 'prototype/pmo-prototype.html'), 'utf8')],
  ['spfx/src/webparts/pmoPortal/theme/prototype.scss', fs.readFileSync(path.join(root, 'spfx/src/webparts/pmoPortal/theme/prototype.scss'), 'utf8')],
];

/** Правила «селекторы { объявления }» без @media-обёрток (вложенные правила тоже попадают). */
const rules = (css: string): { sel: string; body: string }[] =>
  Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g)).map(m => ({ sel: m[1].trim(), body: m[2] }));

describe.each(sources)('%s', (_name, css) => {
  const head = rules(css).filter(r => r.sel.split(',').some(s => /\bth(\.[\w-]+)*\s+\.th\s*$/.test(s.trim())));
  test('правила заголовка колонки найдены', () => { expect(head.length).toBeGreaterThan(3); });
  test('воронка не переносится под название (нет flex-wrap: wrap)', () => {
    expect(head.filter(r => /flex-wrap\s*:\s*wrap/.test(r.body)).map(r => r.sel)).toEqual([]);
  });
});
