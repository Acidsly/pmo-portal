import { T, FLD, EXTRA } from './strings';

/** 0 — українська, 1 — English, 2 — русский (как LI в прототипе). */
export type Lang = 0 | 1 | 2;
export const LANG_CODES = ['uk', 'en', 'ru'];
export const langFromCulture = (name: string): Lang => (/^en/i.test(name) ? 1 : /^ru/i.test(name) ? 2 : 0);

/** t — тексты интерфейса (T), fl — названия полей (FLD); ключа нет — возвращается сам ключ, как в прототипе. */
export function makeT(lang: Lang): { t(k: string): string; fl(k: string): string } {
  return {
    t: k => (T[k] || EXTRA[k] || [k, k, k])[lang],
    fl: k => (FLD[k] || T[k] || [k, k, k])[lang]
  };
}

const KEY = 'pmo-lang';
export function readLang(): Lang | undefined {
  try { const v = localStorage.getItem(KEY); return v === '0' || v === '1' || v === '2' ? (Number(v) as Lang) : undefined; } catch { return undefined; }
}
export function saveLang(l: Lang): void { try { localStorage.setItem(KEY, String(l)); } catch { /* приватный режим браузера */ } }
