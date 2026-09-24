import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Project } from '../data/types';
import { isActive, byOrder } from '../logic/status';
import { calcRag, Rag } from '../logic/rag';
import { ReportDraft, reportFromProject, keyChanged, validateReport } from '../logic/forms';
import { reportBody } from '../data/write';
import { Frow, RagPick, SegPick, DateIn, Err } from '../components/fields';
import { RagDot } from '../components/Bits';

const REPORT_STATUSES = ['Ініціація', 'Планування', 'Реалізація', 'Призупинено', 'Скасовано'];
const TYPES = ['Стратегічний', 'Звичайний'];
const PERIODS = ['Тиждень', '2 тижні', 'Місяць', 'Квартал'];

/** Новый статус-отчёт (reportForm прототипа, строки 1470–1550): подстановка показателей, живой стан, причина при смене показателей. */
export const ReportForm: React.FC<{ data: PortalData; projectId: number; onCancel(): void }> = ({ data, projectId, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const act = data.projects.filter(p => isActive(p.status) && p.canEdit).sort(byOrder);
  const first = act.filter(p => p.id === projectId)[0] || act[0];
  const [d, setD] = React.useState<ReportDraft | undefined>(first ? reportFromProject(first, c.today) : undefined);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  if (!first || !d) return <><div className="ph"><div><h2>{t('newReport')}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note lock">🔒 {t('noEdit')}</p></>;
  const p: Project = act.filter(x => x.id === d.projectId)[0] || first;
  const set = (x: Partial<ReportDraft>): void => setD({ ...d, ...x });
  const rag = calcRag(d.schedule, d.budget, d.resources);
  const keyCh = keyChanged(d, p);

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const v = validateReport(d, p);
    if (v) { setErr(t(v)); return; }
    setBusy(true); setErr('');
    try {
      await c.repo.create('StatusReports', reportBody(d, p));
      await c.reload();
      c.toast(t(d.status === 'Завершено' ? 'savedArch' : 'savedReport'));
      c.openProject(p.id);
    } catch (x) { setErr(String((x as Error).message || x)); setBusy(false); }
  };

  return <>
    <div className="ph"><div><div className="k">{t('listLabel')} «{t('navReports')}»</div><h2>{t('newReport')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <form onSubmit={save} noValidate={true}>
      <Frow label={fl('rProj')} htmlFor="f-p" req={true}>
        <select id="f-p" value={d.projectId} onChange={e => { const np = act.filter(x => x.id === Number(e.target.value))[0]; if (np) setD({ ...reportFromProject(np, d.date), schedule: d.schedule, budget: d.budget, resources: d.resources, title: d.title, done: d.done, next: d.next, issues: d.issues, decision: d.decision, decisionText: d.decisionText }); }}>
          {act.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Frow>
      <div className="fgrid frow">
        <div><label className="t" htmlFor="f-d">{fl('rDate')} *</label><DateIn id="f-d" value={d.date} onChange={v => set({ date: v })} /></div>
        <div><label className="t" htmlFor="f-per">{fl('rPeriod')}</label>
          <select id="f-per" value={d.period} onChange={e => set({ period: e.target.value })}>{PERIODS.map(x => <option key={x}>{x}</option>)}</select></div>
        <div />
      </div>
      <div className="dims">
        <RagPick name="sched" label={fl('rSched')} req={true} value={d.schedule} onChange={v => set({ schedule: v })} />
        <RagPick name="budget" label={fl('rBudget')} req={true} value={d.budget} onChange={v => set({ budget: v })} />
        <RagPick name="res" label={fl('rRes')} req={true} value={d.resources} onChange={v => set({ resources: v })} />
      </div>
      <div className="ragcalc"><span className="k">{t('ragCalc')}</span>
        <span><span className="ilabel"><RagDot v={rag as Rag} notRated={t('notRated')} />{rag || t('notRated')}</span></span>
        <span className="note">{t('ragRule')}</span></div>

      <div className="keysec">
        <h3 className="fsec">{t('keySec')}</h3><p className="note" style={{ margin: '-6px 0 14px' }}>{t('keySecHint')}</p>
        <div className="fgrid2 frow">
          <div><label className="t" htmlFor="f-st">{fl('status')}</label>
            <select id="f-st" value={d.status} onChange={e => set({ status: e.target.value })}>
              {REPORT_STATUSES.map(x => <option key={x} value={x}>{x}</option>)}<option value="Завершено">{t('completeArch')}</option></select></div>
          <div><label className="t" htmlFor="f-pr">{fl('progress')}</label>
            <input type="number" id="f-pr" min={0} max={100} value={d.progress} onChange={e => set({ progress: Number(e.target.value) || 0 })} /></div>
        </div>
        {d.status === 'Завершено' ? <p className="note" style={{ margin: '-4px 0 14px' }}>{t('completeHint')}</p> : null}
        <fieldset className="ragpick"><legend>{fl('type')}</legend><SegPick name="f-type" options={TYPES} value={d.type} onChange={v => set({ type: v })} /></fieldset>
        <div className="fgrid2 frow">
          <div><label className="t" htmlFor="f-start">{fl('start')}</label><DateIn id="f-start" value={d.start} onChange={v => set({ start: v })} /></div>
          <div><label className="t" htmlFor="f-golive">{fl('golive')}</label><DateIn id="f-golive" value={d.goLive} onChange={v => set({ goLive: v })} /></div>
          <div><label className="t" htmlFor="f-plan">{fl('plan')}</label><DateIn id="f-plan" value={d.planEnd} onChange={v => set({ planEnd: v })} /></div>
          <div><label className="t" htmlFor="f-fc">{fl('fc')}</label><DateIn id="f-fc" value={d.forecastEnd} onChange={v => set({ forecastEnd: v })} /></div>
        </div>
        <Frow label={`${fl('rCost')}, ₴`} htmlFor="f-c">
          <input type="number" id="f-c" min={0} step={1000} value={d.actualCost} onChange={e => set({ actualCost: Number(e.target.value) || 0 })} /></Frow>
        {keyCh ? <Frow label={t('keyReason')} htmlFor="f-kr" req={true}>
          <textarea id="f-kr" placeholder={t('reasonPh')} value={d.keyReason} onChange={e => set({ keyReason: e.target.value })} /></Frow> : null}
      </div>

      <Frow label={fl('rTitle')} htmlFor="f-t" req={true}><input type="text" id="f-t" placeholder={t('summaryPh')} value={d.title} onChange={e => set({ title: e.target.value })} /></Frow>
      <Frow label={fl('rDone')} htmlFor="f-done"><textarea id="f-done" value={d.done} onChange={e => set({ done: e.target.value })} /></Frow>
      <Frow label={fl('rNext')} htmlFor="f-next"><textarea id="f-next" value={d.next} onChange={e => set({ next: e.target.value })} /></Frow>
      <Frow label={fl('rIssues')} htmlFor="f-iss"><textarea id="f-iss" value={d.issues} onChange={e => set({ issues: e.target.value })} /></Frow>
      <div className="frow"><label className="check"><input type="checkbox" checked={d.decision} onChange={e => set({ decision: e.target.checked })} /> {fl('rDec')}</label></div>
      {d.decision ? <Frow label={fl('rDecText')} htmlFor="f-dect"><textarea id="f-dect" value={d.decisionText} onChange={e => set({ decisionText: e.target.value })} /></Frow> : null}
      <Err msg={err} />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy}>{t('save')}</button>
        <button type="button" className="btn" onClick={onCancel}>{t('cancel')}</button>
      </div>
    </form>
  </>;
};
