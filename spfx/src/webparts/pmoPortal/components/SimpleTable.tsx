import * as React from 'react';

export interface Col<R> { head: React.ReactNode; cell: (r: R) => React.ReactNode; cls?: string; }

/** Таблица главной (функция table прототипа, без группировок). */
export function SimpleTable<R extends { id: number }>(p: { cols: Col<R>[]; rows: R[]; empty: string }): JSX.Element {
  if (!p.rows.length) return <p className="empty">{p.empty}</p>;
  return <div className="tablewrap"><table>
    <thead><tr>{p.cols.map((c, i) => <th key={i} className={c.cls || ''}>{c.head}</th>)}</tr></thead>
    <tbody>{p.rows.map(r => <tr key={r.id} className="row">{p.cols.map((c, i) => <td key={i} className={c.cls || ''}>{c.cell(r)}</td>)}</tr>)}</tbody>
  </table></div>;
}
