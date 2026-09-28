/** CSV для Excel: разделитель «;» (так Excel открывает файл по колонкам при украинских и русских региональных настройках),
 *  значения с разделителем, кавычками или переводом строки — в кавычках, в начале — BOM, чтобы кириллица читалась. */
export function toCsv(head: string[], rows: string[][]): string {
  const q = (v: string): string => (/[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  return '﻿' + [head, ...rows].map(r => r.map(x => q((x || '').replace(/\s+\n/g, '\n').trim())).join(';')).join('\r\n');
}
