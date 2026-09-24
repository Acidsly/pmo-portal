import * as React from 'react';
import { Person } from '../data/types';
import { Rag, RAGS } from '../logic/rag';
import { Avatar, ragColor } from './Bits';

/** Строка формы (frow прототипа): подпись, «*» для обязательного, подсказка. */
export const Frow: React.FC<{ label: string; htmlFor?: string; req?: boolean; hint?: string; children?: React.ReactNode }> = p =>
  <div className="frow"><label className="t" htmlFor={p.htmlFor}>{p.label}{p.req ? ' *' : ''}</label>{p.children}{p.hint ? <p className="hint">{p.hint}</p> : null}</div>;

/** Выбор одного значения кнопками (segPick прототипа: div.opts, radio + label). */
export function SegPick<V extends string>(p: { name: string; options: V[]; value: V; onChange(v: V): void; dots?: boolean; disabled?: boolean }): JSX.Element {
  return <div className="opts">{p.options.map((v, i) => <React.Fragment key={v}>
    <input type="radio" id={p.name + i} name={p.name} value={v} checked={v === p.value} disabled={p.disabled} onChange={() => p.onChange(v)} />
    <label htmlFor={p.name + i}>{p.dots ? <span className="dot sm" style={{ background: ragColor(v as unknown as Rag) }} /> : null}{v}</label>
  </React.Fragment>)}</div>;
}

/** Оценка RAG (ragPick прототипа): fieldset.ragpick с тремя кнопками-точками. */
export const RagPick: React.FC<{ name: string; label: string; req?: boolean; value: Rag; onChange(v: Rag): void }> = p =>
  <fieldset className="ragpick"><legend>{p.label}{p.req ? ' *' : ''}</legend>
    <SegPick name={p.name} options={RAGS} value={p.value} onChange={p.onChange} dots={true} /></fieldset>;

/** Дата YYYY-MM-DD (input type=date). */
export const DateIn: React.FC<{ id: string; value: string; onChange(v: string): void; disabled?: boolean }> = p =>
  <input type="date" id={p.id} value={p.value} disabled={p.disabled} onChange={e => p.onChange(e.target.value)} />;

/** Сообщение об ошибке формы (p.err прототипа). */
export const Err: React.FC<{ msg: string }> = ({ msg }) => (msg ? <p className="err" role="alert">{msg}</p> : null);

/** Выбор людей: выбранные — чипы с «×», поиск от 2 символов (стрелки, Enter, Esc). */
export const PeoplePicker: React.FC<{ id: string; value: Person[]; multi: boolean; onChange(v: Person[]): void; search(q: string): Promise<Person[]>;
  placeholder?: string; disabled?: boolean }> = p => {
  const [q, setQ] = React.useState('');
  const [found, setFound] = React.useState<Person[]>([]);
  const [hi, setHi] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    if (q.trim().length < 2) { setFound([]); return; }
    const h = window.setTimeout(() => p.search(q).then(r => { if (live) { setFound(r.filter(x => !p.value.some(v => v.email.toLowerCase() === x.email.toLowerCase()))); setHi(0); } }, () => undefined), 250);
    return () => { live = false; window.clearTimeout(h); };
  }, [q]);
  const add = (x: Person): void => { p.onChange(p.multi ? p.value.concat(x) : [x]); setQ(''); setFound([]); };
  const canAdd = p.multi || !p.value.length;
  return <div className="picker">
    {p.value.map(x => <span key={x.email} className="person pchip" title={x.email}><Avatar name={x.name} /><span className="pn"><b>{x.name}</b></span>
      {p.disabled ? null : <button type="button" className="x-sm" aria-label="×" onClick={() => p.onChange(p.value.filter(v => v.email !== x.email))}>×</button>}</span>)}
    {canAdd && !p.disabled ? <input id={p.id} type="search" value={q} placeholder={p.placeholder} autoComplete="off" onChange={e => setQ(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(hi + 1, found.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(hi - 1, 0)); }
        else if (e.key === 'Enter' && found[hi]) { e.preventDefault(); add(found[hi]); }
        else if (e.key === 'Escape') { setQ(''); setFound([]); }
      }} /> : null}
    {found.length ? <div className="pop-list picker-list" role="listbox">{found.map((x, i) =>
      <button type="button" key={x.email} className={'pop-row' + (i === hi ? ' on' : '')} role="option" aria-selected={i === hi} onMouseDown={e => { e.preventDefault(); add(x); }}>
        <span className="person"><Avatar name={x.name} /><span className="pn"><b>{x.name}</b><small>{x.email}</small></span></span></button>)}</div> : null}
  </div>;
};
