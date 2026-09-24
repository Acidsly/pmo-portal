import * as React from 'react';
import { Rag } from '../logic/rag';
import { Fresh } from '../logic/status';
import { Person } from '../data/types';

const RC: Record<string, string> = { 'Зелений': 'var(--g)', 'Жовтий': 'var(--y)', 'Червоний': 'var(--r)' };
const FC: Record<Fresh, string> = { g: 'var(--g)', y: 'var(--y)', r: 'var(--r)', na: 'var(--na)' };
const COLORS = ['#8764b8', '#038387', '#ca5010', '#0078d4', '#498205', '#c239b3', '#986f0b', '#4f6bed'];

/** Даты и деньги — всегда в формате uk-UA, как в прототипе. */
export const fmtDate = (iso: string): string => (iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('uk-UA') : '');

export const RagDot: React.FC<{ v: Rag; notRated: string }> = ({ v, notRated }) =>
  <span className="ragdot" title={v || notRated} aria-label={v || notRated} style={{ background: v ? RC[v] : 'var(--na)' }} />;

export const FreshDate: React.FC<{ iso: string; fresh: Fresh; none: string }> = ({ iso, fresh, none }) =>
  <span className="rag"><span className="dot sm" style={{ background: FC[fresh] }} />{iso ? fmtDate(iso) : <span className="muted">{none}</span>}</span>;

export const Avatar: React.FC<{ name: string }> = ({ name }) => {
  const c = COLORS[Array.from(name).reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];
  return <span className="pav" style={{ background: c }} aria-hidden="true">{name.split(' ').map(x => x.charAt(0)).join('').slice(0, 2)}</span>;
};

export const PersonCell: React.FC<{ p: Person | null }> = ({ p }) => p
  ? <span className="person" title={p.email}><Avatar name={p.name} /><span className="pn"><b>{p.name}</b></span></span>
  : <span className="muted">—</span>;

export const Score: React.FC<{ s: number }> = ({ s }) =>
  <span className="chip" style={{ background: s >= 15 ? 'var(--r)' : s >= 8 ? 'var(--y)' : 'var(--g)' }}>{s}</span>;

export const money = (n: number): string => Math.round(n || 0).toLocaleString('uk-UA') + ' ₴';
export const ragColor = (v: Rag): string => (v ? RC[v] : 'var(--na)');
export const freshColor = (f: Fresh): string => FC[f];

/** Пилюля состояния с точкой (ragHtml прототипа). */
export const RagPill: React.FC<{ v: Rag; notRated: string }> = ({ v, notRated }) =>
  <span className="pill" style={{ ['--c' as string]: ragColor(v) } as React.CSSProperties}><span className="dot sm" />{v || notRated}</span>;

/** Полоса выполнения (barHtml прототипа). */
export const Progress: React.FC<{ v: number }> = ({ v }) =>
  <span className="prog" role="img" aria-label={`${v}%`}><span className="track"><i style={{ width: `${Math.min(v, 100)}%`, background: v >= 100 ? 'var(--g)' : 'var(--theme)' }} /></span><b>{v}%</b></span>;

/** Несколько людей: стопка аватаров, первый по имени, «+N» (peopleCell прототипа). */
export const People: React.FC<{ list: Person[] }> = ({ list }) => list.length
  ? <span className="plist" title={list.map(x => x.name).join(', ')}><span className="astack">{list.slice(0, 3).map(x => <Avatar key={x.id} name={x.name} />)}</span>
      <b>{list[0].name}</b>{list.length > 1 ? <span className="more-n">+{list.length - 1}</span> : null}</span>
  : <span className="muted">—</span>;

export const Muted: React.FC = () => <span className="muted">—</span>;
