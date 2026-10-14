import { allocate, bobotItem } from './allocate.js';
import type { Catatan } from './catatan.js';
import { formatPersen, formatRupiah } from './format.js';
import { kosong, kunci, parseAngka } from './parse.js';
import { FIELD_BIAYA } from './types.js';
import type { BarisItem, FieldBiaya, HppInput, ItemHasil, Opsi, Pesanan, RingkasPesanan } from './types.js';

export interface DataHpp {
  hpp: number;
  nama: string | null;
}
export interface KonteksHitung {
  hpp: Map<string, DataHpp>;
  tarifPackaging: (platform: string, bulan: string) => number;
  opsi: Opsi;
}
export interface HasilHitung {
  items: ItemHasil[];
  pesanan: RingkasPesanan[];
}

const AMBANG_SELISIH_NEGATIF = -1000;
const AMBANG_SELISIH_BESAR = 0.5;

export function bangunHpp(rows: HppInput[]): Map<string, DataHpp> {
  const peta = new Map<string, DataHpp>();
  for (const r of rows) {
    if (kosong(r.sku)) continue;
    const hpp = parseAngka(r.hpp);
    if (hpp === null || Number.isNaN(hpp)) continue;
    const k = kunci(String(r.sku));
    if (!peta.has(k)) peta.set(k, { hpp: Math.abs(hpp), nama: kosong(r.nama) ? null : String(r.nama).trim() });
  }
  return peta;
}

/** Spec §6.3–6.6, §6.8 (packaging), §6.10. */
export function hitungItem(daftar: Pesanan[], ktx: KonteksHitung, catatan: Catatan): HasilHitung {
  const items: ItemHasil[] = [];
  const ringkas: RingkasPesanan[] = [];
  const skuHilang = new Map<string, { contoh: BarisItem; jumlah: number }>();

  for (const p of daftar) {
    if (p.batal) continue;
    const baris = p.aktif;
    const bobot = bobotItem(baris);
    const retur = baris.map((b) => b.status === 'retur');

    // Biaya: bagian level item + bagian level pesanan yang dialokasikan menurut nilai item.
    const biaya = {} as Record<FieldBiaya, number[]>;
    for (const f of FIELD_BIAYA) {
      const bagian = allocate(p.nilaiOrder[f] ?? 0, bobot);
      const dikembalikan = f === 'diskon_penjual' || f === 'voucher_penjual';
      biaya[f] = baris.map((b, i) => (retur[i] && dikembalikan ? 0 : b.biayaItem[f] + bagian[i]));
    }
    const packaging = allocate(ktx.tarifPackaging(p.platform, p.bulan), bobot);

    // potongan_lainnya dari total_diterima, hanya atas item non-retur (spec §6.5).
    const lainnya = baris.map(() => 0);
    let belumCair = false;
    const nonRetur = baris.map((_, i) => i).filter((i) => !retur[i]);
    if ('total_diterima' in p.nilaiOrder && nonRetur.length > 0) {
      const diterima = p.nilaiOrder.total_diterima ?? 0;
      if (diterima === 0) {
        belumCair = true;
      } else {
        const nilai = nonRetur.reduce((a, i) => a + baris[i].nilai, 0);
        const terpetakan = nonRetur.reduce((a, i) => a + FIELD_BIAYA.reduce((s, f) => s + biaya[f][i], 0), 0);
        const selisih = nilai - terpetakan - diterima;
        const bagian = allocate(selisih, bobotItem(nonRetur.map((i) => baris[i])));
        nonRetur.forEach((i, k) => (lainnya[i] = bagian[k]));
        catatSelisih(selisih, nilai, p, baris[nonRetur[0]], catatan);
      }
    }

    baris.forEach((b, i) => {
      const k = kunci(b.sku);
      const h = ktx.hpp.get(k);
      if (!h) {
        const x = skuHilang.get(k);
        if (x) x.jumlah++;
        else skuHilang.set(k, { contoh: b, jumlah: 1 });
      }
      const hppDihitung = !retur[i] || ktx.opsi.retur_barang_rusak;
      items.push({
        platform: p.platform,
        bulan: p.bulan,
        tanggal: p.tanggal,
        no_pesanan: p.no_pesanan,
        sku: b.sku,
        nama: b.nama ?? h?.nama ?? null,
        qty: b.qty,
        retur: retur[i],
        nilai: b.nilai,
        diskon_voucher: biaya.diskon_penjual[i] + biaya.voucher_penjual[i],
        biaya_admin: biaya.biaya_admin[i],
        biaya_layanan: biaya.biaya_layanan[i],
        ongkir: biaya.ongkir_ditanggung_penjual[i],
        lainnya: lainnya[i],
        hpp: h && hppDihitung ? Math.round(h.hpp * b.qty) : 0,
        hpp_tersedia: h !== undefined,
        packaging: packaging[i],
      });
    });
    ringkas.push({
      platform: p.platform,
      no_pesanan: p.no_pesanan,
      bulan: p.bulan,
      tanggal: p.tanggal,
      punyaRetur: retur.some(Boolean),
      belumCair,
    });
  }

  for (const { contoh, jumlah } of skuHilang.values()) {
    catatan.tambah({
      jenis: 'SKU_TANPA_HPP', platform: contoh.platform, sheet: contoh.sheet, baris: contoh.baris,
      no_pesanan: contoh.no_pesanan, sku: contoh.sku,
      pesan: `SKU ${contoh.sku} belum ada di tab HPP (${jumlah} baris). HPP dianggap 0.`,
    });
  }
  return { items, pesanan: ringkas };
}

function catatSelisih(selisih: number, nilai: number, p: Pesanan, b: BarisItem, catatan: Catatan): void {
  const konteks = { platform: p.platform, sheet: b.sheet, baris: b.baris, no_pesanan: p.no_pesanan };
  if (selisih < AMBANG_SELISIH_NEGATIF) {
    catatan.tambah({
      jenis: 'SELISIH_REKONSILIASI', ...konteks,
      pesan:
        `Dana cair lebih besar ${formatRupiah(-selisih)} dari perhitungan. Kemungkinan harga_jual dipetakan ke harga ` +
        'setelah diskon sementara diskon_penjual juga dipetakan, atau ada subsidi dari marketplace.',
    });
  } else if (nilai > 0 && selisih > AMBANG_SELISIH_BESAR * nilai) {
    catatan.tambah({
      jenis: 'SELISIH_REKONSILIASI', ...konteks,
      pesan:
        `Potongan lainnya ${formatRupiah(selisih)} (${formatPersen((selisih / nilai) * 100)} dari nilai pesanan). ` +
        'Periksa apakah ada kolom biaya yang belum dipetakan atau total_diterima dipetakan ke kolom yang salah.',
    });
  }
}
