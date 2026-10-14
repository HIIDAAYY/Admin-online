import { describe, expect, it } from 'vitest';
import { kosong, kunci, parseAngka } from '../../src/core/parse.js';

describe('parseAngka', () => {
  it.each([
    [1250000, 1250000],
    ['1250000', 1250000],
    ['Rp 1.250.000', 1250000],
    ['Rp1.250.000', 1250000],
    ['IDR 85.000', 85000],
    ['1.250.000,50', 1250000.5],
    ['1,250,000', 1250000],
    ['1,250,000.50', 1250000.5],
    ['-1.500', -1500],
    ['(1.500)', -1500],
    ['Rp -1.500', -1500],
    ['−2.000', -2000],
    ['1.250', 1250], // satu titik + 3 digit = ribuan (format Indonesia)
    ['12.5', 12.5],
    ['1250,5', 1250.5],
    ['1,25', 1.25],
    [' 15000 ', 15000],
    [-6800, -6800],
  ])('%j → %d', (masuk, keluar) => {
    expect(parseAngka(masuk)).toBe(keluar);
  });

  it.each([null, undefined, '', '   ', '-'])('%j dianggap kosong', (v) => {
    expect(parseAngka(v)).toBeNull();
  });

  it.each(['abc', 'dua', '12a', 'Rp', true, Number.NaN, Infinity, '1,2,3.4.5'])('%j tidak terbaca (NaN)', (v) => {
    expect(parseAngka(v)).toBeNaN();
  });
});

describe('kosong & kunci', () => {
  it('kosong', () => {
    expect(kosong(null)).toBe(true);
    expect(kosong(undefined)).toBe(true);
    expect(kosong('  ')).toBe(true);
    expect(kosong(0)).toBe(false);
    expect(kosong('x')).toBe(false);
  });
  it('kunci = trim + huruf kecil', () => expect(kunci('  SR-01 ')).toBe('sr-01'));
});
