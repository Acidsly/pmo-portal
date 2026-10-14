/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { ReportForm } from '../src/webparts/pmoPortal/panels/ReportForm';
import { ReportView } from '../src/webparts/pmoPortal/panels/ReportView';

// Помощник ИИ в форме отчёта (план этапа 4, задача 4): поведение формы с заглушкой агента
const mockAgent = { replies: [] as any[], allows: [] as any[], asked: [] as string[], hold: null as null | Promise<void> };
jest.mock('../src/webparts/pmoPortal/ai/aiConfig', () => ({ isAiPilot: (e: string) => e === 'pm@x', AI_CONFIG: { pilot: ['pm@x'] } }));
jest.mock('../src/webparts/pmoPortal/ai/aiAgent', () => ({
  aiToken: async () => 'tok',
  AiSession: { open: async () => ({
    ask: async (t: string) => { mockAgent.asked.push(t); if (mockAgent.hold) await mockAgent.hold; return mockAgent.replies.shift() || { text: '' }; },
    allow: async () => mockAgent.allows.shift() || { text: '' } }) }
}));

const tt = makeT(0);
const pr: any = { id: 5, title: 'Проєкт П', code: 'PRJ-005', status: 'Реалізація', type: 'Звичайний', progress: 40, actualCost: 0, budget: 1000, start: '2026-03-02', goLive: '',
  planEnd: '2026-12-01', forecastEnd: '', canEdit: true, manager: { email: 'pm@x', name: 'PM' } };
const data: any = { projects: [pr], reports: [{ id: 1, projectId: 5, date: '2026-09-01', approval: 'Погоджено', applied: true, schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений',
  title: '', done: '', next: '– План', issues: '', decision: false, decisionText: '' }], risks: [], comments: [], team: [] };
let root: HTMLDivElement; let bodies: any[]; let created: { l: string; b: any }[] = [];
// ai — пилот и включённый «Помічник ШІ» (App: useAiSwitch)
const ctxFor = (me: string, project = pr): any => ({ ...tt, lang: 0, today: '2026-10-14', me, ai: me === 'pm@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openProject() { /* */ },
  openForm() { /* */ }, canCreate: false, reload: async () => undefined, toast() { /* */ },
  repo: { loadChanges: async () => [], siteLocalTime: async () => '2026-10-14T02:30:00',
    fresh: async () => ({ project, etag: '"1"', owner: false, pending: [], lastApprovedDate: '2026-09-01' }), createIn: async (_l: string, _id: number, b: any) => { bodies.push(b); }, create: async (l: string, b: any) => { created.push({ l, b }); return 1; } } });
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); mockAgent.replies = []; mockAgent.allows = []; mockAgent.asked = []; mockAgent.hold = null; bodies = []; created = []; localStorage.clear(); });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });

const flush = async (): Promise<void> => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const open = async (me = 'pm@x', d: any = data, project = pr): Promise<void> => {
  await act(async () => { ReactDOM.render(<AppCtx.Provider value={ctxFor(me, project)}><ReportForm data={d} projectId={5} onCancel={() => undefined} /></AppCtx.Provider>, root); });
  await flush();
};
const $ = (s: string): HTMLElement => root.querySelector(s) as HTMLElement;
const fill = (title = 'Резюме'): void => {
  for (const n of ['sched', 'budget', 'res']) act(() => { Simulate.change(root.querySelector(`input[name="${n}"][value="Зелений"]`) as HTMLInputElement); });
  act(() => { Simulate.change($('#f-t') as HTMLInputElement, { target: { value: title } } as any); });
};
const submit = async (): Promise<void> => { await act(async () => { Simulate.submit(root.querySelector('form') as HTMLFormElement); }); await flush(); };
const btn = (): string => $('#f-submit').textContent || '';

describe('помощник ИИ в форме отчёта', () => {
  test('вне пилота — «Зберегти», как раньше, без кнопок ИИ и без полей ИИ в записи', async () => {
    const po = { ...pr, manager: { email: 'other@x', name: 'PM 2' } };
    await open('other@x', { ...data, projects: [po] }, po); fill();
    expect($('#ai-fill')).toBeNull(); expect(btn()).toBe('Зберегти');
    await submit();
    expect(mockAgent.asked).toEqual([]); expect(bodies.length).toBe(1);
    expect(Object.keys(bodies[0]).filter(k => /^srAi/.test(k))).toEqual([]);
  });

  test('проверка → поле ИИ и «Зберегти» → запись с текстом проверки и временем сайта', async () => {
    await open(); fill();
    expect(btn()).toBe('Перевірити з ШІ');
    mockAgent.replies.push({ text: '{"items":["Терміни зелені, а прогноз пізніше плану"]}' });
    await submit();
    expect(mockAgent.asked.length).toBe(1); expect(mockAgent.asked[0].indexOf('ПЕРЕВІРКА\n<<DATA>>\n')).toBe(0);
    expect($('#f-ai').textContent).toBe('1. Терміни зелені, а прогноз пізніше плану');
    expect($('#f-ai').getAttribute('aria-readonly')).toBe('true'); expect($('#f-ai').querySelector('textarea,input')).toBeNull();
    expect(root.textContent).toContain('ШІ знайшов суперечностей: 1');
    expect(btn()).toBe('Зберегти');
    await submit();
    expect(bodies.length).toBe(1);
    expect([bodies[0].srAiCheck, bodies[0].srAiCheckedAt, bodies[0].srAiFilled]).toEqual(['1. Терміни зелені, а прогноз пізніше плану', '2026-10-14T02:30:00', false]);
  });

  test('вид кнопки: проверка и «ШІ аналізує…» — как «Заповнити з ШІ» (контур, иконка ИИ), сохранение — основная; иконка ИИ везде одна', async () => {
    await open(); fill();
    const sub = (): HTMLElement => $('#f-submit');
    const icon = (el: Element): string => el.querySelector('svg')!.innerHTML;
    expect(sub().className).toBe('btn ai'); expect(icon(sub())).toBe(icon($('#ai-fill')));
    let release: () => void = () => undefined; mockAgent.hold = new Promise<void>(r => { release = r; });
    mockAgent.replies.push({ text: '{"items":[]}' });
    await submit();
    expect(sub().className).toBe('btn ai'); expect(sub().querySelector('svg')).not.toBeNull();
    await act(async () => { release(); }); await flush();
    expect(btn()).toBe('Зберегти'); expect(sub().className).toBe('btn primary'); expect(sub().querySelector('svg')).toBeNull();
  });

  test('гибридная проверка: пункты кода первыми, затем ИИ; ИИ получает контекст смысловых правил; prevCheck — только пункты ИИ', async () => {
    const late = { id: 7, projectId: 5, title: 'Сервер недоступний', type: 'Ризик', probability: 1, impact: 1, status: 'Відкрито', due: '2026-10-01', mitigation: 'Відновити' };
    await open('pm@x', { ...data, risks: [late] }); fill();
    mockAgent.replies.push({ text: '{"items":["Пункт ШІ"]}' });
    await submit();
    const sent = JSON.parse(mockAgent.asked[0].split('\n')[2]);
    expect(Object.keys(sent)).toEqual(['lang', 'project', 'plan', 'mention', 'draft']);
    expect(sent.mention.map((k: any) => k.title)).toEqual(['Сервер недоступний']);
    const text = $('#f-ai').textContent || '';
    expect(text.indexOf('1. «Терміни» — зелений, а термін заходів минув: Ризик «Сервер недоступний»')).toBe(0);
    expect(text).toContain('2. Пункт ШІ');
    expect(root.textContent).toContain('ШІ знайшов суперечностей: 2');
    act(() => { Simulate.change($('#f-done') as HTMLTextAreaElement, { target: { value: '– Нове' } } as any); });
    mockAgent.replies.push({ text: '{"items":[]}' });
    await submit();
    expect(JSON.parse(mockAgent.asked[1].split('\n')[2]).prevCheck).toBe('1. Пункт ШІ');
  });

  test('язык интерфейса EN — ИИ получает lang «en», пункты портала по-английски', async () => {
    const late = { id: 7, projectId: 5, title: 'Server down', type: 'Ризик', probability: 1, impact: 1, status: 'Відкрито', due: '2026-10-01', mitigation: 'Fix' };
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={{ ...ctxFor('pm@x'), lang: 1 }}><ReportForm data={{ ...data, risks: [late] }} projectId={5} onCancel={() => undefined} /></AppCtx.Provider>, root); });
    await flush(); fill();
    mockAgent.replies.push({ text: '{"items":[]}' });
    await submit();
    expect(JSON.parse(mockAgent.asked[0].split('\n')[2]).lang).toBe('en');
    expect($('#f-ai').textContent).toContain('«Schedule» is green, but actions are overdue');
  });

  test('сбой ИИ — автоматический отзыв «Помилка ШІ (автоматично)» (только техника), в тот же день по той же причине — один; без списка «Відгуки» — нет', async () => {
    const err = { text: 'An error has occurred.\nError code: AIModelActionBadRequest\nConversation Id: conv-42' };
    await open('pm@x', { ...data, feedback: true }); fill('Секретне резюме');
    mockAgent.replies.push(err);
    await submit();
    expect(created.length).toBe(1);
    expect(created[0].l).toBe('Feedback');
    expect(created[0].b.Title).toBe('Помилка ШІ (автоматично): «Перевірка» — помилка сервісу ШІ');
    expect(created[0].b.fbText).toContain('Код: AIModelActionBadRequest'); expect(created[0].b.fbText).toContain('Розмова: conv-42');
    expect(created[0].b.fbText).toContain('Проєкт: PRJ-005'); expect(created[0].b.fbText).not.toContain('Секретне');
    // форма изменена — новая попытка, та же ошибка — отзыв не повторяется
    act(() => { Simulate.change($('#f-done') as HTMLTextAreaElement, { target: { value: '– Ще' } } as any); });
    mockAgent.replies.push(err);
    await submit();
    expect(created.length).toBe(1);
    ReactDOM.unmountComponentAtNode(root); localStorage.clear();
    await open('pm@x', { ...data, feedback: false }); fill();
    mockAgent.replies.push(err);
    await submit();
    expect(created.length).toBe(1);
  });

  test('форма закрыта во время запроса — ответ и сбой не обрабатываются, отзыва нет', async () => {
    await open('pm@x', { ...data, feedback: true }); fill();
    let release: () => void = () => undefined; mockAgent.hold = new Promise<void>(r => { release = r; });
    mockAgent.replies.push({ text: 'An error has occurred.\nError code: AIModelActionBadRequest' });
    await submit();
    act(() => { ReactDOM.unmountComponentAtNode(root); });
    await act(async () => { release(); }); await flush();
    expect(created.length).toBe(0);
  });

  test('после проверки PM изменил отчёт — снова «Перевірити з ШІ»', async () => {
    await open(); fill();
    mockAgent.replies.push({ text: '{"items":[]}' }); await submit();
    expect(btn()).toBe('Зберегти');
    act(() => { Simulate.change($('#f-done') as HTMLTextAreaElement, { target: { value: '– Нове' } } as any); });
    expect(btn()).toBe('Перевірити з ШІ');
  });

  test('ошибки формы — показаны, ИИ не вызывается', async () => {
    await open(); fill('');
    await submit();
    expect(mockAgent.asked).toEqual([]); expect(bodies).toEqual([]);
  });

  test('звіт уже на погодженні — кнопки ИИ недоступны, агент не вызывается', async () => {
    const pp = { ...pr, pendingDate: '2026-10-10' };
    await open('pm@x', { ...data, projects: [pp] }, pp);
    expect(($('#ai-fill') as HTMLButtonElement).disabled).toBe(true);
    expect(($('#f-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(mockAgent.asked).toEqual([]);
  });

  test('ИИ не ответил — «Зберегти без перевірки», в записи причина без времени; правка формы — можно повторить', async () => {
    await open(); fill();
    mockAgent.replies.push({ timeout: true }); await submit();
    expect(btn()).toBe('Зберегти без перевірки');
    expect(root.textContent).toContain('Перевірку ШІ не виконано: ШІ не відповів за 60 с');
    act(() => { Simulate.change($('#f-done') as HTMLTextAreaElement, { target: { value: '– Нове' } } as any); });
    expect(btn()).toBe('Перевірити з ШІ');
    act(() => { Simulate.change($('#f-done') as HTMLTextAreaElement, { target: { value: '' } } as any); });
    expect(btn()).toBe('Зберегти без перевірки');
    await submit();
    expect([bodies[0].srAiCheck, bodies[0].srAiCheckedAt]).toEqual(['Перевірку ШІ не виконано: ШІ не відповів за 60 с', null]);
  });

  test('карточка согласия Copilot Studio — подтверждается сама (согласие дано при включении), PM не спрашивают', async () => {
    await open(); fill();
    mockAgent.replies.push({ consent: true }); mockAgent.allows.push({ text: '{"items":[]}' });
    await submit();
    expect(root.textContent).not.toContain('Microsoft Copilot Studio');
    expect(root.textContent).toContain('Суперечностей не знайдено'); expect(btn()).toBe('Зберегти');
  });

  test('«Заповнити з ШІ»: пустые поля — сразу, заполненное — по вопросу; «Скасувати вставку» — до правок; оценка — только по «Прийняти»', async () => {
    await open();
    act(() => { Simulate.change($('#f-done') as HTMLTextAreaElement, { target: { value: '– Моє' } } as any); });
    mockAgent.replies.push({ text: JSON.stringify({ done: '– ШІ зроблено', next: '– ШІ план', issues: '', summary: 'Резюме ШІ', remember: ['Не забути'],
      ratings: { schedule: 'Жовтий', budget: null, resources: null, reason: 'Прогноз' } }) });
    await act(async () => { $('#ai-fill').click(); }); await flush();
    expect(mockAgent.asked[0].indexOf('ЧЕРНЕТКА')).toBe(0);
    expect(($('#f-t') as HTMLInputElement).value).toBe('Резюме ШІ');
    expect(($('#f-next') as HTMLTextAreaElement).value).toBe('– ШІ план');
    expect(($('#f-done') as HTMLTextAreaElement).value).toBe('– Моє');
    expect(root.textContent).toContain('Замінити текст у полі «Зроблено за період»');
    expect(root.textContent).toContain('Не забути');
    // подсказки сворачиваются (замечание с теста): заголовок — сколько пунктов «Що не забути»
    expect(($('#ai-assist') as HTMLDetailsElement).open).toBe(true);
    expect($('#ai-assist summary').textContent).toBe('Підказки ШІ: що не забути (1) і пропоновані оцінки');
    const click = (txt: string): void => { act(() => { (Array.from(root.querySelectorAll('button')).filter(b => b.textContent === txt)[0] as HTMLButtonElement).click(); }); };
    click('Замінити');
    expect(($('#f-done') as HTMLTextAreaElement).value).toBe('– ШІ зроблено');
    expect((root.querySelector('input[name="sched"]:checked') as HTMLInputElement | null)).toBeNull();
    click('Прийняти');
    expect((root.querySelector('input[name="sched"]:checked') as HTMLInputElement).value).toBe('Жовтий');
    // «Прийняти» — правка PM: после неё «Скасувати вставку» недоступна (не затирает правки)
    expect(Array.from(root.querySelectorAll('button')).some(b => b.textContent === 'Скасувати вставку ШІ')).toBe(false);
  });

  test('«Скасувати вставку» возвращает тексты до вставки', async () => {
    await open();
    mockAgent.replies.push({ text: JSON.stringify({ done: '– ШІ', next: '', issues: '', summary: 'Р', remember: [], ratings: { reason: '' } }) });
    await act(async () => { $('#ai-fill').click(); }); await flush();
    expect(($('#f-done') as HTMLTextAreaElement).value).toBe('– ШІ');
    act(() => { (Array.from(root.querySelectorAll('button')).filter(b => b.textContent === 'Скасувати вставку ШІ')[0] as HTMLButtonElement).click(); });
    expect(($('#f-done') as HTMLTextAreaElement).value).toBe('');
  });

  test('опоздавший ответ: отчёт изменился, пока ИИ работал, — ответ не применён', async () => {
    await open(); fill();
    let release: () => void = () => undefined; mockAgent.hold = new Promise<void>(r => { release = r; });
    mockAgent.replies.push({ text: '{"items":["Пункт"]}' });
    await submit();
    expect(btn()).toBe('ШІ аналізує…'); expect(($('#f-submit') as HTMLButtonElement).disabled).toBe(true);
    act(() => { Simulate.change($('#f-done') as HTMLTextAreaElement, { target: { value: '– Нове' } } as any); });
    await act(async () => { release(); }); await flush();
    expect(root.textContent).toContain('Звіт змінився, поки ШІ працював');
    expect($('#f-ai')).toBeNull(); expect(btn()).toBe('Перевірити з ШІ');
  });
});

describe('поле ИИ в просмотре отчёта', () => {
  const rep = (o: any): any => ({ ...data.reports[0], id: 3, author: { email: 'pm@x', name: 'PM' }, approval: 'Погоджено', approvedBy: null, approvedAt: '', approvalNote: '', ...o });
  const view = async (r: any): Promise<void> => {
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={ctxFor('boss@x')}><ReportView data={{ ...data, reports: [r], approvals: [] }} report={r} onCancel={() => undefined} /></AppCtx.Provider>, root); });
  };
  test('проверено — текст и «Перевірено ШІ: дата»', async () => {
    await view(rep({ aiCheck: '1. Пункт', aiCheckedAt: '2026-10-14T09:30:00Z' }));
    expect($('#rv-ai').textContent).toContain('1. Пункт'); expect($('#rv-ai').textContent).toContain('Перевірено ШІ:');
  });
  test('без проверки — причина и «Збережено без перевірки ШІ»', async () => {
    await view(rep({ aiCheck: 'Перевірку ШІ не виконано: помилка сервісу ШІ', aiCheckedAt: '' }));
    expect($('#rv-ai').textContent).toContain('Збережено без перевірки ШІ');
  });
  test('старый отчёт или вне пилота — блока нет', async () => {
    await view(rep({ aiCheck: '', aiCheckedAt: '' }));
    expect($('#rv-ai')).toBeNull();
  });
});

describe('запись реестра в пункте ИИ', () => {
  test('в записи нет заходов — кнопки вставки нет, подсказка писать вручную', async () => {
    const risk = { id: 32, projectId: 5, title: 'Відтік розробника', type: 'Ризик', probability: 5, impact: 4, status: 'Відкрито', due: '', mitigation: '', strategy: '', contingency: '', owner: null };
    await open('pm@x', { ...data, risks: [risk] }); fill();
    mockAgent.replies.push({ text: '{"items":["Не згадано ризик «Відтік розробника»."]}' });
    await submit();
    act(() => { (root.querySelector('#f-ai button') as HTMLButtonElement).click(); });
    expect(Array.from(root.querySelectorAll('.ai-rec button')).length).toBe(0);
    expect($('.ai-rec').textContent).toContain('У записі немає заходів');
  });
  test('название записи — «Показати запис», карточка и «Додати згадку» в конец «Проблеми та ризики»; кнопка — снова «Перевірити з ШІ»', async () => {
    const risk = { id: 31, projectId: 5, title: 'Ризик чи Проблема ?', type: 'Проблема', probability: 4, impact: 3, status: 'Відкрито', due: '2026-10-01',
      mitigation: 'Розібрати з ІТ', strategy: '', contingency: '', owner: null };
    await open('pm@x', { ...data, risks: [risk] }); fill();
    act(() => { Simulate.change($('#f-iss') as HTMLTextAreaElement, { target: { value: '– Прогноз зміщено.' } } as any); });
    mockAgent.replies.push({ text: '{"items":["Не згадано відкриту проблему «Ризик чи Проблема ?» — додайте рядок."]}' });
    await submit();
    const show = Array.from(root.querySelectorAll('#f-ai button')).filter(b => (b.textContent || '').indexOf('Показати запис') === 0)[0] as HTMLButtonElement;
    expect(show.textContent).toBe('Показати запис «Ризик чи Проблема ?»');
    act(() => { show.click(); });
    expect($('.ai-rec').textContent).toContain('Розібрати з ІТ'); expect($('.ai-rec').textContent).toContain('01.10.2026');
    act(() => { (Array.from(root.querySelectorAll('.ai-rec button'))[0] as HTMLButtonElement).click(); });
    expect(($('#f-iss') as HTMLTextAreaElement).value).toBe('– Прогноз зміщено.\n– Проблема «Ризик чи Проблема ?» (оцінка 12, термін 01.10.2026) — заходи: Розібрати з ІТ');
    expect(btn()).toBe('Перевірити з ШІ');
  });
});
