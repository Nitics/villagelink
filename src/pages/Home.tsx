import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { Empty, OfflineBanner } from '../components/ui';
import { GROUPS, groupOf, type Group } from '../lib/constants';
import { statusOf } from '../lib/hours';
import type { Business, Status } from '../lib/types';

export const townLabel = (town: string) => (town === 'all' ? 'All of Nkomazi' : town);
export const inTown = (town: string) => (x: { town: string }) => town === 'all' || x.town === town;

export function countStatuses(list: Business[], now: number) {
  const o: Record<Status, number> = { confirmed: 0, expected: 0, unverified: 0, closedConfirmed: 0, closed: 0 };
  list.forEach((b) => o[statusOf(b, now)]++);
  return o;
}

export default function Home() {
  const { data, loaded, town, openSheet, now, isStaff } = useApp();
  const navigate = useNavigate();
  const list = data.businesses.filter((b) => b.isActive).filter(inTown(town));
  const n = countStatuses(list, now);
  const sellers = list.filter((b) => b.sellsOnline).length;
  const groups = data.groups.filter(inTown(town)).length;

  const Tile = ({ g }: { g: Group }) => {
    const sub = list.filter((b) => groupOf(b.category) === g);
    const c = countStatuses(sub, now);
    const open = c.confirmed + c.expected;
    const color = c.confirmed ? 'var(--ok)' : c.expected ? 'var(--warn)' : 'var(--off)';
    return (
      <button className="tile" onClick={() => navigate(`/services?type=${g}`)}>
        <Icon name={GROUPS[g].icon} /><b>{GROUPS[g].label}</b><span>{GROUPS[g].sub}</span>
        <span className="live"><span className="dot" style={{ color }} />{sub.length ? `${open} of ${sub.length} likely open` : 'None listed yet'}</span>
      </button>
    );
  };

  return (
    <>
      <OfflineBanner />
      <button className="area" onClick={() => openSheet({ kind: 'town' })}>
        <span className="eyebrow">Your area</span>
        <span className="row"><Icon name="pin" /><span style={{ flex: 1, minWidth: 0 }}><b>{townLabel(town)}</b><br /><span className="small muted">Tap to choose your town or village</span></span><Icon name="chev" /></span>
      </button>

      {!loaded ? <Empty title="Loading Nkomazi businesses…" /> : !data.businesses.length ? (
        <Empty title="No businesses added yet">
          <span className="small muted">{isStaff ? 'Add businesses from Manage, or import your whole list.' : 'The VillageLink team is adding Nkomazi businesses. Check back soon.'}</span>
        </Empty>
      ) : (
        <Link className="now" to="/services">
          <span className="row"><Icon name="clock" /><b style={{ flex: 1 }}>What’s open near me right now?</b><Icon name="chev" /></span>
          <span className="counts">
            <span className="c">{n.confirmed} confirmed open</span>
            <span className="c">{n.expected} expected open</span>
            <span className="c">{n.unverified} unverified</span>
          </span>
        </Link>
      )}

      <section className="stack">
        <h2>What do you need today?</h2>
        <div className="tiles">
          {(['fuel', 'shop', 'health', 'police'] as Group[]).map((g) => <Tile key={g} g={g} />)}
          <Link className="tile" to="/market"><Icon name="store" /><b>Marketplace</b><span>Order from shops, buy and sell</span>
            <span className="live"><span className="dot" style={{ color: 'var(--accent)' }} />{sellers} shop{sellers === 1 ? '' : 's'} taking orders</span></Link>
          <Link className="tile" to="/study"><Icon name="book" /><b>Study hub</b><span>Groups and homework help</span>
            <span className="live"><span className="dot" style={{ color: 'var(--accent)' }} />{groups} study group{groups === 1 ? '' : 's'}</span></Link>
        </div>
      </section>

      <Link className="card" to="/ask"><span className="ic"><Icon name="spark" /></span>
        <span className="body"><span className="name">Ask VillageLink</span><span className="meta">“Where can I get diesel now?” or “Explain photosynthesis for Grade 10.”</span></span><Icon name="chev" /></Link>

      <section className="stack">
        <div className="between"><h2>Emergency numbers</h2><span className="small muted">Free from any phone</span></div>
        <div className="sos"><div><b>10111</b><span>Police</span></div><div><b>10177</b><span>Ambulance</span></div><div><b>112</b><span>From a cellphone</span></div></div>
      </section>
    </>
  );
}
