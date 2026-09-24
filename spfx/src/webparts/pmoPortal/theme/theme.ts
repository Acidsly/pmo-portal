import './prototype.scss';

export type Theme = 'light' | 'dark' | '';
const KEY = 'pmo-theme';
/** '' — как в системе (prefers-color-scheme), иначе выбор пользователя. */
export function readTheme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : ''; } catch { return ''; }
}
export function saveTheme(v: 'light' | 'dark'): void { try { localStorage.setItem(KEY, v); } catch { /* приватный режим браузера */ } }
