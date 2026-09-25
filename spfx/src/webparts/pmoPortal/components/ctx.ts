import * as React from 'react';
import { Lang } from '../i18n/i18n';
import { ProjectView, ReportView, RiskView } from '../logic/views';
import { SpRepo } from '../data/SpRepo';

export type Page = 'home' | 'projects' | 'reports' | 'risks' | 'archive';
export interface Views { projects: ProjectView; reports: ReportView; risks: RiskView; }
export interface Ctx {
  t(k: string): string; fl(k: string): string; lang: Lang; today: string;
  /** e-mail текущего пользователя (представление «Мої проєкти»). */
  me: string;
  webUrl: string;
  /** Представление хранится отдельно для каждой вкладки (как state.pv / rv / kv прототипа). */
  views: Views;
  /** Переход на вкладку; view — представление этой вкладки («Показати все» на главной). */
  go(page: Page, view?: string): void;
  setView<K extends keyof Views>(page: K, view: Views[K]): void;
  openProject(id: number): void;
  /** Формы в панели: report, project (новый), edit (правка карточки), risk:<id> / risk:new. */
  openForm(form: string, projectId?: number): void;
  repo: SpRepo;
  /** Перечитать данные после сохранения. */
  reload(): Promise<void>;
  toast(m: string): void;
}
export const AppCtx = React.createContext<Ctx>(undefined as unknown as Ctx);
