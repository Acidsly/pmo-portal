/* eslint-disable @typescript-eslint/no-explicit-any -- ответы REST SharePoint */
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { Project, StatusReport, Risk, Comment, ChangeEntry, Person, FeedbackRow, Approval } from './types';
import { mapProject, mapReport, mapRisk, mapComment, mapChange, PROJECT_SELECT, PROJECT_EXPAND, REPORT_SELECT, REPORT_EXPAND, RISK_SELECT, RISK_EXPAND,
  COMMENT_SELECT, COMMENT_EXPAND, CHANGE_SELECT, CHANGE_EXPAND, TEAM_SELECT, TEAM_EXPAND, mapTeam, APPROVAL_SELECT, APPROVAL_EXPAND, mapApproval, ASSIGN_SELECT, ASSIGN_EXPAND, mapAssign, canAdd, canManage,
  withoutFolders, CHANGES_ON_LOAD, changesOf, changesSince, NOTIFY_SELECT, mapNotify } from './map';
import { withApproval, approvedIds as approvedOf, pendingReports, latestReport } from '../logic/approval';
import { applyAssignments } from '../logic/assign';
import { NOTIFY_DAYS, ReadMarks, mergeMarks } from '../logic/notify';
import { teamPeople, teamVisible } from '../logic/team';
import { applyPending } from '../logic/overlay';
import { Regional, regionalFrom, toFormValues } from './formValues';
import { applyState, parseState, StateJson } from '../logic/state';
import { Fresh } from '../logic/guard';

export type WritableList = 'Projects' | 'StatusReports' | 'RisksIssues' | 'ProjectComments' | 'Feedback' | 'ProjectTeam' | 'ReportApprovals' | 'ProjectAssignments' | 'NotifyState';

export interface PortalData { projects: Project[]; reports: StatusReport[]; risks: Risk[]; comments: Comment[];
  /** Журнал — только переносы плановой даты (главная, «Зсуви термінів»); весь журнал проекта — SpRepo.loadChanges. */
  changes: ChangeEntry[];
  /** Может ли пользователь заводить проекты (право добавления в «Проєкти» есть у PMO). */
  canCreate: boolean;
  /** Может погоджувати статус-отчёты: PMO и владельцы сайта (у них же право заводить проекты; погодження добавляются в папке проекта). */
  canApprove: boolean;
  approvals: Approval[];
  /** На сайте есть список «Відгуки» (тест с фокус-группой) — показывается кнопка «Відгук». */
  feedback: boolean;
  /** Может разбирать все отзывы (PMO): ссылка на список «Відгуки» из формы отзыва. */
  feedbackAdmin: boolean;
  /** Страница «Відгуки»: все отзывы с решениями (пусто, если списка нет). */
  feedbackRows: FeedbackRow[];
  /** Сповіщення: журнал за 14 дней (видимые проекты) и своя строка «Прочитане» (null — строки ещё нет). */
  recent: ChangeEntry[]; notify: { id: number; readId: number; readCmId: number; seen: string[] } | null; }

/** Чтение списков портала от имени пользователя: видны только проекты, которые ему открыла синхронизация. */
export class SpRepo {
  constructor(private http: SPHttpClient, private webUrl: string, private webRelUrl: string, private me: string = '') {}

  private async items(list: string, select: string, expand: string, filter = ''): Promise<any[]> {
    const listUrl = `${this.webRelUrl.replace(/\/$/, '')}/Lists/${list}`;
    // адрес списка — параметром @u: так SharePoint принимает закодированные символы пути; фильтр — только по индексированным полям (порог 5000)
    let url = `${this.webUrl}/_api/web/GetList(@u)/items?@u='${encodeURIComponent(listUrl)}'&$select=${select},FileSystemObjectType${expand ? '&$expand=' + expand : ''}` +
      `${filter ? '&$filter=' + encodeURIComponent(filter) : ''}&$top=2000`;
    const out: any[] = [];
    while (url) {
      const res = await this.http.get(url, SPHttpClient.configurations.v1, { headers: { Accept: 'application/json;odata=nometadata' } });
      if (!res.ok) throw new Error(`${list}: ${res.status} ${await res.text()}`);
      const j = await res.json();
      out.push(...withoutFolders(j.value));
      url = j['odata.nextLink'] || '';
    }
    return out;
  }

  private async listPerms(list: string): Promise<{ High: string; Low: string } | undefined> {
    const listUrl = `${this.webRelUrl.replace(/\/$/, '')}/Lists/${list}`;
    const res = await this.http.get(`${this.webUrl}/_api/web/GetList(@u)?@u='${encodeURIComponent(listUrl)}'&$select=EffectiveBasePermissions`,
      SPHttpClient.configurations.v1, { headers: { Accept: 'application/json;odata=nometadata' } });
    return res.ok ? (await res.json()).EffectiveBasePermissions : undefined;
  }

  async loadAll(): Promise<PortalData> {
    const since = new Date(Date.now() - NOTIFY_DAYS * 864e5).toISOString();
    const [p, r, k, c, h, tm, ap, ps, perm, fbPerm, pa, rc, ns] = await Promise.all([
      this.items('Projects', PROJECT_SELECT, PROJECT_EXPAND),
      this.items('StatusReports', REPORT_SELECT, REPORT_EXPAND),
      this.items('RisksIssues', RISK_SELECT, RISK_EXPAND),
      this.items('ProjectComments', COMMENT_SELECT, COMMENT_EXPAND),
      this.items('KeyChanges', CHANGE_SELECT, CHANGE_EXPAND, CHANGES_ON_LOAD),
      this.items('ProjectTeam', TEAM_SELECT, TEAM_EXPAND).catch(() => [] as any[]),
      // null — списка «Погодження звітів» нет (до развёртывания): тогда «Погоджено» в отчёте действует как раньше
      this.items('ReportApprovals', APPROVAL_SELECT, APPROVAL_EXPAND).catch(() => null as any[] | null),
      // эталон ключевых полей (пишет только синхронизация); до развёртывания списка нет — пусто
      this.items('ProjectState', 'Id,psProject,psState,psLastApplied', '').catch(() => [] as any[]),
      this.listPerms('Projects').catch(() => undefined),
      this.listPerms('Feedback').catch(() => undefined),
      // «Призначення» (#43) — до развёртывания списка нет: пусто
      this.items('ProjectAssignments', ASSIGN_SELECT, ASSIGN_EXPAND).catch(() => [] as any[]),
      // сповіщення: журнал за 14 дней и своя строка «Прочитане» (до развёртывания — пусто / null)
      this.items('KeyChanges', CHANGE_SELECT, CHANGE_EXPAND, changesSince(since)).catch(() => [] as any[]),
      this.items('NotifyState', NOTIFY_SELECT, '', `Title eq '${this.me.toLowerCase().replace(/'/g, "''")}'`).catch(() => [] as any[])]);
    const approvals = (ap || []).map(mapApproval);
    const assigns = pa.map(mapAssign);
    // решение PMO, ещё не перенесённое синхронизацией, видно сразу (как применение отчёта в карточку)
    const reports = r.map(mapReport).map(x => withApproval(x, approvals));
    const feedbackRows = fbPerm ? await this.loadFeedback().catch(() => []) : [];
    const team = tm.map(mapTeam);
    const states: Record<number, StateJson | undefined> = {}; const lastApplied: Record<number, string> = {};
    for (const x of ps) { states[Number(x.psProject)] = parseState(x.psState); lastApplied[Number(x.psProject)] = String(x.psLastApplied || ''); }
    // «Погоджено» действует только по действующему решению PMO — общим правилом с синхронизацией (logic/approval.ts)
    const approvedIds = approvedOf(reports, approvals);
    // отчёты по проектам один раз (без перебора всех отчётов для каждого проекта)
    const byProj: Record<number, StatusReport[]> = {};
    for (const x of reports) (byProj[x.projectId] = byProj[x.projectId] || []).push(x);
    // стейкхолдеры — люди «Команда проєкту» (синхронизация повторяет их в pmStakeholders)
    // R7: строка в корне у проекта с выданными правами не от PM — синхронизация её не учитывает, приложение тоже не показывает
    const teamRoot = `${this.webRelUrl.replace(/\/$/, '')}/Lists/ProjectTeam`;
    const withTeam = (x: Project): Project => { const own = team.filter(m => m.projectId === x.id && teamVisible(m, teamRoot, !!x.access, x.manager ? x.manager.email : '')); return { ...x, team: own, stakeholders: teamPeople(own) }; };
    return { projects: p.map(mapProject).map(x => ({ ...applyState(x, states[x.id]), lastApplied: lastApplied[x.id] || '' })).map(withTeam)
      .map(x => applyPending(x, byProj[x.id] || [], ap ? approvedIds : undefined)).map(x => applyAssignments(x, assigns))
      .map(x => { const pr = pendingReports(byProj[x.id] || [])[0]; return { ...x, pendingDate: pr ? pr.date : undefined, lastRep: latestReport(byProj[x.id] || []) }; }), reports, risks: k.map(mapRisk),
      comments: c.map(mapComment), changes: h.map(mapChange), canCreate: canAdd(perm), canApprove: canAdd(perm), approvals, feedback: canAdd(fbPerm), feedbackAdmin: canManage(fbPerm), feedbackRows,
      recent: rc.map(mapChange), notify: ns[0] ? mapNotify(ns[0]) : null };
  }

  /** Сповіщення: отметить прочитанным (своя строка «Прочитане», свежая версия, метки только растут). */
  async markRead(next: ReadMarks): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const rows = await this.items('NotifyState', NOTIFY_SELECT, '', `Title eq '${this.me.toLowerCase().replace(/'/g, "''")}'`);
      if (!rows[0]) return;
      const j = await this.getJson(this.itemUrl('NotifyState', rows[0].Id, NOTIFY_SELECT, ''), true);
      const cur = mapNotify(j);
      const m = mergeMarks(cur, next);
      const body = { nsReadId: m.readId, nsReadCmId: m.readCmId, nsReadSet: JSON.stringify(m.seen || []) };
      if (body.nsReadId === cur.readId && body.nsReadCmId === cur.readCmId && body.nsReadSet === JSON.stringify(cur.seen)) return;
      try { await this.update('NotifyState', cur.id, body, String(j['odata.etag'] || '')); return; } catch (x) { if ((x as Error).message !== 'conflict' || attempt) throw x; }
    }
  }

  /** Весь журнал «Зміни показників» одного проекта — для карточки (при загрузке приложения — только переносы плановой даты). */
  async loadChanges(projectId: number): Promise<ChangeEntry[]> {
    return (await this.items('KeyChanges', CHANGE_SELECT, CHANGE_EXPAND, changesOf(projectId))).map(mapChange);
  }

  /** Отзывы: общий список (все видят все) + «Відгуки» (свои или все — у администратора) со скриншотами; свежие, ещё не скопированные синхронизацией, — тоже. */
  private async loadFeedback(): Promise<FeedbackRow[]> {
    const [pub, own] = await Promise.all([
      this.items('FeedbackPublic', 'Id,fpId,fpCreated,fpAuthor,fpScreen,fpText,fpStatus,fpAnswer,fpShots', '').catch(() => [] as any[]),
      this.items('Feedback', 'Id,Created,fbScreen,fbText,fbStatus,fbAnswer,Author/Title,Author/EMail,AttachmentFiles', 'Author,AttachmentFiles')]);
    const me = (this.me || '').toLowerCase();
    const byId: Record<number, FeedbackRow> = {};
    for (const x of pub) byId[x.fpId] = { id: x.fpId, created: String(x.fpCreated || ''), author: String(x.fpAuthor || ''), screen: String(x.fpScreen || ''),
      text: String(x.fpText || ''), status: String(x.fpStatus || 'Новий'), answer: String(x.fpAnswer || ''), shots: Number(x.fpShots) || 0, mine: false, files: [] };
    for (const x of own) {
      const files = (x.AttachmentFiles || []).map((a: any) => ({ name: String(a.FileName), url: String(a.ServerRelativeUrl) }));
      byId[x.Id] = { id: x.Id, created: String(x.Created || ''), author: String((x.Author && x.Author.Title) || ''), screen: String(x.fbScreen || ''),
        text: String(x.fbText || ''), status: String(x.fbStatus || 'Новий'), answer: String(x.fbAnswer || ''), shots: files.length,
        mine: !!x.Author && String(x.Author.EMail || '').toLowerCase() === me, files };
    }
    return Object.keys(byId).map(k => byId[Number(k)]).sort((a, b) => b.id - a.id);
  }

  private titles: Record<string, Promise<string>> = {};
  /** Должность из профиля SharePoint (для карточки: «роль · e-mail»); пусто, если профиль недоступен. */
  jobTitle(email: string): Promise<string> {
    const k = email.toLowerCase();
    if (!this.titles[k]) {
      const acc = encodeURIComponent(`'i:0#.f|membership|${k}'`);
      this.titles[k] = this.http.get(`${this.webUrl}/_api/SP.UserProfiles.PeopleManager/GetPropertiesFor(accountName=@v)?@v=${acc}&$select=Title`,
        SPHttpClient.configurations.v1, { headers: { Accept: 'application/json;odata=nometadata' } })
        .then(r => (r.ok ? r.json() : { Title: '' })).then(j => String(j.Title || '')).catch(() => '');
    }
    return this.titles[k];
  }

  // ---------- запись от имени пользователя ----------
  private listItems(list: WritableList): string {
    return `${this.webUrl}/_api/web/GetList(@u)/items`;
  }
  private listQuery(list: WritableList): string {
    return `@u='${encodeURIComponent(`${this.webRelUrl.replace(/\/$/, '')}/Lists/${list}`)}'`;
  }
  private async check(res: SPHttpClientResponse, what: string): Promise<SPHttpClientResponse> {
    if (!res.ok) throw new Error(`${what}: ${res.status} ${await res.text()}`);
    return res;
  }
  private static readonly JSON_HEADERS = { Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' };

  /** Новый элемент списка; возвращает Id. */
  async create(list: WritableList, body: Record<string, unknown>): Promise<number> {
    const res = await this.http.post(`${this.listItems(list)}?${this.listQuery(list)}`, SPHttpClient.configurations.v1,
      { headers: SpRepo.JSON_HEADERS, body: JSON.stringify(body) });
    return (await (await this.check(res, list)).json()).Id;
  }

  private regional?: Promise<Regional>;
  /** Регіональні налаштування сайта (разделитель дроби, порядок даты) — один раз за сессию. */
  private regionalSettings(): Promise<Regional> {
    if (!this.regional) {
      this.regional = this.http.get(`${this.webUrl}/_api/web/RegionalSettings?$select=DecimalSeparator,DateFormat,DateSeparator`, SPHttpClient.configurations.v1,
        { headers: { Accept: 'application/json;odata=nometadata' } }).then(r => (r.ok ? r.json() : undefined)).then(regionalFrom).catch(() => regionalFrom(undefined));
    }
    return this.regional;
  }

  /** Новый элемент сразу в папке проекта P<ID> (права папки: в чужой проект и в корень записать нельзя). users — e-mail полей «Користувач».
   *  Ошибки: notReady — папки ещё нет (новый проект, синхронизация не прошла); noRights — нет права добавлять. */
  async createIn(list: WritableList, projectId: number, body: Record<string, unknown>, users: Record<string, string> = {}): Promise<number> {
    const listRel = `${this.webRelUrl.replace(/\/$/, '')}/Lists/${list}`;
    const payload = { listItemCreateInfo: { FolderPath: { DecodedUrl: `${listRel}/P${projectId}` }, UnderlyingObjectType: 0 },
      formValues: toFormValues(list, body, await this.regionalSettings(), users), bNewDocumentUpdate: false };
    const res = await this.http.post(`${this.webUrl}/_api/web/GetList(@u)/AddValidateUpdateItemUsingPath()?@u='${encodeURIComponent(listRel)}'`,
      SPHttpClient.configurations.v1, { headers: SpRepo.JSON_HEADERS, body: JSON.stringify(payload) });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 403 || /UnauthorizedAccess|E_ACCESSDENIED/i.test(txt)) throw new Error('noRights');
      if (res.status === 404 || /2147024893|не існує|does not exist|not found/i.test(txt)) throw new Error('notReady');
      throw new Error(`${list}: ${res.status} ${txt}`);
    }
    const vals: { FieldName: string; FieldValue: string; HasException: boolean; ErrorMessage: string }[] = (await res.json()).value || [];
    const bad = vals.filter(v => v.HasException);
    if (bad.length) throw new Error(`${list}: ${bad.map(v => `${v.FieldName}: ${v.ErrorMessage}`).join('; ')}`);
    const idv = vals.filter(v => v.FieldName === 'Id')[0];
    return idv ? Number(idv.FieldValue) : 0;
  }

  /** Правка элемента (MERGE): меняются только переданные поля. etag — версия записи, прочитанная перед записью (If-Match):
   *  если запись успели изменить, SharePoint отвечает 412 — ошибка «conflict», правка не перезаписывает чужую. */
  async update(list: WritableList, id: number, body: Record<string, unknown>, etag?: string): Promise<void> {
    const res = await this.http.post(`${this.listItems(list)}(${id})?${this.listQuery(list)}`, SPHttpClient.configurations.v1,
      { headers: { ...SpRepo.JSON_HEADERS, 'X-HTTP-Method': 'MERGE', 'IF-MATCH': etag || '*' }, body: JSON.stringify(body) });
    if (res.status === 412) throw new Error('conflict');
    if (res.status === 403) throw new Error('noRights');
    await this.check(res, `${list} #${id}`);
  }

  private async getJson(url: string, meta = false): Promise<any> {
    const res = await this.http.get(url, SPHttpClient.configurations.v1, { headers: { Accept: meta ? 'application/json;odata=minimalmetadata' : 'application/json;odata=nometadata' } });
    if (res.status === 403 || res.status === 404) throw new Error('noRights');
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }
  private itemUrl(list: string, id: number, select: string, expand: string): string {
    const listUrl = `${this.webRelUrl.replace(/\/$/, '')}/Lists/${list}`;
    return `${this.webUrl}/_api/web/GetList(@u)/items(${id})?@u='${encodeURIComponent(listUrl)}'&$select=${select}${expand ? '&$expand=' + expand : ''}`;
  }

  /** Свежее состояние проекта перед записью: карточка (с эталоном и наложением погодженых отчётов), версия, права,
   *  отчёты на погодженні, дата последнего погодженого; для погодження — состояние отчёта и решения PMO по нему. */
  async fresh(projectId: number, reportId = 0): Promise<Fresh> {
    const [pj, st, reps, aps, pas] = await Promise.all([
      this.getJson(this.itemUrl('Projects', projectId, PROJECT_SELECT, PROJECT_EXPAND), true),
      this.items('ProjectState', 'Id,psProject,psState,psLastApplied', '', `psProject eq ${projectId}`).catch(() => [] as any[]),
      this.items('StatusReports', REPORT_SELECT, REPORT_EXPAND, `srProjectId eq ${projectId}`),
      this.items('ReportApprovals', APPROVAL_SELECT, APPROVAL_EXPAND, `apProjectId eq ${projectId}`).catch(() => null as any[] | null),
      this.items('ProjectAssignments', ASSIGN_SELECT, ASSIGN_EXPAND, `paProjectId eq ${projectId}`).catch(() => [] as any[])]);
    const approvals = (aps || []).map(mapApproval);
    const assigns = pas.map(mapAssign);
    const reports = reps.map(mapReport).map(x => withApproval(x, approvals));
    const approvedIds = approvedOf(reports, approvals);
    const base = { ...applyState(mapProject(pj), st[0] ? parseState(st[0].psState) : undefined), lastApplied: st[0] ? String(st[0].psLastApplied || '') : '' };
    const project = applyAssignments(applyPending(base, reports, aps ? approvedIds : undefined), assigns);
    const pending = pendingReports(reports).map(r => ({ id: r.id, date: r.date, author: r.author ? r.author.email.toLowerCase() : '' }));
    const lastApprovedDate = reports.filter(r => r.approval === 'Погоджено').reduce((m, r) => (r.date > m ? r.date : m), '');
    const rep = reportId ? reports.filter(r => r.id === reportId)[0] : undefined;
    return { project, etag: String(pj['odata.etag'] || ''), owner: canManage(pj.EffectiveBasePermissions), pending, lastApprovedDate, assigns: assigns.filter(a => !a.applied).length,
      report: rep ? { id: rep.id, approval: rep.approval || 'На погодженні', author: rep.author ? rep.author.email.toLowerCase() : '',
        decisions: approvals.filter(a => a.reportId === rep.id && !a.applied).length } : undefined };
  }

  /** Свежая запись риска: версия и значения (конфликт правок). */
  async freshRisk(id: number): Promise<{ etag: string; risk: Risk }> {
    const j = await this.getJson(this.itemUrl('RisksIssues', id, RISK_SELECT, RISK_EXPAND), true);
    return { etag: String(j['odata.etag'] || ''), risk: mapRisk(j) };
  }

  /** Отметка изменений списков портала: самое позднее изменение записей (один лёгкий запрос). */
  async stamp(): Promise<string> {
    const j = await this.getJson(`${this.webUrl}/_api/web/lists?$select=Title,LastItemModifiedDate,RootFolder/ServerRelativeUrl&$expand=RootFolder&$filter=Hidden eq true`);
    // эталон синхронизация пишет каждый запуск — по нему не перечитываем (иначе полная перезагрузка каждые 5 минут);
    // журнал — только при событиях: по нему перечитываем, чтобы точка колокольчика появилась без перезагрузки страницы;
    // «Прочитане» — нет: чужие отметки «прочитано» не должны перезагружать данные у всех
    const portal = ['/Lists/Projects', '/Lists/StatusReports', '/Lists/RisksIssues', '/Lists/ProjectComments', '/Lists/ProjectTeam', '/Lists/ReportApprovals', '/Lists/ProjectAssignments', '/Lists/KeyChanges'];
    return (j.value || []).filter((l: any) => l.RootFolder && portal.some(u => String(l.RootFolder.ServerRelativeUrl).endsWith(u)))
      .reduce((m: string, l: any) => (String(l.LastItemModifiedDate) > m ? String(l.LastItemModifiedDate) : m), '');
  }

  /** В корзину сайта (восстанавливается): строка команды, которую PM убрал из карточки. */
  async recycle(list: WritableList, id: number): Promise<void> {
    const res = await this.http.post(`${this.listItems(list)}(${id})/recycle()?${this.listQuery(list)}`, SPHttpClient.configurations.v1,
      { headers: SpRepo.JSON_HEADERS });
    await this.check(res, `${list} #${id}`);
  }

  /** Вложение к элементу (скриншот отзыва). */
  async attach(list: WritableList, id: number, name: string, file: Blob): Promise<void> {
    const res = await this.http.post(`${this.listItems(list)}(${id})/AttachmentFiles/add(FileName='${encodeURIComponent(name.replace(/'/g, ''))}')?${this.listQuery(list)}`,
      SPHttpClient.configurations.v1, { headers: { Accept: 'application/json;odata=nometadata' }, body: file });
    await this.check(res, `${list} #${id}: ${name}`);
  }

  /** Id пользователя на сайте (добавляет его на сайт при первом выборе) — для полей «Користувач». */
  async ensureUser(email: string): Promise<number> {
    const res = await this.http.post(`${this.webUrl}/_api/web/ensureuser`, SPHttpClient.configurations.v1,
      { headers: SpRepo.JSON_HEADERS, body: JSON.stringify({ logonName: `i:0#.f|membership|${email}` }) });
    return (await (await this.check(res, 'ensureuser')).json()).Id;
  }

  /** Поиск людей тенанта (как поле «Користувач» SharePoint), до 8 человек; id = 0 до ensureUser. */
  async searchPeople(q: string): Promise<Person[]> {
    if (q.trim().length < 2) return [];
    const res = await this.http.post(`${this.webUrl}/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`,
      SPHttpClient.configurations.v1, { headers: SpRepo.JSON_HEADERS, body: JSON.stringify({ queryParams: {
        QueryString: q, MaximumEntitySuggestions: 8, PrincipalType: 1, PrincipalSource: 15, AllowEmailAddresses: true, AllowMultipleEntities: false } }) });
    const raw = JSON.parse((await (await this.check(res, 'people')).json()).value || '[]') as any[];
    return raw.map(x => ({ id: 0, name: String(x.DisplayText || ''), email: String((x.EntityData && x.EntityData.Email) || '') })).filter(x => x.email);
  }
}
