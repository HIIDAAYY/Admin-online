import { describe, expect, it } from 'vitest';
import { klasifikasiStatus, tebakStatus } from '../../src/core/status.js';

describe('tebakStatus', () => {
  it.each([
    ['Selesai', 'selesai'], ['Pesanan Selesai', 'selesai'], ['Completed', 'selesai'], ['Delivered', 'selesai'],
    ['Batal', 'batal'], ['Dibatalkan Pembeli', 'batal'], ['Cancelled', 'batal'],
    ['Retur', 'retur'], ['Pengembalian Dana', 'retur'], ['Returned', 'retur'], ['Refund', 'retur'],
    ['Dikomplain - Retur', 'retur'],
    ['Sedang Dikemas', null], ['', null],
  ])('%j → %j', (raw, hasil) => {
    expect(tebakStatus(raw as string)).toBe(hasil);
  });
});

describe('klasifikasiStatus', () => {
  it('status_map diutamakan', () => {
    expect(klasifikasiStatus('Selesai', { Selesai: 'retur' })).toEqual({ status: 'retur', dikenal: true });
  });
  it('status_map tanpa beda huruf/spasi', () => {
    expect(klasifikasiStatus(' selesai ', { Selesai: 'selesai' })).toEqual({ status: 'selesai', dikenal: true });
  });
  it('jatuh ke kata kunci bila tidak ada di status_map', () => {
    expect(klasifikasiStatus('Cancelled', {})).toEqual({ status: 'batal', dikenal: true });
  });
  it('tidak dikenal dianggap selesai', () => {
    expect(klasifikasiStatus('Sedang Dikemas', undefined)).toEqual({ status: 'selesai', dikenal: false });
  });
  it('kosong = tidak dikenal', () => {
    expect(klasifikasiStatus(null, undefined)).toEqual({ status: 'selesai', dikenal: false });
  });
});
