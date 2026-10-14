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

export const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;
const EPOCH_SHEETS_MS = Date.UTC(1899, 11, 30);
const RE_YMD =
  /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
const RE_DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T,]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?$/;

/** Tolak tanggal di luar tahun 2000–2100 (biasanya kolom salah petakan). */
function wajar(ms: number): number {
  const y = new Date(ms + OFFSET_WIB_MS).getUTCFullYear();
  return y >= 2000 && y <= 2100 ? ms : NaN;
}

function offsetMenit(z: string | undefined): number {
  if (!z) return 7 * 60; // tanpa offset = WIB
  if (z.toUpperCase() === 'Z') return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(z);
  if (!m) return NaN;
  const v = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -v : v;
}

function dariKomponen(y: number, mo: number, d: number, h: number, mi: number, s: number, offset: number): number {
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59 || Number.isNaN(offset)) return NaN;
  const lokal = Date.UTC(y, mo - 1, d, h, mi, s);
  if (new Date(lokal).getUTCDate() !== d) return NaN; // mis. 31/02
  return wajar(lokal - offset * 60_000);
}

/** Epoch ms. null = kosong, NaN = tidak terbaca. Waktu tanpa offset dianggap WIB. */
export function parseTanggal(v: unknown): number | null {
  if (kosong(v)) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return NaN;
    return wajar(EPOCH_SHEETS_MS + Math.round(v * 86_400_000) - OFFSET_WIB_MS);
  }
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  let m = RE_YMD.exec(s);
  if (m) return dariKomponen(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), offsetMenit(m[7]));
  m = RE_DMY.exec(s);
  if (m) return dariKomponen(+m[3], +m[2], +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), 7 * 60);
  return NaN;
}

export function bulanJakarta(ms: number): string {
  return tanggalJakarta(ms).slice(0, 7);
}

export function tanggalJakarta(ms: number): string {
  return new Date(ms + OFFSET_WIB_MS).toISOString().slice(0, 10);
}

export function hariDalamBulan(bulan: string): number {
  const [y, m] = bulan.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const BULAN_NAMA: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3,
  apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

/** Bulan untuk tab Biaya: '2026-07', '07/2026', 'Juli 2026', atau tanggal apa pun. */
export function parseBulan(v: unknown): string | null {
  if (kosong(v)) return null;
  const fmt = (y: number, m: number) =>
    m >= 1 && m <= 12 && y >= 2000 && y <= 2100 ? `${y}-${String(m).padStart(2, '0')}` : null;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    let m = /^(\d{4})[-/](\d{1,2})$/.exec(s);
    if (m) return fmt(+m[1], +m[2]);
    m = /^(\d{1,2})[-/](\d{4})$/.exec(s);
    if (m) return fmt(+m[2], +m[1]);
    m = /^([a-z]+)\.?[\s-]+(\d{4})$/.exec(s);
    if (m && BULAN_NAMA[m[1]]) return fmt(+m[2], BULAN_NAMA[m[1]]);
  }
  const t = parseTanggal(v);
  return t === null || Number.isNaN(t) ? null : bulanJakarta(t);
}
