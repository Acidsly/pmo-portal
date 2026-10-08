import * as React from 'react';
import { AppCtx } from './ctx';

/** Вид бокового окна: что открыто — одинаково, откуда бы окно ни открыли (entTag прототипа). */
export type EntKind = 'project' | 'report' | 'risk' | 'issue' | 'assign' | 'notif' | 'feedback' | 'help';
const ENT: Record<EntKind, { c: string; d: string; l: string }> = {
  project: { c: 'var(--theme)', d: 'M2 4.5h4l1.5 1.5H14v6.5H2z', l: 'entProject' },
  report: { c: 'var(--g)', d: 'M4 2h6l3 3v9H4zM10 2v3h3M6 8h5M6 11h5', l: 'entReport' },
  risk: { c: 'var(--y)', d: 'M8 2l6.5 11.5h-13zM8 6.5v3M8 11.5v.01', l: 'entRisk' },
  issue: { c: 'var(--r)', d: 'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM8 5v4M8 11v.01', l: 'entIssue' },
  assign: { c: '#8764b8', d: 'M8 8a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5zM3 14c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5', l: 'entAssign' },
  notif: { c: '#5856d6', d: 'M4 6.5a4 4 0 0 1 8 0c0 3 1.2 4.2 1.5 4.5h-11C2.8 10.7 4 9.5 4 6.5zM6.5 13a1.6 1.6 0 0 0 3 0', l: 'entNotif' },
  feedback: { c: '#038387', d: 'M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z', l: 'entFeedback' },
  help: { c: 'var(--na)', d: 'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.6-.8 1.3M8 11.5v.01', l: 'entHelp' }
};
export const EntTag: React.FC<{ kind: EntKind }> = ({ kind }) => {
  const { t } = React.useContext(AppCtx); const e = ENT[kind];
  return <span className={'ent ent-' + kind} style={{ ['--c' as string]: e.c } as React.CSSProperties}>
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={e.d} /></svg>{t(e.l)}</span>;
};
