// Переносит словари (T, FLD) и CSS прототипа в приложение. Запуск: npm run extract. Результат коммитится.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../../prototype/pmo-prototype.html'), 'utf8');
// PMO_EXTRACT_OUT — другая папка (тест «прототип не меняет портал» сравнивает результат с файлами приложения)
const out = p => path.join(process.env.PMO_EXTRACT_OUT || path.join(here, '../src/webparts/pmoPortal'), p);

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
  // #90: версия портала и «Що змінилося» (заметки docs/RELEASES.{uk,en,ru}.md)
  // колокольчик: разбор моего отзыва и новый выпуск портала
  // внешний e-mail, которого нет в организации: гостя сначала приглашает администратор Microsoft 365
  errUserNotFound: ['Цієї людини немає в організації. Зовнішнього учасника спершу має запросити адміністратор Microsoft 365 (гостьовий доступ), після цього оберіть його ще раз.', 'This person is not in the organization. An external participant must first be invited by the Microsoft 365 administrator (guest access), then select them again.', 'Этого человека нет в организации. Внешнего участника сначала должен пригласить администратор Microsoft 365 (гостевой доступ), после этого выберите его ещё раз.'],
  errCode: ['Такий код уже є в іншого проєкту. Вкажіть інший або залиште поле порожнім — код призначиться автоматично.', 'This code is already used by another project. Enter another one or leave the field empty to assign it automatically.', 'Такой код уже есть у другого проекта. Укажите другой или оставьте поле пустым — код назначится автоматически.'],
  fbNetErr: ['Немає зв\'язку з сервером — відгук не надіслано. Перевірте інтернет і натисніть «Надіслати» ще раз.', 'No connection to the server — the feedback was not sent. Check the internet and press «Send» again.', 'Нет связи с сервером — отзыв не отправлен. Проверьте интернет и нажмите «Отправить» ещё раз.'],
  aiEnableFail: ['Не вдалося увімкнути ШІ: ', 'Could not turn on AI: ', 'Не удалось включить ИИ: '],
  aiLoginFail: ['вхід Microsoft не завершено', 'Microsoft sign-in was not completed', 'вход Microsoft не завершён'],
  aiSignInAgain: ['потрібно увійти до Microsoft — натисніть ще раз', 'Microsoft sign-in is needed — press again', 'нужно войти в Microsoft — нажмите ещё раз'],
  aiCode: ['код', 'code', 'код'],
  aiSignInNeed: ['Щоб користуватися ШІ на цьому пристрої, увійдіть до Microsoft. Введені дані форми не збережуться.', 'To use AI on this device, sign in to Microsoft. Data entered in the form will not be kept.', 'Чтобы пользоваться ИИ на этом устройстве, войдите в Microsoft. Введённые в форму данные не сохранятся.'],
  aiSignIn: ['Увійти', 'Sign in', 'Войти'],
  fbNetErrPart: ['Відгук надіслано, але не всі скриншоти завантажилися. Натисніть «Надіслати» ще раз — догрузяться лише відсутні.', 'The feedback was sent, but not all screenshots were uploaded. Press «Send» again — only the missing ones will be uploaded.', 'Отзыв отправлен, но не все скриншоты загрузились. Нажмите «Отправить» ещё раз — догрузятся только недостающие.'],
  fbAll: ['Усі відгуки учасників (для PMO)', 'All participants’ feedback (PMO)', 'Все отзывы участников (для PMO)'],
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
