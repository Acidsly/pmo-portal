export interface ColDef<R> { label: string; sort?: (r: R) => string | number | null; filter?: (r: R) => string | string[]; }
export interface TableState { cols: string[]; sort: { id: string; dir: 'asc' | 'desc' } | null; filters: Record<string, string[]>; }

const empty = (v: unknown): boolean => v === '' || v === null || v === undefined || v === -1;
const vals = (v: string | string[]): string[] => (Array.isArray(v) ? v.map(String) : [String(v)]);

/** Фильтры и сортировка — как applyTable прототипа: пустые значения всегда внизу, строки по uk. */
export function applyTable<R>(rows: R[], defs: Record<string, ColDef<R>>, st: TableState): R[] {
  let data = rows.filter(r => Object.keys(st.filters).every(id => {
    const want = st.filters[id]; const d = defs[id];
    return !want || !want.length || !d || !d.filter || vals(d.filter(r)).some(x => want.indexOf(x) >= 0);
  }));
  const sd = st.sort && defs[st.sort.id] && defs[st.sort.id].sort;
  if (st.sort && sd) {
    const dir = st.sort.dir === 'desc' ? -1 : 1;
    data = data.slice().sort((a, b) => {
      const x = sd(a), y = sd(b), ex = empty(x), ey = empty(y);
      if (ex && ey) return 0; if (ex) return 1; if (ey) return -1;
      return dir * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'uk'));
    });
  }
  return data;
}
export function filterValues<R>(rows: R[], def: ColDef<R>): string[] {
  const set: Record<string, true> = {};
  if (def.filter) rows.forEach(r => vals(def.filter!(r)).forEach(v => { set[v] = true; }));
  return Object.keys(set).sort((a, b) => a.localeCompare(b, 'uk'));
}
export function nextSort(st: TableState, id: string): TableState {
  const cur = st.sort && st.sort.id === id ? st.sort.dir : '';
  return { ...st, sort: cur === '' ? { id, dir: 'asc' } : cur === 'asc' ? { id, dir: 'desc' } : null };
}
export function toggleCol(st: TableState, id: string, lock: string): TableState {
  if (id === lock) return st;
  return { ...st, cols: st.cols.indexOf(id) >= 0 ? st.cols.filter(c => c !== id) : st.cols.concat(id) };
}
export function moveCol(st: TableState, id: string, dir: -1 | 1, lock: string): TableState {
  const i = st.cols.indexOf(id), j = i + dir;
  // как в прототипе: на первую позицию не сдвигается ничего, закреплённая колонка не сдвигается вниз
  if (i < 0 || j < 1 || j >= st.cols.length || (dir === 1 && id === lock)) return st;
  const cols = st.cols.slice(); cols[i] = cols[j]; cols[j] = id;
  return { ...st, cols };
}
/** Состояние из localStorage; неизвестные колонки отбрасываются, закреплённая всегда есть (позиция 2). */
export function loadState(key: string, defaults: string[], known: string[], lock: string): TableState {
  let st: TableState = { cols: defaults.slice(), sort: null, filters: {} };
  try { const raw = localStorage.getItem('pmo-table5-' + key); if (raw) st = { ...st, ...JSON.parse(raw) }; } catch { /* нет хранилища */ }
  st.cols = st.cols.filter(c => known.indexOf(c) >= 0);
  if (st.cols.indexOf(lock) < 0) st.cols.splice(Math.min(2, st.cols.length), 0, lock);
  return st;
}
export function saveState(key: string, st: TableState): void { try { localStorage.setItem('pmo-table5-' + key, JSON.stringify(st)); } catch { /* нет хранилища */ } }
