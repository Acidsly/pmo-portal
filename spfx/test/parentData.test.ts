import { mapProject, PROJECT_PARENT } from '../src/webparts/pmoPortal/data/map';
import { projectBody, projectEditBody } from '../src/webparts/pmoPortal/data/write';
import { cardDiff } from '../src/webparts/pmoPortal/logic/forms';
import { cardFields, changedFields } from '../src/webparts/pmoPortal/logic/guard';
import { withParentNames, parentLabel } from '../src/webparts/pmoPortal/logic/projects';
import { FIELD_KEY } from '../src/webparts/pmoPortal/logic/changes';

// «Батьківський проєкт» (pmParent): чтение, запись, журнал правок, проверка конфликта
describe('чтение', () => {
  test('lookup: id и название из записи; нет — null; запрос — отдельной частью (поля может ещё не быть)', () => {
    expect(mapProject({ Id: 5, pmParentId: 2, pmParent: { Title: 'CRM' } }).parent).toEqual({ id: 2, title: 'CRM' });
    expect(mapProject({ Id: 5, pmParentId: 2 }).parent).toEqual({ id: 2, title: '' });
    expect(mapProject({ Id: 5 }).parent).toBeNull();
    expect(PROJECT_PARENT).toEqual({ select: ',pmParentId,pmParent/Title', expand: ',pmParent' });
  });
  test('название и код — из видимых проектов; родитель не виден — название из записи, нет и его — «#id»', () => {
    const ps = withParentNames([{ id: 1, code: 'PRJ-001', title: 'CRM', parent: null }, { id: 2, code: 'PRJ-002', title: 'Сайт', parent: { id: 1, title: 'старе' } },
      { id: 3, code: 'PRJ-003', title: 'X', parent: { id: 9, title: 'Чужий' } }]);
    expect(ps.map(p => parentLabel(p.parent))).toEqual(['', 'PRJ-001 · CRM', 'Чужий']);
    expect(parentLabel({ id: 9, title: '' })).toBe('#9');
  });
});
describe('запись', () => {
  const d: any = { title: 'П', code: 'PRJ-005', department: 'ІТ', links: [], type: 'Звичайний', priority: '2 — Середній', manager: null, owner: null, team: [],
    start: '', goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: 'опис' };
  test('выбран — pmParentId, снят — null; поля в форме нет — не пишется', () => {
    expect(projectBody({ ...d, parent: { id: 2, title: 'CRM' } }, 'PRJ-005').pmParentId).toBe(2);
    expect(projectEditBody({ ...d, parent: null }, [], 'pm@x', '', '').pmParentId).toBeNull();
    expect('pmParentId' in projectEditBody(d, [], 'pm@x', '', '')).toBe(false);
  });
});
describe('журнал и конфликт правок', () => {
  const base: any = { id: 5, title: 'П', code: 'PRJ-005', department: 'ІТ', links: [], priority: '2 — Середній', manager: null, owner: null, team: [], budget: 0,
    description: 'опис', parent: { id: 1, title: 'CRM', code: 'PRJ-001' } };
  const draft = (parent: any): any => ({ ...base, parent });
  test('смена родителя — «PRJ-001 · CRM» → «PRJ-002 · CRM» (по номеру: названия бывают одинаковыми); снятие — пусто', () => {
    expect(cardDiff(base, draft({ id: 2, title: 'CRM', code: 'PRJ-002' }))).toEqual([{ f: 'parent', from: 'PRJ-001 · CRM', to: 'PRJ-002 · CRM' }]);
    expect(cardDiff(base, draft(null))).toEqual([{ f: 'parent', from: 'PRJ-001 · CRM', to: '' }]);
    expect(cardDiff(base, draft({ id: 1, title: 'CRM', code: 'PRJ-001' }))).toEqual([]);
  });
  test('другой пользователь сменил родителя — конфликт правок', () => {
    expect(changedFields(cardFields(base), cardFields({ ...base, parent: { id: 2, title: 'CRM' } }))).toEqual(['parent']);
  });
  test('поле журнала pmParent — подпись «parent»', () => expect(FIELD_KEY.pmParent).toBe('parent'));
});
