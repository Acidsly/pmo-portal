import * as fs from 'fs';
import * as path from 'path';
import { T, FLD, EXTRA } from '../src/webparts/pmoPortal/i18n/strings';
import { makeT, langFromCulture } from '../src/webparts/pmoPortal/i18n/i18n';

test('словари перенесены из прототипа', () => {
  expect(T.dash).toEqual(['Панель проєктів', 'Project dashboard', 'Панель проектов']);
  expect(T.wpHealth[1]).toBe('Portfolio by health');
  expect(FLD.pm).toBeDefined();
  expect(EXTRA.soon).toHaveLength(3);
});
test('t / fl / язык из профиля', () => {
  const { t, fl } = makeT(1);
  expect(t('dash')).toBe('Project dashboard'); expect(t('нет такого')).toBe('нет такого');
  expect(fl('rDate')).toBe('Report date');
  expect(langFromCulture('uk-UA')).toBe(0); expect(langFromCulture('en-US')).toBe(1); expect(langFromCulture('ru-RU')).toBe(2); expect(langFromCulture('de-DE')).toBe(0);
});
test('CSS изолирован под .pmo-app', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/webparts/pmoPortal/theme/prototype.scss'), 'utf8');
  expect(css).toContain('.pmo-app[data-theme="dark"]');
  expect(css).toContain('.pmo-panel');
  expect(css).not.toMatch(/(^|[\s,}]):root/);
  expect(css).not.toMatch(/(^|[\s,}])body\s*\{/);
  expect(css).not.toMatch(/(^|[\s,}])main[\s,{]/);
});
