import { Project, StatusReport, ChangeEvent } from '../data/types';
import { calcRag } from './rag';

const byDateThenId = (a: StatusReport, b: StatusReport): number => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id);

const SHOWN: [keyof Project, string][] = [['status', 'status'], ['rag', 'rag'], ['type', 'type'], ['progress', 'progress'],
  ['start', 'start'], ['goLive', 'golive'], ['planEnd', 'plan'], ['forecastEnd', 'fc']];

/** Накладывает неприменённые отчёты (srApplied = нет) на карточку — те же правила, что шаг 1 Invoke-PMOSync.ps1. */
export function applyPending(project: Project, reports: StatusReport[]): Project {
  // как синхронизация: карточку меняет только отчёт PM проекта
  const pm = project.manager ? project.manager.email.toLowerCase() : '';
  const pending = reports.filter(r => r.projectId === project.id && !r.applied && !!pm && !!r.author && r.author.email.toLowerCase() === pm).sort(byDateThenId);
  if (!pending.length) return project;
  const p: Project = { ...project, pending: true };
  const events: ChangeEvent[] = [];
  for (const r of pending) {
    const before = { ...p };
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
    // событие истории — как строки журнала синхронизации (поля DISPLAY, значения — как Human)
    const diffs = SHOWN.filter(([k]) => String(before[k] || '') !== String(p[k] || ''))
      .map(([k, f]) => ({ f, from: human(k, String(before[k] || '')), to: human(k, String(p[k] || '')) }));
    if (diffs.length) events.push({ id: -r.id, date: r.date, who: r.author, kind: 'report', reason: [r.keyReason, r.title].filter(Boolean).join(' · '), diffs });
  }
  p.pendingEvents = events;
  return p;
}

// ключевые показатели журнала (DISPLAY синхронизации): поле модели -> ключ FLD прототипа
/** Значение для истории — как Human синхронизации: даты dd.MM.yyyy, % — с «%», пусто — «—». */
function human(k: keyof Project, v: string): string {
  if (!v) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return k === 'progress' ? v + '%' : v;
}
export { byDateThenId };
