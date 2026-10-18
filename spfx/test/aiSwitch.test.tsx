/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { Header } from '../src/webparts/pmoPortal/components/Header';
import { useAiSwitch } from '../src/webparts/pmoPortal/ai/useAiSwitch';
import { aiPref } from '../src/webparts/pmoPortal/ai/aiPref';
import { AiEnableFail } from '../src/webparts/pmoPortal/logic/aiLogin';
import { AiStore } from '../src/webparts/pmoPortal/ai/useAiSwitch';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Переключатель «Помічник ШІ» в меню пользователя (только пилотная группа): согласие — при включении, а не в форме отчёта
const tt = makeT(0);
let root: HTMLDivElement;
let calls: number; let result: AiEnableFail | null; let resumes: boolean[]; let saved: any[];
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); localStorage.clear(); sessionStorage.clear(); calls = 0; result = null; resumes = []; saved = []; });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const flush = async (): Promise<void> => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };

const Harness: React.FC<{ pilot: boolean; store?: AiStore }> = p => {
  const ai = useAiSwitch('PM@x', p.pilot, async resume => { calls++; resumes.push(resume); return result; }, p.store);
  return <AppCtx.Provider value={{ ...tt, lang: 0 } as any}>
    <Header page="home" lang={0} theme="light" userName="PM" userEmail="pm@x" onPage={() => undefined} onLang={() => undefined}
      onTheme={() => undefined} onHelp={() => undefined} ai={ai} />
    <p id="state">{ai ? String(ai.on) : 'none'}</p></AppCtx.Provider>;
};
const mount = (pilot = true, store?: AiStore): void => { act(() => { ReactDOM.render(<Harness pilot={pilot} store={store} />, root); }); };
const storeOf = (row: boolean, prefs: AiStore['prefs']): AiStore => ({ row, prefs, save: async x => { saved.push(x); } });
const $ = (s: string): HTMLElement => document.querySelector(s) as HTMLElement;
const click = (el: Element | null): void => { act(() => { (el as HTMLElement).click(); }); };
const btn = (text: string): HTMLElement => Array.from(document.querySelectorAll('button')).filter(b => b.textContent === text)[0] as HTMLElement;
const sw = (): HTMLElement => $('#ai-switch');

describe('переключатель «Помічник ШІ»', () => {
  test('вне пилота — меню аватара есть (имя, e-mail, язык и тема для телефона), «Помічник ШІ» нет', () => {
    mount(false);
    click($('.me'));
    expect($('#me-pop').textContent).toContain('pm@x');
    expect($('#me-pop .me-prefs').querySelectorAll('.seg').length).toBe(2);
    expect([$('#ai-switch'), $('#state').textContent]).toEqual([null, 'none']);
  });
  test('первое включение — согласие; «Скасувати» — выключен, агент не вызывается', () => {
    mount(); click($('.me'));
    expect([sw().getAttribute('role'), sw().getAttribute('aria-checked')]).toEqual(['switch', 'false']);
    // меню — вне шапки: у шапки backdrop-filter, position:fixed внутри неё считался бы от шапки (меню уезжало вниз)
    expect($('header').contains($('#me-pop'))).toBe(false);
    expect($('#me-pop').textContent).toContain(T.aiSwitchOff[0]);
    click(sw());
    expect($('#me-pop').textContent).toContain(T.aiConsent[0]);
    click(btn(T.cancel[0]));
    expect($('#me-pop').textContent).not.toContain(T.aiConsent[0]);
    expect([sw().getAttribute('aria-checked'), calls, $('#state').textContent]).toEqual(['false', 0, 'false']);
  });
  test('«Дозволити» — служебный вызов агента, включён и запомнен (по e-mail без регистра); повторное включение — без согласия', async () => {
    mount(); click($('.me')); click(sw());
    await act(async () => { btn(T.aiAllow[0]).click(); }); await flush();
    expect([sw().getAttribute('aria-checked'), calls, $('#state').textContent]).toEqual(['true', 1, 'true']);
    expect([aiPref.on('pm@x'), aiPref.consented('pm@x')]).toEqual([true, true]);
    expect($('#me-pop').textContent).toContain(T.aiSwitchOn[0]);
    // новая загрузка страницы — включён
    ReactDOM.unmountComponentAtNode(root); mount();
    expect($('#state').textContent).toBe('true');
    click($('.me')); click(sw());
    expect([sw().getAttribute('aria-checked'), aiPref.on('pm@x'), $('#state').textContent]).toEqual(['false', false, 'false']);
    click(sw());
    expect($('#me-pop').textContent).not.toContain(T.aiConsent[0]);
    expect([sw().getAttribute('aria-checked'), calls]).toEqual(['true', 1]);
  });
  test('ИИ не ответил при включении — остаётся выключенным, причина видна, согласие не запомнено', async () => {
    result = { reason: 'timeout' };
    mount(); click($('.me')); click(sw());
    await act(async () => { btn(T.aiAllow[0]).click(); }); await flush();
    expect([sw().getAttribute('aria-checked'), aiPref.consented('pm@x')]).toEqual(['false', false]);
    expect($('#me-pop .ai-msg.err').textContent).toBe('Не вдалося увімкнути ШІ: ШІ не відповів за 60 с');
  });
  test('окно входа заблокировано — понятная причина', async () => {
    result = { reason: 'error', why: 'popup', code: 'token: popup_window_error' };
    mount(); click($('.me')); click(sw());
    await act(async () => { btn(T.aiAllow[0]).click(); }); await flush();
    expect($('#me-pop .ai-msg.err').textContent).toBe('Не вдалося увімкнути ШІ: вікно входу Microsoft заблоковано — дозвольте спливаючі вікна для сайту');
  });
});

// Значение — у человека (своя строка «Прочитане»), а не у браузера: включили на телефоне — включено и на компьютере
describe('переключатель у человека', () => {
  test('в строке включено, браузер не помнит — включён, без согласия заново', () => {
    mount(true, storeOf(true, { on: true, ok: true }));
    expect($('#state').textContent).toBe('true');
    expect([aiPref.on('pm@x'), aiPref.consented('pm@x')]).toEqual([true, true]);
  });
  test('в строке выключено, браузер помнит включение — выключен', () => {
    aiPref.setOn('pm@x', true); aiPref.setConsented('pm@x', true);
    mount(true, storeOf(true, { on: false, ok: true }));
    expect($('#state').textContent).toBe('false');
  });
  test('строка есть, настройки нет — запомненное браузером переносится в строку', async () => {
    aiPref.setOn('pm@x', true); aiPref.setConsented('pm@x', true);
    mount(true, storeOf(true, null)); await flush();
    expect([$('#state').textContent, saved]).toEqual(['true', [{ on: true, ok: true }]]);
  });
  test('включение и выключение пишутся в строку; строки нет — только браузер', async () => {
    mount(true, storeOf(true, null)); click($('.me')); click(sw());
    await act(async () => { btn(T.aiAllow[0]).click(); }); await flush();
    click(sw()); await flush();
    expect(saved).toEqual([{ on: true, ok: true }, { on: false, ok: true }]);
    ReactDOM.unmountComponentAtNode(root); saved = [];
    mount(true, storeOf(false, null)); click($('.me')); click(sw()); await flush();
    expect([$('#state').textContent, saved]).toEqual(['true', []]);
  });
  test('возврат со входа с переходом на страницу (телефон) — включение продолжается само, только из кэша', async () => {
    aiPref.setPending('pm@x', true);
    mount(); await flush();
    expect([calls, resumes, $('#state').textContent, aiPref.pending('pm@x')]).toEqual([1, [true], 'true', false]);
  });
  test('возврат со входа без входа — выключен, причина видна', async () => {
    aiPref.setPending('pm@x', true); result = { reason: 'error', why: 'login', code: 'token: user_cancelled' };
    mount(); await flush(); click($('.me'));
    expect([$('#state').textContent, $('#me-pop .ai-msg.err').textContent]).toEqual(['false', 'Не вдалося увімкнути ШІ: вхід Microsoft не завершено (код user_cancelled)']);
  });
  test('включение после возврата со входа раньше загрузки данных — прежнее «выключено» строки не откатывает, пишется в строку', async () => {
    aiPref.setPending('pm@x', true);
    mount(true); await flush();
    expect($('#state').textContent).toBe('true');
    act(() => { ReactDOM.render(<Harness pilot store={storeOf(true, { on: false, ok: true })} />, root); }); await flush();
    expect([$('#state').textContent, saved]).toEqual(['true', [{ on: true, ok: true }]]);
  });
  test('включил сейчас — строка, загруженная раньше («выключено»), не откатывает', async () => {
    mount(true, storeOf(true, { on: false, ok: false })); click($('.me')); click(sw());
    await act(async () => { btn(T.aiAllow[0]).click(); }); await flush();
    expect([$('#state').textContent, sw().getAttribute('aria-checked')]).toEqual(['true', 'true']);
  });
  test('записи — по очереди: быстрое «выключить — включить» не переставляется', async () => {
    const order: boolean[] = []; let release: () => void = () => undefined;
    const slow: AiStore = { row: true, prefs: { on: true, ok: true }, save: x => new Promise(r => { if (!order.length) release = () => r(undefined); else r(undefined); order.push(x.on); }) };
    mount(true, slow); click($('.me'));
    click(sw()); click(sw());
    await flush(); expect(order).toEqual([false]);
    release(); await flush(); expect(order).toEqual([false, true]);
  });
  test('«Назад» со страницы входа, Safari вернул страницу из кэша — не «Вмикається…» навсегда', async () => {
    let hang = true;
    const H: React.FC = () => { const ai = useAiSwitch('pm@x', true, () => hang ? new Promise(() => undefined) : Promise.resolve(null));
      return <AppCtx.Provider value={{ ...tt, lang: 0 } as any}><Header page="home" lang={0} theme="light" userName="PM" userEmail="pm@x" onPage={() => undefined}
        onLang={() => undefined} onTheme={() => undefined} onHelp={() => undefined} ai={ai} /></AppCtx.Provider>; };
    act(() => { ReactDOM.render(<H />, root); });
    click($('.me')); click(sw()); await act(async () => { btn(T.aiAllow[0]).click(); }); await flush();
    expect(sw().hasAttribute('disabled')).toBe(true);
    const e = new Event('pageshow') as any; e.persisted = true;
    act(() => { window.dispatchEvent(e); });
    expect(sw().hasAttribute('disabled')).toBe(false);
    hang = false;
  });
});
