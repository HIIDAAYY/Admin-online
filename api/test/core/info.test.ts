import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { ekstrakBaris } from '../../src/core/extract.js';
import { cekBulanTidakPenuh, hitungPeriode, infoBelumCair } from '../../src/core/info.js';
import { bentukPesanan } from '../../src/core/orders.js';
import type { RingkasPesanan } from '../../src/core/types.js';
import { baris, tab } from './helpers.js';

const rp = (tanggal: string, platform = 'Shopee', belumCair = false): RingkasPesanan => ({
  platform, no_pesanan: tanggal, bulan: tanggal.slice(0, 7), tanggal, punyaRetur: false, belumCair,
});

describe('hitungPeriode', () => {
  it('bulan dari pesanan non-batal saja', () => {
    const c = new Catatan();
    const pesanan = bentukPesanan(ekstrakBaris(tab('Shopee', [
      baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-05 10:00' }),
      baris('A2', 'S1', 1, 1000, { Tanggal: '2026-08-05 10:00', Status: 'Batal' }),
      baris('A3', 'S1', 1, 1000, { Tanggal: '2026-06-05 10:00' }),
    ]), c).baris, c);
    expect(hitungPeriode(pesanan)).toEqual(['2026-06', '2026-07']);
  });
});

describe('cekBulanTidakPenuh', () => {
  const jalan = (tanggal: string[]) => {
    const c = new Catatan();
    cekBulanTidakPenuh(tanggal.map((t) => rp(t)), c);
    return c.info;
  };

  it('bulan penuh (ada tanggal 1 dan hari terakhir) → tanpa info', () => {
    expect(jalan(['2026-07-01', '2026-07-15', '2026-07-31'])).toEqual([]);
  });

  it('mulai tanggal 5 → info', () => {
    expect(jalan(['2026-07-05', '2026-07-31'])).toEqual([{
      jenis: 'BULAN_TIDAK_PENUH',
      platform: null,
      jumlah: 1,
      pesan: 'Data Juli 2026 hanya mencakup 5–31 Juli. Biaya tetap Juli tetap dihitung penuh.',
      detail: [{ bulan: '2026-07', hari_pertama: 5, hari_terakhir: 31 }],
    }]);
  });

  it('berakhir sebelum hari terakhir → info', () => {
    expect(jalan(['2026-09-01', '2026-09-29'])[0].pesan).toBe(
      'Data September 2026 hanya mencakup 1–29 September. Biaya tetap September tetap dihitung penuh.',
    );
  });

  it('Februari kabisat: hari terakhir 29', () => {
    expect(jalan(['2028-02-01', '2028-02-29'])).toEqual([]);
    expect(jalan(['2028-02-01', '2028-02-28'])).toHaveLength(1);
  });

  it('setiap bulan dinilai sendiri, terurut', () => {
    expect(jalan(['2026-08-03', '2026-08-31', '2026-07-01', '2026-07-31']).map((i) => i.detail?.[0].bulan)).toEqual(['2026-08']);
  });
});

describe('infoBelumCair', () => {
  it('satu info per platform, urut kemunculan', () => {
    const c = new Catatan();
    infoBelumCair([
      rp('2026-07-01', 'Shopee', true), rp('2026-07-02', 'TikTok Shop', true),
      rp('2026-07-03', 'Shopee', true), rp('2026-07-04', 'Shopee', false),
    ], c);
    expect(c.info).toEqual([
      { jenis: 'PESANAN_BELUM_CAIR', platform: 'Shopee', jumlah: 2, pesan: '2 pesanan Shopee belum cair; laba dihitung dari potongan yang terpetakan.' },
      { jenis: 'PESANAN_BELUM_CAIR', platform: 'TikTok Shop', jumlah: 1, pesan: '1 pesanan TikTok Shop belum cair; laba dihitung dari potongan yang terpetakan.' },
    ]);
  });
});
