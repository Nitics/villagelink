import { BUSINESS_CATEGORIES, TOWNS } from './constants';
import { parseHours } from './hours';

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); rows.push(row); row = []; f = '';
    } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

export const normTown = (t: string) => {
  const v = String(t || '').trim();
  const flat = v.toLowerCase().replace(/\s/g, '');
  return TOWNS.find((x) => x.toLowerCase().replace(/\s/g, '') === flat) ?? v;
};

/** A row ready for the businesses table. */
export interface BusinessRow {
  name: string;
  category: string;
  type_label: string | null;
  town: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_hours: string | null;
  hours_checked: string | null;
  sells_online: boolean;
  plan: 'free' | 'verified' | 'featured';
  latitude: number | null;
  longitude: number | null;
  description: string | null;
}

export interface ParsedImport { rows: BusinessRow[]; problems: string[] }

/** Reads a spreadsheet export. Accepts the app template and the Supabase template column names. */
export function businessesFromCSV(text: string): ParsedImport {
  const rows = parseCSV(text);
  if (rows.length < 2) return { rows: [], problems: ['No rows found. Check that the first row has column names.'] };
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const col = (n: string) => head.indexOf(n);
  if (col('name') < 0) return { rows: [], problems: ['The CSV needs a “name” column.'] };
  const get = (r: string[], ...names: string[]) => {
    for (const n of names) { const i = col(n); if (i >= 0 && r[i] !== undefined) return r[i].trim(); }
    return '';
  };
  const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const out: BusinessRow[] = [], problems: string[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = get(r, 'name');
    if (!name) { problems.push(`Row ${line}: no name, skipped.`); return; }
    let category = (get(r, 'category', 'cat') || 'other').toLowerCase();
    if (!(BUSINESS_CATEGORIES as readonly string[]).includes(category)) {
      problems.push(`Row ${line} (${name}): unknown category “${category}”, saved as “other”.`);
      category = 'other';
    }
    const town = normTown(get(r, 'town', 'village', 'area'));
    if (town && !(TOWNS as readonly string[]).includes(town)) problems.push(`Row ${line} (${name}): town “${town}” isn’t in the Nkomazi list, saved without a town.`);
    const hours = get(r, 'opening_hours', 'hours');
    if (hours && !parseHours(hours)) problems.push(`Row ${line} (${name}): couldn’t read hours “${hours}”.`);
    const plan = get(r, 'plan').toLowerCase();
    out.push({
      name,
      category,
      type_label: get(r, 'type_label', 'type') || null,
      town: (TOWNS as readonly string[]).includes(town) ? town : null,
      address: get(r, 'address') || null,
      phone: get(r, 'phone') || null,
      whatsapp: get(r, 'whatsapp') || null,
      opening_hours: hours || null,
      hours_checked: /^\d{4}-\d{2}-\d{2}$/.test(get(r, 'hours_checked', 'checked')) ? get(r, 'hours_checked', 'checked') : null,
      sells_online: /^(y|yes|true|1)$/i.test(get(r, 'sells_online', 'sells')),
      plan: plan === 'verified' || plan === 'featured' ? plan : 'free',
      latitude: num(get(r, 'latitude', 'lat')),
      longitude: num(get(r, 'longitude', 'lng', 'lon')),
      description: get(r, 'description', 'notes') || null,
    });
  });
  return { rows: out, problems };
}
