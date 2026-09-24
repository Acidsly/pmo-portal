import * as React from 'react';

/** Всплывающее окно у кнопки (openPop прототипа): фильтр — слева под кнопкой, колонки — справа; не выходит за окно. */
export const Pop: React.FC<{ anchor: HTMLElement; align: 'left' | 'right'; onClose(): void; children?: React.ReactNode }> = p => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number }>({ left: -9999, top: -9999 });
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const r = p.anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let left = p.align === 'left' ? r.left : r.right - w, top = r.bottom + 6;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 6);
    setPos({ left, top });
    const q = el.querySelector('input[type=search]') as HTMLInputElement | null; if (q) q.focus();
  }, [p.anchor]);
  React.useEffect(() => {
    const down = (e: MouseEvent): void => { if (ref.current && !ref.current.contains(e.target as Node) && !p.anchor.contains(e.target as Node)) p.onClose(); };
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); p.onClose(); } };
    const scroll = (e: Event): void => { if (ref.current && !ref.current.contains(e.target as Node)) p.onClose(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true); window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true); window.removeEventListener('scroll', scroll, true); };
  }, [p.anchor, p.onClose]);
  return <div ref={ref} className="pmo-pop" style={{ left: pos.left, top: pos.top }}>{p.children}</div>;
};
