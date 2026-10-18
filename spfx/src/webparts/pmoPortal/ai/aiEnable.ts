import { aiMessage } from '../logic/aiEval';
import { AiEnableFail, aiTokenWhy } from '../logic/aiLogin';
import { aiRun, AiTrace } from './aiRun';

type Agent = typeof import('./aiAgent');
let mod: Agent | undefined;
let loading: Promise<Agent> | undefined;
/** Модуль агента и MSAL — заранее, при загрузке приложения у пилота: окно входа открывается сразу по нажатию «Дозволити». */
export function aiPreload(): Promise<Agent> {
  if (!loading) {
    loading = import(/* webpackChunkName: 'pmo-ai' */ './aiAgent').then(async m => { await m.aiReady(); mod = m; return m; },
      e => { loading = undefined; throw e; });
  }
  return loading;
}
const msg = (e: unknown): string => String((e as Error)?.message || e || 'error');

/** Включение помощника после «Дозволити» (согласие PM — при включении, а не в форме отчёта): вход Microsoft и короткий
 *  служебный вызов «Перевірки» с пустыми данными — карточка согласия Copilot Studio подтверждается здесь же, от имени PM.
 *  resume — возврат со входа с переходом на страницу (телефон): только кэш, без нового входа. pending — перед уходом на
 *  страницу Microsoft (запомнить, что включение продолжится после возврата). Сбой сервиса — один повтор. Результат — null
 *  (готово) или причина с кодом. */
export async function aiEnable(email: string, lang: string, resume: boolean, pending: () => void): Promise<AiEnableFail | null> {
  const t0 = Date.now();
  let m = mod;
  if (!m) { try { m = await aiPreload(); } catch (e) { return { reason: 'error', code: 'load: ' + msg(e).slice(0, 100), ms: Date.now() - t0 }; } }
  let token: string;
  try { token = await m.aiToken(email, () => undefined, resume ? 'cache' : 'interactive', pending); }
  catch (e) {
    // возврат со входа: причина — ответ Microsoft (отменён, AADSTS…), а не «нет входа без окна»
    const s = (resume && m.aiRedirectError()) || msg(e);
    return { reason: 'error', why: resume && m.aiRedirectError() ? 'login' : aiTokenWhy(s), code: 'token: ' + s.slice(0, 100), ms: Date.now() - t0 };
  }
  const agent = m, text = aiMessage('check', JSON.stringify({ lang, project: { code: '', title: '' }, mention: [] }));
  let trace: AiTrace = {};
  let r = await aiRun(() => agent.AiSession.open(token), text, () => true, () => Promise.resolve(true), trace);
  if (!r.ok && r.reason === 'error') { trace = {}; r = await aiRun(() => agent.AiSession.open(token), text, () => true, () => Promise.resolve(true), trace); }
  return r.ok ? null : { reason: r.reason, code: trace.code, conv: trace.conv, ms: trace.ms ?? Date.now() - t0 };
}
