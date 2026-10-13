import { AiLang } from './aiCheck';
import { RAGS } from './rag';

/** Ответ «Заповнити з ШІ»: тексты полей, «Що не забути» и предложение оценок с причиной (оценки PM ставит сам). */
export interface AiDraft {
  ok: true; done: string; next: string; issues: string; summary: string; remember: string[];
  ratings: { schedule?: string; budget?: string; resources?: string; reason: string };
}
export interface AiFail { ok: false; error: string }

/** Только текст для полей отчёта и экрана (план помощника, раздел 3 «Вывод — только текст»; векторы tests/cases/ai-reply.json):
 *  без HTML (скрипты и стили — вместе с содержимым), ссылки Markdown — их текст, адреса http(s) убираются,
 *  без выделения Markdown, не больше двух пустых строк подряд; длиннее max — обрезка с «…». */
export function toPlain(s: string, max: number = 4000): string {
  let t = String(s === undefined || s === null ? '' : s).replace(/\r\n?/g, '\n');
  t = t.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<(script|style)\b[\s\S]*$/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n').replace(/<[^>]*>/g, '');
  t = t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/\bhttps?:\/\/[^\s<>"')\]]+/gi, '');
  t = t.replace(/\*\*|__/g, '').replace(/^[ \t]*#{1,6}[ \t]+/gm, '');
  t = t.split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return t.length > max ? t.slice(0, Math.max(0, max - 1)).replace(/\s+$/, '') + '…' : t;
}

/** Разбор JSON ответа агента: допускается обёртка ```json … ```; не объект или обрезанный JSON — ошибка. */
function parseObject(raw: string): { o?: Record<string, unknown>; error?: string } {
  let s = String(raw === undefined || raw === null ? '' : raw).trim();
  const m = /^```[a-zA-Z]*[ \t]*\n?([\s\S]*?)\n?[ \t]*```$/.exec(s);
  if (m) s = m[1].trim();
  if (!s) return { error: 'empty' };
  let o: unknown;
  try { o = JSON.parse(s); } catch { return { error: 'notJson' }; }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return { error: 'notObject' };
  return { o: o as Record<string, unknown> };
}
const extraKey = (o: Record<string, unknown>, allowed: string[]): string => Object.keys(o).filter(k => allowed.indexOf(k) < 0)[0] || '';
const isStrList = (x: unknown): x is string[] => Array.isArray(x) && x.every(v => typeof v === 'string');

const DRAFT_KEYS = ['done', 'next', 'issues', 'summary', 'remember', 'ratings'];
const RATING_KEYS = ['schedule', 'budget', 'resources', 'reason'];
/** Строгая проверка ответа «Заповнити з ШІ»: ровно поля done / next / issues / summary (строки), remember (список строк),
 *  ratings { schedule? budget? resources? — Зелений / Жовтий / Червоний или нет (null и '' — нет); reason — строка }.
 *  Лишний ключ, не тот тип, чужое значение оценки — ошибка (код в error). Тексты очищаются toPlain. */
export function parseDraft(raw: string): AiDraft | AiFail {
  const p = parseObject(raw);
  if (!p.o) return { ok: false, error: p.error! };
  const o = p.o;
  const extra = extraKey(o, DRAFT_KEYS);
  if (extra) return { ok: false, error: 'extraKey:' + extra };
  for (const k of ['done', 'next', 'issues', 'summary']) if (typeof o[k] !== 'string') return { ok: false, error: 'badField:' + k };
  if (!isStrList(o.remember)) return { ok: false, error: 'badField:remember' };
  const r = o.ratings as Record<string, unknown>;
  if (r === null || typeof r !== 'object' || Array.isArray(r)) return { ok: false, error: 'badField:ratings' };
  const extraR = extraKey(r, RATING_KEYS);
  if (extraR) return { ok: false, error: 'extraKey:ratings.' + extraR };
  if (typeof r.reason !== 'string') return { ok: false, error: 'badField:ratings.reason' };
  const ratings: AiDraft['ratings'] = { reason: toPlain(r.reason as string, 1000) };
  for (const k of ['schedule', 'budget', 'resources'] as ('schedule' | 'budget' | 'resources')[]) {
    const v = r[k];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string' || RAGS.indexOf(v as never) < 0) return { ok: false, error: 'badRating:' + k };
    ratings[k] = v;
  }
  return { ok: true, done: toPlain(o.done as string), next: toPlain(o.next as string), issues: toPlain(o.issues as string),
    summary: toPlain(o.summary as string, 255), remember: (o.remember as string[]).map(x => toPlain(x, 500)).filter(x => !!x), ratings };
}

/** Строгая проверка ответа «Перевірити з ШІ»: ровно { items: [строки] }; пустой список — противоречий нет. */
export function parseCheck(raw: string): { ok: true; items: string[] } | AiFail {
  const p = parseObject(raw);
  if (!p.o) return { ok: false, error: p.error! };
  const extra = extraKey(p.o, ['items']);
  if (extra) return { ok: false, error: 'extraKey:' + extra };
  if (!isStrList(p.o.items)) return { ok: false, error: 'badField:items' };
  return { ok: true, items: (p.o.items as string[]).map(x => toPlain(x, 1000)).filter(x => !!x) };
}

/** Вставка текста ИИ в поле: пустое (пробелы — пусто) — сразу; заполненное — confirm: спросить «Замінити текст?».
 *  previous — прежний текст для «Скасувати вставку» (один шаг). */
export function insertText(current: string, proposed: string): { value: string; confirm: boolean; previous: string } {
  const cur = current || '';
  return { value: proposed || '', confirm: !!cur.trim(), previous: cur };
}

const NONE: Record<AiLang, string> = { uk: 'Суперечностей не знайдено.', en: 'No contradictions found.', ru: 'Противоречий не найдено.' };
/** Текст поля «Суперечності (аналіз ШІ)» (только для чтения): пункты «1. …» по строкам; пусто — «Суперечностей не знайдено.». */
export function checkText(items: string[], lang: AiLang): string {
  const list = (items || []).map(x => (x || '').trim()).filter(x => !!x);
  return list.length ? list.map((x, i) => `${i + 1}. ${x}`).join('\n') : NONE[lang] || NONE.uk;
}
