/** Помощник ИИ у пилотной группы (план этапа 4): включён ли и дано ли согласие — в браузере, отдельно по e-mail. Это копия:
 *  настоящее значение — у человека, в своей строке «Прочитане» (logic/aiPrefs.ts, ai/useAiSwitch.ts); браузер — до загрузки
 *  данных и пока строки нет. Нет хранилища (приватный режим) — выключен, согласия нет. */
const ON = 'pmo-ai-on:', OK = 'pmo-ai-consent:', PENDING = 'pmo-ai-pending:';
const key = (k: string, email: string): string => k + (email || '').trim().toLowerCase();
const get = (k: string): boolean => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const put = (k: string, v: boolean): void => { try { if (v) localStorage.setItem(k, '1'); else localStorage.removeItem(k); } catch { /* приватный режим */ } };
export const aiPref = {
  on: (email: string): boolean => get(key(ON, email)),
  consented: (email: string): boolean => get(key(OK, email)),
  setOn: (email: string, v: boolean): void => put(key(ON, email), v),
  setConsented: (email: string, v: boolean): void => put(key(OK, email), v),
  /** Включение ушло на вход с переходом на страницу (телефон) — продолжить после возврата; только эта вкладка. */
  pending: (email: string): boolean => { try { return sessionStorage.getItem(key(PENDING, email)) === '1'; } catch { return false; } },
  setPending: (email: string, v: boolean): void => {
    try { if (v) sessionStorage.setItem(key(PENDING, email), '1'); else sessionStorage.removeItem(key(PENDING, email)); } catch { /* приватный режим */ }
  }
};
