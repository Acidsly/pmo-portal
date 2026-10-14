import { AiUnavailable } from '../logic/aiCheck';
import { AiCallOut, aiErrorKind, consentStep } from '../logic/aiFlow';
import { aiFailInfo } from '../logic/aiFeedback';

/** Один разговор с агентом (ai/aiAgent.ts, AiSession): отправить текст, ответить «Дозволити» на карточку согласия. */
export interface AiPort { ask(text: string): Promise<AiCallOut>; allow(): Promise<AiCallOut>; /** номер разговора Copilot Studio */ readonly id?: string }
/** След запроса для разбора сбоя (автоматический отзыв): номер разговора, код ошибки, длительность. */
export interface AiTrace { conv?: string; code?: string; ms?: number }
export type AiRunOut<T> = { ok: true; value: T } | { ok: false; reason: AiUnavailable };

const fromError = (e: unknown): AiUnavailable => {
  if (String((e as Error)?.message || e) === 'timeout') return 'timeout';
  const k = aiErrorKind({ error: String((e as Error)?.message || e || 'error') });
  return k && k !== 'consent' ? k : 'error';
};

/** Запрос к помощнику (план этапа 4, задача 2): новый разговор на каждый запрос; карточка согласия — спросить PM
 *  (confirm), «Дозволити» — ответ карточки, тема агента продолжает исходный запрос; повторная карточка, «Скасувати»,
 *  ошибка, таймаут — ИИ недоступен с причиной. Ответ, который не разобрался (parse → null), — один повтор в новом
 *  разговоре, затем error. */
/** Начало разговора не дольше openMs (иначе — timeout): подвисшее подключение не держит форму и переключатель «занятыми». */
function withOpenTimeout(p: Promise<AiPort>, ms: number): Promise<AiPort> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<AiPort>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  const done = (): void => { if (timer) clearTimeout(timer); };
  return Promise.race([p, late]).then(v => { done(); return v; }, e => { done(); throw e; });
}
export async function aiRun<T>(open: () => Promise<AiPort>, text: string, parse: (raw: string) => T | null,
  confirm: () => Promise<boolean>, trace: AiTrace = {}, openMs: number = 60000): Promise<AiRunOut<T>> {
  const t0 = Date.now();
  // след сбоя: код из ответа агента или исключения, таймаут, нераспознанный ответ
  const failed = <R extends AiRunOut<T>>(r: R, out?: AiCallOut, ex?: unknown): R => {
    const info = aiFailInfo(`${(out && (out.error || out.text)) || ''}\n${ex ? String((ex as Error)?.message || ex) : ''}`);
    trace.code = info.code || (out && out.timeout ? 'timeout' : ex ? String((ex as Error)?.message || ex).slice(0, 120) : trace.code || '');
    if (info.conv) trace.conv = info.conv;
    trace.ms = Date.now() - t0;
    return r;
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    let out: AiCallOut;
    try {
      const port = await withOpenTimeout(open(), openMs);
      if (port.id) trace.conv = port.id;
      out = await port.ask(text);
      let kind = aiErrorKind(out);
      let step = consentStep(kind, false);
      if (step === 'ask') {
        if (!(await confirm())) return failed({ ok: false, reason: 'declined' });
        out = await port.allow();
        kind = aiErrorKind(out);
        step = consentStep(kind, true);
      }
      if (step === 'fail') return failed({ ok: false, reason: kind && kind !== 'consent' ? kind : 'error' }, out);
    } catch (e) { return failed({ ok: false, reason: fromError(e) }, undefined, e); }
    const v = parse(out.text || '');
    if (v !== null) return { ok: true, value: v };
    trace.code = 'unparsed';
  }
  return failed({ ok: false, reason: 'error' });
}
