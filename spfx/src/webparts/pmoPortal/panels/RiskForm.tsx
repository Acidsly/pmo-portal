import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Person, Risk } from '../data/types';
import { isActive, isArch, byOrder, riskScore } from '../logic/status';
import { scoreBucket } from '../logic/views';
import { RiskDraft, riskDueMin, riskErrors, riskEditable, riskCopy, riskRequired, RISK_ERR, RiskField } from '../logic/forms';
import { todayIso } from '../logic/dates';
import { fmtDate, Score } from '../components/Bits';
import { riskBody } from '../data/write';
import { Frow, SegPick, DateIn, Err, PeoplePicker, Opts, errText, guardText, FieldErrText } from '../components/fields';
import { guard, changedFields } from '../logic/guard';

const TYPES = ['Ризик', 'Проблема'];
const STATUSES = ['Відкрито', 'В роботі', 'Закрито'];
const STRATEGIES = ['Уникнення', 'Зниження (пом\'якшення)', 'Передача', 'Прийняття'];

/** Шкала 1–5 с описанием выбранного балла (scale прототипа). */
const Scale: React.FC<{ name: string; value: number; onChange(v: number): void; desc: string; disabled: boolean }> = p =>
  <><div className="opts scale">{[1, 2, 3, 4, 5].map(n => <React.Fragment key={n}>
    <input type="radio" id={p.name + n} name={p.name} value={n} checked={p.value === n} disabled={p.disabled} onChange={() => p.onChange(n)} />
    <label htmlFor={p.name + n}>{n}</label></React.Fragment>)}</div><p className="scale-d">{p.desc}</p></>;

/** Риск: новый (со вкладки или из карточки), правка или просмотр без прав (riskForm прототипа, строки 1419–1469). */
export const RiskForm: React.FC<{ data: PortalData; projectId: number; riskId: number; onCancel(): void }> = ({ data, projectId, riskId, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const pool = data.projects.filter(p => isActive(p.status) && p.canEdit).sort(byOrder);
  const found = riskId ? data.risks.filter(x => x.id === riskId)[0] : undefined;
  // #92: «Копіювати ризик» — форма становится новой записью со всеми полями исходной (riskCopy)
  const [copied, setCopied] = React.useState<Risk | null>(null);
  const k = copied ? undefined : found;
  const fixedId = found ? found.projectId : projectId;
  const [pid, setPid] = React.useState(fixedId || (pool[0] ? pool[0].id : 0));
  const p = data.projects.filter(x => x.id === pid)[0];
  const edit = !!p && p.canEdit && !isArch(p.status);
  const [d, setD] = React.useState<RiskDraft>(() => k
    ? { projectId: k.projectId, title: k.title, type: k.type || 'Ризик', probability: k.probability || 3, impact: k.impact || 3, owner: k.owner, status: k.status || 'Відкрито', due: k.due, mitigation: k.mitigation, strategy: k.strategy, contingency: k.contingency }
    : { projectId: pid, title: '', type: 'Ризик', probability: 3, impact: 3, owner: p ? p.manager : null, status: 'Відкрито', due: '', mitigation: '', strategy: '', contingency: '' });
  const [err, setErr] = React.useState('');
  const [miss, setMiss] = React.useState<RiskField[]>([]);
  const [busy, setBusy] = React.useState(false);
  const set = (x: Partial<RiskDraft>): void => { setD({ ...d, ...x }); if (miss.length) setMiss([]); };
  // #92: в сохранённой записи — только «Статус»; #91: обязательные поля новой записи — по типу
  const off = (f: string): boolean => !edit || !riskEditable(f, !k);
  const req = k ? [] : riskRequired(d.type);
  const star = (f: RiskField): string => (req.indexOf(f) >= 0 ? ' *' : '');
  const fe = (f: RiskField): string => (miss.indexOf(f) >= 0 ? t(RISK_ERR[f]) : '');
  const copy = (): void => { if (!found) return; setD(riskCopy(found, todayIso())); setCopied(found); setErr(''); setMiss([]); };
  const sc = riskScore(d.probability, d.impact);
  // #88: срок не раньше сегодняшнего дня (новый) / даты регистрации (существующий); прежний срок — без проверки, просроченный открытый — пометка
  const today = todayIso();
  const dueMin = riskDueMin(d.due, k ? k.due : '', k && k.created ? k.created : '', today);
  const dueErr = dueMin ? t('errRiskDue').replace('{date}', fmtDate(dueMin)) : '';
  const overdue = edit && !dueErr && !!d.due && d.due < today && d.status !== 'Закрито';

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault(); if (!edit) return;
    const m = riskErrors(d, !k);
    if (m.length) { setMiss(m); setErr(m.length > 1 ? t('errRiskReq') : t(RISK_ERR[m[0]])); return; }
    if (dueErr) { setErr(dueErr); const el = document.getElementById('k-due'); if (el) el.focus(); return; }
    setBusy(true); setErr('');
    try {
      const owner: Person | null = d.owner && !d.owner.id ? { ...d.owner, id: await c.repo.ensureUser(d.owner.email) } : d.owner;
      const body = riskBody({ ...d, projectId: pid, owner });
      const f = await c.repo.fresh(pid);
      const g = guard('risk', c.me, f);
      if (!g.ok) { setErr(guardText(t, g.key, g.args)); setBusy(false); await c.reload(); return; }
      if (k) {
        // конфликт правок: риск изменили после загрузки — не перезаписываем
        const fr = await c.repo.freshRisk(k.id);
        const snap = (x: typeof k): Record<string, string> => ({ title: x.title, type: x.type, p: String(x.probability), i: String(x.impact), owner: x.owner ? x.owner.email : '',
          status: x.status, due: x.due, mitigation: x.mitigation, strategy: x.strategy, contingency: x.contingency });
        if (changedFields(snap(k), snap(fr.risk)).length) { setErr(t('errConflict')); setBusy(false); await c.reload(); return; }
        await c.repo.update('RisksIssues', k.id, body, fr.etag);
      } else await c.repo.createIn('RisksIssues', pid, body, { riOwnerId: owner ? owner.email : '' });
      await c.reload(); c.toast(t('savedRisk'));
      if (fixedId) c.openProject(pid); else onCancel();
    } catch (x) { setErr(errText(t, x)); setBusy(false); }
  };

  if (!p) return <><div className="ph"><div><h2>{t('newRisk')}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note lock">🔒 {t('noEdit')}</p></>;
  return <>
    <div className="ph"><div><div className="k"><EntTag kind={d.type === 'Проблема' ? 'issue' : 'risk'} /><span>{t('listLabel')} «{t('navRisks')}»</span></div><h2>{k ? t('riskCard') : d.type === 'Проблема' ? t('newIssueT') : t('newRiskT')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    {edit ? null : <p className="note lock">🔒 {t('readOnly')}</p>}
    {edit && k ? <p className="note" id="k-only">{t('riskOnlyStatus')}</p> : null}
    {copied ? <p className="note" id="k-copy">{t('riskCopyNote').replace('{t}', copied.title)}</p> : null}
    <form onSubmit={save} noValidate={true}>
      <Frow label={fl('rProj')} htmlFor="k-p" req={true}>
        {fixedId ? <div className="fixed">{p.title}</div>
          : <select id="k-p" value={pid} onChange={e => { const np = Number(e.target.value); setPid(np); const pr = data.projects.filter(x => x.id === np)[0]; set({ projectId: np, owner: pr ? pr.manager : null }); }}>
            {pool.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select>}</Frow>
      {/* #47 / #55: сначала тип, потом «Опис»; заголовок новой записи — по типу */}
      <fieldset className="ragpick"><legend>{fl('kType')}</legend><SegPick name="k-type" options={TYPES} value={d.type} disabled={off('type')} onChange={v => set({ type: v })} /></fieldset>
      <Frow label={fl('kDesc')} htmlFor="k-title" req={true}><textarea id="k-title" disabled={off('title')} aria-invalid={!!fe('title') || undefined} value={d.title} onChange={e => set({ title: e.target.value })} />
        <FieldErrText msg={fe('title')} /></Frow>
      <div className="scorecalc">
        <div className="frow"><span className="lbl-t">{t('cProb')}</span><Scale name="k-pr" value={d.probability} desc={t('p' + d.probability)} disabled={off('probability')} onChange={v => set({ probability: v })} /></div>
        <div className="frow"><span className="lbl-t">{t('cImp')}</span><Scale name="k-im" value={d.impact} desc={t('i' + d.impact)} disabled={off('impact')} onChange={v => set({ impact: v })} /></div>
        <div className="scorebox"><span className="k">{fl('kScore')}</span><span><Score s={sc} /> <b>{t('sc' + scoreBucket(sc))}</b> <span className="muted">= {d.probability} × {d.impact}</span></span></div>
        <p className="note" style={{ margin: '8px 0 0' }}>{t('riskHow')}</p>
      </div>
      <div className="fgrid2 frow">
        <div><label className="t" htmlFor="k-owner">{fl('kOwner')}</label>
          <PeoplePicker id="k-owner" multi={false} disabled={off('owner')} value={d.owner ? [d.owner] : []} search={q => c.repo.searchPeople(q)} onChange={v => set({ owner: v[0] || null })} /></div>
        <div><label className="t" htmlFor="k-status">{fl('kStatus')}</label>
          <select id="k-status" disabled={!edit} value={d.status} onChange={e => set({ status: e.target.value })}><Opts values={STATUSES} /></select></div>
        <div><label className="t" htmlFor="k-due">{fl('kDue')}</label><DateIn id="k-due" disabled={off('due')} value={d.due} onChange={v => set({ due: v })} />
          {dueErr ? <p className="ferr">{dueErr}</p> : overdue ? <p className="fwarn">{t('riskOverdue')}</p> : null}</div>
      </div>
      <fieldset className="ragpick"><legend id="k-str-l">{fl('kStrategy') + star('strategy')}</legend>
        <SegPick name="k-str" options={STRATEGIES} value={d.strategy} disabled={off('strategy')} onChange={v => set({ strategy: d.strategy === v ? '' : v })} />
        <FieldErrText msg={fe('strategy')} /></fieldset>
      <Frow label={t('kMit') + star('mitigation')} htmlFor="k-mit"><textarea id="k-mit" disabled={off('mitigation')} aria-invalid={!!fe('mitigation') || undefined} value={d.mitigation} onChange={e => set({ mitigation: e.target.value })} />
        <FieldErrText msg={fe('mitigation')} /></Frow>
      <Frow label={fl('kContingency') + star('contingency')} htmlFor="k-cont"><textarea id="k-cont" disabled={off('contingency')} aria-invalid={!!fe('contingency') || undefined} value={d.contingency} onChange={e => set({ contingency: e.target.value })} />
        <FieldErrText msg={fe('contingency')} /></Frow>
      {/* #87: риски не погоджуються — где PMO их видит и как дать обратную связь */}
      {!k && edit ? <p className="note" id="k-noap">{t('riskNoApproval')}</p> : null}
      <Err msg={err} />
      <div className="actions">
        {edit ? <button type="submit" className="btn primary" disabled={busy}>{t('save')}</button> : null}
        {edit && k ? <button type="button" className="btn" id="k-copy-btn" onClick={copy}>{t(k.type === 'Проблема' ? 'issueCopyBtn' : 'riskCopyBtn')}</button> : null}
        <button type="button" className="btn" onClick={onCancel}>{edit ? t('cancel') : t('close')}</button>
      </div>
    </form>
  </>;
};
