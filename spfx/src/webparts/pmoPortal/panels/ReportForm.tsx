import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Project } from '../data/types';
import { isActive, byOrder } from '../logic/status';
import { calcRag, Rag } from '../logic/rag';
import { ReportDraft, reportFromProject, reportFromReturned, keyChanged, reportErrors, formErrorText, parseProgress, progressLocked, FieldErr,
  initialReport, switchStatus, switchProject, reportToSave, reportProjectChoice } from '../logic/forms';
import { reportBody } from '../data/write';
import { Frow, RagPick, SegPick, DateIn, Err, Opts, errText, guardText, FieldErrText, MoneyIn } from '../components/fields';
import { fmtDate } from '../components/Bits';
import { guard } from '../logic/guard';
import { RagDot } from '../components/Bits';

const REPORT_STATUSES = ['Ініціація', 'Планування', 'Реалізація', 'Призупинено'];
const TYPES = ['Стратегічний', 'Звичайний'];
const PERIODS = ['Тиждень', '2 тижні', 'Місяць', 'Квартал'];

/** Новый статус-отчёт (reportForm прототипа, строки 1470–1550): подстановка показателей, живой стан, причина при смене показателей. */
export const ReportForm: React.FC<{ data: PortalData; projectId: number; fromId?: number; onCancel(): void }> = ({ data, projectId, fromId, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const act = data.projects.filter(p => isActive(p.status) && p.canEdit).sort(byOrder);
  // #37: из карточки проекта — проект зафиксирован; из «Статус-звіти» — первый проект без отчёта на погодженні (#51)
  const { fixed, first } = reportProjectChoice(act, projectId);
  // «Новий звіт на основі повернутого» — черновик из повернутого PMO отчёта этого проекта
  const from = fromId ? data.reports.filter(r => r.id === fromId && r.projectId === (first && first.id))[0] : undefined;
  // «Завершено» в повернутом звіті — 100 % сразу (#52)
  const [d, setD] = React.useState<ReportDraft | undefined>(first ? initialReport(from ? reportFromReturned(from, first, c.today) : reportFromProject(first, c.today)) : undefined);
  const [err, setErr] = React.useState('');
  const [errs, setErrs] = React.useState<FieldErr[]>([]);
  // «% виконання» — текст поля (#53: ошибка вне 0–100 вместо молчаливой замены); prevPr — значение до «Завершено» (#52)
  const [prTxt, setPrTxt] = React.useState(d ? String(d.progress) : '0');
  const [prevPr, setPrevPr] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (!first || !d) return <><div className="ph"><div><h2>{t('newReport')}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note lock">🔒 {t('noEdit')}</p></>;
  const p: Project = act.filter(x => x.id === d.projectId)[0] || first;
  const set = (x: Partial<ReportDraft>): void => { setD({ ...d, ...x }); if (errs.length) setErrs([]); };
  const bad = (f: string): boolean => errs.some(e => e.f === f);
  const fErr = (f: string): string => { const e = errs.filter(x => x.f === f && x.k !== 'errReq')[0]; return e ? t(e.k) : ''; };
  // #52: «Завершено» — 100 % и поле закрыто; другой статус — прежнее значение
  const setStatus = (st: string): void => {
    const r = switchStatus(d, prevPr, st);
    setD(r.d); setPrevPr(r.prev); setErrs([]);
    if (r.d.progress !== d.progress || progressLocked(st)) setPrTxt(String(r.d.progress));
  };
  // #51: по проекту уже есть отчёт на погодженні — новый подать нельзя (сохранение заблокировано)
  const pendingBlock = p.pendingDate ? guardText(t, 'gPending', { date: fmtDate(p.pendingDate) }) : '';
  const rag = calcRag(d.schedule, d.budget, d.resources);
  const keyCh = keyChanged(d, p);

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (pendingBlock) { setErr(pendingBlock); return; }
    // #40: все ошибки сразу — общее сообщение и подсветка полей
    const es = reportErrors(d, p, prTxt);
    if (es.length) { setErrs(es); setErr(t(formErrorText(es))); return; }
    setBusy(true); setErr(''); setErrs([]);
    try {
      // свежая проверка: PM на месте, проект не в архиве, по проекту нет другого отчёта на погодженні, дата не раньше погодженого
      const f = await c.repo.fresh(p.id);
      const g = guard('report', c.me, f, { reportDate: d.date });
      if (!g.ok) { setErr(guardText(t, g.key, g.args)); setBusy(false); await c.reload(); return; }
      await c.repo.createIn('StatusReports', p.id, reportBody(reportToSave(d), f.project));
      await c.reload();
      c.toast(t('savedReportPending'));
      c.openProject(p.id);
    } catch (x) { setErr(errText(t, x)); setBusy(false); }
  };

  return <>
    <div className="ph"><div><div className="k">{t('listLabel')} «{t('navReports')}»</div><h2>{t('newReport')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <form onSubmit={save} noValidate={true}>
      {fixed ? <Frow label={fl('rProj')}><div className="fixedval">{fixed.title}</div></Frow>
        : <Frow label={fl('rProj')} htmlFor="f-p" req={true}>
          <select id="f-p" value={d.projectId} onChange={e => { const np = act.filter(x => x.id === Number(e.target.value))[0]; if (np) { const nd = switchProject(d, np); setD(nd); setPrTxt(String(nd.progress)); setPrevPr(null); setErrs([]); setErr(''); } }}>
            {act.map(x => <option key={x.id} value={x.id} disabled={!!x.pendingDate && x.id !== d.projectId}>{x.title}{x.pendingDate ? ' — ' + t('repPendingOpt').replace('{date}', fmtDate(x.pendingDate)) : ''}</option>)}</select></Frow>}
      {pendingBlock ? <p className="note lock">🔒 {pendingBlock}</p> : null}
      <div className="fgrid frow">
        <div><label className="t" htmlFor="f-d">{fl('rDate')} *</label><DateIn id="f-d" value={d.date} invalid={bad('date')} onChange={v => set({ date: v })} /></div>
        <div><label className="t" htmlFor="f-per">{fl('rPeriod')}</label>
          <select id="f-per" value={d.period} onChange={e => set({ period: e.target.value })}><Opts values={PERIODS} /></select></div>
        <div />
      </div>
      <div className="dims">
        <RagPick name="sched" label={fl('rSched')} req={true} invalid={bad('sched')} value={d.schedule} onChange={v => set({ schedule: v })} />
        <RagPick name="budget" label={fl('rBudget')} req={true} invalid={bad('budget')} value={d.budget} onChange={v => set({ budget: v })} />
        <RagPick name="res" label={fl('rRes')} req={true} invalid={bad('res')} value={d.resources} onChange={v => set({ resources: v })} />
      </div>
      <div className="ragcalc"><span className="k">{t('ragCalc')}</span>
        <span><span className="ilabel"><RagDot v={rag as Rag} notRated={t('notRated')} />{rag || t('notRated')}</span></span>
        <span className="note">{t('ragRule')}</span></div>

      <div className="keysec">
        <h3 className="fsec">{t('keySec')}</h3><p className="note" style={{ margin: '-6px 0 14px' }}>{t('keySecHint')}</p>
        {/* #39: статус, % и затраты — одним рядом (на телефоне затраты — следующей строкой) */}
        <div className="fgrid-k frow">
          <div><label className="t" htmlFor="f-st">{fl('status')}</label>
            <select id="f-st" value={d.status} onChange={e => setStatus(e.target.value)}>
              <Opts values={REPORT_STATUSES} /><option value="Завершено">{t('completeArch')}</option><option value="Скасовано">{t('cancelArch')}</option></select></div>
          <div><label className="t" htmlFor="f-pr">{fl('progress')}</label>
            {/* #28, #53: только цифры, 0–100; вне диапазона — ошибка у поля; ведущие нули убираются при выходе из поля; #52: «Завершено» — 100 и закрыто */}
            <input type="text" inputMode="numeric" id="f-pr" value={prTxt} disabled={progressLocked(d.status)} aria-invalid={bad('progress') || undefined}
              onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setPrTxt(v); const n = parseProgress(v); set({ progress: n === null ? d.progress : n }); }}
              onBlur={() => { const n = parseProgress(prTxt); if (n !== null) setPrTxt(String(n)); }} />
            <FieldErrText msg={fErr('progress')} />{progressLocked(d.status) ? <p className="hint">{t('progressDone')}</p> : null}</div>
          <div className="k-cost"><label className="t" htmlFor="f-c">{fl('rCost')}, $</label>
            <MoneyIn id="f-c" value={d.actualCost} onChange={v => set({ actualCost: v })} /></div>
        </div>
        {d.status === 'Завершено' || d.status === 'Скасовано' ? <p className="note" style={{ margin: '-4px 0 14px' }}>{t('completeHint')}</p> : null}
        <fieldset className="ragpick"><legend>{fl('type')}</legend><SegPick name="f-type" options={TYPES} value={d.type} onChange={v => set({ type: v })} /></fieldset>
        <div className="fgrid2 frow">
          <div><label className="t" htmlFor="f-start">{fl('start')}</label><DateIn id="f-start" value={d.start} onChange={v => set({ start: v })} /></div>
          <div><label className="t" htmlFor="f-golive">{fl('golive')}</label><DateIn id="f-golive" value={d.goLive} invalid={bad('goLive')} onChange={v => set({ goLive: v })} /><FieldErrText msg={fErr('goLive')} /></div>
          <div><label className="t" htmlFor="f-plan">{fl('plan')}</label><DateIn id="f-plan" value={d.planEnd} invalid={bad('planEnd')} onChange={v => set({ planEnd: v })} /><FieldErrText msg={fErr('planEnd')} /></div>
          <div><label className="t" htmlFor="f-fc">{fl('fc')}</label><DateIn id="f-fc" value={d.forecastEnd} invalid={bad('forecastEnd')} onChange={v => set({ forecastEnd: v })} /><FieldErrText msg={fErr('forecastEnd')} /></div>
        </div>
        {keyCh ? <Frow label={t('keyReason')} htmlFor="f-kr" req={true}>
          <textarea id="f-kr" placeholder={t('reasonPh')} aria-invalid={bad('keyReason') || undefined} value={d.keyReason} onChange={e => set({ keyReason: e.target.value })} /></Frow> : null}
      </div>

      <Frow label={fl('rTitle')} htmlFor="f-t" req={true}><input type="text" id="f-t" placeholder={t('summaryPh')} aria-invalid={bad('title') || undefined} value={d.title} onChange={e => set({ title: e.target.value })} /></Frow>
      <Frow label={fl('rDone')} htmlFor="f-done"><textarea id="f-done" value={d.done} onChange={e => set({ done: e.target.value })} /></Frow>
      <Frow label={fl('rNext')} htmlFor="f-next"><textarea id="f-next" value={d.next} onChange={e => set({ next: e.target.value })} /></Frow>
      <Frow label={fl('rIssues')} htmlFor="f-iss"><textarea id="f-iss" value={d.issues} onChange={e => set({ issues: e.target.value })} /></Frow>
      <div className="frow"><label className="check"><input type="checkbox" checked={d.decision} onChange={e => set({ decision: e.target.checked })} /> {fl('rDec')}</label></div>
      {d.decision ? <Frow label={fl('rDecText')} htmlFor="f-dect"><textarea id="f-dect" value={d.decisionText} onChange={e => set({ decisionText: e.target.value })} /></Frow> : null}
      <Err msg={err} />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy || !!pendingBlock}>{t('save')}</button>
        <button type="button" className="btn" onClick={onCancel}>{t('cancel')}</button>
      </div>
    </form>
  </>;
};
