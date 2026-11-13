import { PV, RV, KV, AV, SV } from './views';
import { Page, Views } from '../components/ctx';

// Маршрут приложения (векторы — spfx/test/route.test.ts; поведение прототипа — prototypeNav.test.ts)
// 1.7.12: вкладка «Проєкти підтримки» (support); режим главной — вид home: cur (поточні) / support (адрес #home/support)
export const PAGES: Page[] = ['home', 'projects', 'support', 'reports', 'risks', 'archive', 'feedback'];
export const DEFAULT_VIEWS: Views = { home: 'cur', projects: 'all', support: 'all', reports: 'all', risks: 'open', archive: 'all' };
export interface Route { page: Page; views: Views; projectId: number; form: string; }
/** Вкладки, вид которых сбрасывается при переходе из шапки; режим главной — запоминается (не сбрасывается). */
const RESET: Page[] = ['projects', 'support', 'reports', 'risks', 'archive'];
const HV = { cur: 1, support: 1 };

/** Адрес: #<вкладка>/<представление>/<id проекта>/<форма> — назад/вперёд браузера, ссылку на карточку можно отправить. */
export const pickDefault = (page: Page): Partial<Views> => (RESET.indexOf(page) >= 0 ? { [page]: DEFAULT_VIEWS[page as keyof Views] } : {});
export function parse(hash: string, prev: Views): Route {
  const [pg, view, id, form] = hash.replace(/^#/, '').split('/');
  const page = (PAGES.indexOf(pg as Page) >= 0 ? pg : 'home') as Page;
  const views = { ...prev };
  // адрес главной — точный режим: #home — поточні, #home/support — підтримка (назад / вперёд браузера)
  if (page === 'home') views.home = view && view in HV ? view as Views['home'] : 'cur';
  if (view && page === 'projects' && view in PV) views.projects = view as Views['projects'];
  if (view && page === 'support' && view in SV) views.support = view as Views['support'];
  if (view && page === 'reports' && view in RV) views.reports = view as Views['reports'];
  if (view && page === 'risks' && view in KV) views.risks = view as Views['risks'];
  if (view && page === 'archive' && view in AV) views.archive = view as Views['archive'];
  return { page, views, projectId: Number(id) || 0, form: form || '' };
}
export function format(r: Route): string {
  const v = r.page === 'home' ? (r.views.home === 'support' ? 'support' : '')
    : r.page === 'projects' || r.page === 'support' || r.page === 'reports' || r.page === 'risks' || r.page === 'archive' ? r.views[r.page] : '';
  return '#' + [r.page, v, r.projectId || '', r.form].join('/').replace(/\/+$/, '');
}
/** Переход на вкладку (#23, #24): без вида (вкладка в шапке) — вид страницы по умолчанию, а не запомненный;
 *  с видом (показатель главной, «Показати все») — этот вид. Главная открывается в последнем выбранном режиме. */
export const goRoute = (r: Route, page: Page, view?: string): Route =>
  parse('#' + page + '/' + (view || (page === 'home' && r.views.home === 'support' ? 'support' : '')), view ? r.views : { ...r.views, ...pickDefault(page) });
