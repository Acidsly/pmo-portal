// Сгенерировано tools/guide.mjs из docs/RELEASES.{uk,en,ru}.md — не править вручную.
export interface Release { ver: string; date: string; html: string; }
export const RELEASES: [Release[], Release[], Release[]] = [
 [
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
