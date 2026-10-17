// Сгенерированные блоки в прототипе (prototype/pmo-prototype.html): тексты «Довідки», «Що змінилося» и «Детального огляду»
// те же, что в приложении, — из одних и тех же документов docs/. Блок — между метками /* <generated:имя> */ … /* </generated:имя> */;
// нет блока — вставляется перед словарями прототипа.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const PROTO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'prototype', 'pmo-prototype.html');
/** Значение для вставки в <script>: JSON без «</» (иначе «</script>» в тексте закрыл бы скрипт). */
export const js = v => JSON.stringify(v).replace(/<\//g, '<\\/');

export function setBlock(name, code) {
  const src = readFileSync(PROTO, 'utf8');
  const a = `/* <generated:${name}> — tools/${name === 'overview' ? 'overview' : 'guide'}.mjs, не править вручную */`, b = `/* </generated:${name}> */`;
  const block = `${a}\n${code}\n${b}`;
  const i = src.indexOf(a), j = src.indexOf(b);
  let out;
  if (i >= 0 && j > i) out = src.slice(0, i) + block + src.slice(j + b.length);
  else {
    const anchor = '/* ================= i18n ================= */';
    const k = src.indexOf(anchor); if (k < 0) throw new Error('нет места для блока в прототипе');
    out = src.slice(0, k) + block + '\n' + src.slice(k);
  }
  if (out !== src) writeFileSync(PROTO, out);
}
