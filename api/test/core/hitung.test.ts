import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { buangDuplikat } from '../../src/core/dedupe.js';
import { ekstrakBaris } from '../../src/core/extract.js';
import { bangunHpp, hitungItem } from '../../src/core/hitung.js';
import { bentukPesanan } from '../../src/core/orders.js';
import { OPSI_DEFAULT, type Opsi, type Pemetaan } from '../../src/core/types.js';
import { baris, type BarisUji, mappingStd, tab } from './helpers.js';

const HPP = bangunHpp([{ sku: 'S1', nama: 'Kopi A', hpp: 30000 }, { sku: 'S2', nama: 'Kopi B', hpp: 20000 }]);

function jalankan(rows: BarisUji[], o: { mapping?: Pemetaan; tarif?: number; opsi?: Partial<Opsi> } = {}) {
  const c = new Catatan();
  const pesanan = bentukPesanan(buangDuplikat(ekstrakBaris(tab('Shopee', rows, o.mapping ?? mappingStd()), c).baris, c), c);
  const h = hitungItem(pesanan, { hpp: HPP, tarifPackaging: () => o.tarif ?? 0, opsi: { ...OPSI_DEFAULT, ...o.opsi } }, c);
  return { ...h, c };
}
const ambil = (items: ReturnType<typeof jalankan>['items'], k: 'biaya_admin' | 'lainnya' | 'packaging' | 'diskon_voucher' | 'hpp') =>
  items.map((i) => i[k]);

describe('hitungItem — biaya level pesanan & potongan_lainnya', () => {
  const pola = (admin2: number | null, diterima2: number | null) => [
    baris('A1', 'S1', 1, 60000, { Admin: 10000, Diterima: 85000 }),
    baris('A1', 'S2', 1, 40000, { Admin: admin2, Diterima: diterima2 }),
  ];

  it('dibagi menurut nilai item; potongan_lainnya = nilai − terpetakan − total_diterima', () => {
    const { items, pesanan, c } = jalankan(pola(null, null));
    expect(ambil(items, 'biaya_admin')).toEqual([6000, 4000]);
    expect(ambil(items, 'lainnya')).toEqual([3000, 2000]);
    expect(pesanan).toEqual([{ platform: 'Shopee', no_pesanan: 'A1', bulan: '2026-07', tanggal: '2026-07-10', punyaRetur: false, belumCair: false }]);
    expect(c.masalah).toEqual([]);
  });

  it('pola diulang di setiap baris = pola hanya baris pertama', () => {
    expect(jalankan(pola(10000, 85000)).items).toEqual(jalankan(pola(null, null)).items);
  });

  it('diskon level item tetap milik barisnya', () => {
    const { items } = jalankan(
      [baris('A1', 'S1', 1, 60000, { Diskon: 5000 }), baris('A1', 'S2', 1, 40000)],
      { mapping: mappingStd({ total_diterima: undefined }) },
    );
    expect(ambil(items, 'diskon_voucher')).toEqual([5000, 0]);
  });

  it('nilai item nol semua → dibagi menurut qty', () => {
    const { items } = jalankan([baris('A1', 'S1', 1, 0, { Admin: 4000 }), baris('A1', 'S2', 3, 0)]);
    expect(ambil(items, 'biaya_admin')).toEqual([1000, 3000]);
  });

  it.each([null, 0])('belum cair (total_diterima = %j): lainnya 0, info bukan masalah', (v) => {
    const { items, pesanan, c } = jalankan([baris('A1', 'S1', 1, 100000, { Admin: 5000, Diterima: v })]);
    expect(ambil(items, 'lainnya')).toEqual([0]);
    expect(pesanan[0].belumCair).toBe(true);
    expect(c.masalah).toEqual([]);
  });

  it('total_diterima tidak dipetakan → lainnya 0 dan bukan belum cair', () => {
    const { items, pesanan } = jalankan([baris('A1', 'S1', 1, 100000)], { mapping: mappingStd({ total_diterima: undefined }) });
    expect(ambil(items, 'lainnya')).toEqual([0]);
    expect(pesanan[0].belumCair).toBe(false);
  });

  it('selisih negatif → SELISIH_REKONSILIASI dengan kemungkinan penyebab', () => {
    const { items, c } = jalankan([baris('A1', 'S1', 1, 100000, { Diskon: 10000, Diterima: 95000 })]);
    expect(ambil(items, 'lainnya')).toEqual([-5000]);
    expect(c.masalah).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'SELISIH_REKONSILIASI', no_pesanan: 'A1', baris: 2 });
    expect(c.masalah[0].pesan).toBe(
      'Dana cair lebih besar Rp5.000 dari perhitungan. Kemungkinan harga_jual dipetakan ke harga setelah diskon ' +
        'sementara diskon_penjual juga dipetakan, atau ada subsidi dari marketplace.',
    );
  });

  it('selisih besar (> 50%) → SELISIH_REKONSILIASI', () => {
    const { items, c } = jalankan([baris('A1', 'S1', 1, 100000, { Diterima: 40000 })]);
    expect(ambil(items, 'lainnya')).toEqual([60000]);
    expect(c.masalah[0].pesan).toBe(
      'Potongan lainnya Rp60.000 (60,0% dari nilai pesanan). Periksa apakah ada kolom biaya yang belum dipetakan ' +
        'atau total_diterima dipetakan ke kolom yang salah.',
    );
  });

  it('selisih kecil tidak dicatat (−Rp1.000 s.d. 50%)', () => {
    expect(jalankan([baris('A1', 'S1', 1, 100000, { Diterima: 99500 })]).c.masalah).toEqual([]);
    expect(jalankan([baris('A1', 'S1', 1, 100000, { Diterima: 100800 })]).c.masalah).toEqual([]);
  });
});

describe('hitungItem — status', () => {
  it('retur: diskon/voucher tidak dihitung, biaya marketplace sesuai export, HPP 0', () => {
    const { items, pesanan } = jalankan([baris('A1', 'S1', 1, 50000, { Status: 'Retur', Diskon: 5000, Admin: 2000, Diterima: 0 })]);
    expect(items[0]).toMatchObject({ retur: true, nilai: 50000, diskon_voucher: 0, biaya_admin: 2000, hpp: 0, lainnya: 0 });
    expect(pesanan[0]).toMatchObject({ punyaRetur: true, belumCair: false });
  });

  it('retur barang rusak → HPP tetap dihitung', () => {
    const { items } = jalankan([baris('A1', 'S1', 1, 50000, { Status: 'Retur' })], { opsi: { retur_barang_rusak: true } });
    expect(items[0].hpp).toBe(30000);
  });

  // Dana diterima satu pesanan harus sama dengan total_diterima, termasuk saat sebagian item diretur.
  const danaPesanan = (items: ReturnType<typeof jalankan>['items']) =>
    items.reduce((a, i) => a + (i.retur ? 0 : i.nilai) - i.diskon_voucher - i.biaya_admin - i.biaya_layanan - i.ongkir - i.lainnya, 0);

  it('pesanan campuran selesai + retur, biaya bagian retur dikembalikan → dana = total_diterima', () => {
    const { items, pesanan, c } = jalankan([
      baris('A1', 'S1', 1, 60000, { Admin: 10000, Diterima: 54000 }),
      baris('A1', 'S2', 1, 40000, { Status: 'Retur' }),
    ]);
    expect(ambil(items, 'biaya_admin')).toEqual([6000, 4000]);
    expect(ambil(items, 'lainnya')).toEqual([-4000, 0]);
    expect(danaPesanan(items)).toBe(54000);
    expect(pesanan[0]).toMatchObject({ punyaRetur: true, belumCair: false });
    expect(c.masalah).toEqual([]);
  });

  it('pesanan campuran, biaya penuh tetap dipotong → dana = total_diterima, tanpa hitung ganda', () => {
    const { items, c } = jalankan([
      baris('A1', 'S1', 1, 60000, { Admin: 10000, Diterima: 50000 }),
      baris('A1', 'S2', 1, 40000, { Status: 'Retur' }),
    ]);
    expect(ambil(items, 'lainnya')).toEqual([0, 0]);
    expect(danaPesanan(items)).toBe(50000);
    expect(c.masalah).toEqual([]);
  });

  it('pesanan campuran dengan biaya level item → dana = total_diterima', () => {
    const m = mappingStd({ biaya_admin: { headers: ['Admin'] } });
    const { items } = jalankan([
      baris('A1', 'S1', 1, 100000, { Admin: 5000, Diterima: 90000 }),
      baris('A1', 'S2', 1, 50000, { Status: 'Retur', Admin: 5000 }),
    ], { mapping: m });
    expect(danaPesanan(items)).toBe(90000);
  });

  it('acak: setiap pesanan yang sudah cair → Σ dana item = total_diterima', () => {
    let s = 99;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 200; k++) {
      const n = 1 + Math.floor(r() * 4);
      const rows = Array.from({ length: n }, (_, i) => baris('A1', `S${i + 1}`, 1 + Math.floor(r() * 3), 1000 * (1 + Math.floor(r() * 90)), {
        Status: i > 0 && r() < 0.4 ? 'Retur' : 'Selesai',
        Diskon: Math.floor(r() * 3) * 500,
        Admin: i === 0 ? Math.floor(r() * 20) * 500 : null,
        Voucher: i === 0 ? Math.floor(r() * 4) * 1000 : null,
        Diterima: i === 0 ? 1000 + Math.floor(r() * 200) * 1000 : null,
      }));
      const { items, pesanan } = jalankan(rows);
      if (pesanan[0].belumCair) continue;
      expect(danaPesanan(items)).toBe(rows[0].Diterima);
    }
  });

  it('baris batal dikeluarkan; pesanan batal tidak menghasilkan item', () => {
    const { items, pesanan } = jalankan([
      baris('B1', 'S1', 1, 50000, { Status: 'Batal' }),
      baris('C1', 'S1', 1, 60000, { Admin: 10000, Diterima: 50000 }),
      baris('C1', 'S2', 1, 40000, { Status: 'Batal' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ no_pesanan: 'C1', sku: 'S1', biaya_admin: 10000, lainnya: 0 });
    expect(pesanan.map((p) => p.no_pesanan)).toEqual(['C1']);
  });
});

describe('hitungItem — HPP & packaging', () => {
  it('HPP = hpp_sku × qty; nama jatuh ke tab HPP', () => {
    const { items } = jalankan([baris('A1', 'S1', 2, 50000)]);
    expect(items[0]).toMatchObject({ hpp: 60000, hpp_tersedia: true, nama: 'Kopi A' });
  });

  it('SKU tanpa HPP: HPP 0 dan dicatat sekali per SKU', () => {
    const { items, c } = jalankan([baris('A1', 'S9', 1, 1000), baris('A2', 'S9', 1, 1000)]);
    expect(ambil(items, 'hpp')).toEqual([0, 0]);
    expect(items.every((i) => !i.hpp_tersedia)).toBe(true);
    expect(c.jumlah).toEqual({ SKU_TANPA_HPP: 1 });
    expect(c.masalah[0]).toMatchObject({ jenis: 'SKU_TANPA_HPP', sku: 'S9', baris: 2 });
    expect(c.masalah[0].pesan).toBe('SKU S9 belum ada di tab HPP (2 baris). HPP dianggap 0.');
  });

  it('packaging per pesanan dibagi menurut nilai; berlaku juga untuk retur', () => {
    const { items } = jalankan(
      [baris('A1', 'S1', 1, 60000), baris('A1', 'S2', 1, 40000), baris('A2', 'S1', 1, 50000, { Status: 'Retur' })],
      { tarif: 1500 },
    );
    expect(ambil(items, 'packaging')).toEqual([900, 600, 1500]);
  });

  // --- Review Focus ---
  it('SKU cocok dengan tab HPP tanpa beda huruf/spasi', () => {
    const { items } = jalankan([baris('A1', ' s1 ', 1, 50000)]);
    expect(items[0]).toMatchObject({ hpp: 30000, hpp_tersedia: true });
  });
});

describe('bangunHpp', () => {
  it('hpp tak terbaca dilewati; SKU ganda → baris pertama', () => {
    const peta = bangunHpp([
      { sku: 'A', hpp: 'x' },
      { sku: 'B', hpp: 'Rp 12.500', nama: ' Kopi ' },
      { sku: 'b', hpp: 99 },
      { sku: null, hpp: 1 },
    ]);
    expect([...peta.entries()]).toEqual([['b', { hpp: 12500, nama: 'Kopi' }]]);
  });
});
