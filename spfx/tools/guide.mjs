// Переносит инструкцию docs/USER-GUIDE.{uk,en,ru}.md в приложение («Довідка»). Запуск: npm run guide. Результат коммитится.
// Поддерживается подмножество Markdown, которым написана инструкция: заголовки, абзацы, списки, таблицы, **жирный**, `код`.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');

export function mdToHtml(md) {
  const out = []; let list = '', para = [], table = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; }
    if (list) { out.push(`</${list}>`); list = ''; }
    if (table.length) {
      const rows = table.filter(r => !/^\|[\s|:-]+\|$/.test(r)).map(r => r.replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim())));
      out.push(`<div class="tablewrap"><table><thead><tr>${rows[0].map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
        rows.slice(1).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody></table></div>');
      table = [];
    }
  };
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if (line.startsWith('|')) { if (para.length || list) flush(); table.push(line); continue; }
    if ((m = /^(#{1,3}) (.+)$/.exec(line))) { flush(); const n = m[1].length; out.push(n === 1 ? '' : `<h${n + 1}>${inline(m[2])}</h${n + 1}>`); continue; }
    if ((m = /^- (.+)$/.exec(line)) || (m = /^\d+\. (.+)$/.exec(line))) {
      const kind = line.startsWith('- ') ? 'ul' : 'ol';
      if (para.length) flush();
      if (list !== kind) { if (list) out.push(`</${list}>`); out.push(`<${kind}>`); list = kind; }
      out.push(`<li>${inline(m[1])}</li>`); continue;
    }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return out.filter(Boolean).join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = ['uk', 'en', 'ru'].map(l => mdToHtml(readFileSync(join(root, 'docs', `USER-GUIDE.${l}.md`), 'utf8')));
  writeFileSync(join(root, 'spfx/src/webparts/pmoPortal/help/guide.ts'),
    '// Сгенерировано tools/guide.mjs из docs/USER-GUIDE.{uk,en,ru}.md — не править вручную.\n' +
    `export const GUIDE: [string, string, string] = ${JSON.stringify(html, null, 1)};\n`);
  console.log('help/guide.ts обновлён');
}
