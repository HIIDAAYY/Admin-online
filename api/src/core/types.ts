// Tipe bersama HAI Laba. Nama field JSON mengikuti spec §5 (snake_case).

export const FIELD_STANDAR = [
  'no_pesanan', 'tanggal', 'status', 'sku', 'nama_produk', 'qty', 'harga_jual',
  'diskon_penjual', 'voucher_penjual', 'biaya_admin', 'biaya_layanan',
  'ongkir_ditanggung_penjual', 'total_diterima',
] as const;
export type FieldStandar = (typeof FIELD_STANDAR)[number];

export const FIELD_WAJIB = ['no_pesanan', 'tanggal', 'sku', 'qty', 'harga_jual'] as const;

export const FIELD_BIAYA = [
  'diskon_penjual', 'voucher_penjual', 'biaya_admin', 'biaya_layanan', 'ongkir_ditanggung_penjual',
] as const;
export type FieldBiaya = (typeof FIELD_BIAYA)[number];
/** Field yang bisa bernilai level pesanan. total_diterima selalu level pesanan. */
export type FieldOrder = FieldBiaya | 'total_diterima';

export type Level = 'item' | 'order';
export type StatusKelompok = 'selesai' | 'batal' | 'retur';
export type Sel = string | number | boolean | null;

// ---------- Input ----------
export interface PemetaanField {
  headers: string[];
  level?: Level;
}
export interface Pemetaan {
  fields: Partial<Record<FieldStandar, PemetaanField>>;
  status_map?: Record<string, StatusKelompok>;
  options?: { harga_jual_basis?: 'unit' | 'baris' };
}
export interface PesananInput {
  platform: string;
  sheet: string;
  /** Nomor baris sheet untuk rows[0]. */
  row_offset: number;
  mapping: Pemetaan;
  header: string[];
  rows: Sel[][];
}
export interface HppInput { sku: Sel; nama?: Sel; hpp: Sel }
export interface BiayaInput { bulan: Sel; jenis: Sel; platform?: Sel; nilai: Sel; keterangan?: Sel }
export interface Opsi {
  retur_barang_rusak: boolean;
  ambang_laris_persen: number;
  ambang_margin_tipis_persen: number;
}
export const OPSI_DEFAULT: Opsi = {
  retur_barang_rusak: false,
  ambang_laris_persen: 20,
  ambang_margin_tipis_persen: 10,
};
export interface AnalyzeInput {
  pesanan: PesananInput[];
  hpp: HppInput[];
  biaya: BiayaInput[];
  opsi?: Partial<Opsi>;
}

// ---------- Masalah & info ----------
export type JenisMasalah =
  | 'KOLOM_WAJIB_KOSONG' | 'BARIS_GAGAL_DIBACA' | 'DUPLIKAT' | 'SKU_TANPA_HPP'
  | 'STATUS_TIDAK_DIKENAL' | 'NILAI_PESANAN_TIDAK_KONSISTEN' | 'SELISIH_REKONSILIASI'
  | 'IKLAN_TIDAK_TERALOKASI' | 'BIAYA_TIDAK_VALID';
export interface Masalah {
  jenis: JenisMasalah;
  tingkat: 'error' | 'peringatan';
  platform: string | null;
  sheet: string | null;
  baris: number | null;
  no_pesanan: string | null;
  sku: string | null;
  pesan: string;
}
export type JenisInfo =
  | 'PESANAN_BELUM_CAIR' | 'STATUS_TIDAK_DIPETAKAN' | 'BIAYA_DI_LUAR_PERIODE' | 'BULAN_TIDAK_PENUH';
export interface Info {
  jenis: JenisInfo;
  platform: string | null;
  jumlah: number;
  pesan: string;
  detail?: Array<Record<string, string | number>>;
}

/** Kesalahan input yang membuat analisis tidak bisa dijalankan sama sekali. */
export class KesalahanInput extends Error {
  constructor(
    public readonly code: 'PEMETAAN_TIDAK_LENGKAP' | 'HEADER_TIDAK_DITEMUKAN',
    message: string,
    public readonly detail: string[] = [],
  ) {
    super(message);
    this.name = 'KesalahanInput';
  }
}

// ---------- Tipe internal pipeline ----------
export interface BarisItem {
  platform: string;
  sheet: string;
  baris: number;
  no_pesanan: string;
  /** Epoch ms (instan). */
  waktu: number;
  status: StatusKelompok;
  sku: string;
  nama: string | null;
  qty: number;
  /** harga_jual × qty (atau harga_jual bila basis = baris), Rupiah bulat. */
  nilai: number;
  /** Biaya level item (sudah dimutlakkan); field yang tidak dipetakan = 0. */
  biayaItem: Record<FieldBiaya, number>;
  /** Biaya level pesanan; kunci ada = field dipetakan sebagai level pesanan; null = sel kosong. */
  biayaOrder: Partial<Record<FieldOrder, number | null>>;
}
export interface Pesanan {
  platform: string;
  no_pesanan: string;
  waktu: number;
  bulan: string;
  tanggal: string;
  batal: boolean;
  /** Baris non-batal. */
  aktif: BarisItem[];
  nilaiOrder: Partial<Record<FieldOrder, number | null>>;
}
export interface ItemHasil {
  platform: string;
  bulan: string;
  tanggal: string;
  no_pesanan: string;
  sku: string;
  nama: string | null;
  qty: number;
  retur: boolean;
  nilai: number;
  diskon_voucher: number;
  biaya_admin: number;
  biaya_layanan: number;
  ongkir: number;
  lainnya: number;
  hpp: number;
  hpp_tersedia: boolean;
  packaging: number;
}
export interface RingkasPesanan {
  platform: string;
  no_pesanan: string;
  bulan: string;
  tanggal: string;
  punyaRetur: boolean;
  belumCair: boolean;
}
export interface BiayaValid {
  baris: number;
  bulan: string;
  jenis: 'iklan' | 'packaging' | 'tetap';
  platform: string | null;
  nilai: number;
  keterangan: string;
}
export interface IklanProduk { platform: string; bulan: string; sku: string; nilai: number }
export interface IklanSisa { platform: string; bulan: string; nilai: number }

// ---------- Laporan ----------
export interface Ringkasan {
  omzet_kotor: number;
  retur: number;
  penjualan_bersih: number;
  diskon_voucher_penjual: number;
  biaya_marketplace: number;
  total_potongan_marketplace: number;
  dana_diterima: number;
  hpp: number;
  iklan: number;
  packaging: number;
  laba_kontribusi: number;
  biaya_tetap: number;
  laba_bersih: number;
  margin_persen: number;
  jumlah_pesanan: number;
  jumlah_pesanan_batal: number;
  jumlah_pesanan_retur: number;
  jumlah_pesanan_belum_cair: number;
  iklan_tidak_teralokasi: number;
  tanggal_pertama: string | null;
  tanggal_terakhir: string | null;
  periode: string[];
}
export interface RincianBiayaMarketplace {
  biaya_admin: number;
  biaya_layanan: number;
  ongkir_ditanggung_penjual: number;
  potongan_lainnya: number;
}
export interface KolomLaba {
  omzet_kotor: number;
  retur: number;
  penjualan_bersih: number;
  potongan_marketplace: number;
  hpp: number;
  iklan: number;
  packaging: number;
  laba_kontribusi: number;
  margin_persen: number;
}
export interface BarisProduk extends KolomLaba { sku: string; nama: string; qty: number; hpp_tersedia: boolean }
export interface BarisPlatform extends KolomLaba { platform: string; jumlah_pesanan: number; qty: number }
export interface BarisBulan extends KolomLaba {
  bulan: string;
  jumlah_pesanan: number;
  iklan_tidak_teralokasi: number;
  biaya_tetap: number;
  laba_bersih: number;
}
export type JenisSorotan =
  | 'LARIS_TAPI_RUGI' | 'LARIS_MARGIN_TIPIS' | 'PRODUK_PALING_UNTUNG'
  | 'PLATFORM_PALING_UNTUNG' | 'PLATFORM_MARGIN_TERBAIK';
export interface Sorotan { jenis: JenisSorotan; teks: string; sku: string | null; platform: string | null }
export interface Laporan {
  ringkasan: Ringkasan;
  rincian_biaya_marketplace: RincianBiayaMarketplace;
  per_produk: BarisProduk[];
  per_platform: BarisPlatform[];
  per_bulan: BarisBulan[];
  sorotan: Sorotan[];
  masalah: Masalah[];
  jumlah_masalah: Partial<Record<JenisMasalah, number>>;
  info: Info[];
}
