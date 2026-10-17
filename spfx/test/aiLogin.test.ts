import { aiLoginMode, aiTokenWhy, aiEnableNote } from '../src/webparts/pmoPortal/logic/aiLogin';
import { aiPrefsOf, withAiPrefs, aiPrefsMerge } from '../src/webparts/pmoPortal/logic/aiPrefs';
import { aiFailFeedback } from '../src/webparts/pmoPortal/logic/aiFeedback';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';

// Включение помощника ИИ (исправление 17.10.2026): на телефоне — вход с переходом на страницу, понятная причина сбоя,
// переключатель и согласие — у человека (своя строка «Прочитане»), а не у браузера
describe('способ входа Microsoft', () => {
  test.each([
    ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', 'iPhone', 5, 'redirect'],
    ['iPad (выдаёт себя за Mac)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 'MacIntel', 5, 'redirect'],
    ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36', 'Linux armv8l', 5, 'redirect'],
    ['Mac Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 'MacIntel', 0, 'popup'],
    ['Windows Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36', 'Win32', 0, 'popup']
  ])('%s', (_, ua, platform, touch, out) => expect(aiLoginMode(ua as string, platform as string, touch as number)).toBe(out));
});

describe('почему не получен токен', () => {
  test.each([
    ['popup_window_error: Error opening popup window', 'popup'],
    ['empty_window_error', 'popup'],
    ['login_required: AADSTS50058: A silent sign-in request was sent', 'signin'],
    ['interaction_required', 'signin'],
    ['no_account_error', 'signin'],
    ['user_cancelled: User cancelled the flow', 'login'],
    ['AADSTS50011: The redirect URI', 'login']
  ])('%s → %s', (msg, out) => expect(aiTokenWhy(msg)).toBe(out));
});

describe('текст сбоя включения', () => {
  const tt = makeT(0);
  test('причина ИИ — без «Перевірку ШІ не виконано»', () =>
    expect(aiEnableNote({ reason: 'timeout' }, tt.t, 'uk')).toBe('Не вдалося увімкнути ШІ: ШІ не відповів за 60 с'));
  test('окно входа заблокировано; вход не завершён — с безопасным кодом', () => {
    expect(aiEnableNote({ reason: 'error', why: 'popup', code: 'token: popup_window_error' }, tt.t, 'uk'))
      .toBe('Не вдалося увімкнути ШІ: вікно входу Microsoft заблоковано — дозвольте спливаючі вікна для сайту');
    expect(aiEnableNote({ reason: 'error', why: 'login', code: 'token: AADSTS50011: user a@b.c' }, tt.t, 'uk'))
      .toBe('Не вдалося увімкнути ШІ: вхід Microsoft не завершено (код AADSTS50011)');
    expect(aiEnableNote({ reason: 'error', why: 'signin' }, tt.t, 'uk')).toBe('Не вдалося увімкнути ШІ: потрібно увійти до Microsoft — натисніть ще раз');
  });
  test('ошибка сервиса — код Copilot Studio', () =>
    expect(aiEnableNote({ reason: 'error', code: 'AIModelActionBadRequest' }, tt.t, 'uk')).toBe('Не вдалося увімкнути ШІ: помилка сервісу ШІ (код AIModelActionBadRequest)'));
});

describe('настройка ИИ у человека (поле nsPrefs своей строки «Прочитане»)', () => {
  test('чтение: пусто и мусор — не задано; прочие ключи сохраняются при записи', () => {
    expect([aiPrefsOf(''), aiPrefsOf('{'), aiPrefsOf('[1]'), aiPrefsOf('{"x":1}')]).toEqual([null, null, null, null]);
    expect(aiPrefsOf('{"ai":1,"aiOk":1}')).toEqual({ on: true, ok: true });
    expect(aiPrefsOf('{"ai":0,"aiOk":1}')).toEqual({ on: false, ok: true });
    expect(JSON.parse(withAiPrefs('{"x":"y","ai":1}', { on: false, ok: true }))).toEqual({ x: 'y', ai: 0, aiOk: 1 });
    expect(JSON.parse(withAiPrefs('мусор', { on: true, ok: true }))).toEqual({ ai: 1, aiOk: 1 });
  });
  const off = { on: false, ok: false }, on = { on: true, ok: true };
  test.each([
    ['строки ещё нет (синхронизация не создала) — браузер', off, on, null, false, on, false],
    ['в строке задано — оно, даже если браузер помнит иное (включили на телефоне)', on, off, on, true, on, false],
    ['выключили на другом устройстве', off, on, off, true, off, false],
    ['строка есть, настройки нет, браузер помнит включение — переносится в строку', off, on, null, true, on, true],
    ['строка есть, ничего не задано — выключено, писать нечего', off, off, null, true, off, false]
  ])('%s', (_, _cur, local, server, row, value, push) =>
    expect(aiPrefsMerge(local as any, server as any, row as boolean)).toEqual({ value, push }));
});

describe('автоотзыв о сбое включения', () => {
  test('вид «Увімкнення», без проекта, экран — главная', () => {
    const f = aiFailFeedback({ kind: 'enable', reason: 'error', code: 'token: popup_window_error', conv: '', ms: 1200, project: '', version: '1.7.4.3', at: '2026-10-17T09:00:00Z' });
    expect(f.Title).toBe('Помилка ШІ (автоматично): «Увімкнення» — помилка сервісу ШІ');
    expect(f.fbText).toBe('Помилка ШІ (автоматично): «Увімкнення» — помилка сервісу ШІ.\nКод: token: popup\nТривалість: 1,2 с\nВерсія: 1.7.4.3\nЧас (UTC): 2026-10-17 09:00');
    expect(f.fbScreen).toBe('#home');
  });
});
