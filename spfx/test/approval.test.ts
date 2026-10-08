import cases from '../../tests/cases/approval.json';
import { approvalResult, withApproval, latestReport } from '../src/webparts/pmoPortal/logic/approval';
import { StatusReport } from '../src/webparts/pmoPortal/data/types';

describe('погодження: общие векторы с Invoke-PMOSync.ps1', () => {
  (cases as any[]).forEach(c => test(c.name, () => {   // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(approvalResult(c.report, c.approval)).toEqual(c.expect);
  }));
});

const R = (x: Partial<StatusReport>): StatusReport => ({ id: 5, projectId: 1, date: '2026-09-20', period: '', schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений',
  status: '', type: '', progress: null, start: '', goLive: '', planEnd: '', forecastEnd: '', actualCost: null, keyReason: '', title: 'T', done: '', next: '', issues: '',
  decision: false, decisionText: '', applied: false, author: null, approval: 'На погодженні', approvedBy: null, approvedAt: '', approvalNote: '', ...x });
const A = { id: 1, reportId: 5, projectId: 1, decision: 'Погоджено', s: 'Червоний', b: '', r: '', note: 'зсув', author: { id: 3, name: 'PMO', email: 'p@x' }, created: '2026-09-21T10:00:00Z', applied: false };

test('withApproval: свежее решение PMO видно сразу, первое действительное побеждает', () => {
  const r = withApproval(R({}), [{ ...A, id: 2, decision: 'Повернуто', note: 'ні' }, { ...A, id: 1, note: '' }, { ...A, id: 3 }]);
  // #1 недействительно (цвет без комментария), #2 — первое действительное
  expect(r).toMatchObject({ approval: 'Повернуто', schedule: 'Зелений', approvalNote: 'ні', approvalFresh: true });
  expect(withApproval(R({}), [A])).toMatchObject({ approval: 'Погоджено', schedule: 'Червоний', approvedBy: A.author });
  expect(withApproval(R({ approval: 'Погоджено' }), [{ ...A, decision: 'Повернуто' }]).approval).toBe('Погоджено');
  expect(withApproval(R({ approval: '' }), []).approval).toBe('На погодженні');
});

describe('метка «Звіт»: погодження самого нового отчёта', () => {
  test('нет отчётов — метки нет', () => { expect(latestReport([])).toBeNull(); });
  test('новее по дате, при равной дате — больший номер', () => {
    expect(latestReport([R({ id: 1, date: '2026-09-25', approval: 'Погоджено' }), R({ id: 2, date: '2026-10-01', approval: 'Повернуто' })])).toEqual({ approval: 'Повернуто', date: '2026-10-01' });
    expect(latestReport([R({ id: 7, date: '2026-10-01', approval: 'На погодженні' }), R({ id: 3, date: '2026-10-01', approval: 'Погоджено' })])!.approval).toBe('На погодженні');
  });
  test('без погодження: применённый — «Погоджено», иначе — «На погодженні»', () => {
    expect(latestReport([R({ approval: '', applied: true })])!.approval).toBe('Погоджено');
    expect(latestReport([R({ approval: '', applied: false })])!.approval).toBe('На погодженні');
  });
});
