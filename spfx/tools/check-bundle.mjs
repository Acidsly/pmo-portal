// Проверка собранного бандла (после `heft package-solution`): стили приложения попадают в страницу.
// Класс ошибки (обновление стека 14.11.2026): сборка оставила в CSS обёртку `:global`, браузер отбросил все правила —
// приложение на сайте без оформления, а тесты в jsdom это не видят.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
const dist = join(process.cwd(), 'dist');
const main = readdirSync(dist).filter(f => /^pmo-portal-web-part_[0-9a-f]+\.js$/.test(f));
if (main.length !== 1) { console.error(`check-bundle: ожидался один pmo-portal-web-part_*.js в dist/, найдено ${main.length}`); process.exit(1); }
const js = readFileSync(join(dist, main[0]), 'utf8');
const errs = [];
if (/:global\b/.test(js)) errs.push('в CSS осталась обёртка :global — браузер отбросит правила (проверьте config/sass.json, preserveIcssExports)');
if (!js.includes('.pmo-app{--theme')) errs.push('в бандле нет переменных темы .pmo-app{--theme… — стили не собраны');
if (errs.length) { console.error('check-bundle:\n  ' + errs.join('\n  ')); process.exit(1); }
console.log(`check-bundle: ${main[0]} — стили на месте`);
