import { describe, expect, it } from 'vitest';
import { agregasi, margin } from '../../src/core/aggregate.js';
import type { ItemHasil, RingkasPesanan } from '../../src/core/types.js';

const nolItem: Omit<ItemHasil, 'platform' | 'bulan' | 'tanggal' | 'no_pesanan' | 'sku' | 'nilai'> = {
  nama: null, qty: 1, retur: false, diskon_voucher: 0, biaya_admin: 0, biaya_layanan: 0, ongkir: 0, lainnya: 0,
  hpp: 0, hpp_tersedia: true, packaging: 0,
};
const rp = (platform: string, no: string, tanggal: string, punyaRetur = false): RingkasPesanan => ({
  platform, no_pesanan: no, bulan: tanggal.slice(0, 7), tanggal, punyaRetur, belumCair: false,
});

describe('margin', () => {
  it.each([
    [1, 3, 33.3], [-3222, 40000, -8.1], [5, 0, 0], [-1, 8, -12.5], [-1, 16, -6.3], [1, 16, 6.3], [1500, 150000, 1],
  ])('margin(%d, %d) = %d', (laba, pb, hasil) => {
    expect(margin(laba, pb)).toBe(hasil);
  });
});

describe('agregasi', () => {
  const hasil = agregasi({
    items: [
      { ...nolItem, platform: 'Shopee', bulan: '2026-07', tanggal: '2026-07-01', no_pesanan: 'A1', sku: 'S1', nama: 'Kopi A', qty: 2, nilai: 100000, biaya_admin: 8000, biaya_layanan: 2000, hpp: 60000, packaging: 1000 },
      { ...nolItem, platform: 'Shopee', bulan: '2026-07', tanggal: '2026-07-15', no_pesanan: 'A4', sku: 'S2', retur: true, nilai: 40000, packaging: 1000 },
      { ...nolItem, platform: 'TikTok Shop', bulan: '2026-08', tanggal: '2026-08-31', no_pesanan: 'B1', sku: 'S1', nama: 'Kopi A', nilai: 50000, diskon_voucher: 1000, biaya_admin: 5000, lainnya: 500, hpp: 30000, packaging: 1000 },
    ],
    pesanan: [rp('Shopee', 'A1', '2026-07-01'), rp('Shopee', 'A4', '2026-07-15', true), rp('TikTok Shop', 'B1', '2026-08-31')],
    jumlahBatal: 1,
    iklanProduk: [{ platform: 'Shopee', bulan: '2026-07', sku: 'S1', nilai: 7000 }],
    iklanSisa: [{ platform: 'TikTok Shop', bulan: '2026-08', nilai: 2000 }],
    biaya: [
      { baris: 2, bulan: '2026-07', jenis: 'tetap', platform: null, nilai: 10000, keterangan: '' },
      { baris: 3, bulan: '2026-08', jenis: 'tetap', platform: null, nilai: 20000, keterangan: '' },
      { baris: 4, bulan: '2026-08', jenis: 'iklan', platform: 'TikTok Shop', nilai: 2000, keterangan: '' },
    ],
    periode: ['2026-07', '2026-08'],
  });

  it('ringkasan mengikuti rantai laba', () => {
    expect(hasil.ringkasan).toEqual({
      omzet_kotor: 190000, retur: 40000, penjualan_bersih: 150000,
      diskon_voucher_penjual: 1000, biaya_marketplace: 15500, total_potongan_marketplace: 16500, dana_diterima: 133500,
      hpp: 90000, iklan: 7000, packaging: 3000, laba_kontribusi: 33500,
      biaya_tetap: 30000, laba_bersih: 1500, margin_persen: 1,
      jumlah_pesanan: 3, jumlah_pesanan_batal: 1, jumlah_pesanan_retur: 1, jumlah_pesanan_belum_cair: 0,
      iklan_tidak_teralokasi: 2000, tanggal_pertama: '2026-07-01', tanggal_terakhir: '2026-08-31',
      periode: ['2026-07', '2026-08'],
    });
    expect(hasil.rincian_biaya_marketplace).toEqual({ biaya_admin: 13000, biaya_layanan: 2000, ongkir_ditanggung_penjual: 0, potongan_lainnya: 500 });
  });

  it('per produk: urut dari laba terkecil; qty tanpa retur; nama jatuh ke sku', () => {
    expect(hasil.per_produk).toEqual([
      { sku: 'S2', nama: 'S2', qty: 0, omzet_kotor: 40000, retur: 40000, penjualan_bersih: 0, potongan_marketplace: 0, hpp: 0, iklan: 0, packaging: 1000, laba_kontribusi: -1000, margin_persen: 0, hpp_tersedia: true },
      { sku: 'S1', nama: 'Kopi A', qty: 3, omzet_kotor: 150000, retur: 0, penjualan_bersih: 150000, potongan_marketplace: 16500, hpp: 90000, iklan: 7000, packaging: 2000, laba_kontribusi: 34500, margin_persen: 23, hpp_tersedia: true },
    ]);
  });

  it('per platform: urut nama', () => {
    expect(hasil.per_platform).toEqual([
      { platform: 'Shopee', jumlah_pesanan: 2, qty: 2, omzet_kotor: 140000, retur: 40000, penjualan_bersih: 100000, potongan_marketplace: 10000, hpp: 60000, iklan: 7000, packaging: 2000, laba_kontribusi: 21000, margin_persen: 21 },
      { platform: 'TikTok Shop', jumlah_pesanan: 1, qty: 1, omzet_kotor: 50000, retur: 0, penjualan_bersih: 50000, potongan_marketplace: 6500, hpp: 30000, iklan: 0, packaging: 1000, laba_kontribusi: 12500, margin_persen: 25 },
    ]);
  });

  it('per bulan: iklan hanya teralokasi; iklan tak teralokasi & biaya tetap terpisah; margin dari laba bersih', () => {
    expect(hasil.per_bulan).toEqual([
      { bulan: '2026-07', jumlah_pesanan: 2, omzet_kotor: 140000, retur: 40000, penjualan_bersih: 100000, potongan_marketplace: 10000, hpp: 60000, iklan: 7000, packaging: 2000, laba_kontribusi: 21000, iklan_tidak_teralokasi: 0, biaya_tetap: 10000, laba_bersih: 11000, margin_persen: 11 },
      { bulan: '2026-08', jumlah_pesanan: 1, omzet_kotor: 50000, retur: 0, penjualan_bersih: 50000, potongan_marketplace: 6500, hpp: 30000, iklan: 0, packaging: 1000, laba_kontribusi: 12500, iklan_tidak_teralokasi: 2000, biaya_tetap: 20000, laba_bersih: -9500, margin_persen: -19 },
    ]);
  });

  it('tanpa item: tanggal null, angka nol', () => {
    const kosong = agregasi({ items: [], pesanan: [], jumlahBatal: 0, iklanProduk: [], iklanSisa: [], biaya: [], periode: [] });
    expect(kosong.ringkasan.tanggal_pertama).toBeNull();
    expect(kosong.ringkasan.laba_bersih).toBe(0);
    expect(kosong.per_bulan).toEqual([]);
  });
});
