import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useApp } from '../state/AppContext';
import { GROUPS, groupOf } from '../lib/constants';
import { STATUS_LABEL, ago, hoursHint, minsSince, statusOf, verifyLine } from '../lib/hours';
import { rand } from '../lib/format';
import type { Business, Order, Status } from '../lib/types';

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill s-${status}`}><span className="dot" />{STATUS_LABEL[status]}</span>;
}

export function PlanBadge({ plan }: { plan: string }) {
  if (plan === 'featured') return <span className="badge b-feat">Featured</span>;
  if (plan === 'verified') return <span className="badge b-ver">Verified</span>;
  return null;
}

export function OfflineBanner() {
  const { offlineAt } = useApp();
  if (!offlineAt) return null;
  return <div className="banner"><span>No signal. Showing businesses as they were {ago(minsSince(offlineAt))}. Statuses may have changed.</span></div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}

export function BusinessCard({ b }: { b: Business }) {
  const { openSheet, now } = useApp();
  const st = statusOf(b, now);
  return (
    <button className="card" onClick={() => openSheet({ kind: 'business', id: b.id })}>
      <span className="ic"><Icon name={GROUPS[groupOf(b.category)].icon} /></span>
      <span className="body">
        <span className="between" style={{ alignItems: 'flex-start' }}><span className="name">{b.name}</span><PlanBadge plan={b.plan} /></span>
        <span className="meta">{b.typeLabel}{b.town ? ` · ${b.town}` : ''}</span>
        <StatusPill status={st} />
        <span className="meta">{verifyLine(b, now)}</span>
        <span className="meta">{hoursHint(b, now)}{b.sellsOnline ? ' · takes orders' : ''}</span>
      </span>
    </button>
  );
}

export const ORDER_STATUS: Record<string, string> = {
  sent: 'Sent to shop', accepted: 'Accepted', ready: 'Ready', done: 'Collected or delivered', declined: 'Declined', cancelled: 'Cancelled',
};

export function OrderCard({ o, children }: { o: Order; children?: ReactNode }) {
  return (
    <div className="card col">
      <div className="between full"><span className="name">{o.shopName}</span><span className={`badge ${o.status === 'declined' || o.status === 'cancelled' ? 'b-off' : 'b-ver'}`}>{ORDER_STATUS[o.status]}</span></div>
      <span className="meta">{o.items.length ? o.items.map((i) => `${i.qty} × ${i.name}`).join(', ') : o.note || 'Order request'}</span>
      <span className="meta">
        {o.items.length ? `${rand(o.total)} · ` : ''}
        {o.method === 'delivery' ? `Delivery to ${o.deliveryAddress}` : 'Collect at shop'} · pay {o.method === 'delivery' ? 'on delivery' : 'on collection'} · {ago(minsSince(o.at))}
      </span>
      {children}
    </div>
  );
}

export function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <label className="field" htmlFor={id}>{label}{children}</label>;
}

export function SheetHeader({ title, eyebrow }: { title?: string; eyebrow?: string }) {
  const { closeSheet } = useApp();
  return (
    <>
      <div className="between">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : <h2>{title}</h2>}
        <button className="iconbtn" onClick={closeSheet} aria-label="Close"><Icon name="x" /></button>
      </div>
      {eyebrow && title ? <h2>{title}</h2> : null}
    </>
  );
}

export function CopyNumber({ value }: { value: string }) {
  const { toast } = useApp();
  if (!value) return null;
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => toast('Copied'), () => toast('Select the number to copy it'));
  };
  return (
    <div className="contact"><Icon name="phone" /><span className="num">{value}</span>
      <button className="btn btn-ghost btn-sm" onClick={copy}>Copy</button></div>
  );
}
