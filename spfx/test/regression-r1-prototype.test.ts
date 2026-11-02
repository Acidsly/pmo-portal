import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';
import { FLD } from '../src/webparts/pmoPortal/i18n/strings';
import { FB_STATUSES } from '../src/webparts/pmoPortal/pages/Feedback';

// Сверка покрытия отзывов раунда 1 (#10, #11, #14, #15, #16, #18, #23, #24, #25, #26, #28) на прототипе в jsdom — через интерфейс.
// Поведение приложения для тех же отзывов — regression-r1.test.tsx.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
let blobs: W[];
beforeEach(async () => {
  blobs = [];
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
      win.confirm = () => true;   // #133 / #134: вопрос «закрыть без сохранения» — да
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined;
    // CSV: содержимое файла перехватывается здесь (в jsdom нет URL.createObjectURL)
    win.URL.createObjectURL = (b: W) => { blobs.push(b); return 'blob:x'; }; win.URL.revokeObjectURL = () => undefined;
    win.HTMLAnchorElement.prototype.click = function (): void { /* без перехода */ };
  } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const qa = (s: string): W[] => Array.from(w.document.querySelectorAll(s));
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
const nav = (page: string): void => q(`[data-act="nav"][data-page="${page}"]`).click();
const viewOf = (): string => (q('select[data-act="view"]') || {}).value;
function asPmo(): void { const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = 'Олександра Мороз'; w.document.body.appendChild(b); b.click(); b.remove(); }
const DEFAULT: Record<string, string> = { projects: 'all', reports: 'all', risks: 'open', archive: 'all' };

describe('#23 / #24: любой показатель главной → вкладка в шапке → вид по умолчанию и без фильтров колонок', () => {
  // все показатели главной (data-act="goview"), а не один «Прострочені»
  const pairs = (): string[][] => {
    nav('home');
    const seen: string[] = [];
    qa('[data-act="goview"]').forEach((b: W) => { const k = b.dataset.page + '/' + b.dataset.view; if (seen.indexOf(k) < 0) seen.push(k); });
    return seen.map(s => s.split('/'));
  };
  test('на главной есть показатели с видом не по умолчанию (в том числе «Зі свіжим звітом» и «Прострочені»)', () => {
    const p = pairs();
    expect(p.filter(([pg, v]) => DEFAULT[pg] && DEFAULT[pg] !== v).length).toBeGreaterThanOrEqual(3);
  });
  test('каждый показатель: открывает свой вид; после «Головна» → вкладка — вид по умолчанию, строк столько же, сколько без показателя', () => {
    const base: Record<string, number> = {};
    Object.keys(DEFAULT).forEach(pg => { nav(pg); base[pg] = qa('main tbody tr').length; });
    const bad: string[] = [];
    for (const [pg, v] of pairs()) {
      if (!DEFAULT[pg]) continue;
      nav('home');
      const b = q(`[data-act="goview"][data-page="${pg}"][data-view="${v}"]`); b.click();
      if (viewOf() !== v) bad.push(`${pg}/${v}: показатель открыл «${viewOf()}»`);
      nav('home'); nav(pg);
      if (viewOf() !== DEFAULT[pg]) bad.push(`${pg}/${v}: вкладка открыла «${viewOf()}»`);
      if (qa('main tbody tr').length !== base[pg]) bad.push(`${pg}/${v}: строк ${qa('main tbody tr').length}, без показателя ${base[pg]}`);
    }
    expect(bad).toEqual([]);
  });
  test('фильтр колонки, поставленный на вкладке, снимается переходом по вкладке в шапке', () => {
    const bad: string[] = [];
    for (const pg of Object.keys(DEFAULT)) {
      nav(pg);
      const lm = q('[data-act="mode"][data-mode="list"]'); if (lm) lm.click();   // плитки — без колонок
      const base = qa('main tbody tr').length;
      const fb = q('main [data-act="tfilter"]'); expect(fb).not.toBeNull(); fb.click();
      const box = q('#pop input[data-pv]'); expect(box).not.toBeNull();
      box.checked = true; ev(box, 'change');
      expect(q('main .fbtn.on')).not.toBeNull();                                // фильтр колонки стоит
      nav('home'); nav(pg);
      if (lm) q('[data-act="mode"][data-mode="list"]').click();
      if (q('main .fbtn.on')) bad.push(pg + ': фильтр колонки остался');
      if (qa('main tbody tr').length !== base) bad.push(`${pg}: строк ${qa('main tbody tr').length}, было ${base}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('#10: номер нового проекта — автоматический и уникальный', () => {
  const create = (title: string): void => {
    asPmo(); nav('projects'); q('[data-act="newproj"]').click();
    const f = q('#pform'); const g = (id: string): W => f.querySelector('#' + id);
    expect(g('p-code').readOnly && g('p-code').disabled).toBe(true);            // номер не вводится руками
    g('p-title').value = title; ev(g('p-title'), 'input');
    const pm = g('p-pm'); if (pm.tagName === 'SELECT') { pm.value = Array.from(pm.options).map((o: W) => o.value).filter(Boolean)[1]; ev(pm, 'change'); }
    if (g('p-country')) { g('p-country').value = 'Польща'; ev(g('p-country'), 'change'); }
    if (g('p-start')) { g('p-start').value = '2026-03-02'; ev(g('p-start'), 'change'); }
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  };
  // номера всех проектов — из списка «Батьківський проєкт» формы (там каждый проект с номером)
  const codes = (): string[] => {
    asPmo(); nav('projects'); q('[data-act="newproj"]').click();
    const o = Array.from(q('#pform #p-parent').options).slice(1).map((x: W) => (/(PRJ-\d+)/.exec(x.textContent) || [''])[0]);
    q('[data-act="nav"][data-page="home"]').click();
    return o;
  };
  test('два новых проекта подряд — номера PRJ-NNN, разные и не совпадают с существующими', () => {
    const before = codes();
    expect(before.length).toBeGreaterThan(5); expect(before.every(Boolean)).toBe(true);
    create('Регрес 1'); create('Регрес 2');
    const after = codes();
    expect(after.length).toBe(before.length + 2);
    expect(new Set(after).size).toBe(after.length);
    // как nextCode портала: следующий после наибольшего номера (не по id записи)
    const n = (c: string): number => Number(c.slice(4)), max = Math.max(...before.map(n));
    expect(after.filter(c => before.indexOf(c) < 0).map(n).sort((a, b) => a - b)).toEqual([max + 1, max + 2]);
  });
});

describe('#11 / #16: подписи на экране', () => {
  test('#16: над каждым списком с выбором вида — «Відображати»', () => {
    for (const pg of ['projects', 'reports', 'risks', 'archive', 'feedback']) {
      nav(pg);
      const l = q('label.viewsel');
      expect(l).not.toBeNull();
      expect(l.textContent.trim().startsWith('Відображати')).toBe(true);
    }
  });
  test('#11: в форме риска дата — «Термін виконання заходів» (uk / en / ru)', () => {
    [0, 1, 2].forEach(i => {
      q(`[data-act="lang"][data-i="${i}"]`).click();
      nav('risks'); q('[data-act="newrisk"]').click();
      const l = q('#k-due').closest('div').querySelector('label');
      expect(l).not.toBeNull();
      expect(l.textContent.replace('*', '').trim()).toBe(((FLD as W).kDue || (T as W).kDue)[i]);
      if (i === 0) expect(l.textContent).toContain('Термін виконання заходів');
    });
  });
});

describe('#14: статусы отзывов — цветные, у каждого свой цвет', () => {
  test('бейдж статуса — класс fbst-<номер статуса>; у классов разные цвета', () => {
    nav('feedback');
    const st: string[] = FB_STATUSES;
    const badges = qa('main .fbst');
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((b: W) => { const m = /fbst-(\d+)/.exec(b.className); expect(m).not.toBeNull(); expect(Number(m![1])).toBeGreaterThanOrEqual(0); expect(Number(m![1])).toBeLessThan(st.length); });
    const css = HTML.slice(0, HTML.indexOf('</style>'));
    const colors = st.map((_, i) => { const m = new RegExp(`\\.fbst-${i}\\s*\\{([^}]*)\\}`).exec(css); return m ? m[1].replace(/\s+/g, '') : ''; });
    expect(colors.every(Boolean)).toBe(true);
    expect(new Set(colors).size).toBe(st.length);
  });
});

describe('#15: CSV — таблица как на экране', () => {
  test('заголовок — видимые колонки, строки — видимые строки, текст ячеек; «;» и BOM', async () => {
    nav('projects');
    const listMode = q('[data-act="mode"][data-mode="list"]'); if (listMode) listMode.click();
    const sel = q('select[data-act="view"]'); sel.value = 'strat'; ev(sel, 'change'); expect(viewOf()).toBe('strat');
    const btn = q('.csv-btn'); expect(btn).not.toBeNull();
    const dt = q(`.dt[data-tkey="${btn.dataset.key}"]`);
    const head = Array.from(dt.querySelectorAll('thead th')).map((th: W) => th.textContent.trim());
    const rows = Array.from(dt.querySelectorAll('tbody tr'));
    expect(rows.length).toBeGreaterThan(0);
    btn.click();
    expect(blobs.length).toBe(1);
    const text: string = await new Promise(res => { const r = new w.FileReader(); r.onload = () => res(r.result); r.readAsText(blobs[0]); });
    const lines = text.replace(/^\ufeff/, '').split('\r\n');   // BOM и экранирование — csv.test.ts / prototypeHelp.test.ts
    expect(lines.length).toBe(rows.length + 1);                              // вид «Стратегічні» — только его строки
    expect(lines[0].split(';').length).toBe(head.length);
    const firstTitle = (rows[0] as W).querySelector('[data-act="openp"]').textContent.trim();
    expect(lines[1]).toContain(firstTitle);
  });
});

describe('#18 / #25: карточка — «Посилання» и таблица «Команда проєкту»; внешние ссылки — в новой вкладке', () => {
  const ids = (): string[] => { nav('projects'); return qa('[data-act="openp"]').map((x: W) => x.dataset.id).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i); };
  const open = (id: string): void => { nav('projects'); q(`[data-act="openp"][data-id="${id}"]`).click(); };
  test('у проекта с командой — таблица (учасник, роль, з яких питань); «Посилання» — все ссылки проекта', () => {
    let seen = 0;
    for (const id of ids()) {
      open(id);
      const tb = q('table.team'); if (!tb || !q('.lnk-sec a')) continue;
      seen++;
      expect(Array.from(tb.querySelectorAll('thead th')).map((th: W) => th.textContent.trim())).toEqual(['tmPerson', 'tmRole', 'tmTopics'].map(k => (FLD as W)[k][0]));
      Array.from(tb.querySelectorAll('tbody tr')).forEach((tr: W) => { expect(tr.querySelectorAll('td').length).toBe(3); expect(tr.querySelectorAll('td')[1].textContent.trim()).not.toBe(''); });
      qa('.lnk-sec a').forEach((a: W) => expect(a.getAttribute('href')).toMatch(/^https:\/\//));
    }
    expect(seen).toBeGreaterThan(0);                                         // в демо-данных есть проект с командой и ссылками
  });
  test('#25: все ссылки на внешние адреса на главной, в списках, плитках и карточках — в новой вкладке, rel=noopener', () => {
    const bad: string[] = [];
    const check = (where: string): void => qa('a[href]').forEach((a: W) => {
      const h = a.getAttribute('href');
      if (/^(https?:)?\/\//i.test(h) && !(a.target === '_blank' && /noopener/.test(a.rel || ''))) bad.push(`${where}: ${h}`);
    });
    let n = 0;
    for (const pg of ['home', 'projects', 'archive']) {
      nav(pg); check(pg);
      qa('[data-act="mode"]').forEach((m: W) => { m.click(); check(pg + ':' + m.dataset.mode); });
    }
    for (const id of ids()) { open(id); n += qa('.lnk-sec a').length; check('картка ' + id); }
    expect(n).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});

describe('#26: подсказка в поле даты — на языке интерфейса', () => {
  test.each([[0, 'дд.мм.рррр'], [1, 'dd.mm.yyyy'], [2, 'дд.мм.гггг']])('язык %d → «%s» во всех полях дат формы проекта; точки ставятся сами', (i, ph) => {
    q(`[data-act="lang"][data-i="${i}"]`).click();
    asPmo(); nav('projects'); q('[data-act="newproj"]').click();
    const f = q('#pform');
    const dates = Array.from(f.querySelectorAll('input[type="text"][id$="-t"]')) as W[];
    expect(dates.length).toBeGreaterThanOrEqual(2);
    dates.forEach(d => expect(d.placeholder).toBe(ph));
    const d = dates[0]; d.value = '30092026'; ev(d, 'input');
    expect(d.value).toBe('30.09.2026');
  });
});

describe('#28 / #53: «% виконання» — только цифры, больше 100 не сохраняется', () => {
  const openForm = (): W => { nav('reports'); q('[data-act="newrep"]:not([data-id])').click(); return q('#repform'); };
  test.each([['-5', '5'], ['12.5', '125'], ['1e2', '12'], ['абв', ''], ['1 0 0', '100'], ['50%', '50']])('ввод «%s» → в поле «%s»', (typed, shown) => {
    const pr = openForm().querySelector('#f-pr'); pr.value = typed; ev(pr, 'input');
    expect(pr.value).toBe(shown);
  });
  test.each(['101', '150', '999'])('«%s» — ошибка у поля, отчёт не сохраняется', v => {
    nav('reports'); const before = qa('main tbody tr').length;
    const f = openForm(); const pr = f.querySelector('#f-pr'); pr.value = v; ev(pr, 'input'); ev(pr, 'change');
    f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    expect(pr.getAttribute('aria-invalid')).toBe('true');
    expect(q('#repform')).not.toBeNull();                                     // форма не закрылась
    nav('reports'); expect(qa('main tbody tr').length).toBe(before);
  });
});
