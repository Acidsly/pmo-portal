import * as fs from 'fs';
import * as path from 'path';
import { T } from '../src/webparts/pmoPortal/i18n/strings';

// Прототип — эталон интерфейса: помощник ИИ в форме статус-отчёта (план этапа 4, задача 7). Правила — общими векторами
// (tests/cases/ai-check.json, ai-flow.json, ai-rules.json) на функциях прототипа (window.PPM_RULES); сценарий — через кнопки.
// Разбор ответов агента и ошибок (aiErrorKind, consentStep) — только Jest приложения: агента в прототипе нет.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');
const HTML = fs.readFileSync(path.join(__dirname, '../../prototype/pmo-prototype.html'), 'utf8');
const vec = (f: string): any => JSON.parse(fs.readFileSync(path.join(__dirname, '../../tests/cases', f), 'utf8'));
const CHECK = vec('ai-check.json'), FLOW = vec('ai-flow.json'), RULES = vec('ai-rules.json');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any;
let w: W;
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));
const flush = async (): Promise<void> => { for (let i = 0; i < 5; i++) await tick(); };
beforeEach(async () => {
  w = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://pmo.test/', beforeParse(win: W) {
    win.matchMedia = () => ({ matches: false, addEventListener() { /* */ }, removeEventListener() { /* */ }, addListener() { /* */ } });
    win.HTMLElement.prototype.scrollIntoView = function (): void { /* */ }; win.scrollTo = () => undefined; win.PPM_AI_DELAY = 0; } }).window;
  for (let i = 0; i < 20 && !w.document.querySelector('[data-act="lang"]'); i++) await tick();
  w.document.querySelector('[data-act="lang"][data-i="0"]').click();
});
afterEach(() => { if (w) w.close(); });
const R = (): W => w.PPM_RULES;
/** Случай вектора — отдельный тест: «префикс + имя случая». */
const each = (xs: any[], label: (c: any) => string, prefix: string, f: (c: any) => void): void => xs.forEach(c => test(prefix + label(c), () => f(c)));

describe('прототип: правила помощника — общие векторы', () => {
  const draft = CHECK.draft;
  each(CHECK.print, (c: any) => c.name, 'отпечаток: ', (c: any) =>
    expect(R().reportPrint(draft) === R().reportPrint({ ...draft, ...c.change })).toBe(c.same));
  each(CHECK.button, (c: any) => c.name, 'кнопка: ', (c: any) => expect(R().aiButton(c.in)).toBe(c.out));
  each(CHECK.reply, (c: any) => c.name, 'ответ: ', (c: any) =>
    expect(R().acceptReply(R().reportPrint({ ...draft, ...c.request }), R().reportPrint({ ...draft, ...c.current }))).toBe(c.out));
  each(CHECK.unavailable, (c: any) => c.lang + ' ' + c.reason, 'без проверки: ', (c: any) => expect(R().unavailableNote(c.reason, c.lang)).toBe(c.out));
  each(FLOW.action, (c: any) => c.name, 'нажатие: ', (c: any) => expect(R().aiAction(c.in)).toBe(c.out));
  each(FLOW.unavailable, (c: any) => c.name, 'недоступен: ', (c: any) => expect(R().aiUnavailable(c.at, c.current)).toBe(c.out));
  each(FLOW.save, (c: any) => c.name, 'поля записи: ', (c: any) => expect(R().aiSaveFields(c.in)).toEqual(c.out));
  each(FLOW.prevCheck, (c: any) => c.name, 'prevCheck: ', (c: any) => expect(R().nextPrevCheck(c.result, c.lang)).toBe(c.out));
  each(FLOW.insert, (c: any) => c.name, 'вставка: ', (c: any) => expect(R().draftInsert(c.form, c.ai)).toEqual(c.out));
  each(FLOW.undo, (c: any) => c.name, 'отмена вставки: ', (c: any) => expect(R().undoAvailable(c.after, c.current)).toBe(c.out));
  each(FLOW.view, (c: any) => c.name, 'просмотр: ', (c: any) => expect(R().aiView(c.check, c.at)).toBe(c.out));
  each(FLOW.riskRefs, (c: any) => c.name, 'записи в пункте: ', (c: any) => expect(R().riskRefs(c.item, c.risks).map((r: any) => r.id)).toEqual(c.out));
  each(FLOW.mention, (c: any) => c.name, 'упоминание: ', (c: any) => {
    const line = R().mentionLine(c.risk, c.type, { score: 'оцінка', due: 'термін', mit: 'заходи' }, (s: string) => s.split('-').reverse().join('.'));
    expect(line === null ? null : R().appendLine(c.field, line)).toBe(c.out);
  });
  const vin = (c: any): any => ({ project: { ...RULES.base.project, ...(c.project || {}) }, lang: c.lang || 'uk', today: RULES.base.today,
    risks: (c.risks || [{}]).map((x: object) => ({ ...RULES.base.risk, ...x })), draft: c.draft === null ? undefined : { ...RULES.base.draft, ...(c.draft || {}) } });
  each(RULES.rules, (c: any) => c.name, 'пункты кода: ', (c: any) => expect(R().ruleItems(vin(c))).toEqual(c.out));
  each(RULES.mention, (c: any) => c.name, 'обязательные записи: ', (c: any) => expect(R().mustMention(vin(c)).map((k: any) => k.id)).toEqual(c.out));
});

// сценарий через кнопки
const q = (s: string): W => w.document.querySelector(s);
const ev = (el: W, t: string): void => { el.dispatchEvent(new w.Event(t, { bubbles: true })); };
/** Кнопка меню пользователя (обработчик — по data-act на документе). */
function menu(act: string, v?: string): void { const b = w.document.createElement('button'); b.dataset.act = act; if (v) b.dataset.v = v; w.document.body.appendChild(b); b.click(); b.remove(); }
/** «Помічник ШІ» вкл / викл; «down» — вкл и «Імітувати збій ШІ». */
function demo(v: 'off' | 'on' | 'down'): void { menu('aidemo', v === 'off' ? 'off' : 'on'); if (v === 'down') menu('aifail'); }
function openForm(): W {
  q('[data-act="nav"][data-page="reports"]').click();
  q('[data-act="newrep"]:not([data-id])').click();
  return q('#repform');
}
const fill = (f: W): void => {
  for (const n of ['sched', 'budget', 'res']) { const r = f.querySelector(`input[name="${n}"][value="Зелений"]`); r.checked = true; ev(r, 'change'); }
  const t = f.querySelector('#f-t'); t.value = 'Резюме'; ev(t, 'input');
};
const submit = async (f: W): Promise<void> => { f.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await flush(); };
const sub = (): W => q('#f-submit');
/** После сохранения открыта карточка проекта: новый отчёт — первый в списке; открыть его просмотр. */
const openSaved = (): void => { const el = q('.rep-open[data-act="repopen"]'); if (!el) throw new Error('нет отчёта в карточке'); el.click(); };

describe('прототип: помощник в форме отчёта', () => {
  test('«Помічник ШІ» выключен (по умолчанию и после «вимкнено») — форма без ИИ: «Зберегти», кнопок ИИ нет; сбой при выключении сбрасывается', () => {
    demo('down'); demo('off');
    const f = openForm();
    expect(f.querySelector('#ai-fill')).toBeNull();
    expect([sub().className, sub().textContent]).toEqual(['btn primary', T.save[0]]);
  });
  test('«Заповнити з ШІ»: согласие один раз → пустые поля заполнены, «Що не забути» и оценки; «Прийняти» ставит оценку; «Скасувати вставку»', async () => {
    demo('on'); const f = openForm();
    expect(sub().className).toBe('btn ai'); expect(sub().textContent).toBe(T.aiCheckBtn[0]);
    expect(sub().querySelector('svg').innerHTML).toBe(q('#ai-fill svg').innerHTML);
    q('#ai-fill').click(); await flush();
    expect(f.textContent).toContain(T.aiConsent[0]);
    Array.from(f.querySelectorAll('[data-ai="allow"]')).forEach((b: W) => b.click()); await flush();
    expect(f.querySelector('#f-t').value).not.toBe('');
    expect(f.querySelector('#f-next').value).toContain(T.aiDemoNext[0]);
    expect(q('#ai-assist')).not.toBeNull();
    const acc = q('#ai-assist [data-ai="accept"]');
    expect(acc).not.toBeNull();
    const k = acc.dataset.k, name = { schedule: 'sched', budget: 'budget', resources: 'res' }[k as 'schedule'];
    acc.click();
    expect(f.querySelector(`input[name="${name}"]:checked`)).not.toBeNull();
    // второй вызов — без согласия; поле с другим текстом — вопрос «Замінити текст?»
    const t = f.querySelector('#f-t'); t.value = 'Моє резюме'; ev(t, 'input');
    q('#ai-fill').click(); await flush();
    expect(f.textContent).not.toContain(T.aiConsent[0]);
    expect(f.querySelector('[data-ai="yes"]')).not.toBeNull();
  });
  test('«Скасувати вставку» возвращает пустые поля', async () => {
    demo('on'); const f = openForm();
    q('#ai-fill').click(); await flush(); q('[data-ai="allow"]').click(); await flush();
    q('[data-ai="undo"]').click();
    expect([f.querySelector('#f-t').value, f.querySelector('#f-next').value]).toEqual(['', '']);
  });
  test('проверка: ошибки формы — ИИ не вызывается; затем пункты в поле ИИ → «Зберегти» → отчёт с текстом проверки, в просмотре — блок ИИ', async () => {
    demo('on'); const f = openForm();
    await submit(f);
    expect(q('#f-ai')).toBeNull(); expect(f.textContent).not.toContain(T.aiConsent[0]);
    fill(f);
    await submit(f); q('[data-ai="allow"]').click(); await flush();
    expect(q('#f-ai')).not.toBeNull(); expect(q('#f-ai').getAttribute('aria-readonly')).toBe('true');
    expect([sub().className, sub().textContent]).toEqual(['btn primary', T.save[0]]);
    // изменил отчёт — снова «Перевірити з ШІ»
    const iss = f.querySelector('#f-iss'); iss.value = iss.value + '\n– Нове'; ev(iss, 'input');
    expect(sub().textContent).toBe(T.aiCheckBtn[0]);
    await submit(f);
    const box = q('#f-ai').cloneNode(true); box.querySelectorAll('.ai-ref').forEach((x: W) => x.remove());   // без кнопок «Показати запис»
    const text = box.textContent;
    await submit(f);
    openSaved();
    expect(q('.rv-ai-text').textContent.replace(/\s+/g, '')).toBe(text.replace(/\s+/g, ''));
    expect(q('#rv-ai').textContent).toContain(T.aiCheckedAt[0].replace('{date}', '').trim());
  });
  test('«Помічник ШІ» включён, ИИ не ответил — «Зберегти без перевірки», в записи причина без времени; в просмотре — «Збережено без перевірки ШІ»', async () => {
    demo('down'); const f = openForm(); fill(f);
    await submit(f); q('[data-ai="allow"]').click(); await flush();
    expect(sub().textContent).toBe(T.aiSaveWithout[0]);
    expect(q('#f-ai').textContent).toBe('Перевірку ШІ не виконано: помилка сервісу ШІ');
    await submit(f);
    openSaved();
    expect(q('.rv-ai-text').textContent).toBe('Перевірку ШІ не виконано: помилка сервісу ШІ');
    expect(q('#rv-ai').textContent).toContain(T.aiWithout[0]); expect(q('#rv-ai').textContent).not.toContain(T.aiCheckedAt[0].replace('{date}', '').trim());
  });
  test('«Скасувати» в согласии — ИИ недоступен (нет согласия)', async () => {
    demo('on'); const f = openForm(); fill(f);
    await submit(f); q('[data-ai="deny"]').click(); await flush();
    expect(q('#f-ai').textContent).toBe('Перевірку ШІ не виконано: немає дозволу на обробку даних ШІ');
  });
});
