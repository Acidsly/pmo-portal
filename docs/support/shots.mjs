// Скриншоты прототипа для документов «Підтримка» (docs/support/*.uk.html): Chrome без окна + DevTools Protocol.
// Запуск: scripts/spfx.sh node ../docs/support/shots.mjs  (Node 22: встроенный WebSocket; нужен Google Chrome).
// Прототип — светлая тема, UA, вход владельцем сайта (видит всё, как PMO). Результат — docs/support/img/*.png.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const proto = pathToFileURL(join(here, '..', '..', 'prototype', 'pmo-prototype.html')).href;
const out = join(here, 'img'); mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9337;
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'pmo-shots-'))}`,
  '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws, seq = 0; const wait = {};
async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch { /* ещё стартует */ }
    await sleep(200);
  }
  throw new Error('Chrome не ответил');
}
const send = (method, params = {}) => new Promise((ok, bad) => { const id = ++seq; wait[id] = { ok, bad }; ws.send(JSON.stringify({ id, method, params })); });
const js = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(expr + ': ' + JSON.stringify(r.exceptionDetails)); return r.result.value; };
async function size(w, h, mobile = false) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile }); }
/** Снимок: full — вся страница; sel — только элемент (панель, блок). */
async function shot(name, { full = false, sel = '' } = {}) {
  await sleep(350);
  let clip;
  if (sel) { const b = await js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return {x:r.x, y:r.y + scrollY, width:r.width, height:r.height}; })()`); clip = { ...b, scale: 1 }; }
  else if (full) { const h = await js('Math.ceil(document.documentElement.scrollHeight)'); const w = await js('innerWidth'); clip = { x: 0, y: 0, width: w, height: h, scale: 1 }; }
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!(full || sel), ...(clip ? { clip } : {}) });
  writeFileSync(join(out, name + '.png'), Buffer.from(r.data, 'base64')); console.log('img/' + name + '.png');
}
const click = sel => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('нет ' + ${JSON.stringify(sel)}); e.click(); return 1; })()`);

try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data);
    // форма с несохранёнными данными спрашивает перед закрытием — соглашаемся (иначе диалог блокирует страницу)
    if (m.method === 'Page.javascriptDialogOpening') { send('Page.handleJavaScriptDialog', { accept: true }); return; }
    if (m.id && wait[m.id]) { (m.error ? wait[m.id].bad : wait[m.id].ok)(m.error || m.result); delete wait[m.id]; } });
  await send('Page.enable'); await send('Runtime.enable');
  await size(1440, 900);
  await send('Page.navigate', { url: proto }); await sleep(1500);
  await click('[data-act="lang"][data-i="0"]'); await click('[data-act="theme"][data-t="light"]');
  await js("try { localStorage.setItem('pmo-projmode', 'tiles'); } catch(e) {} 1");

  // 1–2. Главная: режим «Поточні проєкти» и «Проєкти підтримки»
  await click('[data-act="nav"][data-page="home"]'); await click('[data-act="homeseg"][data-v="cur"]');
  await shot('01-home-current', { full: true });
  await click('[data-act="homeseg"][data-v="sup"]');
  await shot('02-home-support', { full: true });
  await click('[data-act="homeseg"][data-v="cur"]');
  // 3. Шапка: три вкладки
  await shot('03-tabs', { sel: 'header' });
  // 5–6. «Проєкти підтримки» (плитки и список)
  await click('[data-act="nav"][data-page="support"]'); await shot('05-support-tiles');
  await click('[data-act="mode"][data-key="projMode"][data-mode="list"]'); await shot('06-support-list');
  await click('[data-act="mode"][data-key="projMode"][data-mode="tiles"]');
  // 7. Статус-звіт: фаза «Підтримка» и причина
  await click('[data-act="nav"][data-page="projects"]');
  await js(`(() => { const b = Array.from(document.querySelectorAll('#main .tile')).find(x => /Twenty CRM/.test(x.textContent)); b.click(); return 1; })()`);
  await sleep(300);
  await click('#panel [data-act="newrep"]'); await sleep(300);
  await js(`(() => { const s = document.querySelector('#f-st'); s.value = 'Підтримка'; s.dispatchEvent(new Event('change', {bubbles:true})); return 1; })()`);
  await js(`(() => { const r = document.querySelector('#f-kr, [id$="keyReason"], textarea[name="keyReason"]'); if (r) { r.value = 'Систему запущено в експлуатацію, далі — підтримка: помилки та обслуговування'; r.dispatchEvent(new Event('input', {bubbles:true})); document.querySelector('#f-st').closest('div').scrollIntoView({block:'start'}); } else document.querySelector('#f-st').scrollIntoView({block:'center'}); return 1; })()`);
  await shot('07-report-phase');
  await js(`setTimeout(() => { const x = document.querySelector('#panel [data-act="close"]'); if (x) x.click(); }, 0); 1`); await sleep(500);
  await js(`(() => { const x = document.querySelector('#panel [data-act="close"]'); if (x) x.click(); return 1; })()`).catch(() => 0); await sleep(300);
  // 8. «Статус-звіти» — представление «Проєкти підтримки»
  await click('[data-act="nav"][data-page="reports"]');
  await js(`(() => { const s = document.querySelector('select[data-key="rv"]'); s.value = 'support'; s.dispatchEvent(new Event('change', {bubbles:true})); return 1; })()`);
  await shot('08-reports-support');
  // 9. Телефон: шапка и главная підтримки
  await size(390, 844, true); await click('[data-act="nav"][data-page="home"]'); await click('[data-act="homeseg"][data-v="sup"]');
  await shot('09-mobile-home-support');
} finally {
  try { ws && ws.close(); } catch { /* */ }
  proc.kill();
}
