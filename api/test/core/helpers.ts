import type { BiayaInput, FieldStandar, Pemetaan, PemetaanField, PesananInput, Sel } from '../../src/core/types.js';
import { KesalahanInput } from '../../src/core/types.js';

export const HEADER = ['No', 'Tanggal', 'Status', 'SKU', 'Nama', 'Qty', 'Harga', 'Diskon', 'Voucher', 'Admin', 'Layanan', 'Ongkir', 'Diterima'];

/** Pemetaan standar: diskon level item; voucher/admin/layanan/ongkir/total_diterima level pesanan. */
export function mappingStd(
  ganti: Partial<Record<FieldStandar, PemetaanField | undefined>> = {},
  lain: Omit<Pemetaan, 'fields'> = {},
): Pemetaan {
  return {
    fields: {
      no_pesanan: { headers: ['No'] },
      tanggal: { headers: ['Tanggal'] },
      status: { headers: ['Status'] },
      sku: { headers: ['SKU'] },
      nama_produk: { headers: ['Nama'] },
      qty: { headers: ['Qty'] },
      harga_jual: { headers: ['Harga'] },
      diskon_penjual: { headers: ['Diskon'] },
      voucher_penjual: { headers: ['Voucher'], level: 'order' },
      biaya_admin: { headers: ['Admin'], level: 'order' },
      biaya_layanan: { headers: ['Layanan'], level: 'order' },
      ongkir_ditanggung_penjual: { headers: ['Ongkir'], level: 'order' },
      total_diterima: { headers: ['Diterima'], level: 'order' },
      ...ganti,
    },
    ...lain,
  };
}

export type BarisUji = Partial<Record<string, Sel>>;

export function baris(no: string, sku: string, qty: Sel, harga: Sel, lain: BarisUji = {}): BarisUji {
  return { No: no, Tanggal: '2026-07-10 10:00', Status: 'Selesai', SKU: sku, Qty: qty, Harga: harga, ...lain };
}

export function tab(platform: string, rows: BarisUji[], mapping: Pemetaan = mappingStd()): PesananInput {
  return {
    platform,
    sheet: `Pesanan - ${platform}`,
    row_offset: 2,
    mapping,
    header: HEADER,
    rows: rows.map((r) => HEADER.map((h) => r[h] ?? null)),
  };
}

export function biaya(bulan: string, jenis: string, nilai: number, platform: string | null = null): BiayaInput {
  return { bulan, jenis, platform, nilai, keterangan: '' };
}

export function tangkap(fn: () => unknown): KesalahanInput {
  try {
    fn();
  } catch (e) {
    if (e instanceof KesalahanInput) return e;
    throw e;
  }
  throw new Error('fungsi tidak melempar KesalahanInput');
}
