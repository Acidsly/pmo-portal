/** @jest-environment jsdom */
import * as React from 'react';
import { act } from 'react';
import { Simulate } from 'react-dom/test-utils';
import { renderInto, disposeRoot } from '../src/webparts/pmoPortal/components/reactRoot';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { CountriesPanel } from '../src/webparts/pmoPortal/panels/CountriesPanel';
import { ProjectForm } from '../src/webparts/pmoPortal/panels/ProjectForm';
import { AssignForm } from '../src/webparts/pmoPortal/panels/AssignForm';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { tv, setExtraValues, setValueLang } from '../src/webparts/pmoPortal/i18n/values';
import { countryList, countryLabels } from '../src/webparts/pmoPortal/logic/countries';

// Довідник «Країни і CEO» (план 2026-11-02-countries-directory.md): экран PMO, запись в оба списка, свежесть, варианты в формах, переводы
const tt = makeT(0);
const names = (): any[] => [
  { id: 1, name: 'Україна', en: 'Ukraine', ru: 'Украина', order: 10, active: true, modified: 'm1' },
  { id: 2, name: 'Польща', en: 'Poland', ru: 'Польша', order: 20, active: true, modified: 'm2' },
  { id: 3, name: 'Грузія', en: 'Georgia', ru: 'Грузия', order: 30, active: false, modified: 'm3' }];
const ceo = (): any[] => [{ id: 11, name: 'Україна', ceo: [{ id: 5, name: 'CEO UA', email: 'ua@x' }], modified: 'c1' }, { id: 12, name: 'Польща', ceo: [], modified: 'c2' }];
let calls: any[]; let admin: () => { names: any[]; ceo: any[] };
const repo = (): any => ({
  loadCountryAdmin: async () => { const a = admin(); return { names: countryList(a.names), ceo: a.ceo }; },
  create: async (list: string, body: any) => { calls.push(['create', list, body]); return 99; },
  update: async (list: string, id: number, body: any) => { calls.push(['update', list, id, body]); },
  ensureUser: async (p: any) => { calls.push(['ensure', p.email]); return 77; },
  searchPeople: async () => [], fresh: async () => ({}), createIn: async () => 1 });
let ctx: any;
const pj = (x: any = {}): any => ({ id: 1, code: 'PRJ-001', title: 'А', status: 'Реалізація', country: 'Грузія', manager: { id: 1, email: 'pm@x', name: 'PM' }, owner: null,
  stakeholders: [], team: [], links: [], ...x });
const data = (x: any = {}): any => ({ projects: [pj(), pj({ id: 2, status: 'Завершено' })], reports: [], risks: [], comments: [], changes: [], approvals: [],
  canCreate: true, canApprove: true, canCountries: true, countries: countryList(names()), ...x });
let root: HTMLDivElement;
beforeEach(() => {
  calls = []; admin = () => ({ names: names(), ceo: ceo() });
  ctx = { ...tt, lang: 0, today: '2026-11-02', me: 'pmo@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openForm() { /* */ }, openProject() { /* */ },
    canCreate: true, reload: async () => undefined, toast: jest.fn(), setCloseGuard() { /* */ }, repo: repo() };
  root = document.createElement('div'); document.body.appendChild(root);
});
afterEach(() => { act(() => { disposeRoot(root); }); root.remove(); setExtraValues({}); setValueLang(0); });
const flush = async (): Promise<void> => { await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const mount = async (el: React.ReactElement): Promise<void> => { act(() => { renderInto(root, <AppCtx.Provider value={ctx}>{el}</AppCtx.Provider>); }); await flush(); };
const $ = (s: string): any => root.querySelector(s);
const type = (s: string, v: string): void => { act(() => { Simulate.change($(s), { target: { value: v } } as any); }); };
const submit = async (): Promise<void> => { await act(async () => { Simulate.submit($('#co-form')); }); await flush(); };

test('без права вести довідник — замок, без списку', async () => {
  await mount(<CountriesPanel data={data({ canCountries: false })} onCancel={() => undefined} />);
  expect($('.lock')).not.toBeNull(); expect($('#co-list')).toBeNull();
});

test('список: країни за порядком, вимкнена позначена, CEO і активні проєкти', async () => {
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  const rows = Array.from(root.querySelectorAll('.co-row')) as HTMLElement[];
  expect(rows.map(r => r.dataset.name)).toEqual(['Україна', 'Польща', 'Грузія']);
  expect(rows[0].textContent).toContain('CEO UA');
  expect(rows[1].textContent).toContain(tt.t('coNoCeo'));
  expect(rows[2].textContent).toContain(tt.t('coOff'));
  expect(rows[2].querySelector('.co-cnt')!.textContent).toBe('1');   // завершений проєкт не рахується
});

test('нова країна: рядок у «Назви країн» і «Країни» з CEO; переклад за замовчуванням — uk', async () => {
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click($('#co-add')); });
  type('#co-name', 'Молдова'); type('#co-en', 'Moldova');
  await submit();
  expect(calls).toEqual([['create', 'CountryNames', { Title: 'Молдова', cnEn: 'Moldova', cnRu: 'Молдова', cnOrder: 40, cnActive: true }],
    ['create', 'Countries', { Title: 'Молдова', coCeoId: [] }]]);
  expect(ctx.toast).toHaveBeenCalledWith(tt.t('savedCountry'));
});

test('дубль назви — помилка, нічого не записано', async () => {
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click($('#co-add')); });
  type('#co-name', ' польща ');
  await submit();
  expect($('.err').textContent).toBe(tt.t('errCountryDup')); expect(calls).toEqual([]);
});

test('інший PMO щойно додав таку саму країну — дубль за свіжими даними', async () => {
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click($('#co-add')); });
  type('#co-name', 'Молдова');
  admin = () => ({ names: [...names(), { id: 4, name: 'Молдова', order: 40, active: true, modified: 'm4' }], ceo: ceo() });
  await submit();
  expect($('.err').textContent).toBe(tt.t('errCountryDup')); expect(calls).toEqual([]);
});

test('наявна країна: назва заблокована, вимкнути — оновлення обох рядків', async () => {
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click(root.querySelector('.co-row[data-name="Польща"]') as Element); });
  expect($('#co-name').disabled).toBe(true);
  // поля — как во всех формах портала (стиль form input[type=text])
  expect(['co-name', 'co-en', 'co-ru', 'co-order'].map(i => $('#' + i).getAttribute('type'))).toEqual(['text', 'text', 'text', 'text']);
  act(() => { Simulate.change($('#co-active'), { target: { checked: false } } as any); });
  await submit();
  expect(calls).toEqual([['update', 'CountryNames', 2, { cnEn: 'Poland', cnRu: 'Польша', cnOrder: 20, cnActive: false }], ['update', 'Countries', 12, { coCeoId: [] }]]);
});

test('рядок змінив інший PMO — не перезаписуємо, просимо перевірити', async () => {
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click(root.querySelector('.co-row[data-name="Україна"]') as Element); });
  admin = () => ({ names: names(), ceo: ceo().map(x => (x.id === 11 ? { ...x, modified: 'c1-new', ceo: [] } : x)) });
  await submit();
  expect($('.err').textContent).toBe(tt.t('errCountryStale')); expect(calls).toEqual([]);
  expect($('#co-ceo').closest('.frow').textContent).not.toContain('CEO UA');   // форма — зі свіжими даними
});

test('попередження: вимкнена країна з активними проєктами; активна без CEO', async () => {
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click(root.querySelector('.co-row[data-name="Грузія"]') as Element); });
  expect($('#co-warnCountryInactive').textContent).toBe(tt.t('warnCountryInactive').replace('{n}', '1'));
  act(() => { Simulate.change($('#co-active'), { target: { checked: true } } as any); });
  expect($('#co-warnCountryNoCeo')).not.toBeNull();
});

test('форми: у виборі — активні країни довідника; поточна вимкнена країна проєкту не зникає', async () => {
  const d = data({ countries: countryList([...names(), { id: 4, name: 'Молдова', en: 'Moldova', ru: 'Молдова', order: 40, active: true }]) });
  await mount(<ProjectForm data={d} onCancel={() => undefined} />);
  expect(Array.from(root.querySelectorAll('#f-country option')).map((o: any) => o.value)).toEqual(['', 'Україна', 'Польща', 'Молдова']);
  act(() => { disposeRoot(root); });
  await mount(<AssignForm data={d} projectId={1} onCancel={() => undefined} />);
  expect(Array.from(root.querySelectorAll('#a-country option')).map((o: any) => o.value)).toEqual(['', 'Україна', 'Польща', 'Молдова', 'Грузія']);
});

test('переклад назви країни — з довідника, поверх вбудованих', () => {
  setExtraValues(countryLabels(countryList([{ id: 4, name: 'Молдова', en: 'Moldova', ru: 'Молдова' }, { id: 1, name: 'Україна', en: 'UA (dir)', ru: '' }])));
  setValueLang(1);
  expect([tv('Молдова'), tv('Україна'), tv('Польща')]).toEqual(['Moldova', 'UA (dir)', 'Poland']);
});

test('CEO з пошуку: нова людина — ensureUser, у «Країни» — її Id', async () => {
  ctx.repo.searchPeople = async () => [{ id: 0, email: 'Md@x', name: 'CEO MD' }];
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click(root.querySelector('.co-row[data-name="Польща"]') as Element); });
  jest.useFakeTimers();
  act(() => { Simulate.change($('#co-ceo'), { target: { value: 'CEO' } } as any); });
  await act(async () => { jest.advanceTimersByTime(300); await Promise.resolve(); });
  jest.useRealTimers();
  act(() => { Simulate.mouseDown(root.querySelector('.picker-list .pop-row') as Element); });
  await submit();
  expect(calls).toContainEqual(['ensure', 'Md@x']);
  expect(calls).toContainEqual(['update', 'Countries', 12, { coCeoId: [77] }]);
});

test('кросс-ревью M1: людину не знайдено — нічого не записано', async () => {
  ctx.repo.searchPeople = async () => [{ id: 0, email: 'gone@x', name: 'Гість' }];
  ctx.repo.ensureUser = async () => { throw new Error('userNotFound'); };
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click(root.querySelector('.co-row[data-name="Польща"]') as Element); });
  jest.useFakeTimers();
  act(() => { Simulate.change($('#co-ceo'), { target: { value: 'Гість' } } as any); });
  await act(async () => { jest.advanceTimersByTime(300); await Promise.resolve(); });
  jest.useRealTimers();
  act(() => { Simulate.mouseDown(root.querySelector('.picker-list .pop-row') as Element); });
  await submit();
  expect(calls).toEqual([]); expect($('.err').textContent).not.toBe('');
});

test('кросс-ревью M1: нова країна, CEO-рядок не записався — повтор оновлює свій рядок, а не «дубль»', async () => {
  const created: any[] = [];
  let failCeo = true;
  admin = () => ({ names: [...names(), ...created], ceo: ceo() });
  ctx.repo.create = async (list: string, body: any) => {
    calls.push(['create', list, body]);
    if (list === 'Countries' && failCeo) { failCeo = false; throw new Error('Countries: 500 boom'); }
    if (list === 'CountryNames') created.push({ id: 99, name: body.Title, en: body.cnEn, ru: body.cnRu, order: body.cnOrder, active: body.cnActive, modified: 'n99' });
    return 99;
  };
  await mount(<CountriesPanel data={data()} onCancel={() => undefined} />);
  act(() => { Simulate.click($('#co-add')); });
  type('#co-name', 'Молдова');
  await submit();
  expect($('.err').textContent).toContain('boom');
  expect($('#co-name').disabled).toBe(true);   // форма — уже своя записана строка
  calls = [];
  await submit();
  expect(calls).toEqual([['update', 'CountryNames', 99, { cnEn: 'Молдова', cnRu: 'Молдова', cnOrder: 40, cnActive: true }], ['create', 'Countries', { Title: 'Молдова', coCeoId: [] }]]);
});
