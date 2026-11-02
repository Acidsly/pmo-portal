import V from '../../tests/cases/countries.json';
import { countryList, countryLabels, countryChoices, validateCountry, countryWarnings, countryStale, CountryRaw } from '../src/webparts/pmoPortal/logic/countries';

// Довідник «Країни і CEO»: общие векторы tests/cases/countries.json (их же прогоняет прототип — countries-prototype.test.ts)
describe('countries.json', () => {
  for (const c of V.list) test(`список: ${c.name}`, () => { expect(countryList(c.rows as CountryRaw[] | null).map(x => x.name)).toEqual(c.expect); });
  for (const c of V.labels) test(`переклади: ${c.name}`, () => {
    const all = countryLabels(countryList(c.rows as CountryRaw[] | null));
    const pick = (c as { pick?: string }).pick;
    expect(pick ? { [pick]: all[pick] } : all).toEqual(c.expect);
  });
  for (const c of V.choices) test(`варіанти: ${c.name}`, () => { expect(countryChoices(countryList(c.rows as CountryRaw[]), c.current)).toEqual(c.expect); });
  for (const c of V.validate) test(`перевірка: ${c.name}`, () => { expect(validateCountry(c.draft, countryList(V.validateRows))).toEqual(c.expect); });
  for (const c of V.warnings) test(`попередження: ${c.name}`, () => { expect(countryWarnings({ active: c.active, ceo: c.ceo }, c.projects)).toEqual(c.expect); });
  for (const c of V.stale) test(`свіжість: ${c.name}`, () => { expect(countryStale(c.opened, c.fresh)).toBe(c.expect); });
});
