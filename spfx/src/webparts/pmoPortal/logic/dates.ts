const DAY = 86400000;
const pad = (n: number): string => (n < 10 ? '0' : '') + n;
const isoUtc = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** Дата поля «только дата». 12:00 UTC — записано синхронизацией: дата UTC; иначе полночь по поясу сайта: +12 ч. */
export function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  if (d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return isoUtc(d);
  return isoUtc(new Date(d.getTime() + 12 * 3600000));
}
export function addDays(iso: string, n: number): string {
  return isoUtc(new Date(Date.parse(iso + 'T12:00:00Z') + n * DAY));
}
/** b − a в днях. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
}
/** Сегодня по часам браузера. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
