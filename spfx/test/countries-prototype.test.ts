import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Довідник «Країни і CEO» — прототип в jsdom: общие векторы tests/cases/countries.json (как logic/countries.ts) и экран PMO через интерфейс
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
const V = JSON.parse(fs.readFileSync(path.join(__dirname, '../../tests/cases/countries.json'), 'utf8'));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
beforeEach(async () => {
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined; win.confirm = () => true; } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await new Promise(r => setTimeout(r, 0));
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const q = (s: string): W => w.document.querySelector(s);
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
const R = (): W => w.PPM_RULES;

describe('countries.json на прототипі', () => {
  for (const c of V.list) test(`список: ${c.name}`, () => { expect(R().countryList(c.rows).map((x: W) => x.name)).toEqual(c.expect); });
  for (const c of V.labels) test(`переклади: ${c.name}`, () => {
    const all = JSON.parse(JSON.stringify(R().countryLabels(R().countryList(c.rows))));
    expect(c.pick ? { [c.pick]: all[c.pick] } : all).toEqual(c.expect);
  });
  for (const c of V.choices) test(`варіанти: ${c.name}`, () => { expect(Array.from(R().countryChoices(R().countryList(c.rows), c.current))).toEqual(c.expect); });
  for (const c of V.validate) test(`перевірка: ${c.name}`, () => { expect(Array.from(R().validateCountry(c.draft, R().countryList(V.validateRows)))).toEqual(c.expect); });
  for (const c of V.warnings) test(`попередження: ${c.name}`, () => {
    expect(JSON.parse(JSON.stringify(R().countryWarnings({ active: c.active, ceo: c.ceo }, c.projects)))).toEqual(c.expect);
  });
  for (const c of V.stale) test(`свіжість: ${c.name}`, () => { expect(R().countryStale(c.opened, c.fresh)).toBe(c.expect); });
});

function openCountries(): void { q('#me').click(); q('[data-act="countries"]').click(); }

test('PMO / власник: «Країни і CEO» в меню; нова країна — у виборі нового проєкту з перекладом', () => {
  openCountries();
  expect(q('#co-list')).not.toBeNull();
  q('#co-add').click();
  const f = q('#co-form');
  f.querySelector('#co-name').value = 'Молдова'; f.querySelector('#co-en').value = 'Moldova';
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(Array.from(w.document.querySelectorAll('.co-row')).map((r: W) => r.dataset.name)).toContain('Молдова');
  q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="newproj"]').click();
  expect(Array.from(w.document.querySelectorAll('#p-country option')).map((o: W) => o.value)).toContain('Молдова');
  w.document.querySelector('[data-act="lang"][data-i="1"]').click();
  q('[data-act="newproj"]').click();
  expect(q('#p-country option[value="Молдова"]').textContent).toBe('Moldova');
});

test('дубль — помилка; наявна країна — назва заблокована; вимкнена зникає з вибору', () => {
  openCountries(); q('#co-add').click();
  const f = q('#co-form'); f.querySelector('#co-name').value = ' польща ';
  f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  expect(f.querySelector('.err').textContent).toBe(T.errCountryDup[0]);
  q('#co-back').click(); q('.co-row[data-name="Польща"]').click();
  const g = q('#co-form');
  expect(g.querySelector('#co-name').disabled).toBe(true);
  g.querySelector('#co-active').checked = false; ev(g.querySelector('#co-active'), 'change');
  expect(g.querySelector('#co-warnCountryInactive')).not.toBeNull();
  g.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  q('[data-act="nav"][data-page="projects"]').click(); q('[data-act="newproj"]').click();
  expect(Array.from(w.document.querySelectorAll('#p-country option')).map((o: W) => o.value)).not.toContain('Польща');
});
