import { describe, expect, it } from 'vitest';
import { formatAngka, formatPersen, formatRupiah, namaBulan, namaBulanSaja } from '../../src/core/format.js';

describe('formatRupiah', () => {
  it('titik ribuan tanpa spasi', () => expect(formatRupiah(1240500)).toBe('Rp1.240.500'));
  it('negatif memakai minus U+2212', () => expect(formatRupiah(-3222)).toBe('−Rp3.222'));
  it('nol', () => expect(formatRupiah(0)).toBe('Rp0'));
  it('dibulatkan', () => expect(formatRupiah(999.6)).toBe('Rp1.000'));
});

describe('formatPersen', () => {
  it('satu desimal dengan koma', () => {
    expect(formatPersen(23.5)).toBe('23,5%');
    expect(formatPersen(28)).toBe('28,0%');
  });
  it('negatif', () => expect(formatPersen(-8.3)).toBe('−8,3%'));
});

describe('formatAngka', () => {
  it('titik ribuan', () => expect(formatAngka(1412)).toBe('1.412'));
});

describe('namaBulan', () => {
  it('nama bulan Indonesia', () => {
    expect(namaBulan('2026-07')).toBe('Juli 2026');
    expect(namaBulan('2027-01')).toBe('Januari 2027');
    expect(namaBulanSaja('2026-08')).toBe('Agustus');
  });
});
