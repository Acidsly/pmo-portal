import cases from '../../tests/cases/approval.json';
import { approvalResult, withApproval } from '../src/webparts/pmoPortal/logic/approval';
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
