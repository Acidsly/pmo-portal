/** Помощник отчёта (пилот): подключение к агенту Copilot Studio «PPM Report helper». Не секреты — по ним агента можно
 *  найти, но вызвать может только вошедший пользователь (Entra ID). План — docs/superpowers/plans/2026-10-12-copilot-report-assistant.md. */
export const AI_CONFIG = {
  /** Окружение Power Platform «PPM Copilot» (Europe). */
  environmentId: '080c2e69-dd53-e56d-b5aa-febee943ab4b',
  /** Схемное имя агента. */
  schemaName: 'crb3f_ppmreporthelper_jcO5qZ',
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
