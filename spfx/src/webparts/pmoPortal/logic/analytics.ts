import { Project, StatusReport, Risk, ChangeEntry } from '../data/types';
import { isActive, freshness, isPlanLate, forecastDelta, riskScore } from './status';
import { AP_PENDING } from './approval';

/** Аналитика главной — всё по видимым пользователю проектам без архива (правила задачи 7 раунда 2). */
const addDays = (iso: string, n: number): string => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isOpen = (k: Risk): boolean => k.status !== 'Закрито';
export const isHighRisk = (k: Risk): boolean => isOpen(k) && riskScore(k.probability, k.impact) >= 15;
export const isAwaiting = (r: StatusReport): boolean => (r.approval || AP_PENDING) === AP_PENDING;

export interface Kpis { active: number; fresh: number; freshPct: number; awaiting: number; highRisks: number; overdue: number; }
/** Полоса показателей: активні; частка зі свіжим звітом (≤ 14 днів); очікують погодження; високі ризики (відкриті, ≥ 15); прострочені (план минув, проєкт відкритий). */
export function kpis(projects: Project[], reports: StatusReport[], risks: Risk[], today: string): Kpis {
  const act = projects.filter(p => isActive(p.status));
  const ids: Record<number, boolean> = {}; projects.forEach(p => { ids[p.id] = true; });
  const fresh = act.filter(p => { const f = freshness(p.lastUpdate, today); return f === 'g' || f === 'y'; }).length;
  return { active: act.length, fresh, freshPct: act.length ? Math.round(fresh / act.length * 100) : 0,
    awaiting: reports.filter(r => ids[r.projectId] && isAwaiting(r)).length,
    highRisks: risks.filter(k => ids[k.projectId] && isHighRisk(k)).length,
    overdue: projects.filter(p => isPlanLate(p.planEnd, p.status, today)).length };
}

/** Карта ризиків: m[ймовірність-1][вплив-1] — відкриті ризики видимих проєктів. */
export function riskMatrix(projects: Project[], risks: Risk[]): Risk[][][] {
  const ids: Record<number, boolean> = {}; projects.forEach(p => { ids[p.id] = true; });
  const m: Risk[][][] = [0, 1, 2, 3, 4].map(() => [0, 1, 2, 3, 4].map(() => [] as Risk[]));
  risks.filter(k => ids[k.projectId] && isOpen(k) && k.probability >= 1 && k.probability <= 5 && k.impact >= 1 && k.impact <= 5)
    .forEach(k => m[k.probability - 1][k.impact - 1].push(k));
  return m;
}

export interface Slip { id: number; p: Project; days: number; moves: number; }
/** Найбільші зсуви термінів: активні з прогнозом пізніше плану, топ-N за днями; moves — скільки разів змінювали план завершення (журнал). */
export function slips(projects: Project[], changes: ChangeEntry[], n = 3): Slip[] {
  return projects.filter(p => isActive(p.status)).map(p => ({ id: p.id, p, days: forecastDelta(p.planEnd, p.forecastEnd) || 0,
    moves: changes.filter(c => c.projectId === p.id && c.field === 'pmPlanEnd' && c.kind !== 'Створення').length }))
    .filter(x => x.days > 0).sort((a, b) => b.days - a.days || b.moves - a.moves || a.p.id - b.p.id).slice(0, n);
}

/** Найближчі запуски: активні з датою запуску від сьогодні до +days днів, раніші — вгорі. */
export const launches = (projects: Project[], today: string, days = 7): Project[] => {
  const end = addDays(today, days);
  return projects.filter(p => isActive(p.status) && !!p.goLive && p.goLive >= today && p.goLive <= end)
    .sort((a, b) => (a.goLive < b.goLive ? -1 : a.goLive > b.goLive ? 1 : a.id - b.id));
};

export interface DeptRow { dept: string; g: number; y: number; r: number; na: number; total: number; }
/** Портфель за напрямами: активні проєкти, розбивка за станом; більші напрями — вгорі. */
export function byDept(projects: Project[]): DeptRow[] {
  const m: Record<string, DeptRow> = {};
  projects.filter(p => isActive(p.status)).forEach(p => {
    const d = p.department || '—';
    const row = m[d] || (m[d] = { dept: d, g: 0, y: 0, r: 0, na: 0, total: 0 });
    const k = p.rag === 'Зелений' ? 'g' : p.rag === 'Жовтий' ? 'y' : p.rag === 'Червоний' ? 'r' : 'na';
    row[k]++; row.total++;
  });
  return Object.keys(m).map(k => m[k]).sort((a, b) => b.total - a.total || a.dept.localeCompare(b.dept, 'uk'));
}
