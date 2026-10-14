import { ReportDraft } from './forms';

/** Язык интерфейса — на нём агент отвечает и пишется поле «Суперечності (аналіз ШІ)». */
export type AiLang = 'uk' | 'en' | 'ru';
/** Язык интерфейса (номер: 0 — UA, 1 — EN, 2 — RU) — код языка ответа ИИ; неизвестный — uk. */
export const aiLangOf = (l: number | undefined): AiLang => ((['uk', 'en', 'ru'] as AiLang[])[l || 0] || 'uk');
/** Почему проверка ИИ не выполнена (план помощника, 2.2; этап 4): кончились кредиты, ошибка, нет ответа 60 с, нет доступа к агенту,
 *  данных для ИИ слишком много (контекст tooLarge), PM не дал согласие на обработку данных. */
export type AiUnavailable = 'credits' | 'error' | 'timeout' | 'denied' | 'tooLarge' | 'declined';
/** Кнопка внизу формы отчёта: «Зберегти», «Перевірити з ШІ», «ШІ аналізує…», «Зберегти без перевірки». */
export type AiButton = 'save' | 'check' | 'busy' | 'saveWithout';

/** Отпечаток формы отчёта (план помощника, 2.2; векторы tests/cases/ai-check.json): проект, оценки, ключевые показатели,
 *  «Причина зміни показників», тексты, резюме, запрос решения. Тексты — без пробелов по краям.
 *  Пробелы внутри текстов значимы. Не входят: дата подання и период (вычисляются), состояние интерфейса и само поле ИИ. */
export function reportPrint(d: ReportDraft): string {
  const t = (s: string | undefined | null): string => String(s === undefined || s === null ? '' : s).trim();
  const n = (x: number | undefined | null): string => (x === undefined || x === null ? '' : String(x));
  return JSON.stringify([n(d.projectId), t(d.schedule), t(d.budget), t(d.resources), t(d.status), t(d.type), n(d.progress), t(d.start), t(d.goLive),
    t(d.planEnd), t(d.forecastEnd), t(d.actualEnd), n(d.actualCost), t(d.keyReason), t(d.done), t(d.next), t(d.issues), t(d.title),
    d.decision ? '1' : '0', t(d.decisionText)]);
}

/** Какая кнопка показана: вне пилота — «Зберегти», как сейчас; идёт проверка — «ШІ аналізує…» (повторно не нажать);
 *  ИИ недоступен — «Зберегти без перевірки»; форма не менялась после проверки — «Зберегти»; иначе — «Перевірити з ШІ».
 *  Обычные проверки формы (reportErrors) и плашка «звіт уже на погодженні» — до этого, у вызывающего. */
export function aiButton(s: { pilot: boolean; checkedPrint: string | null; currentPrint: string; busy: boolean; unavailable: boolean }): AiButton {
  if (!s.pilot) return 'save';
  if (s.busy) return 'busy';
  if (s.unavailable) return 'saveWithout';
  return s.checkedPrint !== null && s.checkedPrint === s.currentPrint ? 'save' : 'check';
}

/** Ответ ИИ принимается, только если форма не менялась с момента запроса (опоздавший ответ отбрасывается); отпечаток
 *  включает проект — ответ по прежнему проекту после смены проекта в форме тоже отбрасывается. Та же проверка — для ответов
 *  и «Перевірити з ШІ», и «Заповнити з ШІ» (вставлять тексты в форму, изменённую после запроса, нельзя). */
export const acceptReply = (requestPrint: string, currentPrint: string): boolean => requestPrint === currentPrint;

const UNAVAILABLE: Record<AiLang, { head: string } & Record<AiUnavailable, string>> = {
  uk: { head: 'Перевірку ШІ не виконано: ', credits: 'вичерпано ліміт ШІ', error: 'помилка сервісу ШІ', timeout: 'ШІ не відповів за 60 с',
    denied: 'немає доступу до помічника ШІ', tooLarge: 'забагато даних для ШІ', declined: 'немає дозволу на обробку даних ШІ' },
  en: { head: 'AI check not performed: ', credits: 'AI credit limit reached', error: 'AI service error', timeout: 'no AI response within 60 s',
    denied: 'no access to the AI assistant', tooLarge: 'too much data for AI', declined: 'no consent to AI data processing' },
  ru: { head: 'Проверка ИИ не выполнена: ', credits: 'исчерпан лимит ИИ', error: 'ошибка сервиса ИИ', timeout: 'ИИ не ответил за 60 с',
    denied: 'нет доступа к помощнику ИИ', tooLarge: 'слишком много данных для ИИ', declined: 'нет согласия на обработку данных ИИ' }
};
/** Начала текста «ИИ не выполнен» на всех языках — по ним просмотр отличает «без проверки» (aiView). */
export const UNAVAILABLE_HEADS: string[] = Object.keys(UNAVAILABLE).map(k => UNAVAILABLE[k as AiLang].head);
/** Текст поля «Суперечності (аналіз ШІ)» при «Зберегти без перевірки» — PMO видит причину. Неизвестный язык — украинский. */
export function unavailableNote(reason: AiUnavailable, lang: AiLang): string {
  const d = UNAVAILABLE[lang] || UNAVAILABLE.uk;
  return d.head + (d[reason] || d.error);
}
