import { Person } from './types';

/** Логин SharePoint (claims) человека. У гостя (внешний e-mail) он не совпадает с почтой —
 *  i:0#.f|membership|имя_домен#ext#@тенант, поэтому берём его из поиска; без него — по почте. */
export const loginOf = (p: { email: string; login?: string }): string => p.login || `i:0#.f|membership|${p.email}`;

/** Ответ clientPeoplePickerSearchUser → люди каталога организации (в том числе гости).
 *  «Просто e-mail» вне организации не предлагается: на сайт его не добавить (ensureuser — 400). */
export const pickerPeople = (raw: any[]): Person[] => raw   // eslint-disable-line @typescript-eslint/no-explicit-any
  .filter(x => x.IsResolved !== false && String(x.Key || '').indexOf('|') >= 0)
  .map(x => ({ id: 0, name: String(x.DisplayText || ''), email: String((x.EntityData && x.EntityData.Email) || ''), login: String(x.Key) }))
  .filter(x => x.email);

/** Ответ ensureuser «такого человека нет»: 400/404 с текстом SharePoint (JSON экранирует кириллицу — \uXXXX). */
export const isUserNotFound = (status: number, body: string): boolean => {
  if (status !== 400 && status !== 404) return false;
  let m = body;
  try { const j = JSON.parse(body); m = String((j.error && (j.error.message && j.error.message.value !== undefined ? j.error.message.value : j.error.message)) || body); } catch { /* не JSON */ }
  return /не удалось найти пользователя|не вдалося знайти користувача|user cannot be found|could not be found|не найден/i.test(m);
};

/** Набран полный адрес почты (поиск по части имени гостей не находит — подсказки гостей на сайте выключены). */
export const isEmailQuery = (q: string): boolean => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(q.trim());

/** Ответ ensureuser → человек для выбора (гость: логин …#ext#@тенант, почта — из ответа или набранная). */
export const fromSiteUser = (u: any, q: string): Person =>   // eslint-disable-line @typescript-eslint/no-explicit-any
  ({ id: Number(u.Id), name: String(u.Title || q.trim()), email: String(u.Email || q.trim()), login: String(u.LoginName) });
