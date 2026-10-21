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

// «Країна»: чтение, запись нового проекта (правка карточки страну не пишет), портфель за странами, список стран = выбор Deploy-PMO.ps1
import { mapProject as mapP2, mapAssign } from '../src/webparts/pmoPortal/data/map';
import { projectBody as pBody, projectEditBody as pEdit } from '../src/webparts/pmoPortal/data/write';
import { byCountry } from '../src/webparts/pmoPortal/logic/analytics';
import { COUNTRIES } from '../src/webparts/pmoPortal/logic/projects';
describe('країна', () => {
  test('чтение проекта и «Призначення»', () => {
    expect(mapP2({ Id: 1, pmCountry: 'Польща' } as any).country).toBe('Польща');
    expect(mapP2({ Id: 1 } as any).country).toBe('');
    expect(mapAssign({ Id: 2, paCountry: 'Чехія' } as any).country).toBe('Чехія');
  });
  test('новый проект пишет страну; правка карточки — нет', () => {
    const d: any = { title: 'П', code: '', department: 'ІТ', links: [], type: 'Звичайний', priority: '', manager: null, owner: null, team: [], start: '', goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: '', country: 'Польща' };
    expect(pBody(d, 'PRJ-001').pmCountry).toBe('Польща');
    expect('pmCountry' in pEdit(d, [], 'x', '', '')).toBe(false);
  });
  test('портфель за странами: активные, без страны — «—»', () => {
    const rows = byCountry([{ status: 'Реалізація', country: 'Польща', rag: 'Зелений' }, { status: 'Реалізація', country: 'Польща', rag: 'Червоний' },
      { status: 'Реалізація', rag: '' }, { status: 'Завершено', country: 'Чехія', rag: 'Зелений' }] as any);
    expect(rows.map(r => `${r.dept}:${r.total}:${r.g}${r.r}${r.na}`)).toEqual(['Польща:2:110', '—:1:001']);
    // «—» в конце, даже если таких проектов больше
    const many = byCountry([{ status: 'Реалізація', rag: '' }, { status: 'Реалізація', rag: '' }, { status: 'Реалізація', country: 'Чехія', rag: '' }] as any);
    expect(many.map(r => r.dept)).toEqual(['Чехія', '—']);
  });
  test('список стран приложения — как выбор «Країна» в Deploy-PMO.ps1', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../scripts/Deploy-PMO.ps1'), 'utf8');
    const m = /\$countries = @\(([^)]*)\)/.exec(src)!;
    expect(m[1].split(',').map((x: string) => x.trim().replace(/^"|"$/g, ''))).toEqual(COUNTRIES);
  });
});
