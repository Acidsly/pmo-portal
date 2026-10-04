import { parseLinks, cleanTeam, cleanLinks, validateTeamLinks, teamPlan, teamText, teamPeople, TeamRow } from '../src/webparts/pmoPortal/logic/team';
import { cardDiff, ProjectDraft } from '../src/webparts/pmoPortal/logic/forms';
import { Project, TeamMember } from '../src/webparts/pmoPortal/data/types';

const A = { id: 1, name: 'Анна', email: 'a@x.ua' }; const B = { id: 2, name: 'Борис', email: 'B@x.ua' };
const M = (id: number, user: typeof A | null, role: string, topics = ''): TeamMember => ({ id, projectId: 7, user, role, topics });

test('parseLinks: JSON, прежний Loop, повреждённое поле', () => {
  expect(parseLinks('[{"t":"ТЗ","u":"https://d/x"},{"t":"","u":""}]', '')).toEqual([{ t: 'ТЗ', u: 'https://d/x' }]);
  expect(parseLinks('', 'https://loop/x')).toEqual([{ t: 'Loop', u: 'https://loop/x' }]);
  expect(parseLinks('[]', 'https://loop/x')).toEqual([]);   // PM убрал все ссылки — прежний Loop не возвращается
  expect(parseLinks('{', '')).toEqual([]);
});
test('cleanTeam: пустые строки и повторы человека убираются', () => {
  const rows: TeamRow[] = [{ user: A, role: ' Замовник ', topics: '' }, { user: null, role: '', topics: '' }, { user: { ...A, email: 'A@X.UA' }, role: 'Інше', topics: '' }];
  expect(cleanTeam(rows)).toEqual([{ user: A, role: 'Замовник', topics: '' }]);
});
test('validateTeamLinks: роль обязательна, ссылки https', () => {
  expect(validateTeamLinks([{ user: A, role: '', topics: '' }], [])).toBe('errRole');
  expect(validateTeamLinks([{ user: null, role: 'Роль', topics: '' }], [])).toBe('errRole');
  expect(validateTeamLinks([{ user: A, role: 'Роль', topics: '' }], [{ t: 'x', u: 'http://a' }])).toBe('errUrl');
  expect(validateTeamLinks([{ user: A, role: 'Роль', topics: '' }], [{ t: 'x', u: 'https://a/b' }])).toBe('');
  expect(cleanLinks([{ t: '', u: ' https://a ' }, { t: 'x', u: '' }])).toEqual([{ t: 'Посилання', u: 'https://a' }]);
});
test('teamPlan: новые, изменённые, удалённые строки', () => {
  const before = [M(10, A, 'Замовник'), M(11, B, 'Архітектор', 'інтеграції')];
  const plan = teamPlan(before, [{ id: 10, user: A, role: 'Замовник', topics: 'бюджет' }, { user: B, role: 'Нова' }].map(x => ({ topics: '', ...x })) as TeamRow[]);
  expect(plan.update.map(r => r.id)).toEqual([10]);
  expect(plan.create).toHaveLength(1);
  expect(plan.remove).toEqual([11]);
  expect(teamPlan(before, before.map(x => ({ id: x.id, user: x.user, role: x.role, topics: x.topics })))).toEqual({ create: [], update: [], remove: [] });
});
test('teamText, teamPeople и журнал правки карточки', () => {
  expect(teamText([{ user: A, role: 'Замовник' }, { user: B, role: 'Архітектор' }])).toBe('Анна — Замовник; Борис — Архітектор');
  expect(teamPeople([M(1, A, 'x'), M(2, { ...A, id: 9 }, 'y'), M(3, null, 'z'), M(4, B, 'w')]).map(p => p.id)).toEqual([1, 2]);
  const before = { title: 'P', code: '', department: 'ІТ', priority: '', manager: null, owner: null, budget: 0, links: [{ t: 'Loop', u: 'https://l' }], team: [M(1, A, 'Замовник')] } as unknown as Project;
  const d = { title: 'P', code: '', department: 'ІТ', priority: '', manager: null, owner: null, budget: 0, links: [], team: [{ id: 1, user: A, role: 'Замовник', topics: '' }, { user: B, role: 'Архітектор', topics: '' }] } as unknown as ProjectDraft;
  expect(cardDiff(before, d)).toEqual([{ f: 'links', from: 'Loop', to: '' }, { f: 'team', from: 'Анна — Замовник', to: 'Анна — Замовник; Борис — Архітектор' }]);
});

// R7: строки команды — те же векторы, что у Test-TeamRowAccepted синхронизации (folders.json -> team)
import folderCases from '../../tests/cases/folders.json';
import { teamRowAccepted, teamVisible } from '../src/webparts/pmoPortal/logic/team';
describe('строка команды учитывается (общие векторы с синхронизацией)', () => {
  for (const c of (folderCases as any).team) test(c.name, () => { expect(teamRowAccepted(c.inRoot, c.ready, c.author, c.pm, ['own@x'])).toBe(c.out); });
});
test('приложение: строка в корне у проекта с правами не от PM не показывается; автор без e-mail — приложение', () => {
  const root = '/sites/pmo-test/Lists/ProjectTeam';
  expect(teamVisible({ dir: root, author: { email: 'pmo@x' } }, root, true, 'pm@x')).toBe(false);
  expect(teamVisible({ dir: root + '/', author: { email: 'PM@x' } }, root, true, 'pm@x')).toBe(true);
  expect(teamVisible({ dir: root, author: { email: '' } }, root, true, 'pm@x')).toBe(true);
  expect(teamVisible({ dir: root + '/P12', author: { email: 'pmo@x' } }, root, true, 'pm@x')).toBe(true);
  expect(teamVisible({ dir: root, author: { email: 'pmo@x' } }, root, false, 'pm@x')).toBe(true);
});
test('SpRepo показывает команду только через teamVisible', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal/data/SpRepo.ts'), 'utf8');
  expect(src).toMatch(/team\.filter\(m => m\.projectId === x\.id && teamVisible\(m, teamRoot, !!x\.access/);
});
