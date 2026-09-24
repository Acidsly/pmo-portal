import { Project, StatusReport } from '../data/types';
import { calcRag, Rag } from './rag';
import { isActive, isArch } from './status';
import { addDays } from './dates';
import { byDateThenId } from './overlay';

export interface DonutCounts { g: number; y: number; r: number; none: number; total: number; }
export interface Snapshot { date: string; g: number; y: number; r: number; }

/** Активные проекты по общему стану (кольцо «Портфель за станом»). */
export function donutCounts(projects: Project[]): DonutCounts {
  const act = projects.filter(p => isActive(p.status));
  const n = (v: Rag): number => act.filter(p => p.rag === v).length;
  return { g: n('Зелений'), y: n('Жовтий'), r: n('Червоний'), none: n(''), total: act.length };
}

/** 7 срезов через 14 дней (последний — сегодня): стан каждого проекта по последнему отчёту на дату среза. */
export function snapshots(projects: Project[], reports: StatusReport[], today: string): Snapshot[] {
  const out: Snapshot[] = [];
  for (let k = 6; k >= 0; k--) {
    const tt = addDays(today, -14 * k);
    const c = { g: 0, y: 0, r: 0 };
    for (const p of projects) {
      if (p.status === 'Скасовано') continue;
      const archivedOn = p.archivedAt || p.lastUpdate;
      if (isArch(p.status) && archivedOn && tt > archivedOn) continue;
      const rs = reports.filter(r => r.projectId === p.id && r.date <= tt).sort(byDateThenId);
      if (!rs.length) continue;
      const last = rs[rs.length - 1];
      const rag = calcRag(last.schedule, last.budget, last.resources);
      if (rag === 'Зелений') c.g++; else if (rag === 'Жовтий') c.y++; else if (rag === 'Червоний') c.r++;
    }
    out.push({ date: tt, ...c });
  }
  return out;
}
