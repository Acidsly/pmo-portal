import * as React from 'react';
import { AppCtx } from './ctx';
import { TableDefs, Col } from './defs';
import { applyTable, filterValues, nextSort, toggleCol, moveCol, loadState, saveState, TableState } from '../logic/table';
import { Pop } from './Pop';
import { Funnel, Gear } from './Icons';

type PopState = { kind: 'filter'; col: string; anchor: HTMLElement } | { kind: 'cols'; anchor: HTMLElement } | undefined;

/** Таблица прототипа (dataTable, строки 1090–1103): «Показано X з Y», чипы фильтров, сортировка, фильтр, шестерёнка. */
/** left — кнопки слева в строке команд (cmdbar), right — перед шестерёнкой (выбор представления). */
export function DataTable<R extends { id: number }>(p: { tkey: string; defs: TableDefs<R>; rows: R[]; empty?: string; left?: React.ReactNode; right?: React.ReactNode }): JSX.Element {
  const { t } = React.useContext(AppCtx);
  const { cols: defs, lock, defaults } = p.defs;
  const known = Object.keys(defs);
  const [st, setSt] = React.useState<TableState>(() => loadState(p.tkey, defaults, known, lock));
  const [pop, setPop] = React.useState<PopState>(undefined);
  const [q, setQ] = React.useState('');
  const save = (n: TableState): void => { setSt(n); saveState(p.tkey, n); };
  const close = React.useCallback(() => { setPop(undefined); setQ(''); }, []);
  const data = applyTable(p.rows, defs, st);
  const shownCols = st.cols.filter(c => defs[c]);
  const fl = (d: Col<R>, v: string): React.ReactNode => (d.flabel ? d.flabel(v) : v === '' ? t('notSet') : v);

  const chips = Object.keys(st.filters).filter(id => st.filters[id] && st.filters[id].length && defs[id]).map(id =>
    <span key={id} className="fchip">{defs[id].label}: {st.filters[id].map((v, i) => <React.Fragment key={v}>{i ? ', ' : ''}{fl(defs[id], v)}</React.Fragment>)}
      <button aria-label={t('clear')} onClick={() => save({ ...st, filters: { ...st.filters, [id]: [] } })}>×</button></span>);

  const head = shownCols.map(id => {
    const d = defs[id]; const s = st.sort && st.sort.id === id ? st.sort.dir : '';
    const fa = st.filters[id] && st.filters[id].length > 0;
    const label = d.head || <span>{d.label}</span>;
    return <th key={id} className={d.cls || ''}><span className={'th' + (d.filter ? ' hasf' : '')}>
      {d.sort ? <button className={'sortb' + (s ? ' on' : '')} title={`${t('sortBy')}: ${d.label}`} onClick={() => save(nextSort(st, id))}>{label}<i>{s === 'asc' ? '↑' : s === 'desc' ? '↓' : ''}</i></button> : label}
      {d.filter ? <button className={'fbtn' + (fa ? ' on' : '')} aria-label={`${t('filter')}: ${d.label}`} title={`${t('filter')}: ${d.label}`}
        onClick={e => { const a = e.currentTarget; setPop(pop && pop.kind === 'filter' && pop.col === id ? undefined : { kind: 'filter', col: id, anchor: a }); setQ(''); }}><Funnel /></button> : null}
    </span></th>;
  });

  let popBody: React.ReactNode = null;
  if (pop && pop.kind === 'filter') {
    const d = defs[pop.col]; const cur = st.filters[pop.col] || [];
    const vals = filterValues(p.rows, d); const ql = q.toLowerCase();
    const flip = (v: string): void => { const set = cur.indexOf(v) >= 0 ? cur.filter(x => x !== v) : cur.concat(v); save({ ...st, filters: { ...st.filters, [pop.col]: set } }); };
    popBody = <>
      <div className="pop-h">{t('filter')}: {d.label}</div>
      {vals.length > 7 ? <input type="search" className="pop-q" placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} /> : null}
      <div className="pop-list">{vals.filter(v => !ql || v.toLowerCase().indexOf(ql) >= 0).map(v =>
        <label key={v} className="pop-row"><input type="checkbox" checked={cur.indexOf(v) >= 0} onChange={() => flip(v)} /><span>{fl(d, v)}</span></label>)}</div>
      <div className="pop-f"><button className="more" onClick={() => save({ ...st, filters: { ...st.filters, [pop.col]: [] } })}>{t('clear')}</button></div>
    </>;
  } else if (pop && pop.kind === 'cols') {
    const all = st.cols.concat(known.filter(k => st.cols.indexOf(k) < 0));
    popBody = <>
      <div className="pop-h">{t('cols')}</div>
      <div className="pop-list">{all.map(id => {
        const on = st.cols.indexOf(id) >= 0, idx = st.cols.indexOf(id), isLock = id === lock;
        return <div key={id} className="pop-row col-row">
          <label><input type="checkbox" checked={on} disabled={isLock} onChange={() => save(toggleCol(st, id, lock))} /><span>{defs[id].label}</span></label>
          <span className="mv">
            <button aria-label="↑" disabled={!on || idx <= 1} onClick={() => save(moveCol(st, id, -1, lock))}>↑</button>
            <button aria-label="↓" disabled={!on || isLock || idx === st.cols.length - 1} onClick={() => save(moveCol(st, id, 1, lock))}>↓</button>
          </span></div>;
      })}</div>
      <div className="pop-f"><button className="more" onClick={() => save({ ...st, cols: defaults.slice() })}>{t('colsReset')}</button></div>
    </>;
  }

  return <>
    <div className="cmdbar">{p.left}<span className="spacer" />{p.right}
      <button className="iconbtn gear-lg" aria-label={t('cols')} title={t('cols')}
        onClick={e => { const a = e.currentTarget; setPop(pop && pop.kind === 'cols' ? undefined : { kind: 'cols', anchor: a }); }}><Gear /></button></div>
    <div className="dt-bar"><span className="muted">{t('shown')} {data.length} {t('of')} {p.rows.length}</span>{chips}</div>
    {data.length ? <div className="tablewrap dt"><table><thead><tr>{head}</tr></thead>
      <tbody>{data.map(r => <tr key={r.id} className="row">{shownCols.map(id => <td key={id} className={defs[id].cls || ''}>{defs[id].cell(r)}</td>)}</tr>)}</tbody></table></div>
      : <p className="empty">{p.empty || t('empty')}</p>}
    {pop ? <Pop anchor={pop.anchor} align={pop.kind === 'filter' ? 'left' : 'right'} onClose={close}>{popBody}</Pop> : null}
  </>;
}
