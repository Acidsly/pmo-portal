/** «Доступ до картки»: список, который пишет синхронизация в скрытое поле pmAccess (JSON). */
export type AccessRole = 'pm' | 'pmMgr' | 'owner' | 'stake' | 'mgr';
export interface AccessRow { e: string; n: string; j: string; l: 'edit' | 'read'; r: AccessRole; }
export interface AccessList { people: AccessRow[]; more: number; }

/** Разбор JSON; пустое или битое значение — null (синхронизация ещё не прошла). Архив — всем просмотр:
 *  отчёт «Завершено» виден на экране сразу, а синхронизация перепишет список позже (как наложение отчётов). */
export function parseAccess(json: string, archived: boolean): AccessList | null {
  if (!json) return null;
  let v: { people?: unknown; more?: unknown };
  try { v = JSON.parse(json); } catch { return null; }
  if (!v || !Array.isArray(v.people)) return null;
  const people = (v.people as Partial<AccessRow>[]).filter(x => x && x.e).map(x => ({
    e: String(x.e), n: String(x.n || x.e), j: String(x.j || ''),
    l: (archived || x.l !== 'edit' ? 'read' : 'edit') as AccessRow['l'], r: (x.r || 'mgr') as AccessRole }));
  return { people, more: Number(v.more) || 0 };
}
