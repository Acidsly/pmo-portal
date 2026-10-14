import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { Lucide } from '../components/LucideIcons';
import { PortalData } from '../data/SpRepo';
import { Project, ChangeEntry } from '../data/types';
import { ReportDraft } from '../logic/forms';
import { reportPrint, aiButton, acceptReply, unavailableNote, aiLangOf, AiUnavailable, AiButton } from '../logic/aiCheck';
import { buildReportContext } from '../logic/aiContext';
import { buildCheckContext, ruleItems, checkItems } from '../logic/aiRules';
import { parseDraft, parseCheck, checkText, AiDraft } from '../logic/aiReply';
import { aiMessage, AiKind } from '../logic/aiEval';
import { aiUnavailable, aiSaveFields, nextPrevCheck, draftInsert, undoAvailable, AiResult, riskRefs, mentionLine, appendLine } from '../logic/aiFlow';
import { riskScore } from '../logic/status';
import { fmtDate } from '../components/Bits';
import { Risk } from '../data/types';
import { aiRun } from '../ai/aiRun';
import { tv } from '../i18n/values';
import { Rag } from '../logic/rag';

/** Помощник ИИ в форме статус-отчёта (план этапа 4, задача 4). Состояние сценария — в logic/aiFlow и logic/aiCheck,
 *  здесь — вызовы и разметка. Модуль агента (MSAL, SDK Copilot Studio) — отдельным файлом, грузится только у пилота. */
type Agent = typeof import('../ai/aiAgent');
const loadAgent = (): Promise<Agent> => import(/* webpackChunkName: 'pmo-ai' */ '../ai/aiAgent');

const TEXT_LABEL: Record<string, string> = { title: 'rTitle', done: 'rDone', next: 'rNext', issues: 'rIssues' };
const RATE: { k: 'schedule' | 'budget' | 'resources'; fl: string }[] = [{ k: 'schedule', fl: 'rSched' }, { k: 'budget', fl: 'rBudget' }, { k: 'resources', fl: 'rRes' }];
type Msg = { at: 'top' | 'bottom'; kind: 'ok' | 'warn' | 'err'; text: string } | null;

export interface ReportAi {
  pilot: boolean;
  /** Нижняя кнопка: «Зберегти», «Перевірити з ШІ», «ШІ аналізує…», «Зберегти без перевірки». */
  button: AiButton;
  /** Верх формы: «Заповнити з ШІ», панель помощника, вопросы о замене. */
  top: React.ReactNode;
  /** Низ формы: поле «Суперечності (аналіз ШІ)» и сообщение проверки. */
  bottom: React.ReactNode;
  check(): void;
  /** Поля ИИ для записи отчёта (вне пилота — пусто), время проверки — по поясу сайта. */
  saveFields(): Promise<Record<string, unknown>>;
  /** Сброс (свежие данные при сохранении не прошли guard): нужна новая проверка. */
  reset(): void;
}

export function useReportAi(a: { data: PortalData; project: Project; d: ReportDraft; setD(d: ReportDraft): void; blocked: boolean }): ReportAi {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  // пилотная группа и переключатель «Помічник ШІ» включён (согласие дано при включении — components/Header, ai/useAiSwitch)
  const pilot = !!c.ai;
  const lang = aiLangOf(c.lang);
  const dRef = React.useRef(a.d); dRef.current = a.d;
  const print = reportPrint(a.d);
  const [busy, setBusy] = React.useState<AiKind | null>(null);
  const [checked, setChecked] = React.useState<{ print: string; items: string[]; at: string } | null>(null);
  const [unav, setUnav] = React.useState<{ print: string; reason: AiUnavailable } | null>(null);
  const [prevCheck, setPrevCheck] = React.useState('');
  const [assist, setAssist] = React.useState<AiDraft | null>(null);
  const [assistOpen, setAssistOpen] = React.useState(true);
  const [asks, setAsks] = React.useState<{ field: string; value: string }[]>([]);
  const [ins, setIns] = React.useState<{ after: string; before: Record<string, string> } | null>(null);
  const [filled, setFilled] = React.useState(false);
  const [msg, setMsg] = React.useState<Msg>(null);
  const req = React.useRef(0);
  const agent = React.useRef<Agent | null>(null);

  // модуль агента — заранее: окно входа Microsoft открывается только сразу после нажатия (без долгих await до него)
  React.useEffect(() => { if (pilot) loadAgent().then(m => { agent.current = m; }).catch(() => undefined); }, [pilot]);

  const reset = (): void => {
    req.current++; setBusy(null); setChecked(null); setUnav(null); setPrevCheck(''); setAssist(null); setAsks([]); setIns(null);
    setFilled(false); setMsg(null);
  };
  // смена проекта в форме — всё, что относилось к ИИ, сбрасывается
  const pid = a.d.projectId;
  const firstPid = React.useRef(pid);
  React.useEffect(() => { if (pid !== firstPid.current) { firstPid.current = pid; reset(); } }, [pid]);

  const run = async (kind: AiKind): Promise<void> => {
    // снимок формы — один на весь запрос: пункты кода, контекст и отпечаток — по одной и той же форме
    const id = ++req.current; const draft0 = dRef.current; const reqPrint = reportPrint(draft0);
    const at = kind === 'draft' ? 'top' : 'bottom';
    setBusy(kind); setMsg(null);
    const fail = (reason: AiUnavailable, detail?: string): void => {
      if (id !== req.current) return;
      setBusy(null);
      if (kind === 'check') setUnav({ print: reqPrint, reason });
      const head = unavailableNote(reason, lang);
      setMsg({ at, kind: 'err', text: (detail ? head.replace(/:.*$/, ': ' + detail) : head) + (kind === 'check' ? ' ' + t('aiUnavailHint') : '') });
    };
    let m: Agent;
    try { m = agent.current || (await loadAgent()); } catch { fail('error'); return; }
    let token: string;
    try { token = await m.aiToken(c.me, () => undefined); }
    catch (e) { fail('error', /popup|interaction|blocked/i.test(String((e as Error).message || e)) ? t('aiPopup') : undefined); return; }
    // журнал — только для черновика («Зроблено за період»); проверке он мешает: ИИ принимает прежние изменения за правки этой формы
    const changes: ChangeEntry[] = kind === 'draft' ? await c.repo.loadChanges(a.project.id).catch(() => [] as ChangeEntry[]) : [];
    if (id !== req.current) return;
    const input = { project: a.project, reports: a.data.reports, risks: a.data.risks, changes, draft: draft0,
      prevCheck: kind === 'check' && prevCheck ? prevCheck : undefined, lang, today: c.today };
    // проверка гибридная: сравнения чисел и дат — кодом (ruleItems), ИИ — только смысловые правила (план помощника, этап 4)
    const ctx = kind === 'check' ? buildCheckContext(input) : buildReportContext(input);
    const rules = kind === 'check' ? ruleItems(input) : [];
    if (ctx.tooLarge) { fail('tooLarge'); return; }
    const parse = kind === 'draft'
      ? (raw: string): AiDraft | null => { const r = parseDraft(raw); return r.ok ? r : null; }
      : (raw: string): string[] | null => { const r = parseCheck(raw); return r.ok ? r.items : null; };
    const agentMod = m;
    const r = await aiRun<AiDraft | string[]>(() => agentMod.AiSession.open(token), aiMessage(kind, ctx.json), parse,
      // карточка согласия Copilot Studio — подтверждается сама: PM дал согласие при включении «Помічник ШІ»
      () => Promise.resolve(true));
    if (id !== req.current) return;
    if (!r.ok) { fail(r.reason); return; }
    setBusy(null);
    // форма изменилась, пока ИИ работал, — ответ не применяется
    if (!acceptReply(reqPrint, reportPrint(dRef.current))) { setMsg({ at, kind: 'warn', text: t('aiStale') }); return; }
    setUnav(null);
    if (kind === 'check') {
      const aiItems = r.value as string[], items = checkItems(rules, aiItems);
      setChecked({ print: reqPrint, items, at: new Date().toISOString() });
      // прежние пункты — только ИИ: пункты кода считаются заново и в prompt не нужны
      setPrevCheck(aiItems.length ? nextPrevCheck({ kind: 'checked', items: aiItems, at: '' }, lang) : '');
      setMsg(items.length ? { at, kind: 'warn', text: t('aiFound').replace('{n}', String(items.length)) } : { at, kind: 'ok', text: t('aiNone') });
      return;
    }
    const dr = r.value as AiDraft; const cur = dRef.current;
    const plan = draftInsert({ title: cur.title, done: cur.done, next: cur.next, issues: cur.issues },
      { summary: dr.summary, done: dr.done, next: dr.next, issues: dr.issues });
    const nd = { ...cur, ...plan.now };
    a.setD(nd); setIns({ after: reportPrint(nd), before: plan.before }); setAsks(plan.ask); setAssist(dr); setAssistOpen(true); setFilled(true);
    setMsg({ at, kind: 'ok', text: t('aiDraftDone') });
  };
  const cancel = (): void => { req.current++; setBusy(null); };

  const answerAsk = (replace: boolean): void => {
    const [q, ...rest] = asks;
    if (q && replace) { const nd = { ...dRef.current, [q.field]: q.value }; a.setD(nd); setIns(x => (x ? { ...x, after: reportPrint(nd) } : x)); }
    setAsks(rest);
  };
  const canUndo = !!ins && !asks.length && undoAvailable(ins.after, print);
  const undo = (): void => { if (ins) { a.setD({ ...dRef.current, ...ins.before }); setIns(null); } };

  const button = aiButton({ pilot, checkedPrint: checked ? checked.print : null, currentPrint: print, busy: busy !== null,
    unavailable: aiUnavailable(unav ? unav.print : null, print) });
  const result = (): AiResult | null => {
    if (checked && checked.print === print) return { kind: 'checked', items: checked.items, at: checked.at };
    if (unav && unav.print === print) return { kind: 'without', reason: unav.reason };
    return null;
  };
  const saveFields = async (): Promise<Record<string, unknown>> => {
    const f = aiSaveFields({ pilot, result: result(), filled, lang });
    if (typeof f.srAiCheckedAt === 'string') {
      try { f.srAiCheckedAt = await c.repo.siteLocalTime(f.srAiCheckedAt); } catch { delete f.srAiCheckedAt; }
    }
    return f;
  };
  const msgEl = (where: 'top' | 'bottom'): React.ReactNode => (msg && msg.at === where ? <p className={'ai-msg ' + msg.kind} role="status">{msg.text}</p> : null);

  const top = !pilot ? null : <>
    <div className="ai-bar">
      <button type="button" className="btn ai" id="ai-fill" disabled={busy !== null || a.blocked} onClick={() => { run('draft').catch(() => undefined); }}>
        <Lucide k="ai" />{busy === 'draft' ? t('aiFillBusy') : t('aiFill')}</button>
      {busy !== null ? <button type="button" className="btn" onClick={cancel}>{t('cancel')}</button> : null}
      {canUndo ? <button type="button" className="btn" onClick={undo}>{t('aiUndo')}</button> : null}
    </div>
    {asks.length ? <div className="ai-panel" role="alertdialog"><p>{t('aiReplace').replace('{f}', fl(TEXT_LABEL[asks[0].field]))}</p>
      <div className="ai-rate"><button type="button" className="btn primary" onClick={() => answerAsk(true)}>{t('aiYes')}</button>
        <button type="button" className="btn" onClick={() => answerAsk(false)}>{t('aiNo')}</button></div></div> : null}
    {msgEl('top')}
    {/* подсказки ИИ — сворачиваются, чтобы форма не растягивалась (замечание с теста) */}
    {assist && (assist.remember.length || RATE.some(x => assist.ratings[x.k])) ? <details className="ai-panel" id="ai-assist" open={assistOpen}
      onToggle={e => setAssistOpen((e.target as HTMLDetailsElement).open)}>
      <summary>{t('aiAssist').replace('{n}', String(assist.remember.length))}</summary>
      {assist.remember.length ? <><h4 className="ai-label"><Lucide k="ai" />{t('aiRemember')}</h4><ul>{assist.remember.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
      {RATE.some(x => assist.ratings[x.k]) ? <><h4 className="ai-label"><Lucide k="ai" />{t('aiRatings')}</h4>
        {RATE.filter(x => assist.ratings[x.k]).map(x => <div className="ai-rate" key={x.k}>
          <span>{fl(x.fl)} — {t('aiSuggest').replace('{v}', tv(assist.ratings[x.k]))}</span>
          {a.d[x.k] !== assist.ratings[x.k] ? <button type="button" className="btn" onClick={() => a.setD({ ...dRef.current, [x.k]: assist.ratings[x.k] as Rag })}>{t('aiAccept')}</button> : null}
        </div>)}
        {assist.ratings.reason ? <p className="note">{assist.ratings.reason}</p> : null}</> : null}
    </details> : null}
  </>;

  // запись реестра, названная в пункте ИИ: карточка под пунктом и «Додати згадку» в «Проблеми та ризики за період»
  const projRisks = a.data.risks.filter(k => k.projectId === a.project.id);
  const [openRec, setOpenRec] = React.useState<string>('');
  const lineOf = (k: Risk): string | null => mentionLine(k, tv(k.type), { score: t('aiMentionScore'), due: t('aiMentionDue'), mit: t('aiMentionMit') }, fmtDate);
  const mention = (k: Risk): void => {
    const line = lineOf(k); if (!line) return;
    a.setD({ ...dRef.current, issues: appendLine(dRef.current.issues, line) });
    setMsg({ at: 'bottom', kind: 'ok', text: t('aiMentioned') });
    setTimeout(() => { const el = document.getElementById('f-iss') as HTMLTextAreaElement | null; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0);
  };
  const refEl = (k: Risk, key: string): React.ReactNode => <div className="ai-ref" key={key}>
    <button type="button" className="btn" aria-expanded={openRec === key} onClick={() => setOpenRec(openRec === key ? '' : key)}>
      {openRec === key ? t('aiHideRec') : t('aiShowRec').replace('{t}', k.title)}</button>
    {openRec === key ? <div className="ai-rec">
      <p><b>{tv(k.type)} «{k.title}»</b> · {fl('kScore')} {riskScore(k.probability, k.impact)} · {fl('kStatus')}: {tv(k.status)}{k.due ? ` · ${fl('kDue')}: ${fmtDate(k.due)}` : ''}</p>
      {k.strategy ? <p>{fl('kStrategy')}: {tv(k.strategy)}</p> : null}
      {k.mitigation ? <p>{fl('kMit')}: {k.mitigation}</p> : null}
      {lineOf(k) ? <button type="button" className="btn primary" onClick={() => mention(k)}>{t('aiMention')}</button> : <p className="hint">{t('aiNoMit')}</p>}
    </div> : null}
  </div>;
  const box = checked ? (checked.items.length
    ? checked.items.map((it, i) => <div className="ai-item" role="listitem" key={i}>{i + 1}. {it}{riskRefs(it, projRisks).map(k => refEl(k, i + ':' + k.id))}</div>)
    : <div className="ai-item">{checkText([], lang)}</div>) : unav ? <div className="ai-item">{unavailableNote(unav.reason, lang)}</div> : null;
  const bottom = !pilot ? null : <>
    {box ? <div className="frow ai-field"><span className="t ai-label"><Lucide k="ai" />{fl('rAi')}</span>
      <div className="ai-box" id="f-ai" role="list" aria-readonly="true">{box}</div>
      <p className="hint">{t('aiFieldHint')}</p></div> : null}
    {msgEl('bottom')}
  </>;

  return { pilot, button, top, bottom, check: () => { run('check').catch(() => undefined); }, saveFields, reset };
}
