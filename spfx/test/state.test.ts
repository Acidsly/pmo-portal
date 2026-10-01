import { applyState, parseState } from '../src/webparts/pmoPortal/logic/state';
import { Project } from '../src/webparts/pmoPortal/data/types';
import cases from '../../tests/cases/state.json';

const P = (x: Partial<Project>): Project => ({ id: 1, code: '', title: 'P', type: 'Звичайний', priority: '', manager: null, owner: null, stakeholders: [],
  department: '', status: 'Реалізація', rag: '', progress: 0, start: '', goLive: '', planEnd: '', forecastEnd: '', archivedAt: '', budget: 0,
  actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', links: [], team: [], description: '', canEdit: true, pending: false, ...x });

describe('эталон ключевых полей — как синхронизация (tests/cases/state.json)', () => {
  for (const c of cases.apply) {
    test(c.name, () => {
      const st = c.state ? parseState(JSON.stringify(c.state)) : undefined;
      expect(applyState(P(c.project as Partial<Project>), st)).toMatchObject(c.expect);
    });
  }
  test('повреждённый JSON эталона — карточка как есть', () => {
    expect(parseState('{oops')).toBeUndefined(); expect(parseState('')).toBeUndefined();
    expect(applyState(P({ status: 'Ініціація' }), parseState('{oops'))).toMatchObject({ status: 'Ініціація' });
  });
  test('бюджет, название и описание эталон не трогает (их правит PM)', () => {
    const p = applyState(P({ budget: 500, title: 'Мій', description: 'Опис' }), { pmStatus: 'Планування' });
    expect(p).toMatchObject({ budget: 500, title: 'Мій', description: 'Опис', status: 'Планування' });
  });
});
