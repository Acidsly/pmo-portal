/** @jest-environment jsdom */
// Регрессия по отзывам (аудит r4): #89, #105, #106, #112, #114, #116, #117, #119, #130, #131 — приложение.
// Тесты проверяют класс ошибки (несколько входов), а не одно значение из отзыва.
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { renderInto, disposeRoot } from '../src/webparts/pmoPortal/components/reactRoot';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { DateIn, badDateIn } from '../src/webparts/pmoPortal/components/fields';
import { riskCard, riskDefs } from '../src/webparts/pmoPortal/components/defs';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { RiskForm } from '../src/webparts/pmoPortal/panels/RiskForm';
import { ReportForm } from '../src/webparts/pmoPortal/panels/ReportForm';
import { ProjectForm } from '../src/webparts/pmoPortal/panels/ProjectForm';
import { validateProject, ProjectDraft } from '../src/webparts/pmoPortal/logic/forms';
import { donutCounts, snapshots } from '../src/webparts/pmoPortal/logic/dynamics';
import { Project, StatusReport } from '../src/webparts/pmoPortal/data/types';

const tt = makeT(0);
const ctx = { ...tt, lang: 0, today: '2026-10-04', me: 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openProject() { /* */ },
  openForm() { /* */ }, repo: {}, canCreate: true, reload: async () => undefined, toast() { /* */ } } as any;   // eslint-disable-line @typescript-eslint/no-explicit-any
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); localStorage.clear(); });
afterEach(() => { act(() => { disposeRoot(root); }); root.remove(); });
const mount = (el: React.ReactElement, c: any = ctx): void => { act(() => { renderInto(root, <AppCtx.Provider value={c}>{el}</AppCtx.Provider>); }); };   // eslint-disable-line @typescript-eslint/no-explicit-any
const $ = <T extends Element = HTMLInputElement>(s: string): T => root.querySelector(s) as unknown as T;
const change = (el: Element, value: string): void => { act(() => { Simulate.change(el, { target: { value } } as any); }); };   // eslint-disable-line @typescript-eslint/no-explicit-any
const SRC = path.join(__dirname, '../src/webparts/pmoPortal');
const read = (p: string): string => fs.readFileSync(p, 'utf8');

// ---------- #131: ручной ввод сумм с копейками во всех полях сумм форм (а не только в изолированном MoneyIn) ----------
describe('#131 суммы с копейками — поля форм отчёта и нового проекта', () => {
  const pr = { id: 5, title: 'Проєкт П', status: 'Реалізація', type: 'Звичайний', progress: 40, actualCost: 0, budget: 0, start: '', goLive: '', planEnd: '', forecastEnd: '',
    canEdit: true, manager: { email: 'pm@x', name: 'PM' } };
  const data = { projects: [pr], risks: [], reports: [], comments: [], team: [], canCreate: true } as any;   // eslint-disable-line @typescript-eslint/no-explicit-any
  // набрано по символу → видно в фокусе → видно после ухода (целые доллары, x,5 — вверх)
  const CASES: [string, string, string][] = [
    ['1450,50', '1450,50', '1 451'], ['500.50', '500.50', '501'], ['600,5', '600,5', '601'], ['1 450,49', '1450,49', '1 450'],
    ['2,400,000', '2,400,000', '2 400 000'], ['1450,', '1450,', '1 450'], ['0,5', '0,5', '1'], ['1.450.000', '1.450.000', '1 450 000']
  ];
  const typeIn = (id: string, typed: string): HTMLInputElement => {
    const i = $<HTMLInputElement>('#' + id);
    act(() => { Simulate.focus(i); });
    for (const ch of typed) change(i, i.value + ch);
    return i;
  };
  for (const id of ['f-c', 'f-bp', 'f-fcost']) {
    test.each(CASES)(`звіт ${id}: «%s» по символу`, (typed, focused, shown) => {
      mount(<ReportForm data={data} projectId={5} onCancel={() => undefined} />);
      const i = typeIn(id, typed);
      expect(i.value).toBe(focused);
      act(() => { Simulate.blur(i); });
      expect(i.value).toBe(shown);
    });
  }
  test.each(CASES)('новий проєкт f-bud: «%s» по символу', (typed, focused, shown) => {
    mount(<ProjectForm data={data} onCancel={() => undefined} />);
    const i = typeIn('f-bud', typed);
    expect(i.value).toBe(focused);
    act(() => { Simulate.blur(i); });
    expect(i.value).toBe(shown);
  });
});

// ---------- #119: некорректная дата — текст остаётся, ошибка, форма не сохраняется ----------
describe('#119 DateIn: класс некорректних дат', () => {
  const Host: React.FC<{ seen: string[]; init?: string }> = ({ seen, init }) => {
    const [v, setV] = React.useState(init === undefined ? '2026-10-30' : init);
    return <form><DateIn id="dd" value={v} onChange={x => { seen.push(x); setV(x); }} /></form>;
  };
  // полная, но несуществующая дата — ошибка сразу (без ухода с поля), значение наружу — пусто
  test.each(['31.11.2026', '29.02.2027', '00.01.2026', '15.13.2026', '32.01.2026', '01.01.1899'])('«%s» — помилка одразу, текст лишається', bad => {
    const seen: string[] = []; mount(<Host seen={seen} />);
    change($('#dd'), bad.replace(/\./g, ''));
    expect($('#dd').value).toBe(bad);
    expect($('.date-bad')).not.toBeNull(); expect($('#dd').getAttribute('aria-invalid')).toBe('true');
    expect(seen[seen.length - 1]).toBe('');
    expect(badDateIn($('form'))).toBe($('#dd'));
  });
  test.each([['29022028', '2028-02-29'], ['31122026', '2026-12-31'], ['01011900', '1900-01-01']])('коректна «%s» — без помилки', (typed, iso) => {
    const seen: string[] = []; mount(<Host seen={seen} />);
    change($('#dd'), typed); act(() => { Simulate.blur($('#dd')); });
    expect($('.date-bad')).toBeNull(); expect(seen[seen.length - 1]).toBe(iso); expect(badDateIn($('form'))).toBeNull();
  });
  test('вибір у календарі (нативне поле) знімає помилку і показує дату', () => {
    const seen: string[] = []; mount(<Host seen={seen} />);
    change($('#dd'), '31112026'); expect($('.date-bad')).not.toBeNull();
    change($('.date-native'), '2026-11-30');
    expect($('.date-bad')).toBeNull(); expect($('#dd').value).toBe('30.11.2026'); expect(seen[seen.length - 1]).toBe('2026-11-30');
    expect(badDateIn($('form'))).toBeNull();
  });
  test('порожнє необов\'язкове поле при виході — без помилки (не блокує збереження)', () => {
    const seen: string[] = []; mount(<Host seen={seen} init="" />);
    act(() => { Simulate.focus($('#dd')); }); act(() => { Simulate.blur($('#dd')); });
    expect($('.date-bad')).toBeNull(); expect(badDateIn($('form'))).toBeNull();
  });
  test('форма звіту: помилка дати видна одразу і не зникає від правки інших полів, поки дату не виправлено', () => {
    const pr = { id: 5, title: 'Проєкт П', status: 'Реалізація', type: 'Звичайний', progress: 40, actualCost: 0, start: '', goLive: '', planEnd: '2026-10-30', forecastEnd: '',
      canEdit: true, manager: { email: 'pm@x', name: 'PM' } };
    mount(<ReportForm data={{ projects: [pr], risks: [], reports: [], comments: [], team: [] } as any} projectId={5} onCancel={() => undefined} />);   // eslint-disable-line @typescript-eslint/no-explicit-any
    change($('#f-plan'), '31112026');
    expect($('.date-bad')).not.toBeNull();
    change($('#f-done'), 'Зроблено щось'); change($('#f-t'), 'Резюме');
    expect($('.date-bad')).not.toBeNull(); expect($('#f-plan').value).toBe('31.11.2026');
  });
  test('новий проєкт: «31.11.2026» у «Дата старту» — проєкт не створюється, загальна помилка про дату', async () => {
    const calls: string[] = [];
    const repo = new Proxy({}, { get: (_t, k) => async () => { calls.push(String(k)); return 1; } });
    mount(<ProjectForm data={{ projects: [], risks: [], reports: [], comments: [], team: [], canCreate: true } as any} onCancel={() => undefined} />, { ...ctx, repo });   // eslint-disable-line @typescript-eslint/no-explicit-any
    change($('#f-title'), 'Новий проєкт');
    change($('#f-start'), '31112026'); act(() => { Simulate.blur($('#f-start')); });
    await act(async () => { Simulate.submit($('form')); await Promise.resolve(); });
    expect($('.err').textContent).toBe(tt.t('errDateBad'));
    expect(calls).toEqual([]);
    expect($('#f-start').value).toBe('31.11.2026');   // введённое не стёрто
  });
});

// ---------- #114: просроченный срок — красным, в карточке так же, как в таблице ----------
describe('#114 термін ризику: картка на телефоні = таблиця', () => {
  const x = { t: tt.t, fl: tt.fl, today: '2026-10-04', byId: { 5: { id: 5, title: 'Проєкт П', type: 'Звичайний', priority: '' } }, comments: [],
    open() { /* */ }, openRisk() { /* */ }, openReport() { /* */ } } as any;   // eslint-disable-line @typescript-eslint/no-explicit-any
  const base = { id: 3, projectId: 5, title: 'Ризик Р', probability: 3, impact: 5, type: 'Ризик', owner: null, strategy: '' };
  test.each([
    ['Відкрито', '2026-10-01', true], ['В роботі', '2026-10-01', true], ['Закрито', '2026-10-01', false],
    ['Відкрито', '2026-10-04', false], ['Відкрито', '2026-10-05', false], ['В роботі', '2025-01-01', true]
  ])('статус %s, термін %s → червоним: %s', (status, due, late) => {
    const k = { ...base, status, due } as any;   // eslint-disable-line @typescript-eslint/no-explicit-any
    mount(<>{riskCard(x)(k)}</>);
    const card = !!root.querySelector('.mc-m .late');
    act(() => { disposeRoot(root); });
    mount(<>{riskDefs(x).cols.due.cell(k)}</>);
    const cell = !!root.querySelector('.late');
    expect([card, cell]).toEqual([late, late]);
  });
  test('без терміну — у картці немає дати', () => {
    mount(<>{riskCard(x)({ ...base, status: 'Відкрито', due: '' } as any)}</>);   // eslint-disable-line @typescript-eslint/no-explicit-any
    expect($('.mc-m').textContent).not.toMatch(/·\s*$/); expect(root.querySelector('.late')).toBeNull();
  });
});

// ---------- #130: опис окремо для «Ризик» / «Проблема», зокрема в копії ----------
describe('#130 перемикання типу в копії запису', () => {
  const pr = { id: 5, title: 'Проєкт П', status: 'Реалізація', canEdit: true, manager: { email: 'pm@x', name: 'PM' } };
  const k = { id: 9, projectId: 5, title: 'Вихідний опис', type: 'Проблема', probability: 4, impact: 5, owner: null, status: 'В роботі', due: '', mitigation: 'М',
    strategy: '', contingency: '', created: '2026-01-05T09:00:00Z' };
  test('копія проблеми: → Ризик (опис переноситься) → змінили → Проблема — знову вихідний опис; → Ризик — опис ризику', () => {
    mount(<RiskForm data={{ projects: [pr], risks: [k], reports: [], comments: [], team: [] } as any} projectId={5} riskId={9} onCancel={() => undefined} />);   // eslint-disable-line @typescript-eslint/no-explicit-any
    act(() => { ($('#k-copy-btn') as unknown as HTMLButtonElement).click(); });
    const title = (): HTMLTextAreaElement => $<HTMLTextAreaElement>('#k-title');
    const ty = (v: string): void => { act(() => { Simulate.change($(`input[name="k-type"][value="${v}"]`)); }); };
    expect(title().value).toBe('Вихідний опис');
    ty('Ризик'); expect(title().value).toBe('Вихідний опис');
    change(title(), 'Опис ризику');
    ty('Проблема'); expect(title().value).toBe('Вихідний опис');
    ty('Ризик'); expect(title().value).toBe('Опис ризику');
    expect($('.ph h2').textContent).toBe('Новий ризик');
  });
  test('нова запис після перемикань: заголовок і тип відповідають поточному типу', () => {
    mount(<RiskForm data={{ projects: [pr], risks: [], reports: [], comments: [], team: [] } as any} projectId={5} riskId={0} onCancel={() => undefined} />);   // eslint-disable-line @typescript-eslint/no-explicit-any
    const ty = (v: string): void => { act(() => { Simulate.change($(`input[name="k-type"][value="${v}"]`)); }); };
    change($('#k-title'), 'Р'); ty('Проблема'); change($('#k-title'), 'П'); ty('Ризик'); ty('Проблема');
    expect([$<HTMLTextAreaElement>('#k-title').value, ($(`input[name="k-type"][value="Проблема"]`) as HTMLInputElement).checked]).toEqual(['П', true]);
  });
});

// ---------- #117: срез «сьогодні» = кольцо при любой выборке ----------
describe('#117 динаміка «сьогодні» = кільце (клас вхідних даних)', () => {
  const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [],
    department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0, actualCost: 0,
    lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: '', canEdit: false, pending: false, ...x } as Project);
  const R = (x: Partial<StatusReport>): StatusReport => ({ id: 1, projectId: 1, date: '2026-09-20', period: '', periodFrom: '', schedule: 'Зелений', budget: 'Зелений',
    resources: 'Зелений', status: '', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: null, keyReason: '', title: '', done: '',
    next: '', issues: '', decision: false, decisionText: '', applied: false, author: null, approval: 'Погоджено', approvedBy: null, approvedAt: '', approvalNote: '', ...x } as StatusReport);
  test('200 випадкових портфелів: картка ≠ останній погоджений звіт, архів, створені сьогодні — сьогоднішній зріз збігається з кільцем', () => {
    let seed = 7; const rnd = (n: number): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
    const RAGS = ['Зелений', 'Жовтий', 'Червоний', ''] as any[];   // eslint-disable-line @typescript-eslint/no-explicit-any
    const ST = ['Ініціація', 'Реалізація', 'Призупинено', 'Завершено', 'Скасовано'];
    const today = '2026-10-30';
    for (let run = 0; run < 200; run++) {
      const ps: Project[] = []; const rs: StatusReport[] = []; let rid = 1;
      for (let id = 1; id <= 1 + rnd(12); id++) {
        const st = ST[rnd(ST.length)];
        const arch = st === 'Завершено' || st === 'Скасовано';
        ps.push(P({ id, status: st, rag: RAGS[rnd(4)], created: ['2026-01-01T09:00:00Z', today + 'T08:00:00Z', ''][rnd(3)],
          archivedAt: arch ? ['', '2026-09-01', today][rnd(3)] : '', lastUpdate: ['', '2026-10-01'][rnd(2)] }));
        for (let j = 0; j < rnd(4); j++) rs.push(R({ id: rid++, projectId: id, date: ['2026-08-01', '2026-10-16', today][rnd(3)], budget: RAGS[rnd(3)],
          approval: ['Погоджено', 'На погодженні', 'Повернуто'][rnd(3)] }));
      }
      const last = snapshots(ps, rs, today)[6]; const d = donutCounts(ps);
      expect({ run, g: last.g, y: last.y, r: last.r, na: last.na }).toEqual({ run, g: d.g, y: d.y, r: d.r, na: d.none });
    }
  });
});

// ---------- #105: пріоритет — в «Основне», з підказкою; сполучення типу й пріоритету не блокує ----------
describe('#105 тип і пріоритет', () => {
  const pr = { id: 5, code: 'PRJ-005', title: 'Проєкт П', type: 'Стратегічний', status: 'Реалізація', canEdit: true, manager: { id: 1, email: 'pm@x', name: 'PM' }, owner: null,
    links: [], team: [], department: 'ІТ', priority: '3 — Низький', budget: 0, description: 'Мета' };
  test.each([[true], [false]])('форма (новий: %s): «Пріоритет» у розділі «Основне» (до «Люди»), з підказкою', isNew => {
    mount(<ProjectForm data={{ projects: [pr], risks: [], reports: [], comments: [], team: [], canCreate: true } as any} project={isNew ? undefined : pr as any} onCancel={() => undefined} />);   // eslint-disable-line @typescript-eslint/no-explicit-any
    const all = Array.from(root.querySelectorAll('h3.fsec, #f-prio'));
    const secs = all.map(e => (e.tagName === 'H3' ? e.textContent : '#prio'));
    expect(secs.slice(0, 3)).toEqual([tt.t('fGeneral'), '#prio', tt.t('fPeople')]);
    expect($('#f-prio').closest('.frow')!.textContent).toContain(tt.t('prioHint'));
  });
  test('будь-яке сполучення типу й пріоритету проходить перевірку (без примусової причини)', () => {
    const draft = (x: Partial<ProjectDraft>): ProjectDraft => ({ title: 'П', code: '', department: 'ІТ', country: 'Україна', links: [], type: 'Звичайний', priority: '2 — Середній',
      manager: { id: 1, name: 'M', email: 'm@x' }, owner: null, team: [], start: '', goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: 'Мета', ...x } as ProjectDraft);
    for (const type of ['Стратегічний', 'Звичайний']) for (const priority of ['1 — Високий', '2 — Середній', '3 — Низький']) {
      expect([type, priority, validateProject(draft({ type, priority }))]).toEqual([type, priority, '']);
      expect([type, priority, validateProject(draft({ type, priority }), [], [], 'П', false)]).toEqual([type, priority, '']);
    }
  });
});

// ---------- #89 / #116 / #106 / #112: правила, которые живут в стилях, скрипте развёртывания и prompt ----------
describe('статичні правила', () => {
  const scss = read(path.join(SRC, 'theme/prototype.scss'));
  const proto = read(path.join(__dirname, '../../prototype/pmo-prototype.html'));
  test('#89 приложение: своё окно прокрутки таблицы на компьютере и закреплённые заголовки — те же правила, что в прототипе', () => {
    const win = /@media \(min-width:721px\)\{\.tablewrap\.dt\{overflow:auto;max-height:[^}]*\}\}/;
    const head = /\.dt thead th\{position:sticky;top:0;[^}]*\}/;
    expect((scss.match(win) || [''])[0]).not.toBe(''); expect((scss.match(head) || [''])[0]).not.toBe('');
    expect((scss.match(win) as RegExpMatchArray)[0]).toBe((proto.match(win) as RegExpMatchArray)[0]);
    expect((scss.match(head) as RegExpMatchArray)[0]).toBe((proto.match(head) as RegExpMatchArray)[0]);
    expect(scss + read(path.join(SRC, 'theme/overrides.scss'))).not.toMatch(/\.dt th\{position:relative\}/);
  });
  test('#116 сенсорний екран: правило календаря в приложении и прототипе одинаковое; overrides не прячет нативное поле', () => {
    const rule = /@media \(pointer:coarse\)\{\.date-native\{[^}]*\}[^}]*\}\}/;
    const a = scss.match(rule), b = proto.match(rule);
    expect(a && b && a[0] === b[0]).toBe(true);
    expect((a as RegExpMatchArray)[0]).toMatch(/pointer-events:auto/);
    expect((a as RegExpMatchArray)[0]).toMatch(/\.date-native:disabled\{pointer-events:none\}/);
    expect(read(path.join(SRC, 'theme/overrides.scss'))).not.toMatch(/\.date-native\{[^}]*pointer-events:none/);
  });
  test('#106 развёртывание: поиск SharePoint в серой полосе скрыт (Hidden), а не показан', () => {
    const dep = read(path.join(__dirname, '../../scripts/Deploy-PMO.ps1'));
    expect(dep).toMatch(/SearchBoxInNavBar = \[Microsoft\.SharePoint\.Client\.SearchBoxInNavBarType\]::Hidden/);
    expect(dep).not.toMatch(/SearchBoxInNavBarType\]::(Inherit|AllPages|ModernOnly|ClassicOnly)/);
  });
  test('#112 prompt «Перевірка»: пункт плану з «Не зроблено…» — відображено; випадок у наборі перевірок', () => {
    const check = read(path.join(__dirname, '../../copilot/prompts/check.md'));
    const rule2 = (check.match(/^2\. План:.*$/m) || [''])[0];
    expect(rule2).toMatch(/draft\.notDone, — відображено/);
    expect(rule2).toMatch(/не розпочато/);
    const cases = JSON.parse(read(path.join(SRC, 'ai/evalCases.json')));
    const list: any[] = Array.isArray(cases) ? cases : cases.cases;   // eslint-disable-line @typescript-eslint/no-explicit-any
    const c = list.filter(x => x.kind === 'check' && /#112/.test(x.note || ''));
    expect(c.length).toBe(1);
    expect(c[0].input.draft.notDone).toMatch(/не розпочато/);
    expect(JSON.stringify(c[0].expect.notIn)).toContain('не відображено');
  });
});
