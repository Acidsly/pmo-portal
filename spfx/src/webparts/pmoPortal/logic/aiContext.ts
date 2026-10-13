import { Project, StatusReport, Risk, ChangeEntry } from '../data/types';
import { ReportDraft } from './forms';
import { AP_OK, AP_RETURNED } from './approval';
import { calcRag, Rag } from './rag';
import { riskScore } from './status';
import { AiLang } from './aiCheck';

/** Что передаётся помощнику отчёта (план помощника, 2.1 и 2.2). draft — текущая форма (для «Перевірити з ШІ»),
 *  prevCheck — прежний результат проверки (чтобы ИИ не повторял оставленные PM пункты). */
export interface AiContextIn {
  project: Project; reports: StatusReport[]; risks: Risk[]; changes: ChangeEntry[]; draft?: ReportDraft; prevCheck?: string;
  lang: AiLang; today: string;
}

const RISK_CLOSED = 'Закрито';
/** Поля журнала, изменения которых попадают в контекст, и их имена в контексте. */
const KEY_FIELDS: Record<string, string> = { pmStatus: 'phase', pmProgress: 'progress', pmGoLive: 'goLive', pmPlanEnd: 'planEnd', pmForecastEnd: 'forecastEnd' };

/** Тексты людей — без маркеров блока данных «<<DATA>>» / «<</DATA>>» (любой регистр и пробелы; до неизменности —
 *  чтобы «<<DA<</DATA>>TA>>» не собрался в маркер), иначе данные могли бы закрыть блок и стать инструкцией. */
export function cleanText(s: string | null | undefined): string {
  let t = String(s === undefined || s === null ? '' : s);
  for (let prev = ''; prev !== t;) { prev = t; t = t.replace(/<\s*<\s*\/?\s*D\s*A\s*T\s*A\s*>\s*>/gi, ''); }
  return t;
}
const num = (x: number | null | undefined): number | null => (typeof x === 'number' && !isNaN(x) ? x : null);
const day = (s: string | undefined): string => (s || '').slice(0, 10);
/** Погоджений отчёт — как reportPeriodFrom: «Погоджено», а до погоджень — применённый. */
const isApproved = (r: StatusReport): boolean => r.approval === AP_OK || (!r.approval && !!r.applied);
/** Новые сверху: дата, затем номер (порядок не зависит от порядка входа). */
const newest = (a: { date: string; id: number }, b: { date: string; id: number }): number =>
  (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);

/** Контекст помощника статус-отчёта (векторы tests/cases/ai-context.json): только проект формы, белый список полей
 *  (без e-mail, команды, стейкхолдеров и служебных полей), тексты людей очищены от маркеров DATA.
 *  - проект: код, название, фаза, тип, %, даты, бюджет, затраты, lastUpdate — дата последнего погодженого отчёта;
 *  - до 3 последних погоджених отчётов; последний отчёт, если повернутий, — комментарий PMO;
 *  - риски: открытые и закрытые с даты последнего погодженого отчёта (дата закрытия — по журналу «Ризик»;
 *    погоджених нет — все закрытые), просрочен ли срок на today;
 *  - изменения фазы, %, дат запуска, плана и прогноза из журнала с даты последнего погодженого отчёта;
 *  - текущая форма (если передана и того же проекта) и прежний результат проверки.
 *  Длиннее maxChars — обрезка: тексты старых отчётов (самый новый остаётся), потом журнал, потом закрытые риски;
 *  тогда truncated и "truncated": true в JSON. Порядок ключей и элементов постоянный. */
export function buildReportContext(input: AiContextIn, maxChars: number = 50000): { json: string; truncated: boolean } {
  const p = input.project, pid = p.id;
  const reps = (input.reports || []).filter(r => r.projectId === pid).slice().sort(newest);
  const approved = reps.filter(isApproved);
  const since = approved.length ? approved[0].date : '';
  const latest = reps[0];

  const reportOut = (r: StatusReport, full: boolean): Record<string, unknown> => {
    const o: Record<string, unknown> = { date: r.date, schedule: r.schedule, budget: r.budget, resources: r.resources,
      rag: calcRag(r.schedule as Rag, r.budget as Rag, r.resources as Rag) };
    if (full) {
      o.summary = cleanText(r.title); o.done = cleanText(r.done); o.next = cleanText(r.next); o.issues = cleanText(r.issues);
      o.decision = !!r.decision; o.decisionText = cleanText(r.decisionText);
    }
    return o;
  };

  // дата закрытия риска — последняя строка журнала «Ризик» со статусом → «Закрито»
  const closedAt: Record<number, string> = {};
  (input.changes || []).filter(c => c.projectId === pid && c.kind === 'Ризик' && c.field === 'riStatus' && c.to === RISK_CLOSED && !!c.item)
    .forEach(c => { const d = day(c.date); if (!closedAt[c.item!] || closedAt[c.item!] < d) closedAt[c.item!] = d; });
  const risks = (input.risks || []).filter(k => k.projectId === pid)
    .filter(k => k.status !== RISK_CLOSED || !since || (!!closedAt[k.id] && closedAt[k.id] >= since))
    .sort((a, b) => a.id - b.id);
  const riskOut = (k: Risk): Record<string, unknown> => ({ type: cleanText(k.type), title: cleanText(k.title), probability: num(k.probability),
    impact: num(k.impact), score: riskScore(k.probability, k.impact), status: cleanText(k.status), strategy: cleanText(k.strategy),
    mitigation: cleanText(k.mitigation), contingency: cleanText(k.contingency), due: k.due || '',
    overdue: !!k.due && k.due < input.today && k.status !== RISK_CLOSED });

  const changes = (input.changes || []).filter(c => c.projectId === pid && !!KEY_FIELDS[c.field] && (!since || day(c.date) >= since))
    .sort((a, b) => (day(a.date) < day(b.date) ? -1 : day(a.date) > day(b.date) ? 1 : a.id - b.id));
  const changeOut = (c: ChangeEntry): Record<string, unknown> => ({ date: day(c.date), field: KEY_FIELDS[c.field], from: cleanText(c.from), to: cleanText(c.to) });

  const d = input.draft && input.draft.projectId === pid ? input.draft : undefined;
  const draftOut = d ? { schedule: d.schedule, budget: d.budget, resources: d.resources, phase: cleanText(d.status), type: cleanText(d.type),
    progress: num(d.progress), start: d.start || '', goLive: d.goLive || '', planEnd: d.planEnd || '', forecastEnd: d.forecastEnd || '',
    actualEnd: d.actualEnd || '', actualCost: num(d.actualCost), keyReason: cleanText(d.keyReason), summary: cleanText(d.title),
    done: cleanText(d.done), next: cleanText(d.next), issues: cleanText(d.issues), decision: !!d.decision, decisionText: cleanText(d.decisionText) } : undefined;

  const render = (cut: number): string => {
    const o: Record<string, unknown> = {
      lang: input.lang, today: input.today,
      project: { code: cleanText(p.code), title: cleanText(p.title), phase: cleanText(p.status), type: cleanText(p.type), progress: num(p.progress),
        start: p.start || '', goLive: p.goLive || '', planEnd: p.planEnd || '', forecastEnd: p.forecastEnd || '', actualEnd: p.actualEnd || '',
        budget: num(p.budget), actualCost: num(p.actualCost), lastUpdate: since || p.lastUpdate || '' },
      reports: approved.slice(0, 3).map((r, i) => reportOut(r, i === 0 || cut < 1))
    };
    if (latest && latest.approval === AP_RETURNED) o.returned = { date: latest.date, summary: cleanText(latest.title), note: cleanText(latest.approvalNote) };
    o.risks = risks.filter(k => cut < 3 || k.status !== RISK_CLOSED).map(riskOut);
    o.changes = cut < 2 ? changes.map(changeOut) : [];
    if (draftOut) o.draft = draftOut;
    if (input.prevCheck) o.prevCheck = cleanText(input.prevCheck);
    if (cut > 0) o.truncated = true;
    return JSON.stringify(o);
  };

  let json = render(0);
  let cut = 0;
  while (json.length > maxChars && cut < 3) { cut++; json = render(cut); }
  return { json, truncated: cut > 0 };
}
