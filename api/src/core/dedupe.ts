import type { Catatan } from './catatan.js';
import { kunci } from './parse.js';
import type { BarisItem } from './types.js';

/** Kunci platform + no_pesanan + sku. Kemunculan pertama dipakai (spec §6.7). */
export function buangDuplikat(baris: BarisItem[], catatan: Catatan): BarisItem[] {
  const pertama = new Map<string, BarisItem>();
  const hasil: BarisItem[] = [];
  for (const b of baris) {
    const k = `${kunci(b.platform)}|${kunci(b.no_pesanan)}|${kunci(b.sku)}`;
    const ada = pertama.get(k);
    if (ada) {
      catatan.tambah({
        jenis: 'DUPLIKAT', platform: b.platform, sheet: b.sheet, baris: b.baris, no_pesanan: b.no_pesanan, sku: b.sku,
        pesan: `Duplikat dari ${ada.sheet} baris ${ada.baris} (no_pesanan + sku sama). Baris ini diabaikan.`,
      });
      continue;
    }
    pertama.set(k, b);
    hasil.push(b);
  }
  return hasil;
}
