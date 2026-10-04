// Поле суммы (#41, #45): показ с пробелами между разрядами, значение — целое число долларов (как grp прототипа)

/** «1 450 000»: целое ≥ 0, пробел между разрядами. */
export const groupDigits = (n: number): string => String(Math.max(0, Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Из текста поля — только цифры (пробелы, вставленные разделители и прочее отбрасываются); пусто — 0. */
export const parseMoney = (txt: string): number => { const d = String(txt).replace(/[^0-9]/g, ''); return d ? Number(d) : 0; };
