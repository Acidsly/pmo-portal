/** «Не оцінено» — только оценка «Бюджет» в фазах «Ініціація» / «Планування» (#121): в общий стан не входит (не красная и не жёлтая). */
export type Rag = 'Зелений' | 'Жовтий' | 'Червоний' | 'Не оцінено' | '';
export const BUDGET_NA: Rag = 'Не оцінено';
export const RAGS: Rag[] = ['Зелений', 'Жовтий', 'Червоний'];

/** Общий стан — худшая из трёх оценок; если оценки нет — пусто (как CalcRag в Invoke-PMOSync.ps1). */
export function calcRag(s: Rag, b: Rag, r: Rag): Rag {
  const v = [s, b, r];
  if (v.some(x => !x)) return '';
  if (v.indexOf('Червоний') >= 0) return 'Червоний';
  if (v.indexOf('Жовтий') >= 0) return 'Жовтий';
  return 'Зелений';
}
