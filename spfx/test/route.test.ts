import { parse, format, goRoute, DEFAULT_VIEWS } from '../src/webparts/pmoPortal/logic/route';

// #23 / #24: вкладка в шапке открывается с видом по умолчанию, показатель главной — со своим видом
test('#23: показатель «Прострочені» → вкладка «Проєкти» в шапке → «Усі проєкти»', () => {
  let r = parse('#home', DEFAULT_VIEWS);
  r = goRoute(r, 'projects', 'late'); expect(r.page).toBe('projects'); expect(r.views.projects).toBe('late');
  r = goRoute(r, 'home');
  r = goRoute(r, 'projects'); expect(r.views.projects).toBe('all');
});
test('#24: «Зі свіжим звітом» → «Проєкти» → «Ризики» → «Проєкти»: виды по умолчанию', () => {
  let r = goRoute(parse('', DEFAULT_VIEWS), 'projects', 'stale');
  r = goRoute(r, 'risks'); expect(r.views.risks).toBe('open');
  r = goRoute(r, 'projects'); expect(r.views.projects).toBe('all');
});
test('вид одной вкладки не меняет вид другой; неизвестный вид и страница — по умолчанию', () => {
  const r = goRoute(goRoute(parse('', DEFAULT_VIEWS), 'risks', 'high'), 'reports', 'awaiting');
  expect(r.views.risks).toBe('high'); expect(r.views.reports).toBe('awaiting');
  expect(parse('#projects/xyz', DEFAULT_VIEWS).views.projects).toBe('all');
  expect(parse('#nope', DEFAULT_VIEWS).page).toBe('home');
});
test('адрес: туда и обратно (вкладка, вид, проект, форма)', () => {
  const r = parse('#projects/mine/12/report', DEFAULT_VIEWS);
  expect(r).toMatchObject({ page: 'projects', projectId: 12, form: 'report' }); expect(r.views.projects).toBe('mine');
  expect(format(r)).toBe('#projects/mine/12/report');
  expect(format(parse('#home', DEFAULT_VIEWS))).toBe('#home');
});
test('App переходит по вкладкам только через goRoute', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal/components/App.tsx'), 'utf8');
  expect(src).toMatch(/go: \(page, view\) => \{ nav\(goRoute\(route, page, view\)\)/);
});
