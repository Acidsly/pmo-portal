import * as fs from 'fs';
import * as path from 'path';
import evalCases from '../src/webparts/pmoPortal/ai/evalCases.json';
import { aiMessage, AI_HEAD, scoreReply, evalInput, evalSummary, EvalCase, EvalBase, EvalResult } from '../src/webparts/pmoPortal/logic/aiEval';
import { buildReportContext } from '../src/webparts/pmoPortal/logic/aiContext';
import { parseDraft, parseCheck } from '../src/webparts/pmoPortal/logic/aiReply';

// Набор проверок агента и протокол сообщения (план помощника — раздел 3, copilot/README.md)
const base = (evalCases as any).base as EvalBase;
const cases = (evalCases as any).cases as EvalCase[];
const repo = path.resolve(__dirname, '../..');
const promptOf = (f: string): string => {
  const m = /```text\n([\s\S]*?)\n```/.exec(fs.readFileSync(path.join(repo, 'copilot/prompts', f), 'utf8'));
  return m ? m[1] : '';
};

describe('сообщение агенту', () => {
  test('первое слово — вид запроса, контекст — между маркерами данных', () => {
    expect(aiMessage('draft', '{"a":1}')).toBe('ЧЕРНЕТКА\n<<DATA>>\n{"a":1}\n<</DATA>>');
    expect(aiMessage('check', '{}')).toBe('ПЕРЕВІРКА\n<<DATA>>\n{}\n<</DATA>>');
  });
  test('тема Fallback выбирает prompt по тем же словам', () => {
    const yaml = fs.readFileSync(path.join(repo, 'copilot/topic-fallback.yaml'), 'utf8');
    expect(yaml).toContain(`StartsWith(Topic.Msg, "${AI_HEAD.draft}")`);
    expect(yaml).toContain(`StartsWith(Topic.Msg, "${AI_HEAD.check}")`);
    expect(yaml).toContain('value: =System.Activity.Text');
  });
});

describe('тексты prompt', () => {
  test.each([['draft.md', AI_HEAD.draft], ['check.md', AI_HEAD.check]])('%s: вход [msg], маркеры данных, первое слово', (f, head) => {
    const t = promptOf(f);
    expect(t).toContain('\n[msg]\n');
    expect(t).toContain('<<DATA>>');
    expect(t).toContain(`починається словом ${head}`);
  });
  test('образец ответа «Чернетки» разбирает parseDraft, «Перевірки» — parseCheck', () => {
    const last = (t: string): string => t.trim().split('\n').pop() || '';
    expect(parseDraft(last(promptOf('draft.md'))).ok).toBe(true);
    expect(parseCheck(last(promptOf('check.md'))).ok).toBe(true);
  });
});

describe('набор проверок', () => {
  test('не меньше 15 случаев на prompt, «чистых» проверок — не меньше 5, негативные — с обеих сторон; номера не повторяются', () => {
    expect(cases.filter(c => c.kind === 'draft' && !c.negative).length).toBeGreaterThanOrEqual(15);
    expect(cases.filter(c => c.kind === 'check' && !c.negative).length).toBeGreaterThanOrEqual(15);
    expect(cases.filter(c => c.kind === 'check' && c.expect.items && c.expect.items.max === 0).length).toBeGreaterThanOrEqual(5);
    expect(cases.filter(c => c.negative && c.kind === 'draft').length).toBeGreaterThanOrEqual(2);
    expect(cases.filter(c => c.negative && c.kind === 'check').length).toBeGreaterThanOrEqual(2);
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length);
  });
  test.each(cases.map(c => [c.id, c] as [string, EvalCase]))('%s: контекст строится целиком, без обрезки', (_, c) => {
    const r = buildReportContext(evalInput(base, c));
    expect(r.truncated).toBe(false);
    expect(r.tooLarge).toBe(false);
    expect(r.json).not.toMatch(/<\/?DATA>/i);
    if (c.input.fill) expect(r.json.length).toBeGreaterThan(35000);
    // вирішальний ризик — останній у даних
    if (c.input.fill) expect(JSON.parse(r.json).risks.pop().title).toMatch(/банку/);
  });
  test('«Чернетка» получает показатели проекта случая и пустые тексты, «Перевірка» — форму целиком; null — без формы', () => {
    const d = cases.filter(c => c.kind === 'draft')[0], k = cases.filter(c => c.kind === 'check')[0];
    expect(evalInput(base, d).draft!.done).toBe('');
    const d13 = evalInput(base, cases.filter(c => c.id === 'd13')[0]).draft!;
    expect([d13.status, d13.progress, d13.actualCost]).toEqual(['Ініціація', 0, 0]);
    expect(evalInput(base, k).draft!.done).toBe((base.draft as any).done);
    expect(evalInput(base, { ...d, input: { ...d.input, draft: null } }).draft).toBeUndefined();
  });
});

describe('оценка ответа', () => {
  const draft = (o: object = {}): string => JSON.stringify({ done: '– Налаштовано обмін з 1С', next: '– Навчання', issues: '– Ризик постачальника',
    summary: 'Іде за планом', remember: ['Відповісти на запит рішення'], ratings: { schedule: 'Жовтий', budget: 'Зелений', resources: null, reason: 'прогноз' }, ...o });
  test('латинские двойники — как кириллица («1C» = «1С»)', () => {
    expect(scoreReply('draft', draft({ done: '– Обмін з 1C' }), { has: [{ in: 'done', any: ['1с'] }] }).pass).toBe(true);
    expect(scoreReply('draft', draft({ done: '– Обмін з 1C' }), { not: ['1с'] }).fails).toEqual(['not:1с']);
    expect(scoreReply('check', '{"items":["The forecast is later"]}', { has: [{ in: 'items', any: ['forecast'] }] }).pass).toBe(true);
  });
  test('слова — без регистра, в нужном поле', () => {
    expect(scoreReply('draft', draft(), { has: [{ in: 'done', any: ['1С'] }] }).pass).toBe(true);
    expect(scoreReply('draft', draft(), { has: [{ in: 'done', any: ['навчан'] }] }).fails).toEqual(['has:done:навчан']);
    expect(scoreReply('draft', draft(), { has: [{ in: 'all', any: ['навчан'] }] }).pass).toBe(true);
  });
  test('запрещённые слова — везде или в поле', () => {
    expect(scoreReply('draft', draft({ summary: 'ЗЛАМАНО' }), { not: ['зламано'] }).fails).toEqual(['not:зламано']);
    expect(scoreReply('draft', draft(), { notIn: [{ in: 'issues', any: ['постачальн'] }] }).fails).toEqual(['notIn:issues:постачальн']);
  });
  test('оценки: допустимые значения, null — оценки нет', () => {
    expect(scoreReply('draft', draft(), { ratings: { schedule: ['Жовтий', 'Червоний'], resources: [null] } }).pass).toBe(true);
    expect(scoreReply('draft', draft(), { ratings: { budget: ['Червоний'] } }).fails).toEqual(['rating:budget=Зелений']);
  });
  test('пункты проверки и «Що не забути» — не меньше / не больше', () => {
    expect(scoreReply('check', '{"items":[]}', { items: { max: 0 } }).pass).toBe(true);
    expect(scoreReply('check', '{"items":["а"]}', { items: { max: 0 } }).fails).toEqual(['items>0:1']);
    expect(scoreReply('check', '{"items":[]}', { items: { min: 1 } }).fails).toEqual(['items<1:0']);
    expect(scoreReply('draft', draft(), { items: { max: 0 } }).fails).toEqual(['items>0:1']);
  });
  test('язык: без кириллицы (en), без і ї є ґ (ru)', () => {
    expect(scoreReply('draft', draft({ summary: 'On track' }), { noCyr: ['summary'] }).pass).toBe(true);
    expect(scoreReply('draft', draft(), { noCyr: ['summary'] }).fails).toEqual(['cyrillic:summary']);
    expect(scoreReply('draft', draft({ summary: 'Идёт по плану' }), { noUk: ['summary'] }).pass).toBe(true);
    expect(scoreReply('draft', draft({ summary: 'Іде за планом' }), { noUk: ['summary'] }).fails).toEqual(['ukrainian:summary']);
  });
  test('неразобранный ответ — не пройден (как в портале)', () => {
    expect(scoreReply('draft', 'Ось чернетка: …', {}).fails).toEqual(['parse:notJson']);
    expect(scoreReply('check', '{"items":[],"note":"x"}', {}).fails).toEqual(['parse:extraKey:note']);
  });
});

describe('итог набора', () => {
  const r = (id: string, kind: 'draft' | 'check', pass: boolean, negative = false): EvalResult => ({ id, kind, pass, negative, fails: [], ms: 1, raw: '' });
  const many = (kind: 'draft' | 'check', ok: number): EvalResult[] => Array.from({ length: 15 }, (_, i) => r(kind + i, kind, i < ok));
  test('14 из 15 на каждый prompt и все негативные — пройдено', () => {
    expect(evalSummary([...many('draft', 14), ...many('check', 15), r('n', 'draft', true, true)]).ok).toBe(true);
  });
  test('13 из 15 или один негативный не пройден — не пройдено', () => {
    expect(evalSummary([...many('draft', 13), ...many('check', 15)]).ok).toBe(false);
    const s = evalSummary([...many('draft', 15), ...many('check', 15), r('n', 'check', false, true)]);
    expect(s.ok).toBe(false);
    expect(s.negative).toEqual([0, 1]);
    expect(s.draft).toEqual([15, 15]);
  });
});
