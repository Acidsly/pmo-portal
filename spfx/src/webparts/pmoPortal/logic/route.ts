import { PV, RV, KV, AV } from './views';
import { Page, Views } from '../components/ctx';

// Маршрут приложения (векторы — spfx/test/route.test.ts; поведение прототипа — prototypeNav.test.ts)
export const PAGES: Page[] = ['home', 'projects', 'reports', 'risks', 'archive', 'feedback'];
export const DEFAULT_VIEWS: Views = { projects: 'all', reports: 'all', risks: 'open', archive: 'all' };
export interface Route { page: Page; views: Views; projectId: number; form: string; }


/** Адрес: #<вкладка>/<представление>/<id проекта>/<форма> — назад/вперёд браузера, ссылку на карточку можно отправить. */
export const pickDefault = (page: Page): Partial<Views> => (page in DEFAULT_VIEWS ? { [page]: DEFAULT_VIEWS[page as keyof Views] } : {});
export function parse(hash: string, prev: Views): Route {
  const [pg, view, id, form] = hash.replace(/^#/, '').split('/');
  const page = (PAGES.indexOf(pg as Page) >= 0 ? pg : 'home') as Page;
  const views = { ...prev };
  if (view && page === 'projects' && view in PV) views.projects = view as Views['projects'];
  if (view && page === 'reports' && view in RV) views.reports = view as Views['reports'];
  if (view && page === 'risks' && view in KV) views.risks = view as Views['risks'];
  if (view && page === 'archive' && view in AV) views.archive = view as Views['archive'];
  return { page, views, projectId: Number(id) || 0, form: form || '' };
}
export function format(r: Route): string {
  const v = r.page === 'projects' || r.page === 'reports' || r.page === 'risks' || r.page === 'archive' ? r.views[r.page] : '';
  return '#' + [r.page, v, r.projectId || '', r.form].join('/').replace(/\/+$/, '');
}
/** Переход на вкладку (#23, #24): без вида (вкладка в шапке) — вид страницы по умолчанию, а не запомненный;
 *  с видом (показатель главной, «Показати все») — этот вид. */
export const goRoute = (r: Route, page: Page, view?: string): Route =>
  parse('#' + page + '/' + (view || ''), view ? r.views : { ...r.views, ...pickDefault(page) });
