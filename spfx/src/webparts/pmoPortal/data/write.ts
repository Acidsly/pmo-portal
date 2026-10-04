import { Project, TeamMember } from './types';
import { roundAway } from '../logic/overlay';
import { TeamRow } from '../logic/team';
import { ReportDraft, ProjectDraft, RiskDraft, archiveStatus } from '../logic/forms';

type Body = Record<string, unknown>;

/** Дата «только дата» для записи — полдень UTC, как ToSpDate синхронизации; пусто — null. */
export const spDate = (iso: string): string | null => (iso ? `${iso}T12:00:00Z` : null);

/** Новый статус-отчёт. Статус, тип, даты и затраты — только изменённые (синхронизация переносит лишь заполненные поля); % — всегда. */
export function reportBody(d: ReportDraft, p: Project): Body {
  const b: Body = { Title: d.title.trim(), srProjectId: d.projectId, srDate: spDate(d.date), srPeriod: d.period,
    srSchedule: d.schedule, srBudget: d.budget, srResources: d.resources, srDone: d.done, srNext: d.next, srIssues: d.issues,
    srDecision: d.decision, srDecisionText: d.decision ? d.decisionText : '', srKeyReason: d.keyReason, srApplied: false };
  if (d.status !== p.status) b.srStatus = d.status;
  if (d.type !== p.type) b.srType = d.type;
  // % выполнения — в каждом отчёте (матрица состояний в карточке); без изменения синхронизация журнал не пишет
  b.srProgress = Math.max(0, Math.min(100, d.progress));
  // суммы — целые доллары, x,5 — вверх (как синхронизация, ошибка сверки №5)
  if (d.actualCost !== p.actualCost) b.srActualCost = Math.max(0, roundAway(d.actualCost));
  const dates: [keyof ReportDraft & keyof Project, string][] = [['start', 'srStart'], ['goLive', 'srGoLive'], ['planEnd', 'srPlanEnd'], ['forecastEnd', 'srForecastEnd']];
  dates.forEach(([k, f]) => { if ((d[k] || '') !== (p[k] || '')) b[f] = spDate(String(d[k] || '')); });
  // #54: фактическая дата — только при «Завершено» / «Скасовано»
  if (archiveStatus(d.status) && d.actualEnd) b.srActualEnd = spDate(d.actualEnd);
  return b;
}

// стейкхолдеров (pmStakeholders) пишет синхронизация из «Команда проєкту»
const people = (d: ProjectDraft): Body => ({ pmManagerId: d.manager ? d.manager.id : null, pmOwnerId: d.owner ? d.owner.id : null });

/** Новый проект: статус, тип и даты задаются при создании (дальше — только через отчёт). */
export function projectBody(d: ProjectDraft, code: string): Body {
  return { Title: d.title.trim(), pmCode: code, pmType: d.type, pmPriority: d.priority, pmDepartment: d.department, ...people(d),
    pmStatus: d.status, pmStart: spDate(d.start), pmGoLive: spDate(d.goLive), pmPlanEnd: spDate(d.planEnd), pmBudget: roundAway(d.budget || 0),
    pmDescription: d.description, pmLinks: JSON.stringify(d.links), pmProgress: 0 };
}

/** Правка карточки: без ключевых показателей; изменения дописываются в pmEditLog — синхронизация перенесёт их в журнал. */
export function projectEditBody(d: ProjectDraft, diffs: { f: string; from: string; to: string }[], who: string, reason: string, prevLog: string): Body {
  const b: Body = { Title: d.title.trim(), pmCode: d.code, pmPriority: d.priority, pmDepartment: d.department, ...people(d),
    pmBudget: roundAway(d.budget || 0), pmDescription: d.description, pmLinks: JSON.stringify(d.links) };
  if (diffs.length) {
    let entries: unknown[] = [];
    try { const prev = prevLog ? JSON.parse(prevLog) : undefined; if (prev && Array.isArray(prev.entries)) entries = prev.entries; } catch { /* повреждённый журнал — начинаем заново */ }
    // ключ записи: синхронизация переносит в журнал по ключам — без потерь и дублей (tests/cases/editlog.json)
    entries.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), when: new Date().toISOString(), who, reason, diffs });
    b.pmEditLog = JSON.stringify({ entries });
  }
  return b;
}

export const riskBody = (d: RiskDraft): Body => ({ riProjectId: d.projectId, Title: d.title.trim(), riType: d.type, riProbability: d.probability,
  riImpact: d.impact, riOwnerId: d.owner ? d.owner.id : null, riStatus: d.status, riDue: spDate(d.due), riMitigation: d.mitigation, riStrategy: d.strategy || null, riContingency: d.contingency });

/** Строка «Команда проєкту» (человек должен иметь id на сайте — ensureUser). */
export const teamBody = (projectId: number, r: TeamRow): Body => ({ tmProjectId: projectId, tmUserId: r.user ? r.user.id : null, tmRole: r.role, tmTopics: r.topics });
export const teamRows = (team: TeamMember[]): TeamRow[] => team.map(x => ({ id: x.id, user: x.user, role: x.role, topics: x.topics }));

export const commentBody = (projectId: number, text: string): Body => ({ cmProjectId: projectId, cmText: text.trim() });
