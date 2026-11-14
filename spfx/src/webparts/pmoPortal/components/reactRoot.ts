import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';

/** Корни React по контейнерам: корень создаётся один раз, повторный рендер обновляет дерево (React 18). */
const roots = new WeakMap<Element, Root>();

/** Нарисовать элемент в контейнере: первый вызов создаёт корень, следующие — обновляют его, состояние сохраняется. */
export function renderInto(container: Element, element: React.ReactElement): void {
  let root = roots.get(container);
  if (!root) { root = createRoot(container); roots.set(container, root); }
  root.render(element);
}

/** Размонтировать дерево контейнера и забыть корень; без корня — ничего не делает. */
export function disposeRoot(container: Element): void {
  const root = roots.get(container);
  if (!root) return;
  root.unmount();
  roots.delete(container);
}
