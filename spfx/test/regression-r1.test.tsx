/** @jest-environment jsdom */
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { renderInto, disposeRoot } from '../src/webparts/pmoPortal/components/reactRoot';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { PeoplePicker, DateIn } from '../src/webparts/pmoPortal/components/fields';
import { DataTable } from '../src/webparts/pmoPortal/components/DataTable';
import { TableDefs } from '../src/webparts/pmoPortal/components/defs';
import { Tiles } from '../src/webparts/pmoPortal/components/Tiles';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { FLD } from '../src/webparts/pmoPortal/i18n/strings';
import { ReportForm } from '../src/webparts/pmoPortal/panels/ReportForm';
import { ProjectForm } from '../src/webparts/pmoPortal/panels/ProjectForm';
import { FbStatus, FB_STATUSES } from '../src/webparts/pmoPortal/pages/Feedback';
import { parse, goRoute, DEFAULT_VIEWS } from '../src/webparts/pmoPortal/logic/route';
import { PV, RV, KV, AV } from '../src/webparts/pmoPortal/logic/views';

// Сверка покрытия отзывов раунда 1 (#8, #10, #14, #15, #18, #23, #24, #25, #26, #28): поведение приложения, которого не проверяли
// другие тесты (там — чистые функции или поиск по исходнику). Прототип — regression-r1-prototype.test.ts.
jest.mock('@microsoft/sp-http', () => ({ SPHttpClient: { configurations: { v1: {} } } }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ProjectCard } = require('../src/webparts/pmoPortal/panels/ProjectCard');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type A = any;
const root0 = path.join(__dirname, '../..');
const ctxFor = (lang: number): A => ({ ...makeT(lang as A), lang, today: '2026-10-04', me: 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openProject() { /* */ },
  openForm() { /* */ }, repo: {}, canCreate: true, reload: async () => undefined, toast() { /* */ } });
const ctx = ctxFor(0);
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); localStorage.clear(); });
afterEach(() => { act(() => { disposeRoot(root); }); root.remove(); });
const mount = (el: React.ReactElement, c: A = ctx): void => { act(() => { renderInto(root, <AppCtx.Provider value={c}>{el}</AppCtx.Provider>); }); };
const person = (email: string, name = email): A => ({ id: 1, name, email });

describe('#8: Enter в поле выбора людей выбирает человека и не отправляет форму', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });
  const found = [person('a@x', 'Анна'), person('b@x', 'Борис'), person('c@x', 'Віра')];
  const setup = async (res: A[]): Promise<{ i: HTMLInputElement; picked: A[][]; submits: number[] }> => {
    const picked: A[][] = [], submits: number[] = [];
    mount(<form onSubmit={e => { e.preventDefault(); submits.push(1); }}><PeoplePicker id="pp" multi={false} value={[]} onChange={v => picked.push(v)} search={async () => res} /></form>);
    const i = root.querySelector('#pp') as HTMLInputElement;
    act(() => { Simulate.change(i, { target: { value: 'ан' } } as A); });
    await act(async () => { jest.advanceTimersByTime(300); await Promise.resolve(); });
    return { i, picked, submits };
  };
  const key = (i: HTMLElement, k: string): jest.Mock => { const pd = jest.fn(); act(() => { Simulate.keyDown(i, { key: k, preventDefault: pd } as A); }); return pd; };
  test('стрелка вниз + Enter — выбран второй; Enter отменён (форма не уходит); список закрыт', async () => {
    const { i, picked, submits } = await setup(found);
    expect(root.querySelectorAll('.picker-list .pop-row').length).toBe(3);
    key(i, 'ArrowDown');
    const pd = key(i, 'Enter');
    expect(pd).toHaveBeenCalled();
    expect(picked).toEqual([[found[1]]]);
    expect(submits).toEqual([]);
    expect(root.querySelector('.picker-list .pop-row')).toBeNull();
  });
  test('ничего не найдено — Enter тоже отменён и ничего не выбирает', async () => {
    const { i, picked } = await setup([]);
    expect(key(i, 'Enter')).toHaveBeenCalled();
    expect(picked).toEqual([]);
  });
  test('Esc очищает поиск, обычные буквы не отменяются', async () => {
    const { i } = await setup(found);
    expect(key(i, 'a')).not.toHaveBeenCalled();
    key(i, 'Escape');
    expect(i.value).toBe(''); expect(root.querySelector('.picker-list')).toBeNull();
  });
});

describe('#10: номер проекта — только автоматический, дубли запрещены в списке', () => {
  test('форма нового проекта: поле номера только для чтения, подсказка «автоматично»', () => {
    mount(<ProjectForm data={{ projects: [], risks: [], reports: [], comments: [], team: [], canApprove: true, canCreate: true } as A} project={null as A} onCancel={() => undefined} />);
    const c = root.querySelector('#f-code') as HTMLInputElement;
    expect(c.readOnly).toBe(true); expect(c.disabled).toBe(true); expect(c.value).toBe('');
    expect(c.placeholder).toBe(ctx.t('codeAuto'));
  });
  test('Deploy-PMO.ps1 включает запрет дублей (EnforceUniqueValues) и индекс у pmCode', () => {
    const src = fs.readFileSync(path.join(root0, 'scripts/Deploy-PMO.ps1'), 'utf8');
    expect(src).toMatch(/Set-PnPField -List \$P -Identity pmCode -Values @\{ Indexed = \$true \}/);
    expect(src).toMatch(/Set-PnPField -List \$P -Identity pmCode -Values @\{ EnforceUniqueValues = \$true \}/);
  });
});

describe('#14: статусы отзывов цветные — у каждого свой цвет', () => {
  test('значения статусов приложения = значения поля fbStatus в Deploy-PMO.ps1 (иначе класс fbst--1 без цвета)', () => {
    const src = fs.readFileSync(path.join(root0, 'scripts/Deploy-PMO.ps1'), 'utf8');
    const m = /\$fbStatuses = @\(([^)]*)\)/.exec(src) as RegExpExecArray;
    expect((m[1].match(/"([^"]*)"/g) || []).map(x => x.slice(1, -1))).toEqual(FB_STATUSES);
  });
  test.each(FB_STATUSES.map((s, i) => [s, i]))('«%s» — бейдж .fbst-%d, у класса свой цвет и фон', (s, i) => {
    mount(<FbStatus v={s as string} />);
    expect((root.querySelector('.fbst') as HTMLElement).className).toBe('fbst fbst-' + i);
  });
  test('цвета классов .fbst-N в стилях приложения — все разные', () => {
    const css = fs.readFileSync(path.join(root0, 'spfx/src/webparts/pmoPortal/theme/prototype.scss'), 'utf8');
    const rules = FB_STATUSES.map((_, i) => ((new RegExp(`\\.fbst-${i}\\s*\\{([^}]*)\\}`).exec(css) || [])[1] || '').replace(/\s+/g, ''));
    expect(rules.every(r => /color:/.test(r) && /background:/.test(r))).toBe(true);
    expect(new Set(rules).size).toBe(FB_STATUSES.length);
  });
});

describe('#15: CSV — таблица как на экране', () => {
  type Row = { id: number; a: string; b: string; rag: string };
  const defs: TableDefs<Row> = { lock: 'a', defaults: ['a', 'b', 'rag'], cols: {
    a: { label: 'Назва', cell: (r: Row) => r.a, sort: (r: Row) => r.a }, b: { label: 'Опис', cell: (r: Row) => r.b },
    rag: { label: 'Стан', cell: (r: Row) => <span className="dot" title={r.rag} /> }, hidden: { label: 'Прихована', cell: () => 'X' } } } as A;
  const rows: Row[] = [{ id: 1, a: 'Бета', b: 'CRM; етап 2', rag: 'Жовтий' }, { id: 2, a: 'Альфа', b: 'Звіт "А"', rag: 'Зелений' }];
  let blobs: Blob[]; let cou: A;
  beforeEach(() => { blobs = []; cou = URL.createObjectURL; (URL as A).createObjectURL = (b: Blob) => { blobs.push(b); return 'blob:x'; }; (URL as A).revokeObjectURL = () => undefined;
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined); });
  afterEach(() => { (URL as A).createObjectURL = cou; jest.restoreAllMocks(); });
  const read = (b: Blob): Promise<string> => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsText(b); });
  test('видимые колонки (без скрытых), строки в порядке экрана, у значка — подсказка; после сортировки — новый порядок', async () => {
    mount(<DataTable tkey="r1csv" defs={defs} rows={rows} />);
    const btn = root.querySelector('.csv-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    act(() => { btn.click(); });
    const t1 = (await read(blobs[0])).replace(/^\ufeff/, '').split('\r\n');
    const screen = Array.from(root.querySelectorAll('tbody tr')).map(tr => (tr.querySelector('td') as HTMLElement).textContent);
    expect(t1[0]).toBe('Назва;Опис;Стан');
    expect(t1.slice(1).map(l => l.split(';')[0])).toEqual(screen);
    expect(t1).toContain(`${rows[0].a};"CRM; етап 2";Жовтий`);
    const sortB = root.querySelector('thead button') as HTMLButtonElement;
    act(() => { sortB.click(); });
    const screen2 = Array.from(root.querySelectorAll('tbody tr')).map(tr => (tr.querySelector('td') as HTMLElement).textContent);
    act(() => { (root.querySelector('.csv-btn') as HTMLButtonElement).click(); });
    const t2 = (await read(blobs[1])).replace(/^\ufeff/, '').split('\r\n');
    expect(t2.slice(1).map(l => l.split(';')[0])).toEqual(screen2);
  });
  test('пустая таблица — кнопка недоступна', () => {
    mount(<DataTable tkey="r1csv2" defs={defs} rows={[]} />);
    expect((root.querySelector('.csv-btn') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('#18 / #25: карточка — «Посилання» и «Команда проєкту»; ссылки — в новой вкладке, SharePoint не перехватывает', () => {
  const links = [{ t: 'Планер', u: 'https://tasks.office.com/x' }, { t: 'Запис зустрічі', u: 'https://contoso.sharepoint.com/:v:/r/a.mp4' }, { t: 'OneDrive', u: 'https://contoso-my.sharepoint.com/x' }];
  const team = [{ id: 1, projectId: 7, user: person('a@x', 'Анна'), role: 'Замовник', topics: 'бюджет' }, { id: 2, projectId: 7, user: person('b@x', 'Борис'), role: 'Архітектор', topics: '' }];
  const P: A = { id: 7, code: 'PRJ-007', title: 'П', status: 'Реалізація', type: 'Звичайний', priority: '', rag: 'Зелений', progress: 10, start: '', goLive: '', planEnd: '', forecastEnd: '',
    manager: person('pm@x', 'PM'), owner: null, stakeholders: [], team, links, description: '', canEdit: false, budget: 0, actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', department: '' };
  const newTab = (a: HTMLAnchorElement): boolean => a.target === '_blank' && a.getAttribute('data-interception') === 'off' && /noopener/.test(a.rel);
  test('карточка: все ссылки проекта с подписями, в новой вкладке; таблица команды — учасник, роль, з яких питань', async () => {
    const data: A = { projects: [P], reports: [], risks: [], comments: [], approvals: [], team };
    const repo: A = { jobTitle: async () => '', loadChanges: async () => [], fresh: async () => ({ project: { canEdit: false } }) };
    await act(async () => { renderInto(root, <AppCtx.Provider value={ctx}><ProjectCard project={P} data={data} repo={repo} onClose={() => undefined} /></AppCtx.Provider>); await Promise.resolve(); });
    const as = Array.from(root.querySelectorAll('.lnk-sec a')) as HTMLAnchorElement[];
    expect(as.map(a => a.getAttribute('href'))).toEqual(links.map(l => l.u));
    as.forEach((a, i) => { expect(a.textContent).toContain(links[i].t); expect(newTab(a)).toBe(true); });
    const tb = root.querySelector('table.team') as HTMLTableElement;
    expect(Array.from(tb.querySelectorAll('thead th')).map(th => th.textContent)).toEqual(['tmPerson', 'tmRole', 'tmTopics'].map(k => (FLD as A)[k][0]));
    const cells = Array.from(tb.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent));
    expect(cells.length).toBe(2);
    expect(cells[0][0]).toContain('Анна'); expect(cells[0][1]).toBe('Замовник'); expect(cells[0][2]).toBe('бюджет');
    expect(cells[1][2]).toBe('—');
    // все внешние ссылки карточки (не только «Посилання») — в новой вкладке
    (Array.from(root.querySelectorAll('a[href^="http"]')) as HTMLAnchorElement[]).forEach(a => expect(newTab(a)).toBe(true));
  });
  test('плитка проекта: ссылка из «Посилання» — в новой вкладке', () => {
    mount(<Tiles rows={[P]} />);
    const a = root.querySelector('.tile a.loop') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe(links[0].u); expect(newTab(a)).toBe(true);
  });
});

describe('#23 / #24: вкладка в шапке — вид по умолчанию после ЛЮБОГО вида, открытого показателем', () => {
  const VIEWS: Record<string, Record<string, string>> = { projects: PV, reports: RV, risks: KV, archive: AV };
  const cases = Object.keys(VIEWS).flatMap(pg => Object.keys(VIEWS[pg]).map(v => [pg, v]));
  test.each(cases)('%s/%s → «Головна» → вкладка: вид по умолчанию; другие вкладки тоже', (pg, v) => {
    let r = goRoute(parse('#home', DEFAULT_VIEWS), pg as A, v);
    expect((r.views as A)[pg]).toBe(v);
    r = goRoute(r, 'home');
    Object.keys(VIEWS).forEach(p2 => { const r2 = goRoute(r, p2 as A); expect((r2.views as A)[p2]).toBe((DEFAULT_VIEWS as A)[p2]); });
  });
});

describe('#26: подсказка поля даты — на языке интерфейса', () => {
  test.each([[0, 'дд.мм.рррр'], [1, 'dd.mm.yyyy'], [2, 'дд.мм.гггг']])('язык %d → «%s»; точки ставятся сами', (lang, ph) => {
    const seen: string[] = [];
    const Host: React.FC = () => { const [v, setV] = React.useState(''); return <DateIn id="dd" value={v} onChange={x => { seen.push(x); setV(x); }} />; };
    mount(<Host />, ctxFor(lang as number));
    const i = root.querySelector('#dd') as HTMLInputElement;
    expect(i.placeholder).toBe(ph);
    act(() => { Simulate.change(i, { target: { value: '30092026' } } as A); });
    expect(i.value).toBe('30.09.2026'); expect(seen[seen.length - 1]).toBe('2026-09-30');
  });
});

describe('#28 / #53: «% виконання» — только цифры, больше 100 не сохраняется', () => {
  const data: A = { projects: [{ id: 5, title: 'Проєкт П', status: 'Реалізація', type: 'Звичайний', progress: 40, actualCost: 0, start: '2026-03-02', goLive: '', planEnd: '2026-12-01', forecastEnd: '',
    canEdit: true, manager: { email: 'pm@x', name: 'PM' } }], risks: [], reports: [], comments: [], team: [] };
  test.each([['-5', '5'], ['12.5', '125'], ['1e2', '12'], ['абв', ''], ['50%', '50']])('ввод «%s» → в поле «%s»', (typed, shown) => {
    mount(<ReportForm data={data} projectId={5} onCancel={() => undefined} />);
    const pr = root.querySelector('#f-pr') as HTMLInputElement;
    act(() => { Simulate.change(pr, { target: { value: typed } } as A); });
    expect(pr.value).toBe(shown);
  });
  test.each(['101', '150', '999'])('«%s» — ошибка у поля при сохранении, без замены на 100', v => {
    const repo: A = { createIn: jest.fn(), create: jest.fn(), fresh: jest.fn() };
    mount(<ReportForm data={data} projectId={5} onCancel={() => undefined} />, { ...ctx, repo });
    const pr = root.querySelector('#f-pr') as HTMLInputElement;
    act(() => { Simulate.change(pr, { target: { value: v } } as A); });
    act(() => { Simulate.submit(root.querySelector('form') as HTMLFormElement); });
    expect(pr.getAttribute('aria-invalid')).toBe('true');
    expect(pr.value).toBe(v);
    expect(repo.createIn).not.toHaveBeenCalled(); expect(repo.create).not.toHaveBeenCalled();
  });
});
