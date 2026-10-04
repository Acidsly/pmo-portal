import { toFormValues, formDate, formNumber, formUser, regionalFrom, DEFAULT_REGIONAL } from '../src/webparts/pmoPortal/data/formValues';
import { reportBody, riskBody, commentBody, teamBody } from '../src/webparts/pmoPortal/data/write';
import { reportFromProject } from '../src/webparts/pmoPortal/logic/forms';
import { Project } from '../src/webparts/pmoPortal/data/types';

const uk = DEFAULT_REGIONAL;
const us = regionalFrom({ DecimalSeparator: '.', DateFormat: 0, DateSeparator: '/' });
const get = (fv: { FieldName: string; FieldValue: string }[], n: string): string | undefined => { const x = fv.filter(f => f.FieldName === n)[0]; return x ? x.FieldValue : undefined; };

test('даты: полдень UTC и ISO → порядок и разделитель сайта (проба тест-сайта: дд.мм.рррр)', () => {
  expect(formDate('2026-09-30T12:00:00Z', uk)).toBe('30.09.2026');
  expect(formDate('2026-02-29', uk)).toBe('29.02.2026');
  expect(formDate('2026-09-30', us)).toBe('09/30/2026');
  expect(formDate('2026-09-30', regionalFrom({ DateFormat: 2, DateSeparator: '-' }))).toBe('2026-09-30');
  expect(formDate(null, uk)).toBe(''); expect(formDate('', uk)).toBe('');
});
test('числа: без групп, дробь — разделитель сайта (проба: «12.5» отклонено, «12,5» принято)', () => {
  expect(formNumber(12.5, uk)).toBe('12,5'); expect(formNumber(420000, uk)).toBe('420000'); expect(formNumber(0, uk)).toBe('0');
  expect(formNumber(12.5, us)).toBe('12.5'); expect(formNumber(null, uk)).toBe(''); expect(formNumber('x', uk)).toBe('');
});
test('пользователь — ключ входа, пусто — пусто', () => {
  expect(formUser('o@x.ua')).toBe('[{"Key":"i:0#.f|membership|o@x.ua"}]'); expect(formUser('')).toBe('');
});
test('регіональні налаштування: значения по умолчанию — uk-UA', () => {
  expect(regionalFrom(undefined)).toEqual(uk);
  expect(regionalFrom({ DecimalSeparator: ',', DateFormat: 1, DateSeparator: '.' })).toEqual(uk);
});

const p: Project = { id: 7, code: '', title: 'P', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [], department: '',
  status: 'Реалізація', rag: '', progress: 40, start: '', goLive: '', planEnd: '2026-12-01', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 100, lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: '', canEdit: true, pending: false };
test('отчёт → значения формы: lookup без «Id», даты, % и затраты, булевы', () => {
  const d = { ...reportFromProject(p, '2026-09-30'), schedule: 'Зелений' as const, budget: 'Зелений' as const, resources: 'Жовтий' as const,
    title: 'Резюме «тест» & <b>', actualCost: 12.5, decision: true, decisionText: 'Рішення\nрядок 2' };
  const fv = toFormValues('StatusReports', reportBody(d, p), uk);
  expect(get(fv, 'srProject')).toBe('7'); expect(get(fv, 'srProjectId')).toBeUndefined();
  expect(get(fv, 'srDate')).toBe('30.09.2026'); expect(get(fv, 'srActualCost')).toBe('13');   // затраты — целые доллары (12,5 → 13); разделитель дроби — в тесте formNumber expect(get(fv, 'srProgress')).toBe('40');
  expect(get(fv, 'srDecision')).toBe('1'); expect(get(fv, 'srApplied')).toBe('0');
  expect(get(fv, 'Title')).toBe('Резюме «тест» & <b>'); expect(get(fv, 'srDecisionText')).toBe('Рішення\nрядок 2');
});
test('риск, комментарий, команда: пользователь по e-mail, пустая дата и стратегия — пусто', () => {
  const r = toFormValues('RisksIssues', riskBody({ projectId: 3, title: 'Р', type: 'Ризик', probability: 4, impact: 5, owner: { id: 9, name: 'O', email: 'o@x' },
    status: 'Відкрито', due: '', mitigation: '', strategy: '', contingency: '' }), uk, { riOwnerId: 'o@x' });
  expect(get(r, 'riProject')).toBe('3'); expect(get(r, 'riOwner')).toBe('[{"Key":"i:0#.f|membership|o@x"}]'); expect(get(r, 'riDue')).toBe('');
  expect(get(r, 'riStrategy')).toBe(''); expect(get(r, 'riProbability')).toBe('4');
  expect(toFormValues('ProjectComments', commentBody(3, ' Текст '), uk)).toEqual([{ FieldName: 'cmProject', FieldValue: '3' }, { FieldName: 'cmText', FieldValue: 'Текст' }]);
  const t = toFormValues('ProjectTeam', teamBody(3, { user: { id: 4, name: 'U', email: 'u@x' }, role: 'Архітектор', topics: '' }), uk, { tmUserId: 'u@x' });
  expect(get(t, 'tmProject')).toBe('3'); expect(get(t, 'tmUser')).toBe('[{"Key":"i:0#.f|membership|u@x"}]'); expect(get(t, 'tmRole')).toBe('Архітектор');
});
