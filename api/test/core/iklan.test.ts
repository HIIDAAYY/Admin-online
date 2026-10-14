import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { alokasiIklan } from '../../src/core/iklan.js';
import type { BiayaValid, ItemHasil } from '../../src/core/types.js';

const item = (platform: string, bulan: string, sku: string, nilai: number, retur = false): ItemHasil => ({
  platform, bulan, tanggal: `${bulan}-10`, no_pesanan: 'X', sku, nama: null, qty: 1, retur, nilai,
  diskon_voucher: 0, biaya_admin: 0, biaya_layanan: 0, ongkir: 0, lainnya: 0, hpp: 0, hpp_tersedia: true, packaging: 0,
});
const iklan = (platform: string, bulan: string, nilai: number): BiayaValid => ({
  baris: 2, bulan, jenis: 'iklan', platform, nilai, keterangan: '',
});

describe('alokasiIklan', () => {
  const items = [
    item('Shopee', '2026-07', 'S1', 100000),
    item('Shopee', '2026-07', 'S2', 40000),
    item('Shopee', '2026-07', 'S2', 40000, true),
    item('TikTok Shop', '2026-07', 'S1', 50000),
  ];

  it('proporsional terhadap omzet kotor produk di platform & bulan itu (retur ikut omzet kotor)', () => {
    const c = new Catatan();
    const hasil = alokasiIklan(items, [iklan('Shopee', '2026-07', 14000)], c);
    expect(hasil.produk).toEqual([
      { platform: 'Shopee', bulan: '2026-07', sku: 'S1', nilai: 7778 },
      { platform: 'Shopee', bulan: '2026-07', sku: 'S2', nilai: 6222 },
    ]);
    expect(hasil.sisa).toEqual([]);
    expect(c.masalah).toEqual([]);
  });

  it('beberapa baris iklan platform-bulan yang sama dijumlahkan', () => {
    const hasil = alokasiIklan(items, [iklan('TikTok Shop', '2026-07', 3000), iklan('TikTok Shop', '2026-07', 2000)], new Catatan());
    expect(hasil.produk).toEqual([{ platform: 'TikTok Shop', bulan: '2026-07', sku: 'S1', nilai: 5000 }]);
  });

  it('platform tanpa penjualan di bulan itu → tidak teralokasi', () => {
    const c = new Catatan();
    const hasil = alokasiIklan(items, [iklan('TikTok Shop', '2026-08', 5000)], c);
    expect(hasil.produk).toEqual([]);
    expect(hasil.sisa).toEqual([{ platform: 'TikTok Shop', bulan: '2026-08', nilai: 5000 }]);
    expect(c.masalah[0]).toMatchObject({ jenis: 'IKLAN_TIDAK_TERALOKASI', platform: 'TikTok Shop', sheet: 'Biaya' });
    expect(c.masalah[0].pesan).toBe(
      'Iklan TikTok Shop Agustus 2026 sebesar Rp5.000 tidak bisa dibagi karena tidak ada penjualan TikTok Shop ' +
        'di bulan itu. Tetap mengurangi laba bersih.',
    );
  });

  // --- Review Focus ---
  it('nama platform di tab Biaya beda huruf tetap cocok', () => {
    const hasil = alokasiIklan(items, [iklan('shopee ', '2026-07', 1800)], new Catatan());
    expect(hasil.produk.map((p) => [p.platform, p.sku, p.nilai])).toEqual([['Shopee', 'S1', 1000], ['Shopee', 'S2', 800]]);
  });
});
