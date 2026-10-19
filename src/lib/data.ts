// Loads everything the app shows from Supabase and maps it to app shapes.
import { supabase } from './supabase';
import { REPORT_WINDOW_MIN } from './constants';
import type { Business, Listing, Order, PlanRequest, Product, Report, StudyGroup } from './types';

export interface Data {
  businesses: Business[];
  products: Product[];
  listings: Listing[];
  groups: StudyGroup[];
  reports: Record<string, Report>;
  orders: Order[]; // every order this account may see (own, own shop's, or all for staff)
  requests: PlanRequest[];
  towns: string[]; // from the towns table, in order
}

export const emptyData = (): Data => ({ businesses: [], products: [], listings: [], groups: [], reports: {}, orders: [], requests: [], towns: [] });

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapBusiness(r: any): Business {
  return {
    id: r.id, name: r.name, category: r.category, typeLabel: r.type_label ?? '', town: r.town ?? '',
    address: r.address ?? '', phone: r.phone ?? '', whatsapp: r.whatsapp ?? '', openingHours: r.opening_hours ?? '',
    hoursChecked: r.hours_checked ?? '', sellsOnline: !!r.sells_online, plan: r.plan ?? 'free',
    latitude: r.latitude ?? null, longitude: r.longitude ?? null, description: r.description ?? '',
    isActive: r.is_active !== false, createdAt: r.created_at ?? '',
    confirmation: r.confirmed_at ? { at: Date.parse(r.confirmed_at), open: !!r.confirmed_open, note: r.confirmed_note ?? '' } : null,
  };
}

export const mapProduct = (p: any): Product => ({
  id: p.id, businessId: p.business_id, name: p.name, price: +p.price, unit: p.unit ?? '', inStock: !!p.in_stock,
});

export interface LoadResult { data: Data; failed: boolean }

export async function loadAll(userId: string | null): Promise<LoadResult> {
  const since = new Date(Date.now() - REPORT_WINDOW_MIN * 6e4).toISOString();
  const queries: PromiseLike<{ data: any; error: any }>[] = [
    supabase.from('businesses').select('*').order('name'),
    supabase.from('products').select('*').order('sort_order').order('name'),
    // Everyone gets active listings; staff also get hidden ones (database rules decide).
    supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(400),
    supabase.from('study_groups').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('group_members').select('group_id,user_id').limit(5000),
    supabase.from('status_reports').select('business_id,is_open,created_at').gte('created_at', since).order('created_at', { ascending: false }),
    supabase.from('towns').select('name').order('sort_order').order('name'),
  ];
  if (userId) {
    queries.push(supabase.from('orders').select('*,order_items(product_name,unit_price,qty)').order('created_at', { ascending: false }).limit(200));
    queries.push(supabase.from('plan_requests').select('*').order('created_at', { ascending: false }).limit(200));
  }
  const r = await Promise.all(queries);
  const failed = r.some((x) => x.error);
  if (failed) console.warn('VillageLink: some data failed to load', r.find((x) => x.error)?.error);

  const businesses = (r[0].data ?? []).map(mapBusiness);
  const nameOf = (id: string) => businesses.find((b: Business) => b.id === id)?.name ?? 'Shop';
  const members: Record<string, string[]> = {};
  for (const m of r[4].data ?? []) (members[m.group_id] ||= []).push(m.user_id);
  const reports: Record<string, Report> = {};
  for (const x of r[5].data ?? []) if (!reports[x.business_id]) reports[x.business_id] = { at: Date.parse(x.created_at), open: !!x.is_open };

  const data: Data = {
    businesses,
    products: (r[1].data ?? []).map(mapProduct),
    listings: (r[2].data ?? []).map((l: any): Listing => ({
      id: l.id, kind: l.kind, title: l.title, price: +l.price, unit: l.unit ?? '', town: l.town ?? '', sellerName: l.seller_name,
      phone: l.phone, note: l.note ?? '', ownerId: l.owner_id, createdAt: Date.parse(l.created_at), isActive: l.is_active !== false,
    })),
    groups: (r[3].data ?? []).map((g: any): StudyGroup => ({
      id: g.id, subject: g.subject, grade: g.grade, title: g.title, place: g.place, isOnline: !!g.is_online,
      nextSession: g.next_session, town: g.town ?? '', contact: g.contact ?? '', ownerId: g.owner_id, members: members[g.id] ?? [],
    })),
    reports,
    towns: (r[6].data ?? []).map((t: { name: string }) => t.name),
    orders: userId ? (r[7].data ?? []).map((o: any): Order => ({
      id: o.id, businessId: o.business_id, shopName: nameOf(o.business_id), customerId: o.customer_id,
      customerName: o.customer_name, customerPhone: o.customer_phone, method: o.method, deliveryAddress: o.delivery_address ?? '',
      note: o.note ?? '', status: o.status, total: +o.total, at: Date.parse(o.created_at),
      items: (o.order_items ?? []).map((i: any) => ({ name: i.product_name, price: +i.unit_price, qty: i.qty })),
    })) : [],
    requests: userId ? (r[8].data ?? []).map((x: any): PlanRequest => ({
      id: x.id, businessName: x.business_name, town: x.town ?? '', plan: x.plan, contactName: x.contact_name, phone: x.phone,
      details: x.details ?? '', status: x.status, at: Date.parse(x.created_at), userId: x.user_id,
    })) : [],
  };
  return { data, failed };
}

/* ----- offline copy: the last businesses and products this phone loaded ----- */
const SAVED_KEY = 'villagelink.saved.v1';

export function saveOffline(d: Data) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify({ at: Date.now(), businesses: d.businesses, products: d.products, towns: d.towns })); } catch { /* storage full or blocked */ }
}

export function loadOffline(): { at: number; data: Data } | null {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return { at: s.at, data: { ...emptyData(), businesses: s.businesses ?? [], products: s.products ?? [], towns: s.towns ?? [] } };
  } catch { return null; }
}

/** Turns a database or network error into words for the person using the app. */
export function friendlyError(e: { message?: string; code?: string } | null | undefined): string {
  const m = String(e?.message ?? '');
  const code = String(e?.code ?? '');
  if (/row-level security|permission denied/.test(m) || code === '42501') return 'You don’t have permission to do that.';
  if (/duplicate key/.test(m) || code === '23505') return 'That already exists.';
  if (code === '23503' || /foreign key/.test(m)) return 'This is still in use, so it can’t be removed. Move or remove what uses it first.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection. Try again when you have signal.';
  // Messages raised by VillageLink's own database functions are written for people.
  if (['22023', '28000', 'P0001'].includes(code) && m) return m;
  return 'Couldn’t save. Try again.';
}
