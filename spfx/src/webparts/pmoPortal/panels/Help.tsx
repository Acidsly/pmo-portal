import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { GUIDE } from '../help/guide';

/** «Довідка»: инструкция из docs/USER-GUIDE.{uk,en,ru}.md на языке интерфейса (текст из репозитория, генерирует tools/guide.mjs). */
export const Help: React.FC<{ onCancel(): void; onFeedback?: () => void }> = ({ onCancel, onFeedback }) => {
  const { t, lang } = React.useContext(AppCtx);
  return <>
    <div className="ph"><div><div className="k">{t('siteTitle')}</div><h2>{t('help')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <div className="help" dangerouslySetInnerHTML={{ __html: GUIDE[lang] }} />
    {onFeedback ? <div className="actions"><button className="btn primary" onClick={onFeedback}>{t('feedback')}</button></div> : null}
  </>;
};
