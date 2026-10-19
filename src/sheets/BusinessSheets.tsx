import { useState, type FormEvent } from 'react';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { CopyNumber, Field, PlanBadge, SheetHeader, StatusPill } from '../components/ui';
import { BUSINESS_CATEGORIES, CONFIRM_WINDOW_MIN, GROUPS, HOURS_STALE_DAYS, PLANS, REPORT_WINDOW_MIN, groupOf } from '../lib/constants';
import { DAYS, ago, clock, fmtMin, hoursAgeDays, hoursHint, minsSince, parseHours, statusOf } from '../lib/hours';
import { directionsUrl, parsePrice, phoneOk, rand, whatsappUrl } from '../lib/format';
import { actions } from '../lib/actions';
import { businessesFromCSV, type BusinessRow } from '../lib/csv';
import type { Plan, Product } from '../lib/types';

/* ---------------- business details ---------------- */
export function BusinessSheet({ id }: { id: string }) {
  const { data, now, canManage, isAdmin, openSheet, needSignIn, toast, refresh } = useApp();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const b = data.businesses.find((x) => x.id === id);
  if (!b) return <><SheetHeader title="Not found" /><p>This business was removed.</p></>;
  const st = statusOf(b, now);
  const week = parseHours(b.openingHours);
  const c = clock(now);
  const age = hoursAgeDays(b, now);
  const rep = data.reports[b.id];
  const showRep = rep && minsSince(rep.at, now) <= REPORT_WINDOW_MIN;
  const products = data.products.filter((p) => p.businessId === b.id && p.inStock);
  const wa = whatsappUrl(b.whatsapp);

  const report = async (open: boolean) => {
    if (needSignIn('report')) return;
    setBusy(true);
    const r = await actions.report(b.id, open);
    setBusy(false);
    toast(r.ok ? 'Thanks. Your report is shown to others for 4 hours.' : r.error);
    if (r.ok) refresh();
  };
  const confirm = async (open: boolean) => {
    setBusy(true);
    const r = await actions.confirmStatus(b.id, open, note.trim());
    setBusy(false);
    toast(r.ok ? (open ? 'Confirmed open for the next 3 hours' : 'Marked closed') : r.error);
    if (r.ok) { setNote(''); refresh(); }
  };

  return (
    <>
      <SheetHeader eyebrow={`${b.typeLabel || GROUPS[groupOf(b.category)].label}${b.town ? ` · ${b.town}` : ''}`} title={b.name} />
      <div className="row" style={{ flexWrap: 'wrap' }}><StatusPill status={st} /><PlanBadge plan={b.plan} /></div>
      {b.description && <p className="small" style={{ margin: 0 }}>{b.description}</p>}

      <div className="box">
        <span className="eyebrow">Verification</span>
        <div className="vrow"><Icon name="check" /><span>
          {b.confirmation ? (
            <><b>The business</b> marked it <b>{b.confirmation.open ? 'open' : 'closed'}</b> {ago(minsSince(b.confirmation.at, now))}
              {minsSince(b.confirmation.at, now) > CONFIRM_WINDOW_MIN ? ' (expired after 3 hours)' : ''}.
              {b.confirmation.note && <><br /><span className="muted">“{b.confirmation.note}”</span></>}</>
          ) : 'No confirmation from the business today.'}
        </span></div>
        <div className="vrow"><Icon name="clock" /><span>
          {week ? `Opening hours ${age !== null ? `last checked ${ago(age * 1440)}` : 'on record'}${age !== null && age > HOURS_STALE_DAYS ? ', so they may be out of date' : ''}.` : 'No opening hours on record.'}
        </span></div>
        {showRep && (
          <div className="vrow"><Icon name="users" /><span>A resident reported it <b>{rep.open ? 'open' : 'closed'}</b> {ago(minsSince(rep.at, now))}.<br />
            <span className="note">Resident reports help, but only the business can confirm its status.</span>
            {isAdmin && <><br /><button className="btn btn-line btn-sm" style={{ marginTop: 6 }} onClick={async () => {
              const r = await actions.deleteReports(b.id); toast(r.ok ? 'Resident reports removed' : r.error); if (r.ok) refresh();
            }}>Remove resident reports</button></>}</span></div>
        )}
      </div>

      <div className="btnrow">
        <a className="btn btn-mint" href={directionsUrl(b)} target="_blank" rel="noopener noreferrer"><Icon name="nav" />Directions</a>
        {b.sellsOnline && <button className="btn btn-ghost" onClick={() => openSheet({ kind: 'order', businessId: b.id })}><Icon name="bag" />Order{products.length ? ` (${products.length} items)` : ''}</button>}
      </div>
      {b.address && <div className="vrow"><Icon name="pin" /><span>{b.address}{b.town ? `, ${b.town}` : ''}</span></div>}
      <CopyNumber value={b.phone} />
      {wa && <a className="btn btn-line" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="msg" />WhatsApp the business</a>}

      {week && (
        <div className="box"><span className="eyebrow">Opening hours</span>
          <table className="hours"><tbody>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const r = week[d];
              return (
                <tr key={d} className={d === c.day ? 'today' : ''}>
                  <td>{DAYS[d]}{d === c.day ? ' (today)' : ''}</td>
                  <td>{!r ? 'Closed' : r.map(([o, cl]) => (o === 0 && cl >= 1440 ? '24 hours' : `${fmtMin(o)} – ${fmtMin(cl)}`)).join(', ')}</td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
      )}

      <div className="box">
        <span className="eyebrow">Been there recently?</span>
        <div className="btnrow">
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => report(true)}>I saw it open</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => report(false)}>I saw it closed</button>
        </div>
      </div>

      {canManage(b.id) && (
        <div className="box">
          <span className="eyebrow">Your business</span>
          <div className="btnrow">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => confirm(true)}>Confirm open now</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => confirm(false)}>Confirm closed</button>
          </div>
          <Field label="Note for customers (optional)" id="confNote">
            <input id="confNote" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Diesel only today" />
          </Field>
          <button className="btn btn-line btn-sm" onClick={() => openSheet({ kind: 'editBusiness', id: b.id })}>Edit details and products</button>
        </div>
      )}
    </>
  );
}

/* ---------------- ordering ---------------- */
const readLocal = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };

export function OrderSheet({ businessId }: { businessId: string }) {
  const { data, user, now, openSheet, closeSheet, toast, refresh } = useApp();
  const b = data.businesses.find((x) => x.id === businessId);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<'collect' | 'delivery'>('collect');
  const [address, setAddress] = useState('');
  const [name, setName] = useState(() => readLocal('villagelink.buyerName'));
  const [phone, setPhone] = useState(() => readLocal('villagelink.buyerPhone'));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!b) return null;
  const products = data.products.filter((p) => p.businessId === b.id);
  const total = products.reduce((s, p) => s + (cart[p.id] || 0) * p.price, 0);
  const qty = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(99, (c[id] || 0) + d)) }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return setErr('Sign in first so the shop knows who the order is from.');
    const items = products.filter((p) => (cart[p.id] || 0) > 0).map((p) => ({ productId: p.id, qty: cart[p.id] }));
    if (!items.length && !note.trim()) return setErr('Add at least one item, or write what you need.');
    if (!name.trim() || !phoneOk(phone)) return setErr('Add your name and a phone number with at least 9 digits so the shop can reach you.');
    if (method === 'delivery' && !address.trim()) return setErr('Add a delivery address or landmark.');
    setErr(''); setBusy(true);
    try { localStorage.setItem('villagelink.buyerName', name.trim()); localStorage.setItem('villagelink.buyerPhone', phone.trim()); } catch { /* ignore */ }
    const r = await actions.placeOrder({ businessId: b.id, name: name.trim(), phone: phone.trim(), method, address: address.trim(), note: note.trim(), items });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    closeSheet();
    toast('Order sent. The shop will contact you to confirm.');
    await refresh();
    window.location.hash = '#/market?tab=orders';
  };

  return (
    <>
      <SheetHeader eyebrow="Order from" title={b.name} />
      <span className="small muted">{b.town} · {hoursHint(b, now)}</span>
      {!user && <div className="banner"><span>Sign in before sending your order.</span><button className="btn btn-mint btn-sm" onClick={() => openSheet({ kind: 'auth', reason: 'order' })}>Sign in</button></div>}
      {products.length ? (
        <div className="box">
          {products.map((p) => (
            <div key={p.id} className="between">
              <span className="body" style={{ minWidth: 0 }}><span style={{ fontWeight: 600 }}>{p.name}</span><br />
                <span className="meta">{rand(p.price)}{p.unit ? ` / ${p.unit}` : ''}{p.inStock ? '' : ' · out of stock'}</span></span>
              {p.inStock && (
                <span className="qty">
                  <button type="button" onClick={() => qty(p.id, -1)} aria-label={`Fewer ${p.name}`}>−</button>
                  <span>{cart[p.id] || 0}</span>
                  <button type="button" onClick={() => qty(p.id, 1)} aria-label={`More ${p.name}`}>+</button>
                </span>
              )}
            </div>
          ))}
          <div className="between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}><b>Total</b><span className="price">{rand(total)}</span></div>
        </div>
      ) : <p className="small muted" style={{ margin: 0 }}>This shop hasn’t added products yet. Write what you need below and they’ll reply.</p>}
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="How do you want it?" id="o_method">
          <select id="o_method" value={method} onChange={(e) => setMethod(e.target.value as 'collect' | 'delivery')}>
            <option value="collect">I’ll collect at the shop</option>
            <option value="delivery">Deliver to me (shop may charge)</option>
          </select>
        </Field>
        {method === 'delivery' && <Field label="Delivery address or landmark" id="o_addr"><input id="o_addr" maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. House 214, next to the church" /></Field>}
        <div className="filters">
          <Field label="Your name" id="o_name"><input id="o_name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
          <Field label="Your phone" id="o_phone"><input id="o_phone" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></Field>
        </div>
        <Field label={products.length ? 'Note to the shop (optional)' : 'What do you need?'} id="o_note"><textarea id="o_note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit" disabled={busy}><Icon name="send" />{busy ? 'Sending…' : 'Send order'}</button>
        <span className="note">You pay the shop directly when you collect or receive your order. The shop sees your name and phone number so they can contact you.</span>
      </form>
    </>
  );
}

/* ---------------- add / edit a business ---------------- */
export function EditBusinessSheet({ id }: { id: string | null }) {
  const { data, isStaff, town, towns, openSheet, closeSheet, toast, refresh } = useApp();
  const existing = id ? data.businesses.find((b) => b.id === id) : undefined;
  const limited = !isStaff; // shop owners change everyday details only
  const [f, setF] = useState(() => ({
    name: existing?.name ?? '', category: existing?.category ?? 'shop', town: existing?.town || (town !== 'all' ? town : towns[0] ?? ''),
    typeLabel: existing?.typeLabel ?? '', address: existing?.address ?? '', phone: existing?.phone ?? '', whatsapp: existing?.whatsapp ?? '',
    openingHours: existing?.openingHours ?? '', hoursChecked: existing?.hoursChecked || new Date().toISOString().slice(0, 10),
    plan: (existing?.plan ?? 'free') as Plan, latitude: existing?.latitude?.toString() ?? '', longitude: existing?.longitude?.toString() ?? '',
    sellsOnline: existing?.sellsOnline ?? false, description: existing?.description ?? '', isActive: existing?.isActive ?? true,
  }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [prod, setProd] = useState({ name: '', price: '', unit: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const products = id ? data.products.filter((p) => p.businessId === id) : [];

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Add the business name.');
    if (f.openingHours.trim() && !parseHours(f.openingHours)) return setErr('We couldn’t read those hours. Use a format like “Mo-Fr 07:00-18:00; Sa 08:00-13:00; Su off” or “24/7”.');
    setErr(''); setBusy(true);
    if (limited && id) {
      const r = await actions.updateBusinessDetails(id, { phone: f.phone.trim(), whatsapp: f.whatsapp.trim(), address: f.address.trim(), openingHours: f.openingHours.trim(), description: f.description.trim() });
      setBusy(false);
      if (!r.ok) return setErr(r.error);
      toast('Saved'); refresh(); return;
    }
    const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const row: BusinessRow & { is_active: boolean } = {
      is_active: f.isActive,
      name: f.name.trim(), category: f.category, type_label: f.typeLabel.trim() || null, town: f.town || null,
      address: f.address.trim() || null, phone: f.phone.trim() || null, whatsapp: f.whatsapp.trim() || null,
      opening_hours: f.openingHours.trim() || null, hours_checked: f.hoursChecked || null, sells_online: f.sellsOnline,
      plan: f.plan, latitude: num(f.latitude), longitude: num(f.longitude), description: f.description.trim() || null,
    };
    const r = await actions.saveBusiness(id, row);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast(id ? 'Saved' : 'Business added');
    await refresh();
    if (!id) openSheet({ kind: 'editBusiness', id: r.value });
  };

  const addProduct = async (e: FormEvent) => {
    e.preventDefault();
    const price = parsePrice(prod.price);
    if (!id || !prod.name.trim() || !(price >= 0)) { toast('Add a product name and price'); return; }
    const r = await actions.addProduct({ businessId: id, name: prod.name.trim(), price, unit: prod.unit.trim() });
    toast(r.ok ? 'Product added' : r.error);
    if (r.ok) { setProd({ name: '', price: '', unit: '' }); refresh(); }
  };

  return (
    <>
      <SheetHeader title={id ? 'Edit business' : 'Add a business'} />
      <form className="stack" onSubmit={save} noValidate>
        {limited ? (
          <p className="small muted" style={{ margin: 0 }}><b>{f.name}</b>{f.town ? ` · ${f.town}` : ''}. To change the name, category, town, plan or ordering, contact VillageLink staff.</p>
        ) : (
          <>
            <Field label="Name" id="b_name"><input id="b_name" maxLength={80} value={f.name} onChange={set('name')} /></Field>
            <div className="filters">
              <Field label="Category" id="b_cat"><select id="b_cat" value={f.category} onChange={set('category')}>{BUSINESS_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Town" id="b_town"><select id="b_town" value={f.town} onChange={set('town')}>{[...new Set([...towns, f.town].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}</select></Field>
            </div>
            <Field label="Description shown under the name" id="b_type"><input id="b_type" maxLength={60} value={f.typeLabel} onChange={set('typeLabel')} placeholder="e.g. Spaza shop, 24-hour fuel station" /></Field>
          </>
        )}
        <Field label="Address or landmark" id="b_addr"><input id="b_addr" maxLength={200} value={f.address} onChange={set('address')} /></Field>
        <div className="filters">
          <Field label="Phone" id="b_ph"><input id="b_ph" inputMode="tel" maxLength={20} value={f.phone} onChange={set('phone')} /></Field>
          <Field label="WhatsApp" id="b_wa"><input id="b_wa" inputMode="tel" maxLength={20} value={f.whatsapp} onChange={set('whatsapp')} /></Field>
        </div>
        <Field label="Opening hours" id="b_hours"><input id="b_hours" maxLength={200} value={f.openingHours} onChange={set('openingHours')} placeholder="Mo-Fr 07:00-18:00; Sa 08:00-13:00; Su off  or  24/7" /></Field>
        {!limited && (
          <>
            <div className="filters">
              <Field label="Hours checked on" id="b_chk"><input id="b_chk" type="date" value={f.hoursChecked} onChange={set('hoursChecked')} /></Field>
              <Field label="Plan" id="b_plan"><select id="b_plan" value={f.plan} onChange={set('plan')}>{PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            </div>
            <div className="filters">
              <Field label="Latitude (optional)" id="b_lat"><input id="b_lat" inputMode="decimal" value={f.latitude} onChange={set('latitude')} placeholder="-25.48" /></Field>
              <Field label="Longitude (optional)" id="b_lng"><input id="b_lng" inputMode="decimal" value={f.longitude} onChange={set('longitude')} placeholder="31.51" /></Field>
            </div>
            <label className="switch" htmlFor="b_sells"><span><b>Takes orders in the app</b><br /><span className="small muted">Shows an Order button</span></span>
              <input type="checkbox" id="b_sells" checked={f.sellsOnline} onChange={(e) => setF((x) => ({ ...x, sellsOnline: e.target.checked }))} /></label>
            <label className="switch" htmlFor="b_active"><span><b>Show in the app</b><br /><span className="small muted">Turn off to hide it from everyone except staff</span></span>
              <input type="checkbox" id="b_active" checked={f.isActive} onChange={(e) => setF((x) => ({ ...x, isActive: e.target.checked }))} /></label>
          </>
        )}
        <Field label="More details (optional)" id="b_desc"><textarea id="b_desc" rows={2} maxLength={500} value={f.description} onChange={set('description')} /></Field>
        {err && <span className="err" role="alert">{err}</span>}
        <button className="btn btn-mint" type="submit" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Add business'}</button>
      </form>

      {id && (
        <div className="box">
          <span className="eyebrow">Products ({products.length})</span>
          {products.map((p) => <ProductRow key={p.id} p={p} />)}
          <form className="stack" onSubmit={addProduct} noValidate>
            <Field label="Product" id="pp_n"><input id="pp_n" maxLength={60} value={prod.name} onChange={(e) => setProd({ ...prod, name: e.target.value })} placeholder="Maize meal 10 kg" /></Field>
            <div className="filters">
              <Field label="Price (R)" id="pp_p"><input id="pp_p" inputMode="decimal" value={prod.price} onChange={(e) => setProd({ ...prod, price: e.target.value })} /></Field>
              <Field label="Per" id="pp_u"><input id="pp_u" maxLength={20} value={prod.unit} onChange={(e) => setProd({ ...prod, unit: e.target.value })} placeholder="bag" /></Field>
            </div>
            <button className="btn btn-ghost btn-sm" type="submit"><Icon name="plus" />Add product</button>
          </form>
        </div>
      )}

      {id && isStaff && (
        <button className="btn btn-danger" onClick={async () => {
          if (!sure) { setSure(true); return; }
          const r = await actions.deleteBusiness(id);
          if (!r.ok) { toast(r.error); return; }
          closeSheet(); toast('Business deleted'); refresh();
        }}>{sure ? 'Tap again to delete permanently' : 'Delete business'}</button>
      )}
    </>
  );
}

/* ---------------- import a list ---------------- */
const TEMPLATE = `name,category,type_label,town,address,phone,whatsapp,opening_hours,hours_checked,sells_online,plan,latitude,longitude,description
Sample Fuel Stop,fuel,24-hour fuel station,Malelane,N4 off-ramp,013 000 0000,,24/7,2026-10-19,false,free,,,
Sample Spaza,spaza,Spaza shop,KaMaqhekeza,Near the taxi rank,072 000 0000,072 000 0000,Mo-Su 06:00-20:30,2026-10-19,true,verified,,,Bread and airtime`;

export function ImportSheet() {
  const { data, towns, toast, refresh } = useApp();
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ err?: boolean; text: string; problems?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim()) return setMsg({ err: true, text: 'Choose a CSV file or paste your list first.' });
    const { rows, problems } = businessesFromCSV(text, towns);
    if (!rows.length) return setMsg({ err: true, text: problems[0] ?? 'No businesses found.', problems: problems.slice(1) });
    setBusy(true);
    const r = await actions.importBusinesses(rows, data.businesses);
    setBusy(false);
    await refresh();
    if (!r.ok) return setMsg({ err: true, text: r.error, problems });
    setMsg({ text: `Imported ${r.value.added} new and updated ${r.value.updated} businesses.`, problems });
    toast('Import finished');
  };

  return (
    <>
      <SheetHeader title="Import businesses" />
      <span className="small muted">Save your list from Excel or Google Sheets as CSV, then choose the file or paste it below. The first row must be the column names. Rows with the same name and town update the existing business.</span>
      <code className="csv">{TEMPLATE}</code>
      <span className="note">Categories: {BUSINESS_CATEGORIES.join(', ')}. Hours like “Mo-Fr 07:00-18:00; Sa 08:00-13:00; Su off” or “24/7”.</span>
      <Field label="CSV file" id="csvFile">
        <input id="csvFile" type="file" accept=".csv,text/csv,text/plain" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setText(await file.text()); }} />
      </Field>
      <Field label="Or paste CSV" id="csvText"><textarea id="csvText" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="name,category,type_label,town,…" /></Field>
      {msg && (
        <div className="stack" role="status">
          <span className={msg.err ? 'err' : 'note'}>{msg.text}</span>
          {msg.problems?.length ? <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{msg.problems.map((p) => <li key={p}>{p}</li>)}</ul> : null}
        </div>
      )}
      <button className="btn btn-mint" onClick={run} disabled={busy}><Icon name="upload" />{busy ? 'Importing…' : 'Import'}</button>
    </>
  );
}

/* ---------------- one product: view, edit, stock, remove ---------------- */
function ProductRow({ p }: { p: Product }) {
  const { toast, refresh } = useApp();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ name: p.name, price: String(p.price), unit: p.unit });
  const save = async () => {
    const price = parsePrice(f.price);
    if (!f.name.trim() || !(price >= 0)) { toast('Add a product name and price'); return; }
    const r = await actions.updateProduct(p.id, { name: f.name.trim(), price, unit: f.unit.trim() });
    toast(r.ok ? 'Product saved' : r.error);
    if (r.ok) { setEditing(false); refresh(); }
  };
  if (editing) {
    return (
      <div className="stack" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
        <Field label="Product" id={`pe_n_${p.id}`}><input id={`pe_n_${p.id}`} maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="filters">
          <Field label="Price (R)" id={`pe_p_${p.id}`}><input id={`pe_p_${p.id}`} inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
          <Field label="Per" id={`pe_u_${p.id}`}><input id={`pe_u_${p.id}`} maxLength={20} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        </div>
        <div className="btnrow"><button className="btn btn-mint btn-sm" onClick={save}>Save product</button><button className="btn btn-line btn-sm" onClick={() => setEditing(false)}>Cancel</button></div>
      </div>
    );
  }
  return (
    <div className="between">
      <span className="small" style={{ minWidth: 0 }}><b>{p.name}</b> · {rand(p.price)}{p.unit ? ` / ${p.unit}` : ''}</span>
      <span className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} aria-label={`Edit ${p.name}`}>Edit</button>
        <button className="btn btn-ghost btn-sm" onClick={async () => { const r = await actions.setInStock(p.id, !p.inStock); if (r.ok) refresh(); else toast(r.error); }}>{p.inStock ? 'In stock' : 'Out of stock'}</button>
        <button className="iconbtn" aria-label={`Remove ${p.name}`} onClick={async () => { const r = await actions.removeProduct(p.id); if (r.ok) refresh(); else toast(r.error); }}><Icon name="x" /></button>
      </span>
    </div>
  );
}
