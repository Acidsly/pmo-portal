import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData, SpRepo } from '../data/SpRepo';
import { Project, Person } from '../data/types';
import { calcRag } from '../logic/rag';
import { isArch, isPlanLate, forecastDelta, budgetUse, budgetLevel, freshness, riskScore } from '../logic/status';
import { ofProject } from '../logic/views';
import { toEvents } from '../logic/changes';
import { Avatar, RagPill, RagDot, Progress, Score, fmtDate, money, freshColor } from '../components/Bits';
import { Plus } from '../components/Icons';

const fmtDT = (iso: string): string => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); };
const byDateDesc = <T extends { date: string; id: number }>(a: T, b: T): number => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id);

/** Человек с должностью из профиля (person прототипа). */
const Who: React.FC<{ p: Person | null; repo: SpRepo; sub?: string }> = ({ p, repo, sub }) => {
  const [title, setTitle] = React.useState('');
  React.useEffect(() => { if (p && p.email) repo.jobTitle(p.email).then(setTitle, () => undefined); }, [p && p.email]);
  if (!p) return <span className="muted">—</span>;
  const small = sub !== undefined ? sub : title;
  return <span className="person" title={p.email}><Avatar name={p.name} /><span className="pn"><b>{p.name}</b>{small ? <small>{small}</small> : null}</span></span>;
};

const Kv: React.FC<{ k: string; children?: React.ReactNode }> = ({ k, children }) =>
  <div className="kv"><span className="k">{k}</span><span className="v">{children || <span className="muted">—</span>}</span></div>;

/** Карточка проекта — разделы и порядок projectPanel прототипа (строки 1289–1340), только чтение. */
export const ProjectCard: React.FC<{ project: Project; data: PortalData; repo: SpRepo; onClose(): void }> = ({ project: p, data, repo, onClose }) => {
  const { t, fl, today, webUrl } = React.useContext(AppCtx);
  const [showCh, setShowCh] = React.useState(false);
  const [showCm, setShowCm] = React.useState(false);
  const [pmTitle, setPmTitle] = React.useState('');
  React.useEffect(() => { if (p.manager) repo.jobTitle(p.manager.email).then(setPmTitle, () => undefined); }, [p.id]);
  const reps = ofProject(data.reports, p.id).slice().sort(byDateDesc);
  const last8 = reps.slice(0, 8).reverse();
  const risks = ofProject(data.risks, p.id).slice().sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact));
  const cms = ofProject(data.comments, p.id).slice().sort((a, b) => (a.created < b.created ? 1 : -1));
  const events = toEvents(ofProject(data.changes, p.id));
  const edit = p.canEdit && !isArch(p.status);
  const dev = forecastDelta(p.planEnd, p.forecastEnd);
  const use = budgetUse(p.budget, p.actualCost);
  const kindL: Record<string, string> = { create: 'kCreate', key: 'kKey', edit: 'kEdit', report: 'kReport' };
  const dims: [string, (r: typeof reps[0]) => React.ReactNode][] = [
    [fl('rag'), r => <RagDot v={calcRag(r.schedule, r.budget, r.resources)} notRated={t('notRated')} />],
    [fl('rSched'), r => <RagDot v={r.schedule} notRated={t('notRated')} />],
    [fl('rBudget'), r => <RagDot v={r.budget} notRated={t('notRated')} />],
    [fl('rRes'), r => <RagDot v={r.resources} notRated={t('notRated')} />],
    [fl('progress'), r => <span className="muted">{r.progress === null ? '—' : r.progress}</span>]];

  return <>
    <div className="ph"><div><div className="k">{p.code} · {t('listLabel')} «{t('navProjects')}»</div><h2>{p.title}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onClose}>×</button></div>
    <div className="badges">
      {p.type === 'Стратегічний' ? <span className="strat">{p.type}</span> : <span className="badge">{p.type}</span>}
      <RagPill v={p.rag} notRated={t('notRated')} /><span className="badge">{p.status}</span><span className="badge">{p.priority}</span>
      {p.loop ? <a className="loop" href={p.loop} target="_blank" rel="noopener noreferrer">{t('openLoop')} ↗</a> : null}
    </div>
    {/* формы — этап 3; до тех пор стандартные формы списков */}
    {edit ? <div className="actbar">
      <a className="btn primary" href={`${webUrl}/Lists/StatusReports/NewForm.aspx`}><Plus />{t('addReport')}</a>
      <a className="btn" href={`${webUrl}/Lists/Projects/EditForm.aspx?ID=${p.id}`}>{t('editProject')}</a></div>
      : <p className="note lock">🔒 {isArch(p.status) ? t('archivedNote') : t('noEdit')}</p>}
    {p.pending ? <p className="note">{t('pendingNote')}</p> : null}
    {p.description ? <p className="desc">{p.description}</p> : null}

    <div className="sec"><h3>{t('secPeople')}</h3>
      {p.manager ? <div className="pmcard"><Avatar name={p.manager.name} /><span className="pn"><b>{p.manager.name}</b>
        <small>{[pmTitle, p.manager.email].filter(Boolean).join(' · ')}</small></span><span className="role">{t('pmRole')}</span></div> : null}
      <div className="people2">
        <div><div className="k">{fl('owner')}</div><Who p={p.owner} repo={repo} /></div>
        <div><div className="k">{fl('stakeholders')}</div><div className="plist-v">{p.stakeholders.length ? p.stakeholders.map(s => <Who key={s.id} p={s} repo={repo} />) : <span className="muted">—</span>}</div></div>
      </div></div>

    <div className="sec"><h3>{t('secDates')}</h3><div className="group">
      <Kv k={fl('start')}>{fmtDate(p.start)}</Kv>
      <Kv k={fl('golive')}>{fmtDate(p.goLive)}</Kv>
      <Kv k={fl('plan')}>{p.planEnd ? (isPlanLate(p.planEnd, p.status, today) ? <span className="late">{fmtDate(p.planEnd)}</span> : fmtDate(p.planEnd)) : null}</Kv>
      <Kv k={fl('fc')}>{p.forecastEnd ? <>{fmtDate(p.forecastEnd)}{dev !== null && dev > 0 ? <> <span className="late">+{dev} {t('days')}</span></> : dev !== null && dev < 0 ? <> <span className="muted">{dev} {t('days')}</span></> : null}</> : null}</Kv>
      {p.archivedAt ? <Kv k={t('archivedAt')}>{fmtDate(p.archivedAt)}</Kv> : null}
    </div></div>

    <div className="sec"><h3>{t('secMoney')}</h3><div className="group">
      <Kv k={fl('progress')}><Progress v={p.progress} /></Kv>
      <Kv k={fl('last')}><span className="rag"><span className="dot sm" style={{ background: freshColor(freshness(p.lastUpdate, today)) }} />{p.lastUpdate ? fmtDate(p.lastUpdate) : <span className="muted">{t('noReports')}</span>}</span></Kv>
      <Kv k={fl('budget')}>{money(p.budget)}</Kv>
      <Kv k={fl('actual')}>{money(p.actualCost)} · <span className={budgetLevel(use)}>{use}%</span></Kv>
      <Kv k={fl('dept')}>{p.department}</Kv>
    </div></div>

    <div className="sec"><h3>{t('secChanges')}</h3>
      {events.length ? <div className="cmts">{(showCh ? events : events.slice(0, 3)).map(c =>
        <div key={c.id} className="chg">
          <div className="chg-h">{c.who ? <><Avatar name={c.who.name} /><b>{c.who.name}</b></> : null}<span className="muted">{fmtDT(c.date)}</span>
            <span className={'chg-k chg-' + c.kind}>{t(kindL[c.kind] || 'kEdit')}</span></div>
          {c.diffs.length ? <div className="diffs">{c.diffs.map((d, i) => <div key={i} className="diff"><span className="df">{fl(d.f)}</span>
            <span className="dv"><s>{d.from || '—'}</s><span className="arr">→</span>{d.to || '—'}</span></div>)}</div> : null}
          {c.reason ? <div className="chg-r">{c.reason}</div> : null}
        </div>)}
        {events.length > 3 ? <button className="more" onClick={() => setShowCh(!showCh)}>{showCh ? t('hideHistory') : `${t('showHistory')} (${events.length})`}</button> : null}
      </div> : <p className="empty">{t('noChanges')}</p>}</div>

    <div className="sec"><h3>{fl('comments')}</h3>
      {cms.length ? <div className="cmts">{(showCm ? cms : cms.slice(0, 1)).map(c =>
        <div key={c.id} className="hist-c"><div className="who">{fmtDT(c.created)} · {c.author ? c.author.name : ''}</div><div>{c.text}</div></div>)}
        {cms.length > 1 ? <button className="more" onClick={() => setShowCm(!showCm)}>{showCm ? t('hideHistory') : `${t('showHistory')} (${cms.length})`}</button> : null}
      </div> : <p className="empty">{t('noComments')}</p>}</div>

    <div className="sec"><h3>{t('secHistory')}</h3>
      {last8.length ? <div className="tablewrap"><table className="matrix"><thead><tr><th />{last8.map(r => <th key={r.id}>{fmtDate(r.date).slice(0, 5)}</th>)}</tr></thead>
        <tbody>{dims.map(([label, cell], i) => <tr key={i}><td>{label}</td>{last8.map(r => <td key={r.id}>{cell(r)}</td>)}</tr>)}</tbody></table></div>
        : <p className="empty">{t('noReportsYet')}</p>}</div>

    <div className="sec"><h3>{t('secReports')} ({reps.length})</h3>
      {reps.length ? reps.map(r => <div key={r.id} className="rep">
        <div className="rep-h"><b>{fmtDate(r.date)}</b><RagPill v={calcRag(r.schedule, r.budget, r.resources)} notRated={t('notRated')} />
          {r.author ? <span className="person"><Avatar name={r.author.name} /><span className="pn"><b>{r.author.name}</b></span></span> : null}
          {r.decision ? <span className="flag">{t('needDecision')}</span> : null}</div>
        <p><b>{r.title}</b></p>
        <p><span className="lbl">{t('done')}:</span> {r.done || '—'}</p>
        <p><span className="lbl">{t('plan')}:</span> {r.next || '—'}</p>
        {r.issues ? <p><span className="lbl">{t('issues')}:</span> {r.issues}</p> : null}
        {r.decisionText ? <p><span className="lbl">{t('needDecision')}:</span> {r.decisionText}</p> : null}
      </div>) : <p className="empty">{t('noReportsYet')}</p>}</div>

    <div className="sec"><div className="sec-h"><h3>{t('secRisks')} ({risks.length})</h3></div>
      {risks.length ? <div className="rlist">{risks.map(k => <div key={k.id} className="rrow"><Score s={riskScore(k.probability, k.impact)} />
        <span className="rt">{k.title}</span><span className="muted">{k.type} · {k.status}</span></div>)}</div> : <p className="empty">{t('emptyRisks')}</p>}</div>
  </>;
};
