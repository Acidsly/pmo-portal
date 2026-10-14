import evalCases from '../src/webparts/pmoPortal/ai/evalCases.json';
import { ruleItems, mustMention, buildCheckContext, checkItems } from '../src/webparts/pmoPortal/logic/aiRules';
import { evalInput, scoreReply, evalReply, EvalCase, EvalBase } from '../src/webparts/pmoPortal/logic/aiEval';
import { AiContextIn } from '../src/webparts/pmoPortal/logic/aiContext';

// Гибридная проверка: сравнения чисел и дат — кодом, ИИ — смысловые правила (план помощника, этап 4)
const base = (evalCases as any).base as EvalBase;
const cases = (evalCases as any).cases as EvalCase[];
const checks = cases.filter(c => c.kind === 'check');
const inp = (o: { project?: object; draft?: object; risks?: object[]; reports?: object[]; lang?: string } = {}): AiContextIn => {
  const project: any = { ...base.project, ...(o.project || {}) };
  return { project, reports: (o.reports || [{}]).map(x => ({ ...base.report, ...x })) as any, risks: (o.risks || [{}]).map(x => ({ ...base.risk, ...x })) as any,
    changes: [], draft: { ...base.draft, ...(o.draft || {}) } as any, lang: (o.lang || 'uk') as any, today: base.today };
};

describe('пункты кода', () => {
  test('чистый отчёт — пунктов нет', () => expect(ruleItems(inp())).toEqual([]));
  test('«Терміни» зелёные, прогноз позже плана — пункт с датами; жёлтые — нет', () => {
    expect(ruleItems(inp({ draft: { forecastEnd: '2027-01-20' } }))).toEqual(['«Терміни» — зелений, а «Прогноз завершення» 20.01.2027 пізніше «Дата завершення (план)» 15.12.2026 — змініть оцінку «Терміни» або «Прогноз завершення».']);
    expect(ruleItems(inp({ draft: { forecastEnd: '2027-01-20', schedule: 'Жовтий' } }))).toEqual([]);
    expect(ruleItems(inp({ draft: { forecastEnd: '' } }))).toEqual([]);
  });
  test('«Терміни» зелёные, срок открытых записей прошёл — до трёх записей и «…»; закрытые и чужие — не считаются', () => {
    const late = (id: number, title: string, o: object = {}): object => ({ id, title, due: '2026-10-0' + id, ...o });
    const one = ruleItems(inp({ risks: [{}, late(1, 'А'), late(2, 'Б', { status: 'Закрито' }), late(3, 'В', { projectId: 9 })] }));
    expect(one).toEqual(['«Терміни» — зелений, а термін заходів минув: Ризик «А» (термін 01.10.2026) (реєстр «Ризики та проблеми» в картці) — змініть оцінку «Терміни» або оновіть записи в реєстрі.']);
    const many = ruleItems(inp({ risks: [late(1, 'А'), late(2, 'Б', { type: 'Проблема' }), late(3, 'В'), late(4, 'Г')] }));
    expect(many[0]).toContain('Ризик «А» (термін 01.10.2026), Проблема «Б» (термін 02.10.2026), Ризик «В» (термін 03.10.2026), …');
    expect(ruleItems(inp({ risks: [late(1, 'А')], draft: { schedule: 'Червоний' } }))).toEqual([]);
  });
  test('«Бюджет» зелёный, затраты больше бюджета проекта — пункт с суммами; рост затрат в пределах бюджета — нет', () => {
    expect(ruleItems(inp({ draft: { actualCost: 560000 } }))).toEqual(['«Бюджет» — зелений, а «Витрати на дату» 560 000 більше бюджету проєкту 500 000 — змініть оцінку «Бюджет» або «Витрати на дату».']);
    expect(ruleItems(inp({ draft: { actualCost: 499000 } }))).toEqual([]);
    expect(ruleItems(inp({ draft: { actualCost: 560000, budget: 'Жовтий' } }))).toEqual([]);
    expect(ruleItems(inp({ project: { budget: null }, draft: { actualCost: 560000 } }))).toEqual([]);
  });
  test('«Потрібне рішення» без текста — пункт; с текстом — нет', () => {
    expect(ruleItems(inp({ draft: { decision: true, decisionText: '  ' } }))).toEqual(['Позначено «Потрібне рішення керівництва», але не описано, яке рішення потрібне, — заповніть «Яке рішення потрібне».']);
    expect(ruleItems(inp({ draft: { decision: true, decisionText: 'Погодити бюджет' } }))).toEqual([]);
  });
  test('«% виконання» изменён в форме и меньше карточки — пункт; больше или как в карточке — нет', () => {
    expect(ruleItems(inp({ draft: { progress: 30 } }))).toEqual(['«% виконання» зменшено з 45% до 30% — перевірте «% виконання» або поясніть зниження в «Проблеми та ризики за період».']);
    expect(ruleItems(inp({ draft: { progress: 88 } }))).toEqual([]);
    expect(ruleItems(inp({ draft: { progress: 45 } }))).toEqual([]);
  });
  test('языки: en — без кириллицы в шаблоне, ru — без і ї є ґ', () => {
    const all = { forecastEnd: '2027-01-20', actualCost: 560000, decision: true, decisionText: '', progress: 30 };
    const risks = [{ title: 'X', due: '2026-10-01' }];
    const en = ruleItems(inp({ lang: 'en', draft: all, risks }));
    expect(en.length).toBe(5); en.forEach(x => expect(x).not.toMatch(/[а-яіїєґ]/i));
    const ru = ruleItems(inp({ lang: 'ru', draft: all, risks }));
    expect(ru.length).toBe(5); ru.forEach(x => expect(x).not.toMatch(/[іїєґ]/i));
  });
  test('без формы или форма другого проекта — пунктов нет', () => {
    expect(ruleItems({ ...inp({ draft: { actualCost: 560000 } }), draft: undefined })).toEqual([]);
    expect(ruleItems(inp({ draft: { actualCost: 560000, projectId: 2 } }))).toEqual([]);
  });
  test('итог — пункты кода, затем ИИ, не больше 10', () => {
    expect(checkItems(['к'], ['и'])).toEqual(['к', 'и']);
    expect(checkItems(['к', 'к'], Array.from({ length: 12 }, () => 'и')).length).toBe(10);
  });
});

describe('границы', () => {
  test('прогноз = план, срок = сегодня, затраты = бюджет — пунктов нет; % меньше карточки, но не изменён в форме — нет', () => {
    expect(ruleItems(inp({ draft: { forecastEnd: '2026-12-15' } }))).toEqual([]);
    expect(ruleItems(inp({ risks: [{ due: base.today }] }))).toEqual([]);
    expect(ruleItems(inp({ draft: { actualCost: 500000 } }))).toEqual([]);
    expect(ruleItems(inp({ project: { progress: 45 }, draft: { progress: 45 } }))).toEqual([]);
  });
  test('неизвестный язык — украинский', () => expect(ruleItems(inp({ lang: 'de', draft: { decision: true, decisionText: '' } }))[0]).toContain('Позначено'));
  test('keyChanges — фаза, тип, все даты (было → стало); % и затраты — нет', () => {
    const o = JSON.parse(buildCheckContext(inp({ draft: { status: 'Призупинено', type: 'Звичайний', start: '2026-04-01', goLive: '2026-12-01',
      planEnd: '2027-01-15', forecastEnd: '2027-02-01', progress: 60, actualCost: 300000 } })).json);
    expect(o.draft.keyChanges).toEqual([{ field: 'phase', from: 'Реалізація', to: 'Призупинено' }, { field: 'type', from: 'Стратегічний', to: 'Звичайний' },
      { field: 'start', from: '2026-03-01', to: '2026-04-01' }, { field: 'goLive', from: '2026-11-01', to: '2026-12-01' },
      { field: 'planEnd', from: '2026-12-15', to: '2027-01-15' }, { field: 'forecastEnd', from: '2026-12-15', to: '2027-02-01' }]);
  });
});

describe('записи, которые отчёт обязан упомянуть', () => {
  test('открытые: высокий риск (от 15), проблема, прошедший срок; закрытые и низкие — нет', () => {
    const r = mustMention(inp({ risks: [{ id: 1 }, { id: 2, probability: 4, impact: 4 }, { id: 3, type: 'Проблема', probability: 1, impact: 1 },
      { id: 4, due: '2026-10-01' }, { id: 5, probability: 5, impact: 5, status: 'Закрито' }, { id: 6, probability: 5, impact: 5, projectId: 9 }] }));
    expect(r.map(k => k.id)).toEqual([2, 3, 4]);
  });
});

describe('контекст «Перевірки»', () => {
  test('только смысловое: план прошлого отчёта, обязательные записи, форма, изменённые фаза / тип / даты', () => {
    const o = JSON.parse(buildCheckContext(inp({ project: { forecastEnd: '2026-12-15' }, draft: { planEnd: '2027-02-01', progress: 30 },
      risks: [{ id: 1 }, { id: 2, title: 'Відтік', probability: 4, impact: 4 }], reports: [{}, { id: 2, date: '2026-08-01' }] })).json);
    expect(Object.keys(o)).toEqual(['lang', 'project', 'plan', 'mention', 'draft']);
    expect(o.project).toEqual({ code: 'PRJ-001', title: 'CRM для продажів' });
    expect(o.plan).toEqual({ date: '2026-09-01', next: (base.report as any).next });
    expect(o.mention).toEqual([{ type: 'Ризик', title: 'Відтік', score: 16, due: '2026-11-30', overdue: false }]);
    expect(o.draft.keyChanges).toEqual([{ field: 'planEnd', from: '2026-12-15', to: '2027-02-01' }]);
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
