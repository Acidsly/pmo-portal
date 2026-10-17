/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { FeedbackForm } from '../src/webparts/pmoPortal/panels/FeedbackForm';
import { retryNet, isNetError, NET_RETRY } from '../src/webparts/pmoPortal/logic/ui';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { EXTRA } from '../src/webparts/pmoPortal/i18n/strings';

// #108: «Load failed» на телефоне — повтор сетевого запроса; повторное «Надіслати» — без дубля отзыва; #103 — список перечитывается
beforeAll(() => { NET_RETRY.waits = [0, 0]; (URL as any).createObjectURL = () => 'blob:x'; (URL as any).revokeObjectURL = () => undefined; });
const net = (): Error => new TypeError('Load failed');
test('сетевой сбой — повтор (до двух раз); ответ сервера с ошибкой — сразу', async () => {
  expect([isNetError(net()), isNetError(new Error('Failed to fetch')), isNetError(new Error('403 Forbidden'))]).toEqual([true, true, false]);
  let n = 0;
  expect(await retryNet(async () => { if (++n < 3) throw net(); return 'ok'; })).toBe('ok'); expect(n).toBe(3);
  n = 0; await expect(retryNet(async () => { n++; throw net(); })).rejects.toThrow('Load failed'); expect(n).toBe(3);
  n = 0; await expect(retryNet(async () => { n++; throw new Error('403'); })).rejects.toThrow('403'); expect(n).toBe(1);
});

let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const flush = async (): Promise<void> => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };

test('создание прошло, скриншот — нет: понятная ошибка; повторное «Надіслати» — тот же отзыв, догружается только скриншот; затем список перечитан', async () => {
  const created: any[] = [], attached: string[] = []; let attachFails = 3, reloads = 0, closed = 0;
  const repo = { create: async (_l: string, b: any) => { created.push(b); return 77; },
    attach: async (_l: string, id: number, name: string) => { if (attachFails-- > 0) throw net(); attached.push(id + ':' + name); } };
  const ctx: any = { ...makeT(0), lang: 0, me: 'pm@x', repo, reload: async () => { reloads++; }, toast() { /* */ } };
  // скриншот — как после вставки (у формы своё состояние; кладём через paste нельзя в jsdom — подменяем shrinkImage)
  act(() => { ReactDOM.render(<AppCtx.Provider value={ctx}><FeedbackForm screen="#home" onCancel={() => { closed++; }} /></AppCtx.Provider>, root); });
  act(() => { Simulate.change(root.querySelector('#fb-t') as HTMLTextAreaElement, { target: { value: 'Не працює' } } as any); });
  const input = root.querySelector('input[type=file]') as HTMLInputElement;
  const file = new File(['x'], 'shot.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [file] });
  await act(async () => { Simulate.change(input); }); await flush();
  await act(async () => { Simulate.submit(root.querySelector('form') as HTMLFormElement); }); await flush();
  expect(created.length).toBe(1); expect(attached.length).toBe(0);
  expect(root.textContent).toContain(EXTRA.fbNetErrPart[0]); expect(closed).toBe(0);
  await act(async () => { Simulate.submit(root.querySelector('form') as HTMLFormElement); }); await flush();
  expect(created.length).toBe(1); expect(attached.length).toBe(1); expect(attached[0].indexOf('77:')).toBe(0);
  expect([reloads, closed]).toEqual([1, 1]);
});
