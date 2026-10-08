import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { GUIDE } from '../help/guide';

/** «Довідка»: инструкция из docs/USER-GUIDE.{uk,en,ru}.md на языке интерфейса (текст из репозитория, генерирует tools/guide.mjs). */
export const Help: React.FC<{ onCancel(): void; onFeedback?: () => void; onOverview(): void }> = ({ onCancel, onFeedback, onOverview }) => {
  const { t, lang } = React.useContext(AppCtx);
  return <>
    <div className="ph"><div><div className="k"><EntTag kind="help" /><span>{t('siteTitle')}</span></div><h2>{t('help')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <div className="help" dangerouslySetInnerHTML={{ __html: GUIDE[lang] }} />
    {/* в конце короткой инструкции — переход к подробному обзору системи */}
    <div className="help-more"><p>{t('overviewLead')}</p><button className="btn" onClick={onOverview}>{t('overview')}</button></div>
    {onFeedback ? <div className="actions"><button className="btn primary" onClick={onFeedback}>{t('feedback')}</button></div> : null}
  </>;
};
