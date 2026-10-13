import { AiUnavailable } from '../logic/aiCheck';
import { AiCallOut, aiErrorKind, consentStep } from '../logic/aiFlow';

/** Один разговор с агентом (ai/aiAgent.ts, AiSession): отправить текст, ответить «Дозволити» на карточку согласия. */
export interface AiPort { ask(text: string): Promise<AiCallOut>; allow(): Promise<AiCallOut> }
export type AiRunOut<T> = { ok: true; value: T } | { ok: false; reason: AiUnavailable };

const fromError = (e: unknown): AiUnavailable => {
  const k = aiErrorKind({ error: String((e as Error)?.message || e || 'error') });
  return k && k !== 'consent' ? k : 'error';
};

/** Запрос к помощнику (план этапа 4, задача 2): новый разговор на каждый запрос; карточка согласия — спросить PM
 *  (confirm), «Дозволити» — ответ карточки, тема агента продолжает исходный запрос; повторная карточка, «Скасувати»,
 *  ошибка, таймаут — ИИ недоступен с причиной. Ответ, который не разобрался (parse → null), — один повтор в новом
 *  разговоре, затем error. */
export async function aiRun<T>(open: () => Promise<AiPort>, text: string, parse: (raw: string) => T | null,
  confirm: () => Promise<boolean>): Promise<AiRunOut<T>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let out: AiCallOut;
    try {
      const port = await open();
      out = await port.ask(text);
      let kind = aiErrorKind(out);
      let step = consentStep(kind, false);
      if (step === 'ask') {
        if (!(await confirm())) return { ok: false, reason: 'declined' };
        out = await port.allow();
        kind = aiErrorKind(out);
        step = consentStep(kind, true);
      }
      if (step === 'fail') return { ok: false, reason: kind && kind !== 'consent' ? kind : 'error' };
    } catch (e) { return { ok: false, reason: fromError(e) }; }
    const v = parse(out.text || '');
    if (v !== null) return { ok: true, value: v };
  }
  return { ok: false, reason: 'error' };
}
