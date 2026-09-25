// Переносит словари (T, FLD) и CSS прототипа в приложение. Запуск: npm run extract. Результат коммитится.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../../prototype/pmo-prototype.html'), 'utf8');
const out = p => path.join(here, '../src/webparts/pmoPortal', p);

// --- словари: объекты T и FLD — литералы; вычисляем их в изолированной функции
const grab = name => {
  const a = src.indexOf(`const ${name} = {`); if (a < 0) throw new Error(`нет ${name} в прототипе`);
  let i = src.indexOf('{', a), d = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  return new Function(`return (${src.slice(i, j + 1)});`)();
};
const EXTRA = {
  soon: ['Цей розділ з’явиться на наступному етапі.', 'This section is coming in the next stage.', 'Этот раздел появится на следующем этапе.'],
  loadErr: ['Не вдалося завантажити дані', 'Could not load data', 'Не удалось загрузить данные'],
  pendingNote: ['Оновлюється зі статус-звіту', 'Updating from a status report', 'Обновляется из статус-отчёта'],
  noCreate: ['Нові проєкти створює PMO. Зверніться до групи «PMO — адміністратори».', 'New projects are created by PMO. Contact the “PMO — administrators” group.', 'Новые проекты создаёт PMO. Обратитесь к группе «PMO — администраторы».'],
  feedback: ['Відгук', 'Feedback', 'Отзыв'],
  help: ['Довідка', 'Help', 'Справка'],
  fbTitle: ['Відгук про портал', 'Portal feedback', 'Отзыв о портале'],
  fbList: ['Відгуки', 'Feedback', 'Отзывы'],
  fbHint: ['Що не так або що покращити? Опишіть, що ви робили і що очікували побачити. Екран, з якого ви відкрили відгук, і пристрій додаються самі.', 'What is wrong or what could be better? Describe what you did and what you expected. The screen you opened this from and your device are added automatically.', 'Что не так или что улучшить? Опишите, что вы делали и что ожидали увидеть. Экран, с которого вы открыли отзыв, и устройство добавляются сами.'],
  fbText: ['Що не так або що покращити?', 'What is wrong or what could be better?', 'Что не так или что улучшить?'],
  fbShots: ['Скриншоти', 'Screenshots', 'Скриншоты'],
  fbAdd: ['Додати скриншот', 'Add screenshot', 'Добавить скриншот'],
  fbPaste: ['Скриншот можна вставити з буфера: Ctrl+V (Windows) або Cmd+V (Mac).', 'You can paste a screenshot from the clipboard: Ctrl+V (Windows) or Cmd+V (Mac).', 'Скриншот можно вставить из буфера: Ctrl+V (Windows) или Cmd+V (Mac).'],
  fbMax: ['Не більше 5 скриншотів.', 'No more than 5 screenshots.', 'Не больше 5 скриншотов.'],
  fbBig: ['Файл завеликий (понад 10 МБ).', 'The file is too large (over 10 MB).', 'Файл слишком большой (больше 10 МБ).'],
  fbRemove: ['Прибрати скриншот', 'Remove screenshot', 'Убрать скриншот'],
  fbScreen: ['Екран', 'Screen', 'Экран'],
  fbErrText: ['Опишіть, що не так або що покращити.', 'Describe what is wrong or what could be better.', 'Опишите, что не так или что улучшить.'],
  fbSend: ['Надіслати', 'Send', 'Отправить'],
  fbSending: ['Надсилаємо…', 'Sending…', 'Отправляем…'],
  fbSent: ['Дякуємо! Відгук надіслано.', 'Thank you! Feedback sent.', 'Спасибо! Отзыв отправлен.']
};
const ts = `// Сгенерировано tools/extract-prototype.mjs из prototype/pmo-prototype.html — не править вручную.\n` +
  `export type L3 = [string, string, string];\n` +
  `export const T: Record<string, L3> = ${JSON.stringify(grab('T'), null, 1)};\n` +
  `export const FLD: Record<string, L3> = ${JSON.stringify(grab('FLD'), null, 1)};\n` +
  `export const EXTRA: Record<string, L3> = ${JSON.stringify(EXTRA, null, 1)};\n`;
fs.mkdirSync(out('i18n'), { recursive: true }); fs.writeFileSync(out('i18n/strings.ts'), ts);

// --- CSS: темы на .pmo-app, остальное вложено в .pmo-app { … }, id-элементы -> классы
let css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
css = css.replace(/:root:not\(\[data-theme="light"\]\)/g, '.pmo-app:not([data-theme="light"])')
         .replace(/:root\[data-theme="dark"\]/g, '.pmo-app[data-theme="dark"]')
         .replace(/(^|\})\s*:root\s*\{/g, '$1\n.pmo-app{')
         // html{scroll-padding-top} отброшен сознательно: страницу прокручивает SharePoint, а не приложение
         .replace(/(^|\})\s*html\s*\{[^}]*\}/g, '$1')
         .replace(/(^|\})\s*body\s*\{/g, '$1\n&{')
         .replace(/#(scrim|panel|toast|pop)\b/g, '.pmo-$1')                 // id-селекторы прототипа -> классы
         .replace(/(^|[\s,}])main(?=[\s,{])/g, '$1.pmo-main');             // «main{…}» и «main,.top-in{…}»
// блоки тем (.pmo-app{…}, @media … .pmo-app:not…, .pmo-app[data-theme]) остаются снаружи, остальное — внутрь
const themeEnd = css.indexOf('.pmo-app[data-theme="dark"]'); const afterTheme = css.indexOf('}', themeEnd) + 1;
// :global — сборка SPFx обрабатывает .scss как CSS-модуль и переименовывает классы; разметке нужны исходные имена
const scss = `// Сгенерировано tools/extract-prototype.mjs — не править вручную.\n:global {\n${css.slice(0, afterTheme)}\n.pmo-app{\n${css.slice(afterTheme)}\n}\n}\n`;
fs.mkdirSync(out('theme'), { recursive: true }); fs.writeFileSync(out('theme/prototype.scss'), scss);
console.log('i18n/strings.ts и theme/prototype.scss обновлены');
