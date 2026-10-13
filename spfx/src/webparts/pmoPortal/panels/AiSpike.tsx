import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { AI_CONFIG } from '../ai/aiConfig';

/** Технический прототип помощника отчёта (этап 1, «да / нет»): вход, вызов агента, объём данных, формат ответа.
 *  Только пилотной группе, по адресу …#…///ai-spike; формы портала не меняет. Временный — убирается после этапа 1. */
type Agent = typeof import('../ai/aiAgent');
const sizes = [1, 5, 20, 50, 150, 300];
const payload = (kb: number): string => {
  const head = '{"project":{"code":"PRJ-TEST","title":"Перевірка обсягу"},"pad":"';
  const pad = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя '.repeat(Math.ceil((kb * 1024) / 34)).slice(0, kb * 1024);
  return `ТЕСТ:\n<<DATA>>\n${head}${pad}"}\n<</DATA>>`;
};

export const AiSpike: React.FC<{ onCancel(): void; aadToken?: (resource: string) => Promise<string> }> = ({ onCancel, aadToken }) => {
  const c = React.useContext(AppCtx);
  const [log, setLog] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  type Turn = { texts: string[]; ms: number; types: string[]; raw: string; consent?: Record<string, unknown> };
  const conv = React.useRef<{ send(t: string): Promise<Turn>; sendValue(v: Record<string, unknown>): Promise<Turn> } | null>(null);
  const [consent, setConsent] = React.useState<Record<string, unknown> | undefined>(undefined);
  const add = (s: string): void => setLog(l => l.concat(`${new Date().toLocaleTimeString('uk-UA')} ${s}`));
  const note = (r: Turn): void => { setConsent(r.consent); if (r.consent) add('агент просить згоду на використання даних — натисніть «Дозволити»'); };
  const load = (): Promise<Agent> => import(/* webpackChunkName: 'pmo-ai' */ '../ai/aiAgent');
  const run = (f: () => Promise<void>) => async (): Promise<void> => {
    setBusy(true);
    try { await f(); } catch (e) { add('ПОМИЛКА: ' + String((e as Error).message || e)); }
    setBusy(false);
  };
  const connect = run(async () => {
    const m = await load();
    const tok = await m.aiToken(c.me, add);
    add(`токен отримано (${tok.length} символів), scope ${m.aiScope()}`);
    const cv = new m.AiConversation(tok); const r = await cv.start(); conv.current = cv;
    add(`розмову почато за ${r.ms} мс; activity: ${r.types.join(', ')}; привітання: ${r.texts.join(' | ').slice(0, 200)}`);
  });
  const pathA = run(async () => {
    if (!aadToken) { add('Шлях A: немає AadTokenProvider'); return; }
    const m = await load();
    const t = await aadToken(m.aiScope().replace('/.default', ''));
    add(`Шлях A (AadTokenProvider): токен ${t.length} символів`);
    const cv = new m.AiConversation(t); const r = await cv.start(); conv.current = cv;
    add(`Шлях A: розмову почато за ${r.ms} мс; activity: ${r.types.join(', ')}; привітання: ${r.texts.join(' | ').slice(0, 200)}`);
  });
  const test = (kb: number) => run(async () => {
    if (!conv.current) { add('Спершу «Підключитися»'); return; }
    const r = await conv.current.send(payload(kb));
    add(`${kb} КБ → ${r.ms} мс; activity: ${r.types.join(', ')}; відповідь: ${r.texts.join(' | ').slice(0, 300)}`); note(r);
  });
  const allow = run(async () => {
    if (!conv.current || !consent) return;
    const r = await conv.current.sendValue(consent);
    add(`згода → ${r.ms} мс; activity: ${r.types.join(', ')}; відповідь: ${r.texts.join(' | ').slice(0, 600)}\nсире: ${r.raw}`); note(r);
  });
  const [free, setFree] = React.useState('');
  const sendFree = run(async () => {
    if (!conv.current) { add('Спершу «Підключитися»'); return; }
    const r = await conv.current.send(free);
    add(`текст (${free.length} символів) → ${r.ms} мс; activity: ${r.types.join(', ')}; відповідь: ${r.texts.join(' | ').slice(0, 600)}\nсире: ${r.raw}`); note(r);
  });
  return <>
    <div className="ph"><div><div className="k"><EntTag kind="help" /><span>Copilot Studio · {AI_CONFIG.schemaName}</span></div><h2>Перевірка ШІ (прототип)</h2></div>
      <button className="x" aria-label={c.t('close')} onClick={onCancel}>×</button></div>
    <p className="note">Технічна перевірка: вхід, виклик агента, обсяг даних, формат відповіді. Нічого не записує в портал.</p>
    <div className="actions top">
      <button className="btn primary" disabled={busy} onClick={connect}>Підключитися</button>
      <button className="btn" disabled={busy} onClick={pathA}>Шлях A (без реєстрації)</button>
      {sizes.map(k => <button key={k} className="btn" disabled={busy} onClick={test(k)}>Тест {k} КБ</button>)}
    </div>
    <div className="actions top">
      <textarea aria-label="Текст для агента" rows={2} style={{ flex: 1 }} value={free} onChange={e => setFree(e.target.value)} />
      <button className="btn" disabled={busy || !free.trim()} onClick={sendFree}>Надіслати текст</button>
      {consent && <button className="btn primary" disabled={busy} onClick={allow}>Дозволити</button>}
    </div>
    {busy && <p className="note">Чекаю відповідь агента…</p>}
    <pre className="ai-log" style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: '60vh', overflow: 'auto' }}>{log.join('\n') || '—'}</pre>
  </>;
};
