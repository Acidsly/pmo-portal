import * as React from 'react';
import { tv } from '../i18n/values';
import { Kpis, DeptRow } from '../logic/analytics';
import { Risk, Project } from '../data/types';
import { riskScore, scoreLevel } from '../logic/status';
import { Score } from './Bits';

/** Полоса показателей главной (kpiStrip прототипа): число, подпись, подсказка; клик — отфильтрованный список. */
export const KpiStrip: React.FC<{ k: Kpis; pmo: boolean; t(k: string): string; go(page: string, view: string): void }> = ({ k, pmo, t, go }) => {
  const tiles: { n: string; label: string; sub?: string; bad: boolean; on(): void }[] = [
    { n: String(k.active), label: t('kpiActive'), bad: false, on: () => go('projects', 'all') },
    { n: k.active ? k.freshPct + '%' : '—', label: t('kpiFresh'), sub: t('kpiFreshSub').replace('{n}', String(k.fresh)).replace('{m}', String(k.active)),
      bad: k.active > 0 && k.freshPct < 70, on: () => go('projects', 'stale') },
    ...(pmo ? [{ n: String(k.awaiting), label: t('viewAwaiting'), bad: k.awaiting > 0, on: () => go('reports', 'awaiting') }] : []),
    { n: String(k.highRisks), label: t('kpiHigh'), bad: k.highRisks > 0, on: () => go('risks', 'high') },
    { n: String(k.overdue), label: t('kpiLate'), bad: k.overdue > 0, on: () => go('projects', 'late') }];
  return <div className="kpis">{tiles.map((x, i) => <button key={i} className={'kpi' + (x.bad ? ' bad' : '')} onClick={x.on}>
    <b>{x.n}</b><span className="kl">{x.label}</span>{x.sub ? <small>{x.sub}</small> : null}</button>)}</div>;
};

const LVL: Record<string, string> = { r: 'var(--r)', y: 'var(--y)', g: 'var(--g)' };
/** Карта ризиків 5×5 (riskMap прототипа): рядки — ймовірність 5→1, стовпці — вплив 1→5; клік по клітинці — список її ризиків. */
export const RiskMap: React.FC<{ m: Risk[][][]; byId: Record<number, Project>; t(k: string): string; openRisk(id: number, projectId: number): void }> =
  ({ m, byId, t, openRisk }) => {
    const [cell, setCell] = React.useState<string>('');
    const cells: React.ReactNode[] = [];
    for (let pp = 5; pp >= 1; pp--) {
      cells.push(<span key={'a' + pp} className="rm-ax">{pp}</span>);
      for (let ii = 1; ii <= 5; ii++) {
        const n = m[pp - 1][ii - 1].length; const key = pp + '-' + ii;
        cells.push(<button key={key} className={'rm-cell' + (cell === key ? ' on' : '')} style={{ ['--c' as string]: LVL[scoreLevel(pp * ii)] } as React.CSSProperties}
          disabled={!n} aria-label={`${t('cProb')} ${pp} × ${t('cImp')} ${ii}: ${n}`} onClick={() => setCell(cell === key ? '' : key)}>{n || ''}</button>);
      }
    }
    cells.push(<span key="z" />, ...[1, 2, 3, 4, 5].map(ii => <span key={'x' + ii} className="rm-ax">{ii}</span>), <span key="xl" className="rm-xl">{t('cImp')}</span>);
    const sel = cell ? m[Number(cell[0]) - 1][Number(cell[2]) - 1] : [];
    return <>
      <div className="rmap"><span className="rm-y">{t('cProb')}</span><div className="rm-grid">{cells}</div></div>
      {sel.length ? <div className="rm-list rlist">{sel.map(k => <button key={k.id} className="rrow" onClick={() => openRisk(k.id, k.projectId)}>
        <Score s={riskScore(k.probability, k.impact)} /><span className="rt">{k.title}</span><span className="muted">{byId[k.projectId] ? byId[k.projectId].title : ''}</span></button>)}</div> : null}
      <p className="hint" style={{ margin: '12px 0 0' }}>{t('rmHint')}</p>
    </>;
  };

/** Портфель за напрямами (deptBars прототипа): смуги за станом, довжина — від найбільшого напряму. */
export const DeptBars: React.FC<{ rows: DeptRow[]; t(k: string): string; empty: string }> = ({ rows, t, empty }) => {
  if (!rows.length) return <p className="empty">{empty}</p>;
  const max = Math.max(...rows.map(r => r.total));
  const segs: [keyof DeptRow, string, string][] = [['r', 'var(--r)', tv('Червоний')], ['y', 'var(--y)', tv('Жовтий')], ['g', 'var(--g)', tv('Зелений')], ['na', 'var(--na)', t('notRated')]];
  return <div className="depts">{rows.map(r => <div key={r.dept} className="dept-row">
    <span className="dn" title={tv(r.dept)}>{tv(r.dept)}</span>
    <span className="dbar" style={{ width: `${Math.max(4, r.total / max * 100)}%` }}>{segs.map(([k, c, l]) => { const n = r[k] as number;
      return n ? <i key={k} style={{ width: `${n / r.total * 100}%`, background: c }} title={`${l}: ${n}`} /> : null; })}</span>
    <b>{r.total}</b></div>)}</div>;
};
