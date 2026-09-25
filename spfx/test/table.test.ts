import { applyTable, filterValues, nextSort, toggleCol, moveCol, ColDef, TableState } from '../src/webparts/pmoPortal/logic/table';

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
