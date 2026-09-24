import * as React from 'react';

/** Выдвижная панель прототипа: затемнение, Esc закрывает, фокус возвращается туда, откуда открыли. */
export const Panel: React.FC<{ open: boolean; onClose(): void; label: string; children?: React.ReactNode }> = p => {
  const ref = React.useRef<HTMLElement>(null);
  const back = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!p.open) return;
    back.current = document.activeElement as HTMLElement;
    if (ref.current) { ref.current.scrollTop = 0; ref.current.focus(); }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') p.onClose(); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (back.current && back.current.focus) back.current.focus(); };
  }, [p.open]);
  return <>
    <div className={'pmo-scrim' + (p.open ? ' open' : '')} onClick={p.onClose} />
    <aside ref={ref} tabIndex={-1} className={'pmo-panel' + (p.open ? ' open' : '')} role="dialog" aria-modal="true" aria-hidden={!p.open} aria-label={p.label}>
      {p.open ? p.children : null}
    </aside>
  </>;
};
