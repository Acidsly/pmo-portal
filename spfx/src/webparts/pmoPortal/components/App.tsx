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
import { ReportForm } from '../panels/ReportForm';
import { ProjectForm } from '../panels/ProjectForm';
import { FeedbackForm } from '../panels/FeedbackForm';
import { RiskForm } from '../panels/RiskForm';
import { Toast, useToast } from './Toast';

export interface AppProps { repo: SpRepo; culture: string; userName: string; userEmail: string; webUrl: string; }

const PAGES: Page[] = ['home', 'projects', 'reports', 'risks', 'archive'];
const DEFAULT_VIEWS: Views = { projects: 'all', reports: 'all', risks: 'open' };
interface Route { page: Page; views: Views; projectId: number; form: string; }

/** Адрес: #<вкладка>/<представление>/<id проекта>/<форма> — назад/вперёд браузера, ссылку на карточку можно отправить. */
function parse(hash: string, prev: Views): Route {
  const [pg, view, id, form] = hash.replace(/^#/, '').split('/');
  const page = (PAGES.indexOf(pg as Page) >= 0 ? pg : 'home') as Page;
  const views = { ...prev };
  if (view && page === 'projects' && view in PV) views.projects = view as Views['projects'];
  if (view && page === 'reports' && view in RV) views.reports = view as Views['reports'];
  if (view && page === 'risks' && view in KV) views.risks = view as Views['risks'];
  return { page, views, projectId: Number(id) || 0, form: form || '' };
}
function format(r: Route): string {
  const v = r.page === 'projects' || r.page === 'reports' || r.page === 'risks' ? r.views[r.page] : '';
  return '#' + [r.page, v, r.projectId || '', r.form].join('/').replace(/\/+$/, '');
}

/** Корень приложения: язык, тема, маршрут, данные; весь CSS прототипа действует внутри .pmo-app. */
export const App: React.FC<AppProps> = p => {
  const [lang, setLang] = React.useState<Lang>(readLang() ?? langFromCulture(p.culture));
  const [theme, setTheme] = React.useState<Theme>(readTheme());
  const [route, setRoute] = React.useState<Route>(() => parse(window.location.hash, DEFAULT_VIEWS));
  const [data, setData] = React.useState<PortalData | undefined>(undefined);
  const [err, setErr] = React.useState('');
  const load = (): Promise<void> => p.repo.loadAll().then(setData, e => setErr(String((e && e.message) || e)));
  React.useEffect(() => { load().catch(() => undefined); }, []);
  const [toastMsg, showToast] = useToast();
  React.useEffect(() => {
    const on = (): void => setRoute(r => parse(window.location.hash, r.views));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const nav = (r: Route): void => { const h = format(r); if (window.location.hash !== h) window.location.hash = h; setRoute(r); };
  const tt = makeT(lang);
  const ctx: Ctx = { ...tt, lang, today: todayIso(), me: p.userEmail, webUrl: p.webUrl, views: route.views, canCreate: !!data && data.canCreate,
    go: (page, view) => { nav(parse('#' + page + '/' + (view || ''), route.views)); window.scrollTo(0, 0); },
    setView: (page, view) => nav({ ...route, views: { ...route.views, [page]: view } }),
    openProject: id => nav({ ...route, projectId: id, form: '' }),
    openForm: (form, id) => nav({ ...route, projectId: id || 0, form }),
    repo: p.repo, reload: load, toast: showToast };
  const project = data && route.projectId ? data.projects.filter(x => x.id === route.projectId)[0] : undefined;
  const close = (): void => nav({ ...route, projectId: 0, form: '' });
  const back = (): void => nav({ ...route, form: '' });
  const panelOpen = !!data && (!!route.form || !!project);
  let panelEl: React.ReactNode = null;
  if (data && route.form === 'feedback') panelEl = <FeedbackForm screen={format({ ...route, form: '' })} onCancel={back} />;
  else if (data && route.form === 'report') panelEl = <ReportForm data={data} projectId={route.projectId} onCancel={project ? back : close} />;
  else if (data && (route.form === 'project' || route.form === 'edit')) panelEl = <ProjectForm data={data} project={route.form === 'edit' ? project : undefined} onCancel={project ? back : close} />;
  else if (data && route.form.indexOf('risk:') === 0) panelEl = <RiskForm data={data} projectId={route.projectId} riskId={Number(route.form.slice(5)) || 0} onCancel={project ? back : close} />;
  else if (data && project) panelEl = <ProjectCard project={project} data={data} repo={p.repo} onClose={close} />;
  const pageEl = !data ? null
    : route.page === 'home' ? <Home data={data} />
    : route.page === 'projects' ? <Projects data={data} />
    : route.page === 'archive' ? <Archive data={data} />
    : route.page === 'reports' ? <Reports data={data} /> : <Risks data={data} />;
  return <AppCtx.Provider value={ctx}>
    <div className="pmo-app pmo-sp" data-theme={theme || undefined} lang={LANG_CODES[lang]}>
      <Header page={route.page} lang={lang} theme={theme} userName={p.userName} userEmail={p.userEmail}
        onPage={pg => ctx.go(pg)} onLang={l => { setLang(l); saveLang(l); }} onTheme={v => { setTheme(v); saveTheme(v); }}
        onFeedback={data && data.feedback ? () => ctx.openForm('feedback', route.projectId) : undefined} />
      <main className="pmo-main">
        {err ? <p className="empty">{tt.t('loadErr')}: {err}</p> : !data ? <p className="empty">…</p> : pageEl}
      </main>
      <Panel open={panelOpen} view={`${route.projectId}/${route.form}`} label={project ? project.title : tt.t('siteTitle')} onClose={route.form && project ? back : close}>{panelEl}</Panel>
      <Toast msg={toastMsg} />
    </div>
  </AppCtx.Provider>;
};
