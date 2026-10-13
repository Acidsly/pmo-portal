import { PublicClientApplication, InteractionRequiredAuthError, AccountInfo } from '@azure/msal-browser';
import { CopilotStudioClient, ConnectionSettings, ScopeHelper } from '@microsoft/agents-copilotstudio-client';
import { AI_CONFIG } from './aiConfig';

/** Вызов агента Copilot Studio из браузера от имени пользователя: вход MSAL (SPA «PPM Copilot Client»), токен Power Platform API,
 *  разговор через SDK агентов. Модуль загружается отдельным чанком только у пилотной группы. */

const settings = (): ConnectionSettings => new ConnectionSettings({ environmentId: AI_CONFIG.environmentId, schemaName: AI_CONFIG.schemaName });
export const aiScope = (): string => ScopeHelper.getScopeFromSettings(settings());

let msal: PublicClientApplication | undefined;
async function app(): Promise<PublicClientApplication> {
  if (!msal) {
    msal = new PublicClientApplication({ auth: { clientId: AI_CONFIG.clientId, authority: `https://login.microsoftonline.com/${AI_CONFIG.tenantId}`,
      redirectUri: window.location.origin + window.location.pathname }, cache: { cacheLocation: 'sessionStorage' } });
    await msal.initialize();
  }
  return msal;
}

/** Токен для агента: сначала без окна (уже вошли / сеанс Microsoft 365), иначе — всплывающее окно входа. */
export async function aiToken(email: string, log: (s: string) => void): Promise<string> {
  if (!AI_CONFIG.clientId || !AI_CONFIG.tenantId) throw new Error('Не заповнено clientId / tenantId (блок 4: реєстрація програми)');
  const a = await app(); const scopes = [aiScope()];
  const acc: AccountInfo | undefined = a.getAllAccounts().filter(x => (x.username || '').toLowerCase() === email.toLowerCase())[0];
  if (acc) {
    try { log('MSAL: acquireTokenSilent'); return (await a.acquireTokenSilent({ scopes, account: acc })).accessToken; }
    catch (e) { if (!(e instanceof InteractionRequiredAuthError)) log('MSAL silent: ' + String((e as Error).message || e)); }
  }
  try { log('MSAL: ssoSilent'); const r = await a.ssoSilent({ scopes, loginHint: email }); return r.accessToken; }
  catch (e) { log('MSAL ssoSilent: ' + String((e as Error).message || e)); }
  log('MSAL: loginPopup'); const r = await a.acquireTokenPopup({ scopes, loginHint: email });
  return r.accessToken;
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
