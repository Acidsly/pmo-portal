import { AiUnavailable } from '../logic/aiCheck';
import { aiFailFeedback, aiFailAllowed, AiFailKind } from '../logic/aiFeedback';
import { RELEASES } from '../help/releases';
import { AiTrace } from './aiRun';

/** Сбой помощника — автоматический отзыв «Помилка ШІ (автоматично)» (список «Відгуки» есть только на тестовом сайте):
 *  техника без данных отчёта, не чаще одного в день на вид запроса и причину (отметки — в браузере); «Скасувати»
 *  в согласии — не сбой. */
export function aiReportFail(x: { create(list: 'Feedback', body: Record<string, unknown>): Promise<unknown>; can: boolean; me: string; today: string;
  kind: AiFailKind; reason: AiUnavailable; why?: string; trace: AiTrace; ms: number; project: string }): void {
  if (!x.can || x.reason === 'declined') return;
  const key = `${x.kind}:${x.reason}${x.why ? ':' + x.why : ''}`, store = 'pmo-ai-fail:' + (x.me || '').toLowerCase();
  let sent: Record<string, string> = {};
  try { sent = JSON.parse(localStorage.getItem(store) || '{}') || {}; } catch { sent = {}; }
  if (!aiFailAllowed(sent, key, x.today)) return;
  sent[key] = x.today;
  try { localStorage.setItem(store, JSON.stringify(sent)); } catch { /* приватный режим */ }
  const f = aiFailFeedback({ kind: x.kind, reason: x.reason, code: x.trace.code || '', conv: x.trace.conv || '', ms: x.trace.ms ?? x.ms,
    project: x.project, version: RELEASES[0] && RELEASES[0][0] ? RELEASES[0][0].ver : '', at: new Date().toISOString() });
  x.create('Feedback', { ...f, fbDevice: `${window.innerWidth}×${window.innerHeight} · ${navigator.userAgent}`.slice(0, 255) }).catch(() => undefined);
}
