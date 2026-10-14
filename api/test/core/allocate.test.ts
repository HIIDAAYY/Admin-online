import { describe, expect, it } from 'vitest';
import { allocate, bobotItem } from '../../src/core/allocate.js';

describe('allocate', () => {
  it.each([
    [100, [1, 2, 1], [25, 50, 25]],
    [10, [1, 2, 3, 4], [1, 2, 3, 4]],
    [10, [1, 1, 1], [4, 3, 3]], // seri: indeks lebih awal didahulukan
    [100, [1, 1, 1], [34, 33, 33]],
    [5, [2, 3, 5], [1, 2, 2]], // pecahan .5 seri → indeks 1 dulu
    [14000, [100000, 80000], [7778, 6222]],
    [1, [1, 1, 1], [1, 0, 0]],
    [7, [5], [7]],
    [0, [1, 2], [0, 0]],
    [10, [3, 7, 0], [3, 7, 0]],
  ])('allocate(%d, %j) = %j', (total, bobot, hasil) => {
    expect(allocate(total, bobot)).toEqual(hasil);
  });

  it('total negatif', () => expect(allocate(-10, [1, 1, 1])).toEqual([-4, -3, -3]));
  it('semua bobot nol → rata', () => expect(allocate(5, [0, 0])).toEqual([3, 2]));
  it('bobot negatif dianggap nol', () => expect(allocate(10, [-5, 10])).toEqual([0, 10]));
  it('tanpa bobot → []', () => expect(allocate(10, [])).toEqual([]));

  it('jumlah selalu sama dengan total, semua bulat (500 kasus acak)', () => {
    let s = 12345;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 500; k++) {
      const n = 1 + Math.floor(r() * 8);
      const bobot = Array.from({ length: n }, () => (r() < 0.2 ? 0 : Math.floor(r() * 100000)));
      const total = Math.floor(r() * 2_000_000) - 500_000;
      const hasil = allocate(total, bobot);
      expect(hasil.reduce((a, b) => a + b, 0)).toBe(total);
      for (const x of hasil) expect(Number.isInteger(x)).toBe(true);
    }
  });
});

describe('bobotItem', () => {
  it('memakai nilai bila ada', () => expect(bobotItem([{ nilai: 6, qty: 1 }, { nilai: 4, qty: 9 }])).toEqual([6, 4]));
  it('nilai nol semua → qty', () => expect(bobotItem([{ nilai: 0, qty: 1 }, { nilai: 0, qty: 3 }])).toEqual([1, 3]));
  it('qty nol semua → rata', () => expect(bobotItem([{ nilai: 0, qty: 0 }, { nilai: 0, qty: 0 }])).toEqual([1, 1]));
});
