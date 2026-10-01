// Переносит обзорный документ docs/overview/overview.uk.html в приложение («Детальний огляд системи» из «Довідки»).
// Запуск: npm run overview. Результат (help/overview.ts) коммитится; Jest сверяет, что он совпадает с исходником.
// Стили документа ограничиваются контейнером .ovw (печатные правила A4 отбрасываются); картинки берутся с сайта —
// {{BASE}}/img/… заменяет панель на адрес папки SiteAssets/pmo-overview (её заполняет scripts/Deploy-App.ps1).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OVERVIEW_SRC = join(root, 'docs/overview/overview.uk.html');

/** Правило CSS документа -> правило внутри .ovw; null — правило только для печати. */
function scopeRule(sel, body) {
  if (sel.startsWith('@page')) return null;
  const parts = sel.split(',').map(s => s.trim()).map(s => {
    if (s === 'body') return '.ovw';
    if (s === '*') return '.ovw, .ovw *';
    return `.ovw ${s}`;
  });
  // разрывы страниц и высота обложки A4 — только для PDF
  const b = body.replace(/break-(before|after|inside):\s*[a-z-]+;?/g, '').replace(/height:\s*262mm;?/, '').replace(/padding-top:\s*30mm;?/, 'padding-top: 4pt;');
  return b.trim() ? `${parts.join(', ')} { ${b.trim()} }` : null;
}

export function buildOverview(src) {
  const css = /<style>([\s\S]*?)<\/style>/.exec(src)[1];
  const rules = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) { const r = scopeRule(m[1].trim(), m[2]); if (r) rules.push(r); }
  let body = /<body>([\s\S]*?)<\/body>/.exec(src)[1].trim();
  body = body.replace(/src="img\//g, 'loading="lazy" src="{{BASE}}/img/').replace(/\n\s*\n/g, '\n');
  return { css: rules.join('\n'), html: body };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = buildOverview(readFileSync(OVERVIEW_SRC, 'utf8'));
  writeFileSync(join(root, 'spfx/src/webparts/pmoPortal/help/overview.ts'),
    '// Сгенерировано tools/overview.mjs из docs/overview/overview.uk.html — не править вручную.\n' +
    `export const OVERVIEW_CSS: string = ${JSON.stringify(o.css)};\n` +
    `export const OVERVIEW_HTML: string = ${JSON.stringify(o.html)};\n`);
  console.log('help/overview.ts обновлён');
}
