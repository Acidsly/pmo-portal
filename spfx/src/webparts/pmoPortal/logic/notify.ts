import { ChangeEntry, ChangeEvent, Comment, FeedbackRow, Person, Project, Risk } from '../data/types';
import { toEvents } from './changes';
import { isArch } from './status';
import { teamNotice, onlyHidden } from './team';

/** Сповіщення в приложении (колокольчик): какие события журнала и комментарии — мои и какие из них новые.
 *  Правило «кто что видит» — общие векторы tests/cases/notify.json (их же возьмёт синхронизация для писем, часть 2). */
/** Сповіщення: окно журнала в днях. */
export const NOTIFY_DAYS = 14;

export type NotifyKind = 'created' | 'assigned' | 'submitted' | 'decided' | 'applied' | 'archived' | 'risk' | 'cardEdit' | 'comment' | 'teamAdded' | 'teamRole' | 'feedback' | 'release';

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
    // #84: «вас додано до команди» / «змінено вашу роль» — только самому человеку (kind уже персональный, см. notifyItems)
    case 'teamAdded': case 'teamRole': return true;
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
  key: string; source: 'journal' | 'comment' | 'feedback' | 'release'; id: number; projectId: number; kind: NotifyKind; date: string; who: Person | null;
  ev?: ChangeEvent; comment?: Comment; unread: boolean;
  /** «Відгук розглянуто»: мой отзыв, его статус и ответ; «Новий випуск»: версия и дата выпуска. */
  fb?: { id: number; status: string; answer: string }; rel?: { ver: string; date: string };
}
/** «Прочитано до» (журнал / комментарии) и открытые поверх метки события (ключи «j<номер>» / «c<номер>»). */
export interface ReadMarks { readId: number; readCmId: number; seen?: string[]; }
/** Сколько открытых событий храним поверх метки (новейшие) — строка «Прочитане» не растёт без конца. */
export const SEEN_MAX = 200;
const OTHER_KEY = /^(f\d+@\S+|v[\w.]+)$/;
/** Сколько ключей отзывов и выпусков храним (окно — 14 дней, больше не набирается). */
export const SEEN_OTHER = 50;
/** Открытые события: без повторов, только номера больше метки (остальное и так прочитано), не больше SEEN_MAX новейших. */
export function pruneSeen(seen: string[], readId: number, readCmId: number): string[] {
  const out: { k: string; id: number }[] = [];
  // отзыв («f<номер>@<когда розглянуто>») и выпуск («v<версия>») — без меток, только ключом; не больше SEEN_OTHER
  const other = seen.filter((k, i) => OTHER_KEY.test(k) && seen.indexOf(k) === i).sort().slice(-SEEN_OTHER);
  for (const k of seen) {
    const m = /^([jc])(\d+)$/.exec(k); if (!m) continue;
    const id = Number(m[2]);
    if (id <= (m[1] === 'j' ? readId : readCmId) || out.some(x => x.k === k)) continue;
    out.push({ k, id });
  }
  // устойчивый порядок (номер, затем ключ): одинаковый набор — одинаковая строка, без лишних записей
  return out.sort((a, b) => b.id - a.id || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)).slice(0, SEEN_MAX).map(x => x.k).concat(other);
}
const keyed = (x: { source: string }): boolean => x.source === 'feedback' || x.source === 'release';

/** Новые сверху: непрочитанное — номер больше метки. Событие, дописанное синхронизацией после прочтения, снова новое — целиком. */
export function notifyList(items: Omit<NotifyItem, 'unread'>[], marks: ReadMarks | null): NotifyItem[] {
  const seen = marks && marks.seen ? marks.seen : [];
  return items.map(x => ({ ...x, unread: !!marks && (keyed(x) || x.id > (x.source === 'journal' ? marks.readId : marks.readCmId)) && seen.indexOf(x.key) < 0 }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
}
/** «Позначити все прочитаним»: метки — до последнего показанного (только растут), открытые ниже метки — не нужны. */
export function marksAfterView(items: NotifyItem[], marks: ReadMarks): ReadMarks {
  const max = (src: NotifyItem['source'], cur: number): number => items.filter(x => x.source === src).reduce((m, x) => Math.max(m, x.id), cur);
  const readId = max('journal', marks.readId), readCmId = max('comment', marks.readCmId);
  return { readId, readCmId, seen: pruneSeen((marks.seen || []).concat(items.filter(keyed).map(x => x.key)), readId, readCmId) };
}
/** Открыл событие — прочитано именно оно (метки не двигаются). */
export function marksAfterOpen(item: NotifyItem, marks: ReadMarks): ReadMarks {
  return { readId: marks.readId, readCmId: marks.readCmId, seen: pruneSeen((marks.seen || []).concat(item.key), marks.readId, marks.readCmId) };
}
/** Запись в свою строку: к свежей версии — метки максимумом, открытые — объединением (параллельная вкладка не теряет своё). */
export function mergeMarks(cur: ReadMarks, next: ReadMarks): ReadMarks {
  const readId = Math.max(cur.readId, next.readId), readCmId = Math.max(cur.readCmId, next.readCmId);
  return { readId, readCmId, seen: pruneSeen((next.seen || []).concat(cur.seen || []), readId, readCmId) };
}
/** Роли проекта для правила: PM, власник, команда (люди «Команди проєкту» и стейкхолдери). */
export function notifyProject(p: Project): NotifyProject {
  const team = (p.team || []).map(m => (m.user ? m.user.email : '')).concat((p.stakeholders || []).map(s => s.email)).filter(Boolean);
  return { status: p.status, pm: p.manager ? p.manager.email : '', owner: p.owner ? p.owner.email : '', team };
}

/** #колокольчик: «Відгук розглянуто» — мои отзывы, у которых за окно сменились статус или ответ (fpDecidedAt пишет синхронизация);
 *  «Новий випуск» — текущий выпуск заметок «Що змінилося», если он моложе окна. Векторы — spfx/test/notify.test.ts. */
export function extraItems(feedback: FeedbackRow[], rel: { ver: string; date: string } | null, sinceIso: string): Omit<NotifyItem, 'unread'>[] {
  const out: Omit<NotifyItem, 'unread'>[] = [];
  for (const r of feedback) {
    if (!r.mine || !r.decidedAt || r.decidedAt < sinceIso || r.status === 'Новий') continue;
    out.push({ key: `f${r.id}@${r.decidedAt}`, source: 'feedback', id: r.id, projectId: 0, kind: 'feedback', date: r.decidedAt, who: null,
      fb: { id: r.id, status: r.status, answer: r.answer } });
  }
  const m = rel ? /^(\d\d)\.(\d\d)\.(\d{4})$/.exec(rel.date) : null;
  if (rel && m) {
    const iso = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 9).toISOString();   // 09:00 местного — день выпуска
    if (iso >= sinceIso) out.push({ key: 'v' + rel.ver, source: 'release', id: 0, projectId: 0, kind: 'release', date: iso, who: null, rel });
  }
  return out;
}

/** Строки панели «Сповіщення»: события журнала за окно и комментарии — только мои по правилу (notifyFor), только видимые проекты. */
export function notifyItems(d: { projects: Project[]; risks: Risk[]; comments: Comment[]; recent: ChangeEntry[] }, me: string, isPmo: boolean, sinceIso: string): Omit<NotifyItem, 'unread'>[] {
  const byId: Record<number, Project> = {}; d.projects.forEach(p => { byId[p.id] = p; });
  const out: Omit<NotifyItem, 'unread'>[] = [];
  for (const ev of toEvents(d.recent)) {
    const p = byId[ev.projectId || 0]; if (!p) continue;
    let kind = notifyKind(ev);
    // #84: правка команды, которая касается меня, — отдельное событие (даже если я не PM и не власник)
    const tn = kind === 'cardEdit' ? teamNotice(ev.diffs, me) : '';
    if (tn) kind = tn; else if (onlyHidden(ev)) continue;   // правка из одних служебных отметок — показывать нечего
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
