import { Project, Person } from '../data/types';
import { Rag } from './rag';

/** Черновик статус-отчёта (форма reportForm прототипа). */
export interface ReportDraft {
  projectId: number; date: string; period: string; schedule: Rag; budget: Rag; resources: Rag;
  status: string; type: string; progress: number; start: string; goLive: string; planEnd: string; forecastEnd: string; actualCost: number;
  title: string; done: string; next: string; issues: string; decision: boolean; decisionText: string; keyReason: string;
}
/** Черновик проекта (форма projectForm прототипа). */
export interface ProjectDraft {
  title: string; code: string; department: string; loop: string; type: string; priority: string;
  manager: Person | null; owner: Person | null; stakeholders: Person[]; start: string; goLive: string; planEnd: string; status: string;
  budget: number; description: string;
}
/** Черновик риска (форма riskForm прототипа). */
export interface RiskDraft {
  projectId: number; title: string; type: string; probability: number; impact: number; owner: Person | null; status: string; due: string; mitigation: string;
}

/** Следующий код проекта: максимальный номер PRJ-NNN + 1, минимум три цифры. */
export function nextCode(codes: string[]): string {
  const nums = codes.map(c => /^PRJ-(\d+)$/.exec(c || '')).filter(m => !!m).map(m => Number(m![1]));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return 'PRJ-' + (next < 10 ? '00' : next < 100 ? '0' : '') + next;
}

/** Новый отчёт с текущими показателями проекта (с учётом неприменённых отчётов). */
export function reportFromProject(p: Project, today: string): ReportDraft {
  return { projectId: p.id, date: today, period: '2 тижні', schedule: '', budget: '', resources: '',
    status: p.status, type: p.type, progress: p.progress, start: p.start, goLive: p.goLive, planEnd: p.planEnd, forecastEnd: p.forecastEnd,
    actualCost: p.actualCost, title: '', done: '', next: '', issues: '', decision: false, decisionText: '', keyReason: '' };
}

// показатели, изменение которых требует причины (keyChanged прототипа): статус, тип, даты — но не % и не затраты
const KEYS: ('status' | 'type' | 'start' | 'goLive' | 'planEnd' | 'forecastEnd')[] = ['status', 'type', 'start', 'goLive', 'planEnd', 'forecastEnd'];
export const keyChanged = (d: ReportDraft, p: Project): boolean => KEYS.some(k => String(d[k] || '') !== String(p[k] || ''));

/** Ключ ошибки или '' — порядок проверок прототипа: оценки, резюме, дата, причина. */
export function validateReport(d: ReportDraft, p: Project): string {
  if (!d.schedule || !d.budget || !d.resources) return 'errDims';
  if (!d.title.trim()) return 'errSum';
  if (!d.date) return 'errDate';
  if (keyChanged(d, p) && !d.keyReason.trim()) return 'errKeyReason';
  return '';
}
export const validateProject = (d: ProjectDraft): string => (!d.title.trim() ? 'errTitle' : !d.manager ? 'errPM' : '');
export const validateRisk = (d: RiskDraft): string => (!d.title.trim() ? 'errRiskTitle' : '');

const names = (xs: Person[]): string => xs.map(x => x.name).join(', ');
/** Изменения карточки для журнала («Редагування картки»); описание не журналируется, как в прототипе. */
export function cardDiff(b: Project, d: ProjectDraft): { f: string; from: string; to: string }[] {
  const pairs: [string, string, string][] = [
    ['title', b.title, d.title], ['code', b.code, d.code], ['dept', b.department, d.department], ['loop', b.loop, d.loop],
    ['prio', b.priority, d.priority], ['pm', b.manager ? b.manager.name : '', d.manager ? d.manager.name : ''],
    ['owner', b.owner ? b.owner.name : '', d.owner ? d.owner.name : ''], ['stakeholders', names(b.stakeholders), names(d.stakeholders)],
    ['budget', String(b.budget || 0), String(d.budget || 0)]];
  return pairs.filter(x => x[1] !== x[2]).map(([f, from, to]) => ({ f, from, to }));
}
