import { Risk } from '../data/types';
import { AiLang } from './aiCheck';
import { AiContextIn, AiContextOut, draftChanged, cleanAll, isApproved, newest, TEXT_CAP } from './aiContext';
import { AP_RETURNED } from './approval';
import { cutText } from './aiReply';
import { riskScore } from './status';
import { formatDmy } from './dates';

/** Гибридная проверка отчёта (план помощника, «Этап 4 — гибридная проверка»): сравнения чисел и дат — кодом портала, а не ИИ
 *  (модель в них ошибается); ИИ получает только смысловые правила (buildCheckContext, copilot/prompts/check.md).
 *  Пункты кода идут первыми в «Суперечності (аналіз ШІ)», затем пункты ИИ. */

const RISK_CLOSED = 'Закрито';
const GREEN = 'Зелений';
/** Не больше записей в одном пункте «термін заходів минув». */
const LIST_MAX = 3;

const W: Record<AiLang, {
  type: Record<string, string>; due: string;
  forecast(f: string, p: string): string; overdue(list: string): string; budget(a: string, b: string): string;
  decision: string; progress(from: string, to: string): string;
}> = {
  uk: {
    type: { 'Ризик': 'Ризик', 'Проблема': 'Проблема' }, due: 'термін',
    forecast: (f, p) => `«Терміни» — зелений, а «Прогноз завершення» ${f} пізніше «Дата завершення (план)» ${p} — змініть оцінку «Терміни» або «Прогноз завершення».`,
    overdue: l => `«Терміни» — зелений, а термін заходів минув: ${l} (реєстр «Ризики та проблеми» в картці) — змініть оцінку «Терміни» або оновіть записи в реєстрі.`,
    budget: (a, b) => `«Бюджет» — зелений, а «Витрати на дату» ${a} більше бюджету проєкту ${b} — змініть оцінку «Бюджет» або «Витрати на дату».`,
    decision: 'Позначено «Потрібне рішення керівництва», але не описано, яке рішення потрібне, — заповніть «Яке рішення потрібне».',
    progress: (from, to) => `«% виконання» зменшено з ${from} до ${to} — перевірте «% виконання» або поясніть зниження в «Проблеми та ризики за період».`
  },
  en: {
    type: { 'Ризик': 'Risk', 'Проблема': 'Issue' }, due: 'due',
    forecast: (f, p) => `«Schedule» is green, but «Forecast completion» ${f} is later than «Planned completion» ${p} — change the «Schedule» rating or «Forecast completion».`,
    overdue: l => `«Schedule» is green, but actions are overdue: ${l} (the «Risks and issues» register in the card) — change the «Schedule» rating or update the records in the register.`,
    budget: (a, b) => `«Budget» is green, but «Cost to date» ${a} exceeds the project budget ${b} — change the «Budget» rating or «Cost to date».`,
    decision: '«Management decision needed» is ticked, but the decision is not described — fill in «Decision required».',
    progress: (from, to) => `«% complete» was reduced from ${from} to ${to} — check «% complete» or explain the decrease in «Issues and risks for the period».`
  },
  ru: {
    type: { 'Ризик': 'Риск', 'Проблема': 'Проблема' }, due: 'срок',
    forecast: (f, p) => `«Сроки» — зелёный, а «Прогноз завершения» ${f} позже «Дата завершения (план)» ${p} — измените оценку «Сроки» или «Прогноз завершения».`,
    overdue: l => `«Сроки» — зелёный, а срок мер истёк: ${l} (реестр «Риски и проблемы» в карточке) — измените оценку «Сроки» или обновите записи в реестре.`,
    budget: (a, b) => `«Бюджет» — зелёный, а «Затраты на дату» ${a} больше бюджета проекта ${b} — измените оценку «Бюджет» или «Затраты на дату».`,
    decision: 'Отмечено «Требуется решение руководства», но не описано, какое решение нужно, — заполните «Какое решение нужно».',
    progress: (from, to) => `«% выполнения» уменьшен с ${from} до ${to} — проверьте «% выполнения» или объясните снижение в «Проблемы и риски за период».`
  }
};

/** Сумма с пробелами между тысячами: 560000 → «560 000». */
const money = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const isNum = (x: unknown): x is number => typeof x === 'number' && !isNaN(x);
const isOpen = (k: Risk): boolean => k.status !== RISK_CLOSED;
const projectRisks = (input: AiContextIn): Risk[] => (input.risks || []).filter(k => k.projectId === input.project.id).sort((a, b) => a.id - b.id);
/** Открытая запись с прошедшим сроком на today. */
export const isOverdue = (k: Risk, today: string): boolean => isOpen(k) && !!k.due && k.due < today;

/** Записи реестра, которые отчёт обязан упомянуть с действием (правило ИИ «Ризики»): открытые высокие риски (оценка от 15),
 *  открытые проблемы и открытые записи с прошедшим сроком. Отбор — кодом; упомянуты ли — решает ИИ (смысл, другие слова). */
export function mustMention(input: AiContextIn): Risk[] {
  return projectRisks(input).filter(k => isOpen(k) && (riskScore(k.probability, k.impact) >= 15 || k.type === 'Проблема' || isOverdue(k, input.today)));
}

/** Пункты проверки, которые находит код (векторы — spfx/test/aiRules.test.ts и весь набор проверок evalCases.json):
 *  1) «Терміни» зелёные, а прогноз позже плана; 2) «Терміни» зелёные, а у открытых записей прошёл срок;
 *  3) «Бюджет» зелёный, а затраты больше бюджета проекта (рост затрат против карточки — норма);
 *  4) «Потрібне рішення» без текста; 5) «% виконання» изменён в этой форме и меньше карточки.
 *  Без формы или форма другого проекта — пунктов нет. */
export function ruleItems(input: AiContextIn): string[] {
  const d = input.draft, p = input.project;
  if (!d || d.projectId !== p.id) return [];
  const w = W[input.lang] || W.uk, out: string[] = [];
  if (d.schedule === GREEN && d.forecastEnd && d.planEnd && d.forecastEnd > d.planEnd) out.push(w.forecast(formatDmy(d.forecastEnd), formatDmy(d.planEnd)));
  const late = projectRisks(input).filter(k => isOverdue(k, input.today));
  if (d.schedule === GREEN && late.length) {
    const names = late.slice(0, LIST_MAX).map(k => `${w.type[k.type] || k.type} «${k.title}» (${w.due} ${formatDmy(k.due)})`);
    out.push(w.overdue(names.join(', ') + (late.length > LIST_MAX ? ', …' : '')));
  }
  if (d.budget === GREEN && isNum(d.actualCost) && isNum(p.budget) && p.budget > 0 && d.actualCost > p.budget) out.push(w.budget(money(d.actualCost), money(p.budget)));
  if (d.decision && !(d.decisionText || '').trim()) out.push(w.decision);
  if (draftChanged(p, d).indexOf('progress') >= 0 && isNum(d.progress) && isNum(p.progress) && d.progress < p.progress) out.push(w.progress(`${p.progress}%`, `${d.progress}%`));
  return out;
}

/** Показатели, изменение которых PM объясняет в «Причина зміни показників» (правило ИИ «Причина»). */
const KEY_CHANGE: Record<string, (x: Record<string, unknown>) => unknown> = { phase: x => x.status, type: x => x.type, start: x => x.start,
  goLive: x => x.goLive, planEnd: x => x.planEnd, forecastEnd: x => x.forecastEnd };

/** Контекст «Перевірки» (векторы — spfx/test/aiRules.test.ts): только то, что нужно смысловым правилам ИИ, — без истории отчётов,
 *  журнала, закрытых и прочих записей реестра:
 *  - plan — «План на наступний період» последнего погодженого отчёта и его запрос решения (decision, decisionText — если был);
 *  - returned — комментарий PMO, если последний отчёт повернутий;
 *  - mention — записи, которые отчёт обязан упомянуть с действием (mustMention);
 *  - draft — оценки, тексты, «Потрібне рішення», «Причина зміни показників» и keyChanges — фаза, тип и даты, изменённые
 *    в этой форме (было → стало);
 *  - prevCheck — прежние пункты ИИ (без пунктов кода).
 *  Длиннее maxChars — длинные тексты (от самого длинного) до 1000 знаков с «…»; не помогло — tooLarge. */
export function buildCheckContext(input: AiContextIn, maxChars: number = 50000): AiContextOut {
  const p = input.project, pid = p.id;
  const reps = (input.reports || []).filter(r => r.projectId === pid).slice().sort(newest);
  const last = reps.filter(isApproved)[0], latest = reps[0];
  const d = input.draft && input.draft.projectId === pid ? input.draft : undefined;
  const pr = p as unknown as Record<string, unknown>, dr = (d || {}) as unknown as Record<string, unknown>;
  const o: Record<string, unknown> = { lang: input.lang, project: { code: p.code, title: p.title } };
  if (last) o.plan = last.decision ? { date: last.date, next: last.next, decision: true, decisionText: last.decisionText } : { date: last.date, next: last.next };
  if (latest && latest.approval === AP_RETURNED) o.returned = { date: latest.date, note: latest.approvalNote };
  o.mention = mustMention(input).map(k => ({ type: k.type, title: k.title, score: riskScore(k.probability, k.impact), due: k.due || '', overdue: isOverdue(k, input.today) }));
  if (d) o.draft = { schedule: d.schedule, budget: d.budget, resources: d.resources, summary: d.title, done: d.done, next: d.next, issues: d.issues,
    decision: !!d.decision, decisionText: d.decisionText, keyReason: d.keyReason,
    keyChanges: draftChanged(p, d).filter(k => !!KEY_CHANGE[k]).map(k => ({ field: k, from: String(KEY_CHANGE[k](pr) ?? ''), to: String(KEY_CHANGE[k](dr) ?? '') })) };
  if (input.prevCheck) o.prevCheck = input.prevCheck;
  const c = cleanAll(o);
  let j = JSON.stringify(c);
  if (j.length <= maxChars) return { json: j, truncated: false, tooLarge: false };
  const slots: { o: Record<string, unknown>; k: string; n: number }[] = [];
  const walk = (x: unknown): void => {
    if (x && typeof x === 'object') Object.keys(x as object).forEach(k => {
      const v = (x as Record<string, unknown>)[k];
      if (typeof v === 'string') { if (v.length > TEXT_CAP) slots.push({ o: x as Record<string, unknown>, k, n: v.length }); } else walk(v);
    });
  };
  walk(c);
  slots.sort((a, b) => b.n - a.n);
  for (const x of slots) {
    x.o[x.k] = cutText(x.o[x.k] as string, TEXT_CAP);
    j = JSON.stringify({ ...c, truncated: true });
    if (j.length <= maxChars) return { json: j, truncated: true, tooLarge: false };
  }
  return { json: JSON.stringify({ ...c, truncated: true, tooLarge: true }), truncated: true, tooLarge: true };
}

/** Пунктов в итоге проверки — не больше: кода до 5, ИИ до 7 (prompt «Перевірка»); при переборе лишние пункты ИИ отбрасываются. */
export const CHECK_ITEMS_MAX = 10;
/** Итог проверки: сначала пункты кода, затем пункты ИИ. */
export const checkItems = (rules: string[], ai: string[]): string[] => rules.concat(ai).slice(0, CHECK_ITEMS_MAX);
