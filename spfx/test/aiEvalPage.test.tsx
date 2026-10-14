/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { AiEvalPage } from '../src/webparts/pmoPortal/panels/AiEvalPage';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import evalCases from '../src/webparts/pmoPortal/ai/evalCases.json';

// «Набір перевірок» (план этапа 4, задача 9): часть набора, карточка согласия подтверждается сама, итог и остановка при ошибке
const mock = { sent: [] as string[], values: 0, fail: '' };
jest.mock('../src/webparts/pmoPortal/ai/aiAgent', () => ({
  aiToken: async () => 'tok',
  AiConversation: class { public async start(): Promise<object> { return { texts: [], ms: 1 }; }
    public async send(t: string): Promise<object> {
      mock.sent.push(t);
      if (mock.fail && mock.sent.length === 2) throw new Error(mock.fail);
      return mock.sent.length === 1 ? { texts: [], ms: 5, consent: { allow: 1 } } : { texts: ['{"items":[]}'], ms: 1200 };
    }
    public async sendValue(): Promise<object> { mock.values++; return { texts: ['{"items":[]}'], ms: 900 }; } }
}));
const cases = (evalCases as any).cases as { kind: string }[];
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); mock.sent = []; mock.values = 0; mock.fail = ''; });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const flush = async (): Promise<void> => { for (let i = 0; i < 200; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const mount = (): void => { act(() => { ReactDOM.render(<AppCtx.Provider value={{ ...makeT(0), lang: 0, me: 'pm@x', toast() { /* */ } } as any}><AiEvalPage onCancel={() => undefined} /></AppCtx.Provider>, root); }); };
const btn = (text: string): HTMLButtonElement => Array.from(root.querySelectorAll('button')).filter(b => b.textContent === text)[0] as HTMLButtonElement;

test('«Лише «Перевірка»» — только её случаи; карточка согласия подтверждена сама; строка на случай и итог', async () => {
  mount();
  act(() => { btn('Лише «Перевірка»').click(); });
  await act(async () => { (root.querySelector('#eval-run') as HTMLButtonElement).click(); }); await flush();
  const n = cases.filter(c => c.kind === 'check').length;
  expect(mock.sent.length).toBe(n); expect(mock.sent.every(t => t.indexOf('ПЕРЕВІРКА') === 0)).toBe(true);
  expect(mock.values).toBe(1);
  expect(root.querySelectorAll('tbody tr').length).toBe(n);
  expect(root.querySelector('#eval-sum')!.textContent).toContain(`перевірка`);
  expect(root.querySelector('#eval-sum')!.textContent).toContain('чернетка 0/0');
  // старых кнопок технического прототипа нет
  expect(root.textContent).not.toMatch(/Тест \d+ КБ|Шлях A|Надіслати текст/);
});
test('ошибка агента — набор остановлен, итога нет, причина видна', async () => {
  mock.fail = 'немає відповіді за 60 с';
  mount();
  await act(async () => { (root.querySelector('#eval-run') as HTMLButtonElement).click(); }); await flush();
  expect(mock.sent.length).toBe(2);
  expect(root.querySelector('#eval-sum')).toBeNull();
  expect(root.textContent).toContain('набір зупинено');
});
