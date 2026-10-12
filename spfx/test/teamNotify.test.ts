import * as fs from 'fs';
import * as path from 'path';
import cases from '../../tests/cases/team-notify.json';
import { teamMarks, teamNotice, shownDiffs } from '../src/webparts/pmoPortal/logic/team';
import { cardDiff } from '../src/webparts/pmoPortal/logic/forms';
import { notifyItems } from '../src/webparts/pmoPortal/logic/notify';

// #84: «Вас додано до команди» / «Змінено вашу роль» — общие векторы приложения и прототипа (PPM_RULES прототипа)
describe('команда → сповіщення: приложение', () => {
  (cases.marks as any[]).forEach(c => test('отметки: ' + c.name, () => { expect(teamMarks(c.before, c.after)).toEqual(c.out); }));
  (cases.notice as any[]).forEach(c => test('моё: ' + c.name, () => { expect(teamNotice(c.diffs, c.me)).toBe(c.out); }));
  test('cardDiff: правка команды дописывает отметки; в истории они скрыты', () => {
    const u = (email: string): any => ({ id: 1, name: email, email });
    const b: any = { title: 'П', code: 'PRJ-1', department: '', links: [], priority: '', manager: u('pm@x'), owner: null, budget: 0, team: [{ user: u('a@x'), role: 'PM' }] };
    const d: any = { ...b, team: [{ user: u('a@x'), role: 'PM' }, { user: u('b@x'), role: 'Аналітик' }] };
    const diffs = cardDiff(b, d);
    expect(diffs.map(x => x.f)).toEqual(['team', 'teamIn']);
    expect(shownDiffs(diffs).map(x => x.f)).toEqual(['team']);
  });
  test('колокольчик: правку команды видит добавленный (не PM и не власник), остальные участники — нет', () => {
    const P: any = { id: 7, code: 'PRJ-007', title: 'П', status: 'Реалізація', manager: { email: 'pm@x' }, owner: { email: 'own@x' }, stakeholders: [], team: [] };
    const row = (id: number, field: string, to: string): any => ({ id, projectId: 7, date: '2026-10-12T10:00:00Z', kind: 'Редагування картки', field, from: '', to, reason: '', who: { id: 1, name: 'PM', email: 'pm@x' } });
    const recent = [row(1, 'pmTeam', 'B — Аналітик'), row(2, 'teamIn', 'b@x')];
    const d = { projects: [P], risks: [], comments: [], recent };
    expect(notifyItems(d, 'b@x', false, '2026-10-01').map(x => x.kind)).toEqual(['teamAdded']);
    expect(notifyItems(d, 'c@x', false, '2026-10-01')).toEqual([]);
    expect(notifyItems(d, 'own@x', false, '2026-10-01').map(x => x.kind)).toEqual(['cardEdit']);
    expect(notifyItems(d, 'pm@x', false, '2026-10-01')).toEqual([]);   // своё — не показывается
  });
});
describe('команда → сповіщення: прототип', () => {
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
  (cases.marks as any[]).forEach(c => test('отметки: ' + c.name, () => { expect(JSON.parse(JSON.stringify(w.PPM_RULES.teamMarks(c.before, c.after)))).toEqual(c.out); }));
  (cases.notice as any[]).forEach(c => test('моё: ' + c.name, () => { expect(w.PPM_RULES.teamNotice(c.diffs, c.me)).toBe(c.out); }));
});
