// Generator data demo. Header di file ini FIKTIF (bukan salinan export marketplace asli),
// sengaja berbeda per platform agar fitur pemetaan ikut terdemokan.
import { bulanJakarta, hariDalamBulan, OFFSET_WIB_MS } from './parse.js';
import type { AnalyzeInput, Level, Pemetaan, PemetaanField, Sel, StatusKelompok } from './types.js';

export interface DemoTab {
  header: string[];
  rows: Sel[][];
  mapping?: Pemetaan;
}
export interface DemoData {
  brand: string;
  tabs: Record<string, DemoTab>;
}
export interface OpsiDemo {
  seed?: number;
  bulan_akhir?: string;
  sekarang?: Date;
}

export const BRAND_DEMO = 'Senja Roastery';
export const SKU_DEMO_TANPA_HPP = 'SR-TMB-01';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function geserBulan(bulan: string, n: number): string {
  const [y, m] = bulan.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export function bulanPenuhTerakhir(sekarang: Date): string {
  return geserBulan(bulanJakarta(sekarang.getTime()), -1);
}

interface Produk { sku: string; nama: string; harga: number; hpp: number; bobot: number; murah: boolean }

// Produk "murah" laris tetapi rugi: margin kotor tipis + subsidi ongkir + biaya marketplace + iklan.
const PRODUK: Produk[] = [
  { sku: 'SR-KSM-05', nama: 'Kopi Sachet Mini isi 5', harga: 15000, hpp: 12000, bobot: 30, murah: true },
  { sku: 'SR-DRP-03', nama: 'Drip Bag Trial isi 3', harga: 19000, hpp: 15000, bobot: 24, murah: true },
  { sku: 'SR-SCB-01', nama: 'Sachet Cold Brew Satuan', harga: 9000, hpp: 7000, bobot: 20, murah: true },
  { sku: 'SR-ARB-250', nama: 'Arabika Gayo 250g', harga: 95000, hpp: 52000, bobot: 14, murah: false },
  { sku: 'SR-ARB-500', nama: 'Arabika Gayo 500g', harga: 175000, hpp: 98000, bobot: 6, murah: false },
  { sku: 'SR-ROB-250', nama: 'Robusta Temanggung 250g', harga: 65000, hpp: 33000, bobot: 12, murah: false },
  { sku: 'SR-ROB-1K', nama: 'Robusta Temanggung 1kg', harga: 220000, hpp: 125000, bobot: 4, murah: false },
  { sku: 'SR-HSE-250', nama: 'House Blend 250g', harga: 79000, hpp: 41000, bobot: 13, murah: false },
  { sku: 'SR-DEC-200', nama: 'Decaf Kerinci 200g', harga: 110000, hpp: 64000, bobot: 3, murah: false },
  { sku: 'SR-CBR-1L', nama: 'Cold Brew Literan 1L', harga: 85000, hpp: 46000, bobot: 8, murah: false },
  { sku: 'SR-DRP-10', nama: 'Drip Bag Box isi 10', harga: 59000, hpp: 34000, bobot: 9, murah: false },
  { sku: 'SR-V60-01', nama: 'Kertas Filter V60 isi 100', harga: 45000, hpp: 27000, bobot: 5, murah: false },
  { sku: 'SR-GRD-01', nama: 'Grinder Manual Keramik', harga: 289000, hpp: 185000, bobot: 2, murah: false },
  { sku: 'SR-PAK-01', nama: 'Paket Hampers Kopi', harga: 249000, hpp: 140000, bobot: 3, murah: false },
  { sku: SKU_DEMO_TANPA_HPP, nama: 'Tumbler Senja 500ml', harga: 120000, hpp: 70000, bobot: 3, murah: false },
];
const TUMBLER = PRODUK.find((p) => p.sku === SKU_DEMO_TANPA_HPP)!;

interface ItemDemo { p: Produk; qty: number; diskon: number; admin: number }
interface PesananDemo {
  no: string;
  waktu: number;
  status: StatusKelompok;
  item: ItemDemo[];
  voucher: number;
  admin: number;
  layanan: number;
  ongkir: number;
  diterima: number | null;
}
type Kolom = [string, (p: PesananDemo, i: number) => Sel];

interface Gaya {
  platform: string;
  pesananPerBulan: number;
  tarifAdmin: number;
  tarifLayanan: number;
  biayaLain: number; // potongan yang tidak punya kolom (mis. komisi afiliasi) → muncul sebagai potongan_lainnya
  adminPerItem: boolean;
  pakaiVoucher: boolean;
  nomor: (waktu: number, urut: number) => string;
  kolom: Kolom[];
  mapping: Pemetaan;
}

function wib(ms: number) {
  const d = new Date(ms + OFFSET_WIB_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return { y: String(d.getUTCFullYear()), mo: p(d.getUTCMonth() + 1), d: p(d.getUTCDate()), h: p(d.getUTCHours()), mi: p(d.getUTCMinutes()), s: p(d.getUTCSeconds()) };
}
const h = (header: string, level?: Level): PemetaanField => (level ? { headers: [header], level } : { headers: [header] });
const neg = (n: number) => (n === 0 ? 0 : -n);
const rp = (n: number) => `Rp ${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const bulat100 = (n: number) => Math.round(n / 100) * 100;

const ST_SHOPEE: Record<StatusKelompok, string> = { selesai: 'Selesai', batal: 'Batal', retur: 'Pengembalian Dana' };
const ST_TIKTOK: Record<StatusKelompok, string> = { selesai: 'Completed', batal: 'Cancelled', retur: 'Returned' };
const ST_TOKPED: Record<StatusKelompok, string> = { selesai: 'Pesanan Selesai', batal: 'Dibatalkan Pembeli', retur: 'Dikomplain - Retur' };
const kebalik = (s: Record<StatusKelompok, string>) =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [v, k])) as Record<string, StatusKelompok>;

const GAYA: Gaya[] = [
  {
    // Pola 1: biaya level pesanan diulang di setiap baris item.
    platform: 'Shopee', pesananPerBulan: 260, tarifAdmin: 0.08, tarifLayanan: 0.04, biayaLain: 0.01,
    adminPerItem: false, pakaiVoucher: true,
    nomor: (w, u) => { const t = wib(w); return `SP${t.y.slice(2)}${t.mo}${t.d}${String(u).padStart(4, '0')}`; },
    kolom: [
      ['Nomor Pesanan', (p) => p.no],
      ['Status Pesanan', (p) => ST_SHOPEE[p.status]],
      ['Waktu Dibuat', (p) => { const t = wib(p.waktu); return `${t.d}/${t.mo}/${t.y} ${t.h}:${t.mi}`; }],
      ['Kode SKU', (p, i) => p.item[i].p.sku],
      ['Nama Barang', (p, i) => p.item[i].p.nama],
      ['Jumlah', (p, i) => p.item[i].qty],
      ['Harga Satuan', (p, i) => p.item[i].p.harga],
      ['Diskon Toko', (p, i) => p.item[i].diskon],
      ['Voucher Toko', (p) => p.voucher],
      ['Biaya Administrasi', (p) => p.admin],
      ['Biaya Layanan', (p) => p.layanan],
      ['Subsidi Ongkir Penjual', (p) => p.ongkir],
      ['Dana Dilepas', (p) => p.diterima],
    ],
    mapping: {
      fields: {
        no_pesanan: h('Nomor Pesanan'), status: h('Status Pesanan'), tanggal: h('Waktu Dibuat'), sku: h('Kode SKU'),
        nama_produk: h('Nama Barang'), qty: h('Jumlah'), harga_jual: h('Harga Satuan'), diskon_penjual: h('Diskon Toko'),
        voucher_penjual: h('Voucher Toko', 'order'), biaya_admin: h('Biaya Administrasi', 'order'),
        biaya_layanan: h('Biaya Layanan', 'order'), ongkir_ditanggung_penjual: h('Subsidi Ongkir Penjual', 'order'),
        total_diterima: h('Dana Dilepas', 'order'),
      },
      status_map: kebalik(ST_SHOPEE),
    },
  },
  {
    // Pola 2: biaya level pesanan hanya di baris pertama; biaya ditulis negatif.
    platform: 'TikTok Shop', pesananPerBulan: 180, tarifAdmin: 0.06, tarifLayanan: 0.03, biayaLain: 0.02,
    adminPerItem: false, pakaiVoucher: false,
    nomor: (w, u) => { const t = wib(w); return `57${t.y.slice(2)}${t.mo}${t.d}${String(u).padStart(6, '0')}`; },
    kolom: [
      ['Order ID', (p) => p.no],
      ['Order Status', (p) => ST_TIKTOK[p.status]],
      ['Created Time', (p) => { const t = wib(p.waktu); return `${t.y}-${t.mo}-${t.d} ${t.h}:${t.mi}:${t.s}`; }],
      ['Seller SKU', (p, i) => p.item[i].p.sku],
      ['Product Name', (p, i) => p.item[i].p.nama],
      ['Quantity', (p, i) => p.item[i].qty],
      ['Unit Price', (p, i) => p.item[i].p.harga],
      ['Seller Discount', (p, i) => neg(p.item[i].diskon)],
      ['Platform Commission', (p, i) => (i === 0 ? neg(p.admin) : null)],
      ['Service Fee', (p, i) => (i === 0 ? neg(p.layanan) : null)],
      ['Seller Shipping Fee', (p, i) => (i === 0 ? neg(p.ongkir) : null)],
      ['Settlement Amount', (p, i) => (i === 0 ? p.diterima : null)],
    ],
    mapping: {
      fields: {
        no_pesanan: h('Order ID'), status: h('Order Status'), tanggal: h('Created Time'), sku: h('Seller SKU'),
        nama_produk: h('Product Name'), qty: h('Quantity'), harga_jual: h('Unit Price'), diskon_penjual: h('Seller Discount'),
        biaya_admin: h('Platform Commission', 'order'), biaya_layanan: h('Service Fee', 'order'),
        ongkir_ditanggung_penjual: h('Seller Shipping Fee', 'order'), total_diterima: h('Settlement Amount', 'order'),
      },
      status_map: kebalik(ST_TIKTOK),
    },
  },
  {
    // Harga sebagai teks "Rp 95.000"; biaya admin per item; ongkir & pencairan diulang.
    platform: 'Tokopedia', pesananPerBulan: 110, tarifAdmin: 0.065, tarifLayanan: 0, biayaLain: 0.005,
    adminPerItem: true, pakaiVoucher: false,
    nomor: (w, u) => { const t = wib(w); return `INV/${t.y}${t.mo}${t.d}/MPL/${String(u).padStart(5, '0')}`; },
    kolom: [
      ['Invoice', (p) => p.no],
      ['Tanggal Pembayaran', (p) => { const t = wib(p.waktu); return `${t.d}-${t.mo}-${t.y} ${t.h}:${t.mi}`; }],
      ['Status Akhir', (p) => ST_TOKPED[p.status]],
      ['SKU Produk', (p, i) => p.item[i].p.sku],
      ['Nama Produk', (p, i) => p.item[i].p.nama],
      ['Jumlah Barang', (p, i) => p.item[i].qty],
      ['Harga (Rp)', (p, i) => rp(p.item[i].p.harga)],
      ['Potongan Penjual', (p, i) => p.item[i].diskon],
      ['Biaya Admin per Item', (p, i) => p.item[i].admin],
      ['Ongkir Ditanggung Penjual', (p) => p.ongkir],
      ['Total Pencairan', (p) => p.diterima],
    ],
    mapping: {
      fields: {
        no_pesanan: h('Invoice'), tanggal: h('Tanggal Pembayaran'), status: h('Status Akhir'), sku: h('SKU Produk'),
        nama_produk: h('Nama Produk'), qty: h('Jumlah Barang'), harga_jual: h('Harga (Rp)'),
        diskon_penjual: h('Potongan Penjual'), biaya_admin: h('Biaya Admin per Item'),
        ongkir_ditanggung_penjual: h('Ongkir Ditanggung Penjual', 'order'), total_diterima: h('Total Pencairan', 'order'),
      },
      status_map: kebalik(ST_TOKPED),
    },
  },
];

function pilihProduk(r: () => number, daftar: Produk[]): Produk {
  const total = daftar.reduce((a, p) => a + p.bobot, 0);
  let x = r() * total;
  for (const p of daftar) {
    x -= p.bobot;
    if (x < 0) return p;
  }
  return daftar[daftar.length - 1];
}

function buatPesanan(
  r: () => number, g: Gaya, waktu: number, status: StatusKelompok, belumCair: boolean, paksa?: Produk,
): Omit<PesananDemo, 'no'> {
  const item: ItemDemo[] = [];
  const tambah = (p: Produk, qty: number) => {
    const diskon = r() < 0.15 ? bulat100(p.harga * qty * 0.05) : 0;
    item.push({ p, qty, diskon, admin: 0 });
  };
  const pertama = paksa ?? pilihProduk(r, PRODUK);
  if (pertama.murah) {
    tambah(pertama, 1 + Math.floor(r() * 3));
  } else {
    tambah(pertama, 1 + Math.floor(r() * 2));
    const ekstra = r() < 0.35 ? 1 + Math.floor(r() * 2) : 0;
    for (let k = 0; k < ekstra; k++) {
      tambah(pilihProduk(r, PRODUK.filter((x) => !x.murah && !item.some((it) => it.p.sku === x.sku))), 1);
    }
  }

  const subtotal = item.reduce((a, it) => a + it.p.harga * it.qty, 0);
  if (status === 'batal') {
    return { waktu, status, item: item.map((it) => ({ ...it, diskon: 0 })), voucher: 0, admin: 0, layanan: 0, ongkir: 0, diterima: 0 };
  }
  const diskon = item.reduce((a, it) => a + it.diskon, 0);
  const voucher = g.pakaiVoucher && subtotal >= 100000 && r() < 0.1 ? 5000 : 0;
  if (g.adminPerItem) for (const it of item) it.admin = bulat100(it.p.harga * it.qty * g.tarifAdmin);
  const admin = g.adminPerItem ? item.reduce((a, it) => a + it.admin, 0) : bulat100(subtotal * g.tarifAdmin);
  const layanan = bulat100(subtotal * g.tarifLayanan);
  const ongkir = subtotal < 50000 ? 5000 : 0;
  const lain = bulat100(subtotal * g.biayaLain);
  const diterima = status === 'retur' ? 0 : belumCair ? null : subtotal - diskon - voucher - admin - layanan - ongkir - lain;
  return { waktu, status, item, voucher, admin, layanan, ongkir, diterima };
}

/** 2 duplikat (Shopee & Tokopedia) + 1 baris rusak (TikTok, pesanan satu item, tanggal 5–25). */
function sisipkanMasalah(tabs: Record<string, DemoTab>): void {
  const shopee = tabs['Pesanan - Shopee'].rows;
  shopee.push([...shopee[10]]);
  const tokped = tabs['Pesanan - Tokopedia'].rows;
  tokped.push([...tokped[20]]);

  const tt = tabs['Pesanan - TikTok Shop'];
  const iQty = tt.header.indexOf('Quantity');
  const iWaktu = tt.header.indexOf('Created Time');
  const jumlahBaris = new Map<Sel, number>();
  for (const row of tt.rows) jumlahBaris.set(row[0], (jumlahBaris.get(row[0]) ?? 0) + 1);
  const target = tt.rows.findIndex((row, i) => {
    const hari = Number(String(row[iWaktu]).slice(8, 10));
    return i >= Math.floor(tt.rows.length / 2) && jumlahBaris.get(row[0]) === 1 && row[1] === ST_TIKTOK.selesai && hari >= 5 && hari <= 25;
  });
  tt.rows[target][iQty] = 'dua';
}

export function buatDemo(opsi: OpsiDemo = {}): DemoData {
  const r = mulberry32(opsi.seed ?? 42);
  const akhir = opsi.bulan_akhir ?? bulanPenuhTerakhir(opsi.sekarang ?? new Date());
  const bulan = [geserBulan(akhir, -2), geserBulan(akhir, -1), akhir];
  const tabs: Record<string, DemoTab> = {};

  GAYA.forEach((g, gi) => {
    const semua: PesananDemo[] = [];
    bulan.forEach((b, bi) => {
      const [y, m] = b.split('-').map(Number);
      const hari = hariDalamBulan(b);
      const daftar: Array<Omit<PesananDemo, 'no'>> = [];
      for (let k = 0; k < g.pesananPerBulan; k++) {
        // Pesanan pertama & terakhir tiap bulan dipaksa tanggal 1 & hari terakhir, status selesai,
        // agar demo tidak memunculkan BULAN_TIDAK_PENUH.
        const tepi = k === 0 || k === g.pesananPerBulan - 1;
        const tgl = k === 0 ? 1 : k === g.pesananPerBulan - 1 ? hari : 1 + Math.floor(r() * hari);
        const waktu = Date.UTC(y, m - 1, tgl, 7 + Math.floor(r() * 15), Math.floor(r() * 60), Math.floor(r() * 60)) - OFFSET_WIB_MS;
        const u = r();
        const status: StatusKelompok = tepi ? 'selesai' : u < 0.04 ? 'batal' : u < 0.07 ? 'retur' : 'selesai';
        const belumCair = bi === 2 && tgl > hari - 5 && status === 'selesai';
        const paksa = gi === 2 && bi === 0 && k === 0 ? TUMBLER : undefined;
        daftar.push(buatPesanan(r, g, waktu, status, belumCair, paksa));
      }
      daftar.sort((a, b) => a.waktu - b.waktu);
      daftar.forEach((p, i) => semua.push({ ...p, no: g.nomor(p.waktu, bi * 1000 + i + 1) }));
    });
    const rows: Sel[][] = [];
    for (const p of semua) p.item.forEach((_, i) => rows.push(g.kolom.map(([, f]) => f(p, i))));
    tabs[`Pesanan - ${g.platform}`] = { header: g.kolom.map(([nama]) => nama), rows, mapping: g.mapping };
  });

  sisipkanMasalah(tabs);
  tabs['HPP'] = {
    header: ['sku', 'nama', 'hpp'],
    rows: PRODUK.filter((p) => p.sku !== SKU_DEMO_TANPA_HPP).map((p) => [p.sku, p.nama, p.hpp]),
  };
  tabs['Biaya'] = {
    header: ['bulan', 'jenis', 'platform', 'nilai', 'keterangan'],
    rows: bulan.flatMap((b): Sel[][] => [
      [b, 'iklan', 'Shopee', 3000000, 'Iklan toko'],
      [b, 'iklan', 'TikTok Shop', 2500000, 'Iklan video'],
      [b, 'iklan', 'Tokopedia', 600000, 'Iklan toko'],
      [b, 'packaging', null, 1500, 'Kardus + lakban per pesanan'],
      [b, 'packaging', 'TikTok Shop', 2000, 'Bubble wrap tambahan'],
      [b, 'tetap', null, 4500000, 'Gaji admin'],
      [b, 'tetap', null, 1000000, 'Sewa gudang'],
    ]),
  };
  return { brand: BRAND_DEMO, tabs };
}

/** Bentuk yang sama dengan yang dikirim add-on ke /v1/analyze (header di baris 1, data mulai baris 2). */
export function demoKeAnalyzeInput(d: DemoData): AnalyzeInput {
  const pesanan = Object.entries(d.tabs)
    .filter(([nama]) => nama.startsWith('Pesanan - '))
    .map(([nama, t]) => ({
      platform: nama.slice('Pesanan - '.length),
      sheet: nama,
      row_offset: 2,
      mapping: t.mapping as Pemetaan,
      header: t.header,
      rows: t.rows,
    }));
  return {
    pesanan,
    hpp: d.tabs['HPP'].rows.map(([sku, nama, hpp]) => ({ sku, nama, hpp })),
    biaya: d.tabs['Biaya'].rows.map(([bulan, jenis, platform, nilai, keterangan]) => ({ bulan, jenis, platform, nilai, keterangan })),
  };
}
