import * as React from 'react';
import { SpRepo, PortalData } from '../data/SpRepo';
import { Lang, LANG_CODES, langFromCulture, makeT, readLang, saveLang } from '../i18n/i18n';
import { Theme, readTheme, saveTheme } from '../theme/theme';
import { todayIso } from '../logic/dates';
import { PV, RV, KV } from '../logic/views';
import { AppCtx, Ctx, Page, Views } from './ctx';
import { Header } from './Header';
import { Panel } from './Panel';
import { Home } from '../pages/Home';
import { Projects } from '../pages/Projects';
import { Archive } from '../pages/Archive';
import { Reports } from '../pages/Reports';
import { Risks } from '../pages/Risks';
import { ProjectCard } from '../panels/ProjectCard';

export interface AppProps { repo: SpRepo; culture: string; userName: string; userEmail: string; webUrl: string; }

const PAGES: Page[] = ['home', 'projects', 'reports', 'risks', 'archive'];
const DEFAULT_VIEWS: Views = { projects: 'all', reports: 'all', risks: 'open' };
interface Route { page: Page; views: Views; projectId: number; }

/** Адрес: #<вкладка>/<представление>/<id проекта> — назад/вперёд браузера, ссылку на карточку можно отправить. */
function parse(hash: string, prev: Views): Route {
  const [pg, view, id] = hash.replace(/^#/, '').split('/');
  const page = (PAGES.indexOf(pg as Page) >= 0 ? pg : 'home') as Page;
  const views = { ...prev };
  if (view && page === 'projects' && view in PV) views.projects = view as Views['projects'];
  if (view && page === 'reports' && view in RV) views.reports = view as Views['reports'];
  if (view && page === 'risks' && view in KV) views.risks = view as Views['risks'];
  return { page, views, projectId: Number(id) || 0 };
}
function format(r: Route): string {
  const v = r.page === 'projects' || r.page === 'reports' || r.page === 'risks' ? r.views[r.page] : '';
  return '#' + [r.page, v, r.projectId || ''].join('/').replace(/\/+$/, '');
}

/** Корень приложения: язык, тема, маршрут, данные; весь CSS прототипа действует внутри .pmo-app. */
export const App: React.FC<AppProps> = p => {
  const [lang, setLang] = React.useState<Lang>(readLang() ?? langFromCulture(p.culture));
  const [theme, setTheme] = React.useState<Theme>(readTheme());
  const [route, setRoute] = React.useState<Route>(() => parse(window.location.hash, DEFAULT_VIEWS));
  const [data, setData] = React.useState<PortalData | undefined>(undefined);
  const [err, setErr] = React.useState('');
  React.useEffect(() => { p.repo.loadAll().then(setData, e => setErr(String((e && e.message) || e))); }, []);
  React.useEffect(() => {
    const on = (): void => setRoute(r => parse(window.location.hash, r.views));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const nav = (r: Route): void => { const h = format(r); if (window.location.hash !== h) window.location.hash = h; setRoute(r); };
  const tt = makeT(lang);
  const ctx: Ctx = { ...tt, lang, today: todayIso(), me: p.userEmail, webUrl: p.webUrl, views: route.views,
    go: (page, view) => { nav(parse('#' + page + '/' + (view || ''), route.views)); window.scrollTo(0, 0); },
    setView: (page, view) => nav({ ...route, views: { ...route.views, [page]: view } }),
    openProject: id => nav({ ...route, projectId: id }) };
  const project = data && route.projectId ? data.projects.filter(x => x.id === route.projectId)[0] : undefined;
  const pageEl = !data ? null
    : route.page === 'home' ? <Home data={data} />
    : route.page === 'projects' ? <Projects data={data} />
    : route.page === 'archive' ? <Archive data={data} />
    : route.page === 'reports' ? <Reports data={data} /> : <Risks data={data} />;
  return <AppCtx.Provider value={ctx}>
    <div className="pmo-app pmo-sp" data-theme={theme || undefined} lang={LANG_CODES[lang]}>
      <Header page={route.page} lang={lang} theme={theme} userName={p.userName} userEmail={p.userEmail}
        onPage={pg => ctx.go(pg)} onLang={l => { setLang(l); saveLang(l); }} onTheme={v => { setTheme(v); saveTheme(v); }} />
      <main className="pmo-main">
        {err ? <p className="empty">{tt.t('loadErr')}: {err}</p> : !data ? <p className="empty">…</p> : pageEl}
      </main>
      <Panel open={!!project} label={project ? project.title : ''} onClose={() => nav({ ...route, projectId: 0 })}>
        {project && data ? <ProjectCard project={project} data={data} repo={p.repo} onClose={() => nav({ ...route, projectId: 0 })} /> : null}
      </Panel>
    </div>
  </AppCtx.Provider>;
};
