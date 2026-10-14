import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { buangDuplikat } from '../../src/core/dedupe.js';
import { ekstrakBaris } from '../../src/core/extract.js';
import { bentukPesanan } from '../../src/core/orders.js';
import type { PesananInput, Sel } from '../../src/core/types.js';
import { baris, type BarisUji, tab } from './helpers.js';

function jalan(tabs: PesananInput[]) {
  const c = new Catatan();
  const semua = tabs.flatMap((t) => ekstrakBaris(t, c).baris);
  const unik = buangDuplikat(semua, c);
  return { unik, pesanan: bentukPesanan(unik, c), c };
}
const satuTab = (rows: BarisUji[]) => jalan([tab('Shopee', rows)]);

describe('buangDuplikat', () => {
  it('kunci platform + no_pesanan + sku; kemunculan pertama dipakai', () => {
    const { unik, c } = satuTab([baris('A1', 'S1', 1, 1000), baris('A1', 'S1', 1, 1000), baris('A1', 'S2', 1, 1000)]);
    expect(unik.map((b) => b.baris)).toEqual([2, 4]);
    expect(c.masalah).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'DUPLIKAT', baris: 3, no_pesanan: 'A1', sku: 'S1' });
    expect(c.masalah[0].pesan).toBe('Duplikat dari Pesanan - Shopee baris 2 (no_pesanan + sku sama). Baris ini diabaikan.');
  });

  it('lintas tab dengan platform yang sama', () => {
    const t2 = { ...tab('Shopee', [baris('A1', 'S1', 1, 1000)]), sheet: 'Pesanan - Shopee (2)' };
    const { unik, c } = jalan([tab('Shopee', [baris('A1', 'S1', 1, 1000)]), t2]);
    expect(unik).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'DUPLIKAT', sheet: 'Pesanan - Shopee (2)', baris: 2 });
  });

  it('platform berbeda bukan duplikat', () => {
    const { unik } = jalan([tab('Shopee', [baris('A1', 'S1', 1, 1000)]), tab('Tokopedia', [baris('A1', 'S1', 1, 1000)])]);
    expect(unik).toHaveLength(2);
  });

  it('tanpa beda huruf/spasi', () => {
    const { unik } = satuTab([baris('A1', 's1 ', 1, 1000), baris('a1', 'S1', 1, 1000)]);
    expect(unik).toHaveLength(1);
  });
});

describe('bentukPesanan — biaya level pesanan', () => {
  const dua = (admin2: Sel, diterima2: Sel) => [
    baris('A1', 'S1', 1, 60000, { Admin: 10000, Diterima: 85000 }),
    baris('A1', 'S2', 1, 40000, { Admin: admin2, Diterima: diterima2 }),
  ];

  it('pola 1: biaya diulang di setiap baris item', () => {
    const { pesanan, c } = satuTab(dua(10000, 85000));
    expect(pesanan).toHaveLength(1);
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(10000);
    expect(pesanan[0].nilaiOrder.total_diterima).toBe(85000);
    expect(c.masalah).toEqual([]);
  });

  it('pola 2: biaya hanya di baris pertama', () => {
    const { pesanan, c } = satuTab(dua(null, null));
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(10000);
    expect(pesanan[0].nilaiOrder.total_diterima).toBe(85000);
    expect(c.masalah).toEqual([]);
  });

  it('baris lanjutan berisi 0 diperlakukan seperti kosong', () => {
    const { pesanan, c } = satuTab(dua(0, 0));
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(10000);
    expect(c.masalah).toEqual([]);
  });

  it('nilai berbeda → nilai pertama dipakai + NILAI_PESANAN_TIDAK_KONSISTEN', () => {
    const { pesanan, c } = satuTab(dua(12000, 85000));
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(10000);
    expect(c.masalah).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'NILAI_PESANAN_TIDAK_KONSISTEN', baris: 3 });
  });

  it('nilai pertama yang tidak kosong boleh di baris kedua', () => {
    const { pesanan } = satuTab([baris('A1', 'S1', 1, 1000, { Admin: null }), baris('A1', 'S2', 1, 1000, { Admin: 7000 })]);
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(7000);
  });

  it('semua kosong → null; semua 0 → 0', () => {
    expect(satuTab([baris('A1', 'S1', 1, 1000)]).pesanan[0].nilaiOrder.total_diterima).toBeNull();
    expect(satuTab([baris('A1', 'S1', 1, 1000, { Diterima: 0 })]).pesanan[0].nilaiOrder.total_diterima).toBe(0);
  });

  it('pesanan batal bila semua barisnya batal; baris batal dikeluarkan dari aktif', () => {
    const { pesanan } = satuTab([
      baris('B1', 'S1', 1, 1000, { Status: 'Batal' }),
      baris('B1', 'S2', 1, 1000, { Status: 'Batal' }),
      baris('C1', 'S1', 1, 1000),
      baris('C1', 'S2', 1, 1000, { Status: 'Batal' }),
    ]);
    expect(pesanan.map((p) => [p.no_pesanan, p.batal, p.aktif.length])).toEqual([['B1', true, 0], ['C1', false, 1]]);
  });

  it('bulan & tanggal pesanan dari baris pertama, dalam WIB', () => {
    const { pesanan } = satuTab([baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-31T17:30:00Z' })]);
    expect(pesanan[0].bulan).toBe('2026-08');
    expect(pesanan[0].tanggal).toBe('2026-08-01');
  });
});
