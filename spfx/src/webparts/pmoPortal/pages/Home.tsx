import * as React from 'react';
import { tv } from '../i18n/values';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Project, StatusReport, Risk } from '../data/types';
import { isArch, isActive, freshness, riskScore, byOrder, staleFirst } from '../logic/status';
import { donutCounts, snapshots } from '../logic/dynamics';
import { kpis, riskMatrix, slips, launches, byDept, Slip } from '../logic/analytics';
import { KpiStrip, RiskMap, DeptBars } from '../components/Analytics';
import { Page } from '../components/ctx';
import { Wp } from '../components/Wp';
import { SimpleTable, Col } from '../components/SimpleTable';
import { Donut } from '../components/Donut';
import { Dynamics } from '../components/Dynamics';
import { RagDot, FreshDate, PersonCell, Score, StatusPill, fmtDate } from '../components/Bits';
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
  const stale = vis.filter(p => isActive(p.status) && ['r', 'na'].indexOf(freshness(p.lastUpdate, today)) >= 0)   // старше 14 дней или отчётов нет
    .sort(staleFirst);   // сначала без отчётов, дальше — от самого давнего
  // аналитика (задача 7): по видимым проектам без архива
  const k = kpis(vis, data.reports, data.risks, today);
  const sl = slips(vis, data.changes);
  const ln = launches(vis, today);
  const dec = data.reports.filter(r => r.decision && shown(r.projectId)).sort(byDateDesc);
  const openAll = data.risks.filter(k => k.status !== 'Закрито' && shown(k.projectId))
    .sort((a, b) => riskScore(b.probability, b.impact) - riskScore(a.probability, a.impact));
  const open = openAll.slice(0, 6);   // на главной — шесть самых высоких; сколько всего — подписью под таблицей

  const link = (p: Project): JSX.Element => <button className="link" onClick={() => openProject(p.id)}>{p.title}</button>;
  const stratHead = <span className="ico" title={t('cStrat')}><Compass /></span>;
  const prioHead = <span className="ico" title={t('cPrio')}><Flag /></span>;
  const stratCell = (p: Project): JSX.Element => <span className="ico">{p.type === 'Стратегічний' ? <span title={t('cStrat')}><Strat on={true} /></span> : null}</span>;
  const prioCell = (p: Project): JSX.Element => <span className="ico" title={`${fl('prio')}: ${tv(p.priority)}`}><Prio v={p.priority} /></span>;
  const S: Col<Project> = { head: stratHead, cell: stratCell, cls: 'c-ico' };
  const PR: Col<Project> = { head: prioHead, cell: prioCell, cls: 'c-ico' };
  function byProject<R extends { projectId: number }>(): Col<R>[] {
    return [{ head: stratHead, cell: r => stratCell(P(r.projectId)), cls: 'c-ico' }, { head: prioHead, cell: r => prioCell(P(r.projectId)), cls: 'c-ico' }];
  }

  // отчёт на погодженні — как в колонке «Звіт» списка проектов (#29): без погодженых — «на погодженні · дата», иначе — пометка ниже
  const pendNew = (p: Project): React.ReactNode => p.pendingDate ? <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t('repPendingNew')}</div> : null;
  const pendOnly = (p: Project): React.ReactNode => <span className="rag"><span className="dot sm" style={{ background: 'var(--y)' }} />{t('repPending').replace('{date}', fmtDate(p.pendingDate || ''))}</span>;
  const probCols: Col<Project>[] = [S, PR, { head: fl('title'), cell: link },
    { head: t('cHealth'), cell: p => <RagDot v={p.rag} notRated={t('notRated')} />, cls: 'c-ico' },
    { head: fl('pm'), cell: p => <PersonCell p={p.manager} /> },
    { head: fl('lastReport'), cell: p => <span title={p.lastReport}>{p.lastReport}</span>, cls: 'wide' },
    { head: t('cRepDate'), cell: p => !p.lastUpdate && p.pendingDate ? pendOnly(p) : <>{fmtDate(p.lastUpdate)}{pendNew(p)}</> }];
  const staleCols: Col<Project>[] = [S, PR, { head: fl('title'), cell: link }, { head: fl('pm'), cell: p => <PersonCell p={p.manager} /> },
    { head: fl('last'), cell: p => !p.lastUpdate && p.pendingDate ? pendOnly(p) : <><FreshDate iso={p.lastUpdate} fresh={freshness(p.lastUpdate, today)} none={t('noReports')} />{pendNew(p)}</> },
    { head: t('cStatusOnly'), cell: p => <StatusPill v={p.status} /> }];
  const decCols: Col<StatusReport>[] = [...byProject<StatusReport>(), { head: fl('rProj'), cell: r => link(P(r.projectId)) },
    { head: fl('rDate'), cell: r => fmtDate(r.date) }, { head: fl('rDecText'), cell: r => r.decisionText, cls: 'wide' },
    { head: fl('rAuthor'), cell: r => <PersonCell p={r.author} /> }];
  const slipCols: Col<Slip>[] = [{ head: fl('rProj'), cell: x => link(x.p) }, { head: fl('plan'), cell: x => fmtDate(x.p.planEnd), cls: 'fit' },
    { head: fl('fc'), cell: x => fmtDate(x.p.forecastEnd), cls: 'fit' }, { head: t('cSlip'), cell: x => <span className="late">+{x.days} {t('days')}</span>, cls: 'num fit' },
    { head: t('cMoves'), cell: x => String(x.moves), cls: 'num fit' }];
  const lnCols: Col<Project>[] = [{ head: fl('golive'), cell: p => fmtDate(p.goLive), cls: 'fit' }, { head: fl('rProj'), cell: link },
    { head: t('cHealth'), cell: p => <RagDot v={p.rag} notRated={t('notRated')} />, cls: 'c-ico' }, { head: fl('pm'), cell: p => <PersonCell p={p.manager} /> }];
  const riskCols: Col<Risk>[] = [...byProject<Risk>(), { head: fl('rProj'), cell: k => link(P(k.projectId)) },
    { head: fl('kTitle'), cell: k => k.title, cls: 'wide' }, { head: fl('kType'), cell: k => tv(k.type) },
    { head: fl('kScore'), cell: k => <Score s={riskScore(k.probability, k.impact)} /> },
    { head: fl('kOwner'), cell: k => <PersonCell p={k.owner} /> },
    { head: fl('kDue'), cell: k => k.due && k.due < today && k.status !== 'Закрито' ? <span className="late">{fmtDate(k.due)}</span> : fmtDate(k.due) }];

  return <>
    <div className="hero">
      <div><h1 className="page-title">{t('dash')}</h1><p className="page-sub">{t('visible') + vis.length}</p></div>
      {data.canCreate ? <button className="btn primary" onClick={() => openForm('project')}><Plus />{t('newProject')}</button> : null}
    </div>
    <KpiStrip k={k} pmo={data.canApprove} t={t} go={(pg, v) => go(pg as Page, v)} />
    <div className="grid2">
      <Wp title={t('wpHealth')}><Donut c={donutCounts(vis)} label={t('wpHealth')} active={t('active')} notRated={t('notRated')} /></Wp>
      <Wp title={t('wpDyn')}><Dynamics pts={snapshots(data.projects, data.reports.filter(r => r.approval === 'Погоджено'), today)} label={t('wpDyn')} today={t('today')} hint={t('dynHint')} notRated={t('notRated')} /></Wp>
    </div>
    <div className="grid2">
      <Wp title={t('wpRiskMap')} more={() => go('risks', 'open')} moreLabel={t('showAll')}><RiskMap m={riskMatrix(vis, data.risks)} byId={byId} t={t} openRisk={(id, pid) => openForm('risk:' + id, pid)} /></Wp>
      <Wp title={t('wpDept')}><DeptBars rows={byDept(vis)} t={t} empty={t('emptyProblem')} /></Wp>
    </div>
    <div className="grid2">
      <Wp title={t('wpSlips')}><SimpleTable cols={slipCols} rows={sl} empty={t('emptySlips')} /></Wp>
      <Wp title={t('wpLaunch')}><SimpleTable cols={lnCols} rows={ln} empty={t('emptyLaunch')} /></Wp>
    </div>
    <div className="dash">
      <Wp title={t('wpProblem')} more={() => go('projects', 'problem')} moreLabel={t('showAll')}><SimpleTable cols={probCols} rows={prob} empty={t('emptyProblem')} /></Wp>
      <Wp title={t('wpStale')} more={() => go('projects', 'stale')} moreLabel={t('showAll')}><SimpleTable cols={staleCols} rows={stale} empty={t('emptyStale')} /></Wp>
      <Wp title={t('wpDecision')} more={() => go('reports', 'decision')} moreLabel={t('showAll')}><SimpleTable cols={decCols} rows={dec} empty={t('emptyDecision')} /></Wp>
      <Wp title={t('wpRisks')} more={() => go('risks', 'open')} moreLabel={t('showAll')}><SimpleTable cols={riskCols} rows={open} empty={t('emptyRisks')} />
        {openAll.length > open.length ? <p className="hint">{t('shown')} {open.length} {t('of')} {openAll.length}</p> : null}</Wp>
    </div>
  </>;
};
