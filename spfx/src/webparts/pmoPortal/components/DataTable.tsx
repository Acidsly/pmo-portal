import * as React from 'react';
import { nextLock, cellText } from '../logic/ui';
import { tv } from '../i18n/values';
import { toCsv } from '../logic/csv';
import { AppCtx } from './ctx';
import { TableDefs, Col } from './defs';
import { applyTable, filterValues, nextSort, toggleCol, moveCol, loadState, saveState, TableState, colWidths, resizeCol, resetWidths } from '../logic/table';
import { Pop } from './Pop';
import { Funnel, Gear } from './Icons';

type PopState = { kind: 'filter'; col: string; anchor: HTMLElement } | { kind: 'cols'; anchor: HTMLElement } | undefined;

/** Таблица прототипа (dataTable, строки 1090–1103): «Показано X з Y», чипы фильтров, сортировка, фильтр, шестерёнка. */
/** left — кнопки слева в строке команд (cmdbar), right — перед шестерёнкой (выбор представления). */
export function DataTable<R extends { id: number }>(p: { tkey: string; defs: TableDefs<R>; rows: R[]; empty?: string; left?: React.ReactNode; right?: React.ReactNode;
  /** #58: карточка строки — на узком экране вместо таблицы (те же строки; сортировка и фильтры — заданные на широком экране) */ card?: (r: R) => React.ReactNode;
  /** строки как на экране (фильтры и сортировка) — например, «попередній / наступний» в окне записи */ onShown?: (rows: R[]) => void }): JSX.Element {
  const { t } = React.useContext(AppCtx);
  const { cols: defs, lock, defaults } = p.defs;
  const known = Object.keys(defs);
  const [st, setSt] = React.useState<TableState>(() => loadState(p.tkey, defaults, known, lock));
  const [pop, setPop] = React.useState<PopState>(undefined);
  const [q, setQ] = React.useState('');
  const save = (n: TableState): void => { setSt(n); saveState(p.tkey, n); };
  const close = React.useCallback(() => { setPop(undefined); setQ(''); }, []);
  const data = applyTable(p.rows, defs, st);
  React.useEffect(() => { if (p.onShown) p.onShown(data); });
  const shownCols = st.cols.filter(c => defs[c]);
  const fl = (d: Col<R>, v: string): React.ReactNode => (d.flabel ? d.flabel(v) : v === '' ? t('notSet') : tv(v));

  const chips = Object.keys(st.filters).filter(id => st.filters[id] && st.filters[id].length && defs[id]).map(id =>
    <span key={id} className="fchip">{defs[id].label}: {st.filters[id].map((v, i) => <React.Fragment key={v}>{i ? ', ' : ''}{fl(defs[id], v)}</React.Fragment>)}
      <button aria-label={t('clear')} onClick={() => save({ ...st, filters: { ...st.filters, [id]: [] } })}>×</button></span>);


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
      <div className="pop-f"><button className="more" onClick={() => save({ ...st, cols: defaults.slice() })}>{t('colsReset')}</button>
        {st.widths ? <button className="more" onClick={() => save(resetWidths(st))}>{t('colWidthsReset')}</button> : null}</div>
    </>;
  }

  // CSV — ровно то, что на экране: видимые колонки, фильтры и сортировка; значок без текста — по его подсказке
  const tableRef = React.useRef<HTMLDivElement>(null);
  // #33: на широком экране ширины колонок закрепляются после первой раскладки по содержимому — фильтры и смена вида их
  // не меняют; пересчёт — при смене набора колонок и размера окна. На телефоне и планшете (< 900 px) — как раньше.
  const colsKey = shownCols.join(',');
  const [lockW, setLockW] = React.useState<{ key: string; w: number[] } | null>(null);
  React.useLayoutEffect(() => {
    // решение — logic/ui.ts nextLock; замер — только когда таблица видна (скрытая вкладка / панель — ширины ещё нет)
    const el = tableRef.current;
    const need = window.innerWidth >= 900 && !(lockW && lockW.key === colsKey) && !!el && !!el.clientWidth;
    const w = need ? Array.prototype.map.call(el!.querySelectorAll('thead th'), (th: Element) => Math.round(th.getBoundingClientRect().width)) as number[] : null;
    const nl = nextLock(window.innerWidth, lockW, colsKey, shownCols.length, w);
    if (nl !== lockW) setLockW(nl);
  });
  React.useEffect(() => {
    const on = (): void => setLockW(null);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const locked = lockW && lockW.key === colsKey ? lockW.w : null;
  // #35, #49: ширины пользователя поверх закреплённых по раскладке (logic/table.ts colWidths); во время перетаскивания — живая ширина
  const [drag, setDrag] = React.useState<{ id: string; startW: number; dx: number } | null>(null);
  const base = colWidths(shownCols, st.widths, locked);
  const widths = base && drag ? base.map((w, k) => (shownCols[k] === drag.id ? resizeCol(st, drag.id, drag.startW, drag.dx).widths![drag.id] : w)) : base;
  const stRef = React.useRef(st); stRef.current = st;   // по отпусканию — свежее состояние таблицы, а не на момент нажатия
  const startResize = (id: string, idx: number) => (e: React.PointerEvent<HTMLSpanElement>): void => {
    if (e.button) return;   // только основная кнопка
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, startW = base ? base[idx] : 0;
    const move = (ev: PointerEvent): void => setDrag({ id, startW, dx: ev.clientX - x0 });
    // обработчики снимают друг друга — объявлены заранее
    let up: (ev: PointerEvent) => void = () => undefined;
    let cancel: () => void = () => undefined;
    const stop = (): void => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
    up = (ev: PointerEvent): void => { stop(); setDrag(null); save(resizeCol(stRef.current, id, startW, ev.clientX - x0)); };
    cancel = (): void => { stop(); setDrag(null); };   // жест отменён — ширина прежняя
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
  };
  const head = shownCols.map((id, idx) => {
    const d = defs[id]; const s = st.sort && st.sort.id === id ? st.sort.dir : '';
    const fa = st.filters[id] && st.filters[id].length > 0;
    const label = d.head || <span>{d.label}</span>;
    return <th key={id} className={d.cls || ''}><span className={'th' + (d.filter ? ' hasf' : '')}>
      {d.sort ? <button className={'sortb' + (s ? ' on' : '')} title={`${t('sortBy')}: ${d.label}`} onClick={() => save(nextSort(st, id))}>{label}<i>{s === 'asc' ? '↑' : s === 'desc' ? '↓' : ''}</i></button> : label}
      {d.filter ? <button className={'fbtn' + (fa ? ' on' : '')} aria-label={`${t('filter')}: ${d.label}`} title={`${t('filter')}: ${d.label}`}
        onClick={e => { const a = e.currentTarget; setPop(pop && pop.kind === 'filter' && pop.col === id ? undefined : { kind: 'filter', col: id, anchor: a }); setQ(''); }}><Funnel /></button> : null}
    </span>{widths ? <span className="col-rs" title={t('colResize')} onPointerDown={startResize(id, idx)} /> : null}</th>;
  });

  const exportCsv = (): void => {
    const el = tableRef.current; if (!el) return;
    const rows = Array.prototype.map.call(el.querySelectorAll('tbody tr'), (tr: Element) => Array.prototype.map.call(tr.children, cellText) as string[]) as string[][];
    const blob = new Blob([toCsv(shownCols.map(id => defs[id].label), rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${p.tkey}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return <>
    <div className="cmdbar">{p.left}<span className="spacer" />{p.right}
      <button className="iconbtn csv-btn" title={t('csvTitle')} aria-label={t('csvTitle')} disabled={!data.length} onClick={exportCsv}>{t('csv')}</button>
      <button className="iconbtn gear-lg" aria-label={t('cols')} title={t('cols')}
        onClick={e => { const a = e.currentTarget; setPop(pop && pop.kind === 'cols' ? undefined : { kind: 'cols', anchor: a }); }}><Gear /></button></div>
    <div className="dt-bar"><span className="muted">{t('shown')} {data.length} {t('of')} {p.rows.length}</span>{chips}</div>
    {data.length ? <><div className={'tablewrap dt' + (p.card ? ' has-cards' : '')} ref={tableRef}><table className={widths ? 'locked' : undefined}
      style={widths ? { tableLayout: 'fixed', width: widths.reduce((a, b) => a + b, 0) } : undefined}>
      {widths ? <colgroup>{widths.map((w, i) => <col key={shownCols[i]} style={{ width: w }} />)}</colgroup> : null}<thead><tr>{head}</tr></thead>
      <tbody>{data.map(r => <tr key={r.id} className="row">{shownCols.map(id => <td key={id} className={defs[id].cls || ''}>{defs[id].cell(r)}</td>)}</tr>)}</tbody></table></div>
      {p.card ? <div className="mcards">{data.map(r => <React.Fragment key={r.id}>{p.card!(r)}</React.Fragment>)}</div> : null}</>
      : <p className="empty">{p.empty || t('empty')}</p>}
    {pop ? <Pop anchor={pop.anchor} align={pop.kind === 'filter' ? 'left' : 'right'} onClose={close}>{popBody}</Pop> : null}
  </>;
}
