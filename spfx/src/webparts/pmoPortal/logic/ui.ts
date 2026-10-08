// Решения интерфейса, вынесенные из компонентов, чтобы их проверяли тесты (spfx/test/ui.test.ts)

/** #8 Клавиши в выборе людей: стрелки — подсветка, Enter — выбрать подсвеченного (и НЕ отправлять форму), Esc — сбросить. */
export type PickerAct = { hi: number; pick: number | null; clear: boolean; prevent: boolean };
export function pickerKey(key: string, hi: number, count: number): PickerAct {
  if (key === 'ArrowDown') return { hi: Math.min(hi + 1, count - 1), pick: null, clear: false, prevent: true };
  if (key === 'ArrowUp') return { hi: Math.max(hi - 1, 0), pick: null, clear: false, prevent: true };
  if (key === 'Enter') return { hi, pick: hi >= 0 && hi < count ? hi : null, clear: false, prevent: true };   // Enter не отправляет форму
  if (key === 'Escape') return { hi, pick: null, clear: true, prevent: false };
  return { hi, pick: null, clear: false, prevent: false };
}

/** #10 Номер нового проекта: занятый другим PMO номер (ошибка уникальности списка) — следующий, не больше 5 попыток. */
export const isUniqueError = (e: unknown): boolean => /unique|унікальн|уникальн|duplicate|already exists/i.test(String((e as Error)?.message || e));
export async function createWithCode(codes: string[], next: (codes: string[]) => string, tryCreate: (code: string) => Promise<number>): Promise<number> {
  const taken = codes.slice();
  for (let i = 0; ; i++) {
    const code = next(taken);
    try { return await tryCreate(code); }
    catch (er) { if (i < 5 && isUniqueError(er)) taken.push(code); else throw er; }
  }
}

/** #33 Закрепление ширин колонок: на широком экране (≥ 900 px) — после первой раскладки, только ненулевые замеры
 *  для нового набора колонок; на узком — без закрепления. Возвращает новое состояние (или прежнее). */
export type WidthLock = { key: string; w: number[] } | null;
export function nextLock(innerWidth: number, lock: WidthLock, colsKey: string, cols: number, measured: number[] | null): WidthLock {
  if (innerWidth < 900) return null;
  if (lock && lock.key === colsKey) return lock;
  if (!measured || measured.length !== cols || !measured.every(x => x > 0)) return lock;
  return { key: colsKey, w: measured };
}

/** #15 Текст ячейки для CSV: видимый текст, а для значка без текста — его подсказка (title). */
export function cellText(c: Element): string {
  const t = (((c as HTMLElement).innerText ?? c.textContent) || '').trim();
  if (t) return t;
  const ti = c.querySelector('[title]') as HTMLElement | null;
  return ti ? ti.title : '';
}

/** «Попередній / наступний» в окне записи: соседи по порядку, как в таблице (0 — соседа нет; записи нет в порядке — переходов нет). */
export function neighbors(order: number[], id: number): { prev: number; next: number } {
  const i = order.indexOf(id);
  if (i < 0) return { prev: 0, next: 0 };
  return { prev: i > 0 ? order[i - 1] : 0, next: i < order.length - 1 ? order[i + 1] : 0 };
}
