import * as fs from 'fs';
import * as path from 'path';
import cases from '../../tests/cases/report-period.json';
import { reportPeriodFrom } from '../src/webparts/pmoPortal/logic/forms';

// #69: период статус-отчёта — общие векторы приложения и прототипа (PPM_RULES.reportPeriodFrom прототипа)
describe('период отчёта: приложение', () => {
  (cases.cases as any[]).forEach(c => test(c.name, () => { expect(reportPeriodFrom(c.reports, c.start, c.created, c.today)).toBe(c.out); }));
});
describe('период отчёта: прототип', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { JSDOM } = require('jsdom');
  const html = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
  let w: any;
  beforeAll(() => {
    w = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: any) {
      win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
      win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined; } }).window;
  });
  afterAll(() => { if (w) w.close(); });
  (cases.cases as any[]).forEach(c => test(c.name, () => { expect(w.PPM_RULES.reportPeriodFrom(c.reports, c.start, c.created, c.today)).toBe(c.out); }));
});
