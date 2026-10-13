import cases from '../../tests/cases/risk-form.json';
import { riskErrors, riskEditable, riskCopy, RiskDraft } from '../src/webparts/pmoPortal/logic/forms';

// Форма записи реестра «Ризики та проблеми» (#91, #92): общие векторы tests/cases/risk-form.json (те же — прототип)
const c = cases as any;
const base: RiskDraft = { projectId: 1, title: '', type: 'Ризик', probability: 3, impact: 3, owner: null, status: 'Відкрито', due: '', mitigation: '', strategy: '', contingency: '' };
describe('обязательные поля', () => { (c.errors as any[]).forEach(x => test(x.name, () => { expect(riskErrors({ ...base, ...x.draft }, x.isNew)).toEqual(x.out); })); });
describe('что можно менять', () => { (c.editable as any[]).forEach(x => test(x.name, () => { expect(x.fields.map((f: string) => riskEditable(f, x.isNew))).toEqual(x.out); })); });
describe('«Копіювати ризик»', () => { (c.copy as any[]).forEach(x => test(x.name, () => { expect(riskCopy(x.risk, x.today)).toEqual(x.out); })); });
