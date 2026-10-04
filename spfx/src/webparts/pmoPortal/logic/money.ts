// Поле суммы (#41, #45): показ с пробелами между разрядами, значение — целое число долларов (как grp прототипа)

/** «1 450 000»: целое ≥ 0, пробел между разрядами. */
export const groupDigits = (n: number): string => String(Math.max(0, Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Из текста поля — только цифры (пробелы, вставленные разделители и прочее отбрасываются); пусто — 0. */
export function parseMoney(txt: string): number {
  const t = String(txt).replace(/\s/g, '');
  // «1450.50», «1 450,5» — дробная часть (1–2 цифры после последней точки или запятой) округляется до целого, x,5 — вверх
  const m = /^(.*?)[.,](\d{1,2})$/.exec(t);
  if (m) { const i = m[1].replace(/[^0-9]/g, ''); return Math.round(Number(i || '0') + Number(m[2].length === 1 ? m[2] + '0' : m[2]) / 100); }
  const d = t.replace(/[^0-9]/g, '');
  return d ? Number(d) : 0;
}
