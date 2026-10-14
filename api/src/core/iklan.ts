import { allocate } from './allocate.js';
import type { Catatan } from './catatan.js';
import { formatRupiah, namaBulan } from './format.js';
import { kunci } from './parse.js';
import type { BiayaValid, IklanProduk, IklanSisa, ItemHasil } from './types.js';

/** Spec §6.8: iklan(p,b) dibagi ke produk menurut omzet kotor produk di platform p bulan b. */
export function alokasiIklan(
  items: ItemHasil[],
  biaya: BiayaValid[],
  catatan: Catatan,
): { produk: IklanProduk[]; sisa: IklanSisa[] } {
  const total = new Map<string, IklanSisa>();
  for (const b of biaya) {
    if (b.jenis !== 'iklan' || !b.platform) continue;
    const k = `${kunci(b.platform)}|${b.bulan}`;
    const x = total.get(k);
    if (x) x.nilai += b.nilai;
    else total.set(k, { platform: b.platform.trim(), bulan: b.bulan, nilai: b.nilai });
  }

  const omzet = new Map<string, Map<string, { platform: string; sku: string; nilai: number }>>();
  for (const it of items) {
    const k = `${kunci(it.platform)}|${it.bulan}`;
    let perSku = omzet.get(k);
    if (!perSku) omzet.set(k, (perSku = new Map()));
    const s = perSku.get(kunci(it.sku));
    if (s) s.nilai += it.nilai;
    else perSku.set(kunci(it.sku), { platform: it.platform, sku: it.sku, nilai: it.nilai });
  }

  const produk: IklanProduk[] = [];
  const sisa: IklanSisa[] = [];
  for (const [k, t] of total) {
    if (t.nilai === 0) continue;
    const daftar = [...(omzet.get(k)?.values() ?? [])];
    if (daftar.reduce((a, d) => a + d.nilai, 0) <= 0) {
      sisa.push(t);
      catatan.tambah({
        jenis: 'IKLAN_TIDAK_TERALOKASI', platform: t.platform, sheet: 'Biaya',
        pesan:
          `Iklan ${t.platform} ${namaBulan(t.bulan)} sebesar ${formatRupiah(t.nilai)} tidak bisa dibagi karena ` +
          `tidak ada penjualan ${t.platform} di bulan itu. Tetap mengurangi laba bersih.`,
      });
      continue;
    }
    const bagian = allocate(t.nilai, daftar.map((d) => d.nilai));
    daftar.forEach((d, i) => {
      if (bagian[i] !== 0) produk.push({ platform: d.platform, bulan: t.bulan, sku: d.sku, nilai: bagian[i] });
    });
  }
  return { produk, sisa };
}
