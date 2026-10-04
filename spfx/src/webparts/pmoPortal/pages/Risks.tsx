import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { isArch, isActive, newestFirst } from '../logic/status';
import { KV, riskInView } from '../logic/views';
import { DataTable } from '../components/DataTable';
import { riskDefs, riskCard } from '../components/defs';
import { Plus } from '../components/Icons';
import { Hero, ViewSel, useDefsCtx } from './common';

/** «Ризики та проблеми» (pageRisks прототипа): риски неархивных проектов, по оценке. */
export const Risks: React.FC<{ data: PortalData }> = ({ data }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const x = useDefsCtx(data);
  const rows = data.risks.filter(k => x.byId[k.projectId] && riskInView(c.views.risks, k, isArch(x.byId[k.projectId].status)))
    .sort(newestFirst);   // новые сверху; по оценке — сортировкой колонки
  const canAdd = data.projects.some(p => isActive(p.status) && p.canEdit);
  const add = canAdd ? <button className="cmd primary" onClick={() => c.openForm('risk:new')}><Plus />{t('newRisk')}</button> : null;
  return <>
    <Hero title={t('navRisks')} />
    <div className="listcard"><DataTable tkey="risks" defs={riskDefs(x)} rows={rows} left={add} card={riskCard(x)}
      right={<ViewSel views={KV} value={c.views.risks} onChange={v => c.setView('risks', v)} />} /></div>
    <p className="hint">{t('hintRisks')}</p>
  </>;
};
