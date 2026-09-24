import { Project } from './types';
import { ReportDraft, ProjectDraft, RiskDraft } from '../logic/forms';

type Body = Record<string, unknown>;

/** Дата «только дата» для записи — полдень UTC, как ToSpDate синхронизации; пусто — null. */
export const spDate = (iso: string): string | null => (iso ? `${iso}T12:00:00Z` : null);
const loop = (url: string): { Url: string; Description: string } | null => (url ? { Url: url, Description: 'Loop' } : null);

/** Новый статус-отчёт. Статус, тип, даты и затраты — только изменённые (синхронизация переносит лишь заполненные поля); % — всегда. */
export function reportBody(d: ReportDraft, p: Project): Body {
  const b: Body = { Title: d.title.trim(), srProjectId: d.projectId, srDate: spDate(d.date), srPeriod: d.period,
    srSchedule: d.schedule, srBudget: d.budget, srResources: d.resources, srDone: d.done, srNext: d.next, srIssues: d.issues,
    srDecision: d.decision, srDecisionText: d.decision ? d.decisionText : '', srKeyReason: d.keyReason, srApplied: false };
  if (d.status !== p.status) b.srStatus = d.status;
  if (d.type !== p.type) b.srType = d.type;
  // % выполнения — в каждом отчёте (матрица состояний в карточке); без изменения синхронизация журнал не пишет
  b.srProgress = Math.max(0, Math.min(100, d.progress));
  if (d.actualCost !== p.actualCost) b.srActualCost = Math.max(0, d.actualCost);
  const dates: [keyof ReportDraft & keyof Project, string][] = [['start', 'srStart'], ['goLive', 'srGoLive'], ['planEnd', 'srPlanEnd'], ['forecastEnd', 'srForecastEnd']];
  dates.forEach(([k, f]) => { if ((d[k] || '') !== (p[k] || '')) b[f] = spDate(String(d[k] || '')); });
  return b;
}

const people = (d: ProjectDraft): Body => ({ pmManagerId: d.manager ? d.manager.id : null, pmOwnerId: d.owner ? d.owner.id : null,
  pmStakeholdersId: (d.stakeholders || []).map(s => s.id) });

/** Новый проект: статус, тип и даты задаются при создании (дальше — только через отчёт). */
export function projectBody(d: ProjectDraft, code: string): Body {
  return { Title: d.title.trim(), pmCode: code, pmType: d.type, pmPriority: d.priority, pmDepartment: d.department, ...people(d),
    pmStatus: d.status, pmStart: spDate(d.start), pmGoLive: spDate(d.goLive), pmPlanEnd: spDate(d.planEnd), pmBudget: d.budget || 0,
    pmDescription: d.description, pmLoop: loop(d.loop), pmProgress: 0 };
}

/** Правка карточки: без ключевых показателей; изменения дописываются в pmEditLog — синхронизация перенесёт их в журнал. */
export function projectEditBody(d: ProjectDraft, diffs: { f: string; from: string; to: string }[], who: string, reason: string, prevLog: string): Body {
  const b: Body = { Title: d.title.trim(), pmCode: d.code, pmPriority: d.priority, pmDepartment: d.department, ...people(d),
    pmBudget: d.budget || 0, pmDescription: d.description, pmLoop: loop(d.loop) };
  if (diffs.length) {
    let entries: unknown[] = [];
    try { const prev = prevLog ? JSON.parse(prevLog) : undefined; if (prev && Array.isArray(prev.entries)) entries = prev.entries; } catch { /* повреждённый журнал — начинаем заново */ }
    entries.push({ when: new Date().toISOString(), who, reason, diffs });
    b.pmEditLog = JSON.stringify({ entries });
  }
  return b;
}

export const riskBody = (d: RiskDraft): Body => ({ riProjectId: d.projectId, Title: d.title.trim(), riType: d.type, riProbability: d.probability,
  riImpact: d.impact, riOwnerId: d.owner ? d.owner.id : null, riStatus: d.status, riDue: spDate(d.due), riMitigation: d.mitigation });

export const commentBody = (projectId: number, text: string): Body => ({ cmProjectId: projectId, cmText: text.trim() });
