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
  scrCard: ['картка проєкту', 'project card', 'карточка проекта'],
  soon: ['Цей розділ з’явиться на наступному етапі.', 'This section is coming in the next stage.', 'Этот раздел появится на следующем этапе.'],
  loadErr: ['Не вдалося завантажити дані', 'Could not load data', 'Не удалось загрузить данные'],
  pendingNote: ['Оновлюється зі статус-звіту', 'Updating from a status report', 'Обновляется из статус-отчёта'],
  noCreate: ['Нові проєкти створює PMO. Зверніться до групи «PMO — адміністратори».', 'New projects are created by PMO. Contact the “PMO — administrators” group.', 'Новые проекты создаёт PMO. Обратитесь к группе «PMO — администраторы».'],
  feedback: ['Відгук', 'Feedback', 'Отзыв'],
  help: ['Довідка', 'Help', 'Справка'],
  overview: ['Детальний огляд системи', 'Detailed system overview', 'Подробный обзор системы'],
  overviewLead: ['Хочете більше? Детальний огляд: навіщо система, з чого складається, усі екрани зі скриншотами, правила й безпека.', 'Want more? The detailed overview (in Ukrainian): why the system exists, its parts, every screen with screenshots, rules and security.', 'Хотите больше? Подробный обзор (на украинском): зачем система, из чего состоит, все экраны со скриншотами, правила и безопасность.'],
  overviewBack: ['← До довідки', '← Back to help', '← К справке'],
  overviewPdf: ['Завантажити PDF', 'Download PDF', 'Скачать PDF'],
  navFeedback: ['Відгуки', 'Feedback', 'Отзывы'],
  feedbackNew: ['Залишити відгук', 'Leave feedback', 'Оставить отзыв'],
  fbPageSub: ['Зауваження й пропозиції учасників тесту та відповіді розробників рішення', 'Test participants’ comments and suggestions with the solution team’s answers', 'Замечания и предложения участников теста и ответы разработчиков решения'],
  fbNum: ['№', 'No.', '№'],
  fbDate: ['Дата', 'Date', 'Дата'],
  fbAuthor: ['Автор', 'Author', 'Автор'],
  fbStatusCol: ['Статус розгляду', 'Review status', 'Статус рассмотрения'],
  fbAnswer: ['Відповідь', 'Answer', 'Ответ'],
  fbViewAll: ['Усі відгуки', 'All feedback', 'Все отзывы'],
  fbViewMine: ['Мої відгуки', 'My feedback', 'Мои отзывы'],
  fbViewOpen: ['Без відповіді', 'Not answered', 'Без ответа'],
  fbNoItems: ['Відгуків ще немає.', 'No feedback yet.', 'Отзывов пока нет.'],
  fbShotsHidden: ['Скриншоти бачать автор і розробники рішення', 'Screenshots are visible to the author and the solution team', 'Скриншоты видят автор и разработчики решения'],
  fbNoAnswer: ['Відповіді ще немає — ми її додамо після розгляду.', 'No answer yet — we will add it after review.', 'Ответа пока нет — мы добавим его после рассмотрения.'],
  fbAnswered: ['Відповідь збережено.', 'Answer saved.', 'Ответ сохранён.'],
  fbPrev: ['Попередній відгук', 'Previous feedback', 'Предыдущий отзыв'],
  fbNext: ['Наступний відгук', 'Next feedback', 'Следующий отзыв'],
  errCode: ['Такий код уже є в іншого проєкту. Вкажіть інший або залиште поле порожнім — код призначиться автоматично.', 'This code is already used by another project. Enter another one or leave the field empty to assign it automatically.', 'Такой код уже есть у другого проекта. Укажите другой или оставьте поле пустым — код назначится автоматически.'],
  csv: ['CSV', 'CSV', 'CSV'],
  fbAll: ['Усі відгуки учасників (для PMO)', 'All participants’ feedback (PMO)', 'Все отзывы участников (для PMO)'],
  csvTitle: ['Вивантажити таблицю в CSV (як на екрані: фільтри й колонки)', 'Export the table to CSV (as shown: filters and columns)', 'Выгрузить таблицу в CSV (как на экране: фильтры и колонки)'],
  fbTitle: ['Відгук про портал', 'Portal feedback', 'Отзыв о портале'],
  fbList: ['Відгуки', 'Feedback', 'Отзывы'],
  fbHint: ['Що не так або що покращити? Опишіть, що ви робили і що очікували побачити. Вкажіть, на якому екрані це помітили; пристрій додається сам.', 'What is wrong or what could be better? Describe what you did and what you expected. Say on which screen you noticed it; your device is added automatically.', 'Что не так или что улучшить? Опишите, что вы делали и что ожидали увидеть. Укажите, на каком экране это заметили; устройство добавляется само.'],
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
  fbSent: ['Дякуємо! Відгук надіслано.', 'Thank you! Feedback sent.', 'Спасибо! Отзыв отправлен.'],
  // защита от окон синхронизации (приложение 1.7): сообщения проверки перед записью — только в приложении
  errNotReady: ["Проєкт ще готується: права й папки з'являться протягом 15 хвилин після створення. Спробуйте трохи пізніше.","The project is still being prepared: access and folders appear within 15 minutes of creation. Please try again shortly.","Проект ещё готовится: права и папки появятся в течение 15 минут после создания. Попробуйте чуть позже."],
  errNoRights: ["У вас немає права на цю дію — можливо, права щойно змінилися. Дані оновлено.","You don't have permission for this action — access may have just changed. Data refreshed.","У вас нет права на это действие — возможно, права только что изменились. Данные обновлены."],
  errConflict: ["Запис змінив інший користувач. Дані оновлено — перевірте й повторіть.","Another user changed this record. Data refreshed — check and try again.","Запись изменил другой пользователь. Данные обновлены — проверьте и повторите."],
  notReadyNote: ["Проєкт готується: звіти, ризики й команду можна буде додати протягом 15 хвилин після створення.","The project is being prepared: reports, risks and team can be added within 15 minutes of creation.","Проект готовится: отчёты, риски и команду можно будет добавить в течение 15 минут после создания."],
  gPmChanged: ["PM проєкту змінився (тепер {pm}) — змінювати проєкт може лише він. Дані оновлено.","The project PM has changed (now {pm}) — only they can change the project. Data refreshed.","PM проекта сменился (теперь {pm}) — менять проект может только он. Данные обновлены."],
  gPmSoon: ["Ви призначені PM цього проєкту: права редагування з'являться протягом 15 хвилин.","You are assigned as PM of this project: edit access appears within 15 minutes.","Вы назначены PM этого проекта: права редактирования появятся в течение 15 минут."],
  gArchived: ["Проєкт в архіві — лише перегляд. Дані оновлено.","The project is archived — view only. Data refreshed.","Проект в архиве — только просмотр. Данные обновлены."],
  gPending: ["По проєкту вже є звіт на погодженні від {date} — новий можна подати після рішення PMO.","This project already has a report awaiting approval from {date} — submit a new one after the PMO decision.","По проекту уже есть отчёт на согласовании от {date} — новый можно подать после решения PMO."],
  // #62: дата подання — сегодня; раньше погодженого она бывает, только если у того дата в будущем (введена вручную до #62) — PM сам не исправит
  gOldDate: ["Останній погоджений звіт датований {date} — пізніше за сьогодні. Новий звіт не застосується, поки не настане ця дата; зверніться до PMO.","The last approved report is dated {date}, later than today. A new report will not apply until that date; contact the PMO.","Последний согласованный отчёт датирован {date} — позже сегодняшнего дня. Новый отчёт не применится, пока не наступит эта дата; обратитесь к PMO."],
  gDecided: ["Звіт уже вирішено ({state}) — можливо, іншим PMO. Дані оновлено.","The report has already been decided ({state}) — possibly by another PMO. Data refreshed.","Отчёт уже решён ({state}) — возможно, другим PMO. Данные обновлены."],
  gNotPmAuthor: ["Автор звіту вже не PM проєкту — такий звіт можна лише повернути.","The report author is no longer the project PM — this report can only be returned.","Автор отчёта уже не PM проекта — такой отчёт можно только вернуть."]
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
