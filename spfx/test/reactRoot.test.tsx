/** @jest-environment jsdom */
import * as React from 'react';
import { act } from 'react';
import { renderInto, disposeRoot } from '../src/webparts/pmoPortal/components/reactRoot';

// Корень React создаётся один раз на контейнер: повторный render() веб-части обновляет дерево, а не пересоздаёт его
let mounts = 0; let cleanups = 0;
const Probe: React.FC<{ label: string }> = ({ label }) => {
  const [n, setN] = React.useState(0);
  React.useEffect(() => { mounts++; return () => { cleanups++; }; }, []);
  return <button id="b" onClick={() => setN(n + 1)}>{label}:{n}</button>;
};
let box: HTMLDivElement;
beforeEach(() => { mounts = 0; cleanups = 0; box = document.createElement('div'); document.body.appendChild(box); });
afterEach(() => { act(() => { disposeRoot(box); }); box.remove(); });
const click = (): void => { act(() => { (box.querySelector('#b') as HTMLButtonElement).click(); }); };

test('повторный renderInto обновляет пропсы и сохраняет состояние — без повторного монтирования', () => {
  act(() => { renderInto(box, <Probe label="a" />); });
  click();
  expect(box.textContent).toBe('a:1');
  act(() => { renderInto(box, <Probe label="b" />); });
  expect(box.textContent).toBe('b:1');
  expect(mounts).toBe(1);
});

test('disposeRoot размонтирует (эффекты убраны, контейнер пуст); повторный вызов безопасен', () => {
  act(() => { renderInto(box, <Probe label="a" />); });
  act(() => { disposeRoot(box); });
  expect(cleanups).toBe(1);
  expect(box.innerHTML).toBe('');
  expect(() => disposeRoot(box)).not.toThrow();
});

test('после disposeRoot renderInto создаёт новый корень', () => {
  act(() => { renderInto(box, <Probe label="a" />); });
  act(() => { disposeRoot(box); });
  act(() => { renderInto(box, <Probe label="c" />); });
  expect(box.textContent).toBe('c:0');
  expect(mounts).toBe(2);
});

test('два контейнера — два независимых корня', () => {
  const other = document.createElement('div'); document.body.appendChild(other);
  act(() => { renderInto(box, <Probe label="a" />); renderInto(other, <Probe label="z" />); });
  act(() => { disposeRoot(other); });
  expect(box.textContent).toBe('a:0');
  expect(other.innerHTML).toBe('');
  other.remove();
});
