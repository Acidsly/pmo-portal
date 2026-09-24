/* eslint-disable @typescript-eslint/no-explicit-any -- ответы REST SharePoint */
import { SPHttpClient } from '@microsoft/sp-http';
import { Project, StatusReport, Risk, Comment, ChangeEntry } from './types';
import { mapProject, mapReport, mapRisk, mapComment, mapChange, PROJECT_SELECT, PROJECT_EXPAND, REPORT_SELECT, REPORT_EXPAND, RISK_SELECT, RISK_EXPAND,
  COMMENT_SELECT, COMMENT_EXPAND, CHANGE_SELECT, CHANGE_EXPAND } from './map';
import { applyPending } from '../logic/overlay';

export interface PortalData { projects: Project[]; reports: StatusReport[]; risks: Risk[]; comments: Comment[]; changes: ChangeEntry[]; }

/** Чтение списков портала от имени пользователя: видны только проекты, которые ему открыла синхронизация. */
export class SpRepo {
  constructor(private http: SPHttpClient, private webUrl: string, private webRelUrl: string) {}

  private async items(list: string, select: string, expand: string): Promise<any[]> {
    const listUrl = `${this.webRelUrl.replace(/\/$/, '')}/Lists/${list}`;
    // адрес списка — параметром @u: так SharePoint принимает закодированные символы пути
    let url = `${this.webUrl}/_api/web/GetList(@u)/items?@u='${encodeURIComponent(listUrl)}'&$select=${select}&$expand=${expand}&$top=2000`;
    const out: any[] = [];
    while (url) {
      const res = await this.http.get(url, SPHttpClient.configurations.v1, { headers: { Accept: 'application/json;odata=nometadata' } });
      if (!res.ok) throw new Error(`${list}: ${res.status} ${await res.text()}`);
      const j = await res.json();
      out.push(...j.value);
      url = j['odata.nextLink'] || '';
    }
    return out;
  }

  async loadAll(): Promise<PortalData> {
    const [p, r, k, c, h] = await Promise.all([
      this.items('Projects', PROJECT_SELECT, PROJECT_EXPAND),
      this.items('StatusReports', REPORT_SELECT, REPORT_EXPAND),
      this.items('RisksIssues', RISK_SELECT, RISK_EXPAND),
      this.items('ProjectComments', COMMENT_SELECT, COMMENT_EXPAND),
      this.items('KeyChanges', CHANGE_SELECT, CHANGE_EXPAND)]);
    const reports = r.map(mapReport);
    return { projects: p.map(mapProject).map(x => applyPending(x, reports)), reports, risks: k.map(mapRisk),
      comments: c.map(mapComment), changes: h.map(mapChange) };
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
}
