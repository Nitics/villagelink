import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { PLANS } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { townLabel } from './Home';

export default function Profile() {
  const { user, profile, isStaff, isAdmin, myBusinesses, data, town, openSheet, needSignIn, toast } = useApp();
  const myShops = data.businesses.filter((b) => myBusinesses.has(b.id));
  const myRequests = data.requests.filter((r) => r.userId === user?.id);

  return (
    <>
      <h2>Profile</h2>
      <div className="box">
        <span className="eyebrow">Your account</span>
        {user ? (
          <>
            <span className="small"><b>{profile?.displayName || user.email}</b>{profile?.displayName ? ` · ${user.email}` : ''}</span>
            <span className="small muted">{isAdmin ? 'VillageLink super user' : isStaff ? 'VillageLink staff' : myShops.length ? `Owner of ${myShops.map((b) => b.name).join(', ')}` : 'Customer'}</span>
            <button className="btn btn-line btn-sm" style={{ alignSelf: 'flex-start' }} onClick={async () => { await supabase.auth.signOut(); toast('Signed out'); }}>Sign out</button>
          </>
        ) : (
          <>
            <span className="small">Sign in to order from shops, post listings, join study groups and report what’s open.</span>
            <button className="btn btn-mint btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => openSheet({ kind: 'auth' })}>Sign in or create an account</button>
          </>
        )}
      </div>

      <button className="area" onClick={() => openSheet({ kind: 'town' })}>
        <span className="eyebrow">Your area</span>
        <span className="row"><Icon name="pin" /><b style={{ flex: 1 }}>{townLabel(town)}</b><Icon name="chev" /></span>
      </button>

      <section className="stack">
        <h2>For local businesses</h2>
        <span className="small muted">Get found, show you’re open, and sell to your community. Plans are paid monthly by EFT or cash at a VillageLink agent.</span>
        <div className="plans">
          {PLANS.map((p) => (
            <div key={p.id} className="plan">
              <div className="between"><b>{p.name}</b><span className="p">{p.price}</span></div>
              <ul>{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
        <button className="btn btn-mint" onClick={() => { if (!needSignIn('plan')) openSheet({ kind: 'planRequest' }); }}><Icon name="store" />List my business or upgrade</button>
        {myRequests.length > 0 && (
          <div className="box"><span className="eyebrow">Your requests</span>
            {myRequests.map((r) => <span key={r.id} className="small">{r.businessName} · {r.plan} · {r.status === 'done' ? 'Handled' : 'We’ll contact you'}</span>)}
          </div>
        )}
      </section>

      <div className="box">
        <span className="eyebrow">Why statuses can be trusted</span>
        <span className="small">Only the business or VillageLink staff can confirm open or closed, and a confirmation expires after 3 hours. Opening hours older than 6 months count as unverified. Resident reports are shown with their time but never change a status on their own.</span>
      </div>
    </>
  );
}
