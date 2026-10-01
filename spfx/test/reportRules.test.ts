import { pendingReturns, applyAction } from '../src/webparts/pmoPortal/logic/reportRules';
import cases from '../../tests/cases/reports.json';

describe('авто-возврат отчётов на погодженні — как синхронизация', () => {
  for (const c of cases.returns) test(c.name, () => {
    expect(pendingReturns(c.pending, c.pm, (c as { owners?: string[] }).owners || [], c.archived).map(x => x.id)).toEqual(c.returned);
  });
});
describe('применение погодженого отчёта — как синхронизация', () => {
  for (const c of cases.apply) test(c.name, () => {
    expect(applyAction(c.rep, c.pm, (c as { owners?: string[] }).owners || [], c.archived, c.last, c.lastUpdate)).toBe(c.out);
  });
});
