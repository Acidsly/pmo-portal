import { AiContextIn, buildReportContext } from './aiContext';
import { buildCheckContext, ruleItems, checkItems } from './aiRules';
import { parseDraft, parseCheck } from './aiReply';

/** Вид запроса к агенту: «Заповнити з ШІ» (prompt «Чернетка звіту») или «Перевірити з ШІ» (prompt «Перевірка звіту»). */
export type AiKind = 'draft' | 'check';

/** Первое слово сообщения — по нему тема Fallback агента выбирает prompt (copilot/topic-fallback.yaml). */
export const AI_HEAD: Record<AiKind, string> = { draft: 'ЧЕРНЕТКА', check: 'ПЕРЕВІРКА' };

/** Сообщение агенту: первое слово — вид запроса, затем контекст (buildReportContext) между маркерами данных.
 *  Маркеры внутри данных уже вычищены (cleanText), поэтому данные не могут закрыть блок. */
export function aiMessage(kind: AiKind, json: string): string {
  return `${AI_HEAD[kind]}\n<<DATA>>\n${json}\n<</DATA>>`;
}

/** Ожидания случая набора проверок агента (spfx/src/webparts/pmoPortal/ai/evalCases.json, план помощника — раздел 3):
 *  has — каждая группа: в поле есть хотя бы одно из слов; not — слов нет нигде; notIn — слов нет в поле;
 *  ratings — допустимые оценки (null — оценки нет); items — сколько пунктов (проверка) или «Що не забути» (черновик);
 *  noCyr — в поле нет кириллицы (en); noUk — нет букв і ї є ґ (ru). Сравнение — без регистра, апостроф любой. */
export interface EvalExpect {
  has?: { in: string; any: string[] }[];
  not?: string[];
  notIn?: { in: string; any: string[] }[];
  ratings?: { schedule?: (string | null)[]; budget?: (string | null)[]; resources?: (string | null)[] };
  items?: { min?: number; max?: number };
  noCyr?: string[];
  noUk?: string[];
  /** негативный случай: отказ модели принять вход (фильтр Microsoft: AIModelActionBadRequest) — тоже защита, подмена не выполнена */
  blockedOk?: boolean;
}
export interface EvalScore { pass: boolean; fails: string[] }

/** Латинские двойники кириллицы (модель пишет «1C» латиницей) — в кириллицу с обеих сторон сравнения. */
const LOOK: Record<string, string> = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', i: 'і' };
const norm = (s: string): string => (s || '').toLowerCase().replace(/[’ʼ`]/g, "'").replace(/ё/g, 'е').replace(/[aceopxyi]/g, ch => LOOK[ch]);

/** Оценка ответа агента по ожиданиям случая. Ответ сначала разбирается так же строго, как в портале (parseDraft / parseCheck):
 *  не разобрался — случай не пройден. «Чернетка»: несколько пунктов «– » в одной строке (без переводов строки) — не пройден.
 *  Поля: черновик — done, next, issues, summary, remember, reason (причина оценок), all;
 *  проверка — items, all. */
export function scoreReply(kind: AiKind, raw: string, exp: EvalExpect): EvalScore {
  if (/AIModelActionBadRequest/.test(raw || '')) return exp.blockedOk ? { pass: true, fails: ['blocked'] } : { pass: false, fails: ['blocked'] };
  const fails: string[] = [];
  const fields: Record<string, string> = {};
  let count = 0;
  const ratings: Record<string, string | null> = {};
  if (kind === 'draft') {
    const d = parseDraft(raw);
    if (!d.ok) return { pass: false, fails: ['parse:' + d.error] };
    fields.done = d.done; fields.next = d.next; fields.issues = d.issues; fields.summary = d.summary;
    fields.remember = d.remember.join('\n'); fields.reason = d.ratings.reason;
    count = d.remember.length;
    // пункты «– » — каждый с новой строки: несколько пунктов в одной строке — в поле формы слипнутся
    ['done', 'next', 'issues'].forEach(k => { const t = fields[k]; if ((t.match(/– /g) || []).length > 1 && t.indexOf('\n') < 0) fails.push('format:' + k); });
    ratings.schedule = d.ratings.schedule || null; ratings.budget = d.ratings.budget || null; ratings.resources = d.ratings.resources || null;
  } else {
    const c = parseCheck(raw);
    if (!c.ok) return { pass: false, fails: ['parse:' + c.error] };
    fields.items = c.items.join('\n');
    count = c.items.length;
  }
  fields.all = Object.keys(fields).map(k => fields[k]).join('\n');
  const text = (f: string): string => norm(fields[f] === undefined ? '' : fields[f]);

  (exp.has || []).forEach(g => { if (!g.any.some(w => text(g.in).indexOf(norm(w)) >= 0)) fails.push(`has:${g.in}:${g.any.join('|')}`); });
  (exp.not || []).forEach(w => { if (text('all').indexOf(norm(w)) >= 0) fails.push('not:' + w); });
  (exp.notIn || []).forEach(g => g.any.forEach(w => { if (text(g.in).indexOf(norm(w)) >= 0) fails.push(`notIn:${g.in}:${w}`); }));
  const r = exp.ratings || {};
  (['schedule', 'budget', 'resources'] as const).forEach(k => {
    const allowed = r[k];
    if (allowed && allowed.indexOf(ratings[k] === undefined ? null : ratings[k]) < 0) fails.push(`rating:${k}=${ratings[k]}`);
  });
  if (exp.items && exp.items.min !== undefined && count < exp.items.min) fails.push(`items<${exp.items.min}:${count}`);
  if (exp.items && exp.items.max !== undefined && count > exp.items.max) fails.push(`items>${exp.items.max}:${count}`);
  (exp.noCyr || []).forEach(f => { if (/[а-яіїєґ]/i.test(fields[f] || '')) fails.push('cyrillic:' + f); });
  (exp.noUk || []).forEach(f => { if (/[іїєґ]/i.test(fields[f] || '')) fails.push('ukrainian:' + f); });
  return { pass: !fails.length, fails };
}

/** Случай набора проверок: вход — отличия от base (как в tests/cases/ai-context.json); fill — добавить столько низких рисков
 *  с длинными заходами (по chars знаков) перед остальными — проверка, что до модели доходит конец данных. */
export interface EvalCase {
  id: string; kind: AiKind; negative?: boolean; note: string;
  input: { lang?: string; project?: object; reports?: object[]; risks?: object[]; changes?: object[]; draft?: object | null;
    prevCheck?: string; fill?: { risks: number; chars: number } };
  expect: EvalExpect;
}
export interface EvalBase { today: string; project: object; report: object; risk: object; change: object; draft: object }

const EMPTY_TEXTS = { title: '', done: '', next: '', issues: '', keyReason: '', decision: false, decisionText: '' };
/** Вход buildReportContext для случая: записи — base + отличия; форма — черновик: показатели проекта случая и пустые тексты
 *  (так форма открывается для «Заповнити з ШІ», reportFromProject), проверка — base.draft целиком и без журнала (как портал); null — без формы. */
export function evalInput(base: EvalBase, c: EvalCase): AiContextIn {
  const i = c.input;
  const merge = (b: object, xs: object[] | undefined): any[] => (xs || []).map(x => ({ ...b, ...x }));
  const risks = merge(base.risk, i.risks);
  if (i.fill) {
    const pad = 'Щотижнева перевірка стану робіт, звірка з графіком і оновлення плану заходів. '.repeat(Math.ceil(i.fill.chars / 80)).slice(0, i.fill.chars);
    const fillers = Array.from({ length: i.fill.risks }, (_, n) => ({ ...base.risk, id: 100 + n, title: `Дрібний ризик ${n + 1}`,
      probability: 1, impact: 2, due: '2027-03-01', mitigation: pad, contingency: '' }));
    risks.unshift(...fillers);
  }
  const project: any = { ...base.project, ...(i.project || {}) };
  const fromProject = { status: project.status, type: project.type, progress: project.progress, start: project.start, goLive: project.goLive,
    planEnd: project.planEnd, forecastEnd: project.forecastEnd, actualCost: project.actualCost, actualEnd: project.actualEnd || '' };
  const draft = i.draft === null ? undefined : { ...base.draft, ...(c.kind === 'draft' ? { ...fromProject, ...EMPTY_TEXTS } : {}), ...(i.draft || {}) };
  return { project, reports: merge(base.report, i.reports), risks: risks as any,
    changes: c.kind === 'check' ? [] : merge(base.change, i.changes), draft: draft as any, prevCheck: i.prevCheck, lang: (i.lang || 'uk') as any, today: base.today };
}

export interface EvalResult { id: string; kind: AiKind; negative: boolean; pass: boolean; fails: string[]; ms: number; raw: string }
/** Итог набора: черновик и проверка — пройдено из всего (без негативных), негативные — отдельно; порог плана — 14 из 15 на
 *  каждый prompt и все негативные. */
export function evalSummary(rs: EvalResult[]): { draft: [number, number]; check: [number, number]; negative: [number, number]; ok: boolean } {
  const cnt = (xs: EvalResult[]): [number, number] => [xs.filter(x => x.pass).length, xs.length];
  const draft = cnt(rs.filter(x => x.kind === 'draft' && !x.negative)), check = cnt(rs.filter(x => x.kind === 'check' && !x.negative));
  const negative = cnt(rs.filter(x => x.negative));
  const okOf = (x: [number, number]): boolean => x[1] > 0 && x[0] >= Math.ceil(x[1] * 14 / 15);
  return { draft, check, negative, ok: okOf(draft) && okOf(check) && negative[0] === negative[1] };
}

/** Сообщение агенту для случая — как в портале: «Чернетка» — полный контекст, «Перевірка» — контекст смысловых правил. */
export function evalMessage(base: EvalBase, c: EvalCase): string {
  const i = evalInput(base, c);
  return aiMessage(c.kind, (c.kind === 'check' ? buildCheckContext(i) : buildReportContext(i)).json);
}
/** Ответ, который оценивается, — как итог в портале: у «Перевірки» пункты кода (ruleItems) + пункты ИИ; ответ не разобран
 *  (ошибка, отказ фильтра) — как есть. */
export function evalReply(base: EvalBase, c: EvalCase, raw: string): string {
  if (c.kind !== 'check') return raw;
  const r = parseCheck(raw);
  return r.ok ? JSON.stringify({ items: checkItems(ruleItems(evalInput(base, c)), r.items) }) : raw;
}
