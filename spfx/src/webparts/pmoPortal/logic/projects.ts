/** Батьківський проєкт (план 2026-10-19-parent-project.md, векторы tests/cases/parent.json — их же прогоняет прототип).
 *  Связь — только для группировки и будущей аналитики: прав не даёт. Вложенность — любая, архивные — можно. */
export interface ParentLink { id: number; parentId: number }

/** Потомки проекта на любой глубине (по цепочкам родителей); цикл, уже записанный в данных, не зацикливает. */
function descendants<T extends ParentLink>(projects: T[], id: number): Set<number> {
  const out = new Set<number>();
  let front = [id];
  while (front.length) {
    const next: number[] = [];
    for (const p of projects) if (front.indexOf(p.parentId) >= 0 && !out.has(p.id) && p.id !== id) { out.add(p.id); next.push(p.id); }
    front = next;
  }
  return out;
}

/** Варианты выбора родителя: все проекты, кроме самого проекта и его потомков (иначе цикл: проект — родитель самому себе
 *  через цепочку). У проекта, стоящего в уже записанном цикле, — без всех участников цикла. selfId 0 — новый проект. */
export function parentChoices<T extends ParentLink>(projects: T[], selfId: number): T[] {
  if (!selfId) return projects.slice();
  const no = descendants(projects, selfId); no.add(selfId);
  return projects.filter(p => !no.has(p.id));
}

/** Прямые дочерние проекты. */
export const childrenOf = <T extends ParentLink>(projects: T[], id: number): T[] => projects.filter(p => p.parentId === id && p.id !== id);

export interface ParentRef { id: number; title: string; code?: string }
/** Подпись родителя: «PRJ-001 · Назва»; кода нет (родитель не виден) — название из записи; нет и его — «#id». */
export const parentLabel = (r: ParentRef | null | undefined): string => (!r ? '' : r.code ? `${r.code} · ${r.title}` : r.title || `#${r.id}`);
/** Название и код родителя — из видимых проектов (SharePoint может не отдать название родителя без доступа к нему). */
export function withParentNames<T extends { id: number; code: string; title: string; parent?: ParentRef | null }>(projects: T[]): T[] {
  const byId: Record<number, T> = {}; projects.forEach(p => { byId[p.id] = p; });
  return projects.map(p => (p.parent && byId[p.parent.id] ? { ...p, parent: { id: p.parent.id, title: byId[p.parent.id].title, code: byId[p.parent.id].code } } : p));
}
