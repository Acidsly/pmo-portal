import { Person, TeamMember, Link } from '../data/types';

/** Строка редактора команды: id — у существующей строки списка «Команда проєкту». */
export interface TeamRow { id?: number; user: Person | null; role: string; topics: string; }

/** pmLinks (JSON [{t,u}]) -> ссылки; пустое поле — прежняя ссылка Loop (до миграции). */
export function parseLinks(json: string, loop: string): Link[] {
  if (!json) return loop ? [{ t: 'Loop', u: loop }] : [];
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.filter(x => x && x.u).map(x => ({ t: String(x.t || ''), u: String(x.u) })) : [];
  } catch { return []; }
}

/** Пустые строки отбрасываются; человек в команде один раз (первая строка побеждает). */
export function cleanTeam(rows: TeamRow[]): TeamRow[] {
  const seen: Record<string, boolean> = {};
  return rows.filter(r => {
    if (!r.user) return !!(r.role.trim() || r.topics.trim());
    const k = r.user.email.toLowerCase();
    if (seen[k]) return false;
    seen[k] = true; return true;
  }).map(r => ({ ...r, role: r.role.trim(), topics: r.topics.trim() }));
}

/** Пустые адреса отбрасываются; без названия — «Посилання». */
export const cleanLinks = (links: Link[]): Link[] =>
  links.filter(l => l.u.trim()).map(l => ({ t: l.t.trim() || 'Посилання', u: l.u.trim() }));

/** Ключ ошибки или '': у каждого участника роль и человек, каждая ссылка — https://. */
export function validateTeamLinks(team: TeamRow[], links: Link[]): string {
  if (team.some(r => !r.user || !r.role.trim())) return 'errRole';
  if (links.some(l => l.u.trim() && !/^https:\/\/\S+$/i.test(l.u.trim()))) return 'errUrl';
  return '';
}

/** Что записать в «Команда проєкту»: новые строки, изменённые, удалённые. */
export function teamPlan(before: TeamMember[], after: TeamRow[]): { create: TeamRow[]; update: TeamRow[]; remove: number[] } {
  const keep: Record<number, boolean> = {};
  const create: TeamRow[] = []; const update: TeamRow[] = [];
  after.forEach(r => {
    const b = r.id ? before.filter(x => x.id === r.id)[0] : undefined;
    if (!b) { create.push(r); return; }
    keep[b.id] = true;
    const same = (b.user ? b.user.email.toLowerCase() : '') === (r.user ? r.user.email.toLowerCase() : '') && b.role === r.role && b.topics === r.topics;
    if (!same) update.push(r);
  });
  return { create, update, remove: before.filter(x => !keep[x.id]).map(x => x.id) };
}

/** Строка команды учитывается — как Test-TeamRowAccepted синхронизации (векторы tests/cases/folders.json -> team, R7):
 *  в папке проекта — да; в корне — для нового проекта (права ещё не выданы), от владельца сайта или приложения, или от PM. */
export function teamRowAccepted(inRoot: boolean, projectReady: boolean, author: string, pm: string, owners: string[]): boolean {
  if (!inRoot || !projectReady) return true;
  return author === 'app' || (!!author && owners.indexOf(author) >= 0) || (!!author && author === pm);
}
/** Для приложения: строка в корне списка «Команда проєкту» (не в папке P<ID>). Автор без e-mail — приложение (скрипт):
 *  владельцев сайта приложение не знает — их строку в корне синхронизация переносит в папку в ближайший запуск. */
export function teamVisible(m: { dir?: string; author?: { email: string } | null }, listRoot: string, projectReady: boolean, pm: string): boolean {
  const inRoot = !!m.dir && m.dir.replace(/\/+$/, '').toLowerCase() === listRoot.replace(/\/+$/, '').toLowerCase();
  const a = m.author ? (m.author.email || '').toLowerCase() : '';
  return teamRowAccepted(inRoot, projectReady, a || 'app', pm.toLowerCase(), []);
}

/** Текст для журнала «Редагування картки». */
export const teamText = (rows: { user: Person | null; role: string }[]): string =>
  rows.filter(r => r.user).map(r => `${r.user!.name} — ${r.role}`).join('; ');
export const linksText = (links: Link[]): string => links.map(l => l.t).join(', ');

/** Стейкхолдеры проекта = люди команды (без повторов). */
export function teamPeople(team: TeamMember[]): Person[] {
  const seen: Record<string, boolean> = {};
  return team.map(x => x.user).filter((u): u is Person => !!u && !seen[u.email.toLowerCase()] && (seen[u.email.toLowerCase()] = true));
}
