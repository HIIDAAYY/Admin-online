export function kosong(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** Kunci pembanding: tanpa spasi tepi dan tanpa beda huruf besar/kecil. */
export function kunci(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Membaca angka dari sel. null = kosong, NaN = tidak terbaca.
 * Format Indonesia (titik = ribuan, koma = desimal) diutamakan saat ambigu.
 */
export function parseAngka(v: unknown): number | null {
  if (kosong(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;

  let s = v.trim().replace(/ /g, ' ');
  if (/^[-−]$/.test(s)) return null;
  let negatif = false;
  if (/^\(.*\)$/.test(s)) {
    negatif = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    negatif = !negatif;
    s = s.slice(1).trim();
  }
  s = s.replace(/^(rp\.?|idr)\s*/i, '').replace(/\s+/g, '');
  if (s.startsWith('-') || s.startsWith('−')) {
    negatif = !negatif;
    s = s.slice(1);
  }
  if (s === '' || !/^[\d.,]+$/.test(s)) return NaN;

  const titik = (s.match(/\./g) ?? []).length;
  const koma = (s.match(/,/g) ?? []).length;
  let normal: string;
  if (titik > 0 && koma > 0) {
    const desimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const ribuan = desimal === ',' ? '.' : ',';
    if ((desimal === ',' ? koma : titik) > 1) return NaN;
    normal = s.split(ribuan).join('').replace(desimal, '.');
  } else if (koma > 1) {
    normal = s.split(',').join('');
  } else if (koma === 1) {
    normal = s.replace(',', '.');
  } else if (titik > 1) {
    normal = s.split('.').join('');
  } else if (titik === 1 && /^\d+\.\d{3}$/.test(s)) {
    normal = s.replace('.', '');
  } else {
    normal = s;
  }
  if (!/^\d+(\.\d+)?$/.test(normal)) return NaN;
  const n = Number(normal);
  return negatif ? -n : n;
}
