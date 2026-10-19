import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';
import { GUIDE } from '../src/webparts/pmoPortal/help/guide';
import { RELEASES } from '../src/webparts/pmoPortal/help/releases';
import { OVERVIEW_CSS, OVERVIEW_HTML } from '../src/webparts/pmoPortal/help/overview';
import { groupReleases } from '../src/webparts/pmoPortal/logic/releases';
import { toCsv } from '../src/webparts/pmoPortal/logic/csv';
import PV from '../../tests/cases/parent.json';

// Прототип выровнен с тестовым порталом (17.10.2026): «Довідка», «Що змінилося», «Детальний огляд», «Відгуки»,
// «Оновити дані» и «CSV» над таблицами, сповіщення «Відгук розглянуто» и «Новий випуск порталу» — как в приложении
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
beforeEach(async () => {
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined; } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const qa = (s: string): W[] => Array.from(w.document.querySelectorAll(s));
const submit = (f: W): void => { f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); };
/** Сгенерированный блок прототипа (tools/guide.mjs, tools/overview.mjs) — значения его констант. */
const block = (name: string, vars: string[]): W => {
  const a = HTML.indexOf(`/* <generated:${name}>`), b = HTML.indexOf(`/* </generated:${name}> */`);
  expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a);
  return new Function(HTML.slice(a, b) + `\nreturn {${vars.join(',')}};`)();
};

describe('тексты — те же, что в приложении (один генератор)', () => {
  test('«Довідка» и «Що змінилося»', () => {
    const b = block('help', ['GUIDE', 'RELEASES']);
    expect(b.GUIDE).toEqual(GUIDE); expect(b.RELEASES).toEqual(RELEASES);
  });
  test('«Детальний огляд»', () => {
    const b = block('overview', ['OVERVIEW_CSS', 'OVERVIEW_HTML']);
    expect([b.OVERVIEW_CSS, b.OVERVIEW_HTML]).toEqual([OVERVIEW_CSS, OVERVIEW_HTML]);
  });
  test('группировка выпусков и CSV — те же правила, что logic/releases.ts и logic/csv.ts', () => {
    [0, 1, 2].forEach(l => expect(JSON.parse(JSON.stringify(w.PPM_RULES.groupReleases(RELEASES[l])))).toEqual(groupReleases(RELEASES[l])));
    const head = ['А', 'Б;в'], rows = [['x "1"', 'рядок\nдругий'], ['', '  y  ']];
    expect(w.PPM_RULES.toCsv(head, rows)).toBe(toCsv(head, rows));
  });
});

describe('«Довідка»', () => {
  test('кнопка «?» — версия, инструкция, «Що змінилося», «Детальний огляд», «Відгук»', () => {
    q('#help').click();
    expect(q('#rel-ver').textContent).toContain(T.relVer[0].replace('{v}', RELEASES[0][0].ver));
    expect(q('#panel .help').innerHTML).toBe(GUIDE[0]);
    q('#rel-open').click();
    expect(q('#rel-cur').textContent).toContain(RELEASES[0][0].ver);
    expect(qa('#panel .rel-i').length).toBe(groupReleases(RELEASES[0]).length);
    expect(qa('#panel .rel-i[open]').length).toBe(1);
    q('#panel [data-act="help"]').click(); q('#panel [data-act="overview"]').click();
    expect(qa('#panel .ovw h2').length).toBe((OVERVIEW_HTML.match(/<h2/g) || []).length);
    expect(q('#panel .ovw img').getAttribute('src')).toMatch(/^\.\.\/docs\/overview\/img\//);
  });
  test('другой язык — «Довідка» на нём', () => {
    q('#help').click();
    q('[data-act="lang"][data-i="1"]').click();
    expect(q('#panel .help').innerHTML).toBe(GUIDE[1]);
  });
});

describe('«Відгуки»', () => {
  test('вкладка: таблица отзывов, «Залишити відгук» — без текста ошибка, с текстом — отзыв первым в списке', () => {
    q('[data-act="nav"][data-page="feedback"]').click();
    const n0 = qa('.dt[data-tkey="feedback"] tbody tr').length;
    expect(n0).toBeGreaterThan(0);
    q('[data-act="fbnew"]').click();
    const f = q('#fb-form'); submit(f);
    expect(q('#fb-err').hidden).toBe(false); expect(q('#fb-err').textContent).toBe(T.fbErrText[0]);
    f.querySelector('#fb-t').value = 'Новий відгук'; submit(f);
    const rows = qa('.dt[data-tkey="feedback"] tbody tr');
    expect(rows.length).toBe(n0 + 1);
    expect(rows[0].textContent).toContain('Новий відгук'); expect(rows[0].textContent).toContain('Відгуки');
  });
  test('владелец сайта ставит статус и ответ — автору сповіщення «Відгук розглянуто»; «‹ ›» — соседние отзывы', () => {
    q('[data-act="nav"][data-page="feedback"]').click();
    q('[data-act="fbnew"]').click(); q('#fb-t').value = 'Мій відгук'; submit(q('#fb-form'));
    const id = Number(q('.dt[data-tkey="feedback"] tbody tr [data-act="fbopen"]').dataset.id);
    q(`[data-act="fbopen"][data-id="${id}"]`).click();
    expect(q('#fb-prev').disabled).toBe(true); expect(q('#fb-next').disabled).toBe(false);
    q('#fb-st').value = 'Прийнято'; q('#fb-ans').value = 'Дякуємо'; submit(q('#fb-ans-form'));
    expect(q('#bell .dot-new')).not.toBeNull();
    q('#bell').click();
    expect(qa('#ntf-list .fb-n.new').length).toBe(1);
    const it = q('#ntf-list .fb-n');
    expect(it.textContent).toContain(T.nkFeedback[0]); expect(it.textContent).toContain('Дякуємо');
    it.click();
    expect(q('#panel .fb-text').textContent).toBe('Мій відгук');
  });
  test('не владелец сайта — ответ только для чтения', () => {
    const b = w.document.createElement('button'); b.dataset.act = 'asuser'; b.dataset.n = 'Андрій Мельник'; w.document.body.appendChild(b); b.click(); b.remove();
    q('[data-act="nav"][data-page="feedback"]').click();
    q('[data-act="fbopen"]').click();
    expect(q('#fb-ans-form')).toBeNull();
  });
});

describe('«Оновити дані» и «CSV» над таблицами', () => {
  test.each(['reports', 'risks', 'feedback'])('%s', pg => {
    q(`[data-act="nav"][data-page="${pg}"]`).click();
    expect(q('#dt-refresh')).not.toBeNull();
    const csv = q('.csv-btn');
    expect(csv.disabled).toBe(!q(`.dt[data-tkey="${csv.dataset.key}"] tbody tr`));
    q('#dt-refresh').click();
    expect(q('#toast').textContent).toBe(T.refreshed[0]);
  });
});

describe('телефон (прототип)', () => {
  test('меню аватара: язык и тема (на телефоне их нет в шапке); язык меняется из меню, меню остаётся открытым', () => {
    q('#me').click();
    expect(qa('#pop .me-prefs .seg').length).toBe(2);
    q('#pop .me-prefs [data-act="lang"][data-i="1"]').click();
    expect(q('.page-title').textContent).toBe(T.dash[1]);
    expect(q('#pop').hidden).toBe(false);
    expect(q('#pop .me-prefs [data-act="lang"][data-i="1"]').getAttribute('aria-pressed')).toBe('true');
  });
  test('#99 и #102: карточки строк — отчёт «PM · дата · стан», отзыв с номером и статусом', () => {
    q('[data-act="nav"][data-page="reports"]').click();
    expect(q('#main .mcards .mcard .mc-m').textContent).toMatch(/^\S.* · \d\d\.\d\d\.\d{4} · /);
    q('[data-act="nav"][data-page="feedback"]').click();
    const m = q('#main .mcards .mcard');
    expect(m.textContent).toMatch(/^#\d+/); expect(m.querySelector('.fbst')).not.toBeNull();
  });
});

describe('«Батьківський проєкт» (прототип)', () => {
  const P = PV.projects.map(x => ({ id: x.id, parentId: x.parent }));
  test.each(PV.choices.map(c => [c.name, c]))('варианты — общие векторы: %s', (_, c: W) => expect(w.PPM_RULES.parentChoices(P, c.self).map((x: W) => x.id)).toEqual(c.out));
  test.each(PV.children.map(c => [c.name, c]))('дочерние — общие векторы: %s', (_, c: W) => expect(w.PPM_RULES.childrenOf(P, c.id).map((x: W) => x.id)).toEqual(c.out));
  test('демо: PRJ-007 — родитель PRJ-003 и PRJ-008; в карточке дочернего — ссылка на родителя', () => {
    q('[data-act="nav"][data-page="projects"]').click();
    q('[data-act="openp"][data-id="7"]').click();
    expect(q('#card-parent').textContent).toContain('Дочірні проєкти (2)');
    q('#card-parent [data-act="openp"][data-id="8"]').click();
    expect(q('#card-parent').textContent).toContain('Батьківський проєкт');
    expect(q('#card-parent [data-act="openp"][data-id="7"]')).not.toBeNull();
  });
  test('правка карточки: в списке нет себя и своих дочерних; смена родителя — в «Історії змін» «PRJ-xxx · Назва»', () => {
    q('[data-act="nav"][data-page="projects"]').click();
    q('[data-act="openp"][data-id="7"]').click();
    q('[data-act="editproj"][data-id="7"]').click();
    const sel = q('#p-parent'); const ids = Array.from(sel.options).map((o: W) => o.value);
    expect(ids).not.toContain('7'); expect(ids).not.toContain('3'); expect(ids).not.toContain('8'); expect(ids).toContain('1');
    sel.value = '1';
    const f = q('#pform'); const d = f.querySelector('#p-desc'); if (!d.value.trim()) d.value = 'Мета';
    submit(f);
    expect(q('#card-parent').textContent).toContain('PRJ-001');
    expect(q('#panel').textContent).toContain('PRJ-001 · ');
  });
});
