/** @jest-environment jsdom */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { AppCtx } from '../src/webparts/pmoPortal/components/ctx';
import { makeT } from '../src/webparts/pmoPortal/i18n/i18n';
import { mapReport } from '../src/webparts/pmoPortal/data/map';

// Сверка покрытия раунда 5 (отзывы 81–90, колокольчик): поведение в приложении, которого не было в других тестах
jest.mock('@microsoft/sp-http', () => ({ SPHttpClient: { configurations: { v1: {} } } }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SpRepo } = require('../src/webparts/pmoPortal/data/SpRepo');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ProjectCard } = require('../src/webparts/pmoPortal/panels/ProjectCard');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { NotifyPanel } = require('../src/webparts/pmoPortal/panels/NotifyPanel');

const tt = makeT(0);
const ctx: any = { ...tt, lang: 0, today: '2026-10-12', me: 'b@x', webUrl: '', views: {}, go() { /* */ }, setView() { /* */ }, openProject() { /* */ },
  openForm() { /* */ }, repo: {}, canCreate: false, reload: async () => undefined, toast() { /* */ } };
let root: HTMLDivElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { ReactDOM.unmountComponentAtNode(root); root.remove(); });
const person = (email: string, name = email): any => ({ id: 1, name, email });

describe('«Відгуки — загальні»: чтение', () => {
  const fake = (withField: boolean): any => {
    const repo = new SpRepo(null as any, 'https://x/sites/t', '/sites/t', 'me@x');
    repo.items = async (list: string, select: string) => {
      if (list === 'FeedbackPublic') {
        if (select.indexOf('fpDecidedAt') >= 0 && !withField) throw new Error('400: field fpDecidedAt does not exist');
        return [{ Id: 1, fpId: 84, fpCreated: '2026-10-08', fpAuthor: 'Я', fpText: 'Т', fpStatus: 'Зроблено', fpAnswer: 'Готово', fpShots: 0, fpDecidedAt: withField ? '2026-10-12T08:00:00Z' : undefined },
          { Id: 2, fpId: 85, fpCreated: '2026-10-08', fpAuthor: 'Інший', fpText: 'Т2', fpStatus: 'Новий', fpAnswer: '', fpShots: 0 }];
      }
      return [{ Id: 84, Created: '2026-10-08', fbText: 'Т', fbStatus: 'Зроблено', fbAnswer: 'Готово', Author: { Title: 'Я', EMail: 'Me@x' }, AttachmentFiles: [] }];
    };
    return repo;
  };
  test('поля «Розглянуто» ещё нет — общий список читается без него (чужие отзывы не пропадают)', async () => {
    const rows = await fake(false).loadFeedback();
    expect(rows.map((r: any) => r.id)).toEqual([85, 84]);
    expect(rows.find((r: any) => r.id === 84).decidedAt).toBeUndefined();
  });
  test('поле есть — у моего отзыва «розглянуто» из общего списка', async () => {
    const rows = await fake(true).loadFeedback();
    const mine = rows.find((r: any) => r.id === 84);
    expect(mine.mine).toBe(true); expect(mine.decidedAt).toBe('2026-10-12T08:00:00Z');
  });
});

describe('карточка проекта', () => {
  const rep = (id: number, date: string): any => ({ id, projectId: 7, date, period: '', periodFrom: '', schedule: 'Зелений', budget: 'Зелений', resources: 'Зелений', title: 'Звіт ' + id,
    done: '', next: '', issues: '', decision: false, decisionText: '', applied: true, author: person('pm@x', 'PM'), approval: 'Погоджено', approvedBy: null, approvedAt: '', approvalNote: '' });
  const P: any = { id: 7, code: 'PRJ-007', title: 'П', status: 'Реалізація', type: 'Звичайний', priority: '', rag: 'Зелений', progress: 10, start: '', goLive: '', planEnd: '', forecastEnd: '',
    manager: person('pm@x', 'PM'), owner: null, stakeholders: [], team: [], links: [], description: '', canEdit: false, budget: 0, actualCost: 0, lastUpdate: '', lastReport: '', lastComment: '', department: '' };
  const journal = [
    { id: 1, projectId: 7, date: '2026-10-12T10:00:00Z', who: person('pm@x', 'PM'), kind: 'Редагування картки', field: 'pmTeam', from: '', to: 'B — Аналітик', reason: '' },
    { id: 2, projectId: 7, date: '2026-10-12T10:00:00Z', who: person('pm@x', 'PM'), kind: 'Редагування картки', field: 'teamIn', from: '', to: 'b@x', reason: '' },
    { id: 3, projectId: 7, date: '2026-10-11T09:00:00Z', who: person('pm@x', 'PM'), kind: 'Редагування картки', field: 'teamIn', from: '', to: 'c@x', reason: '' }];
  const mountCard = async (n: number): Promise<void> => {
    const data: any = { projects: [P], reports: Array.from({ length: n }, (_, i) => rep(i + 1, `2026-09-${String(10 + i).padStart(2, '0')}`)), risks: [], comments: [], approvals: [], team: [] };
    const repo: any = { jobTitle: async () => '', loadChanges: async () => journal, fresh: async () => ({ project: { canEdit: false } }) };
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={ctx}><ProjectCard project={P} data={data} repo={repo} onClose={() => undefined} /></AppCtx.Provider>, root); await Promise.resolve(); await Promise.resolve(); });
  };
  const sec = (h: string): HTMLElement => Array.from(root.querySelectorAll('.sec')).find(s => (s.querySelector('h3') as HTMLElement).textContent!.indexOf(h) === 0) as HTMLElement;
  test('#82 «Статус-звіти»: три последних, «Показати всі звіти (N)» — все, «Згорнути» — снова три; до трёх — без кнопки', async () => {
    await mountCard(5);
    expect(sec('Статус-звіти').querySelectorAll('.rep').length).toBe(3);
    expect(sec('Статус-звіти').querySelector('.rep b')!.textContent).toBe('14.09.2026');   // новые сверху
    const b = sec('Статус-звіти').querySelector('button.more') as HTMLElement; expect(b.textContent).toBe('Показати всі звіти (5)');
    act(() => { b.click(); }); expect(sec('Статус-звіти').querySelectorAll('.rep').length).toBe(5);
    expect((sec('Статус-звіти').querySelector('button.more') as HTMLElement).textContent).toBe('Згорнути');
    act(() => { (sec('Статус-звіти').querySelector('button.more') as HTMLElement).click(); }); expect(sec('Статус-звіти').querySelectorAll('.rep').length).toBe(3);
    ReactDOM.unmountComponentAtNode(root);
    await mountCard(3); expect(sec('Статус-звіти').querySelector('button.more')).toBeNull();
  });
  test('#84 «Історія змін»: служебные отметки команды не показываются; событие из одних отметок — скрыто', async () => {
    await mountCard(1);
    const h = sec('Історія змін');
    expect(h.textContent).toContain('B — Аналітик');
    expect(h.textContent).not.toContain('b@x'); expect(h.textContent).not.toContain('c@x');
    expect(h.querySelectorAll('.chg').length).toBe(1);
  });
});

describe('#84 колокольчик: «Вас додано до команди» — с моей ролью', () => {
  test('строка «Ваша роль: …» вместо полей правки; нажатие открывает карточку', async () => {
    const opened: string[] = [];
    const P: any = { id: 7, code: 'PRJ-007', title: 'П', status: 'Реалізація', manager: person('pm@x', 'PM'), owner: null, stakeholders: [], team: [{ user: person('b@x', 'B'), role: 'Аналітик' }] };
    const now = new Date().toISOString();
    const data: any = { projects: [P], risks: [], comments: [], feedbackRows: [], canApprove: false, notify: { id: 1, readId: 0, readCmId: 0, seen: [] },
      recent: [{ id: 2, projectId: 7, date: now, who: person('pm@x', 'PM'), kind: 'Редагування картки', field: 'pmTeam', from: '', to: 'B — Аналітик', reason: '' },
        { id: 3, projectId: 7, date: now, who: person('pm@x', 'PM'), kind: 'Редагування картки', field: 'teamIn', from: '', to: 'b@x', reason: '' }] };
    const c2 = { ...ctx, repo: { markRead: async () => undefined } };
    await act(async () => { ReactDOM.render(<AppCtx.Provider value={c2}><NotifyPanel data={data} onOpen={(f: string, id: number) => opened.push(`${f}@${id}`)} onCancel={() => undefined} /></AppCtx.Provider>, root); await Promise.resolve(); });
    const it = Array.from(root.querySelectorAll('.ntf-i')).find(x => x.textContent!.indexOf('Вас додано до команди') >= 0) as HTMLElement;
    expect(it).toBeTruthy(); expect(it.textContent).toContain('PRJ-007 · П'); expect(it.textContent).toContain('Ваша роль: Аналітик');
    expect(it.querySelector('.diffs')).toBeNull();
    await act(async () => { it.click(); await Promise.resolve(); }); expect(opened).toEqual(['@7']);
  });
});

test('#89 окно прокрутки таблицы — фокусируемое (прокрутка с клавиатуры)', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/webparts/pmoPortal/components/DataTable.tsx'), 'utf8');
  expect(src).toMatch(/className=\{'tablewrap dt'[^}]*\} ref=\{tableRef\} tabIndex=\{0\}/);
  const proto = require('fs').readFileSync(require('path').join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
  expect(proto).toMatch(/class="tablewrap dt\$\{[^}]*\}" data-tkey="\$\{key\}" tabindex="0"/);
});

describe('отчёты и поля помощника ИИ', () => {
  const fake = (withField: boolean): any => {
    const repo = new SpRepo(null as any, 'https://x/sites/t', '/sites/t', 'me@x');
    repo.items = async (list: string, select: string) => {
      if (select.indexOf('srAiCheck') >= 0 && !withField) throw new Error('400: field srAiCheck does not exist');
      return [{ Id: 5, srProjectId: 1, srDate: '2026-10-13', srAiCheck: withField ? '1. Пункт' : undefined, srAiCheckedAt: withField ? '2026-10-13T18:30:00Z' : undefined }];
    };
    return repo;
  };
  test('полей ИИ ещё нет на сайте — отчёты читаются без них (не пропадают)', async () => {
    const rows = (await fake(false).reportRows()).map(mapReport);
    expect(rows.map((r: any) => r.id)).toEqual([5]); expect(rows[0].aiCheck).toBe('');
  });
  test('поля есть — текст и время проверки', async () => {
    const r = (await fake(true).reportRows()).map(mapReport)[0];
    expect([r.aiCheck, r.aiCheckedAt]).toEqual(['1. Пункт', '2026-10-13T18:30:00Z']);
  });
});
