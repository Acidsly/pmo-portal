import { Rag } from '../logic/rag';

export interface Person { id: number; name: string; email: string; }

export interface Project {
  id: number; code: string; title: string; type: string; priority: string;
  manager: Person | null; owner: Person | null; stakeholders: Person[]; department: string;
  status: string; rag: Rag; progress: number; start: string; goLive: string; planEnd: string; forecastEnd: string;
  archivedAt: string; budget: number; actualCost: number; lastUpdate: string; lastReport: string; lastComment: string;
  /** «Посилання» (pmLinks) и «Команда проєкту»; stakeholders — люди команды. */
  links: Link[]; team: TeamMember[]; description: string;
  /** Пользователь может редактировать элемент (права выдала синхронизация). */
  canEdit: boolean;
  /** На экране учтён неприменённый отчёт — синхронизация ещё не записала его в карточку. */
  pending: boolean;
  /** Необработанные синхронизацией правки карточки (pmEditLog) — приложение дописывает к ним новые. */
  editLog?: string;
  /** «Доступ до картки» — JSON из pmAccess, пишет синхронизация. */
  access?: string;
  /** Последний применённый синхронизацией отчёт «yyyy-mm-dd#id» (эталон) — для правила «показатели только от новейшего». */
  lastApplied?: string;
  /** Дата отчёта «на погодженні» по проекту (не применён), если есть — колонка «Звіт» и плитки (#29). */
  pendingDate?: string;
  /** События истории из неперенесённых отчётов — видны сразу, журнал запишет синхронизация. */
  pendingEvents?: ChangeEvent[];
  /** Дата-время создания (ISO) — базовая сортировка «новые сверху». */
  created?: string;
}

/** Строка списка «Команда проєкту»: человек, роль, по каким вопросам обращаться. */
export interface TeamMember { id: number; projectId: number; user: Person | null; role: string; topics: string; }
export interface Link { t: string; u: string; }

export interface StatusReport {
  id: number; projectId: number; date: string; period: string; schedule: Rag; budget: Rag; resources: Rag;
  status: string; type: string; progress: number | null; start: string; goLive: string; planEnd: string; forecastEnd: string;
  actualCost: number | null; keyReason: string; title: string; done: string; next: string; issues: string;
  decision: boolean; decisionText: string; applied: boolean; author: Person | null;
  created?: string;
  /** Погодження PMO: На погодженні / Погоджено / Повернуто; кто, когда, комментарий. approvalFresh — решение ещё не перенесено синхронизацией. */
  approval: string; approvedBy: Person | null; approvedAt: string; approvalNote: string; approvalFresh?: boolean;
}

/** Решение PMO по статус-отчёту («Погодження звітів»): только цвета (пусто — без изменений), решение, комментарий. */
export interface Approval { id: number; reportId: number; projectId: number; decision: string; s: string; b: string; r: string; note: string;
  author: Person | null; created: string; applied: boolean; }

export interface Risk {
  id: number; projectId: number; title: string; type: string; probability: number; impact: number;
  owner: Person | null; status: string; due: string; mitigation: string;
  /** Стратегія реагування (Уникнення / Зниження (пом'якшення) / Передача / Прийняття) и план на случай наступления. */
  strategy: string; contingency: string;
  created?: string;
}

export interface Comment { id: number; projectId: number; text: string; author: Person | null; created: string; }  // created — ISO дата-время
export interface ChangeEntry { id: number; projectId: number; date: string; who: Person | null; kind: string; field: string; from: string; to: string; reason: string; }
export interface ChangeEvent { id: number; date: string; who: Person | null; kind: 'create' | 'key' | 'edit' | 'report' | 'approval'; reason: string; diffs: { f: string; from: string; to: string }[]; }

/** Отзыв фокус-группы: из «Відгуки — загальні» (видят все) + свои / все для администратора (со скриншотами) из «Відгуки». */
export interface FeedbackRow {
  id: number; created: string; author: string; screen: string; text: string; status: string; answer: string;
  shots: number; mine: boolean; files: { name: string; url: string }[];
}
