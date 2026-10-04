import { StatusReport, Approval } from '../data/types';
import { calcRag, Rag } from './rag';

export const AP_PENDING = 'На погодженні';
export const AP_OK = 'Погоджено';
export const AP_RETURNED = 'Повернуто';

type Dim = 's' | 'b' | 'r';
export interface ApprovalIn { decision: string; s: string; b: string; r: string; note: string; }
export interface ApprovalOut { valid: boolean; decision: string; s: string; b: string; r: string; rag: string; apply: boolean; changed: Dim[]; }

/** Решение PMO по отчёту — как Get-ApprovalResult синхронизации (общие векторы tests/cases/approval.json).
 *  Пустой цвет PMO — без изменений; смена цвета или возврат — только с комментарием; решённый отчёт повторно не решается. */
export function approvalResult(rep: { s: string; b: string; r: string; approval: string }, ap: ApprovalIn | null): ApprovalOut {
  const cur = rep.approval || AP_PENDING;
  const out: ApprovalOut = { valid: true, decision: cur, s: rep.s, b: rep.b, r: rep.r, rag: '', apply: cur === AP_OK, changed: [] };
  if (ap) {
    const note = (ap.note || '').trim();
    const next = { s: ap.s || out.s, b: ap.b || out.b, r: ap.r || out.r };
    const chg = (['s', 'b', 'r'] as Dim[]).filter(k => next[k] !== out[k]);
    if (cur !== AP_PENDING) out.valid = false;
    else if (ap.decision === AP_RETURNED) { if (note) out.decision = AP_RETURNED; else out.valid = false; }
    else if (ap.decision === AP_OK) {
      if (chg.length && !note) out.valid = false;
      else { out.decision = AP_OK; out.apply = true; out.changed = chg; chg.forEach(k => { out[k] = next[k]; }); }
    } else out.valid = false;
  }
  out.rag = calcRag(out.s as Rag, out.b as Rag, out.r as Rag);
  return out;
}

/** Решение PMO для правила «какое действует» (Get-EffectiveApproval синхронизации, векторы reports.json -> effective). */
export interface ApprovalRec { id: number; decision: string; s: string; b: string; r: string; note: string; project: number; trusted: boolean; }
/** Действующее решение по отчёту: по порядку Id, только доверенные и с проектом отчёта; первое действительное от
 *  «На погодженні» (approvalResult), остальные — уже нет (R10). rep — оценки отчёта сейчас (после переноса решения). */
export function effectiveApproval(rep: { s: string; b: string; r: string; project: number }, aps: ApprovalRec[]): { id: number; decision: string } | null {
  for (const a of aps.slice().sort((x, y) => x.id - y.id)) {
    if (!a.trusted || a.project !== rep.project) continue;
    const res = approvalResult({ s: rep.s, b: rep.b, r: rep.r, approval: AP_PENDING }, { decision: a.decision, s: a.s, b: a.b, r: a.r, note: a.note });
    if (res.valid) return { id: a.id, decision: res.decision };
  }
  return null;
}
/** Отчёты, чьё «Погоджено» подтверждено действующим решением PMO (как $APPROVED синхронизации).
 *  Все видимые решения — доверенные: добавлять в «Погодження звітів» может только PMO (права списка). */
export function approvedIds(reports: StatusReport[], approvals: Approval[]): Record<number, boolean> {
  const out: Record<number, boolean> = {};
  for (const r of reports) {
    const aps = approvals.filter(a => a.reportId === r.id).map(a => ({ id: a.id, decision: a.decision, s: a.s, b: a.b, r: a.r, note: a.note, project: a.projectId, trusted: true }));
    const e = aps.length ? effectiveApproval({ s: r.schedule, b: r.budget, r: r.resources, project: r.projectId }, aps) : null;
    if (e && e.decision === AP_OK) out[r.id] = true;
  }
  return out;
}
/** Отчёты «на погодженні» (#29, #51): не применённые, без решения; по дате, затем по номеру — первый задаёт «на погодженні · дата». */
export const pendingReports = (rs: StatusReport[]): StatusReport[] => rs.filter(r => !r.applied && (!r.approval || r.approval === AP_PENDING))
  .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));

/** Отчёт с учётом свежего решения PMO, которое синхронизация ещё не перенесла (первое по времени действительное решение). */
export function withApproval(r: StatusReport, approvals: Approval[]): StatusReport {
  const cur = r.approval || AP_PENDING;
  if (cur !== AP_PENDING) return { ...r, approval: cur };
  const mine = approvals.filter(a => a.reportId === r.id && !a.applied).sort((a, b) => a.id - b.id);
  for (const a of mine) {
    const res = approvalResult({ s: r.schedule, b: r.budget, r: r.resources, approval: cur }, { decision: a.decision, s: a.s, b: a.b, r: a.r, note: a.note });
    if (res.valid) return { ...r, approval: res.decision, schedule: res.s as Rag, budget: res.b as Rag, resources: res.r as Rag,
      approvedBy: a.author, approvedAt: a.created, approvalNote: a.note.trim(), approvalFresh: true };
  }
  return { ...r, approval: cur };
}
