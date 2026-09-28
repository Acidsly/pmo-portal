import * as React from 'react';
import { tv } from '../i18n/values';
import { AppCtx } from './ctx';
import { Project } from '../data/types';
import { freshness } from '../logic/status';
import { RagPill, Avatar, fmtDate, freshColor } from './Bits';
import { Strat } from './Icons';

/** Плитка проекта (tile прототипа, строки 901–913). */
const Tile: React.FC<{ p: Project }> = ({ p }) => {
  const { t, today, openProject } = React.useContext(AppCtx);
  const open = (): void => openProject(p.id);
  return <div className="tile" role="button" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>
    <div className="tile-top"><span className="code">{p.code}</span>
      {p.type === 'Стратегічний' ? <span className="ico" title={tv(p.type)} aria-label={tv(p.type)}><Strat on={true} /></span> : null}
      <RagPill v={p.rag} notRated={t('notRated')} /></div>
    <div className="tile-t">{p.title}</div>
    <div className="tile-prog"><div className="pl"><span>{tv(p.status)}</span><b>{p.progress}%</b></div>
      <div className="track"><i style={{ width: `${Math.min(p.progress, 100)}%`, background: p.progress >= 100 ? 'var(--g)' : 'var(--theme)' }} /></div></div>
    <div className="tile-upd">{p.archivedAt ? <div className="ul">{t('archivedAt')}: {fmtDate(p.archivedAt)}</div>
      : <div className="ul"><span className="dot sm" style={{ background: freshColor(freshness(p.lastUpdate, today)) }} />
      {t('latestUpd')} · {p.lastUpdate ? fmtDate(p.lastUpdate) : t('noReports')}</div>}
      <div className="tx">{p.lastReport || <span className="muted">—</span>}</div></div>
    <div className="tile-f">{p.links.length ? <span><a className="loop" href={p.links[0].u} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{p.links[0].t} ↗</a>{p.links.length > 1 ? <span className="muted"> +{p.links.length - 1}</span> : null}</span> : <span />}
      {p.manager ? <span className="tile-pm" title={`${t('pmRole')}: ${p.manager.name} · ${p.manager.email}`}><Avatar name={p.manager.name} /><b>{p.manager.name}</b></span> : null}</div>
  </div>;
};

export const Tiles: React.FC<{ rows: Project[] }> = ({ rows }) => {
  const { t } = React.useContext(AppCtx);
  return rows.length ? <div className="tiles">{rows.map(p => <Tile key={p.id} p={p} />)}</div> : <p className="empty">{t('empty')}</p>;
};
