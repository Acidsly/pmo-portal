import * as React from 'react';
import { tv } from '../i18n/values';
import { Rag } from '../logic/rag';
import { Fresh } from '../logic/status';
import { Person } from '../data/types';
import { daysBetween } from '../logic/dates';

const RC: Record<string, string> = { 'Зелений': 'var(--g)', 'Жовтий': 'var(--y)', 'Червоний': 'var(--r)' };
const FC: Record<Fresh, string> = { g: 'var(--g)', y: 'var(--y)', r: 'var(--r)', na: 'var(--na)' };
const COLORS = ['#8764b8', '#038387', '#ca5010', '#0078d4', '#498205', '#c239b3', '#986f0b', '#4f6bed'];

/** Даты и деньги — всегда в формате uk-UA, как в прототипе. */
export const fmtDate = (iso: string): string => (iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('uk-UA') : '');

/** Дата и время (uk-UA): комментарии, отзывы, погодження. */
export const fmtDT = (iso: string): string => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); };

export const RagDot: React.FC<{ v: Rag; notRated: string }> = ({ v, notRated }) =>
  <span className="ragdot" title={tv(v) || notRated} aria-label={tv(v) || notRated} style={{ background: v ? RC[v] : 'var(--na)' }} />;

/** Подсказка к точке свежести (freshTip прототипа): сколько дней последнему погодженому отчёту и что значат цвета. */
export const freshTip = (t: (k: string) => string, iso: string, today: string): string =>
  (iso ? t('freshTip').replace('{n}', String(daysBetween(iso, today))) : t('freshNone'));

export const FreshDate: React.FC<{ iso: string; fresh: Fresh; none: string; tip?: string }> = ({ iso, fresh, none, tip }) =>
  <span className="rag" title={tip}><span className="dot sm" style={{ background: FC[fresh] }} />{iso ? fmtDate(iso) : <span className="muted">{none}</span>}</span>;

export const Avatar: React.FC<{ name: string }> = ({ name }) => {
  const c = COLORS[Array.from(name).reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];
  return <span className="pav" style={{ background: c }} aria-hidden="true">{name.split(' ').map(x => x.charAt(0)).join('').slice(0, 2)}</span>;
};

export const PersonCell: React.FC<{ p: Person | null }> = ({ p }) => p
  ? <span className="person" title={p.email}><Avatar name={p.name} /><span className="pn"><b>{p.name}</b></span></span>
  : <span className="muted">—</span>;

export const Score: React.FC<{ s: number }> = ({ s }) =>
  <span className="chip" style={{ background: s >= 15 ? 'var(--r)' : s >= 8 ? 'var(--y)' : 'var(--g)' }}>{s}</span>;

// все суммы портала — в долларах США, без пересчёта (#30)
export const money = (n: number): string => Math.round(n || 0).toLocaleString('uk-UA') + ' $';
export const ragColor = (v: Rag): string => (v ? RC[v] : 'var(--na)');
export const freshColor = (f: Fresh): string => FC[f];

/** Пилюля состояния с точкой (ragHtml прототипа). */
export const RagPill: React.FC<{ v: Rag; notRated: string }> = ({ v, notRated }) =>
  <span className="pill" style={{ ['--c' as string]: ragColor(v) } as React.CSSProperties}><span className="dot sm" />{tv(v) || notRated}</span>;

/** Полоса выполнения (barHtml прототипа). */
export const Progress: React.FC<{ v: number }> = ({ v }) =>
  <span className="prog" role="img" aria-label={`${v}%`}><span className="track"><i style={{ width: `${Math.min(v, 100)}%`, background: v >= 100 ? 'var(--g)' : 'var(--theme)' }} /></span><b>{v}%</b></span>;

/** Несколько людей: стопка аватаров, первый по имени, «+N» (peopleCell прототипа). */
export const People: React.FC<{ list: Person[] }> = ({ list }) => list.length
  ? <span className="plist" title={list.map(x => x.name).join(', ')}><span className="astack">{list.slice(0, 3).map(x => <Avatar key={x.id} name={x.name} />)}</span>
      <b>{list[0].name}</b>{list.length > 1 ? <span className="more-n">+{list.length - 1}</span> : null}</span>
  : <span className="muted">—</span>;

/** Период отчёта (#69): «з … по …», в один день — «за …»; прежние отчёты — их выбор («2 тижні»). */
export const periodText = (t: (k: string) => string, r: { date: string; period: string; periodFrom: string }): string =>
  (r.periodFrom ? (r.periodFrom < r.date ? t('periodFT').replace('{from}', fmtDate(r.periodFrom)).replace('{to}', fmtDate(r.date)) : t('periodDay').replace('{date}', fmtDate(r.date)))
    : r.period ? tv(r.period) : '');

/** Погодження статус-звіту: На погодженні — жёлтый, Погоджено — зелёный, Повернуто — красный. */
const AC: Record<string, string> = { 'На погодженні': 'var(--y)', 'Погоджено': 'var(--g)', 'Повернуто': 'var(--r)' };
export const ApBadge: React.FC<{ v: string }> = ({ v }) =>
  <span className="pill ap" style={{ ['--c' as string]: AC[v || 'На погодженні'] } as React.CSSProperties}><span className="dot sm" />{tv(v || 'На погодженні')}</span>;

/** Метка погодження самого нового отчёта (apMark прототипа): «Погоджено» / «На погодженні · дата» / «Повернуто · дата». */
export const RepMark: React.FC<{ r: { approval: string; date: string } | null | undefined }> = ({ r }) => r
  ? <span className="rep-ap"><ApBadge v={r.approval} />{r.approval !== 'Погоджено' ? <span className="muted">{fmtDate(r.date)}</span> : null}</span> : null;

/** Статус проекта или риска — цветная пилюля без точки (точка — у стану RAG). */
const SC: Record<string, string> = { 'Ініціація': '#5856d6', 'Планування': 'var(--theme)', 'Реалізація': 'var(--g)', 'Призупинено': 'var(--y)',
  'Скасовано': 'var(--na)', 'Архівний': 'var(--na)', 'Завершено': 'var(--g)', 'Відкрито': 'var(--y)', 'В роботі': 'var(--theme)', 'Закрито': 'var(--g)' };
export const StatusPill: React.FC<{ v: string }> = ({ v }) => (v
  ? <span className="pill st" style={{ ['--c' as string]: SC[v] || 'var(--na)' } as React.CSSProperties}>{tv(v)}</span> : <span className="muted">—</span>);

export const Muted: React.FC = () => <span className="muted">—</span>;
