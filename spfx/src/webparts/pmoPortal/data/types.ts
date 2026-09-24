import { Rag } from '../logic/rag';

export interface Person { id: number; name: string; email: string; }

export interface Project {
  id: number; code: string; title: string; type: string; priority: string;
  manager: Person | null; owner: Person | null; stakeholders: Person[]; department: string;
  status: string; rag: Rag; progress: number; start: string; goLive: string; planEnd: string; forecastEnd: string;
  archivedAt: string; budget: number; actualCost: number; lastUpdate: string; lastReport: string; lastComment: string;
  loop: string; description: string;
  /** Пользователь может редактировать элемент (права выдала синхронизация). */
  canEdit: boolean;
  /** На экране учтён неприменённый отчёт — синхронизация ещё не записала его в карточку. */
  pending: boolean;
}

export interface StatusReport {
  id: number; projectId: number; date: string; period: string; schedule: Rag; budget: Rag; resources: Rag;
  status: string; type: string; progress: number | null; start: string; goLive: string; planEnd: string; forecastEnd: string;
  actualCost: number | null; keyReason: string; title: string; done: string; next: string; issues: string;
  decision: boolean; decisionText: string; applied: boolean; author: Person | null;
}

export interface Risk {
  id: number; projectId: number; title: string; type: string; probability: number; impact: number;
  owner: Person | null; status: string; due: string; mitigation: string;
}

export interface Comment { id: number; projectId: number; text: string; author: Person | null; created: string; }  // created — ISO дата-время
export interface ChangeEntry { id: number; projectId: number; date: string; who: Person | null; kind: string; field: string; from: string; to: string; reason: string; }
export interface ChangeEvent { id: number; date: string; who: Person | null; kind: 'create' | 'key' | 'edit' | 'report'; reason: string; diffs: { f: string; from: string; to: string }[]; }
