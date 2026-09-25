import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { isArch, newestFirst } from '../logic/status';
import { PV, projectView } from '../logic/views';
import { DataTable } from '../components/DataTable';
import { projectDefs } from '../components/defs';
import { Tiles } from '../components/Tiles';
import { ListIco, TilesIco } from '../components/Icons';
import { Hero, ViewSel, useDefsCtx } from './common';

const MODE = 'pmo-projmode';
const readMode = (): 'list' | 'tiles' => { try { return localStorage.getItem(MODE) === 'list' ? 'list' : 'tiles'; } catch { return 'tiles'; } };

/** «Проєкти» (pageProjects прототипа): плитки или таблица, представления. */
export const Projects: React.FC<{ data: PortalData }> = ({ data }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const [mode, setMode] = React.useState<'list' | 'tiles'>(readMode);
  const pick = (m: 'list' | 'tiles'): void => { setMode(m); try { localStorage.setItem(MODE, m); } catch { /* нет хранилища */ } };
  const x = useDefsCtx(data);
  const vis = data.projects.filter(p => !isArch(p.status));
  const rows = vis.filter(p => projectView(c.views.projects, p, c.today, c.me)).sort(newestFirst);   // новые сверху
  const modeSw = <span className="seg" role="group">
    <button aria-pressed={mode === 'list'} onClick={() => pick('list')}><ListIco />{t('list')}</button>
    <button aria-pressed={mode === 'tiles'} onClick={() => pick('tiles')}><TilesIco />{t('tiles')}</button></span>;
  const sel = <ViewSel views={PV} value={c.views.projects} onChange={v => c.setView('projects', v)} />;
  return <>
    <Hero title={t('navProjects')} sub={t('visible') + vis.length} withNew={true} />
    <div className="listcard">
      {mode === 'list'
        ? <DataTable tkey="projects" defs={projectDefs(x, false)} rows={rows} left={modeSw} right={sel} />
        : <><div className="cmdbar">{modeSw}<span className="spacer" />{sel}</div><Tiles rows={rows} /></>}
    </div>
    <p className="hint">{t('hintProjects')}</p>
  </>;
};
