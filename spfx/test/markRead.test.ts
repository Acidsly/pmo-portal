// SpRepo.markRead — единственное место гонки записи «Прочитане» (кросс-ревью 08.10): свежая версия, If-Match, одна повторная попытка
jest.mock('@microsoft/sp-http', () => ({ SPHttpClient: { configurations: { v1: {} } } }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SpRepo } = require('../src/webparts/pmoPortal/data/SpRepo');

type Row = { Id: number; nsReadId: number; nsReadCmId: number; nsReadSet: string; 'odata.etag': string };
const repoWith = (versions: Row[], fail: number): { repo: any; writes: any[] } => {
  const repo = new SpRepo(null as any, 'https://x/sites/t', '/sites/t', 'Me@X');
  const writes: any[] = []; let v = 0; let left = fail;
  repo.items = async () => [{ Id: 5 }];
  repo.itemUrl = () => 'url';
  repo.getJson = async () => versions[Math.min(v++, versions.length - 1)];
  repo.update = async (_l: string, id: number, body: any, etag: string) => { writes.push({ id, body, etag }); if (left-- > 0) throw new Error('conflict'); };
  return { repo, writes };
};
const row = (readId: number, readCmId: number, set: string[], etag: string): Row => ({ Id: 5, nsReadId: readId, nsReadCmId: readCmId, nsReadSet: JSON.stringify(set), 'odata.etag': etag });

test('пишет в свою строку объединение со свежей версией и её ETag', async () => {
  const { repo, writes } = repoWith([row(20, 5, ['j25'], '"1"')], 0);
  await repo.markRead({ readId: 20, readCmId: 5, seen: ['j22'] });
  expect(writes).toEqual([{ id: 5, body: { nsReadId: 20, nsReadCmId: 5, nsReadSet: '["j25","j22"]' }, etag: '"1"' }]);
});
test('нечего менять — не пишет', async () => {
  const { repo, writes } = repoWith([row(20, 5, ['j25', 'j22'], '"1"')], 0);
  await repo.markRead({ readId: 18, readCmId: 5, seen: ['j22'] });
  expect(writes).toEqual([]);
});
test('конфликт версии — перечитывает и объединяет с новой (вторая вкладка не теряет своё)', async () => {
  const { repo, writes } = repoWith([row(20, 5, [], '"1"'), row(20, 5, ['j30'], '"2"')], 1);
  await repo.markRead({ readId: 20, readCmId: 5, seen: ['j22'] });
  expect(writes.length).toBe(2);
  expect(writes[1]).toEqual({ id: 5, body: { nsReadId: 20, nsReadCmId: 5, nsReadSet: '["j30","j22"]' }, etag: '"2"' });
});
test('второй конфликт подряд — ошибка наружу', async () => {
  const { repo } = repoWith([row(20, 5, [], '"1"'), row(20, 5, [], '"2"')], 2);
  await expect(repo.markRead({ readId: 21, readCmId: 5 })).rejects.toThrow('conflict');
});
