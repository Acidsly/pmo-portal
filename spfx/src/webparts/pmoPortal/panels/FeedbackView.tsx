import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { FeedbackRow } from '../data/types';
import { Frow, Err, Opts } from '../components/fields';
import { FbStatus, FB_STATUSES } from '../pages/Feedback';

/** Отзыв: текст, статус, ответ, скриншоты (свои или все у администратора); администратор сайта ставит статус и ответ. */
export const FeedbackView: React.FC<{ row: FeedbackRow | undefined; admin: boolean; onCancel(): void }> = ({ row, admin, onCancel }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const [status, setStatus] = React.useState(row ? row.status : 'Новий');
  const [answer, setAnswer] = React.useState(row ? row.answer : '');
  const [err, setErr] = React.useState(''); const [busy, setBusy] = React.useState(false);
  if (!row) return <><div className="ph"><div><h2>{t('navFeedback')}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="empty">{t('fbNoItems')}</p></>;
  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await c.repo.update('Feedback', row.id, { fbStatus: status, fbAnswer: answer.trim() }); await c.reload(); c.toast(t('fbAnswered')); onCancel(); }
    catch (x) { setErr(String((x as Error).message || x)); setBusy(false); }
  };
  return <>
    <div className="ph"><div><div className="k">{t('navFeedback')} · №{row.id}</div><h2>{row.author || t('navFeedback')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <div className="badges"><FbStatus v={row.status} />{row.screen ? <code>{row.screen}</code> : null}</div>
    <p className="fb-text">{row.text}</p>
    {row.files.length ? <div className="fb-shots">{row.files.map(f => <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer"><figure><img src={f.url} alt={f.name} /></figure></a>)}</div>
      : row.shots ? <p className="note">{t('fbShotsHidden')} ({row.shots})</p> : null}
    {admin ? <form onSubmit={save} noValidate={true}>
      <Frow label={t('fbStatusCol')} htmlFor="fb-st"><select id="fb-st" value={status} onChange={e => setStatus(e.target.value)}><Opts values={FB_STATUSES} /></select></Frow>
      <Frow label={t('fbAnswer')} htmlFor="fb-ans"><textarea id="fb-ans" style={{ minHeight: 110 }} value={answer} onChange={e => setAnswer(e.target.value)} /></Frow>
      <Err msg={err} />
      <div className="actions"><button type="submit" className="btn primary" disabled={busy}>{t('save')}</button><button type="button" className="btn" onClick={onCancel}>{t('cancel')}</button></div>
    </form> : <div className="sec"><h3>{t('fbAnswer')}</h3>{row.answer ? <p className="fb-text">{row.answer}</p> : <p className="empty">{t('fbNoAnswer')}</p>}</div>}
  </>;
};
