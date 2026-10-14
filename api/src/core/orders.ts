import type { Catatan } from './catatan.js';
import { bulanJakarta, kunci, tanggalJakarta } from './parse.js';
import type { BarisItem, FieldOrder, Pesanan } from './types.js';

/** Mengelompokkan baris per platform + no_pesanan dan menentukan nilai level pesanan (spec §6.3). */
export function bentukPesanan(baris: BarisItem[], catatan: Catatan): Pesanan[] {
  const grup = new Map<string, BarisItem[]>();
  for (const b of baris) {
    const k = `${kunci(b.platform)}|${kunci(b.no_pesanan)}`;
    const g = grup.get(k);
    if (g) g.push(b);
    else grup.set(k, [b]);
  }

  const hasil: Pesanan[] = [];
  for (const semua of grup.values()) {
    const pertama = semua[0];
    const fields = new Set<FieldOrder>();
    for (const b of semua) for (const f of Object.keys(b.biayaOrder) as FieldOrder[]) fields.add(f);
    const nilaiOrder: Partial<Record<FieldOrder, number | null>> = {};
    for (const f of fields) nilaiOrder[f] = nilaiPesanan(semua, f, catatan);
    const aktif = semua.filter((b) => b.status !== 'batal');
    hasil.push({
      platform: pertama.platform,
      no_pesanan: pertama.no_pesanan,
      waktu: pertama.waktu,
      bulan: bulanJakarta(pertama.waktu),
      tanggal: tanggalJakarta(pertama.waktu),
      batal: aktif.length === 0,
      aktif,
      nilaiOrder,
    });
  }
  return hasil;
}

/**
 * Nilai pertama yang tidak kosong menurut urutan baris. 0 diperlakukan seperti kosong;
 * bila semua baris 0 hasilnya 0, bila semua kosong hasilnya null.
 */
function nilaiPesanan(semua: BarisItem[], f: FieldOrder, catatan: Catatan): number | null {
  let dipakai: number | null = null;
  let adaNol = false;
  for (const b of semua) {
    const v = b.biayaOrder[f];
    if (v === null || v === undefined) continue;
    if (v === 0) {
      adaNol = true;
      continue;
    }
    if (dipakai === null) {
      dipakai = v;
      continue;
    }
    if (v !== dipakai) {
      catatan.tambah({
        jenis: 'NILAI_PESANAN_TIDAK_KONSISTEN', platform: b.platform, sheet: b.sheet, baris: b.baris,
        no_pesanan: b.no_pesanan, sku: b.sku,
        pesan: `${f} berbeda antarbaris dalam satu pesanan (${v} vs ${dipakai}). Nilai pertama yang tidak kosong yang dipakai.`,
      });
      break;
    }
  }
  return dipakai ?? (adaNol ? 0 : null);
}
