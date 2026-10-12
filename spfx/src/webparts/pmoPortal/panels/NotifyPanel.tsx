import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { shownDiffs } from '../logic/team';
import { currentRelease } from './Releases';
import { NOTIFY_DAYS, extraItems, notifyItems, notifyList, marksAfterView, marksAfterOpen, NotifyItem, NotifyKind, ReadMarks } from '../logic/notify';
import { fmtDT } from '../components/Bits';
import { tv } from '../i18n/values';

const NK: Record<NotifyKind, string> = { created: 'nkCreated', assigned: 'nkAssigned', submitted: 'nkSubmitted', decided: 'nkDecided', applied: 'nkApplied',
  archived: 'nkArchived', risk: 'nkRisk', cardEdit: 'nkCardEdit', comment: 'nkComment',
  teamAdded: 'nkTeamAdded', teamRole: 'nkTeamRole', feedback: 'nkFeedback', release: 'nkRelease' };

/** Свои метки «прочитано до» (null — строки «Прочитане» ещё нет). */
export const readMarks = (data: PortalData): ReadMarks | null => (data.notify ? { readId: data.notify.readId, readCmId: data.notify.readCmId, seen: data.notify.seen || [] } : null);

/** Строки колокольчика и есть ли новые (правило — logic/notify.ts). PMO и владельцы сайта — canApprove. */
export function notifyState(data: PortalData, me: string, lang = 0): { list: NotifyItem[]; unread: number } {
  const since = new Date(Date.now() - NOTIFY_DAYS * 864e5).toISOString();
  // + разбор моих отзывов и новый выпуск портала («Що змінилося»)
  const rel = currentRelease(lang);
  const list = notifyList([...notifyItems(data, me, data.canApprove, since), ...extraItems(data.feedbackRows || [], rel.ver ? rel : null, since)], readMarks(data));
  return { list, unread: list.filter(x => x.unread).length };
}

/** Панель «Сповіщення» (notifPanel прототипа): события за 14 дней по моей роли; открыл событие — прочитано оно;
 *  «Позначити все прочитаним» — метки до последнего показанного. onOpen — переход к событию. */
export const NotifyPanel: React.FC<{ data: PortalData; onOpen(form: string, projectId: number): void; onCancel(): void }> = ({ data, onOpen, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const list = notifyState(data, c.me, c.lang).list;
  const [onlyNew, setOnlyNew] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const readAll = (): void => {
    if (!data.notify) return;
    setBusy(true);
    c.repo.markRead(marksAfterView(list, readMarks(data)!)).then(() => c.reload())
      .then(() => setBusy(false), (x: Error) => { setBusy(false); c.toast(String((x && x.message) || x)); });
  };
  // открыл событие — прочитано именно оно (число на колокольчике уменьшится после записи)
  const open = (x: NotifyItem): void => {
    // запись не удалась — событие останется новым; переход к событию важнее, поэтому без сообщения, только в консоль
    if (x.unread && data.notify) c.repo.markRead(marksAfterOpen(x, readMarks(data)!)).then(() => c.reload(), e => console.warn('Сповіщення: не вдалося позначити прочитаним', e));
    if (x.fb) { onOpen('fb:' + x.fb.id, 0); return; }
    if (x.rel) { onOpen('releases', 0); return; }
    const r = x.ev && x.ev.ref;
    onOpen(r ? (r.type === 'report' ? 'rep:' : 'risk:') + r.id : '', x.projectId);
  };
  const shown = onlyNew ? list.filter(x => x.unread) : list;
  // #84: моя роль в команде проекта сейчас (для «Вас додано до команди» / «Змінено вашу роль»)
  const myRole = (id: number): string => { const pr = data.projects.filter(x => x.id === id)[0]; const me = (c.me || '').toLowerCase();
    const m = pr ? (pr.team || []).filter(r => r.user && r.user.email.toLowerCase() === me)[0] : undefined; return m ? m.role : ''; };
  const p = (id: number): string => { const pr = data.projects.filter(x => x.id === id)[0]; return pr ? `${pr.code} · ${pr.title}` : ''; };
  return <>
    <div className="ph"><div><div className="k"><EntTag kind="notif" /></div><h2>{t('notifTitle')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note">{data.notify ? t('notifHint') : t('notifSoon')}</p>
    {list.some(x => x.unread) ? <p className="ntf-n" id="ntf-n" role="status">{t('notifCount').replace('{n}', String(list.filter(x => x.unread).length))}</p> : null}
    <div className="ntf-bar"><label className="check"><input type="checkbox" id="ntf-new" checked={onlyNew} onChange={e => setOnlyNew(e.target.checked)} /> {t('notifOnlyNew')}</label>
      {data.notify && list.some(x => x.unread) ? <button type="button" className="btn" id="ntf-all" disabled={busy} onClick={readAll}>{t('notifReadAll')}</button> : null}</div>
    <div id="ntf-list">{shown.length ? shown.map(x =>
      <button key={x.key} className={'ntf-i ' + (x.unread ? 'new' : 'old') + (x.rel ? ' rel-n' : x.fb ? ' fb-n' : '')} onClick={() => open(x)}>
        <div className="ntf-h"><span className="ntf-p">{x.fb ? t('fbNumT').replace('{n}', String(x.fb.id)) : x.rel ? t('siteTitle') : p(x.projectId)}</span><span className="chg-k">{t(NK[x.kind])}</span>
          {x.unread ? <span className="pill ap" style={{ '--c': 'var(--theme)' } as React.CSSProperties}>{t('notifNew')}</span> : null}
          <span className="muted">{x.who ? x.who.name + ' · ' : ''}{fmtDT(x.date)}</span></div>
        {x.comment ? <div className="ntf-t">{x.comment.text}</div> : null}
        {x.fb ? <div className="ntf-t"><b>{tv(x.fb.status)}</b>{x.fb.answer ? <> · <span className="clamp2">{x.fb.answer}</span></> : null}</div> : null}
        {x.rel ? <div className="ntf-t">{t('relVer').replace('{v}', x.rel.ver)} · {x.rel.date} — <span className="link">{t('relTitle')} →</span></div> : null}
        {x.kind === 'teamAdded' || x.kind === 'teamRole' ? <div className="ntf-t">{t('ntfMyRole').replace('{r}', myRole(x.projectId) || '—')}</div>
        : x.ev && shownDiffs(x.ev.diffs).length ? <div className="diffs">{shownDiffs(x.ev.diffs).map((d, i) => <div key={i} className="diff"><span className="df">{fl(d.f)}</span>
          <span className="dv"><s>{tv(d.from) || '—'}</s><span className="arr">→</span>{tv(d.to) || '—'}</span></div>)}</div> : null}
        {x.ev && x.ev.reason ? <div className="ntf-t">{x.ev.reason}</div> : null}
      </button>) : <p className="empty">{t('notifEmpty')}</p>}</div>
  </>;
};
