import { Project } from '../data/types';

/** Эталон ключевых полей проекта («Еталон показників», пишет только синхронизация): JSON { pmStatus, pmRAG, … }.
 *  Приложение показывает ключевые поля из эталона — подделку в карточке не видно даже до отката синхронизацией. Векторы tests/cases/state.json. */
export type StateJson = Record<string, string>;
const MAP: [string, keyof Project, 'text' | 'number'][] = [
  ['pmStatus', 'status', 'text'], ['pmRAG', 'rag', 'text'], ['pmType', 'type', 'text'], ['pmProgress', 'progress', 'number'],
  ['pmStart', 'start', 'text'], ['pmGoLive', 'goLive', 'text'], ['pmPlanEnd', 'planEnd', 'text'], ['pmForecastEnd', 'forecastEnd', 'text'],
  ['pmActualCost', 'actualCost', 'number'], ['pmArchivedAt', 'archivedAt', 'text'], ['pmLastUpdate', 'lastUpdate', 'text'],
  ['pmLastReport', 'lastReport', 'text'], ['pmCode', 'code', 'text']];

export function parseState(json: string | null | undefined): StateJson | undefined {
  if (!json) return undefined;
  try { const o = JSON.parse(json); return o && typeof o === 'object' ? o as StateJson : undefined; } catch { return undefined; }
}
export function applyState(p: Project, st: StateJson | undefined): Project {
  if (!st) return p;
  const out: Project = { ...p };
  const w = out as unknown as Record<string, unknown>;
  for (const [k, prop, kind] of MAP) {
    if (!(k in st)) continue;
    const v = st[k] === null || st[k] === undefined ? '' : String(st[k]);
    w[prop] = kind === 'number' ? (v === '' ? 0 : Number(v)) : v;
  }
  return out;
}
