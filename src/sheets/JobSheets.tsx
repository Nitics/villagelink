import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { CopyNumber, Field, SheetHeader } from '../components/ui';
import { DeleteButton } from './AdminSheets';
import { defaultTown } from './CommunitySheets';
import { JOB_KINDS, JOB_SAFETY, PAY_UNITS } from '../lib/constants';
import { ago, minsSince } from '../lib/hours';
import { parsePrice, phoneOk, rand, whatsappUrl } from '../lib/format';
import { jobIsOpen, todaySA } from '../lib/data';
import { actions, type JobInput } from '../lib/actions';
import type { Job, JobKind, PayUnit } from '../lib/types';

export const payText = (j: Pick<Job, 'pay' | 'payUnit'>) =>
  j.pay == null ? 'Pay to discuss' : `${rand(j.pay)}${j.payUnit ? ` ${PAY_UNITS[j.payUnit]}` : ''}`;

export const closesText = (j: Pick<Job, 'closesOn'>) =>
  j.closesOn ? `Closes ${new Date(j.closesOn + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}` : '';

/** Filled, hidden or past closing: shown on the job card and sheet. */
export function JobBadge({ j }: { j: Job }) {
  if (!j.isActive) return <span className="badge b-off">Hidden</span>;
  if (j.isFilled) return <span className="badge b-off">Filled</span>;
  if (!jobIsOpen(j)) return <span className="badge b-off">Closed</span>;
  return <span className="badge b-ver">{JOB_KINDS[j.kind].short}</span>;
}

/* ---------------- one job ---------------- */
export function JobSheet({ id }: { id: string }) {
  const { data, user, isStaff, now, openSheet, closeSheet, toast, refresh } = useApp();
  const j = data.jobs.find((x) => x.id === id);
  if (!j) return <><SheetHeader title="Not found" /><p>This job was removed.</p></>;
  const mine = user?.id === j.ownerId;
  const open = jobIsOpen(j, now);
  const wa = whatsappUrl(j.phone);
  const waText = encodeURIComponent(`Hi ${j.posterName}, I saw your VillageLink post “${j.title}”. Is it still available?`);

  return (
    <>
      <SheetHeader eyebrow={`${JOB_KINDS[j.kind].short}${j.town ? ` · ${j.town}` : ''}`} title={j.title} />
      <div className="row" style={{ flexWrap: 'wrap' }}><JobBadge j={j} /><span className="small muted">Posted {ago(minsSince(j.createdAt, now))}</span></div>
      <span className="price" style={{ fontSize: 22 }}>{payText(j)}</span>
      <div className="box">
        {j.workWhen && <div className="vrow"><Icon name="clock" /><span>{j.workWhen}</span></div>}
        {j.town && <div className="vrow"><Icon name="pin" /><span>{j.town}</span></div>}
        <div className="vrow"><Icon name="user" /><span>Posted by <b>{j.posterName}</b></span></div>
        {j.closesOn && <div className="vrow"><Icon name="check" /><span>{closesText(j)}</span></div>}
        {j.description && <div className="vrow"><Icon name="msg" /><span style={{ whiteSpace: 'pre-wrap' }}>{j.description}</span></div>}
      </div>

      {open ? (
        <>
          <span className="eyebrow">Interested? Contact the poster</span>
          <CopyNumber value={j.phone} />
          {wa && <a className="btn btn-mint" href={`${wa}?text=${waText}`} target="_blank" rel="noopener noreferrer"><Icon name="msg" />Message on WhatsApp</a>}
        </>
      ) : <p className="small muted" style={{ margin: 0 }}>{j.isFilled ? 'This position has been filled.' : 'This post is no longer taking applications.'}</p>}
      <p className="note">{JOB_SAFETY}</p>

      {(mine || isStaff) && (
        <div className="box">
          <span className="eyebrow">{mine ? 'Your post' : 'Manage this post'}</span>
          <div className="btnrow">
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              const r = await actions.setJobFilled(j.id, !j.isFilled);
              toast(r.ok ? (j.isFilled ? 'Marked open again' : 'Marked filled. Thanks for letting people know.') : r.error);
              if (r.ok) refresh();
            }}>{j.isFilled ? 'Mark open again' : 'Mark as filled'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => openSheet({ kind: 'editJob', id: j.id })}>Edit</button>
          </div>
          <DeleteButton label="Delete post" onDelete={async () => {
            const r = await actions.deleteJob(j.id);
            if (!r.ok) { toast(r.error); return; }
            closeSheet(); toast('Post deleted'); refresh();
          }} />
        </div>
      )}
    </>
  );
}

/* ---------------- post or edit a job ---------------- */
export function EditJobSheet({ id }: { id: string | null }) {
  const { data, town, towns, profile, isStaff, closeSheet, toast, refresh } = useApp();
  const navigate = useNavigate();
  const ex = id ? data.jobs.find((x) => x.id === id) : undefined;
  const [f, setF] = useState(() => ({
    kind: (ex?.kind ?? 'piece') as JobKind, title: ex?.title ?? '', description: ex?.description ?? '',
    pay: ex?.pay != null ? String(ex.pay) : '', payUnit: (ex?.payUnit || 'day') as PayUnit,
    town: ex?.town || defaultTown(town, towns), workWhen: ex?.workWhen ?? '', posterName: ex?.posterName ?? profile?.displayName ?? '',
    phone: ex?.phone ?? '', closesOn: ex?.closesOn ?? '', isActive: ex?.isActive ?? true,
  }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  if (id && !ex) return <><SheetHeader title="Not found" /><p>This job was removed.</p></>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const pay = f.pay.trim() ? parsePrice(f.pay) : null;
    if (!f.title.trim()) return setErr('Say what the work is, for example “Helper to clear a yard”.');
    if (pay !== null && !(pay >= 0)) return setErr('Enter the pay as a number in rand, or leave it empty to discuss.');
    if (!f.posterName.trim() || !phoneOk(f.phone)) return setErr('Add your name and a phone number with at least 9 digits so people can reach you.');
    if (f.closesOn && f.closesOn < todaySA()) return setErr('The closing date has already passed.');
    const input: JobInput = {
      kind: f.kind, title: f.title.trim(), description: f.description.trim(), pay, payUnit: pay == null ? '' : f.payUnit,
      town: f.town, workWhen: f.workWhen.trim(), posterName: f.posterName.trim(), phone: f.phone.trim(), closesOn: f.closesOn,
      ...(isStaff && id ? { isActive: f.isActive } : {}),
    };
    setErr(''); setBusy(true);
    const r = await actions.saveJob(id, input);
    setBusy(false);
    if (!r.ok) return setErr(/row-level|permission/i.test(r.error) ? 'You can post up to 10 jobs a day. Try again tomorrow.' : r.error);
    closeSheet(); toast(id ? 'Post saved' : 'Job posted'); await refresh();
    if (!id) navigate('/market?tab=jobs');
  };

  return (
    <>
      <SheetHeader title={id ? 'Edit job post' : 'Post a job or piece work'} />
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Type" id="jb_k"><select id="jb_k" value={f.kind} onChange={set('kind')}>
          {(Object.keys(JOB_KINDS) as JobKind[]).map((k) => <option key={k} value={k}>{JOB_KINDS[k].label}</option>)}</select></Field>
        <Field label="What is the work?" id="jb_t"><input id="jb_t" maxLength={80} value={f.title} onChange={set('title')} placeholder="e.g. Helper to clear a yard, Cashier at a spaza" /></Field>
        <div className="filters">
          <Field label="Pay (R), optional" id="jb_p"><input id="jb_p" inputMode="decimal" value={f.pay} onChange={set('pay')} placeholder="250" /></Field>
          <Field label="Per" id="jb_u"><select id="jb_u" value={f.payUnit} onChange={set('payUnit')}>
            {(Object.keys(PAY_UNITS) as PayUnit[]).map((u) => <option key={u} value={u}>{PAY_UNITS[u]}</option>)}</select></Field>
        </div>
        <div className="filters">
          <Field label="Town" id="jb_town"><select id="jb_town" value={f.town} onChange={set('town')}>{[...new Set([...towns, f.town].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="When" id="jb_w"><input id="jb_w" maxLength={60} value={f.workWhen} onChange={set('workWhen')} placeholder="e.g. Sat 08:00, or Start Monday" /></Field>
        </div>
        <Field label="Details (optional)" id="jb_d"><textarea id="jb_d" rows={3} maxLength={600} value={f.description} onChange={set('description')} placeholder="What the work involves, skills needed, whether you provide tools or lunch" /></Field>
        <div className="filters">
          <Field label="Your name" id="jb_n"><input id="jb_n" maxLength={60} value={f.posterName} onChange={set('posterName')} /></Field>
          <Field label="Phone or WhatsApp" id="jb_ph"><input id="jb_ph" inputMode="tel" maxLength={20} value={f.phone} onChange={set('phone')} placeholder="082 123 4567" /></Field>
        </div>
        <Field label="Stop showing after (optional)" id="jb_c"><input id="jb_c" type="date" min={todaySA()} value={f.closesOn} onChange={set('closesOn')} /></Field>
        {isStaff && id && (
          <label className="switch" htmlFor="jb_a"><span><b>Show in Jobs</b><br /><span className="small muted">Turn off to hide it without deleting</span></span>
            <input type="checkbox" id="jb_a" checked={f.isActive} onChange={(e) => setF((x) => ({ ...x, isActive: e.target.checked }))} /></label>
        )}
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit" disabled={busy}>{busy ? 'Saving…' : id ? 'Save post' : 'Post job'}</button>
        <span className="note">Your name and phone number are shown to everyone who opens VillageLink. You can post up to 10 jobs a day.</span>
      </form>
    </>
  );
}
