import * as React from 'react';
import { Lang } from '../i18n/i18n';

export type Page = 'home' | 'projects' | 'reports' | 'risks' | 'archive';
export interface Ctx {
  t(k: string): string; fl(k: string): string; lang: Lang; today: string;
  /** Переход на вкладку; view — представление («Показати все» на главной). */
  go(page: Page, view?: string): void;
}
export const AppCtx = React.createContext<Ctx>(undefined as unknown as Ctx);
