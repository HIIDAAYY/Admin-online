import { kunci } from './parse.js';
import type { StatusKelompok } from './types.js';

/** Tebakan kelompok status dari kata kunci umum (bukan nama status marketplace tertentu). */
export function tebakStatus(raw: string): StatusKelompok | null {
  const s = kunci(raw);
  if (s === '') return null;
  if (/batal|cancel/.test(s)) return 'batal';
  if (/retur|return|refund|pengembalian/.test(s)) return 'retur';
  if (/selesai|complete|diterima|dikirim|delivered|shipped|terkirim|sampai/.test(s)) return 'selesai';
  return null;
}

/** status_map → kata kunci → 'selesai' (tidak dikenal). Spec §6.2. */
export function klasifikasiStatus(
  raw: string | null,
  statusMap: Record<string, StatusKelompok> | undefined,
): { status: StatusKelompok; dikenal: boolean } {
  const s = (raw ?? '').trim();
  if (statusMap) {
    const cocok = Object.keys(statusMap).find((k) => kunci(k) === kunci(s));
    if (cocok !== undefined) return { status: statusMap[cocok], dikenal: true };
  }
  const tebakan = tebakStatus(s);
  return tebakan ? { status: tebakan, dikenal: true } : { status: 'selesai', dikenal: false };
}
