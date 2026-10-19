// VillageLink assistant: answers questions about Nkomazi services from live data, and helps learners.
// Secrets: ANTHROPIC_API_KEY (required). Optional: ASSISTANT_MODEL, ASSISTANT_DAILY_LIMIT.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { STATUS_LABEL, hoursHint, statusOf, verifyLine, type Business } from './hours.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const RULES = {
  local: `You are VillageLink, a helpful assistant for people in the Nkomazi Local Municipality, Mpumalanga, South Africa (towns like Malelane, Komatipoort, KaMaqhekeza, Tonga, Kamhlushwa, Schoemansdal, Mbuzini).
Answer questions about which fuel stations, shops, clinics, pharmacies, police stations and other services are open, what local shops sell, the community marketplace and study groups.
Rules:
- Use ONLY the VillageLink data below. Never invent businesses, phone numbers, prices or hours.
- Always say how sure a status is: "confirmed open" (the business confirmed recently), "expected open" (from opening hours only) or "unverified". For long trips, suggest phoning first.
- If nothing matches, say so plainly and suggest the closest alternative from the data.
- In an emergency, give 10111 (police), 10177 (ambulance) and 112 (from a cellphone) first.
- Reply in the language the person writes in (English, siSwati, Xitsonga, isiZulu, Afrikaans and others are fine).
- Keep answers short and easy to read on a phone: plain text, short lines, no tables, no markdown headings.`,
  school: `You are VillageLink Homework Help, a patient tutor for South African learners following the CAPS curriculum.
Rules:
- Teach, don't just hand over answers. Explain the idea, show the steps, then give the learner a similar question to try.
- For maths and science, show working line by line with units. Use plain-text maths (x^2, sqrt(9), 3/4).
- Match the learner's grade. Use simple English, or reply in the learner's language if they write in siSwati, Xitsonga, isiZulu or another language.
- If it looks like a test or exam being written right now, help them understand the concept instead of giving final answers.
- Be encouraging and brief. Plain text only, no tables.`,
};

type Msg = { role: 'user' | 'assistant'; content: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

  // 1. Who is asking? Signed-in people only.
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who } = await userClient.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!who?.user) return reply({ error: 'Sign in to ask VillageLink a question.', code: 'signin' }, 401);

  if (!apiKey) return reply({ error: 'The assistant isn’t switched on yet.', code: 'not_configured' }, 503);

  // 2. The question.
  let body: { mode?: string; grade?: string; town?: string; messages?: Msg[] };
  try { body = await req.json(); } catch { return reply({ error: 'Send a question.' }, 400); }
  const mode = body.mode === 'school' ? 'school' : 'local';
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return reply({ error: 'Send a question.' }, 400);

  // 3. Daily limit per person.
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const limit = Number(Deno.env.get('ASSISTANT_DAILY_LIMIT') ?? 30);
  const { data: allowed, error: quotaErr } = await admin.rpc('use_assistant_question', { p_user: who.user.id, p_limit: limit });
  if (quotaErr) return reply({ error: 'Something went wrong. Try again.' }, 500);
  if (!allowed) return reply({ error: `You’ve asked ${limit} questions today. Try again tomorrow.`, code: 'limit' }, 429);

  // 4. Context.
  const now = new Date();
  const timeText = new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  let system = RULES[mode] + `\nRight now it is ${timeText} (South African time).`;
  if (mode === 'school') system += `\nThe learner is in ${String(body.grade ?? 'high school').slice(0, 30)}.`;
  if (mode === 'local') {
    const town = String(body.town ?? 'all').slice(0, 40);
    system += `\nThe person's chosen area: ${town === 'all' ? 'all of Nkomazi' : town}. Prefer places there, but mention nearby towns when useful.`;
    const [biz, products, listings, groups] = await Promise.all([
      userClient.from('businesses').select('id,name,category,type_label,town,address,phone,opening_hours,hours_checked,sells_online,plan,confirmed_open,confirmed_at,confirmed_note,created_at').limit(400),
      userClient.from('products').select('business_id,name,price,unit,in_stock').limit(600),
      userClient.from('listings').select('kind,title,price,unit,town,seller_name,phone').eq('is_active', true).order('created_at', { ascending: false }).limit(80),
      userClient.from('study_groups').select('subject,grade,title,place,town,next_session,contact').limit(80),
    ]);
    const names: Record<string, string> = {};
    const places = (biz.data ?? []).map((r) => {
      names[r.id] = r.name;
      const b: Business = {
        name: r.name, openingHours: r.opening_hours ?? '', hoursChecked: r.hours_checked ?? '', createdAt: r.created_at ?? '', plan: r.plan,
        confirmation: r.confirmed_at ? { at: Date.parse(r.confirmed_at), open: !!r.confirmed_open, note: r.confirmed_note ?? '' } : null,
      };
      return {
        name: r.name, type: r.type_label || r.category, town: r.town, address: r.address, phone: r.phone,
        status: STATUS_LABEL[statusOf(b)], how_we_know: verifyLine(b), hours: hoursHint(b), note: b.confirmation?.note || undefined,
        takes_orders_in_app: r.sells_online || undefined,
      };
    });
    const shopItems = (products.data ?? []).map((p) => ({ shop: names[p.business_id], product: p.name, price_rand: +p.price, unit: p.unit, in_stock: p.in_stock }));
    system += '\n\nVillageLink data (JSON):\n' + JSON.stringify({ places, shop_products: shopItems, marketplace: listings.data ?? [], study_groups: groups.data ?? [] }).slice(0, 80000);
  }

  // 5. Ask Claude.
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: Deno.env.get('ASSISTANT_MODEL') ?? 'claude-haiku-5-5', max_tokens: 900, system, messages }),
  });
  if (!r.ok) {
    console.error('Anthropic error', r.status, await r.text());
    return reply({ error: 'The assistant is busy. Try again in a minute.' }, 502);
  }
  const out = await r.json();
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n').trim();
  return reply({ text: text || 'Sorry, I don’t have an answer for that.' });
});
