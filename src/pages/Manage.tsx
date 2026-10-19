import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { Empty, OrderCard, ORDER_STATUS } from '../components/ui';
import { DeleteButton, ROLE_LABEL, personLabel } from '../sheets/AdminSheets';
import { GROUPS, HOURS_STALE_DAYS, LISTING_KINDS, PLANS, groupOf } from '../lib/constants';
import { ago, hoursAgeDays, minsSince, parseHours } from '../lib/hours';
import { rand } from '../lib/format';
import { actions } from '../lib/actions';
import type { Account, Order, OrderStatus } from '../lib/types';

type Tab = 'orders' | 'businesses' | 'listings' | 'groups' | 'requests' | 'people' | 'towns';
const TAB_LABEL: Record<Tab, string> = {
  orders: 'Orders', businesses: 'Businesses', listings: 'Listings', groups: 'Study groups', requests: 'Plan requests', people: 'People', towns: 'Towns',
};

const matches = (q: string, ...fields: (string | undefined)[]) =>
  !q.trim() || fields.some((f) => (f ?? '').toLowerCase().includes(q.trim().toLowerCase()));

function OrderList({ orders }: { orders: Order[] }) {
  const { isAdmin, toast, refresh } = useApp();
  const setStatus = async (id: string, s: OrderStatus) => {
    const r = await actions.setOrderStatus(id, s);
    toast(r.ok ? 'Order updated' : r.error);
    if (r.ok) refresh();
  };
  if (!orders.length) return <span className="small muted">No orders yet.</span>;
  return (
    <>{orders.slice(0, 100).map((o) => (
      <OrderCard key={o.id} o={o}>
        <span className="meta">Customer: {o.customerName} · {o.customerPhone}{o.note && o.items.length ? ` · “${o.note}”` : ''}</span>
        {!['done', 'declined', 'cancelled'].includes(o.status) && (
          <div className="btnrow">
            {(['accepted', 'ready', 'done', 'declined'] as OrderStatus[]).map((s) => (
              <button key={s} className="btn btn-ghost btn-sm" aria-pressed={o.status === s} onClick={() => setStatus(o.id, s)}>{ORDER_STATUS[s]}</button>
            ))}
          </div>
        )}
        {isAdmin && <DeleteButton label="Delete order" onDelete={async () => { const r = await actions.deleteOrder(o.id); toast(r.ok ? 'Order deleted' : r.error); if (r.ok) refresh(); }} />}
      </OrderCard>
    ))}</>
  );
}

function PeopleTab() {
  const { sheet, openSheet, data } = useApp();
  const [people, setPeople] = useState<Account[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | Account['role']>('all');
  // Reload whenever a sheet closes, so changes made in a person's sheet show up.
  useEffect(() => {
    if (sheet) return;
    actions.listAccounts().then((r) => (r.ok ? setPeople(r.value) : setErr(r.error)));
  }, [sheet]);
  if (err) return <Empty title="Couldn’t load accounts"><span className="small muted">{err}</span></Empty>;
  if (!people) return <span className="small muted">Loading accounts…</span>;
  const nameOf = (id: string) => data.businesses.find((b) => b.id === id)?.name ?? 'a business';
  const list = people.filter((p) => (role === 'all' || p.role === role) && matches(q, p.email, p.displayName));
  return (
    <>
      <div className="filters">
        <input className="sel" aria-label="Search people" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="sel" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="all">Everyone ({people.length})</option>
          {(Object.keys(ROLE_LABEL) as Account['role'][]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]} ({people.filter((p) => p.role === r).length})</option>)}
        </select>
      </div>
      <span className="note">New people join by creating an account in the app. Then set their role and businesses here.</span>
      {list.map((p) => (
        <button key={p.id} className="card" onClick={() => openSheet({ kind: 'person', id: p.id })}>
          <span className="ic"><Icon name="user" /></span>
          <span className="body">
            <span className="between" style={{ alignItems: 'flex-start' }}><span className="name">{p.displayName || p.email}</span><span className={`badge ${p.role === 'admin' ? 'b-feat' : p.role === 'staff' || p.businessIds.length ? 'b-ver' : 'b-off'}`}>{personLabel(p)}</span></span>
            <span className="meta">{p.email}</span>
            {p.businessIds.length > 0 && <span className="meta">Runs {p.businessIds.map(nameOf).join(', ')}</span>}
          </span>
        </button>
      ))}
      {!list.length && <span className="small muted">Nobody matches.</span>}
    </>
  );
}

function TownsTab() {
  const { data, towns, toast, refresh } = useApp();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const count = (t: string) => data.businesses.filter((b) => b.town === t).length;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (towns.some((t) => t.toLowerCase() === n.toLowerCase())) { toast('That town is already listed'); return; }
    const r = await actions.addTown(n, towns.length + 1);
    toast(r.ok ? `${n} added` : r.error);
    if (r.ok) { setName(''); refresh(); }
  };

  return (
    <>
      <form className="filters" onSubmit={add} style={{ alignItems: 'flex-end' }}>
        <label className="field" htmlFor="town_new">Add a town or village<input id="town_new" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Magudu" /></label>
        <button className="btn btn-mint" type="submit" style={{ flex: '0 0 auto' }}><Icon name="plus" />Add</button>
      </form>
      {towns.map((t) => (
        <div key={t} className="card col">
          {editing === t ? (
            <>
              <label className="field full" htmlFor={`town_${t}`}>New name<input id={`town_${t}`} maxLength={60} value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
              <div className="btnrow">
                <button className="btn btn-mint btn-sm" onClick={async () => {
                  const n = newName.trim();
                  if (!n || n === t) { setEditing(null); return; }
                  const r = await actions.renameTown(t, n);
                  toast(r.ok ? `Renamed to ${n}. Its businesses moved with it.` : r.error);
                  if (r.ok) { setEditing(null); refresh(); }
                }}>Save name</button>
                <button className="btn btn-line btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <div className="between full">
              <span className="body"><span className="name">{t}</span><span className="meta">{count(t)} business{count(t) === 1 ? '' : 'es'}</span></span>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(t); setNewName(t); }}>Rename</button>
                <button className="btn btn-ghost btn-sm" aria-label={`Remove ${t}`} onClick={async () => {
                  if (count(t)) { toast(`Move ${t}’s ${count(t)} business${count(t) === 1 ? '' : 'es'} to another town first.`); return; }
                  const r = await actions.deleteTown(t);
                  toast(r.ok ? `${t} removed` : r.error);
                  if (r.ok) refresh();
                }}>Remove</button>
              </span>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default function Manage() {
  const { data, isStaff, isAdmin, myBusinesses, user, openSheet, toast, refresh, now } = useApp();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const tabs: Tab[] = useMemo(() => (isAdmin
    ? ['orders', 'businesses', 'people', 'listings', 'groups', 'requests', 'towns']
    : ['orders', 'businesses', 'listings', 'groups', 'requests']), [isAdmin]);
  const tab = (tabs.includes(params.get('tab') as Tab) ? params.get('tab') : 'orders') as Tab;

  if (!user || (!isStaff && !myBusinesses.size)) {
    return <Empty title="Staff and shop owners only"><span className="small muted">Sign in with a staff or shop owner account to manage businesses.</span></Empty>;
  }

  const businesses = data.businesses.filter((b) => isStaff || myBusinesses.has(b.id))
    .sort((a, b) => a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
  const orders = data.orders.filter((o) => isStaff || myBusinesses.has(o.businessId));
  const needHours = businesses.filter((b) => {
    if (!parseHours(b.openingHours)) return true;
    const age = hoursAgeDays(b, now);
    return age !== null && age > HOURS_STALE_DAYS;
  }).length;

  const businessList = (list: typeof businesses) => list.map((b) => (
    <button key={b.id} className="card" onClick={() => openSheet({ kind: 'editBusiness', id: b.id })}>
      <span className="ic"><Icon name={GROUPS[groupOf(b.category)].icon} /></span>
      <span className="body"><span className="name">{b.name}</span>
        <span className="meta">{b.town || 'No town'} · {parseHours(b.openingHours) ? 'hours on record' : 'no hours'}{b.sellsOnline ? ' · sells' : ''}{b.plan !== 'free' ? ` · ${b.plan}` : ''}</span>
        {!b.isActive && <span className="badge b-off" style={{ width: 'max-content' }}>Hidden</span>}</span>
      <Icon name="chev" />
    </button>
  ));

  // Shop owners: one simple page.
  if (!isStaff) {
    return (
      <>
        <h2>My business</h2>
        <div className="sos">
          <div><b>{businesses.length}</b><span>Your businesses</span></div>
          <div><b>{needHours}</b><span>Need hours checked</span></div>
          <div><b>{orders.filter((o) => o.status === 'sent').length}</b><span>New orders</span></div>
        </div>
        <section className="sec"><div className="sechead"><h3>Orders</h3><span>{orders.length} total</span></div><OrderList orders={orders} /></section>
        <section className="sec"><div className="sechead"><h3>Your businesses</h3><span>Tap to edit</span></div>{businessList(businesses)}</section>
      </>
    );
  }

  let body: JSX.Element;
  switch (tab) {
    case 'orders':
      body = <OrderList orders={orders.filter((o) => matches(q, o.shopName, o.customerName, o.customerPhone))} />;
      break;
    case 'businesses': {
      const list = businesses.filter((b) => matches(q, b.name, b.town, b.typeLabel, b.category));
      body = (
        <>
          <div className="btnrow">
            <button className="btn btn-mint" onClick={() => openSheet({ kind: 'import' })}><Icon name="upload" />Import a list</button>
            <button className="btn btn-ghost" onClick={() => openSheet({ kind: 'editBusiness', id: null })}><Icon name="plus" />Add a business</button>
          </div>
          {businessList(list)}
          {!list.length && <span className="small muted">Nothing matches.</span>}
        </>
      );
      break;
    }
    case 'listings': {
      const list = data.listings.filter((l) => matches(q, l.title, l.sellerName, l.town, l.phone));
      body = list.length ? <>{list.map((l) => (
        <button key={l.id} className="card" onClick={() => openSheet({ kind: 'editListing', id: l.id })}>
          <span className="thumb"><Icon name={LISTING_KINDS[l.kind].icon} /></span>
          <span className="body"><span className="name">{l.title}</span>
            <span className="meta">{rand(l.price)} · {l.sellerName} · {l.town} · {ago(minsSince(l.createdAt, now))}</span>
            {!l.isActive && <span className="badge b-off" style={{ width: 'max-content' }}>Hidden</span>}</span>
          <Icon name="chev" />
        </button>
      ))}</> : <span className="small muted">No listings.</span>;
      break;
    }
    case 'groups': {
      const list = data.groups.filter((g) => matches(q, g.title, g.subject, g.town, g.place));
      body = list.length ? <>{list.map((g) => (
        <button key={g.id} className="card" onClick={() => openSheet({ kind: 'editGroup', id: g.id })}>
          <span className="ic"><Icon name="book" /></span>
          <span className="body"><span className="name">{g.title}</span><span className="meta">{g.subject} · {g.grade} · {g.town} · {g.members.length} learner{g.members.length === 1 ? '' : 's'}</span></span>
          <Icon name="chev" />
        </button>
      ))}</> : <span className="small muted">No study groups.</span>;
      break;
    }
    case 'requests': {
      const list = data.requests.filter((r) => matches(q, r.businessName, r.contactName, r.town));
      body = list.length ? <>{list.map((r) => (
        <div key={r.id} className="card col">
          <div className="between full"><span className="name">{r.businessName}{r.town ? ` · ${r.town}` : ''}</span><span className={`badge ${r.status === 'done' ? 'b-off' : 'b-ver'}`}>{r.status === 'done' ? 'Handled' : 'New'}</span></div>
          <span className="meta">{PLANS.find((p) => p.id === r.plan)?.name} · {r.contactName} · {r.phone} · {ago(minsSince(r.at, now))}</span>
          {r.details && <span className="meta">{r.details}</span>}
          {r.status !== 'done' && <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={async () => {
            const res = await actions.markRequestDone(r.id); toast(res.ok ? 'Marked handled' : res.error); if (res.ok) refresh();
          }}>Mark handled</button>}
          {isAdmin && <DeleteButton label="Delete request" onDelete={async () => { const res = await actions.deleteRequest(r.id); toast(res.ok ? 'Request deleted' : res.error); if (res.ok) refresh(); }} />}
        </div>
      ))}</> : <span className="small muted">No plan requests.</span>;
      break;
    }
    case 'people': body = <PeopleTab />; break;
    case 'towns': body = <TownsTab />; break;
  }

  return (
    <>
      <h2>{isAdmin ? 'Super user' : 'Manage VillageLink'}</h2>
      <div className="sos">
        <div><b>{businesses.length}</b><span>Businesses</span></div>
        <div><b>{needHours}</b><span>Need hours checked</span></div>
        <div><b>{orders.filter((o) => o.status === 'sent').length}</b><span>New orders</span></div>
      </div>
      <div className="chips" role="tablist" aria-label="What to manage">
        {tabs.map((t) => (
          <button key={t} role="tab" className="chip" aria-pressed={tab === t} aria-selected={tab === t}
            onClick={() => { setQ(''); setParams({ tab: t }, { replace: true }); }}>{TAB_LABEL[t]}</button>
        ))}
      </div>
      {!['people', 'towns'].includes(tab) && (
        <input className="sel" aria-label={`Search ${TAB_LABEL[tab].toLowerCase()}`} placeholder={`Search ${TAB_LABEL[tab].toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <section className="sec">{body}</section>
    </>
  );
}
