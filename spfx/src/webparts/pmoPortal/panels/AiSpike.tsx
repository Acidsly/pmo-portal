import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { AI_CONFIG } from '../ai/aiConfig';
import { buildReportContext } from '../logic/aiContext';
import { aiMessage, scoreReply, evalInput, evalSummary, EvalCase, EvalBase, EvalResult } from '../logic/aiEval';

/** Технический прототип помощника отчёта (этап 1, «да / нет»): вход, вызов агента, объём данных, формат ответа.
 *  Только пилотной группе, по адресу …#…///ai-spike; формы портала не меняет. Временный — убирается после этапа 1. */
type Agent = typeof import('../ai/aiAgent');
type Cases = { base: EvalBase; cases: EvalCase[] };
const TIMEOUT = 60000;
const withTimeout = <T,>(p: Promise<T>): Promise<T> => Promise.race([p,
  new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('немає відповіді за 60 с')), TIMEOUT))]);
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
  const [results, setResults] = React.useState<EvalResult[]>([]);
  // набор проверок агента (copilot/README.md): все случаи по очереди, ответ — тем же строгим разбором, что в портале
  const runEval = run(async () => {
    if (!conv.current) { add('Спершу «Підключитися»'); return; }
    const data = (await import(/* webpackChunkName: 'pmo-ai-eval' */ '../ai/evalCases.json')) as unknown as Cases;
    const set = (data as unknown as { default?: Cases }).default || data;
    const out: EvalResult[] = [];
    setResults([]);
    for (const c of set.cases) {
      const msg = aiMessage(c.kind, buildReportContext(evalInput(set.base, c)).json);
      let r: Turn;
      try { r = await withTimeout(conv.current.send(msg)); } catch (e) {
        // запрос не отменяется: следующий случай в том же разговоре наложился бы на опоздавший ответ — набор останавливается
        out.push({ id: c.id, kind: c.kind, negative: !!c.negative, pass: false, fails: ['error:' + String((e as Error).message || e)], ms: TIMEOUT, raw: '' });
        setResults(out.slice()); add(`${c.id} помилка — набір зупинено; «Підключитися» і запустіть знову`); break;
      }
      if (r.consent) { note(r); add('набір зупинено: натисніть «Дозволити» і запустіть знову'); break; }
      const raw = r.texts.filter(t => !!t.trim()).pop() || '';  // ответ prompt — последнее непустое сообщение
      const sc = scoreReply(c.kind, raw, c.expect);
      out.push({ id: c.id, kind: c.kind, negative: !!c.negative, pass: sc.pass, fails: sc.fails, ms: r.ms, raw: raw.slice(0, 3000) });
      add(`${c.id} ${sc.pass ? 'так' : 'НІ'} · ${r.ms} мс${sc.fails.length ? ' · ' + sc.fails.join('; ') : ''}`);
      setResults(out.slice());
    }
    const s = evalSummary(out);
    add(`ПІДСУМОК: чернетка ${s.draft[0]}/${s.draft[1]}, перевірка ${s.check[0]}/${s.check[1]}, негативні ${s.negative[0]}/${s.negative[1]} — ${s.ok ? 'поріг пройдено' : 'поріг НЕ пройдено'}`);
  });
  const copy = (): void => {
    const text = JSON.stringify({ at: new Date().toISOString(), summary: evalSummary(results), results }, null, 1);
    navigator.clipboard.writeText(text).then(() => add('результат скопійовано'), () => add('не вдалося скопіювати — виділіть журнал вручну'));
  };
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
    <div className="actions top">
      <button className="btn" disabled={busy} onClick={runEval}>Набір перевірок</button>
      <button className="btn" disabled={busy || !results.length} onClick={copy}>Копіювати результат</button>
    </div>
    {busy && <p className="note">Чекаю відповідь агента…</p>}
    <pre className="ai-log" style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: '60vh', overflow: 'auto' }}>{log.join('\n') || '—'}</pre>
  </>;
};
