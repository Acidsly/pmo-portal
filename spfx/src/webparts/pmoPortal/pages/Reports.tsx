import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { isArch, isActive } from '../logic/status';
import { RV, reportView } from '../logic/views';
import { DataTable } from '../components/DataTable';
import { reportDefs } from '../components/defs';
import { Plus } from '../components/Icons';
import { Hero, ViewSel, useDefsCtx } from './common';

/** «Статус-звіти» (pageReports прототипа). */
export const Reports: React.FC<{ data: PortalData }> = ({ data }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const x = useDefsCtx(data);
  const rows = data.reports.filter(r => x.byId[r.projectId] && reportView(c.views.reports, r))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  const canAdd = data.projects.some(p => !isArch(p.status) && isActive(p.status) && p.canEdit);
  const add = canAdd ? <button className="cmd primary" onClick={() => c.openForm('report')}><Plus />{t('newReport')}</button> : null;
  return <>
    <Hero title={t('navReports')} />
    <div className="listcard"><DataTable tkey="reports" defs={reportDefs(x)} rows={rows} left={add}
      right={<ViewSel views={RV} value={c.views.reports} onChange={v => c.setView('reports', v)} />} /></div>
  </>;
};
