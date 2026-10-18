import { AiUnavailable, unavailableNote } from './aiCheck';
import { AiKind } from './aiEval';

/** Сбой помощника ИИ — автоматический отзыв в «Відгуки» (тестовый сайт; план этапа 4, решение 14.10.2026). Только техника:
 *  текст отзыва синхронизация копирует в «Відгуки — загальні», его видят все, — данных отчёта и ответа ИИ в нём нет.
 *  По номеру разговора — стенограмма в Copilot Studio (Dataverse, «Стенограма розмови»). */

/** Код ошибки и номер разговора из текста ответа агента или исключения («Error code: …», «Conversation Id: …»,
 *  AccessToBotDenied). Нет — пусто. */
export function aiFailInfo(text: string): { code: string; conv: string } {
  const s = String(text || '');
  const code = (/Error code:\s*([A-Za-z0-9_.-]+)/i.exec(s) || /\b(AccessToBotDenied)\b/.exec(s) || [])[1] || '';
  const conv = (/Conversation Id:\s*([A-Za-z0-9-]+)/i.exec(s) || [])[1] || '';
  return { code, conv };
}

/** Код ошибки для публичного отзыва — только из белого списка: код Copilot Studio («Error code»), AADSTS…, AccessToBotDenied,
 *  timeout, unparsed, popup, network, http <статус>; остальное — «exception». Текст исключений MSAL / SDK не попадает:
 *  в нём бывают учётная запись, тенант, адреса (ревью 14.10.2026). Префикс места сбоя («token: », «load: ») сохраняется. */
export function aiSafeCode(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = /^(token|load):\s*/i.exec(s), pre = m ? m[1].toLowerCase() + ': ' : '', t = m ? s.slice(m[0].length) : s;
  const one = (): string => {
    const aad = /\bAADSTS\d+\b/.exec(t); if (aad) return aad[0];
    if (/AccessToBotDenied/.test(t)) return 'AccessToBotDenied';
    if (/^(timeout|unparsed)$/i.test(t)) return t.toLowerCase();
    if (/popup|interaction/i.test(t)) return 'popup';
    if (/fetch|network|ChunkLoad|Loading chunk/i.test(t)) return 'network';
    const st = /\bstatus\s*(\d{3})\b/i.exec(t); if (st) return 'http ' + st[1];
    if (/^[A-Za-z][A-Za-z0-9_.-]{2,80}$/.test(t)) return t;   // код Copilot Studio («Error code: …»)
    return 'exception';
  };
  return pre + one();
}

/** Вид запроса: черновик и проверка — в форме отчёта; enable — служебный вызов при включении «Помічник ШІ». */
export type AiFailKind = AiKind | 'enable';
const KIND: Record<AiFailKind, string> = { draft: 'Чернетка', check: 'Перевірка', enable: 'Увімкнення' };
const HEAD = 'Помилка ШІ (автоматично)';
/** Отзыв о сбое: заголовок «Помилка ШІ (автоматично): «Перевірка» — <причина>», строки «Код», «Розмова» (если есть),
 *  «Тривалість», «Проєкт» (код; при включении — нет), «Версія», «Час (UTC)»; экран — форма статус-отчёта (включение — главная). */
export function aiFailFeedback(x: { kind: AiFailKind; reason: AiUnavailable; code: string; conv: string; ms: number; project: string; version: string; at: string }):
  { Title: string; fbText: string; fbScreen: string } {
  const why = unavailableNote(x.reason, 'uk').replace(/^[^:]*:\s*/, '');
  const title = `${HEAD}: «${KIND[x.kind] || x.kind}» — ${why}`;
  const lines = [title + '.'];
  const code = aiSafeCode(x.code);
  if (code) lines.push('Код: ' + code);
  if (x.conv) lines.push('Розмова: ' + x.conv);
  lines.push(`Тривалість: ${(Math.max(0, x.ms) / 1000).toFixed(1).replace('.', ',')} с`);
  if (x.project) lines.push('Проєкт: ' + x.project);
  lines.push('Версія: ' + x.version, 'Час (UTC): ' + String(x.at).slice(0, 16).replace('T', ' '));
  return { Title: title.slice(0, 255), fbText: lines.join('\n'), fbScreen: x.kind === 'enable' ? '#home' : '#reports///report' };
}

/** Не чаще одного отзыва в день на вид запроса и причину (ключ «check:error»): sent — когда отправлен последний (гггг-мм-дд). */
export const aiFailAllowed = (sent: Record<string, string>, key: string, today: string): boolean => sent[key] !== today;
