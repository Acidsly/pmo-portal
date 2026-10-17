/** Настройки помощника ИИ у человека, а не у браузера (исправление 17.10.2026): включён ли и дано ли согласие — в поле
 *  nsPrefs своей строки «Прочитане» (JSON, другие ключи не трогаются). Строки ещё нет (её создаёт синхронизация) — только
 *  в браузере (ai/aiPref.ts). */
export interface AiPrefs { on: boolean; ok: boolean }

const objOf = (raw: string): Record<string, unknown> => {
  try { const o = JSON.parse(raw || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; }
};
/** Настройка из поля; не задана — null. */
export function aiPrefsOf(raw: string): AiPrefs | null {
  const o = objOf(raw);
  return 'ai' in o || 'aiOk' in o ? { on: o.ai === 1, ok: o.aiOk === 1 } : null;
}
/** Новое значение поля: прочие ключи — как были. */
export const withAiPrefs = (raw: string, p: AiPrefs): string => JSON.stringify({ ...objOf(raw), ai: p.on ? 1 : 0, aiOk: p.ok ? 1 : 0 });

/** Что действует: в строке задано — оно (включили на другом устройстве); строка есть, но пусто — запомненное браузером,
 *  и если оно не пустое — переносится в строку (push); строки нет — браузер. */
export function aiPrefsMerge(local: AiPrefs, server: AiPrefs | null, row: boolean): { value: AiPrefs; push: boolean } {
  if (row && server) return { value: server, push: false };
  return { value: local, push: row && (local.on || local.ok) };
}
