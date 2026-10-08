import { Project, Person, Link, StatusReport } from '../data/types';
import { TeamRow, teamText, linksText, validateTeamLinks } from './team';
import { Rag } from './rag';

/** Черновик статус-отчёта (форма reportForm прототипа). */
export interface ReportDraft {
  /** date — дата подання (#62): сегодня, пишется в момент сохранения; periodFrom — начало периода (#69), считается при сохранении. */
  projectId: number; date: string; periodFrom?: string; schedule: Rag; budget: Rag; resources: Rag;
  status: string; type: string; progress: number; start: string; goLive: string; planEnd: string; forecastEnd: string; actualCost: number;
  /** #54: дата завершення (факт) — только при «Завершено» / «Скасовано». */
  actualEnd: string;
  /** #46: новый отчёт на основе повернутого — его номер (srBasedOn). */
  basedOn?: number;
  title: string; done: string; next: string; issues: string; decision: boolean; decisionText: string; keyReason: string;
}
/** Черновик проекта (форма projectForm прототипа). */
export interface ProjectDraft {
  title: string; code: string; department: string; links: Link[]; type: string; priority: string;
  manager: Person | null; owner: Person | null; team: TeamRow[]; start: string; goLive: string; planEnd: string; status: string;
  budget: number; description: string;
}
/** Черновик риска (форма riskForm прототипа). */
export interface RiskDraft {
  projectId: number; title: string; type: string; probability: number; impact: number; owner: Person | null; status: string; due: string; strategy: string; contingency: string; mitigation: string;
}

/** Следующий код проекта: максимальный номер PRJ-NNN + 1, минимум три цифры. */
export function nextCode(codes: string[]): string {
  const nums = codes.map(c => /^PRJ-(\d+)$/.exec(c || '')).filter(m => !!m).map(m => Number(m![1]));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return 'PRJ-' + (next < 10 ? '00' : next < 100 ? '0' : '') + next;
}

/** Новый отчёт с текущими показателями проекта (с учётом неприменённых отчётов). */
export function reportFromProject(p: Project, today: string): ReportDraft {
  return { projectId: p.id, date: today, schedule: '', budget: '', resources: '',
    status: p.status, type: p.type, progress: p.progress, start: p.start, goLive: p.goLive, planEnd: p.planEnd, forecastEnd: p.forecastEnd,
    actualCost: p.actualCost, actualEnd: '', title: '', done: '', next: '', issues: '', decision: false, decisionText: '', keyReason: '' };
}

/** Новый отчёт на основе повернутого PMO: оценки, показатели и тексты повернутого, дата — сегодня. */
export function reportFromReturned(r: StatusReport, p: Project, today: string): ReportDraft {
  const base = reportFromProject(p, today);
  return { ...base, schedule: r.schedule, budget: r.budget, resources: r.resources,
    status: r.status || base.status, type: r.type || base.type, progress: r.progress === null ? base.progress : r.progress,
    start: r.start || base.start, goLive: r.goLive || base.goLive, planEnd: r.planEnd || base.planEnd, forecastEnd: r.forecastEnd || base.forecastEnd,
    actualCost: r.actualCost === null ? base.actualCost : r.actualCost, actualEnd: r.actualEnd || '', basedOn: r.id, title: r.title, done: r.done, next: r.next, issues: r.issues,
    decision: r.decision, decisionText: r.decisionText, keyReason: r.keyReason };
}

// показатели, изменение которых требует причины (keyChanged прототипа): статус, тип, даты — но не % и не затраты
const KEYS: ('status' | 'type' | 'start' | 'goLive' | 'planEnd' | 'forecastEnd')[] = ['status', 'type', 'start', 'goLive', 'planEnd', 'forecastEnd'];
export const keyChanged = (d: ReportDraft, p: Project): boolean => KEYS.some(k => String(d[k] || '') !== String(p[k] || ''));

/** Даты, которые раньше даты старта (#54): запуск, план и прогноз не могут быть раньше старта; пустые не проверяются. */
export type DateKey = 'goLive' | 'planEnd' | 'forecastEnd';
export function datesBeforeStart(d: { start: string; goLive: string; planEnd: string; forecastEnd?: string }): DateKey[] {
  if (!d.start) return [];
  return (['goLive', 'planEnd', 'forecastEnd'] as DateKey[]).filter(k => !!d[k] && String(d[k]) < d.start);
}
/** «% виконання» из поля ввода (#53): целое 0–100, ведущие нули допустимы («00098» → 98); иначе null (вне диапазона, дробь, текст). */
export function parseProgress(txt: string): number | null {
  const s = String(txt).trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : null;
}
/** Статус «Завершено» — % виконання 100 и поле закрыто (#52); «Скасовано» — без изменений. */
export const progressLocked = (status: string): boolean => status === 'Завершено';
/** «Завершено» и «Скасовано» переводят проект в архив — нужна фактическая дата (#54). */
export const archiveStatus = (status: string): boolean => status === 'Завершено' || status === 'Скасовано';

/** Состояние формы отчёта (векторы tests/cases/report-form.json, они же проверяют прототип):
 *  черновик при открытии — «Завершено» сразу 100 % (#52, «на основе повернутого»). */
export const initialReport = (d: ReportDraft): ReportDraft => (progressLocked(d.status) ? { ...d, progress: 100 } : d);
/** Смена статуса (#52): «Завершено» — 100 % и запоминается прежнее значение; уход с «Завершено» — прежнее значение. */
export function switchStatus(d: ReportDraft, prev: number | null, status: string): { d: ReportDraft; prev: number | null } {
  if (progressLocked(status) && !progressLocked(d.status)) return { d: { ...d, status, progress: 100 }, prev: d.progress };
  if (!progressLocked(status) && progressLocked(d.status)) return { d: { ...d, status, progress: prev === null ? d.progress : prev }, prev: null };
  return { d: { ...d, status }, prev };
}
/** Смена проекта в общей форме: показатели — нового проекта (статус, %, даты; поле % снова открыто), оценки и тексты — введённые. */
export const switchProject = (d: ReportDraft, np: Project): ReportDraft => initialReport({ ...reportFromProject(np, d.date), schedule: d.schedule, budget: d.budget, resources: d.resources,
  title: d.title, done: d.done, next: d.next, issues: d.issues, decision: d.decision, decisionText: d.decisionText });
/** Что записывается: при «Завершено» — всегда 100 %; фактическая дата — только при «Завершено» / «Скасовано» (#54). */
export const reportToSave = (d: ReportDraft): ReportDraft => {
  const x = progressLocked(d.status) ? { ...d, progress: 100 } : d;
  return archiveStatus(x.status) ? x : { ...x, actualEnd: '' };
};
/** Выбор проекта (#37, #51): из карточки (projectId) — проект зафиксирован; иначе — первый без отчёта на погодженні;
 *  недоступны проекты с отчётом на погодженні (кроме выбранного — для него форма покажет плашку и не даст сохранить). */
export function reportProjectChoice(act: Project[], projectId: number): { fixed?: Project; first?: Project; disabled: number[] } {
  const fixed = act.filter(p => p.id === projectId)[0];
  const first = fixed || act.filter(p => !p.pendingDate)[0] || act[0];
  return { fixed, first, disabled: act.filter(p => !!p.pendingDate && (!first || p.id !== first.id)).map(p => p.id) };
}

/** Начало периода отчёта (#69; векторы tests/cases/report-period.json, те же — reportPeriodFrom прототипа): с даты последнего
 *  погодженого отчёта проекта (без погодження — применённый) по дату подання; нет — с даты старта, нет старта — с даты создания,
 *  нет и её — с даты подання; не позже даты подання. Повернутые и на погодженні не считаются. */
export function reportPeriodFrom(reports: { date: string; approval: string; applied?: boolean }[], start: string, created: string, today: string): string {
  const ok = reports.filter(r => !!r.date && r.date <= today && (r.approval === 'Погоджено' || (!r.approval && !!r.applied))).map(r => r.date).sort();
  const from = ok.length ? ok[ok.length - 1] : start || (created || '').slice(0, 10) || today;
  return from > today ? today : from;
}

/** Ошибка поля формы: f — поле (для подсветки), k — ключ текста, a — дата для «{date}» в тексте (#67: в сообщении — с чем сравнили). */
export interface FieldErr { f: string; k: string; a?: string }
/** Все ошибки формы отчёта сразу (#40): незаполненные обязательные поля, % вне 0–100, даты раньше старта.
 *  progressText — текст поля «% виконання» (без него берётся d.progress). */
export function reportErrors(d: ReportDraft, p: Project, progressText?: string): FieldErr[] {
  const out: FieldErr[] = [];
  if (!d.schedule) out.push({ f: 'sched', k: 'errReq' });
  if (!d.budget) out.push({ f: 'budget', k: 'errReq' });
  if (!d.resources) out.push({ f: 'res', k: 'errReq' });
  if (keyChanged(d, p) && !d.keyReason.trim()) out.push({ f: 'keyReason', k: 'errReq' });
  if (!d.title.trim()) out.push({ f: 'title', k: 'errReq' });
  if (progressText !== undefined && !progressLocked(d.status) && parseProgress(progressText) === null) out.push({ f: 'progress', k: 'errProgress' });
  datesBeforeStart(d).forEach(k => out.push({ f: k, k: 'errBeforeStart' }));
  // #54 / #64 / #67: фактическая дата — обязательна при «Завершено» / «Скасовано», не раньше старта и не позже даты подання (сегодня);
  // раньше плана и прогноза — можно (досрочно); в сообщении — дата, с которой сравнили
  if (archiveStatus(d.status)) {
    if (!d.actualEnd) out.push({ f: 'actualEnd', k: 'errReq' });
    else if (d.start && d.actualEnd < d.start) out.push({ f: 'actualEnd', k: 'errBeforeStartOn', a: d.start });
    else if (d.date && d.actualEnd > d.date) out.push({ f: 'actualEnd', k: 'errAfterSubmit', a: d.date });
  }
  // #68: «Потрібне рішення керівництва» — опис обязателен (пробелы — пусто)
  if (d.decision && !d.decisionText.trim()) out.push({ f: 'decisionText', k: 'errDecision' });
  return out;
}
/** Общее сообщение формы: есть незаполненные — «Заповніть усі обов'язкові поля, позначені *», иначе — первая ошибка поля. */
export const formErrorText = (errs: FieldErr[]): string => (!errs.length ? '' : errs.some(e => e.k === 'errReq') ? 'errReqAll' : errs[0].k);

/** Ключ ошибки или '' — порядок проверок прототипа: оценки, резюме, дата, причина. */
export function validateReport(d: ReportDraft, p: Project): string {
  if (!d.schedule || !d.budget || !d.resources) return 'errDims';
  if (!d.title.trim()) return 'errSum';
  if (keyChanged(d, p) && !d.keyReason.trim()) return 'errKeyReason';
  return '';
}
/** Код проекта уникален (без учёта регистра и пробелов); otherCodes — коды остальных проектов. Пустой код назначится автоматически. */
export const codeTaken = (code: string, otherCodes: string[]): boolean => {
  const c = code.trim().toUpperCase();
  return !!c && otherCodes.some(x => (x || '').trim().toUpperCase() === c);
};
/** Название для сравнения: без учёта регистра и лишних пробелов (#27). */
export const titleKey = (s: string): string => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
/** otherTitles — названия других проектов, которые видит пользователь (PMO — все); prevTitle — прежнее название при правке:
 *  если название не меняли, уже существующий дубль сохранить можно. */
export const validateProject = (d: ProjectDraft, otherCodes: string[] = [], otherTitles: string[] = [], prevTitle = '', isNew = true): string =>
  (!d.title.trim() ? 'errTitle' : !d.manager ? 'errPM'
    : titleKey(d.title) !== titleKey(prevTitle) && otherTitles.some(x => titleKey(x) === titleKey(d.title)) ? 'errTitleTaken'
    : codeTaken(d.code, otherCodes) ? 'errCode' : isNew && datesBeforeStart(d).length ? 'errDatesOrder' : validateTeamLinks(d.team, d.links));
export const validateRisk = (d: RiskDraft): string => (!d.title.trim() ? 'errRiskTitle' : '');

/** Изменения карточки для журнала («Редагування картки»); описание не журналируется, как в прототипе. */
export function cardDiff(b: Project, d: ProjectDraft): { f: string; from: string; to: string }[] {
  const pairs: [string, string, string][] = [
    ['title', b.title, d.title], ['code', b.code, d.code], ['dept', b.department, d.department], ['links', linksText(b.links), linksText(d.links)],
    ['prio', b.priority, d.priority], ['pm', b.manager ? b.manager.name : '', d.manager ? d.manager.name : ''],
    ['owner', b.owner ? b.owner.name : '', d.owner ? d.owner.name : ''], ['team', teamText(b.team), teamText(d.team)],
    ['budget', String(b.budget || 0), String(d.budget || 0)]];
  return pairs.filter(x => x[1] !== x[2]).map(([f, from, to]) => ({ f, from, to }));
}
