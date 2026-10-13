import { aiRun, AiPort } from '../src/webparts/pmoPortal/ai/aiRun';
import { AiCallOut } from '../src/webparts/pmoPortal/logic/aiFlow';

// Запрос к помощнику (план этапа 4, задача 2): согласие, ошибки, повтор неразобранного ответа — на заглушке агента
const port = (asks: AiCallOut[], allows: AiCallOut[] = []): { open: () => Promise<AiPort>; opened: () => number; sent: string[] } => {
  let n = 0; const sent: string[] = [];
  return { opened: () => n, sent,
    open: async () => { n++; return { ask: async (t: string) => { sent.push(t); return asks.shift() || { text: '' }; },
      allow: async () => { sent.push('allow'); return allows.shift() || { text: '' }; } }; } };
};
const parse = (s: string): string | null => (s.startsWith('{') ? s : null);
const yes = async (): Promise<boolean> => true, no = async (): Promise<boolean> => false;

describe('запрос к помощнику', () => {
  test('ответ — сразу', async () => {
    const p = port([{ text: '{"items":[]}' }]);
    expect(await aiRun(p.open, 'ПЕРЕВІРКА', parse, yes)).toEqual({ ok: true, value: '{"items":[]}' });
    expect(p.opened()).toBe(1);
  });
  test('карточка согласия → «Дозволити» → ответ в том же разговоре', async () => {
    const p = port([{ consent: true }], [{ text: '{"items":[]}' }]);
    expect(await aiRun(p.open, 'ПЕРЕВІРКА', parse, yes)).toEqual({ ok: true, value: '{"items":[]}' });
    expect(p.sent).toEqual(['ПЕРЕВІРКА', 'allow']); expect(p.opened()).toBe(1);
  });
  test('«Скасувати» на карточке — нет дозволу, агенту ничего не отправлено', async () => {
    const p = port([{ consent: true }]);
    expect(await aiRun(p.open, 'x', parse, no)).toEqual({ ok: false, reason: 'declined' });
    expect(p.sent).toEqual(['x']);
  });
  test('повторная карточка после «Дозволити» — ошибка', async () => {
    const p = port([{ consent: true }], [{ consent: true }]);
    expect(await aiRun(p.open, 'x', parse, yes)).toEqual({ ok: false, reason: 'error' });
  });
  test('нет доступа — denied, без повтора', async () => {
    const p = port([{ text: "You don't have access to talk to this bot, contact the owner." }]);
    expect(await aiRun(p.open, 'x', parse, yes)).toEqual({ ok: false, reason: 'denied' });
    expect(p.opened()).toBe(1);
  });
  test('таймаут — timeout', async () => {
    expect(await aiRun(port([{ timeout: true }]).open, 'x', parse, yes)).toEqual({ ok: false, reason: 'timeout' });
  });
  test('исключение (403) — denied; сеть — error', async () => {
    const boom = (m: string) => async (): Promise<AiPort> => { throw new Error(m); };
    expect(await aiRun(boom('Copilot Studio request failed with status 403'), 'x', parse, yes)).toEqual({ ok: false, reason: 'denied' });
    expect(await aiRun(boom('Failed to fetch'), 'x', parse, yes)).toEqual({ ok: false, reason: 'error' });
  });
  test('неразобранный ответ — один повтор в новом разговоре', async () => {
    const p = port([{ text: 'Ось відповідь' }, { text: '{"items":[]}' }]);
    expect(await aiRun(p.open, 'x', parse, yes)).toEqual({ ok: true, value: '{"items":[]}' });
    expect(p.opened()).toBe(2);
  });
  test('дважды неразобранный — error', async () => {
    const p = port([{ text: 'a' }, { text: 'b' }]);
    expect(await aiRun(p.open, 'x', parse, yes)).toEqual({ ok: false, reason: 'error' });
    expect(p.opened()).toBe(2);
  });
});
