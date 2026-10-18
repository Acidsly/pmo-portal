import { PublicClientApplication, AccountInfo, CacheLookupPolicy } from '@azure/msal-browser';
import { CopilotStudioClient, ConnectionSettings, ScopeHelper } from '@microsoft/agents-copilotstudio-client';
import { AI_CONFIG, AI_RETURN_KEY, aiRedirectUri } from './aiConfig';
import { aiLoginMode, AiLoginMode } from '../logic/aiLogin';
import { AiPort } from './aiRun';
import { AiCallOut } from '../logic/aiFlow';

/** Вызов агента Copilot Studio из браузера от имени пользователя: вход MSAL (SPA «PPM Copilot Client»), токен Power Platform API,
 *  разговор через SDK агентов. Модуль загружается отдельным чанком только у пилотной группы. */

const settings = (): ConnectionSettings => new ConnectionSettings({ environmentId: AI_CONFIG.environmentId, schemaName: AI_CONFIG.schemaName });
export const aiScope = (): string => ScopeHelper.getScopeFromSettings(settings());

let msal: PublicClientApplication | undefined;
let init: Promise<PublicClientApplication> | undefined;
/** Кэш входа — localStorage: вход сохраняется между вкладками и перезапусками браузера (с sessionStorage каждая новая
 *  вкладка начинала со входа без окна, а он на телефоне не работает). */
function app(): Promise<PublicClientApplication> {
  if (!init) {
    const a = new PublicClientApplication({ auth: { clientId: AI_CONFIG.clientId, authority: `https://login.microsoftonline.com/${AI_CONFIG.tenantId}`,
      redirectUri: aiRedirectUri(window.location.origin, window.location.pathname) }, cache: { cacheLocation: 'localStorage' } });
    init = a.initialize().then(() => { msal = a; return a; }, e => { init = undefined; throw e; });
  }
  return init;
}
/** Подготовка заранее (при загрузке приложения у пилота): окно входа должно открываться сразу по нажатию — без загрузки
 *  модуля и инициализации MSAL между нажатием и окном (иначе браузер его блокирует: «включилось со второго раза»). */
export const aiReady = async (): Promise<void> => { await app(); };
/** Вход на этом устройстве: всплывающее окно (компьютер) или переход на страницу Microsoft (телефон, планшет). */
export const aiDeviceMode = (): AiLoginMode => aiLoginMode(navigator.userAgent, navigator.platform, navigator.maxTouchPoints || 0);

/** Вход с переходом на страницу: адрес возврата (приложение с его разделом) — в sessionStorage; страница Microsoft вернёт
 *  на Portal.aspx, там PmoPortalWebPart вызовет aiHandleRedirect. Обещание не завершается — страница уходит. */
async function redirect(a: PublicClientApplication, email: string): Promise<never> {
  try { sessionStorage.setItem(AI_RETURN_KEY, window.location.href); } catch { /* приватный режим: вернёмся на главную */ }
  const go = (): Promise<void> => a.acquireTokenRedirect({ scopes: [aiScope()], loginHint: email });
  try { await go(); }
  catch (e) {
    // прежний вход брошен («Назад» со страницы Microsoft): MSAL всё ещё считает его начатым — сбросить и войти заново
    if (!/interaction_in_progress/.test(String((e as Error)?.message || e))) { try { sessionStorage.removeItem(AI_RETURN_KEY); } catch { /* */ } throw e; }
    await a.handleRedirectPromise({ navigateToLoginRequestUrl: false }).catch(() => null);
    try { await go(); } catch (x) { try { sessionStorage.removeItem(AI_RETURN_KEY); } catch { /* */ } throw x; }
  }
  return new Promise<never>(() => undefined);
}
export const aiSignIn = async (email: string): Promise<void> => { await redirect(await app(), email); };

let redirectErr = '';
/** Ошибка последнего возврата со входа (отменён, AADSTS…) — для причины сбоя включения. */
export const aiRedirectError = (): string => redirectErr;
/** Страница открылась как возврат со входа Microsoft (вход с переходом): MSAL разбирает ответ и кладёт токен в кэш,
 *  адрес — снова приложение с прежним разделом. */
export async function aiHandleRedirect(): Promise<void> {
  let ret = '';
  try { ret = sessionStorage.getItem(AI_RETURN_KEY) || ''; sessionStorage.removeItem(AI_RETURN_KEY); } catch { ret = ''; }
  try { await (await app()).handleRedirectPromise({ navigateToLoginRequestUrl: false }); redirectErr = ''; }
  catch (e) { redirectErr = String((e as Error)?.message || e); }
  const back = ret.indexOf(window.location.origin + '/') === 0 ? ret : window.location.pathname;
  try { window.history.replaceState(null, '', back); } catch { /* адрес остаётся с ответом входа */ }
}

/** Токен для агента. Сначала — кэш (токен или токен обновления, без скрытого фрейма: он долгий и на телефоне не работает).
 *  cache — только кэш (проверка формы на телефоне, возврат со входа); silent — дальше вход без окна (ssoSilent);
 *  interactive — сразу окно входа (компьютер) или переход на страницу Microsoft (телефон; before — перед уходом). */
export async function aiToken(email: string, log: (s: string) => void, how: 'cache' | 'silent' | 'interactive' = 'interactive', before?: () => void): Promise<string> {
  if (!AI_CONFIG.clientId || !AI_CONFIG.tenantId) throw new Error('Не заповнено clientId / tenantId (блок 4: реєстрація програми)');
  // MSAL уже готов (aiReady) — без await до окна входа
  const a = msal || (await app()); const scopes = [aiScope()];
  const acc: AccountInfo | undefined = a.getAllAccounts().filter(x => (x.username || '').toLowerCase() === email.toLowerCase())[0];
  if (acc) {
    try { log('MSAL: acquireTokenSilent'); return (await a.acquireTokenSilent({ scopes, account: acc, cacheLookupPolicy: CacheLookupPolicy.AccessTokenAndRefreshToken })).accessToken; }
    catch (e) { log('MSAL silent: ' + String((e as Error).message || e)); }
  }
  if (how === 'cache') throw new Error('no_tokens_found: нет входа на этом устройстве');
  if (how === 'silent') { log('MSAL: ssoSilent'); return (await a.ssoSilent({ scopes, loginHint: email })).accessToken; }
  if (aiDeviceMode() === 'redirect') { log('MSAL: redirect'); if (before) before(); return redirect(a, email); }
  log('MSAL: popup'); return (await a.acquireTokenPopup({ scopes, loginHint: email })).accessToken;
}

/** Разговор с агентом: начать и отправить текст; ответ — тексты сообщений агента и время. */
export interface AiTurn { texts: string[]; ms: number; types: string[]; raw: string; consent?: Record<string, unknown> }
/** Карточка согласия prompt («aiPrompt/consentCard»): данные кнопки «Allow», чтобы отправить согласие от имени пользователя. */
const allowOf = (acts: unknown[]): Record<string, unknown> | undefined => {
  let found: Record<string, unknown> | undefined;
  const walk = (o: unknown): void => {
    if (found || !o || typeof o !== 'object') return;
    const r = o as Record<string, unknown>; const d = r.data as Record<string, unknown> | undefined;
    if (r.type === 'Action.Submit' && d && d.action === 'Allow') { found = d; return; }
    Object.keys(r).forEach(k => walk(r[k]));
  };
  acts.filter(a => (a as Record<string, unknown>).name === 'aiPrompt/consentCard').forEach(walk);
  return found;
};
/** Сырые активности ответа (для проверки: где лежит текст) — без служебных идентификаторов, урезано. */
const rawOf = (acts: unknown[]): string => JSON.stringify(acts.map(a => {
  const { type, text, name, valueType, value, attachments, entities, channelData, textFormat } = a as Record<string, unknown>;
  return { type, text, name, valueType, value, attachments, entities, channelData, textFormat };
})).slice(0, 4000);
export class AiConversation {
  private client: CopilotStudioClient; private id = '';
  /** Номер разговора Copilot Studio (след сбоя, стенограмма в Dataverse). */
  public get conversationId(): string { return this.id; }
  public constructor(token: string) { this.client = new CopilotStudioClient(settings(), token); }
  public async start(): Promise<AiTurn> {
    const t0 = Date.now(); const r = await this.client.startConversationWithResponse(true);
    this.id = r.conversationId;
    return { texts: r.activities.filter(x => x.type === 'message').map(x => x.text || ''), types: r.activities.map(x => x.type), raw: rawOf(r.activities), ms: Date.now() - t0 };
  }
  public async send(text: string): Promise<AiTurn> {
    const t0 = Date.now();
    // простой объект активности: SDK сериализует его в JSON (браузерная сборка SDK класс Activity не экспортирует)
    const act = { type: 'message', text } as unknown as Parameters<CopilotStudioClient['executeWithResponse']>[0];
    return this.exec(act, t0);
  }
  /** Ответ на карточку (Action.Submit): активность-сообщение со значением кнопки. */
  public async sendValue(value: Record<string, unknown>): Promise<AiTurn> {
    const t0 = Date.now();
    const act = { type: 'message', value } as unknown as Parameters<CopilotStudioClient['executeWithResponse']>[0];
    return this.exec(act, t0);
  }
  private async exec(act: Parameters<CopilotStudioClient['executeWithResponse']>[0], t0: number): Promise<AiTurn> {
    const r = await this.client.executeWithResponse(act, this.id);
    return { texts: r.activities.filter(x => x.type === 'message').map(x => x.text || ''), types: r.activities.map(x => x.type), raw: rawOf(r.activities),
      consent: allowOf(r.activities), ms: Date.now() - t0 };
  }
}

/** Разговор для формы отчёта (AiPort, ai/aiRun.ts): ответ — последнее непустое сообщение агента; карточка согласия prompt —
 *  { consent }, значение её кнопки «Allow» запоминается для allow(); нет ответа timeoutMs — { timeout } (запрос не отменяется,
 *  но разговор больше не используется: новый разговор на каждый запрос). */
export class AiSession implements AiPort {
  private allowValue: Record<string, unknown> | undefined;
  private constructor(private conv: AiConversation, private timeoutMs: number) {}
  public get id(): string { return this.conv.conversationId; }
  public static async open(token: string, timeoutMs: number = 60000): Promise<AiSession> {
    const c = new AiConversation(token); await c.start(); return new AiSession(c, timeoutMs);
  }
  private async wrap(p: Promise<AiTurn>): Promise<AiCallOut> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), this.timeoutMs); });
    try {
      const r = await Promise.race([p, late]);
      if (r === 'timeout') return { timeout: true };
      if (r.consent) { this.allowValue = r.consent; return { consent: true }; }
      return { text: r.texts.filter(t => !!(t || '').trim()).pop() || '' };
    } finally { if (timer) clearTimeout(timer); }
  }
  public ask(text: string): Promise<AiCallOut> { return this.wrap(this.conv.send(text)); }
  public allow(): Promise<AiCallOut> { return this.allowValue ? this.wrap(this.conv.sendValue(this.allowValue)) : Promise.resolve({ error: 'no consent card' }); }
}
