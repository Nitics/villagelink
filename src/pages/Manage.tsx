import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { Empty, OrderCard, ORDER_STATUS } from '../components/ui';
import { GROUPS, HOURS_STALE_DAYS, PLANS, groupOf } from '../lib/constants';
import { ago, hoursAgeDays, minsSince, parseHours } from '../lib/hours';
import { actions } from '../lib/actions';
import type { OrderStatus } from '../lib/types';

export default function Manage() {
  const { data, isStaff, myBusinesses, user, openSheet, toast, refresh, now } = useApp();
  if (!user || (!isStaff && !myBusinesses.size)) {
    return <Empty title="Staff and shop owners only"><span className="small muted">Sign in with a staff or shop owner account to manage businesses.</span></Empty>;
  }
  const businesses = data.businesses.filter((b) => isStaff || myBusinesses.has(b.id))
    .sort((a, b) => a.town.localeCompare(b.town) || a.name.localeCompare(b.name));
  const orders = data.orders.filter((o) => isStaff || myBusinesses.has(o.businessId));
  const requests = isStaff ? data.requests.filter((r) => r.status !== 'done') : [];
  const needHours = businesses.filter((b) => {
    if (!parseHours(b.openingHours)) return true;
    const age = hoursAgeDays(b, now);
    return age !== null && age > HOURS_STALE_DAYS;
  }).length;

  const setStatus = async (id: string, s: OrderStatus) => {
    const r = await actions.setOrderStatus(id, s);
    toast(r.ok ? 'Order updated' : r.error);
    if (r.ok) refresh();
  };

  return (
    <>
      <h2>{isStaff ? 'Manage VillageLink' : 'My business'}</h2>
      <div className="sos">
        <div><b>{businesses.length}</b><span>{isStaff ? 'Businesses' : 'Your businesses'}</span></div>
        <div><b>{needHours}</b><span>Need hours checked</span></div>
        <div><b>{orders.filter((o) => o.status === 'sent').length}</b><span>New orders</span></div>
      </div>
      {isStaff && (
        <div className="btnrow">
          <button className="btn btn-mint" onClick={() => openSheet({ kind: 'import' })}><Icon name="upload" />Import a list</button>
          <button className="btn btn-ghost" onClick={() => openSheet({ kind: 'editBusiness', id: null })}><Icon name="plus" />Add a business</button>
        </div>
      )}

      <section className="sec">
        <div className="sechead"><h3>Orders</h3><span>{orders.length} total</span></div>
        {orders.length ? orders.slice(0, 50).map((o) => (
          <OrderCard key={o.id} o={o}>
            <span className="meta">Customer: {o.customerName} · {o.customerPhone}{o.note && o.items.length ? ` · “${o.note}”` : ''}</span>
            {!['done', 'declined', 'cancelled'].includes(o.status) && (
              <div className="btnrow">
                {(['accepted', 'ready', 'done', 'declined'] as OrderStatus[]).map((s) => (
                  <button key={s} className="btn btn-ghost btn-sm" aria-pressed={o.status === s} onClick={() => setStatus(o.id, s)}>{ORDER_STATUS[s]}</button>
                ))}
              </div>
            )}
          </OrderCard>
        )) : <span className="small muted">No orders yet.</span>}
      </section>

      {isStaff && (
        <section className="sec">
          <div className="sechead"><h3>Plan requests</h3><span>{requests.length} open</span></div>
          {requests.length ? requests.map((r) => (
            <div key={r.id} className="card col">
              <span className="name">{r.businessName}{r.town ? ` · ${r.town}` : ''}</span>
              <span className="meta">{PLANS.find((p) => p.id === r.plan)?.name} · {r.contactName} · {r.phone} · {ago(minsSince(r.at, now))}</span>
              {r.details && <span className="meta">{r.details}</span>}
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={async () => {
                const res = await actions.markRequestDone(r.id);
                toast(res.ok ? 'Marked handled' : res.error);
                if (res.ok) refresh();
              }}>Mark handled</button>
            </div>
          )) : <span className="small muted">No open requests.</span>}
        </section>
      )}

      <section className="sec">
        <div className="sechead"><h3>{isStaff ? 'All businesses' : 'Your businesses'}</h3><span>Tap to edit</span></div>
        {businesses.map((b) => (
          <button key={b.id} className="card" onClick={() => openSheet({ kind: 'editBusiness', id: b.id })}>
            <span className="ic"><Icon name={GROUPS[groupOf(b.category)].icon} /></span>
            <span className="body"><span className="name">{b.name}{b.isActive ? '' : ' (hidden)'}</span>
              <span className="meta">{b.town || 'No town'} · {parseHours(b.openingHours) ? 'hours on record' : 'no hours'}{b.sellsOnline ? ' · sells' : ''}{b.plan !== 'free' ? ` · ${b.plan}` : ''}</span></span>
            <Icon name="chev" />
          </button>
        ))}
      </section>
    </>
  );
}
