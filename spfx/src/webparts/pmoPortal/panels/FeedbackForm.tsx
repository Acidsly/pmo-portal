import * as React from 'react';
import { AppCtx } from '../components/ctx';
import { Frow, Err } from '../components/fields';
import { shrinkImage } from '../logic/image';

const MAX_SHOTS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
interface Shot { blob: Blob; url: string; name: string; }

/** Отзыв фокус-группы: текст, экран (адрес, с которого открыли), устройство и до 5 скриншотов — в список «Відгуки». */
export const FeedbackForm: React.FC<{ screen: string; onCancel(): void }> = ({ screen, onCancel }) => {
  const c = React.useContext(AppCtx); const { t } = c;
  const [text, setText] = React.useState('');
  const [shots, setShots] = React.useState<Shot[]>([]);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => () => shots.forEach(s => URL.revokeObjectURL(s.url)), []);

  const add = async (files: File[]): Promise<void> => {
    const imgs = files.filter(f => /^image\//.test(f.type));
    if (!imgs.length) return;
    setErr('');
    const room = MAX_SHOTS - shots.length;
    if (imgs.length > room) setErr(t('fbMax'));
    const out: Shot[] = [];
    for (const f of imgs.slice(0, Math.max(0, room))) {
      const blob = await shrinkImage(f);
      if (blob.size > MAX_BYTES) { setErr(t('fbBig')); continue; }
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : 'jpg';
      out.push({ blob, url: URL.createObjectURL(blob), name: `screen-${Date.now()}-${out.length + shots.length + 1}.${ext}` });
    }
    setShots(s => s.concat(out));
  };
  // на компьютере — вставка снимка экрана из буфера (Ctrl/Cmd+V)
  const paste = (e: React.ClipboardEvent): void => {
    const files = Array.prototype.slice.call(e.clipboardData.files || []) as File[];
    if (files.some(f => /^image\//.test(f.type))) { e.preventDefault(); add(files).catch(() => undefined); }
  };
  const remove = (i: number): void => setShots(s => { URL.revokeObjectURL(s[i].url); return s.filter((_, j) => j !== i); });

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!text.trim()) { setErr(t('fbErrText')); return; }
    setBusy(true); setErr('');
    try {
      const device = `${window.innerWidth}×${window.innerHeight} · ${navigator.userAgent}`.slice(0, 255);
      const id = await c.repo.create('Feedback', { Title: text.trim().slice(0, 120), fbText: text.trim(), fbScreen: screen.slice(0, 255), fbDevice: device });
      for (const s of shots) await c.repo.attach('Feedback', id, s.name, s.blob);
      c.toast(t('fbSent')); onCancel();
    } catch (x) { setErr(String((x as Error).message || x)); setBusy(false); }
  };

  return <>
    <div className="ph"><div><div className="k">{t('listLabel')} «{t('fbList')}»</div><h2>{t('fbTitle')}</h2></div>
      <button className="x" aria-label={t('close')} onClick={onCancel}>×</button></div>
    <form onSubmit={save} onPaste={paste} noValidate={true}>
      <p className="note">{t('fbHint')}</p>
      <Frow label={t('fbText')} htmlFor="fb-t" req={true}><textarea id="fb-t" style={{ minHeight: 120 }} value={text} onChange={e => setText(e.target.value)} /></Frow>
      <div className="frow"><span className="lbl-t">{t('fbShots')} ({shots.length}/{MAX_SHOTS})</span>
        {shots.length ? <div className="fb-shots">{shots.map((s, i) => <figure key={s.url}><img src={s.url} alt="" />
          <button type="button" className="x x-sm" aria-label={t('fbRemove')} onClick={() => remove(i)}>×</button></figure>)}</div> : null}
        {shots.length < MAX_SHOTS ? <button type="button" className="btn" onClick={() => fileRef.current && fileRef.current.click()}>{t('fbAdd')}</button> : null}
        <input ref={fileRef} type="file" accept="image/*" multiple={true} hidden={true}
          onChange={e => { const f = Array.prototype.slice.call(e.target.files || []) as File[]; e.target.value = ''; add(f).catch(() => undefined); }} />
        <p className="note fb-paste">{t('fbPaste')}</p></div>
      <p className="note">{t('fbScreen')}: <code>{screen || '#home'}</code></p>
      <Err msg={err} />
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy}>{busy ? t('fbSending') : t('fbSend')}</button>
        <button type="button" className="btn" onClick={onCancel}>{t('cancel')}</button>
      </div>
    </form>
  </>;
};
