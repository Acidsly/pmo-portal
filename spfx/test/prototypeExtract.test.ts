import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

// Прототип можно менять, не трогая портал (решение 18.10.2026): тексты (T, FLD) и стили (первый <style>) приложения
// генерируются из прототипа — то, что есть только в прототипе, лежит в T_PROTO (стили — все из прототипа; только для SharePoint — в theme/overrides.scss).
// Генерация из текущего прототипа должна давать ровно файлы приложения.
test('генерация из прототипа = тексты и стили приложения', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-extract-'));
  execFileSync(process.execPath, [path.join(__dirname, '../tools/extract-prototype.mjs')], { env: { ...process.env, PMO_EXTRACT_OUT: dir }, stdio: 'ignore' });
  const app = path.join(__dirname, '../src/webparts/pmoPortal');
  for (const f of ['i18n/strings.ts', 'theme/prototype.scss'])
    expect(fs.readFileSync(path.join(dir, f), 'utf8')).toBe(fs.readFileSync(path.join(app, f), 'utf8'));
});
