import { AiLang } from './aiCheck';
import { RAGS } from './rag';

/** Ответ «Заповнити з ШІ»: тексты полей, «Що не забути» и предложение оценок с причиной (оценки PM ставит сам). */
export interface AiDraft {
  ok: true; done: string; next: string; issues: string; summary: string; remember: string[];
  ratings: { schedule?: string; budget?: string; resources?: string; reason: string };
}
export interface AiFail { ok: false; error: string }

/** Невидимые и управляющие символы: нулевой ширины и направления текста (U+200B–U+200F, U+2028–U+202E, U+2060–U+2069, U+FEFF),
 *  C0 / C1, кроме перевода строки и табуляции. */
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g;
export const stripInvisible = (s: string): string => s.replace(INVISIBLE, '');

/** Обрезка до n знаков с «…» (вместе с ним — n); суррогатная пара не разрывается. */
export function cutText(s: string, n: number): string {
  if (s.length <= n) return s;
  let k = Math.max(0, n - 1);
  const c = s.charCodeAt(k - 1);
  if (k > 0 && c >= 0xd800 && c <= 0xdbff) k--;
  return s.slice(0, k).replace(/\s+$/, '') + '…';
}

/** Блоки <script> / <style> вместе с содержимым — за один проход (незакрытый — до конца текста). */
function dropBlocks(t: string): string {
  const low = t.toLowerCase();
  let out = '', i = 0;
  for (;;) {
    const a = low.indexOf('<script', i), b = low.indexOf('<style', i);
    const at = a < 0 ? b : b < 0 ? a : Math.min(a, b);
    if (at < 0) return out + t.slice(i);
    out += t.slice(i, at);
    const tag = at === a ? '</script' : '</style';
    const end = low.indexOf(tag, at);
    if (end < 0) return out;
    const close = low.indexOf('>', end);
    if (close < 0) return out;
    i = close + 1;
  }
}

/** Только текст для полей отчёта и экрана (план помощника, раздел 3 «Вывод — только текст»; векторы tests/cases/ai-reply.json):
 *  вход обрезается до max × 4 (без квадратичной работы); без невидимых и управляющих символов; без HTML — только настоящие теги
 *  («<10% і >5» остаётся), скрипты и стили — вместе с содержимым; ссылки и картинки Markdown — их текст; адреса http(s)://, www.,
 *  javascript:, data:, vbscript: убираются; парное выделение **…** убирается, __…__ — только у фразы с пробелом (__init__ остаётся);
 *  заголовки «#» убираются; не больше двух пустых строк подряд; длиннее max — обрезка с «…». */
export function toPlain(s: string, max: number = 4000): string {
  let t = String(s === undefined || s === null ? '' : s);
  t = t.slice(0, max * 4).replace(/\r\n?/g, '\n');
  t = stripInvisible(dropBlocks(t));
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n').replace(/<\/?[a-zA-Z!][^<>]*>/g, '');
  t = t.replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1');
  t = t.replace(/\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi, '').replace(/\b(?:javascript|data|vbscript):[^\s<>"']+/gi, '');
  t = t.replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '$1').replace(/(^|[^\w])__(?=\S)([^_\n]*\s[^_\n]*?\S)__(?!\w)/g, '$1$2');
  t = t.replace(/^[ \t]*#{1,6}[ \t]+/gm, '');
  t = t.split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return cutText(t, max);
}
/** Пункт списка («Що не забути», противоречия) — одной строкой: переводы строк → пробел. */
const oneLine = (s: string, max: number): string => toPlain(s, max).replace(/\s*\n\s*/g, ' ');
/** Пунктов в списке — не больше. */
const MAX_ITEMS = 20;
/** Пункт «Що не забути» без содержания: «Коментар PMO до повернутого звіту: немає», «…:», none, нет, — (прогоны 11–12). */
const EMPTY_ITEM = /:\s*(?:—|–|-|немає|нема|нет|none|n\/a)?\s*\.?\s*$/i;

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
 *  Лишний ключ, не тот тип, чужое значение оценки — ошибка (код в error). Тексты очищаются toPlain;
 *  пункты «Що не забути» — одной строкой, не больше 20. */
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
    summary: toPlain(o.summary as string, 255), remember: (o.remember as string[]).map(x => oneLine(x, 500)).filter(x => !!x && !EMPTY_ITEM.test(x)).slice(0, MAX_ITEMS), ratings };
}

/** Строгая проверка ответа «Перевірити з ШІ»: ровно { items: [строки] }; пустой список — противоречий нет.
 *  Пункты — одной строкой, не больше 20. */
export function parseCheck(raw: string): { ok: true; items: string[] } | AiFail {
  const p = parseObject(raw);
  if (!p.o) return { ok: false, error: p.error! };
  const extra = extraKey(p.o, ['items']);
  if (extra) return { ok: false, error: 'extraKey:' + extra };
  if (!isStrList(p.o.items)) return { ok: false, error: 'badField:items' };
  return { ok: true, items: (p.o.items as string[]).map(x => oneLine(x, 1000)).filter(x => !!x).slice(0, MAX_ITEMS) };
}

/** Вставка текста ИИ в поле: пустое (пробелы — пусто) — сразу; заполненное — confirm: спросить «Замінити текст?».
 *  previous — прежний текст для «Скасувати вставку» (один шаг). */
export function insertText(current: string, proposed: string): { value: string; confirm: boolean; previous: string } {
  const cur = current || '';
  return { value: proposed || '', confirm: !!cur.trim(), previous: cur };
}

/** Поле «Суперечності (аналіз ШІ)» — не длиннее (план этапа 4: отчёт не раздувается). */
export const CHECK_MAX = 4000;
const NONE: Record<AiLang, string> = { uk: 'Суперечностей не знайдено.', en: 'No contradictions found.', ru: 'Противоречий не найдено.' };
/** Текст поля «Суперечності (аналіз ШІ)» (только для чтения): пункты «1. …» по строкам (перевод строки внутри пункта — пробел,
 *  не больше 20 пунктов, весь текст — не длиннее CHECK_MAX с «…»); пусто — «Суперечностей не знайдено.». */
export function checkText(items: string[], lang: AiLang): string {
  const list = (items || []).map(x => (x || '').replace(/\s*\n\s*/g, ' ').trim()).filter(x => !!x).slice(0, MAX_ITEMS);
  return list.length ? cutText(list.map((x, i) => `${i + 1}. ${x}`).join('\n'), CHECK_MAX) : NONE[lang] || NONE.uk;
}
