import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Person } from '../data/types';
import { isArch } from '../logic/status';
import { assignmentPlan } from '../logic/assign';
import { guard } from '../logic/guard';
import { Frow, Err, PeoplePicker, Opts, errText, guardText } from '../components/fields';
import { COUNTRIES } from '../logic/projects';
import { tv } from '../i18n/values';

const low = (p: Person | null | undefined): string => (p ? p.email.toLowerCase() : '');

/** «Змінити PM / власника / країну» (#43, assignForm прототипа): после создания проекта PM, власника и країну меняет только PMO —
 *  запись в «Призначення» (папка проекта), синхронизация переносит в карточку; изменение видно сразу (наложение). */
export const AssignForm: React.FC<{ data: PortalData; projectId: number; onCancel(): void }> = ({ data, projectId, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const p = data.projects.filter(x => x.id === projectId)[0];
  const [pm, setPm] = React.useState<Person | null>(null);
  const [owner, setOwner] = React.useState<Person | null>(null);
  const [country, setCountry] = React.useState('');
  const [note, setNote] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const allowed = !!p && data.canApprove && !isArch(p.status) && !p.assignPending;
  const head = <div className="ph"><div><div className="k"><EntTag kind="assign" /><span>{p ? p.code + ' · ' : ''}{t('listLabel')} «{t('navProjects')}»</span></div><h2>{t('assignTitle')}</h2></div>
    <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>;
  if (!p || !allowed) return <>{head}<p className="note lock">🔒 {p && p.assignPending ? t('assignPendingNote') : p && isArch(p.status) ? t('archivedNote') : t('noEdit')}</p></>;

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    // те же правила, что у синхронизации (assignments.json): что-то меняется (сообщение — первым), комментарий есть
    const plan = assignmentPlan({ author: 'app', manager: low(pm), owner: low(owner), country, note: note.trim() || '-' }, low(p.manager), low(p.owner), false, [], [], p.country || '');
    if (!plan.valid) { setErr(t('errAssignSame')); return; }
    if (!note.trim()) { setErr(t('errAssignNote')); return; }
    setBusy(true); setErr('');
    try {
      const f = await c.repo.fresh(p.id);
      const g = guard('assign', c.me, f);
      if (!g.ok) { setErr(guardText(t, g.key, g.args)); setBusy(false); await c.reload(); return; }
      await c.repo.createIn('ProjectAssignments', p.id, { Title: '', paProjectId: p.id, paManagerId: null, paOwnerId: null, paNote: note.trim(), paApplied: false, ...(plan.changes.some(x => x.f === 'pmCountry') ? { paCountry: country } : {}) },
        { paManagerId: plan.changes.some(x => x.f === 'pmManager') ? low(pm) : '', paOwnerId: plan.changes.some(x => x.f === 'pmOwner') ? low(owner) : '' });
      await c.reload();
      c.toast(t('savedAssign'));
      c.openProject(p.id);
    } catch (x) { setErr(errText(t, x)); setBusy(false); }
  };
  const search = (q: string): Promise<Person[]> => c.repo.searchPeople(q);

  return <>{head}
    <p className="note">{t('assignHint')}</p>
    <form onSubmit={save} noValidate={true}>
      <Frow label={fl('pm')}><div className="fixedval">{p.manager ? p.manager.name : '—'}</div></Frow>
      <Frow label={t('assignNewPm')} htmlFor="a-pm"><PeoplePicker id="a-pm" multi={false} value={pm ? [pm] : []} search={search} onChange={v => setPm(v[0] || null)} /></Frow>
      <Frow label={fl('owner')}><div className="fixedval">{p.owner ? p.owner.name : '—'}</div></Frow>
      <Frow label={t('assignNewOwner')} htmlFor="a-own"><PeoplePicker id="a-own" multi={false} value={owner ? [owner] : []} search={search} onChange={v => setOwner(v[0] || null)} /></Frow>
      <Frow label={fl('country')}><div className="fixedval">{p.country ? tv(p.country) : '—'}</div></Frow>
      <Frow label={t('assignNewCountry')} htmlFor="a-country">
        <select id="a-country" value={country} onChange={e => setCountry(e.target.value)}><option value="">{t('notSet')}</option><Opts values={COUNTRIES} /></select></Frow>
      <Frow label={t('assignNote')} htmlFor="a-note" req={true}><textarea id="a-note" value={note} onChange={e => setNote(e.target.value)} /></Frow>
      <Err msg={err} />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy}>{t('save')}</button>
        <button type="button" className="btn" onClick={onCancel}>{t('cancel')}</button>
      </div>
    </form>
  </>;
};
