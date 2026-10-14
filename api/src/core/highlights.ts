import { formatAngka, formatPersen, formatRupiah } from './format.js';
import type { BarisPlatform, BarisProduk, Opsi, Sorotan } from './types.js';

/** Spec §6.11. */
export function buatSorotan(produk: BarisProduk[], platform: BarisPlatform[], opsi: Opsi): Sorotan[] {
  const hasil: Sorotan[] = [];

  const peringkat = produk.filter((p) => p.qty > 0).sort((a, b) => b.qty - a.qty || a.sku.localeCompare(b.sku));
  const n = Math.min(peringkat.length, Math.max(3, Math.ceil((peringkat.length * opsi.ambang_laris_persen) / 100)));
  peringkat.slice(0, n).forEach((p, i) => {
    if (!p.hpp_tersedia) return;
    const awal = `${p.nama} terjual ${formatAngka(p.qty)} pcs (terlaris #${i + 1}) tetapi`;
    if (p.laba_kontribusi < 0) {
      hasil.push({
        jenis: 'LARIS_TAPI_RUGI',
        teks: `${awal} rugi ${formatRupiah(-p.laba_kontribusi)} (margin ${formatPersen(p.margin_persen)}).`,
        sku: p.sku, platform: null,
      });
    } else if (p.margin_persen < opsi.ambang_margin_tipis_persen) {
      hasil.push({
        jenis: 'LARIS_MARGIN_TIPIS',
        teks: `${awal} marginnya tipis: ${formatPersen(p.margin_persen)} (laba ${formatRupiah(p.laba_kontribusi)}).`,
        sku: p.sku, platform: null,
      });
    }
  });

  produk
    .filter((p) => p.laba_kontribusi > 0)
    .sort((a, b) => b.laba_kontribusi - a.laba_kontribusi || a.sku.localeCompare(b.sku))
    .slice(0, 3)
    .forEach((p, i) => hasil.push({
      jenis: 'PRODUK_PALING_UNTUNG',
      teks: `${p.nama} produk paling untung #${i + 1}: laba ${formatRupiah(p.laba_kontribusi)} (margin ${formatPersen(p.margin_persen)}).`,
      sku: p.sku, platform: null,
    }));

  const untung = platform.filter((p) => p.laba_kontribusi > 0).sort((a, b) => b.laba_kontribusi - a.laba_kontribusi)[0];
  if (untung) {
    hasil.push({
      jenis: 'PLATFORM_PALING_UNTUNG',
      teks: `${untung.platform} paling untung: laba kontribusi ${formatRupiah(untung.laba_kontribusi)} (margin ${formatPersen(untung.margin_persen)}).`,
      sku: null, platform: untung.platform,
    });
  }
  const terbaik = platform
    .filter((p) => p.penjualan_bersih > 0 && p.margin_persen > 0)
    .sort((a, b) => b.margin_persen - a.margin_persen)[0];
  if (terbaik && terbaik.platform !== untung?.platform) {
    hasil.push({
      jenis: 'PLATFORM_MARGIN_TERBAIK',
      teks: `${terbaik.platform} punya margin terbaik: ${formatPersen(terbaik.margin_persen)}.`,
      sku: null, platform: terbaik.platform,
    });
  }
  return hasil;
}
