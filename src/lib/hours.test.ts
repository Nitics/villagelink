import { describe, expect, it } from 'vitest';
import { clock, hoursHint, openByHours, parseHours, statusOf } from './hours';
import { businessesFromCSV } from './csv';
import type { Business } from './types';

// Monday 19 October 2026, 10:16 in Johannesburg (08:16 UTC)
const MON_1016 = Date.UTC(2026, 9, 19, 8, 16);
const at = (dayOffset: number, h: number, m = 0) => MON_1016 + dayOffset * 864e5 + ((h * 60 + m) - (10 * 60 + 16)) * 6e4;

const biz = (over: Partial<Business> = {}): Business => ({
  id: 'b', name: 'Test', category: 'spaza', typeLabel: '', town: 'Tonga', address: '', phone: '', whatsapp: '',
  openingHours: 'Mo-Fr 07:00-16:00; Sa,Su off', hoursChecked: '2026-10-10', sellsOnline: false, plan: 'free',
  latitude: null, longitude: null, description: '', isActive: true, createdAt: '2026-10-01', confirmation: null, ...over,
});

describe('clock', () => {
  it('uses South African time', () => {
    expect(clock(MON_1016)).toEqual({ day: 1, min: 616, label: '10:16' });
  });
});

describe('parseHours', () => {
  it('reads 24/7', () => expect(parseHours('24/7')?.every((d) => d?.[0][0] === 0 && d[0][1] === 1440)).toBe(true));
  it('reads OSM style', () => {
    const w = parseHours('Mo-Fr 07:00-18:00; Sa 08:00-13:00; Su off')!;
    expect(w[0]).toBeNull();
    expect(w[1]).toEqual([[420, 1080]]);
    expect(w[6]).toEqual([[480, 780]]);
  });
  it('reads plain English with commas', () => {
    expect(parseHours('Mon-Fri 7:00-18:00, Sat 8-13')![6]).toEqual([[480, 780]]);
  });
  it('reads day lists', () => {
    const w = parseHours('Mo-Fr 07:00-16:00; Sa,Su off')!;
    expect(w[6]).toBeNull();
    expect(w[0]).toBeNull();
  });
  it('rejects nonsense', () => {
    expect(parseHours('sometimes')).toBeNull();
    expect(parseHours('')).toBeNull();
  });
  it('handles opening past midnight', () => {
    const w = parseHours('Fr-Sa 18:00-02:00')!;
    expect(openByHours(w, { day: 6, min: 60, label: '' })).toBe(true); // Saturday 01:00
    expect(openByHours(w, { day: 0, min: 60, label: '' })).toBe(true); // Sunday 01:00 (from Saturday)
    expect(openByHours(w, { day: 1, min: 60, label: '' })).toBe(false);
  });
});

describe('statusOf', () => {
  it('is expected open during hours', () => expect(statusOf(biz(), MON_1016)).toBe('expected'));
  it('is closed outside hours', () => expect(statusOf(biz(), at(0, 17))).toBe('closed'));
  it('trusts a fresh owner confirmation over hours', () => {
    expect(statusOf(biz({ confirmation: { at: at(0, 17), open: true, note: '' } }), at(0, 18))).toBe('confirmed');
    expect(statusOf(biz({ confirmation: { at: MON_1016 - 6e5, open: false, note: '' } }), MON_1016)).toBe('closedConfirmed');
  });
  it('lets a confirmation expire after 3 hours', () => {
    expect(statusOf(biz({ confirmation: { at: at(0, 6), open: true, note: '' } }), MON_1016)).toBe('expected');
  });
  it('is unverified without hours or with hours over 6 months old', () => {
    expect(statusOf(biz({ openingHours: '' }), MON_1016)).toBe('unverified');
    expect(statusOf(biz({ hoursChecked: '2026-01-01' }), MON_1016)).toBe('unverified');
  });
  it('gives a useful hint', () => {
    expect(hoursHint(biz(), MON_1016)).toBe('Hours say it closes at 16:00');
    expect(hoursHint(biz(), at(0, 17))).toBe('Opens tomorrow at 07:00');
    expect(hoursHint(biz({ openingHours: '24/7' }), MON_1016)).toBe('Open 24 hours');
  });
});

describe('businessesFromCSV', () => {
  it('reads both templates and flags problems', () => {
    const { rows, problems } = businessesFromCSV(
      'name,category,type_label,town,opening_hours,sells_online,plan\n' +
      '"OneStop, Tuck Shop",spaza,Spaza,kamaqhekeza,"Mo-Su 06:00-20:30",true,verified\n' +
      'Bad,cafe,,Nowhere,sometimes,no,gold\n' +
      ',fuel,,,,,\n',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: 'OneStop, Tuck Shop', town: 'KaMaqhekeza', sells_online: true, plan: 'verified' });
    expect(rows[1]).toMatchObject({ category: 'other', town: null, plan: 'free' });
    expect(problems).toHaveLength(4);
  });
});
