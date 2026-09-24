import { daysBetween } from './dates';

export const isArch = (status: string): boolean => status === 'Архівний' || status === 'Завершено';
export const isActive = (status: string): boolean => !isArch(status) && status !== 'Скасовано';

/** Свежесть последнего отчёта: нет — na; старше 14 дней — r; старше 8 — y; иначе g (как в прототипе). */
export type Fresh = 'g' | 'y' | 'r' | 'na';
export function freshness(lastUpdate: string, today: string): Fresh {
  if (!lastUpdate) return 'na';
  const age = daysBetween(lastUpdate, today);
  return age > 14 ? 'r' : age > 8 ? 'y' : 'g';
}
export const isPlanLate = (planEnd: string, status: string, today: string): boolean => !!planEnd && planEnd < today && isActive(status);
export const forecastDelta = (planEnd: string, forecastEnd: string): number | null =>
  planEnd && forecastEnd ? daysBetween(planEnd, forecastEnd) : null;
export const budgetUse = (budget: number, actual: number): number => (budget ? Math.round((actual || 0) / budget * 100) : 0);
export const budgetLevel = (use: number): '' | 'warn' | 'over' => (use > 100 ? 'over' : use > 90 ? 'warn' : '');
export const riskScore = (p: number, i: number): number => (p || 0) * (i || 0);
export const scoreLevel = (s: number): 'r' | 'y' | 'g' => (s >= 15 ? 'r' : s >= 8 ? 'y' : 'g');

interface Orderable { type: string; priority: string; title: string; }
/** Порядок по умолчанию: стратегические, приоритет, название. */
export function byOrder(a: Orderable, b: Orderable): number {
  if (a.type !== b.type) return a.type === 'Стратегічний' ? -1 : b.type === 'Стратегічний' ? 1 : 0;
  return (a.priority || '').localeCompare(b.priority || '') || a.title.localeCompare(b.title, 'uk');
}
