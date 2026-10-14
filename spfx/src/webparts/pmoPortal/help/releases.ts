// Сгенерировано tools/guide.mjs из docs/RELEASES.{uk,en,ru}.md — не править вручную.
export interface Release { ver: string; date: string; html: string; }
export const RELEASES: [Release[], Release[], Release[]] = [
 [
  {
   "ver": "1.7.3.13",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Позначки погодження («На погодженні», «Погоджено», «Повернуто») — знову одним рядком.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.12",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Таблиці «Проєкти», «Статус-звіти», «Ризики» й «Архів» вміщуються у вікно без горизонтальної прокрутки: сторінка ширша (до 1440 px), довгі заголовки й позначки переносяться, фільтр колонок-оцінок — під назвою, якщо місця мало.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.11",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.7",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Кнопки «Прийняти» й «Показати запис» у підказках помічника ШІ виділено рамкою.</li>\n<li>Ім'я в колонках «PM» і «Автор» більше не розривається посеред слова на третій рядок.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.1",
   "date": "14.10.2026",
   "html": "<p><b>Нове</b></p>\n<ul>\n<li>«Копіювати ризик» / «Копіювати проблему» у збереженому записі: відкривається новий запис з усіма полями — змініть потрібне й збережіть, а вихідний запис закрийте (#92).</li>\n<li>PMO отримує в дзвіночку нові високі ризики (від 15) і всі проблеми, а також зміну їх статусу (#87).</li>\n</ul>\n<p><b>Змінено</b></p>\n<ul>\n<li>Ризик: «Стратегія реагування», «Заходи для зниження ризику» і «План дій у разі настання» — обов'язкові за будь-якої оцінки; проблема — опис і заходи. Обов'язкові поля позначені *, пояснення — біля поля (#91, #88).</li>\n<li>Збережений ризик чи проблема змінюється лише статусом; інші поля — через «Копіювати» (#92).</li>\n<li>У формі нового запису — як опрацьовуються ризики: не погоджуються, PMO бачить їх у сповіщеннях, зворотний зв'язок — коментарем у картці (#87).</li>\n<li>«Детальний огляд системи» в «Довідці»: розділи про ризики й сповіщення — за рішеннями щодо ризиків.</li>\n</ul>\n<p><b>Перевірте повторно</b></p>\n<ul>\n<li>Новий ризик без стратегії, заходів чи плану дій — помилки біля полів; нова проблема — лише опис і заходи.</li>\n<li>Збережений ризик: змінюється лише «Статус»; «Копіювати ризик» — новий запис з усіма полями.</li>\n<li>PMO: через ~15 хвилин після нового високого ризику чи проблеми від PM і зміни їх статусу — подія в дзвіночку.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.31",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.30",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.29",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.28",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.27",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.26",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.25",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.24",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.23",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.22",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.21",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.20",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.19",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.18",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.17",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.16",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.15",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.14",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.13",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.12",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.11",
   "date": "13.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Підказка до кольорової крапки свіжості звіту: жовтий — 9–14 днів (було «8–14»), як і рахує портал.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.10",
   "date": "12.10.2026",
   "html": "<p><b>Нове</b></p>\n<ul>\n<li>Сповіщення «Вас додано до команди проєкту» з вашою роллю, а також про зміну вашої ролі в команді (#84).</li>\n<li>Довгі таблиці прокручуються у своєму вікні: заголовки колонок закріплені, горизонтальна смуга прокрутки завжди видна внизу таблиці (#89).</li>\n<li>Номер версії порталу й «Що змінилося» — у «Довідці» (кнопка <b>?</b>) (#90); про новий випуск повідомляє дзвіночок.</li>\n<li>Дзвіночок: «Відгук розглянуто» — коли змінився статус або відповідь на ваш відгук.</li>\n<li>У картці проєкту — три останні статус-звіти й «Показати всі звіти (N)» (#82).</li>\n</ul>\n<p><b>Змінено</b></p>\n<ul>\n<li>Колонка «Звіт»: мітка погодження й дата — один блок, дата окремим рядком; підказка «Подано … · автор» (#85).</li>\n<li>Поле звіту «Проблеми та ризики» → «Проблеми та ризики за період», з підказкою, де реєстр ризиків (#81).</li>\n<li>«Термін виконання заходів» ризику: для нового запису — не раніше сьогодні, при зміні — не раніше дати реєстрації; прострочений позначається «Термін минув» (#88).</li>\n<li>Меню без порожнього місця після «Відгуки»; у формі проєкту — права учасникам з'являються протягом ~15 хвилин (#83).</li>\n</ul>\n<p><b>Перевірте повторно</b></p>\n<ul>\n<li>Додайте учасника до команди проєкту — через ~15 хвилин у нього в дзвіночку «Вас додано до команди».</li>\n<li>Форма ризику: термін раніше сьогодні (новий запис) — помилка біля поля.</li>\n<li>Довгі списки: заголовки колонок і горизонтальна смуга прокрутки лишаються видимими.</li>\n<li>Дзвіночок: «Новий випуск порталу» відкриває «Що змінилося»; автор відгуку отримує «Відгук розглянуто» після зміни статусу чи відповіді.</li>\n<li>Картка проєкту: три останні звіти й «Показати всі звіти (N)»; колонка «Звіт» — підказка «Подано … · автор».</li>\n</ul>"
  },
  {
   "ver": "1.7.2.1",
   "date": "08.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Дата подання звіту — день збереження, період рахується сам (#62, #69).</li>\n<li>Перевірки форми звіту: фактичне завершення, опис потрібного рішення (#64, #67, #68).</li>\n<li>«Статус» проєкту → «Фаза проєкту»; фаза й тип записуються в кожен звіт (#77, #78).</li>\n<li>Колонка «Звіт» — погодження найновішого звіту, фільтр за погодженням (#73); «Мета та опис» — до 10 рядків (#71); кнопки на телефоні (#72).</li>\n</ul>"
  },
  {
   "ver": "1.7.1",
   "date": "08.10.2026",
   "html": "<p><b>Нове</b></p>\n<ul>\n<li>Сповіщення: дзвіночок із числом нових подій ваших проєктів, «Позначити все прочитаним».</li>\n<li>Архів за фазами «Завершено» / «Скасовано», представлення «Завершені» / «Скасовані».</li>\n<li>Значки розділів у меню, кольорова мітка в кожному бічному вікні.</li>\n</ul>"
  },
  {
   "ver": "1.7.0",
   "date": "04.10.2026",
   "html": "<p><b>Нове</b></p>\n<ul>\n<li>«Призначення»: PM і власника змінює лише PMO (#43).</li>\n<li>Форма ризику: спершу тип, потім опис (#47, #55); дата завершення (факт) (#54).</li>\n<li>Синхронізація працює в Azure Automation.</li>\n</ul>"
  }
 ],
 [
  {
   "ver": "1.7.3.13",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Approval badges («Awaiting approval», «Approved», «Returned») are on one line again; «Returned for rework» is now «Returned».</li>\n</ul>"
  },
  {
   "ver": "1.7.3.12",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>The «Projects», «Status reports», «Risks» and «Archive» tables fit the window without horizontal scrolling: the page is wider (up to 1440 px), long headers and badges wrap, the rating columns' filter goes under the title when space is short.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.11",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.7",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>The «Accept» and «Show record» buttons in the AI assistant hints are now outlined.</li>\n<li>Names in the «PM» and «Author» columns no longer break mid-word onto a third line.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.1",
   "date": "14.10.2026",
   "html": "<p><b>New</b></p>\n<ul>\n<li>\"Copy risk\" / \"Copy issue\" in a saved record: a new record opens with all fields — change what you need and save, then close the original (#92).</li>\n<li>The PMO gets new high risks (15+) and all issues, and their status changes, in the bell (#87).</li>\n</ul>\n<p><b>Changed</b></p>\n<ul>\n<li>Risk: \"Response strategy\", \"Risk reduction actions\" and \"Contingency plan\" are required at any score; issue — description and actions. Required fields are marked *, the explanation is next to the field (#91, #88).</li>\n<li>A saved risk or issue can only change its status; other fields — via \"Copy\" (#92).</li>\n<li>The new record form explains how risks are handled: they are not approved, the PMO sees them in notifications, feedback is a comment in the card (#87).</li>\n<li>\"Detailed system overview\" in Help: the risks and notifications sections follow the risk decisions.</li>\n</ul>\n<p><b>Check again</b></p>\n<ul>\n<li>A new risk without strategy, actions or contingency plan — errors next to the fields; a new issue — only description and actions.</li>\n<li>A saved risk: only \"Status\" can be changed; \"Copy risk\" opens a new record with all fields.</li>\n<li>PMO: about 15 minutes after a new high risk or issue from a PM, or its status change — an event in the bell.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.31",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.30",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.29",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.28",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.27",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.26",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.25",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.24",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.23",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.22",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.21",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.20",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.19",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.18",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.17",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.16",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.15",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.14",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.13",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.12",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.11",
   "date": "13.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>The report freshness dot tooltip: yellow — 9–14 days (was \"8–14\"), as the portal calculates it.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.10",
   "date": "12.10.2026",
   "html": "<p><b>New</b></p>\n<ul>\n<li>Notification \"You were added to the project team\" with your role, and when your role in the team changes (#84).</li>\n<li>Long tables scroll in their own window: column headers stay pinned, the horizontal scroll bar is always visible at the bottom of the table (#89).</li>\n<li>The portal version and \"What's new\" are in Help (the <b>?</b> button) (#90); the bell announces a new release.</li>\n<li>Bell: \"Feedback reviewed\" — when the status of or answer to your feedback changes.</li>\n<li>The project card shows the three latest status reports and \"Show all reports (N)\" (#82).</li>\n</ul>\n<p><b>Changed</b></p>\n<ul>\n<li>\"Report\" column: the approval label and the date form one block, the date on its own line; tooltip \"Submitted … · author\" (#85).</li>\n<li>The report field \"Issues and risks\" → \"Issues and risks for the period\", with a hint where the risk register is (#81).</li>\n<li>Risk \"Mitigation due date\": for a new record — not earlier than today, when changed — not earlier than the registration date; an overdue one is marked \"The due date has passed\" (#88).</li>\n<li>No empty space in the menu after \"Feedback\"; the project form says team members get access within ~15 minutes (#83).</li>\n</ul>\n<p><b>Re-check</b></p>\n<ul>\n<li>Add a member to a project team — within ~15 minutes their bell shows \"You were added to the team\".</li>\n<li>Risk form: a due date earlier than today (new record) — an error next to the field.</li>\n<li>Long lists: column headers and the horizontal scroll bar stay visible.</li>\n<li>Bell: \"New portal release\" opens \"What's new\"; the feedback author gets \"Feedback reviewed\" after the status or answer changes.</li>\n<li>Project card: the three latest reports and \"Show all reports (N)\"; \"Report\" column — tooltip \"Submitted … · author\".</li>\n</ul>"
  },
  {
   "ver": "1.7.2.1",
   "date": "08.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>The report submission date is the day it is saved, the period is calculated (#62, #69).</li>\n<li>Report form checks: actual completion, description of the decision needed (#64, #67, #68).</li>\n<li>Project \"Status\" → \"Project phase\"; phase and type are written to every report (#77, #78).</li>\n<li>\"Report\" column — approval of the newest report, filter by approval (#73); \"Goal and description\" — up to 10 lines (#71); buttons on the phone (#72).</li>\n</ul>"
  },
  {
   "ver": "1.7.1",
   "date": "08.10.2026",
   "html": "<p><b>New</b></p>\n<ul>\n<li>Notifications: a bell with the number of new events in your projects, \"Mark all as read\".</li>\n<li>Archive by phase \"Completed\" / \"Cancelled\", views \"Completed\" / \"Cancelled\".</li>\n<li>Section icons in the menu, a coloured label in every side window.</li>\n</ul>"
  },
  {
   "ver": "1.7.0",
   "date": "04.10.2026",
   "html": "<p><b>New</b></p>\n<ul>\n<li>\"Assignment\": only PMO changes the PM and the owner (#43).</li>\n<li>Risk form: type first, then description (#47, #55); actual completion date (#54).</li>\n<li>Sync runs in Azure Automation.</li>\n</ul>"
  }
 ],
 [
  {
   "ver": "1.7.3.13",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Плашки согласования («На согласовании», «Согласовано», «Возвращено») — снова одной строкой; «Возвращено на доработку» теперь «Возвращено».</li>\n</ul>"
  },
  {
   "ver": "1.7.3.12",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Таблицы «Проекты», «Статус-отчёты», «Риски» и «Архив» помещаются в окно без горизонтальной прокрутки: страница шире (до 1440 px), длинные заголовки и плашки переносятся, фильтр колонок-оценок — под названием, если места мало.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.11",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.7",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Кнопки «Принять» и «Показать запись» в подсказках помощника ИИ выделены рамкой.</li>\n<li>Имя в колонках «PM» и «Автор» больше не разрывается посреди слова на третью строку.</li>\n</ul>"
  },
  {
   "ver": "1.7.3.1",
   "date": "14.10.2026",
   "html": "<p><b>Новое</b></p>\n<ul>\n<li>«Копировать риск» / «Копировать проблему» в сохранённой записи: открывается новая запись со всеми полями — измените нужное и сохраните, а исходную запись закройте (#92).</li>\n<li>PMO получает в колокольчике новые высокие риски (от 15) и все проблемы, а также смену их статуса (#87).</li>\n</ul>\n<p><b>Изменено</b></p>\n<ul>\n<li>Риск: «Стратегия реагирования», «Меры по снижению риска» и «План действий при наступлении» — обязательны при любой оценке; проблема — описание и меры. Обязательные поля отмечены *, пояснение — у поля (#91, #88).</li>\n<li>Сохранённый риск или проблема меняется только статусом; остальные поля — через «Копировать» (#92).</li>\n<li>В форме новой записи — как обрабатываются риски: не согласуются, PMO видит их в уведомлениях, обратная связь — комментарием в карточке (#87).</li>\n<li>«Подробный обзор системы» в «Справке»: разделы о рисках и уведомлениях — по решениям о рисках.</li>\n</ul>\n<p><b>Проверьте повторно</b></p>\n<ul>\n<li>Новый риск без стратегии, мер или плана действий — ошибки у полей; новая проблема — только описание и меры.</li>\n<li>Сохранённый риск: меняется только «Статус»; «Копировать риск» — новая запись со всеми полями.</li>\n<li>PMO: через ~15 минут после нового высокого риска или проблемы от PM и смены их статуса — событие в колокольчике.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.31",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.30",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.29",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.28",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.27",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.26",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.25",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.24",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.23",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.22",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.21",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.20",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.19",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.18",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.17",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.16",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.15",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.14",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.13",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.12",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.11",
   "date": "13.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Подсказка к цветной точке свежести отчёта: жёлтый — 9–14 дней (было «8–14»), как и считает портал.</li>\n</ul>"
  },
  {
   "ver": "1.7.2.10",
   "date": "12.10.2026",
   "html": "<p><b>Новое</b></p>\n<ul>\n<li>Уведомление «Вас добавили в команду проекта» с вашей ролью, а также об изменении вашей роли в команде (#84).</li>\n<li>Длинные таблицы прокручиваются в своём окне: заголовки колонок закреплены, горизонтальная полоса прокрутки всегда видна внизу таблицы (#89).</li>\n<li>Номер версии портала и «Что изменилось» — в «Справке» (кнопка <b>?</b>) (#90); о новом выпуске сообщает колокольчик.</li>\n<li>Колокольчик: «Отзыв рассмотрен» — когда изменился статус или ответ на ваш отзыв.</li>\n<li>В карточке проекта — три последних статус-отчёта и «Показать все отчёты (N)» (#82).</li>\n</ul>\n<p><b>Изменено</b></p>\n<ul>\n<li>Колонка «Отчёт»: метка согласования и дата — один блок, дата отдельной строкой; подсказка «Подан … · автор» (#85).</li>\n<li>Поле отчёта «Проблемы и риски» → «Проблемы и риски за период», с подсказкой, где реестр рисков (#81).</li>\n<li>«Срок выполнения мер» риска: для новой записи — не раньше сегодня, при изменении — не раньше даты регистрации; просроченный помечается «Срок истёк» (#88).</li>\n<li>Меню без пустого места после «Отзывы»; в форме проекта — права участникам появляются в течение ~15 минут (#83).</li>\n</ul>\n<p><b>Проверьте повторно</b></p>\n<ul>\n<li>Добавьте участника в команду проекта — через ~15 минут у него в колокольчике «Вас добавили в команду».</li>\n<li>Форма риска: срок раньше сегодня (новая запись) — ошибка у поля.</li>\n<li>Длинные списки: заголовки колонок и горизонтальная полоса прокрутки остаются видимыми.</li>\n<li>Колокольчик: «Новый выпуск портала» открывает «Что изменилось»; автор отзыва получает «Отзыв рассмотрен» после смены статуса или ответа.</li>\n<li>Карточка проекта: три последних отчёта и «Показать все отчёты (N)»; колонка «Отчёт» — подсказка «Подан … · автор».</li>\n</ul>"
  },
  {
   "ver": "1.7.2.1",
   "date": "08.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Дата подачи отчёта — день сохранения, период считается сам (#62, #69).</li>\n<li>Проверки формы отчёта: фактическое завершение, описание нужного решения (#64, #67, #68).</li>\n<li>«Статус» проекта → «Фаза проекта»; фаза и тип записываются в каждый отчёт (#77, #78).</li>\n<li>Колонка «Отчёт» — согласование самого нового отчёта, фильтр по согласованию (#73); «Цель и описание» — до 10 строк (#71); кнопки на телефоне (#72).</li>\n</ul>"
  },
  {
   "ver": "1.7.1",
   "date": "08.10.2026",
   "html": "<p><b>Новое</b></p>\n<ul>\n<li>Уведомления: колокольчик с числом новых событий ваших проектов, «Отметить всё прочитанным».</li>\n<li>Архив по фазам «Завершён» / «Отменён», представления «Завершённые» / «Отменённые».</li>\n<li>Значки разделов в меню, цветная метка в каждом боковом окне.</li>\n</ul>"
  },
  {
   "ver": "1.7.0",
   "date": "04.10.2026",
   "html": "<p><b>Новое</b></p>\n<ul>\n<li>«Назначение»: PM и владельца меняет только PMO (#43).</li>\n<li>Форма риска: сначала тип, потом описание (#47, #55); дата завершения (факт) (#54).</li>\n<li>Синхронизация работает в Azure Automation.</li>\n</ul>"
  }
 ]
];
