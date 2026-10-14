import type { Info, JenisMasalah, Masalah } from './types.js';

export const BATAS_MASALAH = 1000;

const JENIS_ERROR: ReadonlySet<JenisMasalah> = new Set(['KOLOM_WAJIB_KOSONG', 'BARIS_GAGAL_DIBACA']);

export type MasalahBaru = Pick<Masalah, 'jenis' | 'pesan'> &
  Partial<Pick<Masalah, 'platform' | 'sheet' | 'baris' | 'no_pesanan' | 'sku'>>;

/** Pengumpul masalah data dan info selama satu analisis. */
export class Catatan {
  readonly masalah: Masalah[] = [];
  readonly jumlah: Partial<Record<JenisMasalah, number>> = {};
  readonly info: Info[] = [];

  tambah(m: MasalahBaru): void {
    this.jumlah[m.jenis] = (this.jumlah[m.jenis] ?? 0) + 1;
    if (this.masalah.length >= BATAS_MASALAH) return;
    this.masalah.push({
      jenis: m.jenis,
      tingkat: JENIS_ERROR.has(m.jenis) ? 'error' : 'peringatan',
      platform: m.platform ?? null,
      sheet: m.sheet ?? null,
      baris: m.baris ?? null,
      no_pesanan: m.no_pesanan ?? null,
      sku: m.sku ?? null,
      pesan: m.pesan,
    });
  }

  tambahInfo(i: Info): void {
    this.info.push(i);
  }
}
