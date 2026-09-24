import * as React from 'react';
import { DonutCounts } from '../logic/dynamics';

/** Кольцо «Портфель за станом» — геометрия прототипа (donut, строки 924–935). */
export const Donut: React.FC<{ c: DonutCounts; label: string; active: string; notRated: string }> = ({ c, label, active, notRated }) => {
  const R = 76, C = 2 * Math.PI * R, total = c.total || 1;
  const segs: [number, string, string][] = [[c.g, 'var(--g)', 'Зелений'], [c.y, 'var(--y)', 'Жовтий'], [c.r, 'var(--r)', 'Червоний'], [c.none, 'var(--na)', notRated]];
  let off = 0;
  const arcs = segs.map(([v, cl], i) => {
    const len = v / total * C;
    const el = len > 0 ? <circle key={i} r={R} cx="100" cy="100" fill="none" stroke={cl} strokeWidth="24"
      strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 100 100)" /> : null;
    off += len;
    return el;
  });
  return <div className="donut-wrap">
    <svg className="donut" viewBox="0 0 200 200" role="img" aria-label={label}>
      <circle r={R} cx="100" cy="100" fill="none" stroke="var(--track)" strokeWidth="24" />
      {arcs}
      <text x="100" y="100" textAnchor="middle" fontSize="40" fontWeight="600" fill="var(--text)">{c.total}</text>
      <text x="100" y="124" textAnchor="middle" fontSize="14" fill="var(--text-2)">{active}</text>
    </svg>
    <ul className="legend">{segs.filter((s, i) => i < 3 || s[0] > 0).map(([v, cl, l], i) =>
      <li key={i}><span className="dot" style={{ background: cl }} /><b>{v}</b>{l}</li>)}</ul>
  </div>;
};
