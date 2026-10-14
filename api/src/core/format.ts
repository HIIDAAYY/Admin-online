const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const MINUS = '−'; // U+2212

/** Angka bulat dengan titik ribuan, tanpa tanda (nilai mutlak). */
export function formatAngka(n: number): string {
  return Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatRupiah(n: number): string {
  const r = Math.round(n);
  return (r < 0 ? MINUS : '') + 'Rp' + formatAngka(r);
}

export function formatPersen(p: number): string {
  return (p < 0 ? MINUS : '') + Math.abs(p).toFixed(1).replace('.', ',') + '%';
}

/** '2026-07' → 'Juli' */
export function namaBulanSaja(bulan: string): string {
  return NAMA_BULAN[Number(bulan.slice(5, 7)) - 1];
}

/** '2026-07' → 'Juli 2026' */
export function namaBulan(bulan: string): string {
  return `${namaBulanSaja(bulan)} ${bulan.slice(0, 4)}`;
}
