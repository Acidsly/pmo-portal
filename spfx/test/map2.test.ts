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
