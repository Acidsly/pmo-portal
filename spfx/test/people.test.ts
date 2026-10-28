import { fromSiteUser, isEmailQuery, isUserNotFound, loginOf, pickerPeople } from '../src/webparts/pmoPortal/data/people';
import { formUser } from '../src/webparts/pmoPortal/data/formValues';

const GUEST = 'i:0#.f|membership|evgeniyk_gmail.com#ext#@smarthrua.onmicrosoft.com';

test('гость: логин из поиска, а не membership|e-mail (ensureuser падал с 400)', () => {
  expect(loginOf({ email: 'evgeniyk@gmail.com', login: GUEST })).toBe(GUEST);
  expect(loginOf({ email: 'o@x.ua' })).toBe('i:0#.f|membership|o@x.ua');
  expect(formUser(GUEST)).toBe(JSON.stringify([{ Key: GUEST }]));
  expect(formUser('o@x.ua')).toBe('[{"Key":"i:0#.f|membership|o@x.ua"}]');
});

test('поиск: только люди каталога, «просто e-mail» вне организации не предлагается', () => {
  const raw = [
    { Key: GUEST, DisplayText: 'Evgeniy K', IsResolved: true, EntityData: { Email: 'evgeniyk@gmail.com' } },
    { Key: 'i:0#.f|membership|o@x.ua', DisplayText: 'O', IsResolved: true, EntityData: { Email: 'o@x.ua' } },
    { Key: 'stranger@gmail.com', DisplayText: 'stranger@gmail.com', IsResolved: false, EntityData: { Email: 'stranger@gmail.com' } },
    { Key: 'i:0#.f|membership|nomail@x.ua', DisplayText: 'N', IsResolved: true, EntityData: {} },
  ];
  expect(pickerPeople(raw)).toEqual([
    { id: 0, name: 'Evgeniy K', email: 'evgeniyk@gmail.com', login: GUEST },
    { id: 0, name: 'O', email: 'o@x.ua', login: 'i:0#.f|membership|o@x.ua' },
  ]);
});

test('ensureuser «нет в организации» → понятный текст вместо ответа SharePoint', () => {
  const { errText } = require('../src/webparts/pmoPortal/components/fields');   // eslint-disable-line @typescript-eslint/no-var-requires
  expect(errText((k: string) => `«${k}»`, new Error('userNotFound'))).toBe('«errUserNotFound»');
});

test('«нет в организации» — только по тексту SharePoint, другие 400 не маскируются', () => {
  // ответ из отзыва: кириллица экранирована \uXXXX
  const real = '{"error":{"code":"-2146232832, Microsoft.SharePoint.SPException","message":"\\u041d\\u0435 \\u0443\\u0434\\u0430\\u043b\\u043e\\u0441\\u044c \\u043d\\u0430\\u0439\\u0442\\u0438 \\u043f\\u043e\\u043b\\u044c\\u0437\\u043e\\u0432\\u0430\\u0442\\u0435\\u043b\\u044f i:0#.f|membership|evgeniyk@gmail.com."}}';
  expect(isUserNotFound(400, real)).toBe(true);
  expect(isUserNotFound(400, '{"error":{"message":"The user cannot be found."}}')).toBe(true);
  expect(isUserNotFound(400, '{"error":{"message":"Invalid request."}}')).toBe(false);
  expect(isUserNotFound(500, real)).toBe(false);
});

test('гость не среди пользователей сайта: полный адрес → ensureuser, ответ → человек с логином гостя', () => {
  expect(isEmailQuery('yevhen.katkov@outlook.com')).toBe(true);
  expect(isEmailQuery(' Y.K@outlook.com ')).toBe(true);
  expect(isEmailQuery('evhen')).toBe(false);
  expect(isEmailQuery('yevhen.katkov@outlook')).toBe(false);
  expect(isEmailQuery('a b@x.com')).toBe(false);
  expect(fromSiteUser({ Id: 25, Title: 'yevhen.katkov', Email: 'yevhen.katkov@outlook.com', LoginName: 'i:0#.f|membership|yevhen.katkov_outlook.com#ext#@smarthrua.onmicrosoft.com' }, 'yevhen.katkov@outlook.com'))
    .toEqual({ id: 25, name: 'yevhen.katkov', email: 'yevhen.katkov@outlook.com', login: 'i:0#.f|membership|yevhen.katkov_outlook.com#ext#@smarthrua.onmicrosoft.com' });
  expect(fromSiteUser({ Id: 7, Title: '', Email: '', LoginName: 'x|y' }, ' g@x.com ')).toEqual({ id: 7, name: 'g@x.com', email: 'g@x.com', login: 'x|y' });
});
