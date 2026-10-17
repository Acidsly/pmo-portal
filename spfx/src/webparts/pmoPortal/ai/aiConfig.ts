/** Помощник отчёта (пилот): подключение к агенту Copilot Studio «PPM Report helper». Не секреты — по ним агента можно
 *  найти, но вызвать может только вошедший пользователь (Entra ID). План — docs/superpowers/plans/2026-10-12-copilot-report-assistant.md. */
export const AI_CONFIG = {
  /** Окружение Power Platform «PPM Copilot» (Europe). */
  environmentId: '080c2e69-dd53-e56d-b5aa-febee943ab4b',
  /** Схемное имя агента. */
  schemaName: 'crb3f_PPMReportHelper',
  /** Тенант и регистрация SPA «PPM Copilot Client» — заполняются после блока 4 (регистрация приложения). */
  tenantId: 'faa553e4-cc39-45f2-8dc6-ce0ae64d968b',
  clientId: '8ed067c1-2748-47f9-9d55-1c566ff1d68b',
  /** Пилотная группа — только удобство (кнопки не показываются остальным); настоящая защита — доступ к агенту. */
  pilot: ['j.pochobut@eclectic.group', 'd.dovhobrod@smart-hr.com.ua', 's.dudchenko@smart-hr.com.ua', 'd.dvoretska@smart-hr.com.ua',
    'test.kovalenko@smarthr.kz', 'test.burbega@fillin.kz']
};

/** Пилотный ли пользователь (e-mail без учёта регистра). */
export const isAiPilot = (email: string): boolean => AI_CONFIG.pilot.indexOf((email || '').trim().toLowerCase()) >= 0;

/** Страница — ответ входа Microsoft во всплывающем окне или скрытом фрейме (MSAL): в адресе code / error и state. */
export const isAuthResponse = (hash: string, search: string): boolean =>
  /(^|[#&?])(code|error)=/.test(hash + '&' + search) && /(^|[#&?])state=/.test(hash + '&' + search);

/** Адрес возврата входа MSAL — всегда страница портала сайта (`…/SitePages/Portal.aspx`), а не текущий адрес: сайт открывают
 *  и с корня (`/sites/pmo-test`), а в регистрации SPA «PPM Copilot Client» указана только страница портала (иначе AADSTS50011). */
export const aiRedirectUri = (origin: string, pathname: string): string =>
  origin + pathname.replace(/\/SitePages\/.*$/i, '').replace(/\/+$/, '') + '/SitePages/Portal.aspx';

/** Адрес возврата входа с переходом на страницу (телефон) — в sessionStorage, пока идёт вход: по нему страница Portal.aspx
 *  с ответом Microsoft отличает возврат в эту же вкладку от всплывающего окна. */
export const AI_RETURN_KEY = 'pmo-ai-return';
/** Идёт вход с переходом на страницу (sessionStorage — только эта вкладка). */
export const aiRedirecting = (): boolean => { try { return sessionStorage.getItem(AI_RETURN_KEY) !== null; } catch { return false; } };
