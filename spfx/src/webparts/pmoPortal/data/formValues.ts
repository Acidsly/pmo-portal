/** Запись сразу в папку проекта (AddValidateUpdateItemUsingPath): значения передаются строками, как в форме SharePoint,
 *  и разбираются по региональным настройкам сайта — десятичный разделитель и порядок даты (проба: Invoke-Env -Action probe-formvalues). */
export interface Regional { dec: string; order: 0 | 1 | 2; sep: string; }   // order: 0 — м/д/г, 1 — д/м/г, 2 — г/м/д (DateFormat SharePoint)
export const DEFAULT_REGIONAL: Regional = { dec: ',', order: 1, sep: '.' };   // uk-UA, как тест-сайт
export interface FormValue { FieldName: string; FieldValue: string; }
type Kind = 'lookup' | 'user' | 'date' | 'number' | 'bool';

/** Типы полей тел записи (write.ts) по спискам; остальное — текст и выбор. Ключи — как в теле JSON (lookup и пользователь с «Id»). */
const SCHEMA: Record<string, Record<string, Kind>> = {
  StatusReports: { srProjectId: 'lookup', srDate: 'date', srStart: 'date', srGoLive: 'date', srPlanEnd: 'date', srForecastEnd: 'date', srActualEnd: 'date',
    srProgress: 'number', srActualCost: 'number', srDecision: 'bool', srApplied: 'bool' },
  RisksIssues: { riProjectId: 'lookup', riOwnerId: 'user', riDue: 'date', riProbability: 'number', riImpact: 'number' },
  ProjectTeam: { tmProjectId: 'lookup', tmUserId: 'user' },
  ProjectComments: { cmProjectId: 'lookup' },
  ReportApprovals: { apReportId: 'lookup', apProjectId: 'lookup' }
};

/** «2026-09-30» или «2026-09-30T12:00:00Z» → «30.09.2026» по порядку и разделителю сайта; пусто — ''. */
export function formDate(v: unknown, r: Regional): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  if (!m) return '';
  const [y, mo, d] = [m[1], m[2], m[3]];
  return (r.order === 0 ? [mo, d, y] : r.order === 2 ? [y, mo, d] : [d, mo, y]).join(r.sep);
}
/** Число без разделителей групп, дробная часть — через разделитель сайта. */
export function formNumber(v: unknown, r: Regional): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!isFinite(n)) return '';
  return String(n).replace('.', r.dec);
}
export const formUser = (email: string): string => (email ? JSON.stringify([{ Key: `i:0#.f|membership|${email}` }]) : '');

/** Тело JSON (как для create/update) → значения формы. users — e-mail для полей «Користувач» (ключ — как в теле, например riOwnerId). */
export function toFormValues(list: string, body: Record<string, unknown>, r: Regional, users: Record<string, string> = {}): FormValue[] {
  const kinds = SCHEMA[list] || {};
  const out: FormValue[] = [];
  for (const key of Object.keys(body)) {
    const v = body[key], kind = kinds[key];
    const name = kind === 'lookup' || kind === 'user' ? key.replace(/Id$/, '') : key;
    let s: string;
    if (kind === 'lookup') s = v === null || v === undefined ? '' : String(v);
    else if (kind === 'user') s = formUser(users[key] || '');
    else if (kind === 'date') s = formDate(v, r);
    else if (kind === 'number') s = formNumber(v, r);
    else if (kind === 'bool') s = v ? '1' : '0';
    else s = v === null || v === undefined ? '' : String(v);
    out.push({ FieldName: name, FieldValue: s });
  }
  return out;
}
/** Регіональні налаштування сайта (web/RegionalSettings) → Regional. */
export function regionalFrom(j: { DecimalSeparator?: string; DateFormat?: number; DateSeparator?: string } | undefined): Regional {
  if (!j) return DEFAULT_REGIONAL;
  const order = j.DateFormat === 0 || j.DateFormat === 2 ? j.DateFormat : 1;
  return { dec: j.DecimalSeparator || ',', order: order as 0 | 1 | 2, sep: j.DateSeparator || '.' };
}
