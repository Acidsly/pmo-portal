import { ChangeEntry, ChangeEvent, Comment, Person, Project, Risk } from '../data/types';
import { toEvents } from './changes';
import { isArch } from './status';

/** Сповіщення в приложении (колокольчик): какие события журнала и комментарии — мои и какие из них новые.
 *  Правило «кто что видит» — общие векторы tests/cases/notify.json (их же возьмёт синхронизация для писем, часть 2). */
/** Сповіщення: окно журнала в днях. */
export const NOTIFY_DAYS = 14;

export type NotifyKind = 'created' | 'assigned' | 'submitted' | 'decided' | 'applied' | 'archived' | 'risk' | 'cardEdit' | 'comment';

/** Вид события истории: «Статус → Завершено / Скасовано» (прежнее «→ Архівний») в событии отчёта — архив; правка в обход, откаченная синхронизацией, — как отчёт. */
export function notifyKind(ev: { kind: ChangeEvent['kind']; diffs: { f: string; to: string }[] }): NotifyKind {
  switch (ev.kind) {
    case 'create': return 'created';
    case 'assign': return 'assigned';
    case 'submit': return 'submitted';
    case 'approval': return 'decided';
    case 'risk': return 'risk';
    case 'edit': return 'cardEdit';
    default: return ev.diffs.some(d => d.f === 'status' && isArch(d.to)) ? 'archived' : 'applied';
  }
}

export interface NotifyProject { status: string; pm: string; owner: string; team: string[]; }
export interface NotifyCtx {
  me: string;
  /** участник группы PMO или владелец сайта */
  isPmo: boolean;
  /** риск события сейчас: оценка и власник (риска нет — null) */
  risk?: { score: number; owner: string } | null;
}
const low = (s: string | undefined | null): string => (s || '').trim().toLowerCase();

/** Моё ли событие (матрица плана 2026-10-08-notifications-bell.md): роли — сейчас; своё — нет; архив — только событие архива. */
export function notifyFor(kind: NotifyKind, author: string, diffs: { f: string; to: string }[], p: NotifyProject, ctx: NotifyCtx): boolean {
  const me = low(ctx.me);
  if (!me || low(author) === me) return false;
  if (isArch(p.status) && kind !== 'archived') return false;
  const pm = low(p.pm) === me, owner = low(p.owner) === me, team = p.team.some(x => low(x) === me);
  switch (kind) {
    case 'submitted': return ctx.isPmo;
    case 'archived': return pm || owner || team || ctx.isPmo;
    case 'created': case 'assigned': case 'decided': case 'applied': case 'comment': return pm || owner || team;
    case 'cardEdit': return pm || owner;
    case 'risk': {
      if (pm) return true;
      if (ctx.risk && low(ctx.risk.owner) === me) return true;
      const sc = ctx.risk ? ctx.risk.score : Number((diffs.filter(d => d.f === 'kScore').pop() || { to: '0' }).to) || 0;
      return (owner || team) && sc >= 15;
    }
    default: return false;
  }
}

/** Строка панели «Сповіщення»: событие журнала (номер — наибольший номер его строк) или комментарий. */
export interface NotifyItem {
  key: string; source: 'journal' | 'comment'; id: number; projectId: number; kind: NotifyKind; date: string; who: Person | null;
  ev?: ChangeEvent; comment?: Comment; unread: boolean;
}
export interface ReadMarks { readId: number; readCmId: number; }

/** Новые сверху: непрочитанное — номер больше метки. Событие, дописанное синхронизацией после прочтения, снова новое — целиком. */
export function notifyList(items: Omit<NotifyItem, 'unread'>[], marks: ReadMarks | null): NotifyItem[] {
  return items.map(x => ({ ...x, unread: !!marks && x.id > (x.source === 'journal' ? marks.readId : marks.readCmId) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
}
/** Метки после просмотра панели: только растут. */
export function marksAfterView(items: NotifyItem[], marks: ReadMarks): ReadMarks {
  const max = (src: NotifyItem['source'], cur: number): number => items.filter(x => x.source === src).reduce((m, x) => Math.max(m, x.id), cur);
  return { readId: max('journal', marks.readId), readCmId: max('comment', marks.readCmId) };
}
/** Роли проекта для правила: PM, власник, команда (люди «Команди проєкту» и стейкхолдери). */
export function notifyProject(p: Project): NotifyProject {
  const team = (p.team || []).map(m => (m.user ? m.user.email : '')).concat((p.stakeholders || []).map(s => s.email)).filter(Boolean);
  return { status: p.status, pm: p.manager ? p.manager.email : '', owner: p.owner ? p.owner.email : '', team };
}

/** Строки панели «Сповіщення»: события журнала за окно и комментарии — только мои по правилу (notifyFor), только видимые проекты. */
export function notifyItems(d: { projects: Project[]; risks: Risk[]; comments: Comment[]; recent: ChangeEntry[] }, me: string, isPmo: boolean, sinceIso: string): Omit<NotifyItem, 'unread'>[] {
  const byId: Record<number, Project> = {}; d.projects.forEach(p => { byId[p.id] = p; });
  const out: Omit<NotifyItem, 'unread'>[] = [];
  for (const ev of toEvents(d.recent)) {
    const p = byId[ev.projectId || 0]; if (!p) continue;
    const kind = notifyKind(ev);
    const rk = ev.ref && ev.ref.type === 'risk' ? d.risks.filter(x => x.id === ev.ref!.id)[0] : undefined;
    const risk = rk ? { score: rk.probability * rk.impact, owner: rk.owner ? rk.owner.email : '' } : null;
    if (!notifyFor(kind, ev.who ? ev.who.email : '', ev.diffs, notifyProject(p), { me, isPmo, risk })) continue;
    out.push({ key: 'j' + (ev.lastId || ev.id), source: 'journal', id: ev.lastId || ev.id, projectId: p.id, kind, date: ev.date, who: ev.who, ev });
  }
  for (const c of d.comments) {
    const p = byId[c.projectId]; if (!p || c.created < sinceIso) continue;
    if (!notifyFor('comment', c.author ? c.author.email : '', [], notifyProject(p), { me, isPmo })) continue;
    out.push({ key: 'c' + c.id, source: 'comment', id: c.id, projectId: p.id, kind: 'comment', date: c.created, who: c.author, comment: c });
  }
  return out;
}
