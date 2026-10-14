import { describe, expect, it } from 'vitest';
import { bulanJakarta, hariDalamBulan, parseBulan, parseTanggal, tanggalJakarta } from '../../src/core/parse.js';

const bulanDari = (v: unknown) => bulanJakarta(parseTanggal(v) as number);
const seriSheets = (y: number, mo: number, d: number, h: number, mi: number) =>
  (Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(1899, 11, 30)) / 86_400_000;

describe('parseTanggal + bulanJakarta di sekitar pergantian bulan', () => {
  it.each([
    ['2026-07-31T23:59:59+07:00', '2026-07'],
    ['2026-07-31T17:00:00Z', '2026-08'], // 1 Agustus 00:00 WIB
    ['2026-07-31T16:59:59Z', '2026-07'],
    ['31/07/2026 23:59', '2026-07'],
    ['01/08/2026 00:00', '2026-08'],
    ['2026-12-31T17:30:00Z', '2027-01'], // pergantian tahun
    ['2026-07-31 23:30:00', '2026-07'], // tanpa offset = WIB
    ['31-07-2026 23:30', '2026-07'],
    ['2026/08/01', '2026-08'],
  ])('%s → %s', (v, bulan) => {
    expect(bulanDari(v)).toBe(bulan);
  });

  it('nomor seri Sheets dibaca sebagai waktu WIB, termasuk malam pergantian bulan', () => {
    expect(bulanDari(seriSheets(2026, 7, 31, 23, 59))).toBe('2026-07');
    expect(bulanDari(seriSheets(2026, 8, 1, 0, 0))).toBe('2026-08');
    expect(tanggalJakarta(parseTanggal(seriSheets(2026, 8, 1, 0, 0)) as number)).toBe('2026-08-01');
  });

  it('dd/mm diutamakan daripada mm/dd', () => {
    expect(tanggalJakarta(parseTanggal('03/07/2026') as number)).toBe('2026-07-03');
  });

  it('instan tepat', () => {
    expect(parseTanggal('2026-07-31T23:30:00+07:00')).toBe(Date.UTC(2026, 6, 31, 16, 30));
  });

  it.each(['31/02/2026', '2026-13-01', 'kemarin', '25:00', true, '01/01/1990'])('%j tidak terbaca', (v) => {
    expect(parseTanggal(v)).toBeNaN();
  });

  it.each([null, '', '  '])('%j kosong', (v) => {
    expect(parseTanggal(v)).toBeNull();
  });
});

describe('tanggalJakarta', () => {
  it('17:30 UTC tanggal 31 Juli = 1 Agustus WIB', () => {
    expect(tanggalJakarta(Date.UTC(2026, 6, 31, 17, 30))).toBe('2026-08-01');
  });
});

describe('hariDalamBulan', () => {
  it.each([['2026-07', 31], ['2026-09', 30], ['2026-02', 28], ['2028-02', 29]])('%s → %d', (b, n) => {
    expect(hariDalamBulan(b as string)).toBe(n);
  });
});

describe('parseBulan', () => {
  it.each([
    ['2026-07', '2026-07'],
    ['2026-7', '2026-07'],
    ['07/2026', '2026-07'],
    ['7-2026', '2026-07'],
    ['Juli 2026', '2026-07'],
    ['Agt 2026', '2026-08'],
    ['Des 2026', '2026-12'],
    ['2026-07-01T00:00:00+07:00', '2026-07'],
    ['2026-06-30T17:00:00Z', '2026-07'],
  ])('%j → %s', (v, b) => {
    expect(parseBulan(v)).toBe(b);
  });

  it.each(['2026-13', 'abc', '', null])('%j → null', (v) => {
    expect(parseBulan(v)).toBeNull();
  });
});
