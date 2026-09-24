import { Project, StatusReport } from '../data/types';
import { calcRag } from './rag';

const byDateThenId = (a: StatusReport, b: StatusReport): number => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);

/** Накладывает неприменённые отчёты (srApplied = нет) на карточку — те же правила, что шаг 1 Invoke-PMOSync.ps1. */
export function applyPending(project: Project, reports: StatusReport[]): Project {
  const pending = reports.filter(r => r.projectId === project.id && !r.applied).sort(byDateThenId);
  if (!pending.length) return project;
  const p: Project = { ...project, pending: true };
  for (const r of pending) {
    if (r.status) p.status = r.status;
    if (r.type) p.type = r.type;
    if (r.progress !== null) p.progress = r.progress;
    if (r.start) p.start = r.start;
    if (r.goLive) p.goLive = r.goLive;
    if (r.planEnd) p.planEnd = r.planEnd;
    if (r.forecastEnd) p.forecastEnd = r.forecastEnd;
    if (r.actualCost !== null) p.actualCost = r.actualCost;
    if (p.status === 'Завершено') { p.status = 'Архівний'; p.archivedAt = r.date; }
    // самый свежий отчёт задаёт стан, дату отчёта и «Останній апдейт»
    if (!p.lastUpdate || r.date >= p.lastUpdate) {
      const rag = calcRag(r.schedule, r.budget, r.resources);
      if (rag) p.rag = rag;
      p.lastUpdate = r.date; p.lastReport = r.title;
    }
  }
  return p;
}
export { byDateThenId };
