export type Rag = 'Зелений' | 'Жовтий' | 'Червоний' | '';
export const RAGS: Rag[] = ['Зелений', 'Жовтий', 'Червоний'];

/** Общий стан — худшая из трёх оценок; если оценки нет — пусто (как CalcRag в Invoke-PMOSync.ps1). */
export function calcRag(s: Rag, b: Rag, r: Rag): Rag {
  const v = [s, b, r];
  if (v.some(x => !x)) return '';
  if (v.indexOf('Червоний') >= 0) return 'Червоний';
  if (v.indexOf('Жовтий') >= 0) return 'Жовтий';
  return 'Зелений';
}
