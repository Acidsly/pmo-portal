import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Project } from '../data/types';
import { DefsCtx } from '../components/defs';
import { Plus } from '../components/Icons';

/** Заголовок страницы (hero прототипа): название, подзаголовок, кнопка «Новий проєкт». */
export const Hero: React.FC<{ title: string; sub?: string; withNew?: boolean }> = p => {
  const { t, openForm, canCreate } = React.useContext(AppCtx);
  return <div className="hero"><div><h1 className="page-title">{p.title}</h1>{p.sub ? <p className="page-sub">{p.sub}</p> : null}</div>
    {p.withNew && canCreate ? <button className="btn primary" onClick={() => openForm('project')}><Plus />{t('newProject')}</button> : null}</div>;
};

/** Выбор представления (viewSel прототипа). */
export function ViewSel<V extends string>(p: { views: Record<V, string>; value: V; onChange(v: V): void }): JSX.Element {
  const { t } = React.useContext(AppCtx);
  return <label className="viewsel" title={t('viewsNote')}>{t('view')}
    <select value={p.value} onChange={e => p.onChange(e.target.value as V)}>{(Object.keys(p.views) as V[]).map(k => <option key={k} value={k}>{p.views[k]}</option>)}</select></label>;
}

export function useDefsCtx(data: PortalData): DefsCtx {
  const c = React.useContext(AppCtx);
  const byId: Record<number, Project> = {};
  data.projects.forEach(p => { byId[p.id] = p; });
  return { t: c.t, fl: c.fl, today: c.today, byId, comments: data.comments, open: c.openProject, openRisk: (id, pid) => c.openForm('risk:' + id, pid) };
}
