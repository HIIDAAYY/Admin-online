import { describe, expect, it } from 'vitest';
import { BATAS_MASALAH, Catatan } from '../../src/core/catatan.js';

describe('Catatan', () => {
  it('mengisi field kosong dengan null dan menurunkan tingkat dari jenis', () => {
    const c = new Catatan();
    c.tambah({ jenis: 'DUPLIKAT', pesan: 'x' });
    c.tambah({ jenis: 'KOLOM_WAJIB_KOSONG', pesan: 'y', baris: 5 });
    c.tambah({ jenis: 'BARIS_GAGAL_DIBACA', pesan: 'z' });
    expect(c.masalah[0]).toEqual({
      jenis: 'DUPLIKAT', tingkat: 'peringatan', platform: null, sheet: null,
      baris: null, no_pesanan: null, sku: null, pesan: 'x',
    });
    expect(c.masalah[1].tingkat).toBe('error');
    expect(c.masalah[1].baris).toBe(5);
    expect(c.masalah[2].tingkat).toBe('error');
  });

  it('membatasi daftar 1.000 tetapi tetap menghitung semuanya', () => {
    const c = new Catatan();
    for (let i = 0; i < 1200; i++) c.tambah({ jenis: 'DUPLIKAT', pesan: String(i) });
    expect(BATAS_MASALAH).toBe(1000);
    expect(c.masalah).toHaveLength(1000);
    expect(c.jumlah).toEqual({ DUPLIKAT: 1200 });
  });

  it('menyimpan info apa adanya', () => {
    const c = new Catatan();
    c.tambahInfo({ jenis: 'PESANAN_BELUM_CAIR', platform: 'Shopee', jumlah: 2, pesan: 'p' });
    expect(c.info).toEqual([{ jenis: 'PESANAN_BELUM_CAIR', platform: 'Shopee', jumlah: 2, pesan: 'p' }]);
  });
});
