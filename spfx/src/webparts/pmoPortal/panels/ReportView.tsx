import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { StatusReport, Project } from '../data/types';
import { tv } from '../i18n/values';
import { calcRag, Rag } from '../logic/rag';
import { isArch } from '../logic/status';
import { AP_OK, AP_PENDING, AP_RETURNED, approvalResult } from '../logic/approval';
import { RagPick, Err, Frow, errText, guardText } from '../components/fields';
import { guard } from '../logic/guard';
import { RagPill, RagDot, ApBadge, fmtDate, fmtDT, money, PersonCell } from '../components/Bits';
import { Plus } from '../components/Icons';

type Ind = 'status' | 'type' | 'progress' | 'start' | 'goLive' | 'planEnd' | 'forecastEnd' | 'actualCost';
const IND: [Ind, string][] = [['status', 'status'], ['type', 'type'], ['progress', 'progress'], ['start', 'start'], ['goLive', 'golive'],
  ['planEnd', 'plan'], ['forecastEnd', 'fc'], ['actualCost', 'rCost']];
const DATES: Ind[] = ['start', 'goLive', 'planEnd', 'forecastEnd'];

/** Статус-отчёт (reportView прототипа): содержание, погодження; PMO — погодити (меняет только оценки) или повернути на доопрацювання. */
export const ReportView: React.FC<{ data: PortalData; report: StatusReport | undefined; onCancel(): void }> = ({ data, report: r, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const [s, setS] = React.useState<Rag>(r ? r.schedule : '');
  const [b, setB] = React.useState<Rag>(r ? r.budget : '');
  const [res, setRes] = React.useState<Rag>(r ? r.resources : '');
  const [note, setNote] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const p: Project | undefined = r ? data.projects.filter(x => x.id === r.projectId)[0] : undefined;
  const head = <div className="ph"><div><div className="k">{p ? p.code + ' · ' : ''}{t('listLabel')} «{t('navReports')}»</div><h2>{r ? r.title : t('navReports')}</h2></div>
    <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>;
  if (!r || !p) return <>{head}<p className="empty">{t('noReportsYet')}</p></>;

  const state = r.approval || AP_PENDING;
  const pend = state === AP_PENDING;
  const canDecide = data.canApprove && pend && !isArch(p.status);
  const changed = s !== r.schedule || b !== r.budget || res !== r.resources;
  const decide = async (decision: string): Promise<void> => {
    const ap = decision === AP_OK ? { s: s !== r.schedule ? s : '', b: b !== r.budget ? b : '', r: res !== r.resources ? res : '' } : { s: '', b: '', r: '' };
    const out = approvalResult({ s: r.schedule, b: r.budget, r: r.resources, approval: state }, { decision, ...ap, note });
    if (!out.valid) { setErr(t('errApNote')); return; }
    setBusy(true); setErr('');
    try {
      // свежая проверка: отчёт ещё на погодженні и без решения (другой PMO, другая вкладка), проект не в архиве, автор — PM
      const f = await c.repo.fresh(r.projectId, r.id);
      const g = guard(decision === AP_OK ? 'approve' : 'return', c.me, f);
      if (!g.ok) { setErr(guardText(t, g.key, g.args)); setBusy(false); await c.reload(); return; }
      await c.repo.createIn('ReportApprovals', r.projectId, { apReportId: r.id, apProjectId: r.projectId, apDecision: decision,
        apSchedule: ap.s || null, apBudget: ap.b || null, apResources: ap.r || null, apNote: note.trim() });
      await c.reload(); c.toast(t('savedApproval')); c.openForm('rep:' + r.id, p.id);
    } catch (x) { setErr(errText(t, x)); setBusy(false); }
  };

  // ключевые показатели, которые отчёт меняет; до погодження — «було → стало» относительно карточки
  const show = (k: Ind, v: string | number | null): React.ReactNode => (v === '' || v === null || v === undefined ? <span className="muted">—</span>
    : k === 'progress' ? v + '%' : k === 'actualCost' ? money(Number(v)) : DATES.indexOf(k) >= 0 ? fmtDate(String(v)) : tv(v === 'Завершено' ? 'Архівний' : String(v)));
  const ind = IND.filter(([k]) => { const v = r[k]; return v !== '' && v !== null; }).map(([k, l]) => {
    const cur = p[k] as string | number; const nv = k === 'status' && (r.status === 'Завершено' || r.status === 'Скасовано') ? 'Архівний' : r[k];
    const ch = state !== AP_OK && String(cur === undefined || cur === null ? '' : cur) !== String(nv === null ? '' : nv);
    return <div key={k} className="kv"><span className="k">{fl(l)}</span><span className="v">{ch ? <span className="dv"><s>{show(k, cur)}</s><span className="arr">→</span>{show(k, r[k])}</span> : show(k, r[k])}</span></div>;
  });
  const txt = (l: string, v: string): React.ReactNode => (v && v !== '—' ? <p><span className="lbl">{l}:</span> {v}</p> : null);
  const dims: [string, Rag][] = [['rSched', r.schedule], ['rBudget', r.budget], ['rRes', r.resources]];

  return <>
    {head}
    <div className="rv-meta"><button className="link" onClick={() => c.openProject(p.id)}>{p.title}</button>
      <span>{fl('rDate')}: <b>{fmtDate(r.date)}</b></span>{r.period ? <span>{fl('rPeriod')}: <b>{tv(r.period)}</b></span> : null}<ApBadge v={state} /></div>

    {canDecide ? <div className="sec"><h3>{t('apTitle')}</h3><div className="apbox"><form noValidate={true} onSubmit={e => { e.preventDefault(); decide(AP_OK).catch(() => undefined); }}>
      <p className="note" style={{ margin: '0 0 12px' }}>{t('apHint')}</p>
      <div className="dims">
        <RagPick name="ap-s" label={fl('rSched')} req={true} value={s} onChange={setS} />
        <RagPick name="ap-b" label={fl('rBudget')} req={true} value={b} onChange={setB} />
        <RagPick name="ap-r" label={fl('rRes')} req={true} value={res} onChange={setRes} />
      </div>
      <div className="ragcalc"><span className="k">{t('ragCalc')}</span>
        <span className="ilabel"><RagDot v={calcRag(s, b, res) as Rag} notRated={t('notRated')} />{tv(calcRag(s, b, res)) || t('notRated')}</span></div>
      <Frow label={fl('apNote')} htmlFor="ap-n"><textarea id="ap-n" value={note} onChange={e => setNote(e.target.value)} /></Frow>
      <Err msg={err} />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy}>{t(changed ? 'approveChanged' : 'approve')}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => { decide(AP_RETURNED).catch(() => undefined); }}>{t('returnRep')}</button>
      </div></form></div></div> : null}

    <div className="sec"><div className="group">
      <div className="kv"><span className="k">{fl('rag')}</span><span className="v"><RagPill v={calcRag(r.schedule, r.budget, r.resources)} notRated={t('notRated')} /></span></div>
      {dims.map(([l, v]) => <div key={l} className="kv"><span className="k">{fl(l)}</span><span className="v"><RagPill v={v} notRated={t('notRated')} /></span></div>)}
    </div></div>
    {ind.length ? <div className="sec"><h3>{t('repIndicators')}</h3><div className="group">{ind}
      {r.keyReason ? <div className="kv"><span className="k">{t('keyReason')}</span><span className="v">{r.keyReason}</span></div> : null}</div></div> : null}
    <div className="sec"><div className="rep rv-text">
      <div className="rep-h"><PersonCell p={r.author} />{r.decision ? <span className="flag">{t('needDecision')}</span> : null}</div>
      {txt(fl('rDone'), r.done)}{txt(fl('rNext'), r.next)}{txt(fl('rIssues'), r.issues)}{r.decision ? txt(fl('rDecText'), r.decisionText || '—') : null}
    </div></div>

    {!pend && r.approvedBy ? <div className="sec"><h3>{t('apDecided')}</h3><div className="apdone">
      <div className="rep-h"><ApBadge v={state} /><span className="muted">{t('apBy')}:</span><PersonCell p={r.approvedBy} /><span className="muted">{fmtDT(r.approvedAt)}</span></div>
      {r.approvalNote ? <p><span className="muted">{fl('apNote')}:</span> {r.approvalNote}</p> : null}
      {state === AP_RETURNED && p.canEdit && !isArch(p.status) ? <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={() => c.openForm('report-from:' + r.id, p.id)}><Plus />{t('newFromReturned')}</button></div> : null}
    </div></div> : null}
    {pend && !canDecide ? <div className="apnote">{t('pendingApproval').replace('{date}', fmtDate(r.date))}</div> : null}
  </>;
};
