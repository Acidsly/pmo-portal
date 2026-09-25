import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Person } from '../data/types';
import { isActive, isArch, byOrder, riskScore } from '../logic/status';
import { scoreBucket } from '../logic/views';
import { RiskDraft, validateRisk } from '../logic/forms';
import { riskBody } from '../data/write';
import { Frow, SegPick, DateIn, Err, PeoplePicker } from '../components/fields';
import { Score } from '../components/Bits';

const TYPES = ['Ризик', 'Проблема'];
const STATUSES = ['Відкрито', 'В роботі', 'Закрито'];

/** Шкала 1–5 с описанием выбранного балла (scale прототипа). */
const Scale: React.FC<{ name: string; value: number; onChange(v: number): void; desc: string; disabled: boolean }> = p =>
  <><div className="opts scale">{[1, 2, 3, 4, 5].map(n => <React.Fragment key={n}>
    <input type="radio" id={p.name + n} name={p.name} value={n} checked={p.value === n} disabled={p.disabled} onChange={() => p.onChange(n)} />
    <label htmlFor={p.name + n}>{n}</label></React.Fragment>)}</div><p className="scale-d">{p.desc}</p></>;

/** Риск: новый (со вкладки или из карточки), правка или просмотр без прав (riskForm прототипа, строки 1419–1469). */
export const RiskForm: React.FC<{ data: PortalData; projectId: number; riskId: number; onCancel(): void }> = ({ data, projectId, riskId, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const pool = data.projects.filter(p => isActive(p.status) && p.canEdit).sort(byOrder);
  const k = riskId ? data.risks.filter(x => x.id === riskId)[0] : undefined;
  const fixedId = k ? k.projectId : projectId;
  const [pid, setPid] = React.useState(fixedId || (pool[0] ? pool[0].id : 0));
  const p = data.projects.filter(x => x.id === pid)[0];
  const edit = !!p && p.canEdit && !isArch(p.status);
  const [d, setD] = React.useState<RiskDraft>(() => k
    ? { projectId: k.projectId, title: k.title, type: k.type || 'Ризик', probability: k.probability || 3, impact: k.impact || 3, owner: k.owner, status: k.status || 'Відкрито', due: k.due, mitigation: k.mitigation }
    : { projectId: pid, title: '', type: 'Ризик', probability: 3, impact: 3, owner: p ? p.manager : null, status: 'Відкрито', due: '', mitigation: '' });
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const set = (x: Partial<RiskDraft>): void => setD({ ...d, ...x });
  const sc = riskScore(d.probability, d.impact);

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault(); if (!edit) return;
    const v = validateRisk(d);
    if (v) { setErr(t(v)); return; }
    setBusy(true); setErr('');
    try {
      const owner: Person | null = d.owner && !d.owner.id ? { ...d.owner, id: await c.repo.ensureUser(d.owner.email) } : d.owner;
      const body = riskBody({ ...d, projectId: pid, owner });
      if (k) await c.repo.update('RisksIssues', k.id, body); else await c.repo.create('RisksIssues', body);
      await c.reload(); c.toast(t('savedRisk'));
      if (fixedId) c.openProject(pid); else onCancel();
    } catch (x) { setErr(String((x as Error).message || x)); setBusy(false); }
  };

  if (!p) return <><div className="ph"><div><h2>{t('newRisk')}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note lock">🔒 {t('noEdit')}</p></>;
  return <>
    <div className="ph"><div><div className="k">{t('listLabel')} «{t('navRisks')}»</div><h2>{k ? t('riskCard') : t('newRisk')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    {edit ? null : <p className="note lock">🔒 {t('readOnly')}</p>}
    <form onSubmit={save} noValidate={true}>
      <Frow label={fl('rProj')} htmlFor="k-p" req={true}>
        {fixedId ? <div className="fixed">{p.title}</div>
          : <select id="k-p" value={pid} onChange={e => { const np = Number(e.target.value); setPid(np); const pr = data.projects.filter(x => x.id === np)[0]; set({ projectId: np, owner: pr ? pr.manager : null }); }}>
            {pool.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select>}</Frow>
      <Frow label={fl('kTitle')} htmlFor="k-title" req={true}><textarea id="k-title" disabled={!edit} value={d.title} onChange={e => set({ title: e.target.value })} /></Frow>
      <fieldset className="ragpick"><legend>{fl('kType')}</legend><SegPick name="k-type" options={TYPES} value={d.type} disabled={!edit} onChange={v => set({ type: v })} /></fieldset>
      <div className="scorecalc">
        <div className="frow"><span className="lbl-t">{t('cProb')}</span><Scale name="k-pr" value={d.probability} desc={t('p' + d.probability)} disabled={!edit} onChange={v => set({ probability: v })} /></div>
        <div className="frow"><span className="lbl-t">{t('cImp')}</span><Scale name="k-im" value={d.impact} desc={t('i' + d.impact)} disabled={!edit} onChange={v => set({ impact: v })} /></div>
        <div className="scorebox"><span className="k">{fl('kScore')}</span><span><Score s={sc} /> <b>{t('sc' + scoreBucket(sc))}</b> <span className="muted">= {d.probability} × {d.impact}</span></span></div>
        <p className="note" style={{ margin: '8px 0 0' }}>{t('riskHow')}</p>
      </div>
      <div className="fgrid2 frow">
        <div><label className="t" htmlFor="k-owner">{fl('kOwner')}</label>
          <PeoplePicker id="k-owner" multi={false} disabled={!edit} value={d.owner ? [d.owner] : []} search={q => c.repo.searchPeople(q)} onChange={v => set({ owner: v[0] || null })} /></div>
        <div><label className="t" htmlFor="k-status">{fl('kStatus')}</label>
          <select id="k-status" disabled={!edit} value={d.status} onChange={e => set({ status: e.target.value })}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select></div>
        <div><label className="t" htmlFor="k-due">{fl('kDue')}</label><DateIn id="k-due" disabled={!edit} value={d.due} onChange={v => set({ due: v })} /></div>
      </div>
      <Frow label={t('kMit')} htmlFor="k-mit"><textarea id="k-mit" disabled={!edit} value={d.mitigation} onChange={e => set({ mitigation: e.target.value })} /></Frow>
      <Err msg={err} />
      <div className="actions">
        {edit ? <button type="submit" className="btn primary" disabled={busy}>{t('save')}</button> : null}
        <button type="button" className="btn" onClick={onCancel}>{edit ? t('cancel') : t('close')}</button>
      </div>
    </form>
  </>;
};
