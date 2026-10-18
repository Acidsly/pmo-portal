import * as React from 'react';

/** Диагностика раскладки на телефоне (план мобильного интерфейса, этап 1): адрес с ?diag=1, только владельцы сайта.
 *  Поверх страницы — размеры окна и видимой области (visualViewport), отступы безопасной зоны, что лежит у нижнего края
 *  экрана и где кнопки открытой формы. Скриншот с телефона — чтобы править отступы по данным, а не наугад. */
export const diagOn = (search: string, admin: boolean): boolean => admin && /(^|[?&])diag=1(&|$)/.test(search || '');

const who = (el: Element | null): string => {
  if (!el) return '—';
  const parts: string[] = [];
  for (let e: Element | null = el; e && parts.length < 3; e = e.parentElement) {
    const cls = typeof e.className === 'string' ? e.className.split(/\s+/).filter(c => c && !/^p_|^f_/.test(c)).slice(0, 2).join('.') : '';
    parts.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (cls ? '.' + cls : ''));
  }
  return parts.join(' < ');
};

/** Отступы безопасной зоны (env(safe-area-inset-*)) — через пробный элемент. */
function insets(): string {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(d);
  const s = getComputedStyle(d); const v = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(x => parseFloat(x) || 0).join(' ');
  d.remove();
  return v;
}

export const Diag: React.FC = () => {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const up = (): void => tick(n => n + 1);
    const vv = window.visualViewport;
    window.addEventListener('resize', up); window.addEventListener('scroll', up, true);
    if (vv) { vv.addEventListener('resize', up); vv.addEventListener('scroll', up); }
    const tm = window.setInterval(up, 1000);
    return () => { window.removeEventListener('resize', up); window.removeEventListener('scroll', up, true);
      if (vv) { vv.removeEventListener('resize', up); vv.removeEventListener('scroll', up); } window.clearInterval(tm); };
  }, []);
  const vv = window.visualViewport;
  const H = vv ? vv.height : window.innerHeight;
  const act = document.querySelector('.pmo-panel.open form .actions');
  const ar = act ? act.getBoundingClientRect() : null;
  const top = document.querySelector('.pmo-app header.top');
  const tr = top ? top.getBoundingClientRect() : null;
  const rows: [string, string][] = [
    ['окно', `${window.innerWidth}×${window.innerHeight} · dpr ${window.devicePixelRatio}`],
    ['видимая область', vv ? `${Math.round(vv.width)}×${Math.round(vv.height)} · сдвиг ${Math.round(vv.offsetTop)} · масштаб ${vv.scale.toFixed(2)}` : 'нет visualViewport'],
    ['безопасная зона (в п л н)', insets()],
    ['шапка', tr ? `верх ${Math.round(tr.top)} · высота ${Math.round(tr.height)}` : '—'],
    ['у нижнего края', who(document.elementFromPoint(window.innerWidth / 2, Math.max(0, H - 6)))],
    ['кнопки формы', ar ? `низ ${Math.round(ar.bottom)} из ${Math.round(H)}${ar.bottom > H ? ' — НИЖЕ видимой области' : ''}` : 'форма не открыта'],
    ['браузер', navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 120)]];
  return <div className="pmo-diag" role="status" aria-live="off">{rows.map(([k, v]) => <div key={k}><b>{k}:</b> {v}</div>)}</div>;
};
