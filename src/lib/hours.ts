// Opening hours, clock and "what's open" status. Always South African Standard Time.
import { CONFIRM_WINDOW_MIN, HOURS_STALE_DAYS } from './constants';
import type { Business, Status } from './types';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface Clock { day: number; min: number; label: string }

export function clock(ms = Date.now()): Clock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Johannesburg', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const h = +get('hour') % 24;
  const m = +get('minute');
  return { day: WD[get('weekday')], min: h * 60 + m, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

export const fmtMin = (m: number) => {
  m = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const minsSince = (t: number, now = Date.now()) => (now - t) / 60000;

export function ago(mins: number): string {
  mins = Math.max(0, Math.round(mins));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) { const h = Math.round(mins / 60); return `${h} hour${h > 1 ? 's' : ''} ago`; }
  const d = Math.round(mins / 1440);
  if (d < 45) return `${d} day${d > 1 ? 's' : ''} ago`;
  return `${Math.round(d / 30)} months ago`;
}

export type Range = [number, number];
export type Week = (Range[] | null)[]; // index 0 = Sunday

const DAYKEY: Record<string, number> = { mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6, su: 0 };
const cache = new Map<string, Week | null>();

/** Reads "24/7", "Mo-Fr 07:00-18:00; Sa 08:00-13:00; Su off" or "Mon-Fri 7:00-18:00, Sat 8-13". */
export function parseHours(raw: string | null | undefined): Week | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (cache.has(text)) return cache.get(text)!;
  let out: Week | null = null;
  if (/^24\s*\/\s*7$|^24 ?h(ours)?$|^always open$/i.test(text)) {
    out = Array.from({ length: 7 }, () => [[0, 1440] as Range]);
  } else {
    const week: Week = Array.from({ length: 7 }, () => null);
    let any = false;
    for (let seg of text.replace(/\n/g, ';').split(/;|(?<=\d)\s*,\s*(?=[A-Za-z])/)) {
      seg = seg.trim();
      const m = seg.match(/^([A-Za-z ,\-–]+?)\s*[: ]\s*(.+)$/);
      if (!m) continue;
      const days = new Set<number>();
      for (const part of m[1].split(',')) {
        const r = part.trim().toLowerCase().split(/\s*[-–]\s*/);
        const a = DAYKEY[(r[0] || '').slice(0, 2)];
        const b = r[1] !== undefined ? DAYKEY[r[1].slice(0, 2)] : a;
        if (a === undefined || b === undefined) continue;
        let d = a;
        for (let k = 0; k < 7; k++) { days.add(d); if (d === b) break; d = (d + 1) % 7; }
      }
      if (!days.size) continue;
      const times = m[2].trim().toLowerCase();
      let ranges: Range[] | null = null;
      if (!/off|closed/.test(times)) {
        ranges = [];
        for (const tr of times.split(',')) {
          const mm = tr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?$/);
          if (mm) ranges.push([+mm[1] * 60 + +(mm[2] || 0), +mm[3] * 60 + +(mm[4] || 0)]);
        }
        if (!ranges.length) continue;
      }
      days.forEach((d) => (week[d] = ranges));
      any = true;
    }
    out = any ? week : null;
  }
  cache.set(text, out);
  return out;
}

export function openByHours(week: Week, c: Clock): boolean {
  for (const [o, cl] of week[c.day] || []) if (cl > o ? c.min >= o && c.min < cl : c.min >= o) return true;
  for (const [o, cl] of week[(c.day + 6) % 7] || []) if (cl <= o && c.min < cl) return true; // past midnight
  return false;
}

export function hoursHint(b: Business, now = Date.now()): string {
  const week = parseHours(b.openingHours);
  if (!week) return 'No opening hours on record';
  const c = clock(now);
  if (week.every((d) => d && d.some(([o, cl]) => o === 0 && cl >= 1440))) return 'Open 24 hours';
  for (const [o, cl] of week[c.day] || []) if (c.min >= o && c.min < cl) return `Hours say it closes at ${fmtMin(cl)}`;
  for (let i = 0; i < 8; i++) {
    const day = (c.day + i) % 7;
    for (const [o] of week[day] || []) {
      if (i > 0 || o > c.min) return `Opens ${i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAYS[day]} at ${fmtMin(o)}`;
    }
  }
  return 'Closed all week';
}

export function hoursAgeDays(b: Business, now = Date.now()): number | null {
  const t = Date.parse(b.hoursChecked || b.createdAt || '');
  return isNaN(t) ? null : (now - t) / 864e5;
}

export function statusOf(b: Business, now = Date.now()): Status {
  if (b.confirmation && minsSince(b.confirmation.at, now) <= CONFIRM_WINDOW_MIN) {
    return b.confirmation.open ? 'confirmed' : 'closedConfirmed';
  }
  const week = parseHours(b.openingHours);
  const age = hoursAgeDays(b, now);
  if (!week || (age !== null && age > HOURS_STALE_DAYS)) return 'unverified';
  return openByHours(week, clock(now)) ? 'expected' : 'closed';
}

export const STATUS_LABEL: Record<Status, string> = {
  confirmed: 'Confirmed open', expected: 'Expected open', unverified: 'Status unverified',
  closedConfirmed: 'Confirmed closed', closed: 'Closed now',
};
export const STATUS_RANK: Record<Status, number> = { confirmed: 0, expected: 1, unverified: 2, closedConfirmed: 3, closed: 4 };
export const isOpenish = (s: Status) => s === 'confirmed' || s === 'expected';

export function verifyLine(b: Business, now = Date.now()): string {
  const st = statusOf(b, now);
  if ((st === 'confirmed' || st === 'closedConfirmed') && b.confirmation) return `The business confirmed ${ago(minsSince(b.confirmation.at, now))}`;
  if (!parseHours(b.openingHours)) return 'Opening hours missing · not confirmed today';
  const age = hoursAgeDays(b, now);
  if (age !== null && age > HOURS_STALE_DAYS) return `Hours last checked ${ago(age * 1440)} · may be outdated`;
  return `From opening hours${age !== null ? ` checked ${ago(age * 1440)}` : ''} · not confirmed today`;
}

export function sortBusinesses(a: Business, b: Business, now = Date.now()): number {
  const sa = STATUS_RANK[statusOf(a, now)], sb = STATUS_RANK[statusOf(b, now)];
  if (sa !== sb) return sa - sb;
  const fa = a.plan === 'featured' ? 0 : 1, fb = b.plan === 'featured' ? 0 : 1;
  if (fa !== fb) return fa - fb;
  return a.name.localeCompare(b.name);
}
