import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { isArch } from '../logic/status';
import { DataTable } from '../components/DataTable';
import { projectDefs } from '../components/defs';
import { Hero, useDefsCtx } from './common';

/** «Архів» (pageArchive прототипа): завершённые проекты, по дате архивации. */
export const Archive: React.FC<{ data: PortalData }> = ({ data }) => {
  const { t } = React.useContext(AppCtx);
  const x = useDefsCtx(data);
  const rows = data.projects.filter(p => isArch(p.status)).sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : a.archivedAt > b.archivedAt ? -1 : 0));
  return <>
    <Hero title={t('navArchive')} sub={`${t('archiveSub')} · ${rows.length}`} />
    <div className="listcard"><DataTable tkey="archive" defs={projectDefs(x, true)} rows={rows} /></div>
  </>;
};
