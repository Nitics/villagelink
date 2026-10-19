import { useEffect, useState, type FormEvent } from 'react';
import { useApp } from '../state/AppContext';
import { Field, SheetHeader } from '../components/ui';
import { LISTING_KINDS, SUBJECTS } from '../lib/constants';
import { parsePrice, phoneOk } from '../lib/format';
import { actions } from '../lib/actions';
import type { Account, ListingKind, Role } from '../lib/types';

export const ROLE_LABEL: Record<Role, string> = { customer: 'Customer', staff: 'Staff', admin: 'Super user' };
/** What to call someone: a customer who runs a business is a shop owner. */
export const personLabel = (a: Pick<Account, 'role' | 'businessIds'>) => (a.role === 'customer' && a.businessIds.length ? 'Shop owner' : ROLE_LABEL[a.role]);

/** Two taps to delete: the first arms the button, the second does it. */
export function DeleteButton({ label, onDelete, confirmLabel = 'Tap again to delete for good' }: { label: string; onDelete: () => Promise<void>; confirmLabel?: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn btn-danger" disabled={busy} onClick={async () => {
      if (!armed) { setArmed(true); return; }
      setBusy(true); await onDelete(); setBusy(false); setArmed(false);
    }}>{armed ? confirmLabel : label}</button>
  );
}

/* ---------------- edit a listing ---------------- */
export function EditListingSheet({ id }: { id: string }) {
  const { data, towns, closeSheet, toast, refresh } = useApp();
  const l = data.listings.find((x) => x.id === id);
  const [f, setF] = useState(() => ({
    kind: (l?.kind ?? 'goods') as ListingKind, title: l?.title ?? '', price: String(l?.price ?? ''), unit: l?.unit ?? '',
    town: l?.town ?? '', sellerName: l?.sellerName ?? '', phone: l?.phone ?? '', note: l?.note ?? '', isActive: l?.isActive ?? true,
  }));
  const [err, setErr] = useState('');
  if (!l) return <><SheetHeader title="Not found" /><p>This listing was removed.</p></>;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const price = parsePrice(f.price);
    if (!f.title.trim() || !(price >= 0) || !f.sellerName.trim() || !phoneOk(f.phone)) return setErr('Add a title, a price, a name and a phone number with at least 9 digits.');
    const r = await actions.updateListing(id, { ...f, title: f.title.trim(), price, unit: f.unit.trim(), sellerName: f.sellerName.trim(), phone: f.phone.trim(), note: f.note.trim() });
    if (!r.ok) return setErr(r.error);
    toast('Listing saved'); closeSheet(); refresh();
  };

  return (
    <>
      <SheetHeader title="Edit listing" />
      <form className="stack" onSubmit={save} noValidate>
        <Field label="Type" id="el_k"><select id="el_k" value={f.kind} onChange={set('kind')}>{(Object.keys(LISTING_KINDS) as ListingKind[]).map((k) => <option key={k} value={k}>{LISTING_KINDS[k].label}</option>)}</select></Field>
        <Field label="Title" id="el_t"><input id="el_t" maxLength={80} value={f.title} onChange={set('title')} /></Field>
        <div className="filters">
          <Field label="Price (R)" id="el_p"><input id="el_p" inputMode="decimal" value={f.price} onChange={set('price')} /></Field>
          <Field label="Per" id="el_u"><input id="el_u" maxLength={20} value={f.unit} onChange={set('unit')} /></Field>
        </div>
        <div className="filters">
          <Field label="Town" id="el_town"><select id="el_town" value={f.town} onChange={set('town')}>{[...new Set([...towns, f.town].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Seller" id="el_s"><input id="el_s" maxLength={60} value={f.sellerName} onChange={set('sellerName')} /></Field>
        </div>
        <Field label="Phone" id="el_ph"><input id="el_ph" inputMode="tel" maxLength={20} value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Details" id="el_n"><textarea id="el_n" rows={2} maxLength={300} value={f.note} onChange={set('note')} /></Field>
        <label className="switch" htmlFor="el_a"><span><b>Show in the market</b><br /><span className="small muted">Turn off to hide it without deleting</span></span>
          <input type="checkbox" id="el_a" checked={f.isActive} onChange={(e) => setF((x) => ({ ...x, isActive: e.target.checked }))} /></label>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit">Save listing</button>
      </form>
      <DeleteButton label="Delete listing" onDelete={async () => {
        const r = await actions.removeListing(id);
        if (!r.ok) { toast(r.error); return; }
        closeSheet(); toast('Listing deleted'); refresh();
      }} />
    </>
  );
}

/* ---------------- edit a study group ---------------- */
export function EditGroupSheet({ id }: { id: string }) {
  const { data, towns, closeSheet, toast, refresh } = useApp();
  const g = data.groups.find((x) => x.id === id);
  const [f, setF] = useState(() => ({
    subject: g?.subject ?? SUBJECTS[0], grade: g?.grade ?? 'Grade 12', title: g?.title ?? '', mode: g?.isOnline ? 'online' : 'local',
    town: g?.town ?? '', place: g?.place ?? '', nextSession: g?.nextSession ?? '', contact: g?.contact ?? '',
  }));
  const [err, setErr] = useState('');
  if (!g) return <><SheetHeader title="Not found" /><p>This study group was removed.</p></>;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.place.trim() || !f.nextSession.trim()) return setErr('Add a topic, a meeting place and a session time.');
    const r = await actions.updateGroup(id, { subject: f.subject, grade: f.grade, title: f.title.trim(), place: f.place.trim(), isOnline: f.mode === 'online', nextSession: f.nextSession.trim(), town: f.town, contact: f.contact.trim() });
    if (!r.ok) return setErr(r.error);
    toast('Study group saved'); closeSheet(); refresh();
  };

  return (
    <>
      <SheetHeader title="Edit study group" />
      <form className="stack" onSubmit={save} noValidate>
        <div className="filters">
          <Field label="Subject" id="eg_s"><select id="eg_s" value={f.subject} onChange={set('subject')}>{[...new Set([...SUBJECTS, f.subject])].map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Grade" id="eg_g"><select id="eg_g" value={f.grade} onChange={set('grade')}>{[8, 9, 10, 11, 12].map((n) => <option key={n}>Grade {n}</option>)}</select></Field>
        </div>
        <Field label="Topic" id="eg_t"><input id="eg_t" maxLength={80} value={f.title} onChange={set('title')} /></Field>
        <div className="filters">
          <Field label="Meet" id="eg_m"><select id="eg_m" value={f.mode} onChange={set('mode')}><option value="local">In person</option><option value="online">Online</option></select></Field>
          <Field label="Town" id="eg_town"><select id="eg_town" value={f.town} onChange={set('town')}>{[...new Set([...towns, f.town].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}</select></Field>
        </div>
        <Field label="Where" id="eg_w"><input id="eg_w" maxLength={80} value={f.place} onChange={set('place')} /></Field>
        <Field label="Next session" id="eg_n"><input id="eg_n" maxLength={40} value={f.nextSession} onChange={set('nextSession')} /></Field>
        <Field label="Contact" id="eg_c"><input id="eg_c" maxLength={40} value={f.contact} onChange={set('contact')} /></Field>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit">Save study group</button>
      </form>
      <DeleteButton label="Delete study group" onDelete={async () => {
        const r = await actions.deleteGroup(id);
        if (!r.ok) { toast(r.error); return; }
        closeSheet(); toast('Study group deleted'); refresh();
      }} />
    </>
  );
}

/* ---------------- one person (super user) ---------------- */
export function PersonSheet({ id }: { id: string }) {
  const { data, user, closeSheet, toast, refresh } = useApp();
  const [acct, setAcct] = useState<Account | null>(null);
  const [role, setRole] = useState<Role>('customer');
  const [name, setName] = useState('');
  const [linkTo, setLinkTo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isMe = user?.id === id;

  const load = async () => {
    const r = await actions.listAccounts();
    if (!r.ok) { setErr(r.error); return; }
    const a = r.value.find((x) => x.id === id) ?? null;
    setAcct(a);
    if (a) { setRole(a.role); setName(a.displayName); }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!acct) return <><SheetHeader title="Account" /><p className="small muted">{err || 'Loading…'}</p></>;
  const linked = data.businesses.filter((b) => acct.businessIds.includes(b.id));
  const linkable = data.businesses.filter((b) => !acct.businessIds.includes(b.id)).sort((a, b) => a.name.localeCompare(b.name));
  const after = async (r: { ok: boolean; error?: string }, msg: string) => {
    if (!r.ok) { toast(r.error ?? 'Couldn’t save'); return; }
    toast(msg); await load(); refresh();
  };

  return (
    <>
      <SheetHeader eyebrow={personLabel(acct)} title={acct.displayName || acct.email} />
      <span className="small muted">{acct.email} · joined {new Date(acct.createdAt).toLocaleDateString('en-ZA')} · {acct.lastSignInAt ? `last signed in ${new Date(acct.lastSignInAt).toLocaleDateString('en-ZA')}` : 'never signed in'}</span>

      <form className="stack" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true);
        const r = await actions.updateAccount(id, role, name.trim());
        setBusy(false);
        if (!r.ok) { setErr(r.error); return; }
        after(r, 'Account saved');
      }} noValidate>
        <Field label="Name" id="pa_n"><input id="pa_n" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Role" id="pa_r">
          <select id="pa_r" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isMe}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{r === 'customer' ? 'Customer (or shop owner)' : ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <span className="note">Staff manage businesses, listings, study groups and orders. Super users can also manage people and towns, and delete anything.{isMe ? ' You can’t change your own role.' : ''}</span>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</button>
      </form>

      <div className="box">
        <span className="eyebrow">Runs these businesses</span>
        {linked.length ? linked.map((b) => (
          <div key={b.id} className="between">
            <span className="small"><b>{b.name}</b>{b.town ? ` · ${b.town}` : ''}</span>
            <button className="btn btn-ghost btn-sm" onClick={async () => after(await actions.unlinkOwner(b.id, id), `Unlinked from ${b.name}`)}>Unlink</button>
          </div>
        )) : <span className="small muted">None. Link a business so this person can confirm its status, manage its products and handle its orders.</span>}
        <div className="filters" style={{ alignItems: 'flex-end' }}>
          <Field label="Link to a business" id="pa_link">
            <select id="pa_link" value={linkTo} onChange={(e) => setLinkTo(e.target.value)}>
              <option value="">Choose a business…</option>
              {linkable.map((b) => <option key={b.id} value={b.id}>{b.name}{b.town ? ` (${b.town})` : ''}</option>)}
            </select>
          </Field>
          <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} disabled={!linkTo} onClick={async () => {
            const b = data.businesses.find((x) => x.id === linkTo);
            await after(await actions.linkOwner(linkTo, id), `Linked to ${b?.name ?? 'business'}`); setLinkTo('');
          }}>Link</button>
        </div>
      </div>

      {!isMe && (
        <div className="box">
          <span className="eyebrow">Remove access</span>
          <span className="small muted">Makes this person a customer and unlinks every business. Their orders, listings and study groups are kept. To delete an account completely, use the Supabase dashboard (Authentication › Users).</span>
          <DeleteButton label="Remove access" confirmLabel="Tap again to remove access" onDelete={async () => { await after(await actions.removeAccess(id, name.trim()), 'Access removed'); closeSheet(); }} />
        </div>
      )}
    </>
  );
}
