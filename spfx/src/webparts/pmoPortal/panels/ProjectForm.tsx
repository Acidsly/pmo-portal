import * as React from 'react';
import { EntTag } from '../components/EntTag';
import { isArch } from '../logic/status';
import { createWithCode } from '../logic/ui';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Project, Person } from '../data/types';
import { ProjectDraft, validateProject, nextCode, cardDiff } from '../logic/forms';
import { projectBody, projectEditBody, teamBody, teamRows } from '../data/write';
import { TeamRow, cleanTeam, cleanLinks, teamPlan } from '../logic/team';
import { Frow, SegPick, DateIn, Err, PeoplePicker, Opts, errText, guardText, MoneyIn } from '../components/fields';
import { guard, cardFields, changedFields } from '../logic/guard';

const TYPES = ['Стратегічний', 'Звичайний'];
const PRIOS = ['1 — Високий', '2 — Середній', '3 — Низький'];
const DEPTS = ['ІТ', 'HR та кадрове адміністрування', 'Розрахунок зарплати', 'Продажі', 'Фінанси', 'Операції', 'Юридичний'];
const STATUSES = ['Ініціація', 'Планування', 'Реалізація', 'Призупинено'];

/** Новый проект или правка карточки (projectForm прототипа, строки 1353–1418). Тип, даты и статус правятся только статус-отчётом. */
export const ProjectForm: React.FC<{ data: PortalData; project?: Project; onCancel(): void }> = ({ data, project, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const isNew = !project;
  const [d, setD] = React.useState<ProjectDraft>(() => project
    ? { title: project.title, code: project.code, department: project.department, links: project.links, type: project.type, priority: project.priority,
        manager: project.manager, owner: project.owner, team: project.team.length ? teamRows(project.team) : [{ user: null, role: '', topics: '' }], start: project.start, goLive: project.goLive,
        planEnd: project.planEnd, status: project.status, budget: project.budget, description: project.description }
    : { title: '', code: '', department: 'ІТ', links: [], type: 'Звичайний', priority: '2 — Середній', manager: null, owner: null, team: [{ user: null, role: '', topics: '' }],
        start: c.today, goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: '' });
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // PM нового проекта не подставляется: проект заводит PMO и назначает PM сам (иначе PMO случайно становится PM)
  const set = (x: Partial<ProjectDraft>): void => setD({ ...d, ...x });
  const setRow = (i: number, x: Partial<TeamRow>): void => set({ team: d.team.map((r, j) => (j === i ? { ...r, ...x } : r)) });
  const setLink = (i: number, x: Partial<ProjectDraft['links'][0]>): void => set({ links: d.links.map((l, j) => (j === i ? { ...l, ...x } : l)) });
  const search = (q: string): Promise<Person[]> => c.repo.searchPeople(q);
  const withIds = async (x: ProjectDraft): Promise<ProjectDraft> => {
    const fix = async (p: Person | null): Promise<Person | null> => (p && !p.id ? { ...p, id: await c.repo.ensureUser(p.email) } : p);
    return { ...x, manager: await fix(x.manager), owner: await fix(x.owner), team: await Promise.all(x.team.map(async r => ({ ...r, user: await fix(r.user) }))) };
  };

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const othersP = data.projects.filter(x => !project || x.id !== project.id);
    const others = othersP.map(x => x.code);
    const clean = { ...d, team: cleanTeam(d.team), links: cleanLinks(d.links) };
    const v = validateProject(clean, others, othersP.map(x => x.title), project ? project.title : '', !project);   // даты — только у нового проекта (#54)
    if (v) { setErr(t(v)); return; }
    setBusy(true); setErr('');
    try {
      const x = await withIds(clean);
      // новый проект: папок ещё нет — команду записывает PMO в корень (синхронизация перенесёт); существующий — сразу в папку проекта
      const writeTeam = async (projectId: number, before: Project['team'], root: boolean): Promise<void> => {
        const plan = teamPlan(before, x.team);
        for (const r of plan.create) {
          if (root) await c.repo.create('ProjectTeam', teamBody(projectId, r));
          else await c.repo.createIn('ProjectTeam', projectId, teamBody(projectId, r), { tmUserId: r.user ? r.user.email : '' });
        }
        for (const r of plan.update) await c.repo.update('ProjectTeam', r.id!, teamBody(projectId, r));
        for (const id of plan.remove) await c.repo.recycle('ProjectTeam', id);
      };
      if (isNew) {
        // номер — только автоматически: следующий PRJ-###; если его успел занять другой PMO (уникальность списка) — следующий
        const id = await createWithCode(data.projects.map(p => p.code), nextCode, code => c.repo.create('Projects', projectBody(x, code)));
        await writeTeam(id, [], true);
        await c.reload(); c.toast(t('savedProject')); c.openProject(id);
      } else {
        const diff = cardDiff(project!, x);
        const plan = teamPlan(project!.team, x.team);
        const teamChanged = plan.create.length + plan.update.length + plan.remove.length > 0;
        if (!diff.length && !teamChanged && x.description === project!.description) { onCancel(); return; }
        // свежая проверка: PM не сменился, проект не в архиве, никто не изменил карточку с момента загрузки
        const f = await c.repo.fresh(project!.id);
        const g = guard('editCard', c.me, f);
        if (!g.ok) { setErr(guardText(t, g.key, g.args)); setBusy(false); await c.reload(); return; }
        if (changedFields(cardFields(project!), cardFields(f.project)).length) { setErr(t('errConflict')); setBusy(false); await c.reload(); return; }
        // журнал правок — к свежему (синхронизация могла уже перенести часть записей), версия записи — свежая
        await c.repo.update('Projects', project!.id, projectEditBody(x, diff, c.me, '', f.project.editLog || ''), f.etag);
        await writeTeam(project!.id, project!.team, false);
        await c.reload(); c.toast(t('savedEdit')); c.openProject(project!.id);
      }
    } catch (x) {
      const m = String((x as Error).message || x);
      // запрет дублей кода на уровне списка SharePoint (проекты, которых пользователь не видит)
      setErr(/unique|унікальн|уникальн|duplicate|already exists/i.test(m) ? t('errCode') : errText(t, x)); setBusy(false);
    }
  };

  // правка по прямой ссылке (#…/edit): форма сама проверяет права и архив, а не только скрытая кнопка
  if (!isNew && project && (!project.canEdit || isArch(project.status))) return <><div className="ph"><div><h2>{project.title}</h2></div>
    <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note lock">🔒 {isArch(project.status) ? t('archivedNote') : t('noEdit')}</p></>;
  if (isNew && !data.canCreate) return <><div className="ph"><div><h2>{t('newProject')}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note lock">🔒 {t('noCreate')}</p></>;
  return <>
    <div className="ph"><div><div className="k"><EntTag kind="project" /><span>{isNew ? `${t('listLabel')} «${t('navProjects')}»` : `${project!.code} · ${t('listLabel')} «${t('navProjects')}»`}</span></div>
      <h2>{isNew ? t('newProject') : project!.title}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <form onSubmit={save} noValidate={true}>
      <h3 className="fsec">{t('fGeneral')}</h3>
      <Frow label={fl('title')} htmlFor="f-title" req={true}><input type="text" id="f-title" value={d.title} onChange={e => set({ title: e.target.value })} /></Frow>
      <div className="fgrid2 frow">
        <div><label className="t" htmlFor="f-code">{fl('code')}</label>
          <input type="text" id="f-code" value={d.code} placeholder={t('codeAuto')} readOnly={true} disabled={true} /></div>
        <div><label className="t" htmlFor="f-dept">{fl('dept')}</label>
          <select id="f-dept" value={d.department} onChange={e => set({ department: e.target.value })}><Opts values={DEPTS} /></select></div>
      </div>
      {isNew ? <fieldset className="ragpick"><legend>{fl('type')}</legend><SegPick name="f-type" options={TYPES} value={d.type} onChange={v => set({ type: v })} /></fieldset> : null}

      <h3 className="fsec">{t('fPeople')}</h3>
      {/* #43: после создания PM и власника меняет только PMO («Змінити PM / власника» в карточке) */}
      <Frow label={fl('pm')} htmlFor="f-pm" req={isNew}>{isNew ? <PeoplePicker id="f-pm" multi={false} value={d.manager ? [d.manager] : []} search={search}
        onChange={v => set({ manager: v[0] || null })} /> : <div className="fixedval" id="f-pm">{d.manager ? d.manager.name : '—'}</div>}</Frow>
      <Frow label={fl('owner')} htmlFor="f-own">{isNew ? <PeoplePicker id="f-own" multi={false} value={d.owner ? [d.owner] : []} search={search}
        onChange={v => set({ owner: v[0] || null })} /> : <div className="fixedval" id="f-own">{d.owner ? d.owner.name : '—'}</div>}</Frow>
      {isNew ? null : <p className="hint" style={{ marginTop: -6 }}>{t('pmOnlyPmo')}</p>}
      <div className="frow"><span className="t lbl-t">{fl('team')}</span>
        <div className="ed-rows">{d.team.map((r, i) => <div className="ed-row tm-row" key={r.id || 'n' + i}>
          <PeoplePicker id={`f-tm${i}`} multi={false} value={r.user ? [r.user] : []} search={search} onChange={v => setRow(i, { user: v[0] || null })} />
          <input type="text" aria-label={fl('tmRole')} placeholder={`${fl('tmRole')} *`} value={r.role} onChange={e => setRow(i, { role: e.target.value })} />
          <input type="text" aria-label={fl('tmTopics')} placeholder={fl('tmTopics')} value={r.topics} onChange={e => setRow(i, { topics: e.target.value })} />
          <button type="button" className="btn rm" aria-label={t('rmRow')} title={t('rmRow')} onClick={() => set({ team: d.team.filter((_, j) => j !== i) })}>×</button></div>)}</div>
        <button type="button" className="btn add" onClick={() => set({ team: [...d.team, { user: null, role: '', topics: '' }] })}>{t('addMember')}</button></div>
      <div className="frow"><span className="t lbl-t">{fl('links')}</span>
        <div className="ed-rows">{d.links.map((l, i) => <div className="ed-row ln-row" key={'l' + i}>
          <input type="text" aria-label={fl('linkTitle')} placeholder={fl('linkTitle')} value={l.t} onChange={e => setLink(i, { t: e.target.value })} />
          <input type="text" inputMode="url" aria-label={fl('linkUrl')} placeholder="https://" value={l.u} onChange={e => setLink(i, { u: e.target.value })} />
          <button type="button" className="btn rm" aria-label={t('rmRow')} title={t('rmRow')} onClick={() => set({ links: d.links.filter((_, j) => j !== i) })}>×</button></div>)}</div>
        <button type="button" className="btn add" onClick={() => set({ links: [...d.links, { t: '', u: '' }] })}>{t('addLink')}</button></div>
      {!isNew ? <p className="note">{t('accessRecalc')}</p> : null}

      {isNew ? <>
        <h3 className="fsec">{t('fDates')}</h3>
        <div className="fgrid2 frow">
          <div><label className="t" htmlFor="f-start">{fl('start')}</label><DateIn id="f-start" value={d.start} onChange={v => set({ start: v })} /></div>
          <div><label className="t" htmlFor="f-golive">{fl('golive')}</label><DateIn id="f-golive" value={d.goLive} onChange={v => set({ goLive: v })} /></div>
          <div><label className="t" htmlFor="f-plan">{fl('plan')}</label><DateIn id="f-plan" value={d.planEnd} onChange={v => set({ planEnd: v })} /></div>
          <div><label className="t" htmlFor="f-status">{fl('status')}</label>
            <select id="f-status" value={d.status} onChange={e => set({ status: e.target.value })}><Opts values={STATUSES} /></select></div>
        </div></> : null}

      <h3 className="fsec">{t('secMoney')}</h3>
      <div className="fgrid2 frow">
        <div><label className="t" htmlFor="f-prio">{fl('prio')}</label>
          <select id="f-prio" value={d.priority} onChange={e => set({ priority: e.target.value })}><Opts values={PRIOS} /></select></div>
        <div><label className="t" htmlFor="f-bud">{fl('budget')}, $</label>
          <MoneyIn id="f-bud" value={d.budget} onChange={v => set({ budget: v })} /></div>
      </div>
      <Frow label={fl('desc')} htmlFor="f-desc"><textarea id="f-desc" value={d.description} onChange={e => set({ description: e.target.value })} /></Frow>
      <Err msg={err} />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy}>{t('save')}</button>
        <button type="button" className="btn" onClick={onCancel}>{t('cancel')}</button>
      </div>
    </form>
  </>;
};
