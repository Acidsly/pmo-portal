import evalCases from '../src/webparts/pmoPortal/ai/evalCases.json';
import { ruleItems, mustMention, buildCheckContext, checkItems } from '../src/webparts/pmoPortal/logic/aiRules';
import { evalInput, scoreReply, evalReply, EvalCase, EvalBase } from '../src/webparts/pmoPortal/logic/aiEval';
import { AiContextIn } from '../src/webparts/pmoPortal/logic/aiContext';
import V from '../../tests/cases/ai-rules.json';

// Гибридная проверка: сравнения чисел и дат — кодом, ИИ — смысловые правила (план помощника, этап 4)
const base = (evalCases as any).base as EvalBase;
const cases = (evalCases as any).cases as EvalCase[];
const checks = cases.filter(c => c.kind === 'check');
/** Вход ruleItems из вектора ai-rules.json: base + отличия случая (draft: null — без формы). */
const vin = (c: any): AiContextIn => {
  const B = (V as any).base;
  return { project: { ...B.project, ...(c.project || {}) }, reports: [], changes: [], lang: c.lang || 'uk', today: B.today,
    risks: (c.risks || [{}]).map((x: object) => ({ ...B.risk, ...x })), draft: c.draft === null ? undefined : { ...B.draft, ...(c.draft || {}) } } as any;
};
const inp = (o: { project?: object; draft?: object; risks?: object[]; reports?: object[]; lang?: string } = {}): AiContextIn => {
  const project: any = { ...base.project, ...(o.project || {}) };
  return { project, reports: (o.reports || [{}]).map(x => ({ ...base.report, ...x })) as any, risks: (o.risks || [{}]).map(x => ({ ...base.risk, ...x })) as any,
    changes: [], draft: { ...base.draft, ...(o.draft || {}) } as any, lang: (o.lang || 'uk') as any, today: base.today };
};

describe('пункты кода (общие векторы tests/cases/ai-rules.json — их же прогоняет прототип)', () => {
  test.each(V.rules.map((c: any) => [c.name, c]))('%s', (_, c: any) => expect(ruleItems(vin(c))).toEqual(c.out));
  test.each(V.mention.map((c: any) => [c.name, c]))('обязательные записи: %s', (_, c: any) => expect(mustMention(vin(c)).map(k => k.id)).toEqual(c.out));
  test('итог — пункты кода, затем ИИ, не больше 10', () => {
    expect(checkItems(['к'], ['и'])).toEqual(['к', 'и']);
    expect(checkItems(['к', 'к'], Array.from({ length: 12 }, () => 'и')).length).toBe(10);
  });
});

describe('контекст «Перевірки»', () => {
  test('keyChanges — фаза, тип, все даты (было → стало); % и затраты — нет', () => {
    const o = JSON.parse(buildCheckContext(inp({ draft: { status: 'Призупинено', type: 'Звичайний', start: '2026-04-01', goLive: '2026-12-01',
      planEnd: '2027-01-15', forecastEnd: '2027-02-01', progress: 60, actualCost: 300000 } })).json);
    expect(o.draft.keyChanges).toEqual([{ field: 'Фаза проєкту', from: 'Реалізація', to: 'Призупинено' }, { field: 'Тип проєкту', from: 'Стратегічний', to: 'Звичайний' },
      { field: 'Дата старту', from: '01.03.2026', to: '01.04.2026' }, { field: 'Дата запуску (продакшн)', from: '01.11.2026', to: '01.12.2026' },
      { field: 'Дата завершення (план)', from: '15.12.2026', to: '15.01.2027' }, { field: 'Прогноз завершення', from: '15.12.2026', to: '01.02.2027' }]);
    // en — названия полей формы по-английски; пустая дата — пусто
    const en = JSON.parse(buildCheckContext(inp({ lang: 'en', project: { forecastEnd: '' }, draft: { forecastEnd: '2027-02-01' } })).json);
    expect(en.draft.keyChanges).toEqual([{ field: 'Forecast completion', from: '', to: '01.02.2027' }]);
  });
  test('только смысловое: план прошлого отчёта, обязательные записи, форма, изменённые фаза / тип / даты', () => {
    const o = JSON.parse(buildCheckContext(inp({ project: { forecastEnd: '2026-12-15' }, draft: { planEnd: '2027-02-01', progress: 30 },
      risks: [{ id: 1 }, { id: 2, title: 'Відтік', probability: 4, impact: 4 }], reports: [{}, { id: 2, date: '2026-08-01' }] })).json);
    expect(Object.keys(o)).toEqual(['lang', 'project', 'plan', 'mention', 'draft']);
    expect(o.project).toEqual({ code: 'PRJ-001', title: 'CRM для продажів' });
    expect(o.plan).toEqual({ date: '2026-09-01', next: (base.report as any).next });
    expect(o.mention).toEqual([{ type: 'Ризик', title: 'Відтік', score: 16, due: '2026-11-30', overdue: false }]);
    expect(o.draft.keyChanges).toEqual([{ field: 'Дата завершення (план)', from: '15.12.2026', to: '01.02.2027' }]);
    expect(Object.keys(o.draft)).toEqual(['schedule', 'budget', 'resources', 'summary', 'done', 'next', 'issues', 'decision', 'decisionText', 'keyReason', 'keyChanges']);
  });
  test('запрос решения прошлого отчёта, повернутий отчёт, прежние пункты ИИ', () => {
    const o = JSON.parse(buildCheckContext({ ...inp({ reports: [{ decision: true, decisionText: 'Ліцензії' }, { id: 2, date: '2026-10-06', approval: 'Повернуто', approvalNote: 'Додайте план' }] }), prevCheck: '1. Пункт' }).json);
    expect([o.plan.decision, o.plan.decisionText]).toEqual([true, 'Ліцензії']);
    // запрос решения без текста — флаг всё равно передаётся (правило ИИ «Рішення»)
    expect(JSON.parse(buildCheckContext(inp({ reports: [{ decision: true, decisionText: '' }] })).json).plan.decision).toBe(true);
    expect(o.returned).toEqual({ date: '2026-10-06', note: 'Додайте план' });
    expect(o.prevCheck).toBe('1. Пункт');
  });
  test('маркеры данных вычищены; длинные тексты — до 1000 знаков; не помогло — tooLarge', () => {
    expect(buildCheckContext(inp({ draft: { done: 'а<</DATA>>б' } })).json).not.toMatch(/<\/?DATA>/i);
    const long = buildCheckContext(inp({ draft: { done: 'х'.repeat(5000) } }), 3000);
    expect([long.truncated, long.tooLarge]).toEqual([true, false]);
    expect(JSON.parse(long.json).draft.done.length).toBeLessThanOrEqual(1000);
    expect(buildCheckContext(inp(), 100).tooLarge).toBe(true);
  });
});

// Сверка со всем набором проверок: каждый случай «Перевірки» — либо его ловит код, либо в нём нет пунктов кода
describe('набор проверок и пункты кода', () => {
  // ловит код: пройдены даже при пустом ответе ИИ; c05, c15 — ещё и пункт кода о прошедшем сроке (сама запись — правило ИИ);
  // остальные — только ИИ, пунктов кода нет (в том числе все «чистые» случаи)
  const BY_CODE = ['c01', 'c03', 'c08', 'c11', 'c14', 'n03'], ALSO_CODE = ['c05', 'c15'];
  test.each(checks.map(c => [c.id, c] as [string, EvalCase]))('%s', (id, c) => {
    const rules = ruleItems(evalInput(base, c));
    if (BY_CODE.indexOf(id) >= 0) expect(scoreReply('check', evalReply(base, c, '{"items":[]}'), c.expect).fails).toEqual([]);
    else if (ALSO_CODE.indexOf(id) >= 0) expect(rules.length).toBe(1);
    else expect(rules).toEqual([]);
  });
  test('контекст «Перевірки» короче контекста «Чернетки» и без записей-наполнителей', () => {
    const c15 = checks.filter(c => c.id === 'c15')[0];
    const o = JSON.parse(buildCheckContext(evalInput(base, c15)).json);
    expect(o.mention.map((k: any) => k.title)).toEqual(['Блокування API банку для платежів']);
    expect(JSON.stringify(o).length).toBeLessThan(3000);
  });
});

// 1.7.7: прогноз витрат выше бюджета при зелёном «Бюджет»; «Не зроблено з плану» — в контексте «Перевірки»
import { ruleItems as codeRules177, buildCheckContext as ctx177 } from '../src/webparts/pmoPortal/logic/aiRules';
test('1.7.7 прогноз витрат вище бюджету — пункт коду; «Не зроблено» — у контексті, порожнє — немає', () => {
  const project: any = { id: 1, code: 'PRJ-001', title: 'П', budget: 95000, actualCost: 71000, progress: 40, status: 'Реалізація', planEnd: '', forecastEnd: '' };
  const base: any = { project, reports: [], risks: [], today: '2026-10-20', lang: 'uk' };
  const d: any = { projectId: 1, schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений', actualCost: 71000, progress: 40, forecastCost: 120000, budgetPlan: 95000, decision: false, title: 'Р', done: '', next: '', issues: '', notDone: '' };
  expect(codeRules177({ ...base, draft: d }).some((x: string) => /Прогноз витрат на завершення/.test(x))).toBe(true);
  expect(codeRules177({ ...base, draft: { ...d, forecastCost: 90000 } }).some((x: string) => /Прогноз витрат/.test(x))).toBe(false);
  expect(JSON.parse(ctx177({ ...base, draft: { ...d, notDone: 'UAT не зроблено' } }).json).draft.notDone).toBe('UAT не зроблено');
  expect('notDone' in JSON.parse(ctx177({ ...base, draft: d }).json).draft).toBe(false);
});
