import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { NOTIFY_DAYS, notifyItems, notifyList, marksAfterView, NotifyItem, NotifyKind, ReadMarks } from '../logic/notify';
import { fmtDT } from '../components/Bits';
import { tv } from '../i18n/values';

const NK: Record<NotifyKind, string> = { created: 'nkCreated', assigned: 'nkAssigned', submitted: 'nkSubmitted', decided: 'nkDecided', applied: 'nkApplied',
  archived: 'nkArchived', risk: 'nkRisk', cardEdit: 'nkCardEdit', comment: 'nkComment' };

/** Свои метки «прочитано до» (null — строки «Прочитане» ещё нет). */
export const readMarks = (data: PortalData): ReadMarks | null => (data.notify ? { readId: data.notify.readId, readCmId: data.notify.readCmId } : null);

/** Строки колокольчика и есть ли новые (правило — logic/notify.ts). PMO и владельцы сайта — canApprove. */
export function notifyState(data: PortalData, me: string): { list: NotifyItem[]; unread: number } {
  const since = new Date(Date.now() - NOTIFY_DAYS * 864e5).toISOString();
  const list = notifyList(notifyItems(data, me, data.canApprove, since), readMarks(data));
  return { list, unread: list.filter(x => x.unread).length };
}

/** Панель «Сповіщення» (notifPanel прототипа): события за 14 дней по моей роли; «Позначити все прочитаним» — метки до последнего показанного.
 *  onOpen — переход к событию (открытие и переход ничего не отмечают). */
export const NotifyPanel: React.FC<{ data: PortalData; onOpen(form: string, projectId: number): void; onCancel(): void }> = ({ data, onOpen, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const list = notifyState(data, c.me).list;
  const [onlyNew, setOnlyNew] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const readAll = (): void => {
    if (!data.notify) return;
    setBusy(true);
    c.repo.markRead(marksAfterView(list, { readId: data.notify.readId, readCmId: data.notify.readCmId })).then(() => c.reload())
      .then(() => setBusy(false), (x: Error) => { setBusy(false); c.toast(String((x && x.message) || x)); });
  };
  const open = (x: NotifyItem): void => {
    const r = x.ev && x.ev.ref;
    onOpen(r ? (r.type === 'report' ? 'rep:' : 'risk:') + r.id : '', x.projectId);
  };
  const shown = onlyNew ? list.filter(x => x.unread) : list;
  const p = (id: number): string => { const pr = data.projects.filter(x => x.id === id)[0]; return pr ? `${pr.code} · ${pr.title}` : ''; };
  return <>
    <div className="ph"><div><div className="k">PPM</div><h2>{t('notifTitle')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note">{data.notify ? t('notifHint') : t('notifSoon')}</p>
    <div className="ntf-bar"><label className="check"><input type="checkbox" id="ntf-new" checked={onlyNew} onChange={e => setOnlyNew(e.target.checked)} /> {t('notifOnlyNew')}</label>
      {data.notify && list.some(x => x.unread) ? <button type="button" className="btn" id="ntf-all" disabled={busy} onClick={readAll}>{t('notifReadAll')}</button> : null}</div>
    <div id="ntf-list">{shown.length ? shown.map(x =>
      <button key={x.key} className={'ntf-i ' + (x.unread ? 'new' : 'old')} onClick={() => open(x)}>
        <div className="ntf-h"><span className="ntf-p">{p(x.projectId)}</span><span className="chg-k">{t(NK[x.kind])}</span>
          {x.unread ? <span className="pill ap" style={{ '--c': 'var(--theme)' } as React.CSSProperties}>{t('notifNew')}</span> : null}
          <span className="muted">{x.who ? x.who.name + ' · ' : ''}{fmtDT(x.date)}</span></div>
        {x.comment ? <div className="ntf-t">{x.comment.text}</div> : null}
        {x.ev && x.ev.diffs.length ? <div className="diffs">{x.ev.diffs.map((d, i) => <div key={i} className="diff"><span className="df">{fl(d.f)}</span>
          <span className="dv"><s>{tv(d.from) || '—'}</s><span className="arr">→</span>{tv(d.to) || '—'}</span></div>)}</div> : null}
        {x.ev && x.ev.reason ? <div className="ntf-t">{x.ev.reason}</div> : null}
      </button>) : <p className="empty">{t('notifEmpty')}</p>}</div>
  </>;
};
