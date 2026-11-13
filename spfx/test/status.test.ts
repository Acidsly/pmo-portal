import * as S from '../src/webparts/pmoPortal/logic/status';
import * as fs from 'fs';
import * as path from 'path';
import archive from '../../tests/cases/archive.json';
import fresh from '../../tests/cases/fresh.json';
import kind from '../../tests/cases/kind.json';

describe('архив: общие векторы с Test-ArchivedStatus', () => {
  archive.cases.forEach(c => test(`«${c.status}» -> ${c.archived}`, () => { expect(S.isArch(c.status)).toBe(c.archived); expect(S.isActive(c.status)).toBe(!c.archived); }));
});

test('isArch / isActive', () => {
  expect(S.isArch('Архівний')).toBe(true); expect(S.isArch('Завершено')).toBe(true); expect(S.isArch('Реалізація')).toBe(false);
  expect(S.isActive('Скасовано')).toBe(false); expect(S.isActive('Призупинено')).toBe(true); expect(S.isActive('Архівний')).toBe(false);
});
// 1.7.12: свежесть по дням подачи (поточні — пн и чт, підтримка — чт) — общие векторы с прототипом
describe('свежесть по дням подачи: tests/cases/fresh.json', () => {
  fresh.cases.forEach(c => test(c.name, () => {
    const k = c.kind as S.Kind;
    expect(S.missedSlots(c.last, c.today, k)).toBe(c.missed);
    expect(S.freshness(c.last, c.today, k)).toBe(c.level);
  }));
});
describe('категория по фазе: tests/cases/kind.json', () => {
  kind.cases.forEach(c => test(`«${c.status}» -> ${c.kind}`, () => {
    expect(S.projectKind(c.status)).toBe(c.kind); expect(S.isSupport(c.status)).toBe(c.kind === 'support'); expect(S.isArch(c.status)).toBe(c.archived);
  }));
});
// правило категории — только через isSupport / projectKind: значение 'Підтримка' (литерал) в коде приложения — лишь в словарях и списках значений
test('«Підтримка» не сравнивается напрямую вне logic/status.ts', () => {
  const root = path.join(__dirname, '../src/webparts/pmoPortal');
  const allowed = ['logic/status.ts', 'i18n/values.ts', 'i18n/strings.ts', 'components/defs.tsx', 'components/Bits.tsx', 'panels/ProjectForm.tsx', 'panels/ReportForm.tsx', 'help/guide.ts', 'help/releases.ts', 'help/overview.ts', 'ai/evalCases.json'];
  const bad: string[] = [];
  const walk = (d: string): void => fs.readdirSync(d).forEach(n => { const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|json)$/.test(n)) { const rel = path.relative(root, p).split(path.sep).join('/');
      if (allowed.indexOf(rel) < 0 && /['"`]Підтримка['"`]/.test(fs.readFileSync(p, 'utf8'))) bad.push(rel); } });
  walk(root);
  expect(bad).toEqual([]);
});
test('сроки, прогноз, бюджет', () => {
  expect(S.isPlanLate('2026-09-23', 'Реалізація', '2026-09-24')).toBe(true);
  expect(S.isPlanLate('2026-09-23', 'Архівний', '2026-09-24')).toBe(false);
  expect(S.forecastDelta('2026-12-18', '2027-01-29')).toBe(42);
  expect(S.forecastDelta('', '2027-01-29')).toBeNull();
  expect(S.budgetUse(2400000, 1450000)).toBe(60); expect(S.budgetUse(0, 5)).toBe(0);
  expect(S.budgetLevel(101)).toBe('over'); expect(S.budgetLevel(91)).toBe('warn'); expect(S.budgetLevel(90)).toBe('');
});
test('риски', () => {
  expect(S.riskScore(5, 4)).toBe(20); expect(S.scoreLevel(15)).toBe('r'); expect(S.scoreLevel(8)).toBe('y'); expect(S.scoreLevel(7)).toBe('g');
});
test('порядок: стратегические, приоритет, название', () => {
  const xs = [
    { type: 'Звичайний', priority: '1 — Високий', title: 'Б' },
    { type: 'Стратегічний', priority: '2 — Середній', title: 'В' },
    { type: 'Стратегічний', priority: '1 — Високий', title: 'Я' },
    { type: 'Стратегічний', priority: '1 — Високий', title: 'А' }
  ];
  expect(xs.slice().sort(S.byOrder).map(x => x.title)).toEqual(['А', 'Я', 'В', 'Б']);
});

import { staleFirst } from '../src/webparts/pmoPortal/logic/status';
test('«Немає свіжого звіту»: без отчётов сверху, дальше от самого давнего', () => {
  const rows = [{ id: 1, lastUpdate: '2026-09-10' }, { id: 2, lastUpdate: '' }, { id: 3, lastUpdate: '2026-08-20' }, { id: 4, lastUpdate: '' }];
  expect(rows.sort(staleFirst).map(r => r.id)).toEqual([2, 4, 3, 1]);
});

describe('«Архів»: представления «Завершені» / «Скасовані»', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { archiveView, AV } = require('../src/webparts/pmoPortal/logic/views');
  const p = (status: string): any => ({ status, type: 'Звичайний', manager: null, owner: null, stakeholders: [] });
  test('по статусу; «Усі» — оба', () => {
    expect(Object.keys(AV).slice(0, 3)).toEqual(['all', 'done', 'cancelled']);
    expect(archiveView('done', p('Завершено'), 'x')).toBe(true); expect(archiveView('done', p('Скасовано'), 'x')).toBe(false);
    expect(archiveView('cancelled', p('Скасовано'), 'x')).toBe(true); expect(archiveView('cancelled', p('Завершено'), 'x')).toBe(false);
    expect(archiveView('all', p('Скасовано'), 'x')).toBe(true);
  });
});

describe('#73 фильтр колонки «Звіт» по погодженню', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { apBucket, AP_BUCKET } = require('../src/webparts/pmoPortal/logic/views');
  test('a1 Погоджено, a2 На погодженні, a3 Повернуто, a4 — отчётов не подавали', () => {
    expect(apBucket({ approval: 'Погоджено' })).toBe('a1');
    expect(apBucket({ approval: 'На погодженні' })).toBe('a2');
    expect(apBucket({ approval: 'Повернуто' })).toBe('a3');
    expect(apBucket(null)).toBe('a4'); expect(apBucket(undefined)).toBe('a4');
    expect(AP_BUCKET).toEqual({ a1: 'Погоджено', a2: 'На погодженні', a3: 'Повернуто' });
  });
});
