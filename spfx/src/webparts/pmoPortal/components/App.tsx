import * as React from 'react';
import { SpRepo, PortalData } from '../data/SpRepo';
import { Lang, LANG_CODES, langFromCulture, makeT, readLang, saveLang } from '../i18n/i18n';
import { Theme, readTheme, saveTheme } from '../theme/theme';
import { todayIso } from '../logic/dates';
import { AppCtx, Ctx, Page } from './ctx';
import { Header } from './Header';
import { Home } from '../pages/Home';
import { Soon } from '../pages/Soon';

export interface AppProps { repo: SpRepo; culture: string; userName: string; userEmail: string; webUrl: string; }

/** Корень приложения: язык, тема, вкладка, данные; весь CSS прототипа действует внутри .pmo-app. */
export const App: React.FC<AppProps> = p => {
  const [lang, setLang] = React.useState<Lang>(readLang() ?? langFromCulture(p.culture));
  const [theme, setTheme] = React.useState<Theme>(readTheme());
  const [page, setPage] = React.useState<Page>('home');
  const [data, setData] = React.useState<PortalData | undefined>(undefined);
  const [err, setErr] = React.useState('');
  React.useEffect(() => {
    p.repo.loadAll().then(setData, e => setErr(String((e && e.message) || e)));
  }, []);
  const tt = makeT(lang);
  const ctx: Ctx = { ...tt, lang, today: todayIso(), go: pg => { setPage(pg); window.scrollTo(0, 0); } };
  return <AppCtx.Provider value={ctx}>
    <div className="pmo-app" data-theme={theme || undefined} lang={LANG_CODES[lang]}>
      <Header page={page} lang={lang} theme={theme} userName={p.userName} userEmail={p.userEmail}
        onPage={ctx.go} onLang={l => { setLang(l); saveLang(l); }} onTheme={v => { setTheme(v); saveTheme(v); }} />
      <main className="pmo-main">
        {err ? <p className="empty">{tt.t('loadErr')}: {err}</p>
          : !data ? <p className="empty">…</p>
          : page === 'home' ? <Home data={data} webUrl={p.webUrl} /> : <Soon />}
      </main>
    </div>
  </AppCtx.Provider>;
};
