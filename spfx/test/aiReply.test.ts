import cases from '../../tests/cases/ai-reply.json';
import { parseDraft, parseCheck, toPlain, insertText, checkText } from '../src/webparts/pmoPortal/logic/aiReply';
import { AiLang } from '../src/webparts/pmoPortal/logic/aiCheck';

// Ответы помощника отчёта (план помощника 2.1, 3, 4.2): общие векторы tests/cases/ai-reply.json
// out — ответ целиком; без out — только ok
const same = (got: any, c: any): void => { if (c.out) expect(got).toEqual(c.out); else expect(got.ok).toBe(c.ok); };
describe('разбор ответа «Заповнити з ШІ»', () => {
  (cases.parseDraft as any[]).forEach(c => test(c.name, () => { same(parseDraft(c.raw), c); }));
});
describe('разбор ответа «Перевірити з ШІ»', () => {
  (cases.parseCheck as any[]).forEach(c => test(c.name, () => { same(parseCheck(c.raw), c); }));
});
describe('только текст', () => {
  (cases.plain as any[]).forEach(c => test(c.name, () => { expect(c.max ? toPlain(c.in, c.max) : toPlain(c.in)).toBe(c.out); }));
  test('по умолчанию — не длиннее 4000', () => { expect(toPlain('я'.repeat(5000)).length).toBe(4000); });
});
describe('вставка в поле', () => {
  (cases.insert as any[]).forEach(c => test(c.name, () => { expect(insertText(c.current, c.proposed)).toEqual(c.out); }));
});
describe('поле «Суперечності (аналіз ШІ)»', () => {
  (cases.check as any[]).forEach(c => test(c.name, () => { expect(checkText(c.items, c.lang as AiLang)).toBe(c.out); }));
});
