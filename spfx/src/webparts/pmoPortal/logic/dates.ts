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

/** Поле даты (#26): ввод «дд.мм.рррр» — только цифры, точки ставятся сами; максимум 8 цифр. */
export function maskDmy(raw: string): string {
  const d = (raw || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}.${d.slice(2)}` : d;
}
/** «дд.мм.рррр» → ISO «yyyy-mm-dd»; пусто → ''; неполная или несуществующая дата → null. */
export function parseDmy(text: string): string | null {
  const s = (text || '').trim();
  if (!s) return '';
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
/** ISO «yyyy-mm-dd» → «дд.мм.рррр»; пусто → ''. */
export function formatDmy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}
