import { applyTable, filterValues, nextSort, toggleCol, moveCol, loadState, saveState, ColDef, TableState } from '../src/webparts/pmoPortal/logic/table';

interface Row { id: number; t: string; n: number | null; tags: string[]; }
const rows: Row[] = [{ id: 1, t: 'Б', n: 2, tags: ['x'] }, { id: 2, t: 'А', n: null, tags: ['y', 'x'] }, { id: 3, t: 'В', n: 1, tags: [] }];
const defs: Record<string, ColDef<Row>> = {
  t: { label: 'T', sort: r => r.t, filter: r => r.t },
  n: { label: 'N', sort: r => r.n },
  tags: { label: 'Tags', filter: r => r.tags }
};
const st = (x: Partial<TableState>): TableState => ({ cols: ['t', 'n'], sort: null, filters: {}, ...x });

test('сортировка: числа как числа, пустые внизу в обоих направлениях', () => {
  expect(applyTable(rows, defs, st({ sort: { id: 'n', dir: 'asc' } })).map(r => r.id)).toEqual([3, 1, 2]);
  expect(applyTable(rows, defs, st({ sort: { id: 'n', dir: 'desc' } })).map(r => r.id)).toEqual([1, 3, 2]);
  expect(applyTable(rows, defs, st({ sort: { id: 't', dir: 'asc' } })).map(r => r.id)).toEqual([2, 1, 3]);
});
test('фильтр: значения и массивы (пересечение), без фильтра — все', () => {
  expect(applyTable(rows, defs, st({ filters: { t: ['А', 'В'] } })).map(r => r.id)).toEqual([2, 3]);
  expect(applyTable(rows, defs, st({ filters: { tags: ['x'] } })).map(r => r.id)).toEqual([1, 2]);
  expect(applyTable(rows, defs, st({ filters: { tags: [] } }))).toHaveLength(3);
});
test('filterValues — уникальные, по алфавиту', () => {
  expect(filterValues(rows, defs.tags)).toEqual(['x', 'y']);
  expect(filterValues(rows, defs.t)).toEqual(['А', 'Б', 'В']);
});
test('nextSort: asc -> desc -> нет; другая колонка — asc', () => {
  const a = nextSort(st({}), 't'); expect(a.sort).toEqual({ id: 't', dir: 'asc' });
  const b = nextSort(a, 't'); expect(b.sort).toEqual({ id: 't', dir: 'desc' });
  expect(nextSort(b, 't').sort).toBeNull();
  expect(nextSort(b, 'n').sort).toEqual({ id: 'n', dir: 'asc' });
});
test('колонки: закреплённую не снять; первую не сдвинуть; перемещение', () => {
  expect(toggleCol(st({ cols: ['s', 't', 'n'] }), 't', 't').cols).toEqual(['s', 't', 'n']);
  expect(toggleCol(st({ cols: ['s', 't', 'n'] }), 'n', 't').cols).toEqual(['s', 't']);
  expect(toggleCol(st({ cols: ['s', 't'] }), 'n', 't').cols).toEqual(['s', 't', 'n']);
  expect(moveCol(st({ cols: ['s', 't', 'n'] }), 't', -1, 't').cols).toEqual(['s', 't', 'n']);   // на позицию 0 нельзя
  expect(moveCol(st({ cols: ['s', 't', 'n', 'x'] }), 'n', 1, 't').cols).toEqual(['s', 't', 'x', 'n']);
  expect(moveCol(st({ cols: ['s', 't', 'n', 'x'] }), 'x', -1, 't').cols).toEqual(['s', 't', 'x', 'n']);
  expect(moveCol(st({ cols: ['s', 't', 'n'] }), 't', 1, 't').cols).toEqual(['s', 't', 'n']);   // закреплённая не вниз
});

describe('фильтры колонок не запоминаются (#23, #24): колонки и сортировка — да', () => {
  test('сохранение без фильтров, загрузка — фильтры пустые', () => {
    const mem: Record<string, string> = {};
    (global as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => mem[k] || null, setItem: (k: string, v: string) => { mem[k] = v; },
      removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 } as Storage;
    saveState('t1', { cols: ['a', 'b'], sort: { id: 'a', dir: 'desc' }, filters: { a: ['x'] } });
    expect(JSON.parse(mem['pmo-table6-t1'])).toEqual({ cols: ['a', 'b'], sort: { id: 'a', dir: 'desc' } });
    const st = loadState('t1', ['a'], ['a', 'b'], 'a');
    expect(st.filters).toEqual({}); expect(st.sort).toEqual({ id: 'a', dir: 'desc' }); expect(st.cols).toEqual(['a', 'b']);
  });
});

// #35, #49: ширина колонок перетаскиванием, запоминается для каждого списка
import { resizeCol, resetWidths, colWidths, cleanWidths, COL_MIN, COL_MAX } from '../src/webparts/pmoPortal/logic/table';
describe('ширина колонок пользователя', () => {
  const st = { cols: ['a', 'b', 'c'], sort: null, filters: {} };
  test('перетаскивание: начальная + сдвиг, в пределах', () => {
    expect(resizeCol(st, 'b', 120, 35).widths).toEqual({ b: 155 });
    expect(resizeCol(st, 'b', 120, -500).widths).toEqual({ b: COL_MIN });
    expect(resizeCol(st, 'b', 120, 5000).widths).toEqual({ b: COL_MAX });
    expect(resizeCol(resizeCol(st, 'a', 100, 10), 'c', 90, 0).widths).toEqual({ a: 110, c: 90 });
  });
  test('показ: заданные пользователем, остальные — по раскладке; без раскладки — нет', () => {
    expect(colWidths(['a', 'b', 'c'], { b: 155 }, [100, 120, 90])).toEqual([100, 155, 90]);
    expect(colWidths(['a', 'b'], { b: 155 }, null)).toBeNull();
    expect(colWidths(['a', 'b'], undefined, [100, 120])).toEqual([100, 120]);
  });
  test('сброс и чтение из хранилища', () => {
    expect(resetWidths(resizeCol(st, 'b', 120, 35)).widths).toBeUndefined();
    expect(cleanWidths({ a: 100.4, b: 'x', c: -5, d: 9999 })).toEqual({ a: 100, d: COL_MAX });
    expect(cleanWidths([1, 2])).toBeUndefined(); expect(cleanWidths(null)).toBeUndefined(); expect(cleanWidths({})).toBeUndefined();
  });
  test('сохраняются и читаются вместе с колонками (отдельно для каждого списка)', () => {
    const store: Record<string, string> = {};
    (global as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
    const { saveState, loadState } = require('../src/webparts/pmoPortal/logic/table');
    saveState('risks', resizeCol(st, 'b', 120, 35));
    expect(loadState('risks', ['a', 'b', 'c'], ['a', 'b', 'c'], 'a').widths).toEqual({ b: 155 });
    expect(loadState('reports', ['a', 'b', 'c'], ['a', 'b', 'c'], 'a').widths).toBeUndefined();
  });
});
