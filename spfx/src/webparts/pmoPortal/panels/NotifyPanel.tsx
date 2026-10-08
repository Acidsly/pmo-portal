import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { NOTIFY_DAYS, notifyItems, notifyList, marksAfterView, NotifyItem, NotifyKind } from '../logic/notify';
import { fmtDT } from '../components/Bits';
import { tv } from '../i18n/values';

const NK: Record<NotifyKind, string> = { created: 'nkCreated', assigned: 'nkAssigned', submitted: 'nkSubmitted', decided: 'nkDecided', applied: 'nkApplied',
  archived: 'nkArchived', risk: 'nkRisk', cardEdit: 'nkCardEdit', comment: 'nkComment' };

/** Строки колокольчика и есть ли новые (правило — logic/notify.ts). PMO и владельцы сайта — canApprove. */
export function notifyState(data: PortalData, me: string): { list: NotifyItem[]; unread: boolean } {
  const since = new Date(Date.now() - NOTIFY_DAYS * 864e5).toISOString();
  const list = notifyList(notifyItems(data, me, data.canApprove, since), data.notify ? { readId: data.notify.readId, readCmId: data.notify.readCmId } : null);
  return { list, unread: list.some(x => x.unread) };
}

/** Панель «Сповіщення» (notifPanel прототипа): события за 14 дней по моей роли; открытие отмечает показанное прочитанным. */
export const NotifyPanel: React.FC<{ data: PortalData; onCancel(): void }> = ({ data, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  // список с отметками «Нове» — на момент открытия: выделение остаётся, пока панель открыта
  const [list] = React.useState(() => notifyState(data, c.me).list);
  const [onlyNew, setOnlyNew] = React.useState(false);
  React.useEffect(() => {
    if (!data.notify || !list.some(x => x.unread)) return;
    c.repo.markRead(marksAfterView(list, { readId: data.notify.readId, readCmId: data.notify.readCmId })).then(() => c.reload(), () => undefined);
  }, []);
  const open = (x: NotifyItem): void => {
    const r = x.ev && x.ev.ref;
    c.openForm(r ? (r.type === 'report' ? 'rep:' : 'risk:') + r.id : '', x.projectId);
  };
  const shown = onlyNew ? list.filter(x => x.unread) : list;
  const p = (id: number): string => { const pr = data.projects.filter(x => x.id === id)[0]; return pr ? `${pr.code} · ${pr.title}` : ''; };
  return <>
    <div className="ph"><div><div className="k">PPM</div><h2>{t('notifTitle')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note">{data.notify ? t('notifHint') : t('notifSoon')}</p>
    <div className="ntf-bar"><label className="check"><input type="checkbox" id="ntf-new" checked={onlyNew} onChange={e => setOnlyNew(e.target.checked)} /> {t('notifOnlyNew')}</label></div>
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
