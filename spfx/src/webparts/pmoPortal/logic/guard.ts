import { Project } from '../data/types';
import { isArch } from './status';

/** Свежее состояние проекта с сервера прямо перед записью (SpRepo.fresh): права, PM, статус (с эталоном), отчёты на погодженні. */
export interface Fresh {
  project: Project;          // свежая карточка (эталон наложен)
  etag: string;              // версия записи проекта — для If-Match
  owner: boolean;            // владелец сайта (полный доступ) — правила PM к нему не применяются
  pending: { id: number; date: string; author: string }[];   // отчёты проекта «на погодженні» (не применённые)
  lastApprovedDate: string;  // дата последнего погодженого отчёта проекта
  report?: { id: number; approval: string; author: string; decisions: number };   // для погодження: состояние отчёта и число решений PMO
}
export type Action = 'editCard' | 'report' | 'risk' | 'team' | 'comment' | 'approve' | 'return';
export type Guard = { ok: true } | { ok: false; key: string; args?: Record<string, string> };

const dmy = (iso: string): string => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : iso; };
const low = (s: string | undefined | null): string => (s || '').toLowerCase();

/** Можно ли выполнить действие по свежим данным (векторы — spfx/test/guard.test.ts). Отказ — ключ сообщения и подстановки. */
export function guard(action: Action, me: string, f: Fresh, opts: { reportDate?: string } = {}): Guard {
  const p = f.project, pm = low(p.manager ? p.manager.email : ''), meL = low(me);
  if (isArch(p.status)) return { ok: false, key: 'gArchived' };
  if (action === 'comment') return { ok: true };
  if (action === 'approve' || action === 'return') {
    const r = f.report;
    if (!r) return { ok: false, key: 'gDecided', args: { state: '' } };
    if ((r.approval && r.approval !== 'На погодженні') || r.decisions > 0) return { ok: false, key: 'gDecided', args: { state: r.approval || 'На погодженні' } };
    // отчёт не текущего PM — только вернуть; владелец сайта может погодити любой (синхронизация доверяет владельцам)
    if (action === 'approve' && low(r.author) !== pm && !f.owner) return { ok: false, key: 'gNotPmAuthor' };
    return { ok: true };
  }
  // правки PM: карточка, отчёт, риск, команда
  if (!f.owner) {
    if (pm !== meL) return { ok: false, key: 'gPmChanged', args: { pm: p.manager ? p.manager.name : '—' } };
    if (!p.canEdit) return { ok: false, key: 'gPmSoon' };
  }
  if (action === 'report') {
    if (f.pending.length) return { ok: false, key: 'gPending', args: { date: dmy(f.pending[0].date) } };
    if (opts.reportDate && f.lastApprovedDate && opts.reportDate < f.lastApprovedDate) return { ok: false, key: 'gOldDate', args: { date: dmy(f.lastApprovedDate) } };
  }
  return { ok: true };
}

/** Поля карточки, которые правит PM (форма «Редагувати»): сравнение снимка с открытия формы и свежей записи — конфликт правок. */
export function cardFields(p: Project): Record<string, string> {
  return { title: p.title, code: p.code, priority: p.priority, department: p.department, pm: low(p.manager ? p.manager.email : ''),
    owner: low(p.owner ? p.owner.email : ''), budget: String(p.budget || 0), description: p.description || '', links: JSON.stringify(p.links || []) };
}
/** Изменённые другим пользователем поля: ключи, где свежее значение отличается от снимка. */
export function changedFields(snap: Record<string, string>, fresh: Record<string, string>): string[] {
  return Object.keys(snap).filter(k => String(snap[k]) !== String(fresh[k]));
}
