import * as fs from 'fs';
import * as path from 'path';
import { diagOn } from '../src/webparts/pmoPortal/components/Diag';

// Телефон (план мобильного интерфейса, этап 1): правила раскладки — в стилях из прототипа (единый источник)
const css = fs.readFileSync(path.join(__dirname, '../src/webparts/pmoPortal/theme/prototype.scss'), 'utf8');
const phone = css.slice(css.indexOf('Телефон: шапка в один ряд'));
test('шапка: один ряд, при прокрутке прилипает только меню разделов; язык и тема — в меню аватара', () => {
  expect(phone).toMatch(/\.top\s*\{\s*top:\s*calc\(env\(safe-area-inset-top, 0px\) - 60px\)/);
  expect(phone).toMatch(/\.controls \.seg\s*\{\s*display:\s*none/);
  expect(phone).toMatch(/\.nav\s*\{\s*order:\s*3/);
  expect(css).toMatch(/\.me-prefs\s*\{\s*display:\s*none/);
});
test('#107: у нижнего окна фильтра и колонок кнопки — вверху; скрытое окно не показывается', () => {
  expect(phone).toMatch(/\.pmo-pop:not\(\[hidden\]\)\s*\{\s*display:\s*flex/);
  expect(phone).toMatch(/\.pmo-pop \.pop-f\s*\{\s*order:\s*-1/);
});
test('#97: блок погодження в просмотре отчёта не прилипает', () =>
  expect(phone).toMatch(/\.pmo-panel \.apbox form \.actions\s*\{\s*position:\s*static/));
test('низ экрана — место под панель браузера', () => expect(phone).toMatch(/\.pmo-main\s*\{\s*padding-bottom:\s*calc\(40px \+ env\(safe-area-inset-bottom/));
test('диагностика: ?diag=1 — только владельцам сайта', () => {
  expect([diagOn('?diag=1', true), diagOn('?x=1&diag=1', true), diagOn('?diag=1', false), diagOn('?diag=10', true), diagOn('', true)]).toEqual([true, true, false, false, false]);
});
