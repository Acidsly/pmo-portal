import * as React from 'react';
import { screenLabel } from '../logic/screen';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { FeedbackRow } from '../data/types';
import { DataTable } from '../components/DataTable';
import { TableDefs } from '../components/defs';
import { Muted, fmtDT } from '../components/Bits';
import { tv } from '../i18n/values';
import { Hero } from './common';

export const FB_STATUSES = ['Новий', 'Прийнято', 'Зроблено', 'Прокоментовано', 'Відхилено'];
type FbView = 'all' | 'mine' | 'open';

/** Цветная метка статуса разбора (как в списке «Відгуки»). */
export const FbStatus: React.FC<{ v: string }> = ({ v }) => <span className={'fbst fbst-' + FB_STATUSES.indexOf(v)}>{tv(v)}</span>;

/** «Відгуки»: связь разработчиков решения с участниками — все отзывы, статус и ответ; скриншоты — свои (у администратора — все). */
export const Feedback: React.FC<{ data: PortalData }> = ({ data }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const [view, setView] = React.useState<FbView>('all');
  const rows = data.feedbackRows.filter(r => view === 'mine' ? r.mine : view === 'open' ? !r.answer.trim() : true);
  const open = (r: FeedbackRow): void => c.openForm('fb:' + r.id);
  // номер отзыва (#N) — первым: по нему отзывы называют в ответах и обсуждениях
  const defs: TableDefs<FeedbackRow> = { lock: 'text', defaults: ['num', 'date', 'author', 'text', 'status', 'answer', 'shots', 'screen'], cols: {
    num: { label: t('fbNum'), cell: r => <button className="linklike" onClick={() => open(r)}>#{r.id}</button>, sort: r => r.id, cls: 'w-min' },
    date: { label: t('fbDate'), cell: r => fmtDT(r.created), sort: r => r.created },
    author: { label: t('fbAuthor'), cell: r => r.author || <Muted />, sort: r => r.author, filter: r => r.author },
    text: { label: t('fbText'), cell: r => <button className="linklike clamp3" onClick={() => open(r)} title={r.text}>{r.text}</button>, sort: r => r.text, cls: 'w-wide' },
    status: { label: t('fbStatusCol'), cell: r => <FbStatus v={r.status} />, sort: r => FB_STATUSES.indexOf(r.status), filter: r => r.status },
    answer: { label: t('fbAnswer'), cell: r => (r.answer ? <span className="clamp3" title={r.answer}>{r.answer}</span> : <Muted />), sort: r => r.answer, cls: 'w-wide' },
    shots: { label: t('fbShots'), cell: r => (r.shots ? String(r.shots) : <Muted />), sort: r => r.shots },
    screen: { label: t('fbScreen'), cell: r => (r.screen ? <span title={r.screen}>{screenLabel(r.screen, t, tv)}</span> : <Muted />), sort: r => screenLabel(r.screen, t, tv) }
  } };
  const views: [FbView, string][] = [['all', t('fbViewAll')], ['mine', t('fbViewMine')], ['open', t('fbViewOpen')]];
  return <>
    <Hero title={t('navFeedback')} sub={t('fbPageSub')} />
    <div className="listcard"><DataTable tkey="feedback2" defs={defs} rows={rows} empty={t('fbNoItems')}
      left={<button className="cmd primary" onClick={() => c.openForm('feedback')}>{t('feedbackNew')}</button>}
      right={<label className="viewsel">{t('view')}<select value={view} onChange={e => setView(e.target.value as FbView)}>
        {views.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>} /></div>
  </>;
};
