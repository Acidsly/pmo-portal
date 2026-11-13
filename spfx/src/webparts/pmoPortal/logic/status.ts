import { daysBetween, addDays } from './dates';

/** Проект в архиве: «Завершено» или «Скасовано» (векторы tests/cases/archive.json, те же — Test-ArchivedStatus синхронизации);
 *  «Архівний» — прежнее значение, понимается до миграции. */
export const isArch = (status: string): boolean => status === 'Завершено' || status === 'Скасовано' || status === 'Архівний';
export const isActive = (status: string): boolean => !isArch(status);

/** 1.7.12 «Підтримка» (SPEC 5.2): активный проект в этой фазе — проект підтримки, остальные активные — поточні.
 *  Только через эти функции: строку «Підтримка» в коде больше нигде не сравнивают (проверка — status.test.ts). */
export const SUPPORT = 'Підтримка';
export type Kind = 'project' | 'support';
export const isSupport = (status: string): boolean => status === SUPPORT;
export const projectKind = (status: string): Kind => (isSupport(status) ? 'support' : 'project');

/** Дни подачи статус-отчёта (1 — понедельник, 4 — четверг): поточні — пн и чт, підтримка — чт. */
export const REPORT_DAYS: Record<Kind, number[]> = { project: [1, 4], support: [4] };
const isoDow = (iso: string): number => new Date(Date.parse(iso + 'T12:00:00Z')).getUTCDay();
/** Пропущенные дни подачи: дни подачи S, где last < S < today (в сам день подачи ещё не пропущен); отчётов нет — null.
 *  last — дата подання последнего погодженого отчёта (pmLastUpdate). Векторы tests/cases/fresh.json (их же гоняет прототип). */
export function missedSlots(last: string, today: string, kind: Kind): number | null {
  if (!last) return null;
  const days = REPORT_DAYS[kind]; let n = 0;
  for (let d = addDays(last, 1); d < today; d = addDays(d, 1)) if (days.indexOf(isoDow(d)) >= 0) n++;
  return n;
}
/** Свежесть отчёта: na — погоджених нет; g — без пропусков; y — пропущен один день подачи; r — два и больше. */
export type Fresh = 'g' | 'y' | 'r' | 'na';
/** Свежесть проекта: по его фазе (категории) и дате подання последнего погодженого отчёта. */
export const projectFresh = (p: { lastUpdate: string; status: string }, today: string): Fresh => freshness(p.lastUpdate, today, projectKind(p.status));
export function freshness(lastUpdate: string, today: string, kind: Kind): Fresh {
  const m = missedSlots(lastUpdate, today, kind);
  return m === null ? 'na' : m === 0 ? 'g' : m === 1 ? 'y' : 'r';
}
export const isPlanLate = (planEnd: string, status: string, today: string): boolean => !!planEnd && planEnd < today && isActive(status);
export const forecastDelta = (planEnd: string, forecastEnd: string): number | null =>
  planEnd && forecastEnd ? daysBetween(planEnd, forecastEnd) : null;
/** 1.7.7: подсказка «за темпом витрат» — витрати на дату ÷ % виконання; при 0 % — нет. */
export const paceForecast = (actual: number, progress: number): number | null => (progress > 0 && actual > 0 ? Math.round(actual / progress * 100) : null);
export const budgetUse = (budget: number, actual: number): number => (budget ? Math.round((actual || 0) / budget * 100) : 0);
export const budgetLevel = (use: number): '' | 'warn' | 'over' => (use > 100 ? 'over' : use > 90 ? 'warn' : '');
export const riskScore = (p: number, i: number): number => (p || 0) * (i || 0);
export const scoreLevel = (s: number): 'r' | 'y' | 'g' => (s >= 15 ? 'r' : s >= 8 ? 'y' : 'g');

/** «Немає свіжого звіту»: сначала проекты без отчётов, дальше — от самого давнего отчёта. */
export function staleFirst(a: { lastUpdate: string; id: number }, b: { lastUpdate: string; id: number }): number {
  const x = a.lastUpdate || '', y = b.lastUpdate || '';
  return x === y ? a.id - b.id : !x ? -1 : !y ? 1 : x < y ? -1 : 1;
}

/** Базовая сортировка списков — новые записи сверху (по дате создания, затем Id). */
export function newestFirst(a: { created?: string; id: number }, b: { created?: string; id: number }): number {
  const x = a.created || '', y = b.created || '';
  return x < y ? 1 : x > y ? -1 : b.id - a.id;
}

interface Orderable { type: string; priority: string; title: string; }
/** Порядок по умолчанию: стратегические, приоритет, название. */
export function byOrder(a: Orderable, b: Orderable): number {
  if (a.type !== b.type) return a.type === 'Стратегічний' ? -1 : b.type === 'Стратегічний' ? 1 : 0;
  return (a.priority || '').localeCompare(b.priority || '') || a.title.localeCompare(b.title, 'uk');
}
