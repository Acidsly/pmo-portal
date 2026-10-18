import * as React from 'react';
import { AppCtx, Page } from './ctx';
import { Lang } from '../i18n/i18n';
import { Theme } from '../theme/theme';
import { Avatar } from './Bits';
import { Sun, Moon, Bell } from './Icons';
import { Lucide } from './LucideIcons';
import { Pop } from './Pop';
import { AiSwitch } from '../ai/useAiSwitch';
import { aiLangOf } from '../logic/aiCheck';
import { aiEnableNote } from '../logic/aiLogin';

const NAV: [Page, string][] = [['home', 'navHome'], ['projects', 'navProjects'], ['reports', 'navReports'], ['risks', 'navRisks'], ['archive', 'navArchive'], ['feedback', 'navFeedback']];

/** Шапка прототипа (строки 465–481, renderChrome): логотип, вкладки, язык, тема, пользователь. */
export const Header: React.FC<{ page: Page; lang: Lang; theme: Theme; userName: string; userEmail: string;
  onPage(p: Page): void; onLang(l: Lang): void; onTheme(v: 'light' | 'dark'): void;
  /** Вкладка «Відгуки» — только если на сайте есть список «Відгуки» (тест с фокус-группой); отзыв оставляют на ней. */
  onFeedback?: () => void; onHelp(): void;
  /** Сповіщення: красная точка — есть новые для меня события. */
  bell?: { unread: number; onOpen(): void };
  /** Пилотная группа: меню у аватара с переключателем «Помічник ШІ» (согласие — при включении). */
  ai?: AiSwitch }> = p => {
  const { t } = React.useContext(AppCtx);
  const [me, setMe] = React.useState<HTMLElement | null>(null);
  const ai = p.ai;
  const closeMe = React.useCallback(() => setMe(null), []);
  const dark = p.theme === 'dark' || (p.theme === '' && !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return <><header className="top"><div className="top-in">
    <div className="brand"><div className="logo" aria-hidden="true">PPM</div>
      <div><div className="brand-name">{t('siteTitle')}</div><div className="brand-sub">SharePoint · Microsoft 365</div></div></div>
    <nav className="nav" aria-label="Navigation">{NAV.filter(([pg]) => pg !== 'feedback' || !!p.onFeedback).map(([pg, k]) =>
      // значок раздела (Lucide) и название; на телефоне — только значок, название — в подсказке
      <button key={pg} data-page={pg} title={t(k)} aria-label={t(k)} aria-current={p.page === pg ? 'page' : undefined} onClick={() => p.onPage(pg)}>
        <span className="ni"><Lucide k={pg} /></span><span className="nl">{t(k)}</span></button>)}</nav>
    <div className="controls">
      <div className="seg" role="group" aria-label="Мова / Language / Язык">{['UA', 'EN', 'RU'].map((l, i) =>
        <button key={l} lang={['uk', 'en', 'ru'][i]} aria-pressed={p.lang === i} onClick={() => p.onLang(i as Lang)}>{l}</button>)}</div>
      <div className="seg" role="group" aria-label="Theme">
        <button aria-pressed={!dark} title={t('themeLight')} aria-label={t('themeLight')} onClick={() => p.onTheme('light')}><Sun /></button>
        <button aria-pressed={dark} title={t('themeDark')} aria-label={t('themeDark')} onClick={() => p.onTheme('dark')}><Moon /></button>
      </div>
      {p.bell ? <button className={'bell' + (p.bell.unread ? ' has' : '')} id="bell" title={p.bell.unread ? `${t('notifTitle')} · ${t('notifNewOnes')}: ${p.bell.unread}` : t('notifTitle')}
        aria-label={p.bell.unread ? `${t('notifTitle')} · ${t('notifNewOnes')}: ${p.bell.unread}` : t('notifTitle')} onClick={p.bell.onOpen}><Bell />
        {p.bell.unread ? <span className="dot-new">{p.bell.unread > 99 ? '99+' : p.bell.unread}</span> : null}</button> : null}
      <button className="hbtn round" title={t('help')} aria-label={t('help')} onClick={p.onHelp}>?</button>
      <button className="me" title={`${t('signedIn')}: ${p.userName} · ${p.userEmail}`} aria-label={`${t('signedIn')}: ${p.userName}`}
        aria-haspopup={ai ? 'dialog' : undefined} aria-expanded={ai ? !!me : undefined}
        onClick={ai ? e => { const el = e.currentTarget; setMe(me ? null : el); } : undefined}><Avatar name={p.userName} /></button>
    </div>
  </div></header>
    {/* меню пользователя — вне шапки: у шапки backdrop-filter, fixed внутри неё считался бы от шапки (меню уезжало вниз) */}
    {ai && me ? <Pop anchor={me} align="right" onClose={closeMe}><div className="pop-user-menu" id="me-pop">
        <div className="pop-me"><Avatar name={p.userName} /><span className="pn"><b>{p.userName}</b><small>{p.userEmail}</small></span></div>
        <div className="pop-list pop-sws">
          <button type="button" className="pop-row pop-sw" role="switch" id="ai-switch" aria-checked={ai.on} disabled={ai.busy} onClick={ai.toggle}>
            <span><Lucide k="ai" />{t('aiSwitch')}</span><span className="sw" aria-hidden="true" /></button></div>
        {ai.asking ? <div className="ai-panel" role="alertdialog" aria-label={t('aiAllow')}><p>{t('aiConsent')}</p>
          <div className="ai-rate"><button type="button" className="btn primary" disabled={ai.busy} onClick={ai.allow}>{ai.busy ? t('aiEnabling') : t('aiAllow')}</button>
            <button type="button" className="btn" disabled={ai.busy} onClick={ai.deny}>{t('cancel')}</button></div></div> : null}
        {ai.busy && !ai.asking ? <p className="ai-msg" role="status">{t('aiEnabling')}</p> : null}
        {ai.err ? <p className="ai-msg err" role="status">{aiEnableNote(ai.err, t, aiLangOf(p.lang))}</p> : null}
        <p className="hint pop-hint">{t(ai.on ? 'aiSwitchOn' : 'aiSwitchOff')}</p>
      </div></Pop> : null}
  </>;
};
