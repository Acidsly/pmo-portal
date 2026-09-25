import * as React from 'react';

/** Всплывающее сообщение прототипа (#toast): показывается 4,2 с. */
export function useToast(): [string, (m: string) => void] {
  const [msg, setMsg] = React.useState('');
  const timer = React.useRef(0);
  const show = React.useCallback((m: string) => { setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(''), 4200); }, []);
  return [msg, show];
}
export const Toast: React.FC<{ msg: string }> = ({ msg }) =>
  <div className={'pmo-toast' + (msg ? ' show' : '')} role="status" aria-live="polite">{msg}</div>;
