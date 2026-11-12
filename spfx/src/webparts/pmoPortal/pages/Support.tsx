import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { isSupport, newestFirst, staleFirst } from '../logic/status';
import { SV, projectView } from '../logic/views';
import { DataTable } from '../components/DataTable';
import { projectDefs } from '../components/defs';
import { Tiles } from '../components/Tiles';
import { ListIco, TilesIco } from '../components/Icons';
import { Hero, ViewSel, useDefsCtx } from './common';

const MODE = 'pmo-projmode';
const readMode = (): 'list' | 'tiles' => { try { return localStorage.getItem(MODE) === 'list' ? 'list' : 'tiles'; } catch { return 'tiles'; } };

/** 1.7.12 «Проєкти підтримки» (pageSupport прототипа): проекты в фазе «Підтримка» — как «Поточні проєкти»: плитки или таблица,
 *  те же представления; свежесть — по четвергам. Режим «Список / Плитки» общий с «Поточні проєкти» (pmo-projmode). */
export const Support: React.FC<{ data: PortalData }> = ({ data }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const [mode, setMode] = React.useState<'list' | 'tiles'>(readMode);
  const pick = (m: 'list' | 'tiles'): void => { setMode(m); try { localStorage.setItem(MODE, m); } catch { /* нет хранилища */ } };
  const x = useDefsCtx(data);
  const all = data.projects.filter(p => isSupport(p.status));
  const rows = all.filter(p => projectView(c.views.support, p, c.today, c.me)).sort(c.views.support === 'stale' ? staleFirst : newestFirst);
  const modeSw = <span className="seg" role="group">
    <button aria-pressed={mode === 'list'} onClick={() => pick('list')}><ListIco />{t('list')}</button>
    <button aria-pressed={mode === 'tiles'} onClick={() => pick('tiles')}><TilesIco />{t('tiles')}</button></span>;
  const sel = <ViewSel views={SV} value={c.views.support} onChange={v => c.setView('support', v)} />;
  return <>
    <Hero title={t('navSupport')} sub={`${t('supportSub')} · ${all.length}`} />
    <div className="listcard">
      {!all.length ? <p className="empty">{t('emptySupport')}</p>
        : mode === 'list'
          ? <DataTable tkey="support" defs={projectDefs(x, false)} rows={rows} left={modeSw} right={sel} />
          : <><div className="cmdbar">{modeSw}<span className="spacer" />{sel}</div><Tiles rows={rows} /></>}
    </div>
    <p className="hint">{t('hintProjects')}</p>
  </>;
};
