import { Project, Assignment, ChangeEvent } from '../data/types';
import { isArch } from './status';

/** Решение PMO о смене PM / власника («Призначення», #43) — как Get-AssignmentPlan синхронизации (общие векторы tests/cases/assignments.json).
 *  Действует запись PMO, владельца сайта или приложения («app»); проект не в архиве; комментарий обязателен; хотя бы одно поле меняется
 *  (пустое — без изменений). E-mail — в нижнем регистре. */
export type AssignReason = '' | 'author' | 'arch' | 'note' | 'same';
export interface AssignIn { author: string; manager: string; owner: string; note: string; }
export interface AssignPlan { valid: boolean; reason: AssignReason; changes: { f: 'pmManager' | 'pmOwner'; from: string; to: string }[]; }
export function assignmentPlan(a: AssignIn, curPm: string, curOwner: string, archived: boolean, pmo: string[], owners: string[]): AssignPlan {
  const bad = (reason: AssignReason): AssignPlan => ({ valid: false, reason, changes: [] });
  const author = a.author || '';
  if (!(author === 'app' || (!!author && owners.indexOf(author) >= 0) || (!!author && pmo.indexOf(author) >= 0))) return bad('author');
  if (archived) return bad('arch');
  if (!(a.note || '').trim()) return bad('note');
  const changes: AssignPlan['changes'] = [];
  if (a.manager && a.manager !== curPm) changes.push({ f: 'pmManager', from: curPm, to: a.manager });
  if (a.owner && a.owner !== curOwner) changes.push({ f: 'pmOwner', from: curOwner, to: a.owner });
  return changes.length ? { valid: true, reason: '', changes } : bad('same');
}

const mail = (p: { email: string } | null | undefined): string => (p ? p.email.toLowerCase() : '');

/** Неперенесённые синхронизацией «Призначення» — сразу на карточке (как раздел 0c синхронизации: по порядку записей).
 *  Автор записи — PMO: добавлять в папку проекта «Призначення» может только группа PMO (права папки), поэтому автор
 *  считается PMO; строгую проверку автора делает синхронизация. */
export function applyAssignments(project: Project, rows: Assignment[]): Project {
  const own = rows.filter(a => a.projectId === project.id && !a.applied).sort((x, y) => x.id - y.id);
  if (!own.length) return project;
  const p: Project = { ...project, assignPending: true };
  const events: ChangeEvent[] = [];
  for (const a of own) {
    const author = mail(a.author);
    const plan = assignmentPlan({ author, manager: mail(a.manager), owner: mail(a.owner), note: a.note }, mail(p.manager), mail(p.owner), isArch(p.status), [author], []);
    if (!plan.valid) continue;
    const diffs: ChangeEvent['diffs'] = [];
    for (const c of plan.changes) {
      if (c.f === 'pmManager') { diffs.push({ f: 'pm', from: p.manager ? p.manager.name : '—', to: a.manager ? a.manager.name : c.to }); p.manager = a.manager; }
      else { diffs.push({ f: 'owner', from: p.owner ? p.owner.name : '—', to: a.owner ? a.owner.name : c.to }); p.owner = a.owner; }
    }
    p.pending = true;
    events.push({ id: -100000 - a.id, date: a.created, who: a.author, kind: 'assign', reason: a.note.trim(), diffs });
  }
  p.pendingEvents = (project.pendingEvents || []).concat(events);
  return p;
}
