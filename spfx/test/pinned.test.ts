import * as fs from 'fs';
import * as path from 'path';
import { money } from '../src/webparts/pmoPortal/components/Bits';
import { FB_STATUSES } from '../src/webparts/pmoPortal/pages/Feedback';
import { FLD, T } from '../src/webparts/pmoPortal/i18n/strings';

// Закреплённые решения по отзывам, которые проверяются без сценария
test('#30: суммы — в долларах, целые', () => {
  expect(money(1234567)).toMatch(/ \$$/); expect(money(12.5)).toMatch(/^13 \$$/); expect(money(0)).toBe('0 $');
});
test('#14: у каждого статуса разбора отзыва — свой цвет (.fbst-N)', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/webparts/pmoPortal/theme/overrides.scss'), 'utf8');
  FB_STATUSES.forEach((_, i) => expect(css).toMatch(new RegExp(`\\.fbst-${i}\\s*\\{`)));
});
test('#11: «Термін виконання заходів»; #16: «Відображати»', () => {
  const kDue = (FLD as any).kDue || (T as any).kDue;
  expect(kDue[0]).toBe('Термін виконання заходів');
  expect(T.view[0]).toBe('Відображати');
});
