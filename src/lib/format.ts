export const rand = (n: number) =>
  'R' + Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const phoneOk = (p: string) => String(p || '').replace(/\D/g, '').length >= 9;

export function whatsappUrl(n: string): string | null {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length < 9) return null;
  return 'https://wa.me/' + (d.startsWith('27') ? d : '27' + d.replace(/^0/, ''));
}

export function directionsUrl(b: { name: string; address: string; town: string; latitude: number | null; longitude: number | null }) {
  const dest = b.latitude != null && b.longitude != null
    ? `${b.latitude},${b.longitude}`
    : encodeURIComponent([b.name, b.address, b.town, 'Nkomazi, Mpumalanga'].filter(Boolean).join(', '));
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export const parsePrice = (v: string) => parseFloat(String(v).replace(',', '.'));
