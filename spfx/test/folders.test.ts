import { withoutFolders, CHANGES_ON_LOAD, changesOf } from '../src/webparts/pmoPortal/data/map';

test('withoutFolders: папки проектів P<ID> (FileSystemObjectType = 1) відкидаються', () => {
  const rows = [{ Id: 1, FileSystemObjectType: 0 }, { Id: 2, FileSystemObjectType: 1, Title: 'P7' }, { Id: 3, FileSystemObjectType: 0 }];
  expect(withoutFolders(rows).map(r => r.Id)).toEqual([1, 3]);
});
test('журнал: при завантаженні — лише перенесення планової дати; для картки — фільтр за проєктом', () => {
  expect(CHANGES_ON_LOAD).toBe("kcField eq 'pmPlanEnd'");
  expect(changesOf(12)).toBe('kcProjectId eq 12');
  expect(changesOf(12.7)).toBe('kcProjectId eq 12');
});
