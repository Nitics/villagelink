// VillageLink's built-in agent: answers everyday questions from the live database, with no AI service.
// It is deliberately predictable: it only ever repeats what is in the data, and always says how sure a status is.
import { LISTING_KINDS, groupOf, type Group } from './constants';
import { DAYS, STATUS_LABEL, clock, fmtMin, hoursHint, isOpenish, parseHours, sortBusinesses, statusOf, verifyLine } from './hours';
import { rand } from './format';
import type { Data } from './data';
import type { Business } from './types';

export type ResultRef = { kind: 'business' | 'listing' | 'group'; id: string; label: string };
export interface AgentAnswer { text: string; results: ResultRef[]; understood: boolean }
export interface AgentContext { now: number; town: string; towns: string[]; userId: string | null }

/* ---------- reading the question ---------- */

const CATEGORY_WORDS: [Group | 'bank' | 'post' | 'school', RegExp][] = [
  ['fuel', /\b(fuel|petrol|diesel|garage|filling|gas station|unleaded|paraffin|uphethiloli|phethiloli|petirole)\b/],
  ['health', /\b(clinic|clinics|pharmacy|pharmacies|chemist|hospital|doctor|doctors|nurse|medicine|medication|pills|sick|ikliniki|kliniki|xibedlhele|sibhedlela)\b/],
  ['police', /\b(police|cop|cops|saps|crime|stolen|robbed|mapholisa|maphoyisa)\b/],
  ['shop', /\b(shop|shops|spaza|spazas|supermarket|store|stores|groceries|grocery|tuck ?shop|butcher|bakery|hardware|sitolo|xitolo)\b/],
  ['bank', /\b(bank|banks|atm|cash ?point)\b/],
  ['post', /\b(post office|post|sassa)\b/],
  ['school', /\b(school|schools)\b/],
];
const EMERGENCY = /\b(emergency|ambulance|accident|bleeding|fire|dying|heart attack|unconscious|attack|attacked|rape|urgent|ngicela usizo|siza)\b/;
const GREETING = /^(hi|hello|hey|hallo|sawubona|sanibonani|avuxeni|dumela|molo|good (morning|afternoon|evening))\b/;
const HELP = /\b(help|what can you do|how does this work|what do you do)\b/;
const OPEN_WORDS = /\b(open|opened|closes?|closing|closed|now|today|tonight|hours|time|times|when)\b/;
const PRICE_WORDS = /\b(price|prices|cost|costs|how much|cheap|cheapest|rand|buy|sell|sells|selling|get|have|stock|available)\b/;
const MARKET_WORDS = /\b(for sale|second.?hand|used|marketplace|market|listing|listings|selling|service|services|repair|repairs|fix|fixes|fixing|plumber|electrician|tutor|tutoring|transport|taxi|hair|salon|braids|mechanic|welding|builder|produce|vegetables|fruit)\b/;
const STUDY_WORDS = /\b(study|studies|study group|homework|learners?|grade|matric|exam|exams|revision|maths?|mathematics|science|physics|biology|english|accounting|geography|history|siswati|xitsonga|isizulu)\b/;
const ORDER_WORDS = /\b(my orders?|order status|where is my order|did .* accept)\b/;

const STOP = new Set(('a an the is are am be was were do does did can could will would should i me my we you your it its this that these those ' +
  'there here what which who whom whose where when why how any some anything something please pls plz thanks thank ok okay ' +
  'in at on of for to from near nearby around by with and or but if so than then also just still yet now today tonight tomorrow ' +
  'open opened opening close closes closed closing hours time times price prices cost costs much many buy get find sell sells selling ' +
  'have has had available stock shop shops store stores place places one ones near me town village area nkomazi know tell show give want need looking look ' +
  'rand r cheap cheapest best good').split(' '));

const DAY_WORDS: Record<string, number> = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6 };

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/g, ' ').trim();
const singular = (w: string) => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (s: string) => norm(s).split(' ').filter(Boolean).map(singular);
const keywords = (q: string) => words(q).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));

function findTown(q: string, towns: string[]): string | null {
  const flat = norm(q).replace(/\s/g, '');
  return [...towns].sort((a, b) => b.length - a.length).find((t) => flat.includes(norm(t).replace(/\s/g, ''))) ?? null;
}

/** The business the question names, if any (whole name, or a distinctive word of it). */
function findBusiness(q: string, list: Business[], towns: string[]): Business | null {
  const nq = norm(q);
  const townWords = new Set(towns.flatMap((t) => keywords(t)));
  const whole = [...list].sort((a, b) => b.name.length - a.name.length).find((b) => nq.includes(norm(b.name)));
  if (whole) return whole;
  const qw = new Set(keywords(q));
  let best: Business | null = null, bestScore = 0;
  for (const b of list) {
    const bw = keywords(b.name).filter((w) => !townWords.has(w)).filter((w) => !['clinic', 'station', 'police', 'shop', 'spaza', 'store', 'garage', 'pharmacy', 'tuck', 'fuel', 'supermarket'].includes(w));
    const score = bw.filter((w) => qw.has(w)).length;
    if (score > bestScore) { best = b; bestScore = score; }
  }
  return bestScore > 0 ? best : null;
}

/* ---------- writing answers ---------- */

const line = (b: Business, now: number) => {
  const st = statusOf(b, now);
  return `• ${b.name}${b.town ? ` (${b.town})` : ''}: ${STATUS_LABEL[st]}. ${hoursHint(b, now)}.${b.phone ? ` ${b.phone}` : ''}`;
};
const sureNote = 'Confirmed = the business said so in the last 3 hours. Expected = from opening hours only, so phone first for long trips.';
const ref = (b: Business): ResultRef => ({ kind: 'business', id: b.id, label: b.name });

function hoursOnDay(b: Business, day: number): string {
  const w = parseHours(b.openingHours);
  if (!w) return 'no opening hours on record';
  const r = w[day];
  if (!r) return 'closed';
  return r.map(([o, c]) => (o === 0 && c >= 1440 ? 'open 24 hours' : `${fmtMin(o)} to ${fmtMin(c)}`)).join(' and ');
}

/* ---------- the agent ---------- */

export function answer(question: string, data: Data, ctx: AgentContext): AgentAnswer {
  const q = norm(question);
  const { now } = ctx;
  const active = data.businesses.filter((b) => b.isActive);
  const askedTown = findTown(q, ctx.towns);
  const town = askedTown ?? (ctx.town !== 'all' ? ctx.town : null);
  const inTown = (x: { town: string }) => !town || x.town === town;
  const where = town ? `in ${town}` : 'in Nkomazi';

  if (!q) return { text: 'Ask me about what’s open, prices at local shops, the marketplace or study groups.', results: [], understood: false };

  // 1. Emergencies come first, always.
  if (EMERGENCY.test(q)) {
    const police = active.filter((b) => groupOf(b.category) === 'police').sort((a, b) => sortBusinesses(a, b, now));
    const clinics = active.filter((b) => groupOf(b.category) === 'health' && isOpenish(statusOf(b, now)));
    const parts = ['In an emergency, phone now:', '• Police: 10111', '• Ambulance: 10177', '• From a cellphone: 112'];
    if (police.length) parts.push('', 'Police stations:', ...police.slice(0, 3).map((b) => line(b, now)));
    if (clinics.length) parts.push('', 'Health services likely open now:', ...clinics.slice(0, 3).map((b) => line(b, now)));
    return { text: parts.join('\n'), results: [...police.slice(0, 3), ...clinics.slice(0, 3)].map(ref), understood: true };
  }

  // 2. Greetings and help.
  if (GREETING.test(q) && q.split(' ').length <= 3 || HELP.test(q) && q.split(' ').length <= 6) {
    return {
      text: 'Hi! I answer from VillageLink’s live information. Try:\n• “Fuel open now in Malelane?”\n• “When does OneStop close?”\n• “Where can I buy bread?”\n• “Who fixes phones?”\n• “Maths study group”\n• “Where is my order?”\nIn an emergency phone 10111 (police) or 10177 (ambulance).',
      results: [], understood: true,
    };
  }

  // 3. My orders.
  if (ORDER_WORDS.test(q)) {
    if (!ctx.userId) return { text: 'Sign in to see your orders. They show under Market › My orders.', results: [], understood: true };
    const mine = data.orders.filter((o) => o.customerId === ctx.userId).slice(0, 5);
    if (!mine.length) return { text: 'You have no orders yet. Order from a shop under Market › Shop local.', results: [], understood: true };
    const label: Record<string, string> = { sent: 'sent, waiting for the shop', accepted: 'accepted by the shop', ready: 'ready', done: 'collected or delivered', declined: 'declined by the shop', cancelled: 'cancelled' };
    return {
      text: ['Your latest orders:', ...mine.map((o) => `• ${o.shopName}: ${label[o.status]}${o.items.length ? ` (${rand(o.total)})` : ''}`)].join('\n'),
      results: [], understood: true,
    };
  }

  // 4. A named business: its status, hours on a day, phone, products.
  const named = findBusiness(q, active, ctx.towns);
  if (named) {
    const st = statusOf(named, now);
    const c = clock(now);
    const dayWord = Object.keys(DAY_WORDS).find((d) => new RegExp(`\\b${d}\\b`).test(q));
    const day = /\btomorrow\b/.test(q) ? (c.day + 1) % 7 : dayWord !== undefined ? DAY_WORDS[dayWord] : null;
    const prods = data.products.filter((p) => p.businessId === named.id && p.inStock);
    const parts = [`${named.name}${named.town ? `, ${named.town}` : ''}: ${STATUS_LABEL[st]}.`, `${verifyLine(named, now)}.`];
    if (named.confirmation?.note && isOpenish(st)) parts.push(`The business says: “${named.confirmation.note}”`);
    parts.push(day !== null ? `${DAYS[day]}: ${hoursOnDay(named, day)}.` : `${hoursHint(named, now)}.`);
    if (named.phone) parts.push(`Phone: ${named.phone}`);
    if (named.address) parts.push(`Address: ${named.address}${named.town ? `, ${named.town}` : ''}`);
    const kw = keywords(q).filter((w) => !keywords(named.name).includes(w));
    const wanted = prods.filter((p) => kw.some((w) => norm(p.name).includes(w)));
    if (wanted.length) parts.push('Sells: ' + wanted.map((p) => `${p.name} ${rand(p.price)}${p.unit ? ` / ${p.unit}` : ''}`).join(', '));
    else if (named.sellsOnline && prods.length) parts.push(`Takes orders in the app. ${prods.length} item${prods.length === 1 ? '' : 's'} in stock.`);
    return { text: parts.join('\n'), results: [ref(named)], understood: true };
  }

  // 5. Products and prices.
  const kws = keywords(q);
  const productHits = data.products.filter((p) => p.inStock && kws.some((w) => norm(p.name).includes(w)))
    .map((p) => ({ p, b: active.find((b) => b.id === p.businessId) }))
    .filter((x): x is { p: typeof x.p; b: Business } => !!x.b);
  const category = CATEGORY_WORDS.find(([, re]) => re.test(q))?.[0] ?? null;
  if (productHits.length && (PRICE_WORDS.test(q) || !category)) {
    const local = productHits.filter((x) => inTown(x.b));
    const list = (local.length ? local : productHits).sort((a, b) => a.p.price - b.p.price).slice(0, 6);
    const wider = !local.length && town ? ` Nothing ${where}, so here is the rest of Nkomazi.` : '';
    return {
      text: [`Found in local shops (cheapest first):${wider}`, ...list.map(({ p, b }) => `• ${p.name}: ${rand(p.price)}${p.unit ? ` / ${p.unit}` : ''} at ${b.name}${b.town ? ` (${b.town})` : ''}, ${STATUS_LABEL[statusOf(b, now)].toLowerCase()}`),
        'You can order for collection or delivery from the shop’s page.'].join('\n'),
      results: [...new Map(list.map(({ b }) => [b.id, ref(b)])).values()], understood: true,
    };
  }

  // 6. Marketplace and services.
  if (MARKET_WORDS.test(q) && !category) {
    const listings = data.listings.filter((l) => l.isActive);
    const kw = kws.filter((w) => !['sale', 'second', 'hand', 'used', 'marketplace', 'market', 'listing', 'service'].includes(w));
    const hits = listings.filter((l) => !kw.length || kw.some((w) => norm(`${l.title} ${l.note}`).includes(w) || (w.startsWith('fix') && /repair|fix/.test(norm(l.title)))));
    const local = hits.filter(inTown);
    const list = (local.length ? local : hits).slice(0, 6);
    if (!list.length) return { text: `Nothing like that on the marketplace ${where} right now. You can post what you’re looking for under Market › Buy & sell.`, results: [], understood: true };
    return {
      text: [`On the marketplace${local.length ? ` ${where}` : ''}:`, ...list.map((l) => `• ${l.title}: ${rand(l.price)}${l.unit ? ` ${l.unit}` : ''} (${LISTING_KINDS[l.kind].label.toLowerCase()}, ${l.town}). ${l.sellerName}, ${l.phone}`)].join('\n'),
      results: list.map((l) => ({ kind: 'listing' as const, id: l.id, label: l.title })), understood: true,
    };
  }

  // 7. Study groups.
  if (STUDY_WORDS.test(q) && !category) {
    const subj = data.groups.filter((g) => kws.some((w) => norm(`${g.subject} ${g.title}`).includes(w) || (w.startsWith('math') && /math/i.test(g.subject))));
    const list = (subj.length ? subj : data.groups).filter(inTown).concat((subj.length ? subj : data.groups).filter((g) => !inTown(g))).slice(0, 5);
    if (!list.length) return { text: 'There are no study groups yet. Start one under Study › Create, and classmates can join.', results: [], understood: true };
    return {
      text: [subj.length ? 'Study groups for that:' : 'No group for that subject yet. These groups are active:', ...list.map((g) => `• ${g.subject} ${g.grade}: ${g.title}. ${g.place}${g.town ? `, ${g.town}` : ''}. Next: ${g.nextSession}`),
        'For step-by-step homework help, use the Homework help tab.'].join('\n'),
      results: list.map((g) => ({ kind: 'group' as const, id: g.id, label: `${g.subject} ${g.grade}` })), understood: true,
    };
  }

  // 8. Places by type: what's open (now, or on a named day).
  if (category) {
    const ofGroup = active.filter((b) => {
      if (category === 'bank') return b.category === 'bank';
      if (category === 'post') return b.category === 'post';
      if (category === 'school') return b.category === 'school';
      return groupOf(b.category) === category;
    });
    // A specific kind of health service, if the question names one.
    const sub = category === 'health'
      ? ([['pharmacy', /\b(pharmac|chemist|medicine|pills)/], ['hospital', /\b(hospital|xibedlhele|sibhedlela)/], ['doctor', /\bdoctors?\b/], ['clinic', /\b(clinic|ikliniki|kliniki|nurse)/]] as [string, RegExp][]).find(([, re]) => re.test(q))?.[0] ?? null
      : null;
    const subList = sub ? ofGroup.filter((b) => b.category === sub) : [];
    const ofType = (subList.length ? subList : ofGroup).sort((a, b) => sortBusinesses(a, b, now));
    const NAMES: Record<string, string> = { fuel: 'fuel stations', shop: 'shops', health: 'health services', police: 'police stations', more: 'services', bank: 'banks', post: 'post offices', school: 'schools', pharmacy: 'pharmacies', hospital: 'hospitals', doctor: 'doctors', clinic: 'clinics' };
    const typeName = NAMES[subList.length ? sub! : category];
    const missingSub = sub && !subList.length ? `No ${NAMES[sub]} are listed in VillageLink yet. Other health services:\n` : '';
    if (!ofType.length) return { text: `VillageLink has no ${typeName} listed yet.`, results: [], understood: true };
    const local = ofType.filter(inTown);
    const pool = local.length ? local : ofType;
    const wider = !local.length && town ? `None listed ${where}, so here is the rest of Nkomazi.\n` : '';
    const place = local.length ? where : 'in Nkomazi';
    const Cap = (t: string) => t[0].toUpperCase() + t.slice(1);

    // A named day ("on Sunday", "tomorrow"): opening hours that day.
    const c = clock(now);
    const dayWord = Object.keys(DAY_WORDS).find((d) => new RegExp(`\\b${d}\\b`).test(q));
    const day = /\btomorrow\b/.test(q) ? (c.day + 1) % 7 : dayWord !== undefined ? DAY_WORDS[dayWord] : null;
    if (day !== null) {
      const list = pool.slice(0, 6);
      const label = /\btomorrow\b/.test(q) ? `tomorrow (${DAYS[day]})` : `on ${DAYS[day]}`;
      return {
        text: `${missingSub}${wider}${Cap(typeName)} ${place} ${label}:\n${list.map((b) => `• ${b.name}${b.town ? ` (${b.town})` : ''}: ${hoursOnDay(b, day)}${b.phone ? `. ${b.phone}` : ''}`).join('\n')}\nFrom published opening hours. Phone first to be sure.`,
        results: list.map(ref), understood: true,
      };
    }

    const openOnly = OPEN_WORDS.test(q) || /\bany\b/.test(q);
    const open = pool.filter((b) => isOpenish(statusOf(b, now)));
    const list = (openOnly && open.length ? open : pool).slice(0, 6);
    const head = openOnly
      ? open.length ? `${Cap(typeName)} likely open now ${place}:` : `No ${typeName} ${place} are confirmed or expected open right now. Here is what’s listed:`
      : `${Cap(typeName)} ${place}:`;
    return { text: `${missingSub}${wider}${head}\n${list.map((b) => line(b, now)).join('\n')}\n${sureNote}`, results: list.map(ref), understood: true };
  }

  // 9. Last try: search everything for the words used.
  if (kws.length) {
    const biz = active.filter((b) => kws.some((w) => norm(`${b.name} ${b.typeLabel} ${b.description}`).includes(w))).slice(0, 4);
    const lst = data.listings.filter((l) => l.isActive && kws.some((w) => norm(`${l.title} ${l.note}`).includes(w))).slice(0, 3);
    if (biz.length || lst.length) {
      return {
        text: ['Here’s what matches:', ...biz.map((b) => line(b, now)), ...lst.map((l) => `• ${l.title}: ${rand(l.price)} (${l.town}). ${l.sellerName}, ${l.phone}`)].join('\n'),
        results: [...biz.map(ref), ...lst.map((l) => ({ kind: 'listing' as const, id: l.id, label: l.title }))], understood: true,
      };
    }
  }
  return {
    text: 'Sorry, I couldn’t find that in VillageLink. Try asking about a type of place (fuel, shop, clinic, police), a business by name, a product like “bread”, the marketplace, or study groups.',
    results: [], understood: false,
  };
}
