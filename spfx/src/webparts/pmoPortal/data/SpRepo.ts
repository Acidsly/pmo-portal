/* eslint-disable @typescript-eslint/no-explicit-any -- ответы REST SharePoint */
import { SPHttpClient } from '@microsoft/sp-http';
import { Project, StatusReport, Risk } from './types';
import { mapProject, mapReport, mapRisk, PROJECT_SELECT, PROJECT_EXPAND, REPORT_SELECT, REPORT_EXPAND, RISK_SELECT, RISK_EXPAND } from './map';
import { applyPending } from '../logic/overlay';

export interface PortalData { projects: Project[]; reports: StatusReport[]; risks: Risk[]; }

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
    const [p, r, k] = await Promise.all([
      this.items('Projects', PROJECT_SELECT, PROJECT_EXPAND),
      this.items('StatusReports', REPORT_SELECT, REPORT_EXPAND),
      this.items('RisksIssues', RISK_SELECT, RISK_EXPAND)]);
    const reports = r.map(mapReport);
    return { projects: p.map(mapProject).map(x => applyPending(x, reports)), reports, risks: k.map(mapRisk) };
  }
}
