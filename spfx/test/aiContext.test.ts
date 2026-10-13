import cases from '../../tests/cases/ai-context.json';
import { buildReportContext, AiContextIn } from '../src/webparts/pmoPortal/logic/aiContext';

// Контекст помощника статус-отчёта (план помощника 2.1, 4.2): общие векторы tests/cases/ai-context.json
const base = (cases as any).base;
const merge = (b: any, xs: any[] | undefined): any[] => (xs || []).map(x => ({ ...b, ...x }));
function inputOf(c: any): AiContextIn {
  const i = c.input;
  return { project: { ...base.project, ...(i.project || {}) }, reports: merge(base.report, i.reports), risks: merge(base.risk, i.risks),
    changes: merge(base.change, i.changes), draft: i.draft ? { ...base.draft, ...i.draft } : undefined, prevCheck: i.prevCheck,
    lang: i.lang, today: i.today };
}
const at = (o: any, path: string): any => path.split('.').reduce((x, k) => (x === undefined || x === null ? undefined : x[k]), o);
const has = (o: any, path: string): boolean => {
  const ks = path.split('.'); const last = ks.pop()!; const parent = ks.length ? at(o, ks.join('.')) : o;
  return parent !== undefined && parent !== null && Object.prototype.hasOwnProperty.call(parent, last);
};

describe('контекст помощника отчёта', () => {
  // даты журнала — по местному времени: векторы около полуночи рассчитаны на Киев
  const tz = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'Europe/Kyiv'; });
  afterAll(() => { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; });
  (cases.cases as any[]).forEach(c => test(c.name, () => {
    const r = buildReportContext(inputOf(c), c.maxChars || 50000);
    const o = JSON.parse(r.json);
    if (c.keys) expect(Object.keys(o)).toEqual(c.keys);
    Object.keys(c.equal || {}).forEach(k => expect([k, at(o, k)]).toEqual([k, c.equal[k]]));
    (c.absent || []).forEach((k: string) => expect([k, has(o, k)]).toEqual([k, false]));
    Object.keys(c.length || {}).forEach(k => expect([k, at(o, k).length]).toEqual([k, c.length[k]]));
    (c.notContains || []).forEach((s: string) => expect(r.json).not.toContain(s));
    if (c.truncated !== undefined) expect(r.truncated).toBe(c.truncated);
    if (c.maxChars && c.truncated && !c.overLimit) expect(r.json.length).toBeLessThanOrEqual(c.maxChars);
    expect(!!o.truncated).toBe(r.truncated);
    expect(r.tooLarge).toBe(!!c.tooLarge);
    expect(!!o.tooLarge).toBe(r.tooLarge);
  }));
  (cases.cases as any[]).forEach(c => test('порядок входа не важен: ' + c.name, () => {
    const a = inputOf(c), b = { ...a, reports: a.reports.slice().reverse(), risks: a.risks.slice().reverse(), changes: a.changes.slice().reverse() };
    expect(buildReportContext(b, c.maxChars || 50000).json).toBe(buildReportContext(a, c.maxChars || 50000).json);
  }));
  test('обрезка — по порядку: каждый следующий шаг только если предыдущего мало', () => {
    const t = (cases.cases as any[]).filter(c => /^обрезка [123]:/.test(c.name)).map(c => c.maxChars);
    const full = (cases.cases as any[]).filter(c => c.truncated === false && c.length && c.length.changes === 20)[0];
    expect(buildReportContext(inputOf(full), 50000).json.length).toBeGreaterThan(t[0]);
    expect(t.length).toBe(3);
    expect(t[0]).toBeGreaterThan(t[1]); expect(t[1]).toBeGreaterThan(t[2]);
  });
});
