import * as React from 'react';
import { AiEnableFail } from '../logic/aiLogin';
import { AiPrefs, aiPrefsMerge } from '../logic/aiPrefs';
import { aiPref } from './aiPref';

/** Переключатель «Помічник ШІ» в меню пользователя (только пилотная группа). Включение: согласия ещё не было — вопрос
 *  с текстом согласия; «Дозволити» — enable() (вход и служебный вызов агента); готово — согласие и «включено» запоминаются;
 *  ошибка — остаётся выключенным, причина видна. Согласие уже было — включается сразу. Выключение — сразу.
 *  Значение — у человека (store: своя строка «Прочитане»), браузер — копия до загрузки данных и пока строки нет.
 *  Вход с переходом на страницу (телефон): после возврата включение продолжается само (enable(true)). */
export interface AiSwitch { on: boolean; asking: boolean; busy: boolean; err: AiEnableFail | null; toggle(): void; allow(): void; deny(): void }
/** Хранилище у человека: row — строка «Прочитане» есть; prefs — что в ней (null — не задано); save — записать. */
export interface AiStore { row: boolean; prefs: AiPrefs | null; save(p: AiPrefs): Promise<unknown> }
export function useAiSwitch(email: string, pilot: boolean, enable: (resume: boolean) => Promise<AiEnableFail | null>, store?: AiStore): AiSwitch | undefined {
  const [on, setOn] = React.useState(() => pilot && aiPref.on(email));
  const [asking, setAsking] = React.useState(false);
  const [busy, setBusy] = React.useState(() => pilot && aiPref.pending(email));
  const [err, setErr] = React.useState<AiEnableFail | null>(null);
  const storeRef = React.useRef(store); storeRef.current = store;
  const row = !!store && store.row, sp = store ? `${row}:${store.prefs ? `${store.prefs.on}${store.prefs.ok}` : ''}` : '';
  const spRef = React.useRef(sp); spRef.current = sp;
  const busyRef = React.useRef(busy);
  // выбор сделан здесь, а строки ещё нет в данных (включение после возврата со входа раньше загрузки) — записать, когда появится,
  // а не уступить прежнему значению строки
  const unsaved = React.useRef<AiPrefs | null>(null);
  // записи по очереди: быстрое «включить — выключить» не переставляется
  const chain = React.useRef<Promise<unknown>>(Promise.resolve());
  const save = (st: AiStore, p: AiPrefs): void => { chain.current = chain.current.then(() => st.save(p)).catch(() => undefined); };
  // выбор этого сеанса важнее строки, загруженной до него (данные ещё не перечитаны); новые данные — снова по строке
  const chosenAt = React.useRef<string | null>(null);
  const persist = (p: AiPrefs): void => {
    chosenAt.current = spRef.current;
    aiPref.setOn(email, p.on); aiPref.setConsented(email, p.ok); setOn(p.on);
    const st = storeRef.current;
    if (st && st.row) { unsaved.current = null; save(st, p); } else unsaved.current = p;
  };
  const done = (): void => { busyRef.current = false; setBusy(false); aiPref.setPending(email, false); };
  const run = (resume: boolean): void => {
    busyRef.current = true; setBusy(true); setErr(null);
    enable(resume).then(r => r, () => ({ reason: 'error' }) as AiEnableFail).then(r => {
      done(); setAsking(false);
      if (r) { setErr(r); return; }
      persist({ on: true, ok: true });
    }).catch(() => undefined);
  };
  React.useEffect(() => {
    // возврат со входа с переходом на страницу — включение продолжается (согласие PM уже дал перед уходом)
    if (pilot && aiPref.pending(email)) run(true);
    // «Назад» со страницы Microsoft, а Safari вернул страницу из кэша как была («Вмикається…»): вход брошен
    const back = (e: PageTransitionEvent): void => { if (e.persisted && busyRef.current) { done(); setAsking(false); } };
    window.addEventListener('pageshow', back);
    return () => window.removeEventListener('pageshow', back);
  }, []);
  // данные загружены: значение у человека важнее браузера (включили на телефоне — включено и на компьютере)
  React.useEffect(() => {
    if (!pilot || !store || busy || chosenAt.current === sp) return;
    chosenAt.current = null;
    if (unsaved.current) { if (store.row) { save(store, unsaved.current); unsaved.current = null; } return; }
    const m = aiPrefsMerge({ on: aiPref.on(email), ok: aiPref.consented(email) }, store.prefs, store.row);
    aiPref.setOn(email, m.value.on); aiPref.setConsented(email, m.value.ok); setOn(m.value.on);
    if (m.push) save(store, m.value);
  }, [sp, busy]);
  if (!pilot) return undefined;
  const consented = (): boolean => { const st = storeRef.current; return st && st.row && st.prefs ? st.prefs.ok || aiPref.consented(email) : aiPref.consented(email); };
  return {
    on, asking, busy, err,
    toggle: () => {
      if (busyRef.current) return;
      setErr(null);
      if (on) { persist({ on: false, ok: consented() }); setAsking(false); } else if (consented()) persist({ on: true, ok: true }); else setAsking(true);
    },
    // вызывается прямо из нажатия: окно входа Microsoft должно открыться в этом же нажатии
    allow: () => { if (!busyRef.current) run(false); },
    deny: () => { setAsking(false); }
  };
}
