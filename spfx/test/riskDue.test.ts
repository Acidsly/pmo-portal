import * as fs from 'fs';
import * as path from 'path';
import cases from '../../tests/cases/risk-due.json';
import { riskDueMin } from '../src/webparts/pmoPortal/logic/forms';

// #88: термін виконання заходів ризику — общие векторы приложения и прототипа (PPM_RULES.riskDueMin прототипа)
describe('термін ризику: приложение', () => {
  (cases.cases as any[]).forEach(c => test(c.name, () => { expect(riskDueMin(c.due, c.prev, c.created, c.today)).toBe(c.out); }));
});
describe('термін ризику: прототип', () => {
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
  (cases.cases as any[]).forEach(c => test(c.name, () => { expect(w.PPM_RULES.riskDueMin(c.due, c.prev, c.created, c.today)).toBe(c.out); }));
});
