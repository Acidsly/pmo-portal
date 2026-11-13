import * as fs from 'fs';
import * as path from 'path';

// Класс ошибки: рендер прежним API React 17 оставляет дерево в режиме совместимости (и тесты проверяют не то, что работает на портале)
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
const root = path.join(__dirname, '..');
const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'test'))].filter(f => !f.endsWith('react18-guard.test.ts'));
// 'react-dom' целиком запрещён (любой алиас и именованный импорт render); разрешены только react-dom/client в reactRoot.ts
// и react-dom/test-utils ради Simulate
const legacy: [string, RegExp][] = [
  ['импорт react-dom', /from\s*['"]react-dom['"]|require\(\s*['"]react-dom['"]\s*\)/],
  ['unmountComponentAtNode', /unmountComponentAtNode/],
  ['act из react-dom/test-utils', /import\s*\{[^}]*\bact\b[^}]*\}\s*from\s*['"]react-dom\/test-utils['"]/],
  ['createRoot вне reactRoot.ts', /\bcreateRoot\(|from\s*['"]react-dom\/client['"]/]
];

test('в приложении и тестах нет прежнего API рендера React 17; createRoot — только в reactRoot.ts', () => {
  const found: string[] = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const [name, re] of legacy) {
      if (name.startsWith('createRoot') && f.endsWith(path.join('components', 'reactRoot.ts'))) continue;
      if (re.test(text)) found.push(path.relative(root, f) + ': ' + name);
    }
  }
  expect(found).toEqual([]);
});

test('сторож видит файлы (не пустой обход)', () => {
  expect(files.length).toBeGreaterThan(150);
});
