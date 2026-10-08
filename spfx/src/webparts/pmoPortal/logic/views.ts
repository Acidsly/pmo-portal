import { Project, StatusReport, Risk } from '../data/types';
import { isActive, freshness, isPlanLate, riskScore } from './status';

export type ProjectView = 'all' | 'strat' | 'problem' | 'mine' | 'pm' | 'stale' | 'late';
export type ReportView = 'all' | 'decision' | 'awaiting';
export type RiskView = 'open' | 'high' | 'all' | 'archived';
export type ArchiveView = 'all' | 'done' | 'cancelled' | 'strat' | 'mine' | 'pm';
// названия представлений — украинские во всех языках, как в прототипе (подсказка viewsNote)
export const PV: Record<ProjectView, string> = { all: 'Усі проєкти', strat: 'Стратегічні', problem: 'Проблемні', mine: 'Мої проєкти (усі)', pm: 'Я PM', stale: 'Немає свіжого звіту', late: 'Прострочені' };
export const RV: Record<ReportView, string> = { all: 'Усі звіти', decision: 'Потребують рішення', awaiting: 'Очікують погодження' };
export const AV: Record<ArchiveView, string> = { all: 'Усі проєкти', done: 'Завершені', cancelled: 'Скасовані', strat: 'Стратегічні', mine: 'Мої проєкти (усі)', pm: 'Я PM' };
export const KV: Record<RiskView, string> = { open: 'Відкриті', high: 'Високі ризики', all: 'Усі елементи', archived: 'Ризики архівних проєктів' };

/** #36 «Я PM»: поточний користувач — PM проєкту. */
export const isPm = (p: Project, me: string): boolean => !!p.manager && !!me && p.manager.email.toLowerCase() === me.toLowerCase();
export const participants = (p: Project): string[] =>
  [p.manager, p.owner, ...p.stakeholders].filter(x => !!x && !!x.email).map(x => x!.email.toLowerCase());

export function projectView(v: ProjectView, p: Project, today: string, me: string): boolean {
  switch (v) {
    case 'strat': return isActive(p.status) && p.type === 'Стратегічний';
    case 'problem': return isActive(p.status) && (p.rag === 'Червоний' || p.rag === 'Жовтий');
    case 'mine': return participants(p).indexOf(me.toLowerCase()) >= 0;   // #36: усі ролі — PM, власник, команда
    case 'pm': return isPm(p, me);
    case 'stale': { const f = freshness(p.lastUpdate, today); return isActive(p.status) && (f === 'r' || f === 'na'); }
    case 'late': return isPlanLate(p.planEnd, p.status, today);
    default: return true;
  }
}
/** Представления «Архів»: без условия «активный» (там только завершённые и отменённые); «Завершені» / «Скасовані» — по статусу. */
export const archiveView = (v: ArchiveView, p: Project, me: string): boolean =>
  (v === 'done' ? p.status === 'Завершено' : v === 'cancelled' ? p.status === 'Скасовано' : v === 'strat' ? p.type === 'Стратегічний' : v === 'mine' ? participants(p).indexOf(me.toLowerCase()) >= 0 : v === 'pm' ? isPm(p, me) : true);
export const reportView = (v: ReportView, r: StatusReport): boolean =>
  (v === 'decision' ? r.decision : v === 'awaiting' ? (r.approval || 'На погодженні') === 'На погодженні' : true);
export const riskView = (v: RiskView, k: Risk): boolean =>
  (v === 'open' ? k.status !== 'Закрито' : v === 'high' ? k.status !== 'Закрито' && riskScore(k.probability, k.impact) >= 15 : true);
/** Представление рисков; проект риска в архиве — только в «Ризики архівних проєктів» (#32), остальные представления — без архива. */
export const riskInView = (v: RiskView, k: Risk, archivedProject: boolean): boolean => (v === 'archived' ? archivedProject : !archivedProject && riskView(v, k));
export function freshBucket(lastUpdate: string, today: string): '0' | '1' | '2' | '3' {
  const f = freshness(lastUpdate, today); return f === 'g' ? '0' : f === 'y' ? '1' : f === 'r' ? '2' : '3';
}
export const scoreBucket = (s: number): '0' | '1' | '2' => (s >= 15 ? '0' : s >= 8 ? '1' : '2');
export const ofProject = <T extends { projectId: number }>(items: T[], id: number): T[] => items.filter(x => x.projectId === id);
