// SpRepo.searchPeople — гость, которого ещё нет среди пользователей сайта (прод 28.10): поиск пуст, полный адрес → ensureuser
jest.mock('@microsoft/sp-http', () => ({ SPHttpClient: { configurations: { v1: {} } } }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SpRepo } = require('../src/webparts/pmoPortal/data/SpRepo');

const GUEST = 'i:0#.f|membership|yevhen.katkov_outlook.com#ext#@smarthrua.onmicrosoft.com';
const res = (ok: boolean, body: unknown): any => ({ ok, status: ok ? 200 : 400, json: async () => body, text: async () => JSON.stringify(body) });   // eslint-disable-line @typescript-eslint/no-explicit-any
const repoWith = (picker: unknown[], ensure: any): { repo: any; calls: string[] } => {   // eslint-disable-line @typescript-eslint/no-explicit-any
  const calls: string[] = [];
  const http = { post: async (url: string, _c: unknown, o: { body: string }) => {
    calls.push(url.replace('https://x/sites/t/_api/', '') + ' ' + o.body);
    return url.indexOf('ensureuser') >= 0 ? ensure : res(true, { value: JSON.stringify(picker) });
  } };
  return { repo: new SpRepo(http as any, 'https://x/sites/t', '/sites/t', 'Me@X'), calls };   // eslint-disable-line @typescript-eslint/no-explicit-any
};

test('поиск пуст, набран полный адрес гостя — ensureuser по адресу, человек с логином гостя', async () => {
  const { repo, calls } = repoWith([], res(true, { Id: 25, Title: 'yevhen.katkov', Email: 'yevhen.katkov@outlook.com', LoginName: GUEST }));
  expect(await repo.searchPeople('yevhen.katkov@outlook.com')).toEqual([{ id: 25, name: 'yevhen.katkov', email: 'yevhen.katkov@outlook.com', login: GUEST }]);
  expect(calls[1]).toBe('web/ensureuser {"logonName":"yevhen.katkov@outlook.com"}');
});
test('SharePoint не нашёл (гостя нет или сайт не пускает гостей) — пусто, без ошибки', async () => {
  const { repo } = repoWith([], res(false, { error: { message: 'Не вдалося знайти вказаного користувача' } }));
  expect(await repo.searchPeople('nobody@gmail.com')).toEqual([]);
});
test('часть имени или найдено поиском — ensureuser не вызывается (не добавляем людей на сайт при наборе)', async () => {
  const a = repoWith([], res(true, {}));
  expect(await a.repo.searchPeople('evhen')).toEqual([]);
  expect(a.calls.length).toBe(1);
  const b = repoWith([{ Key: 'i:0#.f|membership|d@x', DisplayText: 'D', IsResolved: true, EntityData: { Email: 'd@x' } }], res(true, {}));
  expect((await b.repo.searchPeople('d@x.com')).length).toBe(1);
  expect(b.calls.length).toBe(1);
});
