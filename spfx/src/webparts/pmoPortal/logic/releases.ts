/** #95: «Що змінилося» — подряд идущие технические выпуски («Технічне оновлення без змін у роботі порталу») сворачиваются в один
 *  блок с диапазоном версий и дат; выпуски с изменениями для пользователя — отдельными блоками. Порядок — как в заметках
 *  (новые сверху). Технический — выпуск, весь текст которого — эта одна фраза (на любом из трёх языков). */
export interface ReleaseNote { ver: string; date: string; html: string }
export type ReleaseItem = { kind: 'rel'; r: ReleaseNote } | { kind: 'tech'; list: ReleaseNote[]; vers: string; dates: string };

const TECH = [/^технічне оновлення без змін у роботі порталу\.?$/i, /^technical update with no changes to how the portal works\.?$/i,
  /^техническое обновление без изменений в работе портала\.?$/i];
/** Текст выпуска без разметки и заголовка раздела («Змінено» / «Changed» / «Изменено»). */
const plain = (html: string): string => html.replace(/<p><b>[^<]*<\/b><\/p>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
export const isTechRelease = (r: ReleaseNote): boolean => (r.html.match(/<li>/g) || []).length === 1 && TECH.some(x => x.test(plain(r.html)));

/** Диапазон дат «дд.мм.рррр»: один день — дата; один месяц — «13–14.10.2026»; иначе — «30.09.2026–01.10.2026». */
export function dateRange(newest: string, oldest: string): string {
  if (newest === oldest) return newest;
  const [d1, m1, y1] = oldest.split('.'), [d2, m2, y2] = newest.split('.');
  return m1 === m2 && y1 === y2 ? `${d1}–${d2}.${m2}.${y2}` : `${oldest}–${newest}`;
}
export function groupReleases(list: ReleaseNote[]): ReleaseItem[] {
  const out: ReleaseItem[] = [];
  for (const r of list) {
    const last = out[out.length - 1];
    if (!isTechRelease(r)) { out.push({ kind: 'rel', r }); continue; }
    if (last && last.kind === 'tech') last.list.push(r); else out.push({ kind: 'tech', list: [r], vers: '', dates: '' });
  }
  for (const x of out) if (x.kind === 'tech') {
    const n = x.list[0], o = x.list[x.list.length - 1];
    x.vers = x.list.length > 1 ? `${o.ver}–${n.ver}` : n.ver;
    x.dates = dateRange(n.date, o.date);
  }
  return out;
}
