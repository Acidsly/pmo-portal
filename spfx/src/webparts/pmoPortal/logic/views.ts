import { Project, StatusReport, Risk } from '../data/types';
import { isActive, freshness } from './status';

export type ProjectView = 'all' | 'strat' | 'problem' | 'mine' | 'stale';
export type ReportView = 'all' | 'decision';
export type RiskView = 'open' | 'all';
// названия представлений — украинские во всех языках, как в прототипе (подсказка viewsNote)
export const PV: Record<ProjectView, string> = { all: 'Усі проєкти', strat: 'Стратегічні', problem: 'Проблемні', mine: 'Мої проєкти', stale: 'Немає свіжого звіту' };
export const RV: Record<ReportView, string> = { all: 'Усі звіти', decision: 'Потребують рішення' };
export const KV: Record<RiskView, string> = { open: 'Відкриті', all: 'Усі елементи' };

export const participants = (p: Project): string[] =>
  [p.manager, p.owner, ...p.stakeholders].filter(x => !!x && !!x.email).map(x => x!.email.toLowerCase());

export function projectView(v: ProjectView, p: Project, today: string, me: string): boolean {
  switch (v) {
    case 'strat': return isActive(p.status) && p.type === 'Стратегічний';
    case 'problem': return isActive(p.status) && (p.rag === 'Червоний' || p.rag === 'Жовтий');
    case 'mine': return participants(p).indexOf(me.toLowerCase()) >= 0;
    case 'stale': { const f = freshness(p.lastUpdate, today); return isActive(p.status) && (f === 'r' || f === 'na'); }
    default: return true;
  }
}
export const reportView = (v: ReportView, r: StatusReport): boolean => v !== 'decision' || r.decision;
export const riskView = (v: RiskView, k: Risk): boolean => v !== 'open' || k.status !== 'Закрито';
export function freshBucket(lastUpdate: string, today: string): '0' | '1' | '2' | '3' {
  const f = freshness(lastUpdate, today); return f === 'g' ? '0' : f === 'y' ? '1' : f === 'r' ? '2' : '3';
}
export const scoreBucket = (s: number): '0' | '1' | '2' => (s >= 15 ? '0' : s >= 8 ? '1' : '2');
export const ofProject = <T extends { projectId: number }>(items: T[], id: number): T[] => items.filter(x => x.projectId === id);
