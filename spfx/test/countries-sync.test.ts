import * as fs from 'fs';
import * as path from 'path';
import { COUNTRIES } from '../src/webparts/pmoPortal/logic/projects';
import { VALUES } from '../src/webparts/pmoPortal/i18n/values';

// Довідник країн: стартовый набор и переводы одинаковы в Deploy-PMO.ps1, приложении и прототипе; deploy не перезаписывает то, что ведёт PMO
const deploy = fs.readFileSync(path.join(__dirname, '../../scripts/Deploy-PMO.ps1'), 'utf8');
const proto = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');

test('стартовий набір: Deploy-PMO.ps1 = застосунок = прототип', () => {
  const m = /\$countries = @\(([^)]*)\)/.exec(deploy)!;
  expect(m[1].split(',').map(x => x.trim().replace(/^"|"$/g, ''))).toEqual(COUNTRIES);
  const p = /const COUNTRIES = \[([^\]]*)\]/.exec(proto)!;
  expect(p[1].split(',').map(x => x.trim().replace(/^'|'$/g, ''))).toEqual(COUNTRIES);
});

test('переклади стартового набору: Deploy-PMO.ps1 ($countryNames) = values.ts = VAL прототипу', () => {
  for (const n of COUNTRIES) {
    const d = new RegExp(`"${n}" = @\\("([^"]+)", "([^"]+)"\\)`).exec(deploy);
    expect([n, d && d[1], d && d[2]]).toEqual(VALUES[n]);
    expect(proto).toContain(`'${n}':['${VALUES[n].join("','")}']`);
  }
});

const block = (from: string, to: string): string => deploy.slice(deploy.indexOf(from), deploy.indexOf(to, deploy.indexOf(from)));

test('deploy: CEO з файлу — лише для нового рядка «Країни», перезапис — тільки з -ForceCeo; ключі файлу — з довідника', () => {
  const b = block('# 6f. Довідник країн', '# 6a2.');
  expect(b).toMatch(/\(\$ForceCeo -or \$isNew\)/);
  expect(b).not.toMatch(/\$countries -notcontains \$cty/);
  expect(b).toMatch(/if \(-not \$cnRows\[\$cty\]\) \{ throw/);
  // стартовые строки — только недостающие (переводы, порядок, «активна» PMO не меняются)
  expect(b).toMatch(/if \(-not \$cnRows\[\$cty\]\) \{\s*\$cnRows\[\$cty\] = Add-PnPListItem/);
  expect(b).not.toMatch(/Set-PnPListItem -List "Lists\/CountryNames"/);
});

test('deploy: країни довідника в полях вибору (FillInChoice), права — CEO лише PMO і власники, назви — всім', () => {
  expect(deploy).toMatch(/F \$P pmCountry .*FillInChoice='TRUE'/);
  expect(deploy).toMatch(/F \$PA paCountry .*FillInChoice='TRUE'/);
  expect(block('# 6f. Довідник країн', '# 6a2.')).toMatch(/@\("Lists\/Projects", "pmCountry"\), @\("Lists\/ProjectAssignments", "paCountry"\)/);
  expect(deploy).toMatch(/Set-ListRoles "Lists\/Countries" @\{ \(Get-PnPGroup -AssociatedOwnerGroup\)\.Title = \(Get-RoleName "Administrator"\); \$PMO_GROUP = \$ROLE_DIR \}/);
  expect(deploy).toMatch(/Set-ListRoles "Lists\/CountryNames" @\{ \$members\.Title = \$ROLE_READ; \$PMO_GROUP = \$ROLE_DIR \}/);
  // «Довідник (портал)»: добавлять и править, без удаления
  const r = /\$ROLE_DIR = "Довідник \(портал\)"[\s\S]*?-Include ([^|]+)\|/.exec(deploy)!;
  expect(r[1]).toMatch(/AddListItems/); expect(r[1]).toMatch(/EditListItems/); expect(r[1]).not.toMatch(/DeleteListItems/);
});
