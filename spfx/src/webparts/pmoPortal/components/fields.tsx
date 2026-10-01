import * as React from 'react';
import { Person } from '../data/types';
import { Rag, RAGS } from '../logic/rag';
import { Avatar, ragColor } from './Bits';
import { tv } from '../i18n/values';
import { AppCtx } from './ctx';
import { maskDmy, parseDmy, formatDmy } from '../logic/dates';

/** Строка формы (frow прототипа): подпись, «*» для обязательного, подсказка. */
export const Frow: React.FC<{ label: string; htmlFor?: string; req?: boolean; hint?: string; children?: React.ReactNode }> = p =>
  <div className="frow"><label className="t" htmlFor={p.htmlFor}>{p.label}{p.req ? ' *' : ''}</label>{p.children}{p.hint ? <p className="hint">{p.hint}</p> : null}</div>;

/** Выбор одного значения кнопками (segPick прототипа: div.opts, radio + label). */
export function SegPick<V extends string>(p: { name: string; options: V[]; value: V; onChange(v: V): void; dots?: boolean; disabled?: boolean }): JSX.Element {
  return <div className="opts">{p.options.map((v, i) => <React.Fragment key={v}>
    <input type="radio" id={p.name + i} name={p.name} value={v} checked={v === p.value} disabled={p.disabled} onChange={() => p.onChange(v)} />
    <label htmlFor={p.name + i}>{p.dots ? <span className="dot sm" style={{ background: ragColor(v as unknown as Rag) }} /> : null}{tv(v)}</label>
  </React.Fragment>)}</div>;
}

/** Оценка RAG (ragPick прототипа): fieldset.ragpick с тремя кнопками-точками. */
export const RagPick: React.FC<{ name: string; label: string; req?: boolean; value: Rag; onChange(v: Rag): void }> = p =>
  <fieldset className="ragpick"><legend>{p.label}{p.req ? ' *' : ''}</legend>
    <SegPick name={p.name} options={RAGS} value={p.value} onChange={p.onChange} dots={true} /></fieldset>;

/** Дата YYYY-MM-DD (input type=date). */
/** Поле даты (#26): «дд.мм.рррр» с подсказкой на языке интерфейса (встроенное поле браузера берёт язык Windows/Chrome),
 *  цифровая клавиатура на телефоне; кнопка — календарь браузера. Значение наружу — ISO «yyyy-mm-dd» или ''. */
export const DateIn: React.FC<{ id: string; value: string; onChange(v: string): void; disabled?: boolean }> = p => {
  const { t } = React.useContext(AppCtx);
  const [txt, setTxt] = React.useState(formatDmy(p.value));
  const native = React.useRef<HTMLInputElement>(null);
  // значение сменили снаружи (календарь, новый проект в форме отчёта) — показать его
  React.useEffect(() => { if (parseDmy(txt) !== p.value) setTxt(formatDmy(p.value)); }, [p.value]);
  const pick = (): void => {
    const el = native.current as (HTMLInputElement & { showPicker?: () => void }) | null; if (!el) return;
    try { if (el.showPicker) el.showPicker(); else el.click(); } catch { el.click(); }
  };
  return <span className="date-in">
    <input type="text" id={p.id} inputMode="numeric" autoComplete="off" placeholder={t('datePh')} value={txt} disabled={p.disabled}
      onChange={e => { const m = maskDmy(e.target.value); setTxt(m); const v = parseDmy(m); const nv = v === null ? '' : v; if (nv !== p.value) p.onChange(nv); }}
      onBlur={() => { if (parseDmy(txt) === null) setTxt(''); }} />   {/* неполная дата — значения нет (а не прежняя дата) */}
    <button type="button" className="date-btn" aria-label={t('pickDate')} title={t('pickDate')} disabled={p.disabled} onClick={pick}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        d="M7 3v3M17 3v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5z" /></svg></button>
    <input ref={native} type="date" className="date-native" tabIndex={-1} aria-hidden="true" value={p.value} disabled={p.disabled}
      onChange={e => { p.onChange(e.target.value); setTxt(formatDmy(e.target.value)); }} />
  </span>;
};

/** Сообщение об ошибке формы (p.err прототипа). */
export const Err: React.FC<{ msg: string }> = ({ msg }) => (msg ? <p className="err" role="alert">{msg}</p> : null);

/** Текст ошибки записи для человека: известные ошибки — переводом (папки нет, нет прав, конфликт правок), остальные — как есть. */
const KNOWN_ERR: Record<string, string> = { notReady: 'errNotReady', noRights: 'errNoRights', conflict: 'errConflict' };
/** Отказ проверки перед записью (logic/guard.ts) — текст с подстановками {date} {pm} {state}. */
export const guardText = (t: (k: string) => string, key: string, args: Record<string, string> = {}): string =>
  Object.keys(args).reduce((m, k) => m.split('{' + k + '}').join(k === 'state' ? tv(args[k]) : args[k]), t(key));
export const errText = (t: (k: string) => string, x: unknown): string => {
  const m = String((x as Error) && (x as Error).message !== undefined ? (x as Error).message : x);
  return KNOWN_ERR[m] ? t(KNOWN_ERR[m]) : m;
};

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
        else if (e.key === 'Enter') { e.preventDefault(); if (found[hi]) add(found[hi]); }   // Enter не отправляет форму
        else if (e.key === 'Escape') { setQ(''); setFound([]); }
      }} /> : null}
    {found.length ? <div className="pop-list picker-list" role="listbox">{found.map((x, i) =>
      <button type="button" key={x.email} className={'pop-row' + (i === hi ? ' on' : '')} role="option" aria-selected={i === hi} onMouseDown={e => { e.preventDefault(); add(x); }}>
        <span className="person"><Avatar name={x.name} /><span className="pn"><b>{x.name}</b><small>{x.email}</small></span></span></button>)}</div> : null}
  </div>;
};

/** Варианты выбора: значение хранится как есть, подпись — на языке интерфейса. */
export const Opts: React.FC<{ values: string[] }> = ({ values }) => <>{values.map(x => <option key={x} value={x}>{tv(x)}</option>)}</>;
