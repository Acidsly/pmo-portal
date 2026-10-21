import { Project, StatusReport, ChangeEvent } from '../data/types';
import { calcRag } from './rag';
import { AP_OK } from './approval';
import { applyAction } from './reportRules';
import { isArch } from './status';

const byDateThenId = (a: StatusReport, b: StatusReport): number => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);

const SHOWN: [keyof Project, string][] = [['status', 'status'], ['rag', 'rag'], ['type', 'type'], ['progress', 'progress'],
  ['start', 'start'], ['goLive', 'golive'], ['planEnd', 'plan'], ['forecastEnd', 'fc'], ['actualEnd', 'ae'], ['budget', 'budget'], ['forecastCost', 'fcost']];

/** Что погоджений отчёт переносит в карточку — как Get-ReportTarget синхронизации (общие векторы tests/cases/apply.json):
 *  заполненные показатели (% и затраты — целые, x,5 — вверх); «Завершено» / «Скасовано» — тот же статус (архив), дата архивации и фактическая дата (#54);
 *  отчёт не старше последнего (по дате) задаёт стан, дату и резюме. Значения — строки (как поля журнала). */
export type TargetKey = 'status' | 'type' | 'progress' | 'start' | 'goLive' | 'planEnd' | 'forecastEnd' | 'actualCost' | 'budgetPlan' | 'forecastCost' | 'actualEnd'
  | 'archivedAt' | 'rag' | 'lastUpdate' | 'lastReport';
/** budget — оценка «Бюджет» (RAG); budgetPlan — «Бюджет (план)», сумма (1.7.7). */
export interface TargetIn { status?: string; type?: string; progress?: number | null; start?: string; goLive?: string; planEnd?: string; forecastEnd?: string;
  actualCost?: number | null; budgetPlan?: number | null; forecastCost?: number | null; actualEnd?: string; date: string; schedule?: string; budget?: string; resources?: string; title?: string; }
const MONEY: TargetKey[] = ['progress', 'actualCost', 'budgetPlan', 'forecastCost'];
/** Целое, x,5 — от нуля (MidpointRounding.AwayFromZero синхронизации). */
export const roundAway = (v: number): number => (v < 0 ? -Math.round(-v) : Math.round(v));
export function reportTarget(r: TargetIn, lastUpdate: string): Partial<Record<TargetKey, string>> {
  const t: Partial<Record<TargetKey, string>> = {};
  for (const k of ['status', 'type', 'progress', 'start', 'goLive', 'planEnd', 'forecastEnd', 'actualCost', 'budgetPlan', 'forecastCost', 'actualEnd'] as const) {
    const v = r[k];
    if (v === null || v === undefined || String(v) === '') continue;
    if (k === 'forecastCost' && Number(v) === 0) continue;   // прогноз 0 — «не задан»
    t[k] = MONEY.indexOf(k) >= 0 ? String(roundAway(Number(v))) : String(v);
  }
  // #54: фактическая дата — только вместе с «Завершено» / «Скасовано»
  if (t.status === 'Завершено' || t.status === 'Скасовано') t.archivedAt = r.date; else delete t.actualEnd;
  if (!lastUpdate || r.date >= lastUpdate) {
    const rag = calcRag((r.schedule || '') as never, (r.budget || '') as never, (r.resources || '') as never);
    if (rag) t.rag = rag;
    t.lastUpdate = r.date; t.lastReport = r.title || '';
  }
  return t;
}

/** Накладывает неприменённые погоджені отчёты (srApplied = нет, «Погоджено» — решением PMO) на карточку — те же правила, что шаг 1 Invoke-PMOSync.ps1:
 *  «Погоджено» действует, только если есть решение PMO (approvedIds); архив и отчёт не PM — не применяются; более старый, чем последний применённый, — показатели не меняет. */
export function applyPending(project: Project, reports: StatusReport[], approvedIds?: Record<number, boolean>): Project {
  const pm = project.manager ? project.manager.email.toLowerCase() : '';
  const pending = reports.filter(r => r.projectId === project.id && !r.applied && r.approval === AP_OK && (!approvedIds || approvedIds[r.id])).sort(byDateThenId);
  if (!pending.length) return project;
  const p: Project = { ...project };
  const events: ChangeEvent[] = [];
  let last = project.lastApplied || '';
  for (const r of pending) {
    const author = r.author ? r.author.email.toLowerCase() : '';
    if (applyAction({ id: r.id, date: r.date, author }, pm, [], isArch(p.status), last, p.lastUpdate) !== 'apply') continue;
    p.pending = true; last = `${r.date}#${r.id}`;
    const before = { ...p };
    // что переносится — общим правилом reportTarget (те же векторы, что у синхронизации)
    const t = reportTarget({ status: r.status, type: r.type, progress: r.progress, start: r.start, goLive: r.goLive, planEnd: r.planEnd, forecastEnd: r.forecastEnd,
      actualCost: r.actualCost, budgetPlan: r.budgetPlan, forecastCost: r.forecastCost, actualEnd: r.actualEnd, date: r.date, schedule: r.schedule, budget: r.budget,
      resources: r.resources, title: r.title }, p.lastUpdate);
    (Object.keys(t) as TargetKey[]).forEach(k => {
      const v = t[k] as string;
      if (k === 'budgetPlan') p.budget = Number(v);   // «Бюджет (план)» — поле карточки budget
      else if (MONEY.indexOf(k) >= 0) (p as unknown as Record<string, number>)[k] = Number(v);
      else (p as unknown as Record<string, string>)[k] = v;
    });
    // событие истории — как строки журнала синхронизации (поля DISPLAY, значения — как Human)
    const diffs = SHOWN.filter(([k]) => String(before[k] || '') !== String(p[k] || ''))
      .map(([k, f]) => ({ f, from: human(k, String(before[k] || '')), to: human(k, String(p[k] || '')) }));
    if (diffs.length) events.push({ id: -r.id, date: r.date, who: r.author, kind: 'report', reason: [r.keyReason, r.title].filter(Boolean).join(' · '), diffs });
  }
  p.pendingEvents = events;
  return p;
}

// ключевые показатели журнала (DISPLAY синхронизации): поле модели -> ключ FLD прототипа
/** Сумма — как Human синхронизации и экран (общие векторы tests/cases/money.json): целое, разряды — неразрывный пробел, «$» после числа. */
export const moneyText = (v: number | null | undefined): string =>
  (v === null || v === undefined || String(v) === '' ? '—' : String(roundAway(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' $');
/** Значение для истории — как Human синхронизации: даты dd.MM.yyyy, % — с «%», суммы — moneyText, пусто — «—». */
function human(k: keyof Project, v: string): string {
  if (!v || (k === 'forecastCost' && v === '0')) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  if (k === 'budget' || k === 'forecastCost' || k === 'actualCost') return moneyText(Number(v));
  return k === 'progress' ? v + '%' : v;
}
export { byDateThenId };
