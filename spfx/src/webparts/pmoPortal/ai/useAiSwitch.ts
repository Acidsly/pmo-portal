import * as React from 'react';
import { AiUnavailable } from '../logic/aiCheck';
import { aiPref } from './aiPref';

/** Переключатель «Помічник ШІ» в меню пользователя (только пилотная группа). Включение: согласия ещё не было — вопрос
 *  с текстом согласия; «Дозволити» — enable() (служебный вызов агента); готово — согласие и «включено» запоминаются;
 *  ошибка — остаётся выключенным, причина видна. Согласие уже было — включается сразу. Выключение — сразу. */
export interface AiSwitch { on: boolean; asking: boolean; busy: boolean; err: AiUnavailable | null; toggle(): void; allow(): void; deny(): void }
export function useAiSwitch(email: string, pilot: boolean, enable: () => Promise<AiUnavailable | null>): AiSwitch | undefined {
  const [on, setOn] = React.useState(() => pilot && aiPref.on(email));
  const [asking, setAsking] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<AiUnavailable | null>(null);
  if (!pilot) return undefined;
  const turn = (v: boolean): void => { aiPref.setOn(email, v); setOn(v); };
  return {
    on, asking, busy, err,
    toggle: () => {
      setErr(null);
      if (on) { turn(false); setAsking(false); } else if (aiPref.consented(email)) turn(true); else setAsking(true);
    },
    allow: () => {
      if (busy) return;
      setBusy(true); setErr(null);
      enable().then(r => r, () => 'error' as AiUnavailable).then(r => {
        setBusy(false); setAsking(false);
        if (r) { setErr(r); return; }
        aiPref.setConsented(email, true); turn(true);
      }).catch(() => undefined);
    },
    deny: () => { setAsking(false); }
  };
}
