import { ChangeEntry, ChangeEvent, Person } from '../data/types';

/** Внутреннее имя поля проекта -> ключ FLD прототипа (подпись в истории изменений). */
export const FIELD_KEY: Record<string, string> = { Title: 'title', pmStatus: 'status', pmRAG: 'rag', pmType: 'type', pmProgress: 'progress',
  pmStart: 'start', pmGoLive: 'golive', pmPlanEnd: 'plan', pmForecastEnd: 'fc', pmActualCost: 'actual', pmPriority: 'prio', pmManager: 'pm',
  pmOwner: 'owner', pmStakeholders: 'stakeholders', pmDepartment: 'dept', pmLoop: 'loop', pmCode: 'code', pmBudget: 'budget' };
const KIND: Record<string, ChangeEvent['kind']> = { 'Створення': 'create', 'Статус-звіт': 'report', 'Редагування картки': 'edit' };

/** Журнал «Зміни показників» (строка на поле) -> события истории прототипа, новые сверху. */
export function toEvents(rows: ChangeEntry[]): ChangeEvent[] {
  const map: Record<string, ChangeEvent> = {}; const order: string[] = [];
  rows.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).forEach(r => {
    const key = [r.projectId, r.kind, r.who ? r.who.email : '', r.reason, r.date.slice(0, 16)].join('|');
    let ev = map[key];
    if (!ev) { ev = map[key] = { id: r.id, date: r.date, who: r.who, kind: KIND[r.kind] || 'edit', reason: r.reason, diffs: [] }; order.push(key); }
    if (ev.kind !== 'create') ev.diffs.push({ f: FIELD_KEY[r.field] || r.field, from: r.from, to: r.to });
  });
  return order.map(k => map[k]).reverse();
}

/** Необработанные синхронизацией правки карточки (pmEditLog) — события «Редагування картки»; автор — по e-mail среди известных людей. */
export function editLogEvents(json: string, people: Person[]): ChangeEvent[] {
  if (!json) return [];
  let log: { entries?: { when: string; who: string; reason: string; diffs: { f: string; from: string; to: string }[] }[] };
  try { log = JSON.parse(json); } catch { return []; }
  return (log.entries || []).map((e, i) => {
    const who = people.filter(x => x.email.toLowerCase() === String(e.who || '').toLowerCase())[0] || { id: 0, name: String(e.who || ''), email: String(e.who || '') };
    return { id: -(i + 1), date: e.when, who, kind: 'edit' as const, reason: e.reason || '', diffs: e.diffs || [] };
  });
}
