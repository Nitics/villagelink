import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { CopyNumber, Field, SheetHeader } from '../components/ui';
import { LISTING_KINDS, PLANS, SUBJECTS, TOWNS } from '../lib/constants';
import { parsePrice, phoneOk, rand, whatsappUrl } from '../lib/format';
import { actions } from '../lib/actions';
import type { ListingKind, Plan } from '../lib/types';

const defaultTown = (t: string) => (t !== 'all' ? t : TOWNS[0]);

export function ListingSheet({ id }: { id: string }) {
  const { data, user, isStaff, closeSheet, toast, refresh } = useApp();
  const l = data.listings.find((x) => x.id === id);
  if (!l) return <><SheetHeader title="Not found" /><p>This listing was removed.</p></>;
  const wa = whatsappUrl(l.phone);
  return (
    <>
      <SheetHeader eyebrow={`${LISTING_KINDS[l.kind].label} · ${l.town}`} title={l.title} />
      <span className="price" style={{ fontSize: 24 }}>{rand(l.price)}{l.unit ? <span className="meta" style={{ fontSize: 13, fontFamily: 'var(--body)', fontWeight: 500 }}> {l.unit}</span> : null}</span>
      <div className="box">
        <div className="vrow"><Icon name="user" /><span>{l.kind === 'service' ? 'Offered' : 'Sold'} by <b>{l.sellerName}</b></span></div>
        {l.note && <div className="vrow"><Icon name="msg" /><span>{l.note}</span></div>}
      </div>
      <span className="eyebrow">Contact directly</span>
      <CopyNumber value={l.phone} />
      {wa && <a className="btn btn-mint" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="msg" />Message on WhatsApp</a>}
      <p className="note">Meet in a public place and check the item before you pay.</p>
      {(user?.id === l.ownerId || isStaff) && (
        <button className="btn btn-danger" onClick={async () => {
          const r = await actions.removeListing(l.id);
          if (!r.ok) { toast(r.error); return; }
          closeSheet(); toast('Listing removed'); refresh();
        }}>Remove listing</button>
      )}
    </>
  );
}

export function NewListingSheet() {
  const { town, profile, closeSheet, toast, refresh } = useApp();
  const navigate = useNavigate();
  const [f, setF] = useState({ kind: 'goods' as ListingKind, title: '', price: '', unit: '', town: defaultTown(town), sellerName: profile?.displayName ?? '', phone: '', note: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const price = parsePrice(f.price);
    if (!f.title.trim() || !(price >= 0) || !f.sellerName.trim() || !phoneOk(f.phone)) return setErr('Add a title, a price, your name and a phone number with at least 9 digits.');
    setBusy(true);
    const r = await actions.postListing({ ...f, title: f.title.trim(), price, sellerName: f.sellerName.trim(), phone: f.phone.trim(), note: f.note.trim(), unit: f.unit.trim() });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    closeSheet(); toast('Listing posted'); await refresh(); navigate('/market?tab=listings');
  };

  return (
    <>
      <SheetHeader title="Sell or offer a service" />
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Type" id="lk"><select id="lk" value={f.kind} onChange={set('kind')}>{(Object.keys(LISTING_KINDS) as ListingKind[]).map((k) => <option key={k} value={k}>{LISTING_KINDS[k].label}</option>)}</select></Field>
        <Field label="Title" id="lt"><input id="lt" maxLength={80} value={f.title} onChange={set('title')} placeholder="e.g. Tomatoes, school shoes, plumbing" /></Field>
        <div className="filters">
          <Field label="Price (R)" id="lp"><input id="lp" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="50" /></Field>
          <Field label="Per (optional)" id="lu"><input id="lu" maxLength={20} value={f.unit} onChange={set('unit')} placeholder="kg, hour, item" /></Field>
        </div>
        <div className="filters">
          <Field label="Town" id="ltown"><select id="ltown" value={f.town} onChange={set('town')}>{TOWNS.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Your name" id="ls"><input id="ls" maxLength={60} value={f.sellerName} onChange={set('sellerName')} /></Field>
        </div>
        <Field label="Phone or WhatsApp" id="lph"><input id="lph" inputMode="tel" maxLength={20} value={f.phone} onChange={set('phone')} placeholder="082 123 4567" /></Field>
        <Field label="Details" id="ln"><textarea id="ln" rows={2} maxLength={300} value={f.note} onChange={set('note')} placeholder="Condition, size, when you’re available" /></Field>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post listing'}</button>
        <span className="note">Your phone number is shown to everyone who opens VillageLink.</span>
      </form>
    </>
  );
}

export function NewGroupSheet() {
  const { town, closeSheet, toast, refresh } = useApp();
  const [f, setF] = useState({ subject: SUBJECTS[0], grade: 'Grade 12', title: '', mode: 'local', town: defaultTown(town), place: '', nextSession: '', contact: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.place.trim() || !f.nextSession.trim()) return setErr('Add a topic, a meeting place and a first session time.');
    setBusy(true);
    const r = await actions.createGroup({ subject: f.subject, grade: f.grade, title: f.title.trim(), place: f.place.trim(), isOnline: f.mode === 'online', nextSession: f.nextSession.trim(), town: f.town, contact: f.contact.trim() });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    closeSheet(); toast('Group created'); refresh();
  };

  return (
    <>
      <SheetHeader title="Create a study group" />
      <form className="stack" onSubmit={submit} noValidate>
        <div className="filters">
          <Field label="Subject" id="gs"><select id="gs" value={f.subject} onChange={set('subject')}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Grade" id="gg"><select id="gg" value={f.grade} onChange={set('grade')}>{[8, 9, 10, 11, 12].map((g) => <option key={g}>Grade {g}</option>)}</select></Field>
        </div>
        <Field label="Topic" id="gt"><input id="gt" maxLength={80} value={f.title} onChange={set('title')} placeholder="e.g. Trigonometry past papers" /></Field>
        <div className="filters">
          <Field label="Meet" id="gm"><select id="gm" value={f.mode} onChange={set('mode')}><option value="local">In person</option><option value="online">Online</option></select></Field>
          <Field label="Town" id="gtown"><select id="gtown" value={f.town} onChange={set('town')}>{TOWNS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        </div>
        <Field label="Where" id="gw"><input id="gw" maxLength={80} value={f.place} onChange={set('place')} placeholder="e.g. Community library, or WhatsApp group" /></Field>
        <Field label="First session" id="gn"><input id="gn" maxLength={40} value={f.nextSession} onChange={set('nextSession')} placeholder="e.g. Thu 15:00" /></Field>
        <Field label="Contact for joining (optional)" id="gc"><input id="gc" maxLength={40} value={f.contact} onChange={set('contact')} placeholder="WhatsApp number" /></Field>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create group'}</button>
      </form>
    </>
  );
}

export function PlanRequestSheet() {
  const { town, profile, closeSheet, toast, refresh } = useApp();
  const [f, setF] = useState({ businessName: '', town: defaultTown(town), plan: 'verified' as Plan, contactName: profile?.displayName ?? '', phone: '', details: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.businessName.trim() || !f.contactName.trim() || !phoneOk(f.phone)) return setErr('Add the business name, your name and a phone number.');
    setBusy(true);
    const r = await actions.requestPlan({ ...f, businessName: f.businessName.trim(), contactName: f.contactName.trim(), phone: f.phone.trim(), details: f.details.trim() });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    closeSheet(); toast('Request sent. We’ll call you.'); refresh();
  };

  return (
    <>
      <SheetHeader title="List or upgrade a business" />
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Business name" id="pr_b"><input id="pr_b" maxLength={80} value={f.businessName} onChange={set('businessName')} /></Field>
        <div className="filters">
          <Field label="Town" id="pr_t"><select id="pr_t" value={f.town} onChange={set('town')}>{TOWNS.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Plan" id="pr_p"><select id="pr_p" value={f.plan} onChange={set('plan')}>{PLANS.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.price})</option>)}</select></Field>
        </div>
        <div className="filters">
          <Field label="Your name" id="pr_n"><input id="pr_n" maxLength={60} value={f.contactName} onChange={set('contactName')} /></Field>
          <Field label="Phone" id="pr_ph"><input id="pr_ph" inputMode="tel" maxLength={20} value={f.phone} onChange={set('phone')} /></Field>
        </div>
        <Field label="What you sell and your opening hours" id="pr_x"><textarea id="pr_x" rows={3} maxLength={500} value={f.details} onChange={set('details')} /></Field>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
        <span className="note">The VillageLink team will call you to check the business before it’s marked verified.</span>
      </form>
    </>
  );
}
