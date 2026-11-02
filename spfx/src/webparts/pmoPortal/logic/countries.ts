import { COUNTRIES } from './projects';
import { VALUES } from '../i18n/values';

/** Довідник «Країни і CEO» (план 2026-11-02-countries-directory.md, векторы tests/cases/countries.json — их же прогоняет прототип).
 *  Назви та порядок — «Назви країн» (читают все), CEO — «Країни» (только PMO и владельцы). Значение в проектах — украинская назва. */
export interface CountryName { id: number; name: string; en: string; ru: string; order: number; active: boolean; modified?: string }
export interface CountryRaw { id?: number; name?: string | null; en?: string | null; ru?: string | null; order?: number | null; active?: boolean | null; modified?: string }

/** Встроенный набор — пока списка нет (приложение раньше Deploy-PMO.ps1) или он недоступен. */
export function fallbackCountries(): CountryName[] {
  return COUNTRIES.map((n, i) => ({ id: 0, name: n, en: VALUES[n] ? VALUES[n][1] : n, ru: VALUES[n] ? VALUES[n][2] : n, order: (i + 1) * 10, active: true }));
}

/** Список країн: по порядку (без порядка — в конце), при равном — по названию; пустое «активна» = да, пустой перевод = uk. */
export function countryList(rows: CountryRaw[] | null | undefined): CountryName[] {
  if (!rows || !rows.length) return fallbackCountries();
  const ord = (x: CountryName): number => (x.order > 0 || x.order === 0 ? x.order : Number.MAX_SAFE_INTEGER);
  return rows.map(r => {
    const name = String(r.name || '').trim();
    return { id: Number(r.id) || 0, name, en: String(r.en || '').trim() || name, ru: String(r.ru || '').trim() || name,
      order: r.order === null || r.order === undefined || isNaN(Number(r.order)) ? NaN : Number(r.order), active: r.active !== false, modified: r.modified };
  }).filter(x => !!x.name).sort((a, b) => ord(a) - ord(b) || a.name.localeCompare(b.name, 'uk'));
}

/** Переводы для экрана (tv): название → [uk, en, ru]. */
export function countryLabels(list: CountryName[]): Record<string, [string, string, string]> {
  const out: Record<string, [string, string, string]> = {};
  for (const c of list) out[c.name] = [c.name, c.en, c.ru];
  return out;
}

/** Варианты «Країна» в формах: активные по порядку; текущая страна проекта (выключенная или удалённая из довідника) не пропадает — в конце. */
export function countryChoices(list: CountryName[] | undefined, current?: string): string[] {
  const out = (list && list.length ? list : fallbackCountries()).filter(c => c.active).map(c => c.name);
  if (current && out.indexOf(current) < 0) out.push(current);
  return out;
}

const norm = (s: string): string => s.trim().toLowerCase();

/** Проверка строки PMO: название обязательно, без повторов, у существующей страны не меняется (оно записано в проектах). */
export function validateCountry(d: { id: number; name: string }, list: CountryName[]): string[] {
  const name = d.name.trim();
  if (!name) return ['errCountryName'];
  // запятая и кавычки ломают значение выбора SharePoint и CAML
  if (/[,;"'«»]/.test(name)) return ['errCountryChars'];
  const own = d.id ? list.filter(c => c.id === d.id)[0] : undefined;
  if (own && own.name !== name) return ['errCountryRename'];
  if (list.some(c => c.id !== d.id && norm(c.name) === norm(name))) return ['errCountryDup'];
  return [];
}

/** Предупреждения (сохранить можно): активная без CEO — CEO не получит доступ; выключенная с активными проектами — CEO сохраняет доступ к ним. */
export function countryWarnings(d: { active: boolean; ceo: number }, projects: number): [string, number][] {
  if (d.active && !d.ceo) return [['warnCountryNoCeo', 0]];
  if (!d.active && projects > 0) return [['warnCountryInactive', projects]];
  return [];
}

/** Свежесть перед записью: строку, открытую PMO, успел изменить или удалить другой — не перезаписываем. */
export function countryStale(opened: string | undefined, fresh: string | undefined): boolean {
  if (!opened) return false;
  return opened !== (fresh || '');
}
