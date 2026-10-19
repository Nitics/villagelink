import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { Icon } from '../components/Icon';
import { BusinessCard, Empty, OfflineBanner, StatusPill } from '../components/ui';
import { GROUPS, groupOf, type Group } from '../lib/constants';
import { DAYS, clock, sortBusinesses, statusOf } from '../lib/hours';
import type { Business, Status } from '../lib/types';
import { inTown, townLabel } from './Home';

export default function Services() {
  const { data, town, openSheet, now } = useApp();
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') as Group | null) ?? 'all';
  const [showClosed, setShowClosed] = useState(false);

  const list = data.businesses.filter((b) => b.isActive).filter(inTown(town))
    .filter((b) => type === 'all' || groupOf(b.category) === type)
    .sort((a, b) => sortBusinesses(a, b, now));
  const by: Record<Status, Business[]> = { confirmed: [], expected: [], unverified: [], closedConfirmed: [], closed: [] };
  list.forEach((b) => by[statusOf(b, now)].push(b));
  const closed = [...by.closedConfirmed, ...by.closed];
  const c = clock(now);

  const Section = ({ k, title, hint }: { k: Status; title: string; hint: string }) =>
    by[k].length ? (
      <section className="sec">
        <div className="sechead"><h3>{title}</h3><span>{hint}</span></div>
        {by[k].map((b) => <BusinessCard key={b.id} b={b} />)}
      </section>
    ) : null;

  return (
    <>
      <OfflineBanner />
      <div className="stack">
        <div className="between"><h2>Open in {townLabel(town)}</h2>
          <button className="btn btn-line btn-sm" onClick={() => openSheet({ kind: 'town' })}><Icon name="pin" />Change</button></div>
        <span className="small muted">Checked against {DAYS[c.day]} {c.label} SAST.</span>
      </div>
      <div className="chips" role="group" aria-label="Service type">
        {(['all', ...Object.keys(GROUPS)] as (Group | 'all')[]).map((g) => (
          <button key={g} className="chip" aria-pressed={type === g}
            onClick={() => setParams(g === 'all' ? {} : { type: g }, { replace: true })}>{g === 'all' ? 'All' : GROUPS[g].label}</button>
        ))}
      </div>
      <details className="legend">
        <summary>How we decide what’s open <span className="chev"><Icon name="chev" /></span></summary>
        <dl>
          <div><dt><StatusPill status="confirmed" /></dt><dd>The business confirmed it’s open in the last 3 hours.</dd></div>
          <div><dt><StatusPill status="expected" /></dt><dd>Published hours say it’s open now, but nobody has confirmed today. Call ahead for long trips.</dd></div>
          <div><dt><StatusPill status="unverified" /></dt><dd>Hours are missing or more than 6 months old. Resident reports are shown but don’t change the status.</dd></div>
          <div><dt><StatusPill status="closedConfirmed" /></dt><dd>The business said it’s closed, even if the hours say otherwise.</dd></div>
        </dl>
      </details>
      {!list.length && <Empty title="Nothing listed here yet"><span className="small muted">Try another type, or choose “All of Nkomazi”.</span></Empty>}
      <Section k="confirmed" title="Confirmed open" hint="Most reliable" />
      <Section k="expected" title="Expected open" hint="From opening hours" />
      <Section k="unverified" title="Status unverified" hint="Call before you travel" />
      {closed.length ? (
        <section className="sec">
          <button className="btn btn-line" onClick={() => setShowClosed(!showClosed)}>{showClosed ? 'Hide' : 'Show'} {closed.length} closed</button>
          {showClosed && closed.map((b) => <BusinessCard key={b.id} b={b} />)}
        </section>
      ) : null}
    </>
  );
}
