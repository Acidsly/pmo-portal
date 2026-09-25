import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { PortalData } from '../data/SpRepo';
import { Project, Person } from '../data/types';
import { ProjectDraft, validateProject, nextCode, cardDiff } from '../logic/forms';
import { projectBody, projectEditBody } from '../data/write';
import { Frow, SegPick, DateIn, Err, PeoplePicker } from '../components/fields';

const TYPES = ['Стратегічний', 'Звичайний'];
const PRIOS = ['1 — Високий', '2 — Середній', '3 — Низький'];
const DEPTS = ['ІТ', 'HR та кадрове адміністрування', 'Розрахунок зарплати', 'Продажі', 'Фінанси', 'Операції', 'Юридичний'];
const STATUSES = ['Ініціація', 'Планування', 'Реалізація', 'Призупинено', 'Скасовано'];

/** Новый проект или правка карточки (projectForm прототипа, строки 1353–1418). Тип, даты и статус правятся только статус-отчётом. */
export const ProjectForm: React.FC<{ data: PortalData; project?: Project; onCancel(): void }> = ({ data, project, onCancel }) => {
  const c = React.useContext(AppCtx); const { t, fl } = c;
  const isNew = !project;
  const [d, setD] = React.useState<ProjectDraft>(() => project
    ? { title: project.title, code: project.code, department: project.department, loop: project.loop, type: project.type, priority: project.priority,
        manager: project.manager, owner: project.owner, stakeholders: project.stakeholders, start: project.start, goLive: project.goLive,
        planEnd: project.planEnd, status: project.status, budget: project.budget, description: project.description }
    : { title: '', code: '', department: 'ІТ', loop: '', type: 'Звичайний', priority: '2 — Середній', manager: null, owner: null, stakeholders: [],
        start: c.today, goLive: '', planEnd: '', status: 'Ініціація', budget: 0, description: '' });
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // PM нового проекта по умолчанию — текущий пользователь (как в прототипе)
  React.useEffect(() => { if (isNew && !d.manager) c.repo.searchPeople(c.me).then(r => { const x = r.filter(y => y.email.toLowerCase() === c.me.toLowerCase())[0] || r[0]; if (x) setD(v => ({ ...v, manager: v.manager || x })); }, () => undefined); }, []);
  const set = (x: Partial<ProjectDraft>): void => setD({ ...d, ...x });
  const search = (q: string): Promise<Person[]> => c.repo.searchPeople(q);
  const withIds = async (x: ProjectDraft): Promise<ProjectDraft> => {
    const fix = async (p: Person | null): Promise<Person | null> => (p && !p.id ? { ...p, id: await c.repo.ensureUser(p.email) } : p);
    return { ...x, manager: await fix(x.manager), owner: await fix(x.owner), stakeholders: await Promise.all(x.stakeholders.map(s => fix(s) as Promise<Person>)) };
  };

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const v = validateProject(d);
    if (v) { setErr(t(v)); return; }
    setBusy(true); setErr('');
    try {
      const x = await withIds(d);
      if (isNew) {
        const code = d.code.trim() || nextCode(data.projects.map(p => p.code));
        const id = await c.repo.create('Projects', projectBody(x, code));
        await c.reload(); c.toast(t('savedProject')); c.openProject(id);
      } else {
        const diff = cardDiff(project!, x);
        if (!diff.length && x.description === project!.description) { onCancel(); return; }
        await c.repo.update('Projects', project!.id, projectEditBody(x, diff, c.me, '', project!.editLog || ''));
        await c.reload(); c.toast(t('savedEdit')); c.openProject(project!.id);
      }
    } catch (x) { setErr(String((x as Error).message || x)); setBusy(false); }
  };

  if (isNew && !data.canCreate) return <><div className="ph"><div><h2>{t('newProject')}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <p className="note lock">🔒 {t('noCreate')}</p></>;
  return <>
    <div className="ph"><div><div className="k">{isNew ? `${t('listLabel')} «${t('navProjects')}»` : `${project!.code} · ${t('listLabel')} «${t('navProjects')}»`}</div>
      <h2>{isNew ? t('newProject') : project!.title}</h2></div><button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <form onSubmit={save} noValidate={true}>
      <h3 className="fsec">{t('fGeneral')}</h3>
      <Frow label={fl('title')} htmlFor="f-title" req={true}><input type="text" id="f-title" value={d.title} onChange={e => set({ title: e.target.value })} /></Frow>
      <div className="fgrid2 frow">
        <div><label className="t" htmlFor="f-code">{fl('code')}</label>
          <input type="text" id="f-code" value={d.code} placeholder={isNew ? t('codeAuto') : ''} onChange={e => set({ code: e.target.value })} /></div>
        <div><label className="t" htmlFor="f-dept">{fl('dept')}</label>
          <select id="f-dept" value={d.department} onChange={e => set({ department: e.target.value })}>{DEPTS.map(x => <option key={x}>{x}</option>)}</select></div>
      </div>
      <Frow label={fl('loop')} htmlFor="f-loop"><input type="url" id="f-loop" value={d.loop} placeholder="https://" onChange={e => set({ loop: e.target.value })} /></Frow>
      {isNew ? <fieldset className="ragpick"><legend>{fl('type')}</legend><SegPick name="f-type" options={TYPES} value={d.type} onChange={v => set({ type: v })} /></fieldset> : null}

      <h3 className="fsec">{t('fPeople')}</h3>
      {!isNew ? <p className="note">{t('accessRecalc')}</p> : null}
      <Frow label={fl('pm')} htmlFor="f-pm" req={true}><PeoplePicker id="f-pm" multi={false} value={d.manager ? [d.manager] : []} search={search}
        onChange={v => set({ manager: v[0] || null })} /></Frow>
      <Frow label={fl('owner')} htmlFor="f-own"><PeoplePicker id="f-own" multi={false} value={d.owner ? [d.owner] : []} search={search}
        onChange={v => set({ owner: v[0] || null })} /></Frow>
      <Frow label={fl('stakeholders')} htmlFor="f-st"><PeoplePicker id="f-st" multi={true} value={d.stakeholders} search={search}
        onChange={v => set({ stakeholders: v })} /></Frow>

      {isNew ? <>
        <h3 className="fsec">{t('fDates')}</h3>
        <div className="fgrid2 frow">
          <div><label className="t" htmlFor="f-start">{fl('start')}</label><DateIn id="f-start" value={d.start} onChange={v => set({ start: v })} /></div>
          <div><label className="t" htmlFor="f-golive">{fl('golive')}</label><DateIn id="f-golive" value={d.goLive} onChange={v => set({ goLive: v })} /></div>
          <div><label className="t" htmlFor="f-plan">{fl('plan')}</label><DateIn id="f-plan" value={d.planEnd} onChange={v => set({ planEnd: v })} /></div>
          <div><label className="t" htmlFor="f-status">{fl('status')}</label>
            <select id="f-status" value={d.status} onChange={e => set({ status: e.target.value })}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select></div>
        </div></> : null}

      <h3 className="fsec">{t('secMoney')}</h3>
      <div className="fgrid2 frow">
        <div><label className="t" htmlFor="f-prio">{fl('prio')}</label>
          <select id="f-prio" value={d.priority} onChange={e => set({ priority: e.target.value })}>{PRIOS.map(x => <option key={x}>{x}</option>)}</select></div>
        <div><label className="t" htmlFor="f-bud">{fl('budget')}, ₴</label>
          <input type="number" id="f-bud" min={0} step={10000} value={d.budget} onChange={e => set({ budget: Number(e.target.value) || 0 })} /></div>
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
