import { aiFailInfo, aiFailFeedback, aiFailAllowed, aiSafeCode } from '../src/webparts/pmoPortal/logic/aiFeedback';
import { aiRun, AiPort, AiTrace } from '../src/webparts/pmoPortal/ai/aiRun';

// Сбой помощника ИИ — автоматический отзыв (тестовый сайт, список «Відгуки»): только техника, без данных отчёта —
// текст отзыва видят все в «Відгуки — загальні»; по номеру разговора — стенограмма в Copilot Studio
describe('сведения об ошибке Copilot Studio', () => {
  test('код ошибки и номер разговора — из текста ответа агента', () => {
    expect(aiFailInfo('An error has occurred.\nError code: AIModelActionBadRequest\nConversation Id: 613472b0-bc34-4cbb-b32e-c2adf3ac2797\nTime (UTC): 2026-10-14T11:33:53.962Z.'))
      .toEqual({ code: 'AIModelActionBadRequest', conv: '613472b0-bc34-4cbb-b32e-c2adf3ac2797' });
    expect(aiFailInfo('AccessToBotDenied: you don\'t have access')).toEqual({ code: 'AccessToBotDenied', conv: '' });
    expect(aiFailInfo('немає відповіді')).toEqual({ code: '', conv: '' });
  });
});

describe('код в отзыве — только из белого списка (текст исключений MSAL / SDK может содержать учётную запись и тенант)', () => {
  test.each([
    ['AIModelActionBadRequest', 'AIModelActionBadRequest'],
    ['token: AADSTS50011: The redirect URI https://smarthrua.sharepoint.com/sites/pmo-test for user j.pochobut@eclectic.group', 'token: AADSTS50011'],
    ['token: popup_window_error: Error opening popup window', 'token: popup'],
    ['token: interaction_required: user ivan@x.com', 'token: popup'],
    ['Failed to fetch', 'network'],
    ['[-140032] - Copilot Studio request failed with status 403 tenant faa553e4', 'http 403'],
    ['load: ChunkLoadError: Loading chunk pmo-ai failed (https://x/y.js)', 'load: network'],
    ['timeout', 'timeout'], ['unparsed', 'unparsed'], ['AccessToBotDenied', 'AccessToBotDenied'],
    ['Something odd for user a@b.c', 'exception'], ['', '']
  ])('%s → %s', (raw, out) => expect(aiSafeCode(raw)).toBe(out));
  test('в тексте отзыва — безопасный код', () => {
    const f = aiFailFeedback({ kind: 'check', reason: 'error', code: 'token: AADSTS50011: user j.pochobut@eclectic.group', conv: '', ms: 10, project: 'PRJ-001', version: '1', at: '2026-10-14T11:33:53Z' });
    expect(f.fbText).toContain('Код: token: AADSTS50011\n'); expect(f.fbText).not.toContain('@');
  });
});

describe('текст отзыва', () => {
  const x = { kind: 'check' as const, reason: 'error' as const, code: 'AIModelActionBadRequest', conv: 'abc-1', ms: 2140, project: 'PRJ-001', version: '1.7.3.11', at: '2026-10-14T11:33:53Z' };
  test('техника без данных отчёта; заголовок с видом запроса и причиной', () => {
    const f = aiFailFeedback(x);
    expect(f.Title).toBe('Помилка ШІ (автоматично): «Перевірка» — помилка сервісу ШІ');
    expect(f.fbText).toBe('Помилка ШІ (автоматично): «Перевірка» — помилка сервісу ШІ.\nКод: AIModelActionBadRequest\nРозмова: abc-1\nТривалість: 2,1 с\nПроєкт: PRJ-001\nВерсія: 1.7.3.11\nЧас (UTC): 2026-10-14 11:33');
    expect(f.fbScreen).toBe('#reports///report');
  });
  test('нет кода и разговора — строк нет; «Чернетка» и таймаут', () => {
    const f = aiFailFeedback({ ...x, kind: 'draft', reason: 'timeout', code: '', conv: '', ms: 60000 });
    expect(f.fbText).toBe('Помилка ШІ (автоматично): «Чернетка» — ШІ не відповів за 60 с.\nТривалість: 60,0 с\nПроєкт: PRJ-001\nВерсія: 1.7.3.11\nЧас (UTC): 2026-10-14 11:33');
  });
});

describe('не чаще одного отзыва в день на причину и вид запроса', () => {
  test('первый — да; тот же день — нет; другая причина или другой день — да', () => {
    const sent: Record<string, string> = {};
    expect(aiFailAllowed(sent, 'check:error', '2026-10-14')).toBe(true);
    sent['check:error'] = '2026-10-14';
    expect(aiFailAllowed(sent, 'check:error', '2026-10-14')).toBe(false);
    expect(aiFailAllowed(sent, 'check:timeout', '2026-10-14')).toBe(true);
    expect(aiFailAllowed(sent, 'check:error', '2026-10-15')).toBe(true);
  });
});

describe('след запроса (aiRun)', () => {
  const port = (out: object): () => Promise<AiPort> => async () => ({ id: 'conv-7', ask: async () => out as any, allow: async () => ({ text: '' }) });
  test('ошибка агента — номер разговора и код в следе', async () => {
    const tr: AiTrace = {};
    const r = await aiRun(port({ text: 'An error has occurred.\nError code: AIModelActionBadRequest\nConversation Id: conv-7' }), 'x', () => null, async () => true, tr);
    expect(r).toEqual({ ok: false, reason: 'error' });
    expect([tr.conv, tr.code]).toEqual(['conv-7', 'AIModelActionBadRequest']);
  });
  test('нераспознанный ответ дважды — код «unparsed»', async () => {
    const tr: AiTrace = {};
    await aiRun(port({ text: 'текст' }), 'x', () => null, async () => true, tr);
    expect([tr.conv, tr.code]).toEqual(['conv-7', 'unparsed']);
  });
  test('подключение подвисло — timeout (переключатель и форма не остаются «занятыми»)', async () => {
    const tr: AiTrace = {};
    const r = await aiRun(() => new Promise<AiPort>(() => undefined), 'x', () => null, async () => true, tr, 20);
    expect([r, tr.code]).toEqual([{ ok: false, reason: 'timeout' }, 'timeout']);
  });
  test('исключение при подключении — текст исключения в коде (без данных), разговора нет', async () => {
    const tr: AiTrace = {};
    await aiRun(async () => { throw new Error('Failed to fetch'); }, 'x', () => null, async () => true, tr);
    expect([tr.conv || '', tr.code]).toEqual(['', 'Failed to fetch']);
  });
});
