import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { OVERVIEW_CSS, OVERVIEW_HTML } from '../help/overview';

/** Папка обзора на сайте: скриншоты и PDF (заполняет scripts/Deploy-App.ps1). */
export const OVERVIEW_DIR = 'SiteAssets/pmo-overview';

/** «Детальний огляд системи»: обзорный документ docs/overview/overview.uk.html (только украинский; генерирует tools/overview.mjs). */
export const Overview: React.FC<{ onBack(): void; onCancel(): void }> = ({ onBack, onCancel }) => {
  const { t, webUrl } = React.useContext(AppCtx);
  const base = `${webUrl}/${OVERVIEW_DIR}`;
  const html = React.useMemo(() => OVERVIEW_HTML.split('{{BASE}}').join(base), [base]);
  return <>
    <div className="ph"><div><div className="k"><EntTag kind="help" /></div><h2>{t('overview')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <div className="actions top">
      <button className="btn" onClick={onBack}>{t('overviewBack')}</button>
      <a className="btn" href={`${base}/overview.uk.pdf`} target="_blank" rel="noopener noreferrer" data-interception="off">{t('overviewPdf')}</a>
    </div>
    <style>{OVERVIEW_CSS}</style>
    <div className="ovw-paper"><div className="ovw" lang="uk" dangerouslySetInnerHTML={{ __html: html }} /></div>
  </>;
};
