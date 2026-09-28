import { PV, RV, KV, AV } from './views';

/** Экран отзыва по адресу приложения (#вкладка/представление/id/форма) — понятная подпись: «Проєкти · Усі проєкти · картка проєкту». */
export function screenLabel(hash: string, t: (k: string) => string, tv: (v: string) => string): string {
  // не адрес приложения (например, «Лист PMO» — отзыв из письма) — как есть
  if (hash && hash.charAt(0) !== '#') return hash;
  const [pg, view, id, form] = (hash || '').replace(/^#/, '').split('/');
  const PAGE: Record<string, string> = { home: 'navHome', projects: 'navProjects', reports: 'navReports', risks: 'navRisks', archive: 'navArchive', feedback: 'navFeedback' };
  const VIEWS: Record<string, Record<string, string>> = { projects: PV, reports: RV, risks: KV, archive: AV };
  const parts = [t(PAGE[pg] || 'navHome')];
  const v = VIEWS[pg] && view ? (VIEWS[pg] as Record<string, string>)[view] : '';
  if (v) parts.push(tv(v));
  if (Number(id)) parts.push(t('scrCard'));
  const f = form || '';
  const FORM: [RegExp, string][] = [[/^report/, 'newReport'], [/^edit$/, 'editProject'], [/^project$/, 'newProject'], [/^risk:/, 'secRisks'],
    [/^rep:/, 'apTitle'], [/^help$/, 'help'], [/^feedback$/, 'feedback']];
  const hit = FORM.filter(([re]) => re.test(f))[0];
  if (hit) parts.push(t(hit[1]));
  return parts.join(' · ');
}
