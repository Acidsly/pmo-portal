import V from '../../tests/cases/parent.json';
import { parentChoices, childrenOf } from '../src/webparts/pmoPortal/logic/projects';

// Батьківський проєкт: варианты выбора и дочерние (общие векторы tests/cases/parent.json — их же прогоняет прототип)
const P = V.projects.map(x => ({ id: x.id, parentId: x.parent }));
describe('варианты «Батьківський проєкт»', () => {
  test.each(V.choices.map(c => [c.name, c]))('%s', (_, c: any) => expect(parentChoices(P, c.self).map(x => x.id)).toEqual(c.out));
});
describe('дочерние проекты', () => {
  test.each(V.children.map(c => [c.name, c]))('%s', (_, c: any) => expect(childrenOf(P, c.id).map(x => x.id)).toEqual(c.out));
});
