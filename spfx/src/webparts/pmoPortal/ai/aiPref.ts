/** Помощник ИИ у пилотной группы (план этапа 4): включён ли и дано ли согласие на обработку данных — в браузере человека,
 *  отдельно по e-mail (как тема и язык). Нет хранилища (приватный режим) — выключен, согласия нет. */
const ON = 'pmo-ai-on:', OK = 'pmo-ai-consent:';
const key = (k: string, email: string): string => k + (email || '').trim().toLowerCase();
const get = (k: string): boolean => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const put = (k: string, v: boolean): void => { try { if (v) localStorage.setItem(k, '1'); else localStorage.removeItem(k); } catch { /* приватный режим */ } };
export const aiPref = {
  on: (email: string): boolean => get(key(ON, email)),
  consented: (email: string): boolean => get(key(OK, email)),
  setOn: (email: string, v: boolean): void => put(key(ON, email), v),
  setConsented: (email: string, v: boolean): void => put(key(OK, email), v)
};
