import { Project, StatusReport, Risk } from '../data/types';
import { isActive, projectFresh, isPlanLate, riskScore } from './status';

export type ProjectView = 'all' | 'strat' | 'problem' | 'mine' | 'pm' | 'stale' | 'late';
export type ReportView = 'all' | 'decision' | 'awaiting' | 'curAwaiting' | 'curDecision' | 'support' | 'supAwaiting' | 'supDecision';
export type RiskView = 'open' | 'high' | 'all' | 'curOpen' | 'curHigh' | 'support' | 'supIssues' | 'archived';
/** 1.7.12 «Проєкти підтримки» — те же представления, что у «Поточні проєкти» (свежесть — по четвергам). */
export type SupportView = ProjectView;
export type ArchiveView = 'all' | 'done' | 'cancelled' | 'strat' | 'mine' | 'pm';
// названия представлений — украинские во всех языках, как в прототипе (подсказка viewsNote)
export const PV: Record<ProjectView, string> = { all: 'Усі проєкти', strat: 'Стратегічні', problem: 'Проблемні', mine: 'Мої проєкти (усі)', pm: 'Я PM', stale: 'Немає свіжого звіту', late: 'Прострочені' };
// 1.7.12: по категории — показатели главной ведут сюда, число на плитке = строки списка
export const RV: Record<ReportView, string> = { all: 'Усі звіти', decision: 'Потребують рішення', awaiting: 'Очікують погодження',
  curAwaiting: 'Поточні — очікують погодження', curDecision: 'Поточні — потребують рішення', support: 'Проєкти підтримки',
  supAwaiting: 'Підтримка — очікують погодження', supDecision: 'Підтримка — потребують рішення' };
export const AV: Record<ArchiveView, string> = { all: 'Усі проєкти', done: 'Завершені', cancelled: 'Скасовані', strat: 'Стратегічні', mine: 'Мої проєкти (усі)', pm: 'Я PM' };
export const KV: Record<RiskView, string> = { open: 'Відкриті', high: 'Високі ризики та проблеми', all: 'Усі елементи',
  curOpen: 'Поточні — відкриті', curHigh: 'Поточні — високі ризики та проблеми', support: 'Підтримка — відкриті', supIssues: 'Підтримка — відкриті проблеми',
  archived: 'Ризики архівних проєктів' };
export const SV: Record<SupportView, string> = PV;

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
    case 'stale': { const f = projectFresh(p, today); return isActive(p.status) && (f === 'r' || f === 'na'); }   // 1.7.12: пропущено два дня подачи и больше или отчётов нет
    case 'late': return isPlanLate(p.planEnd, p.status, today);
    default: return true;
  }
}
/** Представления «Архів»: без условия «активный» (там только завершённые и отменённые); «Завершені» / «Скасовані» — по статусу. */
export const archiveView = (v: ArchiveView, p: Project, me: string): boolean =>
  (v === 'done' ? p.status === 'Завершено' : v === 'cancelled' ? p.status === 'Скасовано' : v === 'strat' ? p.type === 'Стратегічний' : v === 'mine' ? participants(p).indexOf(me.toLowerCase()) >= 0 : v === 'pm' ? isPm(p, me) : true);
/** Номера последних поданных отчётов каждого проекта (дата, затем номер) — #132: запрос рішення актуален только в последнем. */
export function latestReportIds(reports: StatusReport[]): Set<number> {
  const best: Record<number, StatusReport> = {};
  reports.forEach(r => { const b = best[r.projectId]; if (!b || r.date > b.date || (r.date === b.date && r.id > b.id)) best[r.projectId] = r; });
  return new Set(Object.keys(best).map(k => best[Number(k)].id));
}
/** #132: «Потребують рішення» — запрос только из последнего отчёта проекта (новый отчёт снимает запрос прежнего); latest — latestReportIds.
 *  1.7.12: sup — проект отчёта в фазе «Підтримка» (представления по категории: cur… — поточні, sup… / support — підтримка). */
export function reportView(v: ReportView, r: StatusReport, latest?: Set<number>, sup = false): boolean {
  const decision = !!r.decision && (!latest || latest.has(r.id)), awaiting = (r.approval || 'На погодженні') === 'На погодженні';
  switch (v) {
    case 'decision': return decision;
    case 'awaiting': return awaiting;
    case 'curAwaiting': return !sup && awaiting;
    case 'curDecision': return !sup && decision;
    case 'support': return sup;
    case 'supAwaiting': return sup && awaiting;
    case 'supDecision': return sup && decision;
    default: return true;
  }
}
export function riskView(v: RiskView, k: Risk, sup = false): boolean {
  const open = k.status !== 'Закрито', high = open && riskScore(k.probability, k.impact) >= 15;
  switch (v) {
    case 'open': return open;
    case 'high': return high;
    case 'curOpen': return !sup && open;
    case 'curHigh': return !sup && high;
    case 'support': return sup && open;
    case 'supIssues': return sup && open && k.type === 'Проблема';
    default: return true;
  }
}
/** Представление рисков; проект риска в архиве — только в «Ризики архівних проєктів» (#32), остальные представления — без архива. */
export const riskInView = (v: RiskView, k: Risk, archivedProject: boolean, sup = false): boolean => (v === 'archived' ? archivedProject : !archivedProject && riskView(v, k, sup));
export function freshBucket(p: { lastUpdate: string; status: string }, today: string): '0' | '1' | '2' | '3' {
  const f = projectFresh(p, today); return f === 'g' ? '0' : f === 'y' ? '1' : f === 'r' ? '2' : '3';
}
/** #73: фильтр колонки «Звіт» по погодженню самого нового отчёта — вторая группа значений рядом со свежестью:
 *  a1 Погоджено, a2 На погодженні, a3 Повернуто, a4 отчётов не подавали (apBucket прототипа). */
export function apBucket(lastRep: { approval: string } | null | undefined): 'a1' | 'a2' | 'a3' | 'a4' {
  if (!lastRep) return 'a4';
  return lastRep.approval === 'Повернуто' ? 'a3' : lastRep.approval === 'На погодженні' ? 'a2' : 'a1';
}
export const AP_BUCKET: Record<string, string> = { a1: 'Погоджено', a2: 'На погодженні', a3: 'Повернуто' };
export const scoreBucket = (s: number): '0' | '1' | '2' => (s >= 15 ? '0' : s >= 8 ? '1' : '2');
export const ofProject = <T extends { projectId: number }>(items: T[], id: number): T[] => items.filter(x => x.projectId === id);
