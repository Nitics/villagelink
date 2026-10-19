import { useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { Empty, OfflineBanner, OrderCard, StatusPill } from '../components/ui';
import { LISTING_KINDS } from '../lib/constants';
import { ago, hoursHint, minsSince, sortBusinesses, statusOf } from '../lib/hours';
import { rand } from '../lib/format';
import { actions } from '../lib/actions';
import type { ListingKind } from '../lib/types';
import { inTown, townLabel } from './Home';

type Tab = 'shops' | 'listings' | 'orders';

export default function Market() {
  const app = useApp();
  const { data, town, openSheet, now, user, needSignIn, toast, refresh } = app;
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'shops';
  const kind = (params.get('kind') as ListingKind | 'all') || 'all';
  const set = (p: Record<string, string>) => setParams({ tab, ...(kind !== 'all' ? { kind } : {}), ...p }, { replace: true });

  let body: JSX.Element;
  if (tab === 'shops') {
    const shops = data.businesses.filter((b) => b.isActive && b.sellsOnline).filter(inTown(town)).sort((a, b) => sortBusinesses(a, b, now));
    body = shops.length ? (
      <>{shops.map((b) => {
        const ps = data.products.filter((p) => p.businessId === b.id && p.inStock);
        return (
          <div key={b.id} className="card col">
            <div className="between full" style={{ alignItems: 'flex-start' }}>
              <span className="body"><span className="name">{b.name}</span><span className="meta">{b.town} · {hoursHint(b, now)}</span></span>
              <StatusPill status={statusOf(b, now)} />
            </div>
            <span className="meta">{ps.length ? ps.slice(0, 4).map((p) => `${p.name} ${rand(p.price)}`).join(' · ') + (ps.length > 4 ? ` · +${ps.length - 4} more` : '') : 'Products coming soon. You can still send an order request.'}</span>
            <button className="btn btn-mint btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openSheet({ kind: 'order', businessId: b.id })}><Icon name="bag" />Order for collection or delivery</button>
          </div>
        );
      })}</>
    ) : (
      <Empty title={`No shops taking orders in ${townLabel(town)} yet`}>
        <span className="small muted">Shops can start selling here with a VillageLink business plan.</span>
      </Empty>
    );
  } else if (tab === 'listings') {
    const list = data.listings.filter((l) => l.isActive).filter(inTown(town)).filter((l) => kind === 'all' || l.kind === kind);
    body = (
      <>
        <div className="chips" role="group" aria-label="Listing type">
          {(['all', ...Object.keys(LISTING_KINDS)] as (ListingKind | 'all')[]).map((k) => (
            <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setParams({ tab, ...(k === 'all' ? {} : { kind: k }) }, { replace: true })}>
              {k === 'all' ? 'All' : LISTING_KINDS[k].label}</button>
          ))}
        </div>
        <button className="btn btn-mint" onClick={() => { if (!needSignIn('post')) openSheet({ kind: 'newListing' }); }}><Icon name="plus" />Sell something or offer a service</button>
        <section className="sec">
          {list.length ? list.map((l) => (
            <button key={l.id} className="card" onClick={() => openSheet({ kind: 'listing', id: l.id })}>
              <span className="thumb"><Icon name={LISTING_KINDS[l.kind].icon} /></span>
              <span className="body"><span className="name">{l.title}</span>
                <span className="price">{rand(l.price)}{l.unit ? <span className="meta" style={{ fontFamily: 'var(--body)', fontWeight: 500 }}> {l.unit}</span> : null}</span>
                <span className="meta">{LISTING_KINDS[l.kind].label} · {l.town} · {ago(minsSince(l.createdAt, now))}</span></span>
            </button>
          )) : <Empty title={`No listings in ${townLabel(town)} yet`}><span className="small muted">Be the first to sell produce, second-hand goods or a service.</span></Empty>}
        </section>
      </>
    );
  } else {
    const mine = data.orders.filter((o) => o.customerId === user?.id);
    body = !user ? (
      <Empty title="Sign in to see your orders"><span className="small muted">Your orders and their status show here once you’re signed in.</span>
        <button className="btn btn-mint btn-sm" onClick={() => openSheet({ kind: 'auth' })}>Sign in</button></Empty>
    ) : mine.length ? (
      <>{mine.map((o) => (
        <OrderCard key={o.id} o={o}>
          {o.status === 'sent' && (
            <button className="btn btn-line btn-sm" style={{ alignSelf: 'flex-start' }} onClick={async () => {
              const r = await actions.cancelOrder(o.id);
              toast(r.ok ? 'Order cancelled' : r.error);
              if (r.ok) refresh();
            }}>Cancel order</button>
          )}
        </OrderCard>
      ))}</>
    ) : <Empty title="No orders yet"><span className="small muted">Orders you send to local shops show here with their status.</span></Empty>;
  }

  return (
    <>
      <OfflineBanner />
      <h2>Marketplace</h2>
      <div className="seg" role="group" aria-label="Market section">
        {([['shops', 'Shop local'], ['listings', 'Buy & sell'], ['orders', 'My orders']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => set({ tab: k })}>{l}</button>
        ))}
      </div>
      {body}
    </>
  );
}
