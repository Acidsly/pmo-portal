/** Правила погодження и применения статус-отчётов — те же, что Invoke-PMOSync.ps1 (Get-PendingReturns, Get-ApplyAction). Векторы tests/cases/reports.json. */
export interface PendingRep { id: number; date: string; author: string; created: string; }
export interface ReturnRow { id: number; note: string; }
// доверенный автор: приложение («app») или владелец сайта; пустой e-mail — не доверенный (как Test-Trusted синхронизации)
const trusted = (email: string, owners: string[]): boolean => email === 'app' || (!!email && owners.indexOf(email) >= 0);
const dmy = (iso: string): string => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : iso; };

/** Отчёты «на погодженні», которые синхронизация вернёт: архив; автор — не текущий PM; второй и следующие по проекту. */
export function pendingReturns(pending: PendingRep[], pm: string, owners: string[], archived: boolean): ReturnRow[] {
  const out: ReturnRow[] = []; let keep: PendingRep | undefined;
  const sorted = pending.slice().sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : a.id - b.id));
  for (const r of sorted) {
    if (archived) { out.push({ id: r.id, note: 'Проєкт в архіві — звіт не застосовується.' }); continue; }
    if (r.author !== pm && !trusted(r.author, owners)) { out.push({ id: r.id, note: 'Змінився PM проєкту — новий PM подає актуальний звіт.' }); continue; }
    if (keep) { out.push({ id: r.id, note: `По проєкту вже є звіт на погодженні від ${dmy(keep.date)} — новий можна подати після рішення PMO.` }); continue; }
    keep = r;
  }
  return out;
}
export type ApplyAction = 'apply' | 'journalOnly' | 'notApplied:arch' | 'notApplied:pm';
/** Погоджений отчёт: перенести показатели / только отметить (есть более новый применённый) / не применять (архив, автор не PM). */
export function applyAction(rep: { id: number; date: string; author: string }, pm: string, owners: string[], archived: boolean, last: string, lastUpdate: string): ApplyAction {
  if (archived) return 'notApplied:arch';
  if (rep.author !== pm && !trusted(rep.author, owners)) return 'notApplied:pm';
  const m = /^(\d{4}-\d{2}-\d{2})#(\d+)$/.exec(last || '');
  if (m) { if (rep.date < m[1] || (rep.date === m[1] && rep.id <= Number(m[2]))) return 'journalOnly'; }
  else if (lastUpdate && rep.date < lastUpdate) return 'journalOnly';
  return 'apply';
}
