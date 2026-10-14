import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { ekstrakBaris } from '../../src/core/extract.js';
import { baris, mappingStd, tab, tangkap } from './helpers.js';

const jalan = (input: Parameters<typeof ekstrakBaris>[0]) => {
  const c = new Catatan();
  return { ...ekstrakBaris(input, c), c };
};

describe('ekstrakBaris', () => {
  it('membaca baris standar: angka teks, biaya dimutlakkan, level item/pesanan', () => {
    const { baris: b, c, statusDipetakan } = jalan(
      tab('Shopee', [baris('A1', 'S1', 2, 'Rp 50.000', { Diskon: -1000, Admin: '8.000', Diterima: 90000, Nama: 'Kopi A' })]),
    );
    expect(statusDipetakan).toBe(true);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({
      platform: 'Shopee', sheet: 'Pesanan - Shopee', baris: 2, no_pesanan: 'A1', sku: 'S1',
      nama: 'Kopi A', qty: 2, nilai: 100000, status: 'selesai',
    });
    expect(b[0].waktu).toBe(Date.UTC(2026, 6, 10, 3, 0));
    expect(b[0].biayaItem).toEqual({
      diskon_penjual: 1000, voucher_penjual: 0, biaya_admin: 0, biaya_layanan: 0, ongkir_ditanggung_penjual: 0,
    });
    expect(b[0].biayaOrder).toEqual({
      voucher_penjual: null, biaya_admin: 8000, biaya_layanan: null, ongkir_ditanggung_penjual: null, total_diterima: 90000,
    });
    expect(c.masalah).toEqual([]);
  });

  it('harga_jual_basis = baris memakai harga sebagai total baris', () => {
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 2, 100000)], mappingStd({}, { options: { harga_jual_basis: 'baris' } })));
    expect(b[0].nilai).toBe(100000);
  });

  it('beberapa header dijumlahkan dulu lalu dimutlakkan', () => {
    const m = mappingStd({ biaya_admin: { headers: ['Admin', 'Layanan'] }, biaya_layanan: undefined });
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000, { Admin: -3000, Layanan: -2000 })], m));
    expect(b[0].biayaItem.biaya_admin).toBe(5000);
  });

  it('baris kosong dilewati tanpa masalah, nomor baris tetap sesuai sheet', () => {
    const { baris: b, c } = jalan(tab('Shopee', [{}, baris('A1', 'S1', 1, 1000)]));
    expect(b).toHaveLength(1);
    expect(b[0].baris).toBe(3);
    expect(c.masalah).toEqual([]);
  });

  it('KOLOM_WAJIB_KOSONG melewati baris', () => {
    const { baris: b, c } = jalan(tab('Shopee', [baris('A1', '', 1, 1000)]));
    expect(b).toEqual([]);
    expect(c.masalah).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'KOLOM_WAJIB_KOSONG', tingkat: 'error', baris: 2, sheet: 'Pesanan - Shopee' });
    expect(c.masalah[0].pesan).toContain('sku');
  });

  it('BARIS_GAGAL_DIBACA untuk angka atau tanggal tak terbaca', () => {
    const { baris: b, c } = jalan(tab('Shopee', [
      baris('A1', 'S1', 'dua', 1000),
      baris('A2', 'S1', 1, 1000, { Tanggal: 'kemarin' }),
      baris('A3', 'S1', 1, 1000, { Admin: 'gratis' }),
    ]));
    expect(b).toEqual([]);
    expect(c.jumlah).toEqual({ BARIS_GAGAL_DIBACA: 3 });
    expect(c.masalah[0].pesan).toContain('qty');
    expect(c.masalah[1].pesan).toContain('tanggal "kemarin"');
    expect(c.masalah[2].pesan).toContain('biaya_admin');
  });

  it('STATUS_TIDAK_DIKENAL dianggap selesai', () => {
    const { baris: b, c } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000, { Status: 'Sedang Dikemas' })]));
    expect(b[0].status).toBe('selesai');
    expect(c.masalah[0]).toMatchObject({ jenis: 'STATUS_TIDAK_DIKENAL', tingkat: 'peringatan' });
    expect(c.masalah[0].pesan).toContain('Sedang Dikemas');
  });

  it('status_map dipakai', () => {
    const m = mappingStd({}, { status_map: { Selesai: 'selesai', Kembali: 'retur' } });
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000, { Status: 'Kembali' })], m));
    expect(b[0].status).toBe('retur');
  });

  it('status tidak dipetakan → semua selesai, tanpa masalah', () => {
    const { baris: b, c, statusDipetakan } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000, { Status: 'Batal' })], mappingStd({ status: undefined })));
    expect(statusDipetakan).toBe(false);
    expect(b[0].status).toBe('selesai');
    expect(c.masalah).toEqual([]);
  });

  it('total_diterima tidak dipetakan → kuncinya tidak ada di biayaOrder', () => {
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000)], mappingStd({ total_diterima: undefined })));
    expect('total_diterima' in b[0].biayaOrder).toBe(false);
  });

  it('header pemetaan tidak ada di sheet → HEADER_TIDAK_DITEMUKAN', () => {
    const e = tangkap(() => ekstrakBaris(tab('Shopee', [], mappingStd({ sku: { headers: ['Kode SKU'] } })), new Catatan()));
    expect(e.code).toBe('HEADER_TIDAK_DITEMUKAN');
    expect(e.detail).toEqual(['Kode SKU']);
  });

  it('field wajib tidak dipetakan → PEMETAAN_TIDAK_LENGKAP', () => {
    const e = tangkap(() => ekstrakBaris(tab('Shopee', [], mappingStd({ qty: undefined })), new Catatan()));
    expect(e.code).toBe('PEMETAAN_TIDAK_LENGKAP');
    expect(e.detail).toEqual(['qty']);
  });

  // --- Review Focus ---
  it('header pemetaan cocok tanpa beda spasi dan huruf besar', () => {
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000)], mappingStd({ no_pesanan: { headers: [' no '] } })));
    expect(b[0].no_pesanan).toBe('A1');
  });

  it('baris lebih pendek dari header: sel yang hilang dianggap kosong', () => {
    const input = tab('Shopee', []);
    input.rows = [['A1', '2026-07-10 10:00', 'Selesai', 'S1', null, 1, 1000]];
    const { baris: b, c } = jalan(input);
    expect(b).toHaveLength(1);
    expect(b[0].biayaItem.diskon_penjual).toBe(0);
    expect(b[0].biayaOrder.biaya_admin).toBeNull();
    expect(c.masalah).toEqual([]);
  });

  it('angka desimal dari rumus Sheets dibulatkan per sel', () => {
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 3, 15000.4, { Admin: 999.6 })]));
    expect(b[0].nilai).toBe(45000);
    expect(b[0].biayaOrder.biaya_admin).toBe(1000);
  });
});
