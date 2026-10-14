import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/core/analyze.js';
import { BRAND_DEMO, SKU_DEMO_TANPA_HPP, bulanPenuhTerakhir, buatDemo, demoKeAnalyzeInput, geserBulan } from '../../src/core/demo.js';

const demo = buatDemo({ seed: 42, bulan_akhir: '2026-09' });

describe('buatDemo — struktur', () => {
  it('deterministik untuk seed & bulan_akhir yang sama', () => {
    expect(buatDemo({ seed: 42, bulan_akhir: '2026-09' })).toEqual(demo);
  });

  it('seed berbeda → data berbeda', () => {
    expect(buatDemo({ seed: 7, bulan_akhir: '2026-09' })).not.toEqual(demo);
  });

  it('brand & lima tab', () => {
    expect(demo.brand).toBe(BRAND_DEMO);
    expect(Object.keys(demo.tabs).sort()).toEqual(['Biaya', 'HPP', 'Pesanan - Shopee', 'Pesanan - TikTok Shop', 'Pesanan - Tokopedia']);
    for (const n of ['Pesanan - Shopee', 'Pesanan - TikTok Shop', 'Pesanan - Tokopedia']) {
      expect(demo.tabs[n].mapping).toBeDefined();
      expect(demo.tabs[n].rows.every((r) => r.length === demo.tabs[n].header.length)).toBe(true);
    }
  });

  it('header tiap platform berbeda', () => {
    const h = ['Pesanan - Shopee', 'Pesanan - TikTok Shop', 'Pesanan - Tokopedia'].map((n) => demo.tabs[n].header[0]);
    expect(new Set(h).size).toBe(3);
  });

  it('HPP 14 produk; satu SKU sengaja tidak ada', () => {
    expect(demo.tabs['HPP'].header).toEqual(['sku', 'nama', 'hpp']);
    expect(demo.tabs['HPP'].rows).toHaveLength(14);
    expect(demo.tabs['HPP'].rows.some((r) => r[0] === SKU_DEMO_TANPA_HPP)).toBe(false);
  });

  it('tab Biaya hanya berisi 3 bulan periode', () => {
    expect(demo.tabs['Biaya'].header).toEqual(['bulan', 'jenis', 'platform', 'nilai', 'keterangan']);
    expect([...new Set(demo.tabs['Biaya'].rows.map((r) => r[0]))]).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('dua pola biaya level pesanan: TikTok hanya baris pertama, Shopee diulang', () => {
    const tt = demo.tabs['Pesanan - TikTok Shop'];
    const iSet = tt.header.indexOf('Settlement Amount');
    const lanjutTt = tt.rows.filter((r, i) => i > 0 && r[0] === tt.rows[i - 1][0]);
    expect(lanjutTt.length).toBeGreaterThan(0);
    expect(lanjutTt.every((r) => r[iSet] === null)).toBe(true);

    const sp = demo.tabs['Pesanan - Shopee'];
    const iDana = sp.header.indexOf('Dana Dilepas');
    const lanjutSp = sp.rows.filter((r, i) => i > 0 && r[0] === sp.rows[i - 1][0]);
    expect(lanjutSp.length).toBeGreaterThan(0);
    expect(lanjutSp.every((r) => r[iDana] === sp.rows.find((x) => x[0] === r[0])![iDana])).toBe(true);
  });
});

describe('bulan_akhir bawaan', () => {
  it('bulan penuh terakhir menurut WIB', () => {
    expect(bulanPenuhTerakhir(new Date('2026-10-14T03:00:00Z'))).toBe('2026-09');
    expect(bulanPenuhTerakhir(new Date('2026-09-30T17:30:00Z'))).toBe('2026-09'); // 1 Okt 00:30 WIB
    expect(bulanPenuhTerakhir(new Date('2026-09-30T16:30:00Z'))).toBe('2026-08'); // 30 Sep 23:30 WIB
    expect(bulanPenuhTerakhir(new Date('2027-01-05T00:00:00Z'))).toBe('2026-12');
  });

  it('geserBulan melintasi tahun', () => {
    expect(geserBulan('2026-01', -2)).toBe('2025-11');
    expect(geserBulan('2026-12', 1)).toBe('2027-01');
  });

  it('buatDemo tanpa bulan_akhir memakai sekarang', () => {
    expect(buatDemo({ seed: 1, sekarang: new Date('2026-10-14T03:00:00Z') }).tabs['Biaya'].rows[0][0]).toBe('2026-07');
  });
});

describe('analyze atas data demo — cerita demo muncul', () => {
  const lap = analyze(demoKeAnalyzeInput(demo));

  it('15 produk, 3 platform, 3 bulan', () => {
    expect(lap.per_produk).toHaveLength(15);
    expect(lap.per_platform.map((p) => p.platform)).toEqual(['Shopee', 'TikTok Shop', 'Tokopedia']);
    expect(lap.ringkasan.periode).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('masalah data sesuai skenario: 2 duplikat, 1 SKU tanpa HPP, 1 baris rusak', () => {
    expect(lap.jumlah_masalah).toEqual({ DUPLIKAT: 2, SKU_TANPA_HPP: 1, BARIS_GAGAL_DIBACA: 1 });
  });

  it('minimal dua produk laris yang rugi', () => {
    expect(lap.sorotan.filter((s) => s.jenis === 'LARIS_TAPI_RUGI').length).toBeGreaterThanOrEqual(2);
  });

  it('SKU tanpa HPP tidak disorot sebagai produk paling untung', () => {
    expect(lap.sorotan.filter((s) => s.jenis === 'PRODUK_PALING_UNTUNG').map((s) => s.sku)).not.toContain(SKU_DEMO_TANPA_HPP);
  });

  it('ada pesanan batal, retur, dan belum cair', () => {
    expect(lap.ringkasan.jumlah_pesanan_batal).toBeGreaterThan(0);
    expect(lap.ringkasan.jumlah_pesanan_retur).toBeGreaterThan(0);
    expect(lap.ringkasan.jumlah_pesanan_belum_cair).toBeGreaterThan(0);
  });

  it('info hanya PESANAN_BELUM_CAIR (tanpa bulan tidak penuh / biaya di luar periode)', () => {
    expect([...new Set(lap.info.map((i) => i.jenis))]).toEqual(['PESANAN_BELUM_CAIR']);
    expect(lap.ringkasan.iklan_tidak_teralokasi).toBe(0);
  });
});
