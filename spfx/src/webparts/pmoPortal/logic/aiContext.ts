import { Project, StatusReport, Risk, ChangeEntry } from '../data/types';
import { ReportDraft } from './forms';
import { AP_OK, AP_RETURNED } from './approval';
import { calcRag, Rag } from './rag';
import { riskScore } from './status';
import { AiLang } from './aiCheck';
import { stripInvisible, cutText } from './aiReply';
import { todayIso } from './dates';

/** Что передаётся помощнику отчёта (план помощника, 2.1 и 2.2). draft — текущая форма (для «Перевірити з ШІ»),
 *  prevCheck — прежний результат проверки (чтобы ИИ не повторял оставленные PM пункты). */
export interface AiContextIn {
  project: Project; reports: StatusReport[]; risks: Risk[]; changes: ChangeEntry[]; draft?: ReportDraft; prevCheck?: string;
  lang: AiLang; today: string;
}

const RISK_CLOSED = 'Закрито';
/** Поля журнала, изменения которых попадают в контекст, и их имена в контексте. */
const KEY_FIELDS: Record<string, string> = { pmStatus: 'phase', pmProgress: 'progress', pmGoLive: 'goLive', pmPlanEnd: 'planEnd', pmForecastEnd: 'forecastEnd' };
/** Показатели формы и карточки для draft.changed: значение формы, поле карточки, имя в контексте. */
const CHANGED: [(d: ReportDraft) => unknown, string, string][] = [[d => d.status, 'status', 'phase'], [d => d.type, 'type', 'type'], [d => d.progress, 'progress', 'progress'],
  [d => d.start || '', 'start', 'start'], [d => d.goLive || '', 'goLive', 'goLive'], [d => d.planEnd || '', 'planEnd', 'planEnd'],
  [d => d.forecastEnd || '', 'forecastEnd', 'forecastEnd'], [d => d.actualCost, 'actualCost', 'actualCost']];
/** Какие показатели PM изменил в форме против карточки (имена контекста: phase, type, progress, start, goLive, planEnd,
 *  forecastEnd, actualCost) — не история: журнал — это уже внесённое раньше. */
export const draftChanged = (p: Project, d: ReportDraft): string[] =>
  CHANGED.filter(([f, pk]) => String(f(d) ?? '') !== String((p as unknown as Record<string, unknown>)[pk] ?? '')).map(x => x[2]);
/** Длинный текст при последнем шаге обрезки — не длиннее этого. */
export const TEXT_CAP = 1000;
/** Маркер блока данных после NFKC: «<<DATA>>» / «<</DATA>>» с пробелами, в любом регистре, со скобками ‹› ＜＞ ﹤﹥ и кириллической «а». */
const MARKER = /[<‹＜﹤]\s*[<‹＜﹤]\s*\/?\s*d\s*[aа]\s*t\s*[aа]\s*[>›＞﹥]\s*[>›＞﹥]/gi;

/** Строки контекста (векторы tests/cases/ai-context.json): NFKC, без невидимых и управляющих символов (нулевой ширины,
 *  направления текста, C0 / C1 кроме перевода строки и табуляции), без маркеров блока данных «<<DATA>>» / «<</DATA>>» —
 *  до неизменности, чтобы «<<DA<</DATA>>TA>>» не собрался в маркер; иначе данные могли бы закрыть блок и стать инструкцией. */
export function cleanText(s: string | null | undefined): string {
  let t = String(s === undefined || s === null ? '' : s);
  t = stripInvisible(t.normalize ? t.normalize('NFKC') : t);
  for (let prev = ''; prev !== t;) { prev = t; t = t.replace(MARKER, ''); }
  return t;
}
/** Все строки объекта — через cleanText (порядок ключей сохраняется). */
export const cleanAll = <T>(o: T): T => JSON.parse(JSON.stringify(o, (k: string, v: unknown) => (typeof v === 'string' ? cleanText(v) : v)));
const num = (x: number | null | undefined): number | null => (typeof x === 'number' && !isNaN(x) ? x : null);
/** Дата строки журнала по местному времени: kcDate — дата-время UTC (ISO); «гггг-мм-дд» — как есть. */
const localDay = (s: string | undefined): string => {
  const v = s || '';
  if (v.length <= 10) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? v.slice(0, 10) : todayIso(d);
};
/** Погоджений отчёт — как reportPeriodFrom: «Погоджено», а до погоджень — применённый. */
export const isApproved = (r: StatusReport): boolean => r.approval === AP_OK || (!r.approval && !!r.applied);
/** Новые сверху: дата, затем номер (порядок не зависит от порядка входа). */
export const newest = (a: { date: string; id: number }, b: { date: string; id: number }): number =>
  (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);

interface Slot { o: Record<string, unknown>; k: string; n: number; i: number }
/** Все строковые поля объекта (для последнего шага обрезки). */
function textSlots(x: unknown, out: Slot[]): Slot[] {
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    Object.keys(o).forEach(k => { const v = o[k]; if (typeof v === 'string') out.push({ o, k, n: v.length, i: out.length }); else textSlots(v, out); });
  }
  return out;
}

/** Результат: json; truncated — что-то убрано или урезано ("truncated": true в JSON); tooLarge — и после обрезки длиннее
 *  лимита ("tooLarge": true): ИИ не вызывается. */
export interface AiContextOut { json: string; truncated: boolean; tooLarge: boolean }

/** Контекст помощника статус-отчёта (векторы tests/cases/ai-context.json): только проект формы, белый список полей
 *  (без e-mail, команды, стейкхолдеров и служебных полей), все строки очищены cleanText.
 *  - проект: код, название, фаза, тип, %, даты, бюджет, затраты, lastUpdate — дата последнего погодженого отчёта;
 *  - до 3 последних погоджених отчётов; последний отчёт, если повернутий, — комментарий PMO;
 *  - риски: открытые и закрытые в день последнего погодженого отчёта или позже (дата закрытия — последняя строка журнала
 *    «Ризик» со статусом → «Закрито», по местному времени; погоджених нет — все закрытые), просрочен ли срок на today;
 *  - изменения фазы, %, дат запуска, плана и прогноза из журнала строго после дня последнего погодженого отчёта
 *    (по местному времени; строки самого дня подання — его же показатели, они уже в отчёте); погоджених нет — весь журнал;
 *  - текущая форма (если передана и того же проекта) и прежний результат проверки.
 *  Длиннее maxChars — обрезка по шагам, пока не поместится (шаг, который ничего не убирает, пропускается):
 *  1) тексты старых отчётов (самый новый остаётся), 2) журнал, 3) закрытые риски, 4) длинные тексты — от самого длинного —
 *  до 1000 знаков с «…»; не помогло — tooLarge. Порядок ключей и элементов постоянный. */
export function buildReportContext(input: AiContextIn, maxChars: number = 50000): AiContextOut {
  const p = input.project, pid = p.id;
  const reps = (input.reports || []).filter(r => r.projectId === pid).slice().sort(newest);
  const approved = reps.filter(isApproved);
  const since = approved.length ? approved[0].date : '';
  const latest = reps[0];

  const reportOut = (r: StatusReport, full: boolean): Record<string, unknown> => {
    const o: Record<string, unknown> = { date: r.date, schedule: r.schedule, budget: r.budget, resources: r.resources,
      rag: calcRag(r.schedule as Rag, r.budget as Rag, r.resources as Rag) };
    if (full) { o.summary = r.title; o.done = r.done; o.next = r.next; o.issues = r.issues; o.decision = !!r.decision; o.decisionText = r.decisionText; }
    return o;
  };

  // дата закрытия риска — последняя строка журнала «Ризик» со статусом → «Закрито»
  const closedAt: Record<number, string> = {};
  (input.changes || []).filter(c => c.projectId === pid && c.kind === 'Ризик' && c.field === 'riStatus' && c.to === RISK_CLOSED && !!c.item)
    .forEach(c => { const d = localDay(c.date); if (!closedAt[c.item!] || closedAt[c.item!] < d) closedAt[c.item!] = d; });
  const risks = (input.risks || []).filter(k => k.projectId === pid)
    .filter(k => k.status !== RISK_CLOSED || !since || (!!closedAt[k.id] && closedAt[k.id] >= since))
    .sort((a, b) => a.id - b.id);
  const riskOut = (k: Risk): Record<string, unknown> => ({ type: k.type, title: k.title, probability: num(k.probability),
    impact: num(k.impact), score: riskScore(k.probability, k.impact), status: k.status, strategy: k.strategy,
    mitigation: k.mitigation, contingency: k.contingency, due: k.due || '', overdue: !!k.due && k.due < input.today && k.status !== RISK_CLOSED });

  const changes = (input.changes || []).filter(c => c.projectId === pid && !!KEY_FIELDS[c.field] && (!since || localDay(c.date) > since))
    .map(c => ({ c, d: localDay(c.date) }))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.c.id - b.c.id));

  const d = input.draft && input.draft.projectId === pid ? input.draft : undefined;
  const draftOut = d ? { schedule: d.schedule, budget: d.budget, resources: d.resources, phase: d.status, type: d.type,
    progress: num(d.progress), start: d.start || '', goLive: d.goLive || '', planEnd: d.planEnd || '', forecastEnd: d.forecastEnd || '',
    actualEnd: d.actualEnd || '', actualCost: num(d.actualCost), keyReason: d.keyReason, summary: d.title,
    done: d.done, next: d.next, issues: d.issues, decision: !!d.decision, decisionText: d.decisionText,
    // какие показатели PM изменил в этой форме против карточки (не история: журнал — это уже внесённое раньше)
    changed: draftChanged(p, d) } : undefined;

  const build = (cut: number): Record<string, unknown> => {
    const o: Record<string, unknown> = {
      lang: input.lang, today: input.today,
      project: { code: p.code, title: p.title, phase: p.status, type: p.type, progress: num(p.progress),
        start: p.start || '', goLive: p.goLive || '', planEnd: p.planEnd || '', forecastEnd: p.forecastEnd || '', actualEnd: p.actualEnd || '',
        budget: num(p.budget), actualCost: num(p.actualCost), lastUpdate: since || p.lastUpdate || '' },
      reports: approved.slice(0, 3).map((r, i) => reportOut(r, i === 0 || cut < 1))
    };
    if (latest && latest.approval === AP_RETURNED) o.returned = { date: latest.date, summary: latest.title, note: latest.approvalNote };
    o.risks = risks.filter(k => cut < 3 || k.status !== RISK_CLOSED).map(riskOut);
    o.changes = cut < 2 ? changes.map(x => ({ date: x.d, field: KEY_FIELDS[x.c.field], from: x.c.from, to: x.c.to })) : [];
    if (draftOut) o.draft = draftOut;
    if (input.prevCheck) o.prevCheck = input.prevCheck;
    return cleanAll(o);
  };
  const flagged = (o: Record<string, unknown>, tooLarge: boolean): string =>
    JSON.stringify(tooLarge ? { ...o, truncated: true, tooLarge: true } : { ...o, truncated: true });

  let prev = JSON.stringify(build(0));
  if (prev.length <= maxChars) return { json: prev, truncated: false, tooLarge: false };
  for (let cut = 1; cut <= 3; cut++) {
    const s = JSON.stringify(build(cut));
    if (s === prev) continue;
    prev = s;
    const j = flagged(JSON.parse(s), false);
    if (j.length <= maxChars) return { json: j, truncated: true, tooLarge: false };
  }
  const o = build(3);
  const long = textSlots(o, []).filter(x => x.n > TEXT_CAP).sort((a, b) => b.n - a.n || a.i - b.i);
  for (const x of long) {
    x.o[x.k] = cutText(x.o[x.k] as string, TEXT_CAP);
    const j = flagged(o, false);
    if (j.length <= maxChars) return { json: j, truncated: true, tooLarge: false };
  }
  return { json: flagged(o, true), truncated: true, tooLarge: true };
}
