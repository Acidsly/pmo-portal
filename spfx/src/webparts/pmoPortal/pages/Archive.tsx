import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { isArch } from '../logic/status';
import { AV, archiveView } from '../logic/views';
import { DataTable } from '../components/DataTable';
import { projectDefs } from '../components/defs';
import { Tiles } from '../components/Tiles';
import { ListIco, TilesIco } from '../components/Icons';
import { Hero, ViewSel, useDefsCtx } from './common';

const MODE = 'pmo-archmode';
const readMode = (): 'list' | 'tiles' => { try { return localStorage.getItem(MODE) === 'tiles' ? 'tiles' : 'list'; } catch { return 'list'; } };

/** «Архів» (pageArchive прототипа): навигация как в «Проєкти» — плитки или таблица, представления; только просмотр, по дате архивации. */
export const Archive: React.FC<{ data: PortalData }> = ({ data }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const [mode, setMode] = React.useState<'list' | 'tiles'>(readMode);
  const pick = (m: 'list' | 'tiles'): void => { setMode(m); try { localStorage.setItem(MODE, m); } catch { /* нет хранилища */ } };
  const x = useDefsCtx(data);
  const all = data.projects.filter(p => isArch(p.status));
  const rows = all.filter(p => archiveView(c.views.archive, p, c.me))
    .sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : a.archivedAt > b.archivedAt ? -1 : 0));
  const modeSw = <span className="seg" role="group">
    <button aria-pressed={mode === 'list'} onClick={() => pick('list')}><ListIco />{t('list')}</button>
    <button aria-pressed={mode === 'tiles'} onClick={() => pick('tiles')}><TilesIco />{t('tiles')}</button></span>;
  const sel = <ViewSel views={AV} value={c.views.archive} onChange={v => c.setView('archive', v)} />;
  return <>
    <Hero title={t('navArchive')} sub={`${t('archiveSub')} · ${all.length}`} />
    <div className="listcard">
      {mode === 'list'
        ? <DataTable tkey="archive" defs={projectDefs(x, true)} rows={rows} left={modeSw} right={sel} />
        : <><div className="cmdbar">{modeSw}<span className="spacer" />{sel}</div><Tiles rows={rows} /></>}
    </div>
  </>;
};
