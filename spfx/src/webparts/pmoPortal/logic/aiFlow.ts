import { AiButton, AiLang, AiUnavailable, unavailableNote } from './aiCheck';
import { checkText, insertText } from './aiReply';

/** Сценарий помощника в форме статус-отчёта (план этапа 4, задача 1; векторы tests/cases/ai-flow.json): чистые функции,
 *  компонент формы только вызывает их. */

/** Что делает нажатие нижней кнопки: «звіт уже на погодженні» — ничего (кнопки недоступны, как сейчас); ошибки формы
 *  (reportErrors) — показать у полей, ИИ не вызывается; дальше — по кнопке (aiButton): «ШІ аналізує…» — ничего. */
export type AiAction = 'blocked' | 'showErrors' | 'none' | 'check' | 'save' | 'saveWithout';
export function aiAction(s: { pending: boolean; hasErrors: boolean; button: AiButton }): AiAction {
  if (s.pending) return 'blocked';
  if (s.hasErrors) return 'showErrors';
  if (s.button === 'busy') return 'none';
  return s.button;
}

/** ИИ недоступен только для того вида формы, на котором случилась ошибка: изменил форму — снова «Перевірити з ШІ»
 *  (повтор после таймаута); unavailablePrint — отпечаток формы при ошибке. */
export const aiUnavailable = (unavailablePrint: string | null, currentPrint: string): boolean =>
  unavailablePrint !== null && unavailablePrint === currentPrint;

/** Что вернул вызов агента. text — ответ prompt (последнее непустое сообщение) или текст ошибки Copilot Studio;
 *  error — исключение (сеть, 403, окно входа); timeout — нет ответа 60 с; consent — карточка согласия prompt. */
export interface AiCallOut { text?: string; error?: string; timeout?: boolean; consent?: boolean }
/** Почему ИИ не ответил, или null — ответ есть (его ещё разбирают parseDraft / parseCheck). Карточка согласия — 'consent';
 *  нет доступа к агенту — denied; кончилась ёмкость или кредиты — credits; таймаут — timeout; остальные ошибки
 *  (в том числе отказ фильтра Microsoft AIModelActionBadRequest) — error. */
export function aiErrorKind(x: AiCallOut): AiUnavailable | 'consent' | null {
  if (x.consent) return 'consent';
  if (x.timeout) return 'timeout';
  const s = `${x.error || ''}\n${x.text || ''}`;
  if (/AccessToBotDenied|don't have access to talk|\b403\b/i.test(s)) return 'denied';
  if (/capacity|quota|rate ?limit|credit/i.test(s)) return 'credits';
  if (x.error || /Error code:|error has occurred/i.test(x.text || '')) return 'error';
  return null;
}

/** Согласие (карточка Copilot Studio): первая карточка — спросить PM; карточка после «Дозволити» или «Скасувати» —
 *  ИИ недоступен (error), иначе — ответ. */
export function consentStep(kind: AiUnavailable | 'consent' | null, afterConsent: boolean): 'ask' | 'fail' | 'reply' {
  if (kind === 'consent') return afterConsent ? 'fail' : 'ask';
  return kind ? 'fail' : 'reply';
}

/** Результат проверки формы перед сохранением: checked — проверено ИИ (пункты, время); without — «Зберегти без перевірки»
 *  (причина). */
export type AiResult = { kind: 'checked'; items: string[]; at: string } | { kind: 'without'; reason: AiUnavailable };
/** Поля ИИ для записи отчёта: вне пилота — ничего (поля не передаются, отчёт как сейчас); проверено — текст поля
 *  (checkText) и время; без проверки — «Перевірку ШІ не виконано: …» и пустое время; srAiFilled — была вставка из
 *  «Заповнити з ШІ». */
export function aiSaveFields(s: { pilot: boolean; result: AiResult | null; filled: boolean; lang: AiLang }): Record<string, unknown> {
  if (!s.pilot) return {};
  const o: Record<string, unknown> = { srAiFilled: !!s.filled };
  if (s.result && s.result.kind === 'checked') { o.srAiCheck = checkText(s.result.items, s.lang); o.srAiCheckedAt = s.result.at; }
  if (s.result && s.result.kind === 'without') { o.srAiCheck = unavailableNote(s.result.reason, s.lang); o.srAiCheckedAt = null; }
  return o;
}

/** prevCheck для следующей проверки — текст последней успешной проверки в этой форме; «без проверки» и пусто — нет. */
export const nextPrevCheck = (r: AiResult | null, lang: AiLang): string => (r && r.kind === 'checked' ? checkText(r.items, lang) : '');

/** Поля формы, которые заполняет «Заповнити з ШІ», и их ключи в ответе ИИ. */
export const DRAFT_FIELDS: { form: 'done' | 'next' | 'issues' | 'title'; ai: 'done' | 'next' | 'issues' | 'summary' }[] =
  [{ form: 'title', ai: 'summary' }, { form: 'done', ai: 'done' }, { form: 'next', ai: 'next' }, { form: 'issues', ai: 'issues' }];
/** Вставка черновика ИИ: пустые поля — сразу (now), заполненные — по вопросу «Замінити текст у полі «…»?» (ask);
 *  пустой ответ ИИ поле не трогает; before — тексты до вставки для «Скасувати вставку». */
export function draftInsert(form: Record<string, string>, ai: Record<string, string>):
  { now: Record<string, string>; ask: { field: string; value: string }[]; before: Record<string, string> } {
  const now: Record<string, string> = {}, before: Record<string, string> = {}, ask: { field: string; value: string }[] = [];
  DRAFT_FIELDS.forEach(f => {
    const proposed = (ai[f.ai] || '').trim();
    if (!proposed) return;
    const r = insertText(form[f.form] || '', proposed);
    before[f.form] = r.previous;
    if (r.confirm) { if (r.previous.trim() !== proposed) ask.push({ field: f.form, value: proposed }); } else now[f.form] = proposed;
  });
  return { now, ask, before };
}
/** «Скасувати вставку» — только пока форма не менялась после вставки: иначе отмена затёрла бы правки PM. */
export const undoAvailable = (afterInsertPrint: string | null, currentPrint: string): boolean =>
  afterInsertPrint !== null && afterInsertPrint === currentPrint;

/** Что показать в просмотре и погодженні: есть дата — «Перевірено ШІ: …»; текст без даты — «Збережено без перевірки ШІ»
 *  (у пилота при недоступности ИИ всегда пишется причина); пусто — блока нет (старые отчёты и отчёты вне пилота). */
export function aiView(aiCheck: string | null | undefined, aiCheckedAt: string | null | undefined): 'checked' | 'without' | 'none' {
  if (aiCheckedAt) return 'checked';
  return (aiCheck || '').trim() ? 'without' : 'none';
}
