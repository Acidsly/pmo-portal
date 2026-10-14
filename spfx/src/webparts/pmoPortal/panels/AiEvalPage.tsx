import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { AppCtx } from '../components/ctx';
import { AI_CONFIG } from '../ai/aiConfig';
import { scoreReply, evalMessage, evalReply, evalSummary, evalSubset, EvalCase, EvalBase, EvalResult, EvalPart } from '../logic/aiEval';

/** «Набір перевірок» помощника отчёта (план этапа 4, задача 9; copilot/README.md): после каждой правки prompt — все случаи
 *  набора (или случаи одного prompt) по очереди в одном разговоре, ответ — тем же разбором, что в портале. Только пилотной
 *  группе, по адресу …#home///ai-spike; в портал ничего не пишет. Карточка согласия Copilot Studio подтверждается сама. */
type Agent = typeof import('../ai/aiAgent');
type Cases = { base: EvalBase; cases: EvalCase[] };
type Turn = { texts: string[]; ms: number; consent?: Record<string, unknown> };
const TIMEOUT = 60000;
const withTimeout = <T,>(p: Promise<T>): Promise<T> => Promise.race([p,
  new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error('немає відповіді за 60 с')), TIMEOUT))]);
const PARTS: [EvalPart, string][] = [['all', 'Усі'], ['draft', 'Лише «Чернетка»'], ['check', 'Лише «Перевірка»']];

export const AiEvalPage: React.FC<{ onCancel(): void }> = ({ onCancel }) => {
  const c = React.useContext(AppCtx);
  const [part, setPart] = React.useState<EvalPart>('all');
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [results, setResults] = React.useState<EvalResult[]>([]);
  const [total, setTotal] = React.useState(0);
  const run = async (): Promise<void> => {
    setBusy(true); setResults([]); setNote('Підключення…');
    try {
      const m: Agent = await import(/* webpackChunkName: 'pmo-ai' */ '../ai/aiAgent');
      const tok = await m.aiToken(c.me, () => undefined);
      const conv = new m.AiConversation(tok); await conv.start();
      const data = (await import(/* webpackChunkName: 'pmo-ai-eval' */ '../ai/evalCases.json')) as unknown as Cases;
      const set = (data as unknown as { default?: Cases }).default || data;
      const cases = evalSubset(set.cases, part); setTotal(cases.length);
      const out: EvalResult[] = [];
      for (const k of cases) {
        setNote(`${k.id} — чекаю відповідь (${out.length + 1} з ${cases.length})…`);
        let r: Turn;
        try {
          r = await withTimeout(conv.send(evalMessage(set.base, k)));
          // карточка согласия — подтверждается сама (согласие дано при включении «Помічник ШІ»), тот же запрос продолжается
          if (r.consent) r = await withTimeout(conv.sendValue(r.consent));
        } catch (e) {
          // запрос не отменяется: следующий случай в том же разговоре наложился бы на опоздавший ответ — набор останавливается
          out.push({ id: k.id, kind: k.kind, negative: !!k.negative, pass: false, fails: ['error:' + String((e as Error).message || e)], ms: TIMEOUT, raw: '' });
          setResults(out.slice()); setNote(`${k.id}: ${String((e as Error).message || e)} — набір зупинено, запустіть знову`); setBusy(false); return;
        }
        const raw = r.texts.filter(t => !!t.trim()).pop() || '';   // ответ prompt — последнее непустое сообщение
        const sc = scoreReply(k.kind, evalReply(set.base, k, raw), k.expect);
        out.push({ id: k.id, kind: k.kind, negative: !!k.negative, pass: sc.pass, fails: sc.fails, ms: r.ms, raw: raw.slice(0, 3000) });
        setResults(out.slice());
      }
      setNote('');
    } catch (e) { setNote('Помилка: ' + String((e as Error).message || e)); }
    setBusy(false);
  };
  const s = evalSummary(results);
  const copy = (): void => {
    const text = JSON.stringify({ at: new Date().toISOString(), part, summary: s, results }, null, 1);
    navigator.clipboard.writeText(text).then(() => c.toast('Результат скопійовано'), () => setNote('Не вдалося скопіювати — виділіть таблицю вручну'));
  };
  const done = !busy && results.length > 0 && results.length === total;
  return <>
    <div className="ph"><div><div className="k"><EntTag kind="help" /><span>Copilot Studio · {AI_CONFIG.schemaName}</span></div><h2>Набір перевірок ШІ</h2></div>
      <button className="x" aria-label={c.t('close')} onClick={onCancel}>×</button></div>
    <p className="note">Після кожної зміни prompt у Copilot Studio (збережено й опубліковано): випадки набору по черзі, оцінка — як у порталі. Поріг — 14 з 15 на prompt і всі негативні. Нічого не записує в портал; витрачає кредити Copilot Studio.</p>
    <fieldset className="ragpick"><legend>Що перевірити</legend><div className="seg" role="radiogroup">
      {PARTS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={part === v} aria-pressed={part === v} disabled={busy} onClick={() => setPart(v)}>{l}</button>)}</div></fieldset>
    <div className="actions top">
      <button className="btn primary" id="eval-run" disabled={busy} onClick={() => { run().catch(() => undefined); }}>{busy ? 'Виконується…' : 'Запустити'}</button>
      <button className="btn" disabled={busy || !results.length} onClick={copy}>Копіювати результат</button>
    </div>
    {note ? <p className="note" role="status">{note}</p> : null}
    {done ? <p className={'ai-msg ' + (s.ok ? 'ok' : 'warn')} id="eval-sum">Підсумок: чернетка {s.draft[0]}/{s.draft[1]}, перевірка {s.check[0]}/{s.check[1]}, негативні {s.negative[0]}/{s.negative[1]} — {s.ok ? 'поріг пройдено' : 'поріг НЕ пройдено'}</p> : null}
    {results.length ? <div className="tablewrap"><table className="ai-eval"><thead><tr><th>Випадок</th><th>Результат</th><th>Час, с</th><th>Що не так</th></tr></thead>
      <tbody>{results.map(x => <tr key={x.id}><td>{x.id}{x.negative ? ' (негативний)' : ''}</td><td>{x.pass ? 'так' : 'НІ'}</td><td>{(x.ms / 1000).toFixed(1)}</td>
        <td>{x.fails.join('; ')}</td></tr>)}</tbody></table></div> : null}
  </>;
};
