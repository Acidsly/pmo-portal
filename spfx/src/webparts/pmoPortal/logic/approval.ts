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
