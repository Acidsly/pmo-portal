/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { Header } from '../src/webparts/pmoPortal/components/Header';
import { useAiSwitch } from '../src/webparts/pmoPortal/ai/useAiSwitch';
import { aiPref } from '../src/webparts/pmoPortal/ai/aiPref';
import { AiUnavailable } from '../src/webparts/pmoPortal/logic/aiCheck';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Переключатель «Помічник ШІ» в меню пользователя (только пилотная группа): согласие — при включении, а не в форме отчёта
const tt = makeT(0);
let root: HTMLDivElement;
let calls: number; let result: AiUnavailable | null;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); localStorage.clear(); calls = 0; result = null; });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const flush = async (): Promise<void> => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };

const Harness: React.FC<{ pilot: boolean }> = p => {
  const ai = useAiSwitch('PM@x', p.pilot, async () => { calls++; return result; });
  return <AppCtx.Provider value={{ ...tt, lang: 0 } as any}>
    <Header page="home" lang={0} theme="light" userName="PM" userEmail="pm@x" onPage={() => undefined} onLang={() => undefined}
      onTheme={() => undefined} onHelp={() => undefined} ai={ai} />
    <p id="state">{ai ? String(ai.on) : 'none'}</p></AppCtx.Provider>;
};
const mount = (pilot = true): void => { act(() => { ReactDOM.render(<Harness pilot={pilot} />, root); }); };
const $ = (s: string): HTMLElement => document.querySelector(s) as HTMLElement;
const click = (el: Element | null): void => { act(() => { (el as HTMLElement).click(); }); };
const btn = (text: string): HTMLElement => Array.from(document.querySelectorAll('button')).filter(b => b.textContent === text)[0] as HTMLElement;
const sw = (): HTMLElement => $('#ai-switch');

describe('переключатель «Помічник ШІ»', () => {
  test('вне пилота — у аватара нет меню', () => {
    mount(false);
    click($('.me'));
    expect($('#me-pop')).toBeNull(); expect($('#state').textContent).toBe('none');
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
    result = 'timeout';
    mount(); click($('.me')); click(sw());
    await act(async () => { btn(T.aiAllow[0]).click(); }); await flush();
    expect([sw().getAttribute('aria-checked'), aiPref.consented('pm@x')]).toEqual(['false', false]);
    expect($('#me-pop .ai-msg.err').textContent).toBe('Перевірку ШІ не виконано: ШІ не відповів за 60 с');
  });
});
