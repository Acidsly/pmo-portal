import * as fs from 'fs';
import * as path from 'path';

// Прототип в jsdom: фаза «Підтримка», три вкладки проектов, главная с переключателем, свежесть по дням подачи
// (spec docs/superpowers/specs/2026-11-09-support-status.md; общие векторы tests/cases/fresh.json и kind.json)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
// правила підтримки и свежести прототипа — блок от «const SUPPORT» до «const freshLevel» и isArch, исполняются отдельно (скрипт прототипа — в замыкании)
const ruleSrc = ((): string => { const i = HTML.indexOf('const SUPPORT = '), j = HTML.indexOf('\n', HTML.indexOf('const freshLevel = ', i));
  const k = HTML.indexOf('const isArch = '), e = HTML.indexOf('\n', k); return HTML.slice(i, j) + '\n' + HTML.slice(k, e); })();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R: any = new Function(`const DAY = 864e5;\n${ruleSrc}\nreturn { missedSlots, freshLevel, kindOf, isArch };`)();
const cases = (f: string): any[] => JSON.parse(fs.readFileSync(path.join(__dirname, '../../tests/cases', f), 'utf8')).cases; // eslint-disable-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
beforeEach(async () => {
  try { localStorage.clear(); } catch { /* нет хранилища */ }
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined; } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const main = (): string => q('#main').textContent;
const titles = (): string[] => Array.from(w.document.querySelectorAll('#main .tile-t')).map((x: W) => x.textContent);

describe('прототип: свежесть по дням подачи (tests/cases/fresh.json)', () => {
  for (const c of cases('fresh.json')) it(c.name, () => {
    expect(R.missedSlots(c.last, c.today, c.kind)).toBe(c.missed);
    expect(R.freshLevel(c.last, c.today, c.kind)).toBe(c.level);
  });
});

describe('прототип: категория по фазе (tests/cases/kind.json)', () => {
  for (const c of cases('kind.json')) it(c.status || '(пусто)', () => {
    const p = { status: c.status };
    expect(R.kindOf(p)).toBe(c.kind);
    expect(R.isArch(p)).toBe(c.archived);
  });
});

describe('прототип: вкладки и главная', () => {
  it('три вкладки проектов в шапке: поточні, підтримки, архівні', () => {
    const pages = Array.from(w.document.querySelectorAll('.nav [data-page]')).map((b: W) => b.dataset.page);
    expect(pages.slice(0, 4)).toEqual(['home', 'projects', 'support', 'archive']);
    expect(q('.nav [data-page="support"]').textContent).toContain('Проєкти підтримки');
    expect(q('.nav [data-page="projects"]').textContent).toContain('Поточні проєкти');
    expect(q('.nav [data-page="archive"]').textContent).toContain('Архівні проєкти');
  });
  it('«Поточні проєкти» — без підтримки, «Проєкти підтримки» — только они', () => {
    q('.nav [data-page="projects"]').click();
    expect(titles().length).toBeGreaterThan(0);
    expect(titles().some(x => /Підтримка HR-порталу|Супровід обміну/.test(x))).toBe(false);
    q('.nav [data-page="support"]').click();
    expect(titles().sort()).toEqual(['Підтримка HR-порталу самообслуговування', 'Супровід обміну 1С з банками']);
  });
  it('главная: переключатель меняет набор проектов и показатели', () => {
    const seg = (v: string): W => q(`[data-act="homeseg"][data-v="${v}"]`);
    expect(seg('cur').getAttribute('aria-pressed')).toBe('true');
    expect(main()).toContain('Найбільші зсуви термінів');
    seg('sup').click();
    expect(seg('sup').getAttribute('aria-pressed')).toBe('true');
    const kpi = q('.kpis .kpi');
    expect(kpi.textContent).toContain('На підтримці');
    expect(kpi.querySelector('b').textContent).toBe('2');
    expect(main()).toContain('Період підтримки');
    expect(main()).not.toContain('Найбільші зсуви термінів');
    // «Проблемні проєкти» в режиме підтримки — только проекты підтримки
    expect(main()).toContain('Супровід обміну 1С з банками');
    expect(main()).not.toContain('Впровадження Twenty CRM');
  });
  it('показатель «Звіт вчасно» ведёт во вкладку своего режима', () => {
    q('[data-act="homeseg"][data-v="sup"]').click();
    (Array.from(w.document.querySelectorAll('.kpis .kpi')) as W[]).find(b => /Звіт вчасно/.test(b.textContent)).click();
    expect(q('.nav [data-page="support"]').getAttribute('aria-current')).toBe('page');
  });
  // ревью 09.11: число на плитке главной совпадает со списком, куда она ведёт (режимы раздельные)
  for (const seg of ['cur', 'sup']) it(`плитки главной (${seg}) ведут в список с тем же числом строк`, () => {
    const tiles = (): W[] => Array.from(w.document.querySelectorAll('.kpis .kpi'));
    q(`[data-act="homeseg"][data-v="${seg}"]`).click();
    const n = tiles().length;
    expect(n).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < n; i++) {
      q('.nav [data-page="home"]').click(); q(`[data-act="homeseg"][data-v="${seg}"]`).click();
      const tile = tiles()[i], num = tile.querySelector('b').textContent, label = tile.querySelector('.kl').textContent;
      if (/%|—/.test(num)) continue;   // «Звіт вчасно» — доля, ведёт в «Немає свіжого звіту»
      tile.click();
      const page = q('.nav [aria-current="page"]').dataset.page;
      const rows = page === 'projects' || page === 'support' ? w.document.querySelectorAll('#main .tile').length : w.document.querySelectorAll('#main table tbody tr').length;
      expect(`${label}: ${rows}`).toBe(`${label}: ${num}`);
    }
  });
  it('форма статус-звіту предлагает фазу «Підтримка»', () => {
    q('.nav [data-page="reports"]').click();
    q('[data-act="newrep"]').click();
    const st = q('#f-st');
    expect(Array.from(st.options).map((o: W) => o.value)).toContain('Підтримка');
  });
  it('подсказка свежести у проекта підтримки — правило четверга', () => {
    q('.nav [data-page="support"]').click();
    const tip = (Array.from(w.document.querySelectorAll('#main .tile [title]')) as W[]).map(x => x.getAttribute('title')).join(' ');
    expect(tip).toMatch(/звітують щочетверга/);
  });
});
