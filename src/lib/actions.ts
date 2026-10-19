// Every change the app makes to the database, in one place.
import { supabase } from './supabase';
import { friendlyError } from './data';
import type { BusinessRow } from './csv';
import type { ListingKind, OrderStatus, Plan } from './types';

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

async function run<T = void>(p: PromiseLike<{ data: unknown; error: unknown }>, pick?: (d: any) => T): Promise<Result<T>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const { data, error } = await p;
    if (error) return { ok: false, error: friendlyError(error as { message?: string; code?: string }) };
    return { ok: true, value: (pick ? pick(data) : undefined) as T };
  } catch (e) {
    return { ok: false, error: friendlyError(e as Error) };
  }
}

export const actions = {
  report: (businessId: string, isOpen: boolean) =>
    run(supabase.from('status_reports').insert({ business_id: businessId, is_open: isOpen })),

  confirmStatus: (businessId: string, open: boolean, note: string) =>
    run(supabase.rpc('confirm_business_status', { p_business_id: businessId, p_open: open, p_note: note || null })),

  placeOrder: (o: { businessId: string; name: string; phone: string; method: 'collect' | 'delivery'; address: string; note: string; items: { productId: string; qty: number }[] }) =>
    run<string>(supabase.rpc('place_order', {
      p_business_id: o.businessId, p_customer_name: o.name, p_customer_phone: o.phone, p_method: o.method,
      p_delivery_address: o.address || null, p_note: o.note || null,
      p_items: o.items.map((i) => ({ product_id: i.productId, qty: i.qty })),
    }), (d) => d as string),

  cancelOrder: (orderId: string) => run(supabase.rpc('cancel_order', { p_order_id: orderId })),

  setOrderStatus: (orderId: string, status: OrderStatus) => run(supabase.rpc('set_order_status', { p_order_id: orderId, p_status: status })),

  postListing: (l: { kind: ListingKind; title: string; price: number; unit: string; town: string; sellerName: string; phone: string; note: string }) =>
    run(supabase.from('listings').insert({
      kind: l.kind, title: l.title, price: l.price, unit: l.unit || null, town: l.town || null,
      seller_name: l.sellerName, phone: l.phone, note: l.note || null,
    })),

  removeListing: (id: string) => run(supabase.from('listings').delete().eq('id', id)),

  async createGroup(g: { subject: string; grade: string; title: string; place: string; isOnline: boolean; nextSession: string; town: string; contact: string }): Promise<Result> {
    const created = await run<string>(supabase.from('study_groups').insert({
      subject: g.subject, grade: g.grade, title: g.title, place: g.place, is_online: g.isOnline,
      next_session: g.nextSession, town: g.town || null, contact: g.contact || null,
    }).select('id').single(), (d) => d.id);
    if (!created.ok) return created;
    return run(supabase.from('group_members').insert({ group_id: created.value }));
  },

  joinGroup: (groupId: string) => run(supabase.from('group_members').insert({ group_id: groupId })),
  leaveGroup: (groupId: string, userId: string) => run(supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)),

  requestPlan: (r: { businessName: string; town: string; plan: Plan; contactName: string; phone: string; details: string }) =>
    run(supabase.from('plan_requests').insert({
      business_name: r.businessName, town: r.town || null, plan: r.plan, contact_name: r.contactName, phone: r.phone, details: r.details || null,
    })),

  markRequestDone: (id: string) => run(supabase.from('plan_requests').update({ status: 'done' }).eq('id', id)),

  // Staff: any field. Returns the business id.
  saveBusiness: (id: string | null, row: BusinessRow) =>
    run<string>(id
      ? supabase.from('businesses').update(row).eq('id', id).select('id').single()
      : supabase.from('businesses').insert(row).select('id').single(), (d) => d.id),

  // Shop owners: everyday details only.
  updateBusinessDetails: (id: string, d: { phone: string; whatsapp: string; address: string; openingHours: string; description: string }) =>
    run(supabase.rpc('update_business_details', {
      p_business_id: id, p_phone: d.phone, p_whatsapp: d.whatsapp, p_address: d.address,
      p_opening_hours: d.openingHours, p_description: d.description,
    })),

  deleteBusiness: (id: string) => run(supabase.from('businesses').delete().eq('id', id)),

  async importBusinesses(rows: BusinessRow[], existing: { id: string; name: string; town: string }[]): Promise<Result<{ added: number; updated: number }>> {
    let added = 0, updated = 0;
    const fresh: BusinessRow[] = [];
    for (const row of rows) {
      const ex = existing.find((b) => b.name.toLowerCase() === row.name.toLowerCase() && (b.town || '') === (row.town || ''));
      if (ex) {
        const r = await run(supabase.from('businesses').update(row).eq('id', ex.id));
        if (!r.ok) return { ok: false, error: `Stopped at “${row.name}”: ${r.error}` };
        updated++;
      } else fresh.push(row);
    }
    for (let i = 0; i < fresh.length; i += 200) {
      const r = await run(supabase.from('businesses').insert(fresh.slice(i, i + 200)));
      if (!r.ok) return { ok: false, error: `Saved ${added} new businesses, then stopped: ${r.error}` };
      added += Math.min(200, fresh.length - i);
    }
    return { ok: true, value: { added, updated } };
  },

  addProduct: (p: { businessId: string; name: string; price: number; unit: string }) =>
    run(supabase.from('products').insert({ business_id: p.businessId, name: p.name, price: p.price, unit: p.unit || null })),
  setInStock: (id: string, inStock: boolean) => run(supabase.from('products').update({ in_stock: inStock }).eq('id', id)),
  removeProduct: (id: string) => run(supabase.from('products').delete().eq('id', id)),
};
