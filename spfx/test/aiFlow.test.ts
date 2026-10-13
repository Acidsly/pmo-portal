import cases from '../../tests/cases/ai-flow.json';
import { aiAction, aiUnavailable, aiErrorKind, consentStep, aiSaveFields, nextPrevCheck, draftInsert, undoAvailable, aiView, AiResult, riskRefs, mentionLine, appendLine }
  from '../src/webparts/pmoPortal/logic/aiFlow';
import { AiLang } from '../src/webparts/pmoPortal/logic/aiCheck';

// Сценарий помощника в форме отчёта (план этапа 4, задача 1): общие векторы tests/cases/ai-flow.json
const c = cases as any;
describe('нажатие нижней кнопки', () => { (c.action as any[]).forEach(x => test(x.name, () => { expect(aiAction(x.in)).toBe(x.out); })); });
describe('ИИ недоступен — для вида формы', () => { (c.unavailable as any[]).forEach(x => test(x.name, () => { expect(aiUnavailable(x.at, x.current)).toBe(x.out); })); });
describe('почему ИИ не ответил', () => { (c.errorKind as any[]).forEach(x => test(x.name, () => { expect(aiErrorKind(x.in)).toBe(x.out); })); });
describe('согласие', () => { (c.consent as any[]).forEach(x => test(x.name, () => { expect(consentStep(x.kind, x.after)).toBe(x.out); })); });
describe('поля ИИ при записи', () => { (c.save as any[]).forEach(x => test(x.name, () => { expect(aiSaveFields(x.in)).toEqual(x.out); })); });
describe('prevCheck', () => { (c.prevCheck as any[]).forEach(x => test(x.name, () => { expect(nextPrevCheck(x.result as AiResult | null, x.lang as AiLang)).toBe(x.out); })); });
describe('вставка черновика', () => { (c.insert as any[]).forEach(x => test(x.name, () => { expect(draftInsert(x.form, x.ai)).toEqual(x.out); })); });
describe('«Скасувати вставку»', () => { (c.undo as any[]).forEach(x => test(x.name, () => { expect(undoAvailable(x.after, x.current)).toBe(x.out); })); });
describe('поле ИИ в просмотре', () => { (c.view as any[]).forEach(x => test(x.name, () => { expect(aiView(x.check, x.at)).toBe(x.out); })); });
describe('записи реестра в пунктах ИИ', () => { (c.riskRefs as any[]).forEach(x => test(x.name, () => { expect(riskRefs(x.item, x.risks).map(r => r.id)).toEqual(x.out); })); });
describe('упоминание записи в «Проблеми та ризики»', () => {
  const fmt = (iso: string): string => iso.split('-').reverse().join('.');
  (c.mention as any[]).forEach(x => test(x.name, () => {
    expect(appendLine(x.field, mentionLine(x.risk, x.type, { score: 'оцінка', due: 'термін' }, fmt))).toBe(x.out);
  }));
});
