import { AiUnavailable, AiLang, unavailableNote } from './aiCheck';
import { aiSafeCode } from './aiFeedback';

/** Вход Microsoft для помощника ИИ (исправление 17.10.2026). На телефоне и планшете всплывающее окно и вход без окна
 *  (скрытый фрейм) не работают — Safari блокирует окно, открытое не сразу по нажатию, и сторонние cookie: там вход
 *  с переходом на страницу Microsoft и обратно. На компьютере — всплывающее окно сразу по нажатию. */
export type AiLoginMode = 'popup' | 'redirect';
/** iPad в Safari выдаёт себя за Mac — отличается касаниями. */
export const aiLoginMode = (ua: string, platform: string, touch: number): AiLoginMode =>
  /iPhone|iPad|iPod|Android|Mobile/i.test(ua || '') || (platform === 'MacIntel' && touch > 1) ? 'redirect' : 'popup';

/** Почему не получен токен: popup — браузер заблокировал окно входа; signin — входа без окна нет (нужно войти);
 *  login — вход начат, но не завершён (отменён, ошибка Microsoft AADSTS…). */
export type AiTokenWhy = 'popup' | 'login' | 'signin';
export function aiTokenWhy(msg: string): AiTokenWhy {
  const s = String(msg || '');
  if (/popup_window_error|empty_window_error|popup.*block|blocked.*popup/i.test(s)) return 'popup';
  if (/no_account|login_required|interaction_required|consent_required|no_tokens_found|silent/i.test(s)) return 'signin';
  return 'login';
}

/** Сбой включения: причина ИИ, а для входа — почему не получен токен; код и разговор — для автоотзыва. */
export interface AiEnableFail { reason: AiUnavailable; why?: AiTokenWhy; code?: string; conv?: string; ms?: number }

const WHY: Record<AiTokenWhy, string> = { popup: 'aiPopup', login: 'aiLoginFail', signin: 'aiSignInAgain' };
/** Текст под переключателем: «Не вдалося увімкнути ШІ: <причина>» и безопасный код (без учётных записей и адресов). */
export function aiEnableNote(f: AiEnableFail, t: (k: string) => string, lang: AiLang): string {
  const why = f.why ? t(WHY[f.why]) : unavailableNote(f.reason, lang).replace(/^[^:]*:\s*/, '');
  const code = f.why === 'popup' || f.why === 'signin' ? '' : aiSafeCode(f.code || '').replace(/^(token|load):\s*/, '');
  return t('aiEnableFail') + why + (code && code !== 'exception' && code !== 'timeout' ? ` (${t('aiCode')} ${code})` : '');
}
