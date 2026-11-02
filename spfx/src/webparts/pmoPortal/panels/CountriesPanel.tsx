import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { CountryCeo } from '../data/map';
import { Person } from '../data/types';
import { CountryName, validateCountry, countryWarnings, countryStale } from '../logic/countries';
import { isArch } from '../logic/status';
import { Frow, Err, PeoplePicker, errText } from '../components/fields';
import { tv } from '../i18n/values';

interface Draft { id: number; name: string; en: string; ru: string; order: string; active: boolean; ceo: Person[] }
interface Row { n: CountryName; c?: CountryCeo }

/** «Країни і CEO» (план 2026-11-02-countries-directory.md): довідник ведёт PMO — назви, порядок, активна (список «Назви країн», читают все)
 *  и CEO (список «Країни», только PMO и владельцы). Права CEO на проекты выдаёт синхронизация (~15 минут). Удаления нет — только «вимкнути». */
export const CountriesPanel: React.FC<{ data: PortalData; onCancel(): void }> = ({ data, onCancel }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [d, setD] = React.useState<Draft | null>(null);
  const [opened, setOpened] = React.useState<{ n?: string; c?: string }>({});
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const load = async (): Promise<Row[]> => {
    const a = await c.repo.loadCountryAdmin();
    const r = a.names.map(n => ({ n, c: a.ceo.filter(x => x.name === n.name)[0] }));
    setRows(r); return r;
  };
  React.useEffect(() => { load().catch(x => setErr(errText(t, x))); }, []);
  const active = (name: string): number => data.projects.filter(p => p.country === name && !isArch(p.status)).length;
  const head = <div className="ph"><div><div className="k"><EntTag kind="assign" /><span>{t('listLabel')} «{t('coTitle')}»</span></div>
    <h2>{d ? (d.id ? tv(d.name) : t('coNew')) : t('coTitle')}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>;
  if (!data.canCountries) return <>{head}<p className="note lock">🔒 {t('noEdit')}</p></>;

  const edit = (r?: Row): void => {
    setErr('');
    setOpened({ n: r ? r.n.modified : undefined, c: r && r.c ? r.c.modified : undefined });
    const next = rows ? Math.max(0, ...rows.map(x => (isNaN(x.n.order) ? 0 : x.n.order))) + 10 : 10;
    setD(r ? { id: r.n.id, name: r.n.name, en: r.n.en === r.n.name ? '' : r.n.en, ru: r.n.ru === r.n.name ? '' : r.n.ru, order: isNaN(r.n.order) ? '' : String(r.n.order), active: r.n.active, ceo: r.c ? r.c.ceo : [] }
      : { id: 0, name: '', en: '', ru: '', order: String(next), active: true, ceo: [] });
  };

  if (!d) return <>{head}
    <p className="note">{t('coHint')}</p>
    {err ? <Err msg={err} /> : !rows ? <p className="empty">…</p> : <ul className="co-list" id="co-list">{rows.map(r => <li key={r.n.id || r.n.name}>
      <button type="button" className="co-row" data-name={r.n.name} onClick={() => edit(r)}>
        <span className="co-n"><b>{tv(r.n.name)}</b>{r.n.active ? null : <span className="muted"> · {t('coOff')}</span>}</span>
        <span className="co-ceo">{r.c && r.c.ceo.length ? r.c.ceo.map(x => x.name).join(', ') : <span className="muted">{t('coNoCeo')}</span>}</span>
        <span className="co-cnt muted" title={t('coProjects')}>{active(r.n.name)}</span></button></li>)}</ul>}
    <div className="actions"><button type="button" className="btn primary" id="co-add" disabled={!rows} onClick={() => edit()}>{t('coAdd')}</button>
      <button type="button" className="btn" onClick={onCancel}>{t('close')}</button></div></>;

  const list = rows ? rows.map(r => r.n) : [];
  const set = (x: Partial<Draft>): void => setD({ ...d, ...x });
  const warns = countryWarnings({ active: d.active, ceo: d.ceo.length }, d.id ? active(d.name) : 0);
  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const bad = validateCountry({ id: d.id, name: d.name }, list);
    if (bad.length) { setErr(t(bad[0])); return; }
    setBusy(true); setErr('');
    try {
      // свежие строки: другой PMO мог изменить эту страну или добавить такую же
      const fresh = await load();
      const fn = fresh.filter(r => d.id ? r.n.id === d.id : false)[0];
      const name = d.name.trim();
      if (d.id && (countryStale(opened.n, fn ? fn.n.modified : '') || countryStale(opened.c, fn && fn.c ? fn.c.modified : ''))) { edit(fn); setErr(t('errCountryStale')); setBusy(false); return; }
      const again = validateCountry({ id: d.id, name }, fresh.map(r => r.n));
      if (again.length) { setErr(t(again[0])); setBusy(false); return; }
      const order = d.order.trim() === '' ? null : Number(d.order.replace(',', '.'));
      const names = { cnEn: d.en.trim() || name, cnRu: d.ru.trim() || name, cnOrder: order === null || isNaN(order) ? null : order, cnActive: d.active };
      if (d.id) await c.repo.update('CountryNames', d.id, names); else await c.repo.create('CountryNames', { Title: name, ...names });
      const ids: number[] = [];
      for (const p of d.ceo) ids.push(p.id || await c.repo.ensureUser(p));
      const ceoRow = fn && fn.c ? fn.c : fresh.map(r => r.c).filter(x => x && x.name === name)[0];
      if (ceoRow) await c.repo.update('Countries', ceoRow.id, { coCeoId: ids });
      else await c.repo.create('Countries', { Title: name, coCeoId: ids });
      await c.reload();
      await load();
      c.toast(t('savedCountry'));
      setD(null); setBusy(false);
    } catch (x) { setErr(errText(t, x)); setBusy(false); }
  };
  const search = (q: string): Promise<Person[]> => c.repo.searchPeople(q);
  return <>{head}
    <button type="button" className="link" id="co-back" onClick={() => { setD(null); setErr(''); }}>← {t('coBack')}</button>
    <form onSubmit={save} noValidate={true} id="co-form">
      <Frow label={t('coNameUk')} htmlFor="co-name" req={true} hint={d.id ? t('coNameLocked') : undefined}>
        <input id="co-name" value={d.name} disabled={!!d.id} onChange={e => set({ name: e.target.value })} /></Frow>
      <Frow label={t('coNameEn')} htmlFor="co-en"><input id="co-en" value={d.en} placeholder={d.name} onChange={e => set({ en: e.target.value })} /></Frow>
      <Frow label={t('coNameRu')} htmlFor="co-ru"><input id="co-ru" value={d.ru} placeholder={d.name} onChange={e => set({ ru: e.target.value })} /></Frow>
      <Frow label={t('coCeo')} htmlFor="co-ceo"><PeoplePicker id="co-ceo" multi={true} value={d.ceo} search={search} onChange={v => set({ ceo: v })} /></Frow>
      <Frow label={t('coOrder')} htmlFor="co-order"><input id="co-order" inputMode="numeric" value={d.order} onChange={e => set({ order: e.target.value })} /></Frow>
      <div className="frow"><label className="check"><input type="checkbox" id="co-active" checked={d.active} onChange={e => set({ active: e.target.checked })} /> {t('coActive')}</label></div>
      {warns.map(([k, n]) => <p key={k} className="fwarn" id={'co-' + k}>{t(k).replace('{n}', String(n))}</p>)}
      <Err msg={err} />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy}>{t('save')}</button>
        <button type="button" className="btn" onClick={() => { setD(null); setErr(''); }}>{t('cancel')}</button>
      </div>
    </form>
  </>;
};
