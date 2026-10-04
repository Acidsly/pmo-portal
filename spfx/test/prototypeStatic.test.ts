import * as fs from 'fs';
import * as path from 'path';

// Обработчики в разметке прототипа лежат внутри шаблонных строк JS: одиночный «\d», «\s» там теряется (становится «d», «s»)
// и регулярное выражение молча ломается — так прототип не убирал ведущие нули в «% виконання» (#53). В исходнике — только «\\d».
test('в обработчиках разметки прототипа нет одиночных обратных слэшей', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
  const bad = Array.from(src.matchAll(/on[a-z]+="[^"]*"/g)).map(m => m[0]).filter(h => /(^|[^\\])\\[a-zA-Z]/.test(h));
  expect(bad).toEqual([]);
});
