// Сгенерировано tools/guide.mjs из docs/RELEASES.{uk,en,ru}.md — не править вручную.
export interface Release { ver: string; date: string; html: string; }
export const RELEASES: [Release[], Release[], Release[]] = [
 [
  {
   "ver": "1.7.5.3",
   "date": "26.10.2026",
   "html": "<p><b>Виправлено</b></p>\n<ul>\n<li>Зовнішнього учасника (гостя організації) тепер можна додати до команди проєкту, призначити PM, власником чи відповідальним за ризик. Пошук людей пише «Не знайдено», якщо нікого не знайдено, а учасника команди, якого не вибрано зі списку, портал не плутає з порожньою роллю. Для гостей адміністратор має запросити людину до організації й дозволити гостей на сайті.</li>\n</ul>"
  },
  {
   "ver": "1.7.5.2",
   "date": "20.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.5.1",
   "date": "20.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Назва системи: <b>PPM — Управління портфелем проєктів</b> (Project Portfolio Management).</li>\n</ul>"
  },
  {
   "ver": "1.7.5.0",
   "date": "19.10.2026",
   "html": "<p><b>Нове</b></p>\n<ul>\n<li><b>Батьківський проєкт</b> у картці: зв'язок між проєктами (вкладеність будь-яка, не можна обрати сам проєкт і його дочірні). У картці — посилання на батьківський і список <b>Дочірні проєкти</b>; у «Проєктах» — колонка <b>Батьківський проєкт</b>. Зміна — в «Історії змін». Поки лише для зв'язку, далі — аналітика.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.7",
   "date": "18.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>На телефоні меню під аватаром відкривається одразу під ним, а не знизу екрана.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.6",
   "date": "18.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>Технічне оновлення без змін у роботі порталу.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.5",
   "date": "18.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>На телефоні: шапка в один ряд, при прокрутці лишається тільки меню розділів; мова й тема — у меню під аватаром. Вікна фільтра й колонок — знизу, кнопки «Як за замовчуванням» і «Скинути ширини» — угорі вікна (#107). Блок погодження в перегляді звіту більше не налазить на заголовок (#97). Картка звіту в списку: спершу PM, дата й стан (#99). «Відгуки» — картками (#102).</li>\n</ul>\n<p><b>Перевірте повторно</b></p>\n<ul>\n<li>На телефоні: шапка, меню під аватаром, фільтри й колонки у списках, погодження звіту, «Відгуки».</li>\n</ul>"
  },
  {
   "ver": "1.7.4.4",
   "date": "17.10.2026",
   "html": "<p><b>Виправлено</b></p>\n<ul>\n<li>«Детальний огляд системи»: таблиці переносять текст — без прокрутки вбік.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.3",
   "date": "17.10.2026",
   "html": "<p><b>Виправлено</b></p>\n<ul>\n<li>«Помічник ШІ» вмикається з першого разу: вікно входу Microsoft відкривається одразу після «Дозволити»; на телефоні — вхід із переходом на сторінку Microsoft, після повернення увімкнення завершується само. Не вдалося — видно причину (вікно входу заблоковано, вхід не завершено, помилка ШІ з кодом); на тестовому сайті збій записується у «Відгуки».</li>\n</ul>\n<p><b>Змінено</b></p>\n<ul>\n<li>«Помічник ШІ» зберігається для вас, а не для браузера: увімкнули на телефоні — увімкнено й на комп'ютері.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.2",
   "date": "17.10.2026",
   "html": "<p><b>Нове</b></p>\n<ul>\n<li>Кнопка <b>↻ «Оновити дані»</b> над списками (поруч із «CSV») — свіжі дані без перезаходу на сторінку, зручно на телефоні (#103).</li>\n</ul>\n<p><b>Змінено</b></p>\n<ul>\n<li>«Що змінилося»: угорі — поточна версія; технічні оновлення підряд зібрані в один згорнутий блок; кожен випуск зі змінами розгортається натисканням на заголовок, розділи «Нове / Змінено / Виправлено» виділені (#95).</li>\n<li>Картка проєкту: «Мета та опис» обов'язкове при збереженні PM (і в раніше створених проєктах — при наступному збереженні) (#96).</li>\n<li>Картка проєкту: «Пріоритет» — у «Основне», поруч із напрямом, з підказкою, чим пріоритет відрізняється від типу; у «Довідці» — визначення (#105).</li>\n<li>Перегляд статус-звіту: під заголовком — відповідальний PM (#98).</li>\n<li>Пошук SharePoint у сірій смузі прихований: на телефоні він збільшував сторінку (#106).</li>\n</ul>\n<p><b>Виправлено</b></p>\n<ul>\n<li>Відгук надсилається з першого разу: при збої зв'язку портал повторює запит сам, повторне «Надіслати» не створює дубль; надісланий відгук одразу видно в списку (#108, #103).</li>\n</ul>"
  },
  {
   "ver": "1.7.4.1",
   "date": "14.10.2026",
   "html": "<p><b>Змінено</b></p>\n<ul>\n<li>«Детальний огляд системи» в «Довідці»: новий розділ «Помічник ШІ (пілот)», безпека даних і стан робіт — з урахуванням помічника.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.0",
   "date": "14.10.2026",
   "html": "<p><b>Нове</b></p>\n<ul>\n<li>Помічник ШІ для учасників пілоту: перемикач «Помічник ШІ» в меню аватара (згода — один раз, при ввімкненні); у формі статус-звіту — «Заповнити з ШІ» (чернетка, «Що не забути», пропоновані оцінки) і «Перевірити з ШІ» (суперечності між звітом і даними проєкту); поле «Суперечності (аналіз ШІ)» видно у звіті й під час погодження. Докладно — «Довідка», розділ «Помічник ШІ (пілот)».</li>\n</ul>"
  },
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
   "ver": "1.7.5.3",
   "date": "26.10.2026",
   "html": "<p><b>Fixed</b></p>\n<ul>\n<li>An external participant (a guest of the organization) can now be added to the project team or assigned as PM, owner or risk owner. The people search shows «Not found» when nobody matches, and a team member not selected from the list is no longer reported as a missing role. For guests, the administrator must invite the person to the organization and allow guests on the site.</li>\n</ul>"
  },
  {
   "ver": "1.7.5.2",
   "date": "20.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.5.1",
   "date": "20.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>System name: <b>PPM — Project Portfolio Management</b>.</li>\n</ul>"
  },
  {
   "ver": "1.7.5.0",
   "date": "19.10.2026",
   "html": "<p><b>New</b></p>\n<ul>\n<li><b>Parent project</b> on the card: a link between projects (any nesting; the project itself and its children cannot be chosen). The card shows a link to the parent and a <b>Child projects</b> list; «Projects» has a <b>Parent project</b> column. Changes appear in «Change history». For linking only for now, analytics later.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.7",
   "date": "18.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>On a phone the avatar menu opens right under it, not at the bottom of the screen.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.6",
   "date": "18.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>Technical update with no changes to how the portal works.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.5",
   "date": "18.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>On a phone: a single-row header, only the section menu stays when scrolling; language and theme — in the menu under the avatar. Filter and column windows open at the bottom, with «Default» and «Reset widths» at the top of the window (#107). The approval block in the report view no longer overlaps the title (#97). A report card in the list shows the PM, date and health first (#99). «Feedback» — as cards (#102).</li>\n</ul>\n<p><b>Please re-check</b></p>\n<ul>\n<li>On a phone: the header, the avatar menu, filters and columns in lists, report approval, «Feedback».</li>\n</ul>"
  },
  {
   "ver": "1.7.4.4",
   "date": "17.10.2026",
   "html": "<p><b>Fixed</b></p>\n<ul>\n<li>«Detailed system overview»: tables wrap text — no sideways scrolling.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.3",
   "date": "17.10.2026",
   "html": "<p><b>Fixed</b></p>\n<ul>\n<li>«AI assistant» turns on the first time: the Microsoft sign-in window opens right after «Allow»; on a phone, sign-in goes to the Microsoft page and back, and turning on finishes by itself. If it fails, the reason is shown (sign-in window blocked, sign-in not completed, AI error with a code); on the test site the failure is recorded in «Feedback».</li>\n</ul>\n<p><b>Changed</b></p>\n<ul>\n<li>«AI assistant» is kept for you, not for the browser: turned on on your phone — it is on on your computer too.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.2",
   "date": "17.10.2026",
   "html": "<p><b>New</b></p>\n<ul>\n<li>The <b>↻ «Refresh data»</b> button above lists (next to «CSV») — fresh data without reopening the page, handy on a phone (#103).</li>\n</ul>\n<p><b>Changed</b></p>\n<ul>\n<li>«What's new»: the current version at the top; consecutive technical updates are collected in one collapsed block; each release with changes expands by tapping its title, the «New / Changed / Fixed» sections are highlighted (#95).</li>\n<li>Project card: «Goal and description» is required when the PM saves the card (including projects created earlier — at the next save) (#96).</li>\n<li>Project card: «Priority» is in «General», next to the department, with a hint on how priority differs from type; definitions in «Help» (#105).</li>\n<li>Status report view: the responsible PM under the title (#98).</li>\n<li>The SharePoint search in the grey bar is hidden: on a phone it zoomed the page (#106).</li>\n</ul>\n<p><b>Fixed</b></p>\n<ul>\n<li>Feedback is sent on the first try: on a connection failure the portal retries itself, pressing «Send» again does not create a duplicate; sent feedback is visible in the list right away (#108, #103).</li>\n</ul>"
  },
  {
   "ver": "1.7.4.1",
   "date": "14.10.2026",
   "html": "<p><b>Changed</b></p>\n<ul>\n<li>«Detailed system overview» in «Help»: a new «AI assistant (pilot)» section; data security and project status now cover the assistant.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.0",
   "date": "14.10.2026",
   "html": "<p><b>New</b></p>\n<ul>\n<li>AI assistant for pilot participants: the «AI assistant» switch in the avatar menu (consent once, when turning it on); in the status report form — «Fill with AI» (draft, «Don't forget», suggested ratings) and «Check with AI» (contradictions between the report and project data); the «Contradictions (AI analysis)» field is visible in the report and during approval. Details — «Help», section «AI assistant (pilot)».</li>\n</ul>"
  },
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
   "ver": "1.7.5.3",
   "date": "26.10.2026",
   "html": "<p><b>Исправлено</b></p>\n<ul>\n<li>Внешнего участника (гостя организации) теперь можно добавить в команду проекта, назначить PM, владельцем или ответственным за риск. Поиск людей пишет «Не найдено», если никого не нашлось, а участника команды, не выбранного из списка, портал не путает с пустой ролью. Для гостей администратор должен пригласить человека в организацию и разрешить гостей на сайте.</li>\n</ul>"
  },
  {
   "ver": "1.7.5.2",
   "date": "20.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.5.1",
   "date": "20.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Название системы: <b>PPM — Управление портфелем проектов</b> (Project Portfolio Management).</li>\n</ul>"
  },
  {
   "ver": "1.7.5.0",
   "date": "19.10.2026",
   "html": "<p><b>Новое</b></p>\n<ul>\n<li><b>Родительский проект</b> в карточке: связь между проектами (вложенность любая, нельзя выбрать сам проект и его дочерние). В карточке — ссылка на родительский и список <b>Дочерние проекты</b>; в «Проектах» — колонка <b>Родительский проект</b>. Изменение — в «Истории изменений». Пока только для связи, дальше — аналитика.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.7",
   "date": "18.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>На телефоне меню под аватаром открывается сразу под ним, а не внизу экрана.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.6",
   "date": "18.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>Техническое обновление без изменений в работе портала.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.5",
   "date": "18.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>На телефоне: шапка в один ряд, при прокрутке остаётся только меню разделов; язык и тема — в меню под аватаром. Окна фильтра и колонок — снизу, кнопки «Как по умолчанию» и «Сбросить ширины» — вверху окна (#107). Блок согласования в просмотре отчёта больше не наезжает на заголовок (#97). Карточка отчёта в списке: сначала PM, дата и состояние (#99). «Отзывы» — карточками (#102).</li>\n</ul>\n<p><b>Проверьте повторно</b></p>\n<ul>\n<li>На телефоне: шапка, меню под аватаром, фильтры и колонки в списках, согласование отчёта, «Отзывы».</li>\n</ul>"
  },
  {
   "ver": "1.7.4.4",
   "date": "17.10.2026",
   "html": "<p><b>Исправлено</b></p>\n<ul>\n<li>«Подробный обзор системы»: таблицы переносят текст — без прокрутки вбок.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.3",
   "date": "17.10.2026",
   "html": "<p><b>Исправлено</b></p>\n<ul>\n<li>«Помощник ИИ» включается с первого раза: окно входа Microsoft открывается сразу после «Разрешить»; на телефоне — вход с переходом на страницу Microsoft, после возврата включение завершается само. Не удалось — видна причина (окно входа заблокировано, вход не завершён, ошибка ИИ с кодом); на тестовом сайте сбой записывается в «Отзывы».</li>\n</ul>\n<p><b>Изменено</b></p>\n<ul>\n<li>«Помощник ИИ» хранится для вас, а не для браузера: включили на телефоне — включено и на компьютере.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.2",
   "date": "17.10.2026",
   "html": "<p><b>Новое</b></p>\n<ul>\n<li>Кнопка <b>↻ «Обновить данные»</b> над списками (рядом с «CSV») — свежие данные без перезахода на страницу, удобно на телефоне (#103).</li>\n</ul>\n<p><b>Изменено</b></p>\n<ul>\n<li>«Что изменилось»: вверху — текущая версия; технические обновления подряд собраны в один свёрнутый блок; каждый выпуск с изменениями раскрывается нажатием на заголовок, разделы «Новое / Изменено / Исправлено» выделены (#95).</li>\n<li>Карточка проекта: «Цель и описание» обязательно при сохранении PM (и в ранее созданных проектах — при следующем сохранении) (#96).</li>\n<li>Карточка проекта: «Приоритет» — в «Основное», рядом с направлением, с подсказкой, чем приоритет отличается от типа; в «Справке» — определения (#105).</li>\n<li>Просмотр статус-отчёта: под заголовком — ответственный PM (#98).</li>\n<li>Поиск SharePoint в серой полосе скрыт: на телефоне он увеличивал страницу (#106).</li>\n</ul>\n<p><b>Исправлено</b></p>\n<ul>\n<li>Отзыв отправляется с первого раза: при сбое связи портал повторяет запрос сам, повторное «Отправить» не создаёт дубль; отправленный отзыв сразу виден в списке (#108, #103).</li>\n</ul>"
  },
  {
   "ver": "1.7.4.1",
   "date": "14.10.2026",
   "html": "<p><b>Изменено</b></p>\n<ul>\n<li>«Подробный обзор системы» в «Справке»: новый раздел «Помощник ИИ (пилот)», безопасность данных и состояние работ — с учётом помощника.</li>\n</ul>"
  },
  {
   "ver": "1.7.4.0",
   "date": "14.10.2026",
   "html": "<p><b>Новое</b></p>\n<ul>\n<li>Помощник ИИ для участников пилота: переключатель «Помощник ИИ» в меню аватара (согласие — один раз, при включении); в форме статус-отчёта — «Заполнить с ИИ» (черновик, «Что не забыть», предлагаемые оценки) и «Проверить с ИИ» (противоречия между отчётом и данными проекта); поле «Противоречия (анализ ИИ)» видно в отчёте и при согласовании. Подробно — «Справка», раздел «Помощник ИИ (пилот)».</li>\n</ul>"
  },
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
