import * as React from 'react';
import { AppCtx, Page } from './ctx';
import { Lang } from '../i18n/i18n';
import { Theme } from '../theme/theme';
import { Avatar } from './Bits';
import { Sun, Moon, Chat } from './Icons';

const NAV: [Page, string][] = [['home', 'navHome'], ['projects', 'navProjects'], ['reports', 'navReports'], ['risks', 'navRisks'], ['archive', 'navArchive']];

/** Шапка прототипа (строки 465–481, renderChrome): логотип, вкладки, язык, тема, пользователь. */
export const Header: React.FC<{ page: Page; lang: Lang; theme: Theme; userName: string; userEmail: string;
  onPage(p: Page): void; onLang(l: Lang): void; onTheme(v: 'light' | 'dark'): void;
  /** Кнопка «Відгук» — только если на сайте есть список «Відгуки» (тест с фокус-группой). */
  onFeedback?: () => void }> = p => {
  const { t } = React.useContext(AppCtx);
  const dark = p.theme === 'dark' || (p.theme === '' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return <header className="top"><div className="top-in">
    <div className="brand"><div className="logo" aria-hidden="true">ПП</div>
      <div><div className="brand-name">{t('siteTitle')}</div><div className="brand-sub">SharePoint · Microsoft 365</div></div></div>
    <nav className="nav" aria-label="Navigation">{NAV.map(([pg, k]) =>
      <button key={pg} aria-current={p.page === pg ? 'page' : undefined} onClick={() => p.onPage(pg)}>{t(k)}</button>)}</nav>
    <div className="controls">
      <div className="seg" role="group" aria-label="Мова / Language / Язык">{['UA', 'EN', 'RU'].map((l, i) =>
        <button key={l} lang={['uk', 'en', 'ru'][i]} aria-pressed={p.lang === i} onClick={() => p.onLang(i as Lang)}>{l}</button>)}</div>
      <div className="seg" role="group" aria-label="Theme">
        <button aria-pressed={!dark} title={t('themeLight')} aria-label={t('themeLight')} onClick={() => p.onTheme('light')}><Sun /></button>
        <button aria-pressed={dark} title={t('themeDark')} aria-label={t('themeDark')} onClick={() => p.onTheme('dark')}><Moon /></button>
      </div>
      {p.onFeedback ? <button className="hbtn" title={t('fbTitle')} onClick={p.onFeedback}><Chat /><span className="hlabel">{t('feedback')}</span></button> : null}
      <button className="me" title={`${t('signedIn')}: ${p.userName} · ${p.userEmail}`} aria-label={`${t('signedIn')}: ${p.userName}`}><Avatar name={p.userName} /></button>
    </div>
  </div></header>;
};
