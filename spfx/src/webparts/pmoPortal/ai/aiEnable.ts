import { AiUnavailable } from '../logic/aiCheck';
import { aiMessage } from '../logic/aiEval';
import { aiRun } from './aiRun';

type Agent = typeof import('./aiAgent');
/** Включение помощника после «Дозволити» (согласие PM — при включении, а не в форме отчёта): вход MSAL и короткий служебный
 *  вызов «Перевірки» с пустыми данными — карточка согласия Copilot Studio подтверждается здесь же, от имени PM. Результат —
 *  null (готово) или причина, почему ИИ недоступен. */
export async function aiEnable(email: string, lang: string): Promise<AiUnavailable | null> {
  let m: Agent;
  try { m = await import(/* webpackChunkName: 'pmo-ai' */ './aiAgent'); } catch { return 'error'; }
  let token: string;
  try { token = await m.aiToken(email, () => undefined); } catch { return 'error'; }
  const r = await aiRun(() => m.AiSession.open(token), aiMessage('check', JSON.stringify({ lang, project: { code: '', title: '' }, mention: [] })),
    () => true, () => Promise.resolve(true));
  return r.ok ? null : r.reason;
}
