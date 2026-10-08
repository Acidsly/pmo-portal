import { Project, StatusReport } from '../data/types';
import { calcRag, Rag } from './rag';
import { isActive, isArch } from './status';
import { addDays } from './dates';
import { byDateThenId } from './overlay';

export interface DonutCounts { g: number; y: number; r: number; none: number; total: number; }
/** na — проект уже был, но погодженого отчёта на дату среза ещё нет (серый). */
export interface Snapshot { date: string; g: number; y: number; r: number; na: number; }

/** Активные проекты по общему стану (кольцо «Портфель за станом»). */
export function donutCounts(projects: Project[]): DonutCounts {
  const act = projects.filter(p => isActive(p.status));
  const n = (v: Rag): number => act.filter(p => p.rag === v).length;
  return { g: n('Зелений'), y: n('Жовтий'), r: n('Червоний'), none: n(''), total: act.length };
}

/** 7 срезов через 14 дней (последний — сегодня): каждый проект, который уже существовал на дату среза и ещё не был в архиве, —
 *  по последнему (погодженому) отчёту на эту дату; без отчёта — «не оцінено». Последний срез совпадает с кольцом «Портфель за станом». */
export function snapshots(projects: Project[], reports: StatusReport[], today: string): Snapshot[] {
  const out: Snapshot[] = [];
  for (let k = 6; k >= 0; k--) {
    const tt = addDays(today, -14 * k);
    const c = { g: 0, y: 0, r: 0, na: 0 };
    for (const p of projects) {
      // завершённые и отменённые — до даты архивации учитываются, с неё — нет; дата — архивации, иначе фактическая, иначе последнего отчёта;
      // даты нет совсем — в архиве на любую дату (как кольцо)
      const archivedOn = p.archivedAt || p.actualEnd || p.lastUpdate;
      if (isArch(p.status) && (!archivedOn || tt >= archivedOn)) continue;   // в день архивации проект уже в архиве — как в кольце
      if (p.created && p.created.slice(0, 10) > tt) continue;   // проекта на дату среза ещё не было
      const rs = reports.filter(r => r.projectId === p.id && r.date <= tt).sort(byDateThenId);
      if (!rs.length) { c.na++; continue; }
      const last = rs[rs.length - 1];
      const rag = calcRag(last.schedule, last.budget, last.resources);
      if (rag === 'Зелений') c.g++; else if (rag === 'Жовтий') c.y++; else if (rag === 'Червоний') c.r++; else c.na++;
    }
    out.push({ date: tt, ...c });
  }
  return out;
}
