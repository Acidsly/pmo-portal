import cases from '../../tests/cases/ai-check.json';
import { reportPrint, aiButton, acceptReply, unavailableNote, AiLang, AiUnavailable } from '../src/webparts/pmoPortal/logic/aiCheck';
import { ReportDraft } from '../src/webparts/pmoPortal/logic/forms';

// Проверка отчёта ИИ (план помощника 2.2, 4.2): общие векторы tests/cases/ai-check.json
const draft = (cases as any).draft as ReportDraft;
describe('отпечаток формы отчёта', () => {
  (cases.print as any[]).forEach(c => test((c.same ? 'не меняется: ' : 'меняется: ') + c.name, () => {
    const a = reportPrint(draft), b = reportPrint({ ...draft, ...c.change } as ReportDraft);
    expect(a === b).toBe(c.same);
  }));
  test('отпечаток постоянный', () => { expect(reportPrint({ ...draft })).toBe(reportPrint(draft)); });
});
describe('кнопка внизу формы', () => {
  (cases.button as any[]).forEach(c => test(c.name, () => { expect(aiButton(c.in)).toBe(c.out); }));
});
describe('опоздавший ответ ИИ', () => {
  (cases.reply as any[]).forEach(c => test(c.name, () => { expect(acceptReply(c.request, c.current)).toBe(c.out); }));
});
describe('ИИ недоступен — текст поля', () => {
  (cases.unavailable as any[]).forEach(c => test(c.lang + ' ' + c.reason, () => {
    expect(unavailableNote(c.reason as AiUnavailable, c.lang as AiLang)).toBe(c.out);
  }));
});
