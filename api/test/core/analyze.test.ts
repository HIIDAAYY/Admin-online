import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/core/analyze.js';
import type { AnalyzeInput, BiayaInput } from '../../src/core/types.js';
import { baris, biaya, mappingStd, tab, tangkap } from './helpers.js';

const HPP = [{ sku: 'S1', nama: 'Kopi A', hpp: 30000 }, { sku: 'S2', nama: 'Kopi B', hpp: 25000 }];

describe('analyze — contoh lengkap (angka dihitung tangan)', () => {
  const input: AnalyzeInput = {
    pesanan: [
      tab('Shopee', [
        baris('A1', 'S1', 2, 50000, { Tanggal: '2026-07-01 08:00', Admin: 8000, Layanan: 2000, Diterima: 90000 }),
        baris('A2', 'S2', 1, 40000, { Tanggal: '15/07/2026 12:00', Admin: 3200, Layanan: 800, Diterima: 30000 }),
        baris('A3', 'S1', 1, 50000, { Tanggal: '2026-07-20 10:00', Status: 'Batal', Diterima: 0 }),
        baris('A4', 'S2', 1, 40000, { Tanggal: '2026-07-21 10:00', Status: 'Retur', Diterima: 0 }),
      ]),
      tab('TikTok Shop', [
        baris('B1', 'S1', 1, 50000, { Tanggal: '2026-07-31T23:30:00+07:00', Admin: 5000, Diterima: 45000 }),
      ]),
    ],
    hpp: HPP,
    biaya: [
      biaya('2026-07', 'iklan', 14000, 'Shopee'),
      biaya('2026-07', 'packaging', 1000),
      biaya('2026-07', 'tetap', 50000),
      biaya('2026-08', 'tetap', 999999),
    ],
  };
  const lap = analyze(input);

  it('ringkasan', () => {
    expect(lap.ringkasan).toEqual({
      omzet_kotor: 230000, retur: 40000, penjualan_bersih: 190000,
      diskon_voucher_penjual: 0, biaya_marketplace: 25000, total_potongan_marketplace: 25000, dana_diterima: 165000,
      hpp: 115000, iklan: 14000, packaging: 4000, laba_kontribusi: 32000,
      biaya_tetap: 50000, laba_bersih: -18000, margin_persen: -9.5,
      jumlah_pesanan: 4, jumlah_pesanan_batal: 1, jumlah_pesanan_retur: 1, jumlah_pesanan_belum_cair: 0,
      iklan_tidak_teralokasi: 0, tanggal_pertama: '2026-07-01', tanggal_terakhir: '2026-07-31', periode: ['2026-07'],
    });
    expect(lap.rincian_biaya_marketplace).toEqual({ biaya_admin: 16200, biaya_layanan: 2800, ongkir_ditanggung_penjual: 0, potongan_lainnya: 6000 });
  });

  it('per produk, platform, bulan', () => {
    expect(lap.per_produk).toEqual([
      { sku: 'S2', nama: 'Kopi B', qty: 1, omzet_kotor: 80000, retur: 40000, penjualan_bersih: 40000, potongan_marketplace: 10000, hpp: 25000, iklan: 6222, packaging: 2000, laba_kontribusi: -3222, margin_persen: -8.1, hpp_tersedia: true },
      { sku: 'S1', nama: 'Kopi A', qty: 3, omzet_kotor: 150000, retur: 0, penjualan_bersih: 150000, potongan_marketplace: 15000, hpp: 90000, iklan: 7778, packaging: 2000, laba_kontribusi: 35222, margin_persen: 23.5, hpp_tersedia: true },
    ]);
    expect(lap.per_platform).toEqual([
      { platform: 'Shopee', jumlah_pesanan: 3, qty: 3, omzet_kotor: 180000, retur: 40000, penjualan_bersih: 140000, potongan_marketplace: 20000, hpp: 85000, iklan: 14000, packaging: 3000, laba_kontribusi: 18000, margin_persen: 12.9 },
      { platform: 'TikTok Shop', jumlah_pesanan: 1, qty: 1, omzet_kotor: 50000, retur: 0, penjualan_bersih: 50000, potongan_marketplace: 5000, hpp: 30000, iklan: 0, packaging: 1000, laba_kontribusi: 14000, margin_persen: 28 },
    ]);
    expect(lap.per_bulan).toEqual([
      { bulan: '2026-07', jumlah_pesanan: 4, omzet_kotor: 230000, retur: 40000, penjualan_bersih: 190000, potongan_marketplace: 25000, hpp: 115000, iklan: 14000, packaging: 4000, laba_kontribusi: 32000, iklan_tidak_teralokasi: 0, biaya_tetap: 50000, laba_bersih: -18000, margin_persen: -9.5 },
    ]);
  });

  it('sorotan', () => {
    expect(lap.sorotan).toEqual([
      { jenis: 'LARIS_TAPI_RUGI', teks: 'Kopi B terjual 1 pcs (terlaris #2) tetapi rugi Rp3.222 (margin −8,1%).', sku: 'S2', platform: null },
      { jenis: 'PRODUK_PALING_UNTUNG', teks: 'Kopi A produk paling untung #1: laba Rp35.222 (margin 23,5%).', sku: 'S1', platform: null },
      { jenis: 'PLATFORM_PALING_UNTUNG', teks: 'Shopee paling untung: laba kontribusi Rp18.000 (margin 12,9%).', sku: null, platform: 'Shopee' },
      { jenis: 'PLATFORM_MARGIN_TERBAIK', teks: 'TikTok Shop punya margin terbaik: 28,0%.', sku: null, platform: 'TikTok Shop' },
    ]);
  });

  it('masalah & info', () => {
    expect(lap.masalah).toEqual([]);
    expect(lap.jumlah_masalah).toEqual({});
    expect(lap.info).toEqual([{
      jenis: 'BIAYA_DI_LUAR_PERIODE', platform: null, jumlah: 1,
      pesan: 'Biaya untuk 1 bulan di luar periode data diabaikan (Agustus 2026), total Rp999.999.',
      detail: [{ bulan: '2026-08', total_diabaikan: 999999, tarif_packaging_diabaikan: 0 }],
    }]);
  });
});

describe('analyze — periode biaya', () => {
  it('tab Biaya 12 bulan, pesanan hanya 1 bulan', () => {
    const biayaSetahun: BiayaInput[] = [];
    for (let m = 1; m <= 12; m++) {
      const b = `2026-${String(m).padStart(2, '0')}`;
      biayaSetahun.push(biaya(b, 'iklan', 100000, 'Shopee'), biaya(b, 'packaging', 1000), biaya(b, 'tetap', 500000));
    }
    const lap = analyze({
      pesanan: [tab('Shopee', [baris('A1', 'S1', 1, 200000, { Tanggal: '2026-03-15 10:00' })], mappingStd({ total_diterima: undefined }))],
      hpp: HPP,
      biaya: biayaSetahun,
    });
    expect(lap.ringkasan).toMatchObject({
      periode: ['2026-03'], iklan: 100000, packaging: 1000, biaya_tetap: 500000, iklan_tidak_teralokasi: 0,
      laba_kontribusi: 69000, laba_bersih: -431000,
    });
    expect(lap.jumlah_masalah.IKLAN_TIDAK_TERALOKASI).toBeUndefined();
    const info = lap.info.find((i) => i.jenis === 'BIAYA_DI_LUAR_PERIODE')!;
    expect(info.jumlah).toBe(11);
    expect(info.detail).toHaveLength(11);
    expect(info.detail!.every((d) => d.total_diabaikan === 600000 && d.tarif_packaging_diabaikan === 1000)).toBe(true);
    expect(info.pesan).toContain('total Rp6.600.000');
  });

  it('bulan yang semua pesanannya batal tidak masuk periode', () => {
    const lap = analyze({
      pesanan: [tab('Shopee', [
        baris('A1', 'S1', 1, 1000, { Tanggal: '2026-03-15 10:00' }),
        baris('A2', 'S1', 1, 1000, { Tanggal: '2026-04-10 10:00', Status: 'Batal' }),
      ])],
      hpp: HPP,
      biaya: [biaya('2026-04', 'tetap', 70000)],
    });
    expect(lap.ringkasan.periode).toEqual(['2026-03']);
    expect(lap.ringkasan.biaya_tetap).toBe(0);
    expect(lap.info.find((i) => i.jenis === 'BIAYA_DI_LUAR_PERIODE')!.detail).toEqual([
      { bulan: '2026-04', total_diabaikan: 70000, tarif_packaging_diabaikan: 0 },
    ]);
  });

  it('iklan platform tanpa penjualan di bulan dalam periode → tidak teralokasi, tetap mengurangi laba bersih', () => {
    const lap = analyze({
      pesanan: [
        tab('Shopee', [baris('A1', 'S1', 1, 100000, { Tanggal: '2026-07-10 10:00' })], mappingStd({ total_diterima: undefined })),
        tab('TikTok Shop', [baris('B1', 'S1', 1, 100000, { Tanggal: '2026-06-10 10:00' })], mappingStd({ total_diterima: undefined })),
      ],
      hpp: HPP,
      biaya: [biaya('2026-07', 'iklan', 5000, 'TikTok Shop')],
    });
    expect(lap.ringkasan.iklan).toBe(0);
    expect(lap.ringkasan.iklan_tidak_teralokasi).toBe(5000);
    expect(lap.ringkasan.laba_bersih).toBe(lap.ringkasan.laba_kontribusi - 5000);
    expect(lap.per_bulan.find((b) => b.bulan === '2026-07')!.iklan_tidak_teralokasi).toBe(5000);
    expect(lap.jumlah_masalah.IKLAN_TIDAK_TERALOKASI).toBe(1);
  });
});

describe('analyze — info', () => {
  it('31 Juli 17:30 UTC dihitung 1 Agustus; Agustus penuh tanpa info', () => {
    const lap = analyze({
      pesanan: [tab('Shopee', [
        baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-31T17:30:00Z' }),
        baris('A2', 'S1', 1, 1000, { Tanggal: '2026-08-31 10:00' }),
      ], mappingStd({ total_diterima: undefined }))],
      hpp: HPP,
      biaya: [],
    });
    expect(lap.ringkasan.periode).toEqual(['2026-08']);
    expect(lap.ringkasan.tanggal_pertama).toBe('2026-08-01');
    expect(lap.info.filter((i) => i.jenis === 'BULAN_TIDAK_PENUH')).toEqual([]);
  });

  it('pesanan belum cair → info & hitungan ringkasan, bukan masalah', () => {
    const lap = analyze({
      pesanan: [tab('Shopee', [
        baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-01 10:00' }),
        baris('A2', 'S1', 1, 1000, { Tanggal: '2026-07-31 10:00', Diterima: 0 }),
      ])],
      hpp: HPP,
      biaya: [],
    });
    expect(lap.ringkasan.jumlah_pesanan_belum_cair).toBe(2);
    expect(lap.info).toEqual([{
      jenis: 'PESANAN_BELUM_CAIR', platform: 'Shopee', jumlah: 2,
      pesan: '2 pesanan Shopee belum cair; laba dihitung dari potongan yang terpetakan.',
    }]);
    expect(lap.masalah).toEqual([]);
  });

  it('status tidak dipetakan → info STATUS_TIDAK_DIPETAKAN', () => {
    const lap = analyze({
      pesanan: [tab('Shopee', [baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-01 10:00' }), baris('A2', 'S1', 1, 1000, { Tanggal: '2026-07-31 10:00' })], mappingStd({ status: undefined, total_diterima: undefined }))],
      hpp: HPP,
      biaya: [],
    });
    expect(lap.info).toEqual([{
      jenis: 'STATUS_TIDAK_DIPETAKAN', platform: 'Shopee', jumlah: 2,
      pesan: 'Kolom status di Pesanan - Shopee tidak dipetakan; semua baris dianggap selesai.',
    }]);
  });
});

describe('analyze — platform di tab Biaya', () => {
  it('tarif packaging untuk platform yang tidak ada di tab pesanan mana pun → peringatan', () => {
    const lap = analyze({
      pesanan: [tab('TikTok Shop', [baris('B1', 'S1', 1, 100000)], mappingStd({ total_diterima: undefined }))],
      hpp: HPP,
      biaya: [biaya('2026-07', 'packaging', 2000, 'Tiktok')],
    });
    expect(lap.ringkasan.packaging).toBe(0);
    expect(lap.masalah).toEqual([expect.objectContaining({
      jenis: 'BIAYA_TIDAK_VALID', sheet: 'Biaya', baris: 2, platform: 'Tiktok',
      pesan: 'Tarif packaging untuk platform "Tiktok" tidak cocok dengan tab pesanan mana pun, jadi tidak dipakai. Periksa ejaan nama platform.',
    })]);
  });

  it('tarif packaging platform yang ada → tanpa peringatan', () => {
    const lap = analyze({
      pesanan: [tab('TikTok Shop', [baris('B1', 'S1', 1, 100000)], mappingStd({ total_diterima: undefined }))],
      hpp: HPP,
      biaya: [biaya('2026-07', 'packaging', 2000, 'tiktok shop')],
    });
    expect(lap.ringkasan.packaging).toBe(2000);
    expect(lap.masalah).toEqual([]);
  });
});

describe('analyze — batas & kesalahan', () => {
  it('satu tab dengan 200.000 baris tidak crash', () => {
    const rows = Array.from({ length: 200_000 }, (_, i) => baris(`A${i}`, 'S1', 1, 1000));
    const lap = analyze({ pesanan: [tab('Shopee', rows, mappingStd({ total_diterima: undefined }))], hpp: HPP, biaya: [] });
    expect(lap.ringkasan.jumlah_pesanan).toBe(200_000);
  }, 60_000);

  it('masalah dibatasi 1.000, jumlah lengkap', () => {
    const rows = Array.from({ length: 1200 }, (_, i) => baris(`X${i}`, '', 1, 1000));
    const lap = analyze({ pesanan: [tab('Shopee', rows)], hpp: [], biaya: [] });
    expect(lap.masalah).toHaveLength(1000);
    expect(lap.jumlah_masalah).toEqual({ KOLOM_WAJIB_KOSONG: 1200 });
  });

  it('KesalahanInput diteruskan', () => {
    const e = tangkap(() => analyze({ pesanan: [tab('Shopee', [], mappingStd({ sku: undefined }))], hpp: [], biaya: [] }));
    expect(e.code).toBe('PEMETAAN_TIDAK_LENGKAP');
  });

  it('opsi parsial digabung dengan default', () => {
    const rows = [baris('A1', 'S1', 1, 50000, { Status: 'Retur', Tanggal: '2026-07-01 10:00' })];
    expect(analyze({ pesanan: [tab('Shopee', rows)], hpp: HPP, biaya: [] }).ringkasan.hpp).toBe(0);
    expect(analyze({ pesanan: [tab('Shopee', rows)], hpp: HPP, biaya: [], opsi: { retur_barang_rusak: true } }).ringkasan.hpp).toBe(30000);
  });
});

describe('analyze — konsistensi (data acak)', () => {
  const jumlah = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  it.each([1, 2, 3, 4, 5])('seed %d: Σ produk = Σ platform = ringkasan; Σ bulan = ringkasan (kecuali margin)', (seed) => {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const platforms = ['Shopee', 'TikTok Shop', 'Tokopedia'];
    const pesanan = platforms.map((pf) => tab(pf, Array.from({ length: 60 }, (_, i) => {
      const bln = 7 + Math.floor(r() * 3);
      const hari = 1 + Math.floor(r() * 28);
      const u = r();
      return baris(`${pf}-${Math.floor(i / 2)}`, `S${1 + Math.floor(r() * 5)}`, 1 + Math.floor(r() * 3), 10000 + Math.floor(r() * 90) * 1000, {
        Tanggal: `2026-${String(bln).padStart(2, '0')}-${String(hari).padStart(2, '0')} 10:00`,
        Status: u < 0.1 ? 'Batal' : u < 0.2 ? 'Retur' : 'Selesai',
        Diskon: Math.floor(r() * 3) * 1000,
        Admin: Math.floor(r() * 10) * 500,
        Ongkir: r() < 0.3 ? 5000 : null,
        Diterima: r() < 0.2 ? null : 50000 + Math.floor(r() * 50) * 1000,
      });
    })));
    const biayaAcak: BiayaInput[] = [];
    for (const b of ['2026-07', '2026-08', '2026-09']) {
      for (const pf of platforms) biayaAcak.push(biaya(b, 'iklan', Math.floor(r() * 500000), pf));
      biayaAcak.push(biaya(b, 'packaging', 1500), biaya(b, 'tetap', 1000000));
    }
    biayaAcak.push(biaya('2026-10', 'iklan', 777777, 'Shopee'));
    const lap = analyze({
      pesanan,
      hpp: [1, 2, 3, 4].map((i) => ({ sku: `S${i}`, hpp: 5000 * i })),
      biaya: biayaAcak,
      opsi: { retur_barang_rusak: seed % 2 === 0 },
    });
    const R = lap.ringkasan;

    expect(jumlah(lap.per_produk.map((p) => p.laba_kontribusi))).toBe(R.laba_kontribusi);
    expect(jumlah(lap.per_platform.map((p) => p.laba_kontribusi))).toBe(R.laba_kontribusi);
    expect(jumlah(lap.per_produk.map((p) => p.omzet_kotor))).toBe(R.omzet_kotor);
    expect(jumlah(lap.per_platform.map((p) => p.jumlah_pesanan))).toBe(R.jumlah_pesanan);
    for (const k of ['omzet_kotor', 'retur', 'penjualan_bersih', 'hpp', 'iklan', 'packaging', 'laba_kontribusi',
      'iklan_tidak_teralokasi', 'biaya_tetap', 'laba_bersih', 'jumlah_pesanan'] as const) {
      expect(jumlah(lap.per_bulan.map((b) => b[k]))).toBe(R[k]);
    }
    expect(jumlah(lap.per_bulan.map((b) => b.potongan_marketplace))).toBe(R.total_potongan_marketplace);
    expect(R.dana_diterima).toBe(R.penjualan_bersih - R.total_potongan_marketplace);
    expect(R.total_potongan_marketplace).toBe(R.diskon_voucher_penjual + R.biaya_marketplace);
    expect(R.laba_bersih).toBe(R.laba_kontribusi - R.iklan_tidak_teralokasi - R.biaya_tetap);
    expect(R.biaya_marketplace).toBe(jumlah(Object.values(lap.rincian_biaya_marketplace)));
  });
});
