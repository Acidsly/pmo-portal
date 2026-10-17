import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { RELEASES } from '../help/releases';
import { groupReleases } from '../logic/releases';

/** #90: версия портала — первый выпуск заметок (Jest сверяет с версией пакета в config/package-solution.json). */
export const currentRelease = (lang: number): { ver: string; date: string } => (RELEASES[lang] || RELEASES[0])[0] || { ver: '', date: '' };

/** «#84» в заметках — ссылка на отзыв (если на сайте есть «Відгуки»); остальной текст — как в заметках. */
export const linkFeedback = (html: string): string => html.replace(/(^|[^&\w])#(\d{1,4})\b/g, '$1<a href="#" class="rel-fb" data-fb="$2">#$2</a>');

/** «Що змінилося»: заметки о выпусках docs/RELEASES.{uk,en,ru}.md (генерирует tools/guide.mjs), текущий — первым;
 *  группировка — logic/releases.ts. */
export const Releases: React.FC<{ onBack(): void; onCancel(): void; onFeedback?: (id: number) => void }> = ({ onBack, onCancel, onFeedback }) => {
  const { t, lang } = React.useContext(AppCtx);
  const list = RELEASES[lang] || RELEASES[0];
  const click = (e: React.MouseEvent<HTMLDivElement>): void => {
    const a = (e.target as HTMLElement).closest ? (e.target as HTMLElement).closest('a.rel-fb') as HTMLElement | null : null;
    if (!a) return;
    e.preventDefault();
    if (onFeedback) onFeedback(Number(a.getAttribute('data-fb')));
  };
  // #95: текущая версия — вверху всегда; технические выпуски подряд — один свёрнутый блок; последний содержательный выпуск раскрыт
  const groups = groupReleases(list);
  const firstRel = groups.findIndex(g => g.kind === 'rel');
  const cur = list[0];
  const html = (h: string): string => (onFeedback ? linkFeedback(h) : h);
  return <>
    <div className="ph"><div><div className="k"><EntTag kind="help" /></div><h2>{t('relTitle')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <div className="actions top"><button className="btn" onClick={onBack}>{t('relBack')}</button></div>
    {cur ? <p className="rel-cur" id="rel-cur"><b>{t('relCurVer').replace('{v}', cur.ver)}</b> · {cur.date}</p> : null}
    <div className="help rel" onClick={click}>{groups.map((g, i) => g.kind === 'tech'
      ? <details key={'t' + g.list[0].ver} className="rel-i rel-tech"><summary><h3>{t('relTech')} · {g.vers} · {g.dates}
        {g.list.length > 1 ? <span className="muted"> ({g.list.length})</span> : null}{i === 0 ? <span className="pill ap" style={{ '--c': 'var(--theme)' } as React.CSSProperties}>{t('relCurrent')}</span> : null}</h3></summary>
        <ul className="rel-tech-list">{g.list.map(r => <li key={r.ver}>{t('relVer').replace('{v}', r.ver)} · {r.date}</li>)}</ul></details>
      : <details key={g.r.ver} className="rel-i" open={i === firstRel}><summary><h3>{t('relVer').replace('{v}', g.r.ver)} · {g.r.date}
        {i === 0 ? <span className="pill ap" style={{ '--c': 'var(--theme)' } as React.CSSProperties}>{t('relCurrent')}</span> : null}</h3></summary>
        <div className="rel-body" dangerouslySetInnerHTML={{ __html: html(g.r.html) }} /></details>)}</div>
  </>;
};
