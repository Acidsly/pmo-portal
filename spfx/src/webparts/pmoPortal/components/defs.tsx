import * as React from 'react';
import { ColDef } from '../logic/table';
import { Project, StatusReport, Risk, Comment } from '../data/types';
import { Rag } from '../logic/rag';
import { freshness, isPlanLate, forecastDelta, budgetUse, budgetLevel, riskScore } from '../logic/status';
import { daysBetween } from '../logic/dates';
import { freshBucket, scoreBucket } from '../logic/views';
import { RagDot, PersonCell, People, Score, Progress, Muted, fmtDate, money, freshColor } from './Bits';
import { Strat, Prio, Compass, Flag } from './Icons';

/** Колонка = данные для движка таблицы + отрисовка (PDEF / RDEF / KDEF прототипа, строки 997–1072). */
export interface Col<R> extends ColDef<R> { head?: JSX.Element; cell: (r: R) => React.ReactNode; cls?: string; flabel?: (v: string) => React.ReactNode; }
export interface TableDefs<R> { lock: string; defaults: string[]; cols: Record<string, Col<R>>; }
export interface DefsCtx { t(k: string): string; fl(k: string): string; today: string; byId: Record<number, Project>; comments: Comment[]; open(id: number): void; openRisk(id: number, projectId: number): void; }

const RAG_ORDER: Record<string, number> = { 'Червоний': 0, 'Жовтий': 1, 'Зелений': 2 };
const STATUSES = ['Ініціація', 'Планування', 'Реалізація', 'Призупинено', 'Скасовано', 'Архівний'];
const ragOrder = (v: string): number => (RAG_ORDER[v] === undefined ? 3 : RAG_ORDER[v]);
const clamp = (s: string): React.ReactNode => (s ? <span className="clamp2" title={s}>{s}</span> : <Muted />);
const dateCell = (iso: string): React.ReactNode => (iso ? fmtDate(iso) : <Muted />);

function shared(x: DefsCtx): {
  stratHead: JSX.Element; prioHead: JSX.Element; stratCell(type: string): JSX.Element; prioCell(v: string): JSX.Element;
  stratLabel(v: string): React.ReactNode; prioLabel(v: string): React.ReactNode; ragLabel(v: string): React.ReactNode; link(p: Project): JSX.Element;
} {
  const { t, fl } = x;
  return {
    stratHead: <span className="ico" title={t('cStrat')}><Compass /></span>,
    prioHead: <span className="ico" title={t('cPrio')}><Flag /></span>,
    stratCell: type => <span className="ico">{type === 'Стратегічний' ? <span title={t('cStrat')}><Strat on={true} /></span> : null}</span>,
    prioCell: v => <span className="ico" title={`${fl('prio')}: ${v}`} aria-label={v}><Prio v={v} /></span>,
    stratLabel: v => (v === 'Стратегічний' ? <span className="ilabel"><Strat on={true} />{v}</span> : v),
    prioLabel: v => <span className="ilabel"><Prio v={v} />{v}</span>,
    ragLabel: v => <span className="ilabel"><RagDot v={v as Rag} notRated={t('notRated')} />{v || t('notRated')}</span>,
    link: p => <button className="link" onClick={() => x.open(p.id)}>{p.title}</button>
  };
}

export function projectDefs(x: DefsCtx, archive: boolean): TableDefs<Project> {
  const { t, fl, today } = x; const S = shared(x);
  const lastCm = (p: Project): Comment | undefined => x.comments.filter(c => c.projectId === p.id).sort((a, b) => (a.created < b.created ? 1 : -1))[0];
  const cmCount = (p: Project): number => x.comments.filter(c => c.projectId === p.id).length;
  const age = (p: Project): number | null => (p.lastUpdate ? daysBetween(p.lastUpdate, today) : null);
  const cols: Record<string, Col<Project>> = {
    strat: { label: t('cStrat'), head: S.stratHead, cell: p => S.stratCell(p.type), sort: p => (p.type === 'Стратегічний' ? 0 : 1), filter: p => p.type, flabel: S.stratLabel, cls: 'w-ico' },
    title: { label: fl('title'), cell: S.link, sort: p => p.title, cls: 'w-title' },
    code: { label: t('cCode'), cell: p => p.code, sort: p => p.code },
    type: { label: fl('type'), cell: p => p.type, sort: p => p.type, filter: p => p.type },
    pm: { label: fl('pm'), cell: p => <PersonCell p={p.manager} />, sort: p => (p.manager ? p.manager.name : ''), filter: p => (p.manager ? p.manager.name : '') },
    owner: { label: t('cOwner'), cell: p => <PersonCell p={p.owner} />, sort: p => (p.owner ? p.owner.name : ''), filter: p => (p.owner ? p.owner.name : '') },
    product: { label: fl('stakeholders'), cell: p => <People list={p.stakeholders} />, sort: p => (p.stakeholders[0] ? p.stakeholders[0].name : ''), filter: p => p.stakeholders.map(s => s.name) },
    status: { label: t('cStatusOnly'), cell: p => p.status, sort: p => STATUSES.indexOf(p.status), filter: p => p.status, cls: 'w-min' },
    prio: { label: t('cPrio'), head: S.prioHead, cell: p => S.prioCell(p.priority), sort: p => p.priority, filter: p => p.priority, flabel: S.prioLabel, cls: 'w-ico' },
    rag: { label: t('cHealth'), cell: p => <RagDot v={p.rag} notRated={t('notRated')} />, sort: p => ragOrder(p.rag), filter: p => p.rag, flabel: S.ragLabel, cls: 'w-ico w-min' },
    repDate: { label: t('cRepDate'), cell: p => <span className="rag"><span className="dot sm" style={{ background: freshColor(freshness(p.lastUpdate, today)) }} />{p.lastUpdate ? fmtDate(p.lastUpdate) : t('noReports')}</span>,
      sort: p => p.lastUpdate, filter: p => freshBucket(p.lastUpdate, today),
      flabel: v => <span className="ilabel"><span className="dot sm" style={{ background: ['var(--g)', 'var(--y)', 'var(--r)', 'var(--na)'][Number(v)] }} />{t('fr' + v)}</span> },
    repAge: { label: t('cRepAge'), cell: p => { const a = age(p); return a === null ? <Muted /> : String(a); }, sort: p => age(p), cls: 'num' },
    progress: { label: fl('progress'), cell: p => <Progress v={p.progress} />, sort: p => p.progress },
    start: { label: t('cStart2'), cell: p => dateCell(p.start), sort: p => p.start },
    golive: { label: t('cGolive'), cell: p => dateCell(p.goLive), sort: p => p.goLive },
    plan: { label: t('cPlan'), cell: p => (p.planEnd ? (isPlanLate(p.planEnd, p.status, today) ? <span className="late">{fmtDate(p.planEnd)}</span> : fmtDate(p.planEnd)) : <Muted />), sort: p => p.planEnd },
    fc: { label: t('cFc'), cell: p => dateCell(p.forecastEnd), sort: p => p.forecastEnd },
    dev: { label: t('cDev'), cell: p => { const d = forecastDelta(p.planEnd, p.forecastEnd); return d === null ? <Muted /> : d > 0 ? <span className="late">+{d}</span> : String(d); },
      sort: p => forecastDelta(p.planEnd, p.forecastEnd), cls: 'num' },
    budget: { label: t('cBudgetP'), cell: p => money(p.budget), sort: p => p.budget, cls: 'num' },
    actual: { label: t('cActual'), cell: p => money(p.actualCost), sort: p => p.actualCost, cls: 'num' },
    use: { label: t('cUse'), cell: p => { const u = budgetUse(p.budget, p.actualCost); return <span className={budgetLevel(u)}>{u}%</span>; },
      sort: p => (p.budget ? p.actualCost / p.budget : 0), cls: 'num' },
    update: { label: fl('lastReport'), cell: p => clamp(p.lastReport), sort: p => p.lastReport, cls: 'w-upd' },
    comment: { label: fl('comments'), cell: p => { const c = lastCm(p); return c ? <><span className="clamp2">{c.text}</span> <button className="cnt" onClick={() => x.open(p.id)}>{cmCount(p)}</button></> : <Muted />; },
      sort: p => { const c = lastCm(p); return c ? c.created : ''; }, cls: 'w-wide' },
    cmtBy: { label: t('cCmtBy'), cell: p => { const c = lastCm(p); return c ? <PersonCell p={c.author} /> : <Muted />; },
      sort: p => { const c = lastCm(p); return c && c.author ? c.author.name : ''; }, filter: p => { const c = lastCm(p); return c && c.author ? c.author.name : ''; } },
    dept: { label: fl('dept'), cell: p => p.department, sort: p => p.department, filter: p => p.department },
    loop: { label: 'Loop', cell: p => (p.loop ? <a className="loop" href={p.loop} target="_blank" rel="noopener noreferrer">Loop ↗</a> : null) },
    archived: { label: t('archivedAt'), cell: p => dateCell(p.archivedAt), sort: p => p.archivedAt }
  };
  return { lock: 'title', cols,
    defaults: archive ? ['strat', 'prio', 'title', 'pm', 'owner', 'archived', 'plan', 'budget', 'actual'] : ['strat', 'prio', 'title', 'pm', 'status', 'rag', 'repDate', 'progress', 'plan', 'update'] };
}

export function reportDefs(x: DefsCtx): TableDefs<StatusReport> {
  const { t, fl } = x; const S = shared(x);
  const P = (r: StatusReport): Project => x.byId[r.projectId];
  const dim = (k: 'schedule' | 'budget' | 'resources', l: string): Col<StatusReport> =>
    ({ label: fl(l), cell: r => <RagDot v={r[k]} notRated={t('notRated')} />, sort: r => ragOrder(r[k]), filter: r => r[k], flabel: S.ragLabel, cls: 'w-ico' });
  const cols: Record<string, Col<StatusReport>> = {
    strat: { label: t('cStrat'), head: S.stratHead, cell: r => S.stratCell(P(r).type), sort: r => (P(r).type === 'Стратегічний' ? 0 : 1), filter: r => P(r).type, flabel: S.stratLabel, cls: 'w-ico' },
    proj: { label: fl('rProj'), cell: r => S.link(P(r)), sort: r => P(r).title, filter: r => P(r).title, cls: 'w-title' },
    code: { label: t('cCode'), cell: r => P(r).code, sort: r => P(r).code },
    date: { label: fl('rDate'), cell: r => fmtDate(r.date), sort: r => r.date },
    period: { label: t('cPeriod'), cell: r => r.period || '—', sort: r => r.period, filter: r => r.period },
    prio: { label: t('cPrio'), head: S.prioHead, cell: r => S.prioCell(P(r).priority), sort: r => P(r).priority, filter: r => P(r).priority, flabel: S.prioLabel, cls: 'w-ico' },
    rag: { label: t('cHealth'), cell: r => <RagDot v={calc(r)} notRated={t('notRated')} />, sort: r => ragOrder(calc(r)), filter: r => calc(r), flabel: S.ragLabel, cls: 'w-ico w-min' },
    sched: dim('schedule', 'rSched'), budget: dim('budget', 'rBudget'), res: dim('resources', 'rRes'),
    title: { label: fl('rTitle'), cell: r => clamp(r.title), sort: r => r.title, cls: 'w-upd' },
    done: { label: t('cDone'), cell: r => clamp(r.done), sort: r => r.done, cls: 'w-wide' },
    next: { label: t('cNextP'), cell: r => clamp(r.next), sort: r => r.next, cls: 'w-wide' },
    issues: { label: t('cIssues'), cell: r => clamp(r.issues), sort: r => r.issues, cls: 'w-wide' },
    progress: { label: fl('progress'), cell: r => (r.progress === null ? <Muted /> : <Progress v={r.progress} />), sort: r => r.progress },
    status: { label: t('cStatusR'), cell: r => (r.status ? (r.status === 'Завершено' ? 'Архівний' : r.status) : <Muted />), sort: r => r.status, filter: r => r.status },
    author: { label: fl('rAuthor'), cell: r => <PersonCell p={r.author} />, sort: r => (r.author ? r.author.name : ''), filter: r => (r.author ? r.author.name : '') },
    // флажок «Потрібне рішення керівництва»; при наведении — какое решение нужно
    decision: { label: t('needDecision'), cell: r => (r.decision ? <span className="flag" title={r.decisionText}>{t('yes')}</span> : <Muted />), sort: r => (r.decision ? 0 : 1), filter: r => (r.decision ? 'yes' : 'no'),
      flabel: v => (v === 'yes' ? t('yes') : t('no')) },
    decText: { label: t('cDecText'), cell: r => clamp(r.decisionText), sort: r => r.decisionText, cls: 'w-wide' }
  };
  return { lock: 'proj', cols, defaults: ['strat', 'prio', 'proj', 'date', 'rag', 'sched', 'budget', 'res', 'title', 'author', 'decision'] };
}
// общий стан отчёта — худшая из трёх оценок (как calcRag)
function calc(r: StatusReport): Rag {
  const v = [r.schedule, r.budget, r.resources];
  if (v.some(z => !z)) return '';
  return v.indexOf('Червоний') >= 0 ? 'Червоний' : v.indexOf('Жовтий') >= 0 ? 'Жовтий' : 'Зелений';
}

export function riskDefs(x: DefsCtx): TableDefs<Risk> {
  const { t, fl, today } = x; const S = shared(x);
  const P = (k: Risk): Project => x.byId[k.projectId];
  const sc = (k: Risk): number => riskScore(k.probability, k.impact);
  const cols: Record<string, Col<Risk>> = {
    proj: { label: fl('rProj'), cell: k => S.link(P(k)), sort: k => P(k).title, filter: k => P(k).title, cls: 'w-title' },
    prio: { label: t('cPrio'), head: S.prioHead, cell: k => S.prioCell(P(k).priority), sort: k => P(k).priority, filter: k => P(k).priority, flabel: S.prioLabel, cls: 'w-ico' },
    strat: { label: t('cStrat'), head: S.stratHead, cell: k => S.stratCell(P(k).type), sort: k => (P(k).type === 'Стратегічний' ? 0 : 1), filter: k => P(k).type, flabel: S.stratLabel, cls: 'w-ico' },
    code: { label: t('cCode'), cell: k => P(k).code, sort: k => P(k).code },
    title: { label: fl('kTitle'), cell: k => <button className="link clamp2" onClick={() => x.openRisk(k.id, 0)}>{k.title}</button>, sort: k => k.title, cls: 'w-wide' },
    type: { label: fl('kType'), cell: k => k.type, sort: k => k.type, filter: k => k.type },
    score: { label: fl('kScore'), cell: k => <Score s={sc(k)} />, sort: k => -sc(k), filter: k => scoreBucket(sc(k)), flabel: v => t('sc' + v) },
    prob: { label: t('cProb'), cell: k => String(k.probability), sort: k => k.probability, filter: k => String(k.probability), cls: 'num' },
    imp: { label: t('cImp'), cell: k => String(k.impact), sort: k => k.impact, filter: k => String(k.impact), cls: 'num' },
    owner: { label: fl('kOwner'), cell: k => <PersonCell p={k.owner} />, sort: k => (k.owner ? k.owner.name : ''), filter: k => (k.owner ? k.owner.name : '') },
    status: { label: fl('kStatus'), cell: k => k.status, sort: k => k.status, filter: k => k.status },
    due: { label: fl('kDue'), cell: k => (k.due && k.due < today && k.status !== 'Закрито' ? <span className="late">{fmtDate(k.due)}</span> : fmtDate(k.due)), sort: k => k.due }
  };
  return { lock: 'proj', cols, defaults: ['strat', 'prio', 'proj', 'title', 'type', 'score', 'owner', 'status', 'due'] };
}

