import { describe, expect, it } from 'vitest';
import { answer } from './agent';
import { emptyData, type Data } from './data';
import type { Business } from './types';
import { TOWNS } from './constants';

// Monday 19 October 2026, 10:16 in Johannesburg
const NOW = Date.UTC(2026, 9, 19, 8, 16);
const biz = (o: Partial<Business>): Business => ({
  id: o.name!, name: '', category: 'shop', typeLabel: '', town: 'Malelane', address: '', phone: '', whatsapp: '',
  openingHours: 'Mo-Su 06:00-20:30', hoursChecked: '2026-10-19', sellsOnline: false, plan: 'free', latitude: null, longitude: null,
  description: '', isActive: true, createdAt: '2026-10-01', confirmation: null, ...o,
});
const data: Data = {
  ...emptyData(),
  towns: [...TOWNS],
  businesses: [
    biz({ name: 'OneStop Tuck Shop', category: 'spaza', town: 'KaMaqhekeza', sellsOnline: true, phone: '072 000 0000', confirmation: { at: NOW - 20 * 6e4, open: true, note: 'Fresh bread in' } }),
    biz({ name: 'Praxoz', category: 'fuel', openingHours: '24/7', phone: '013 000 0000' }),
    biz({ name: 'Mangweni Clinic', category: 'clinic', town: 'Tonga', openingHours: 'Mo-Fr 07:00-16:00; Sa,Su off' }),
    biz({ name: 'Tonga Butchery', category: 'butcher', town: 'Tonga', openingHours: 'Mo-Sa 07:00-18:00; Su off' }),
    biz({ name: 'Malelane Police Station', category: 'police', openingHours: '24/7', phone: '013 000 0500' }),
    biz({ name: 'Hidden Shop', category: 'shop', isActive: false }),
  ],
  products: [
    { id: 'p1', businessId: 'OneStop Tuck Shop', name: 'White bread', price: 18, unit: 'loaf', inStock: true },
    { id: 'p2', businessId: 'OneStop Tuck Shop', name: 'Maize meal 10 kg', price: 115, unit: 'bag', inStock: true },
    { id: 'p3', businessId: 'Tonga Butchery', name: 'Brown bread', price: 17, unit: 'loaf', inStock: true },
  ],
  listings: [{ id: 'l1', kind: 'service', title: 'Phone screen repairs', price: 250, unit: 'from', town: 'KaMaqhekeza', sellerName: 'Sipho', phone: '073 000 0203', note: '', ownerId: 'x', createdAt: NOW, isActive: true }],
  groups: [{ id: 'g1', subject: 'Mathematics', grade: 'Grade 12', title: 'Paper 1 revision', place: 'Library', isOnline: false, nextSession: 'Thu 15:00', town: 'Malelane', contact: '', ownerId: 'x', members: [] }],
};
const ctx = { now: NOW, town: 'all', towns: [...TOWNS], userId: null };
const ask = (q: string, c = ctx) => answer(q, data, c);

describe('agent', () => {
  it('puts emergencies first', () => {
    const a = ask('Ambulance please, there was an accident');
    expect(a.text).toMatch(/10177/);
    expect(a.text).toMatch(/Malelane Police Station/);
  });
  it('finds fuel open now', () => {
    const a = ask('Is any fuel station open now?');
    expect(a.text).toMatch(/Praxoz/);
    expect(a.results.map((r) => r.id)).toEqual(['Praxoz']);
  });
  it('uses the town named in the question', () => {
    const a = ask('clinic open in Tonga?');
    expect(a.text).toMatch(/Mangweni Clinic \(Tonga\): Expected open/);
  });
  it('does not mistake a town for a business name', () => {
    const a = ask('shops in Tonga');
    expect(a.text).toMatch(/Tonga Butchery/);
    expect(a.text).toMatch(/^Shops in Tonga/);
  });
  it('answers about a named business, with the owner’s note', () => {
    const a = ask('When does OneStop close?');
    expect(a.text).toMatch(/OneStop Tuck Shop, KaMaqhekeza: Confirmed open/);
    expect(a.text).toMatch(/Fresh bread in/);
    expect(a.text).toMatch(/closes at 20:30/);
  });
  it('gives hours for a named day', () => {
    expect(ask('Is Mangweni Clinic open on Saturday?').text).toMatch(/Saturday: closed/);
    expect(ask('Praxoz phone number').text).toMatch(/013 000 0000/);
  });
  it('finds products, cheapest first', () => {
    const a = ask('Where can I buy bread?');
    expect(a.text.indexOf('Brown bread')).toBeLessThan(a.text.indexOf('White bread'));
    expect(a.text).toMatch(/R17/);
  });
  it('searches the marketplace', () => {
    expect(ask('Who fixes phones?').text).toMatch(/Phone screen repairs: R250/);
  });
  it('finds study groups', () => {
    expect(ask('maths study group').text).toMatch(/Mathematics Grade 12/);
  });
  it('never shows hidden businesses', () => {
    expect(ask('Hidden Shop').text).not.toMatch(/Hidden Shop/);
  });
  it('asks people to sign in for orders', () => {
    expect(ask('where is my order').text).toMatch(/Sign in/);
  });
  it('answers for a named day', () => {
    const a = ask('is the clinic open on sunday');
    expect(a.text).toMatch(/^Clinics in Nkomazi on Sunday:/);
    expect(a.text).toMatch(/Mangweni Clinic \(Tonga\): closed/);
    expect(ask('fuel tomorrow').text).toMatch(/Praxoz \(Malelane\): open 24 hours/);
  });
  it('says when a specific kind of health service is missing', () => {
    const a = ask('pharmacy open now');
    expect(a.text).toMatch(/^No pharmacies are listed in VillageLink yet\. Other health services:/);
    expect(a.text).toMatch(/Health services likely open now/);
  });
  it('admits when it does not know', () => {
    const a = ask('qwerty zxcvb');
    expect(a.understood).toBe(false);
  });
});
