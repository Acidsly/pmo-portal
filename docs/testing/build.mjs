// Сборка PDF планов тестирования: docs/testing/*.uk.md -> HTML (печать A4) -> PDF через Chrome без окна.
// Запуск: node docs/testing/build.mjs  (нужен Google Chrome). Исходник — .md, PDF коммитится рядом.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { mdToHtml } from '../../spfx/tools/guide.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const css = `
@page{size:A4;margin:16mm 14mm 16mm 14mm}
*{box-sizing:border-box}
body{font:10.5pt/1.45 "Segoe UI","Helvetica Neue",Arial,sans-serif;color:#1a1e29;margin:0}
h1{font-size:19pt;margin:0 0 4pt;letter-spacing:-.01em}
.meta{color:#586176;font-size:9.5pt;margin:0 0 14pt;padding-bottom:10pt;border-bottom:2px solid #3a5bdc}
h3{font-size:12.5pt;margin:16pt 0 6pt;color:#1a1e29;break-after:avoid}
p{margin:0 0 6pt}
ul{margin:0 0 8pt;padding-left:16pt}
li{margin:2pt 0}
code{font-family:Menlo,Consolas,monospace;font-size:9pt;background:#eef1f8;padding:0 3pt;border-radius:3pt}
b{font-weight:600}
table{width:100%;border-collapse:collapse;margin:4pt 0 8pt;font-size:9.5pt;page-break-inside:auto}
tr{break-inside:avoid}
th{background:#eef1f8;color:#40485a;font-weight:600;text-align:left;padding:5pt 6pt;border:1px solid #d5dbe8}
td{padding:5pt 6pt;border:1px solid #d5dbe8;vertical-align:top}
td:first-child,th:first-child{width:7%;white-space:nowrap;color:#586176}
td:nth-child(2){width:48%}
td:nth-child(3){width:45%}
.tablewrap{overflow:visible}
`;
for (const f of readdirSync(here).filter(x => /^test-plan-.*\.uk\.md$/.test(x))) {
  const md = readFileSync(join(here, f), 'utf8');
  const [first, ...rest] = md.split('\n');
  const title = first.replace(/^# /, '');
  const body = rest.join('\n').replace(/^\n*(Портал:[^\n]*)\n/, (_, m) => `@@META@@${m}\n`);
  const meta = (body.match(/@@META@@([^\n]*)/) || [, ''])[1];
  const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>
<h1>${title}</h1><p class="meta">${mdToHtml(meta).replace(/^<p>|<\/p>$/g, '')}</p>
${mdToHtml(body.replace(/@@META@@[^\n]*\n/, ''))}
</body></html>`;
  const dir = mkdtempSync(join(tmpdir(), 'pmo-pdf-'));
  const src = join(dir, 'plan.html'); writeFileSync(src, html);
  const out = join(here, f.replace(/\.md$/, '.pdf'));
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${out}`, `file://${src}`], { stdio: 'ignore' });
  console.log('pdf:', out);
}
