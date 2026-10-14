import { describe, expect, it } from 'vitest';
import { buatTarifPackaging, saringPeriode, validasiBiaya } from '../../src/core/biaya.js';
import { Catatan } from '../../src/core/catatan.js';
import type { BiayaInput } from '../../src/core/types.js';
import { biaya } from './helpers.js';

describe('validasiBiaya', () => {
  it('menerima & menormalkan baris valid', () => {
    const c = new Catatan();
    const hasil = validasiBiaya([
      biaya('2026-07', 'Iklan', 1500000, 'Shopee'),
      { bulan: 'Juli 2026', jenis: ' tetap ', platform: '', nilai: 'Rp 3.000.000', keterangan: 'gaji' },
    ], c);
    expect(hasil).toEqual([
      { baris: 2, bulan: '2026-07', jenis: 'iklan', platform: 'Shopee', nilai: 1500000, keterangan: '' },
      { baris: 3, bulan: '2026-07', jenis: 'tetap', platform: null, nilai: 3000000, keterangan: 'gaji' },
    ]);
    expect(c.masalah).toEqual([]);
  });

  it('baris kosong dilewati diam-diam', () => {
    const c = new Catatan();
    expect(validasiBiaya([{ bulan: null, jenis: null, platform: null, nilai: null, keterangan: null }], c)).toEqual([]);
    expect(c.masalah).toEqual([]);
  });

  it.each<[BiayaInput, string]>([
    [{ bulan: 'abc', jenis: 'tetap', nilai: 1 }, 'bulan'],
    [{ bulan: '2026-07', jenis: 'gaji', nilai: 1 }, 'jenis'],
    [{ bulan: '2026-07', jenis: 'tetap', nilai: -5 }, 'nilai'],
    [{ bulan: '2026-07', jenis: 'tetap', nilai: 'x' }, 'nilai'],
    [{ bulan: '2026-07', jenis: 'iklan', nilai: 1 }, 'platform'],
  ])('%j → BIAYA_TIDAK_VALID (%s)', (row, kata) => {
    const c = new Catatan();
    expect(validasiBiaya([row], c)).toEqual([]);
    expect(c.masalah[0]).toMatchObject({ jenis: 'BIAYA_TIDAK_VALID', sheet: 'Biaya', baris: 2 });
    expect(c.masalah[0].pesan).toContain(kata);
  });
});

describe('saringPeriode', () => {
  it('biaya di luar periode diabaikan dan dilaporkan sebagai info', () => {
    const c = new Catatan();
    const valid = validasiBiaya([
      biaya('2026-06', 'iklan', 100000, 'Shopee'),
      biaya('2026-06', 'tetap', 50000),
      biaya('2026-06', 'packaging', 1000),
      biaya('2026-07', 'tetap', 70000),
    ], c);
    const di = saringPeriode(valid, new Set(['2026-07']), c);
    expect(di.map((b) => b.bulan)).toEqual(['2026-07']);
    expect(c.masalah).toEqual([]);
    expect(c.info).toEqual([{
      jenis: 'BIAYA_DI_LUAR_PERIODE',
      platform: null,
      jumlah: 1,
      pesan: 'Biaya untuk 1 bulan di luar periode data diabaikan (Juni 2026), total Rp150.000. Tarif packaging bulan tersebut juga diabaikan.',
      detail: [{ bulan: '2026-06', total_diabaikan: 150000, tarif_packaging_diabaikan: 1000 }],
    }]);
  });

  it('tanpa info bila semua di dalam periode', () => {
    const c = new Catatan();
    saringPeriode(validasiBiaya([biaya('2026-07', 'tetap', 1)], c), new Set(['2026-07']), c);
    expect(c.info).toEqual([]);
  });
});

describe('buatTarifPackaging', () => {
  it('tarif per platform mengalahkan tarif umum; baris sejenis dijumlahkan', () => {
    const c = new Catatan();
    const tarif = buatTarifPackaging(validasiBiaya([
      biaya('2026-07', 'packaging', 1000),
      biaya('2026-07', 'packaging', 500),
      biaya('2026-07', 'packaging', 2000, 'TikTok Shop'),
    ], c));
    expect(tarif('Shopee', '2026-07')).toBe(1500);
    expect(tarif('tiktok shop', '2026-07')).toBe(2000);
    expect(tarif('Shopee', '2026-08')).toBe(0);
  });
});
