import { mapComment, mapChange } from '../src/webparts/pmoPortal/data/map';
test('mapComment', () => {
  expect(mapComment({ Id: 4, cmProjectId: 7, cmText: 'Текст', Created: '2026-09-22T08:30:00Z', Author: { Id: 3, Title: 'A', EMail: 'a@x.ua' } }))
    .toEqual({ id: 4, projectId: 7, text: 'Текст', created: '2026-09-22T08:30:00Z', author: { id: 3, name: 'A', email: 'a@x.ua' } });
});
test('mapChange', () => {
  expect(mapChange({ Id: 9, kcProjectId: 7, kcDate: '2026-09-20T10:15:00Z', kcKind: 'Статус-звіт', kcField: 'pmRAG', kcFrom: 'Зелений', kcTo: 'Жовтий',
    kcReason: null, kcChangedBy: null })).toEqual({ id: 9, projectId: 7, date: '2026-09-20T10:15:00Z', who: null, kind: 'Статус-звіт', field: 'pmRAG',
    from: 'Зелений', to: 'Жовтий', reason: '' });
});

describe('«Прочитане»: открытые события (nsReadSet)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { mapNotify, NOTIFY_SELECT } = require('../src/webparts/pmoPortal/data/map');
  test('читается вместе со строкой; пусто или испорчено — пустой список', () => {
    expect(NOTIFY_SELECT).toContain('nsReadSet');
    expect(mapNotify({ Id: 5, nsReadId: 150, nsReadCmId: 28, nsReadSet: '["j151","c30"]' })).toEqual({ id: 5, readId: 150, readCmId: 28, seen: ['j151', 'c30'] });
    expect(mapNotify({ Id: 5, nsReadId: 1, nsReadCmId: 2, nsReadSet: null }).seen).toEqual([]);
    expect(mapNotify({ Id: 5, nsReadId: 1, nsReadCmId: 2, nsReadSet: '{bad' }).seen).toEqual([]);
    expect(mapNotify({ Id: 5, nsReadId: 1, nsReadCmId: 2, nsReadSet: '[1,"j3"]' }).seen).toEqual(['j3']);
  });
});
