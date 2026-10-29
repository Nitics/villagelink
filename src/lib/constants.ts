import type { ListingKind, Plan } from './types';

export const TOWNS = [
  'Malelane', 'Komatipoort', 'Hectorspruit', 'Marloth Park', 'KaMaqhekeza', 'Kamhlushwa', 'Tonga',
  'Mangweni', 'Naas', 'Schoemansdal', 'Jeppes Reef', 'Driekoppies', 'Mbuzini', 'Steenbok', 'Langeloop',
] as const;

export const BUSINESS_CATEGORIES = [
  'fuel', 'spaza', 'supermarket', 'shop', 'butcher', 'bakery', 'hardware', 'clinic', 'pharmacy',
  'hospital', 'doctor', 'police', 'bank', 'post', 'school', 'service', 'other',
] as const;

export type Group = 'fuel' | 'shop' | 'health' | 'police' | 'more';

export const GROUPS: Record<Group, { label: string; sub: string; icon: string }> = {
  fuel: { label: 'Fuel stations', sub: 'Fuel and garages', icon: 'fuel' },
  shop: { label: 'Shops', sub: 'Groceries and essentials', icon: 'shop' },
  health: { label: 'Health', sub: 'Clinics and pharmacies', icon: 'health' },
  police: { label: 'Police', sub: 'Stations and contacts', icon: 'police' },
  more: { label: 'More services', sub: 'Banks, post, schools', icon: 'more' },
};

const GROUP_OF: Record<string, Group> = {
  fuel: 'fuel', spaza: 'shop', supermarket: 'shop', shop: 'shop', butcher: 'shop', bakery: 'shop', hardware: 'shop',
  clinic: 'health', pharmacy: 'health', hospital: 'health', doctor: 'health', police: 'police',
};
export const groupOf = (category: string): Group => GROUP_OF[String(category).toLowerCase()] ?? 'more';

export const LISTING_KINDS: Record<ListingKind, { label: string; icon: string }> = {
  goods: { label: 'Second-hand', icon: 'tag' },
  produce: { label: 'Fresh produce', icon: 'bag' },
  service: { label: 'Services', icon: 'wrench' },
};

export const JOB_KINDS: Record<'piece' | 'job', { label: string; short: string }> = {
  piece: { label: 'Piece work (once-off)', short: 'Piece work' },
  job: { label: 'Job (ongoing)', short: 'Job' },
};
export const PAY_UNITS: Record<'hour' | 'day' | 'week' | 'month' | 'once', string> = {
  hour: 'per hour', day: 'per day', week: 'per week', month: 'per month', once: 'for the job',
};
export const JOB_SAFETY = 'Never pay money to get a job or to “register”. Meet in a public place first, and tell someone where you’re going.';

export const SUBJECTS = [
  'Mathematics', 'Mathematical Literacy', 'Physical Sciences', 'Life Sciences', 'English', 'siSwati', 'Xitsonga',
  'isiZulu', 'Accounting', 'Geography', 'History', 'Business Studies',
];

export const PLANS: { id: Plan; name: string; price: string; items: string[] }[] = [
  { id: 'free', name: 'Free listing', price: 'R0', items: ['Name, hours, phone and directions', 'Shows in “What’s open” with its status', 'Residents can report open or closed'] },
  { id: 'verified', name: 'Verified', price: 'R49 / month', items: ['Verified business badge', 'Confirm “open now” from your phone', 'Take orders for collection and delivery', 'Up to 50 products with prices'] },
  { id: 'featured', name: 'Featured', price: 'R99 / month', items: ['Everything in Verified', 'Shown first in your town', 'Weekly promotion on the home screen', 'Unlimited products'] },
];

export const CONFIRM_WINDOW_MIN = 180; // an owner confirmation counts for 3 hours
export const HOURS_STALE_DAYS = 180; // hours older than this are "unverified"
export const REPORT_WINDOW_MIN = 240; // resident reports are shown for 4 hours
