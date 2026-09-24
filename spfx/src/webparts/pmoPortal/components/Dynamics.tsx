import * as React from 'react';
import { Snapshot } from '../logic/dynamics';
import { fmtDate } from './Bits';

/** «Динаміка стану портфеля» — геометрия прототипа (dynamics, строки 937–956). */
export const Dynamics: React.FC<{ pts: Snapshot[]; label: string; today: string; hint: string }> = ({ pts, label, today, hint }) => {
  const W = 500, H = 230, L = 30, B = 30, TP = 12;
  const max = Math.max(1, ...pts.map(p => p.g + p.y + p.r));
  const slot = (W - L - 8) / pts.length, bw = slot * 0.5, y = (v: number): number => H - B - v / max * (H - B - TP);
  const K: ['g' | 'y' | 'r', string, string][] = [['g', 'var(--g)', 'Зелений'], ['y', 'var(--y)', 'Жовтий'], ['r', 'var(--r)', 'Червоний']];
  return <>
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, Math.ceil(max / 2), max].map((v, i) => <g key={'l' + i}><line x1={L} x2={W - 4} y1={y(v)} y2={y(v)} stroke="var(--line)" />
        <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-2)">{v}</text></g>)}
      {pts.map((p, i) => {
        const x = L + i * slot + (slot - bw) / 2; let base = 0;
        return <g key={p.date}>
          {K.map(([k, cl, name]) => {
            const v = p[k]; if (!v) return null;
            const y1 = y(base + v), h = y(base) - y1; base += v;
            return <g key={k}><rect x={x} y={y1} width={bw} height={Math.max(h - 2, 1)} rx="5" fill={cl}><title>{`${fmtDate(p.date)}: ${name} — ${v}`}</title></rect>
              {h > 16 ? <text x={x + bw / 2} y={y1 + h / 2 + 3} textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">{v}</text> : null}</g>;
          })}
          <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--text-2)">{i === pts.length - 1 ? today : fmtDate(p.date).slice(0, 5)}</text>
        </g>;
      })}
    </svg>
    <p className="hint">{hint}</p>
  </>;
};
