import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Project, StatusReport, Risk } from '../data/types';
import { isArch, isActive, freshness, riskScore, byOrder } from '../logic/status';
import { donutCounts, snapshots } from '../logic/dynamics';
import { Wp } from '../components/Wp';
import { SimpleTable, Col } from '../components/SimpleTable';
import { Donut } from '../components/Donut';
import { Dynamics } from '../components/Dynamics';
import { RagDot, FreshDate, PersonCell, Score, fmtDate } from '../components/Bits';
import { Strat, Prio, Compass, Flag, Plus } from '../components/Icons';

const byDateDesc = (a: StatusReport, b: StatusReport): number => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

/** Главная — порядок блоков и колонки pageHome прототипа (строки 1167–1190). */
export const Home: React.FC<{ data: PortalData }> = ({ data }) => {
  const { t, fl, today, go, openProject, openForm } = React.useContext(AppCtx);
  const byId: Record<number, Project> = {};
  data.projects.forEach(p => { byId[p.id] = p; });
  const P = (id: number): Project => byId[id];
  const shown = (id: number): boolean => !!byId[id] && !isArch(byId[id].status);

  const vis = data.projects.filter(p => !isArch(p.status)).sort(byOrder);
  const prob = vis.filter(p => isActive(p.status) && (p.rag === 'Червоний' || p.rag === 'Жовтий'))
    .sort((a, b) => (a.rag === 'Червоний' ? 0 : 1) - (b.rag === 'Червоний' ? 0 : 1));
  const stale = vis.filter(p => isActive(p.status) && ['r', 'na'].indexOf(freshness(p.lastUpdate, today)) >= 0);   // старше 14 дней или отчётов нет
  const dec = data.reports.filter(r => r.decision && shown(r.projectId)).sort(byDateDesc);
  const open = data.risks.filter(k => k.status !== 'Закрито' && shown(k.projectId))
    .sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact)).slice(0, 6);

  const link = (p: Project): JSX.Element => <button className="link" onClick={() => openProject(p.id)}>{p.title}</button>;
  const stratHead = <span className="ico" title={t('cStrat')}><Compass /></span>;
  const prioHead = <span className="ico" title={t('cPrio')}><Flag /></span>;
  const stratCell = (p: Project): JSX.Element => <span className="ico">{p.type === 'Стратегічний' ? <span title={t('cStrat')}><Strat on={true} /></span> : null}</span>;
  const prioCell = (p: Project): JSX.Element => <span className="ico" title={`${fl('prio')}: ${p.priority}`}><Prio v={p.priority} /></span>;
  const S: Col<Project> = { head: stratHead, cell: stratCell, cls: 'c-ico' };
  const PR: Col<Project> = { head: prioHead, cell: prioCell, cls: 'c-ico' };
  function byProject<R extends { projectId: number }>(): Col<R>[] {
    return [{ head: stratHead, cell: r => stratCell(P(r.projectId)), cls: 'c-ico' }, { head: prioHead, cell: r => prioCell(P(r.projectId)), cls: 'c-ico' }];
  }

  const probCols: Col<Project>[] = [S, PR, { head: fl('title'), cell: link },
    { head: t('cHealth'), cell: p => <RagDot v={p.rag} notRated={t('notRated')} />, cls: 'c-ico' },
    { head: fl('pm'), cell: p => <PersonCell p={p.manager} /> },
    { head: fl('lastReport'), cell: p => <span title={p.lastReport}>{p.lastReport}</span>, cls: 'wide' },
    { head: t('cRepDate'), cell: p => fmtDate(p.lastUpdate) }];
  const staleCols: Col<Project>[] = [S, PR, { head: fl('title'), cell: link }, { head: fl('pm'), cell: p => <PersonCell p={p.manager} /> },
    { head: fl('last'), cell: p => <FreshDate iso={p.lastUpdate} fresh={freshness(p.lastUpdate, today)} none={t('noReports')} /> },
    { head: t('cStatusOnly'), cell: p => p.status }];
  const decCols: Col<StatusReport>[] = [...byProject<StatusReport>(), { head: fl('rProj'), cell: r => link(P(r.projectId)) },
    { head: fl('rDate'), cell: r => fmtDate(r.date) }, { head: fl('rDecText'), cell: r => r.decisionText, cls: 'wide' },
    { head: fl('rAuthor'), cell: r => <PersonCell p={r.author} /> }];
  const riskCols: Col<Risk>[] = [...byProject<Risk>(), { head: fl('rProj'), cell: k => link(P(k.projectId)) },
    { head: fl('kTitle'), cell: k => k.title, cls: 'wide' }, { head: fl('kType'), cell: k => k.type },
    { head: fl('kScore'), cell: k => <Score s={riskScore(k.probability, k.impact)} /> },
    { head: fl('kOwner'), cell: k => <PersonCell p={k.owner} /> },
    { head: fl('kDue'), cell: k => k.due && k.due < today && k.status !== 'Закрито' ? <span className="late">{fmtDate(k.due)}</span> : fmtDate(k.due) }];

  return <>
    <div className="hero">
      <div><h1 className="page-title">{t('dash')}</h1><p className="page-sub">{t('visible') + vis.length}</p></div>
      {data.canCreate ? <button className="btn primary" onClick={() => openForm('project')}><Plus />{t('newProject')}</button> : null}
    </div>
    <div className="grid2">
      <Wp title={t('wpHealth')}><Donut c={donutCounts(vis)} label={t('wpHealth')} active={t('active')} notRated={t('notRated')} /></Wp>
      <Wp title={t('wpDyn')}><Dynamics pts={snapshots(data.projects, data.reports, today)} label={t('wpDyn')} today={t('today')} hint={t('dynHint')} /></Wp>
    </div>
    <div className="dash">
      <Wp title={t('wpProblem')} more={() => go('projects', 'problem')} moreLabel={t('showAll')}><SimpleTable cols={probCols} rows={prob} empty={t('emptyProblem')} /></Wp>
      <Wp title={t('wpStale')} more={() => go('projects', 'stale')} moreLabel={t('showAll')}><SimpleTable cols={staleCols} rows={stale} empty={t('emptyStale')} /></Wp>
      <Wp title={t('wpDecision')} more={() => go('reports', 'decision')} moreLabel={t('showAll')}><SimpleTable cols={decCols} rows={dec} empty={t('emptyDecision')} /></Wp>
      <Wp title={t('wpRisks')} more={() => go('risks', 'open')} moreLabel={t('showAll')}><SimpleTable cols={riskCols} rows={open} empty={t('emptyRisks')} /></Wp>
    </div>
  </>;
};
