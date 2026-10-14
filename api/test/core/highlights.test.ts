import { describe, expect, it } from 'vitest';
import { buatSorotan } from '../../src/core/highlights.js';
import { type BarisPlatform, type BarisProduk, OPSI_DEFAULT } from '../../src/core/types.js';

const prod = (sku: string, qty: number, laba: number, margin: number, hpp_tersedia = true): BarisProduk => ({
  sku, nama: `Produk ${sku}`, qty, omzet_kotor: 0, retur: 0, penjualan_bersih: 0, potongan_marketplace: 0,
  hpp: 0, iklan: 0, packaging: 0, laba_kontribusi: laba, margin_persen: margin, hpp_tersedia,
});
const plat = (platform: string, laba: number, margin: number, pb = 100): BarisPlatform => ({
  platform, jumlah_pesanan: 1, qty: 1, omzet_kotor: pb, retur: 0, penjualan_bersih: pb, potongan_marketplace: 0,
  hpp: 0, iklan: 0, packaging: 0, laba_kontribusi: laba, margin_persen: margin,
});

const SEPULUH = [
  prod('P01', 500, -1240500, -8.3),
  prod('P02', 412, 5000, 4),
  prod('P03', 300, 900000, 25),
  prod('P04', 299, -10, -0.1),
  prod('P05', 10, 6000, 30), prod('P06', 9, 7000, 30), prod('P07', 8, 8000, 30),
  prod('P08', 7, 9000, 30), prod('P09', 6, 10000, 30), prod('P10', 5, 11000, 30),
];

describe('buatSorotan — produk laris', () => {
  it('top max(3, 20%) menurut qty: rugi dan margin tipis', () => {
    const s = buatSorotan(SEPULUH, [], OPSI_DEFAULT).filter((x) => x.jenis.startsWith('LARIS'));
    expect(s).toEqual([
      { jenis: 'LARIS_TAPI_RUGI', teks: 'Produk P01 terjual 500 pcs (terlaris #1) tetapi rugi Rp1.240.500 (margin −8,3%).', sku: 'P01', platform: null },
      { jenis: 'LARIS_MARGIN_TIPIS', teks: 'Produk P02 terjual 412 pcs (terlaris #2) tetapi marginnya tipis: 4,0% (laba Rp5.000).', sku: 'P02', platform: null },
    ]);
  });

  it('produk tanpa HPP tidak disorot, peringkat lain tetap', () => {
    const data = SEPULUH.map((p) => (p.sku === 'P01' ? { ...p, hpp_tersedia: false } : p));
    const s = buatSorotan(data, [], OPSI_DEFAULT).filter((x) => x.jenis.startsWith('LARIS'));
    expect(s.map((x) => x.sku)).toEqual(['P02']);
    expect(s[0].teks).toContain('terlaris #2');
  });

  it('20% dari 20 produk = 4 produk teratas', () => {
    const data = Array.from({ length: 20 }, (_, i) => {
      const sku = `Q${String(i + 1).padStart(2, '0')}`;
      return sku === 'Q04' || sku === 'Q05' ? prod(sku, 100 - i, -1, -1) : prod(sku, 100 - i, 1000, 30);
    });
    expect(buatSorotan(data, [], OPSI_DEFAULT).filter((x) => x.jenis === 'LARIS_TAPI_RUGI').map((x) => x.sku)).toEqual(['Q04']);
  });

  it('ambang margin tipis bisa diatur', () => {
    const s = buatSorotan(SEPULUH, [], { ...OPSI_DEFAULT, ambang_margin_tipis_persen: 30 });
    expect(s.filter((x) => x.jenis === 'LARIS_MARGIN_TIPIS').map((x) => x.sku)).toEqual(['P02', 'P03']);
  });

  it('qty ditulis dengan titik ribuan', () => {
    const s = buatSorotan([prod('A', 1412, -1, -1), prod('B', 1, 1, 50), prod('C', 1, 1, 50)], [], OPSI_DEFAULT);
    expect(s[0].teks).toContain('terjual 1.412 pcs');
  });
});

describe('buatSorotan — paling untung', () => {
  it('3 produk dengan laba tertinggi (> 0)', () => {
    const s = buatSorotan(SEPULUH, [], OPSI_DEFAULT).filter((x) => x.jenis === 'PRODUK_PALING_UNTUNG');
    expect(s.map((x) => x.sku)).toEqual(['P03', 'P10', 'P09']);
    expect(s[0].teks).toBe('Produk P03 produk paling untung #1: laba Rp900.000 (margin 25,0%).');
  });

  it('platform paling untung dan margin terbaik (bila berbeda)', () => {
    const s = buatSorotan([], [plat('Shopee', 18000, 12.9), plat('TikTok Shop', 14000, 28)], OPSI_DEFAULT);
    expect(s).toEqual([
      { jenis: 'PLATFORM_PALING_UNTUNG', teks: 'Shopee paling untung: laba kontribusi Rp18.000 (margin 12,9%).', sku: null, platform: 'Shopee' },
      { jenis: 'PLATFORM_MARGIN_TERBAIK', teks: 'TikTok Shop punya margin terbaik: 28,0%.', sku: null, platform: 'TikTok Shop' },
    ]);
  });

  it('margin terbaik tidak ditulis bila sama dengan paling untung', () => {
    const s = buatSorotan([], [plat('Shopee', 18000, 30), plat('TikTok Shop', 14000, 28)], OPSI_DEFAULT);
    expect(s.map((x) => x.jenis)).toEqual(['PLATFORM_PALING_UNTUNG']);
  });

  it('tanpa platform untung → tanpa sorotan platform', () => {
    expect(buatSorotan([], [plat('A', -5, -1), plat('B', -3, -2)], OPSI_DEFAULT)).toEqual([]);
  });
});
