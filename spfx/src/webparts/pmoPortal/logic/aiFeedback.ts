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

const KIND: Record<AiKind, string> = { draft: 'Чернетка', check: 'Перевірка' };
const HEAD = 'Помилка ШІ (автоматично)';
/** Отзыв о сбое: заголовок «Помилка ШІ (автоматично): «Перевірка» — <причина>», строки «Код», «Розмова» (если есть),
 *  «Тривалість», «Проєкт» (код), «Версія», «Час (UTC)»; экран — форма статус-отчёта. */
export function aiFailFeedback(x: { kind: AiKind; reason: AiUnavailable; code: string; conv: string; ms: number; project: string; version: string; at: string }):
  { Title: string; fbText: string; fbScreen: string } {
  const why = unavailableNote(x.reason, 'uk').replace(/^[^:]*:\s*/, '');
  const title = `${HEAD}: «${KIND[x.kind] || x.kind}» — ${why}`;
  const lines = [title + '.'];
  if (x.code) lines.push('Код: ' + x.code.slice(0, 120));
  if (x.conv) lines.push('Розмова: ' + x.conv);
  lines.push(`Тривалість: ${(Math.max(0, x.ms) / 1000).toFixed(1).replace('.', ',')} с`, 'Проєкт: ' + x.project, 'Версія: ' + x.version,
    'Час (UTC): ' + String(x.at).slice(0, 16).replace('T', ' '));
  return { Title: title.slice(0, 255), fbText: lines.join('\n'), fbScreen: '#reports///report' };
}

/** Не чаще одного отзыва в день на вид запроса и причину (ключ «check:error»): sent — когда отправлен последний (гггг-мм-дд). */
export const aiFailAllowed = (sent: Record<string, string>, key: string, today: string): boolean => sent[key] !== today;
