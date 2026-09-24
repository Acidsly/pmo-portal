/* eslint-disable @typescript-eslint/no-explicit-any -- ответы REST SharePoint нетипизированы, типы задаются здесь */
import { Person, Project, StatusReport, Risk, Comment, ChangeEntry } from './types';
import { dateOnly } from '../logic/dates';
import { Rag } from '../logic/rag';

const PERSON = ['Id', 'Title', 'EMail'];
const people = (...fields: string[]): string[] => fields.reduce<string[]>((a, f) => a.concat(PERSON.map(x => `${f}/${x}`)), []);

export const PROJECT_SELECT = ['Id', 'Title', 'pmCode', 'pmType', 'pmPriority', 'pmDepartment', 'pmStatus', 'pmRAG', 'pmProgress',
  'pmStart', 'pmGoLive', 'pmPlanEnd', 'pmForecastEnd', 'pmArchivedAt', 'pmBudget', 'pmActualCost', 'pmLastUpdate', 'pmLastReport',
  'pmLastComment', 'pmLoop', 'pmDescription', 'EffectiveBasePermissions', ...people('pmManager', 'pmOwner', 'pmStakeholders')].join(',');
export const PROJECT_EXPAND = 'pmManager,pmOwner,pmStakeholders';
export const REPORT_SELECT = ['Id', 'Title', 'srProjectId', 'srDate', 'srPeriod', 'srSchedule', 'srBudget', 'srResources', 'srStatus', 'srType',
  'srProgress', 'srStart', 'srGoLive', 'srPlanEnd', 'srForecastEnd', 'srActualCost', 'srKeyReason', 'srDone', 'srNext', 'srIssues',
  'srDecision', 'srDecisionText', 'srApplied', ...people('Author')].join(',');
export const REPORT_EXPAND = 'Author';
export const RISK_SELECT = ['Id', 'Title', 'riProjectId', 'riType', 'riProbability', 'riImpact', 'riStatus', 'riDue', 'riMitigation',
  ...people('riOwner')].join(',');
export const RISK_EXPAND = 'riOwner';

const s = (v: any): string => (v === null || v === undefined ? '' : String(v));
const n = (v: any): number => (typeof v === 'number' ? v : 0);
const nn = (v: any): number | null => (typeof v === 'number' ? v : null);

export const mapPerson = (v: any): Person | null =>
  v && v.Id ? { id: v.Id, name: s(v.Title), email: s(v.EMail) } : null;

/** Право редактирования элемента: EditListItems — бит 0x4 в младшем слове EffectiveBasePermissions. */
export function canEdit(perm: { High: string; Low: string } | undefined): boolean {
  return !!perm && (Number(perm.Low) & 0x4) !== 0;
}

export function mapProject(r: any): Project {
  return { id: r.Id, code: s(r.pmCode), title: s(r.Title), type: s(r.pmType), priority: s(r.pmPriority),
    manager: mapPerson(r.pmManager), owner: mapPerson(r.pmOwner),
    stakeholders: (r.pmStakeholders || []).map(mapPerson).filter(Boolean) as Person[],
    department: s(r.pmDepartment), status: s(r.pmStatus), rag: s(r.pmRAG) as Rag, progress: n(r.pmProgress),
    start: dateOnly(r.pmStart), goLive: dateOnly(r.pmGoLive), planEnd: dateOnly(r.pmPlanEnd), forecastEnd: dateOnly(r.pmForecastEnd),
    archivedAt: dateOnly(r.pmArchivedAt), budget: n(r.pmBudget), actualCost: n(r.pmActualCost), lastUpdate: dateOnly(r.pmLastUpdate),
    lastReport: s(r.pmLastReport), lastComment: s(r.pmLastComment), loop: r.pmLoop ? s(r.pmLoop.Url) : '', description: s(r.pmDescription),
    canEdit: canEdit(r.EffectiveBasePermissions), pending: false };
}

export function mapReport(r: any): StatusReport {
  return { id: r.Id, projectId: r.srProjectId, date: dateOnly(r.srDate), period: s(r.srPeriod),
    schedule: s(r.srSchedule) as Rag, budget: s(r.srBudget) as Rag, resources: s(r.srResources) as Rag,
    status: s(r.srStatus), type: s(r.srType), progress: nn(r.srProgress), start: dateOnly(r.srStart), goLive: dateOnly(r.srGoLive),
    planEnd: dateOnly(r.srPlanEnd), forecastEnd: dateOnly(r.srForecastEnd), actualCost: nn(r.srActualCost), keyReason: s(r.srKeyReason),
    title: s(r.Title), done: s(r.srDone), next: s(r.srNext), issues: s(r.srIssues), decision: r.srDecision === true,
    decisionText: s(r.srDecisionText), applied: r.srApplied === true, author: mapPerson(r.Author) };
}

export function mapRisk(r: any): Risk {
  return { id: r.Id, projectId: r.riProjectId, title: s(r.Title), type: s(r.riType), probability: n(r.riProbability), impact: n(r.riImpact),
    owner: mapPerson(r.riOwner), status: s(r.riStatus), due: dateOnly(r.riDue), mitigation: s(r.riMitigation) };
}

export const COMMENT_SELECT = ['Id', 'cmProjectId', 'cmText', 'Created', ...people('Author')].join(',');
export const COMMENT_EXPAND = 'Author';
export const CHANGE_SELECT = ['Id', 'kcProjectId', 'kcDate', 'kcKind', 'kcField', 'kcFrom', 'kcTo', 'kcReason', ...people('kcChangedBy')].join(',');
export const CHANGE_EXPAND = 'kcChangedBy';
export const mapComment = (r: any): Comment => ({ id: r.Id, projectId: r.cmProjectId, text: s(r.cmText), created: s(r.Created), author: mapPerson(r.Author) });
export const mapChange = (r: any): ChangeEntry => ({ id: r.Id, projectId: r.kcProjectId, date: s(r.kcDate), who: mapPerson(r.kcChangedBy),
  kind: s(r.kcKind), field: s(r.kcField), from: s(r.kcFrom), to: s(r.kcTo), reason: s(r.kcReason) });
