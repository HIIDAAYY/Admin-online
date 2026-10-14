# HAI Laba — Rencana 1: Mesin Perhitungan (core) & Generator Demo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun `api/src/core/`, yaitu semua rumus HAI Laba sebagai fungsi murni TypeScript yang diuji penuh, ditambah generator data demo yang deterministik. Hasilnya: `analyze(input)` menghasilkan laporan lengkap sesuai spec §5.2, dan `buatDemo()` menghasilkan data yang ceritanya muncul di laporan itu.

**Architecture:** Pipeline fungsi murni tanpa I/O:
`ekstrakBaris → buangDuplikat → bentukPesanan → (periode, biaya) → hitungItem → alokasiIklan → agregasi → buatSorotan`.
- Semua nilai uang berupa bilangan bulat Rupiah. Semua pembagian biaya lewat satu fungsi `allocate()` yang memakai pembulatan sisa terbesar.
- Masalah data dan info dikumpulkan objek `Catatan`.
- Tidak ada database, HTTP, maupun dependensi runtime. API (Rencana 2) dan add-on (Rencana 3) hanya memanggil `analyze()` dan `buatDemo()`.

**Tech Stack:** TypeScript 5 (strict, ESM, NodeNext), Node ≥ 22, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-10-14-hai-laba-design.md`. Bagian yang dipakai: §5.1–5.3 dan §6–§8.

**Peta rencana:**
- Rencana 1 (dokumen ini): core + demo.
- Rencana 2: API (Hono, Prisma, auth, `/v1/analyze`, `/v1/demo`, Docker).
- Rencana 3: Add-on Google Sheets.
- Rencana 4: Template pemetaan (suggest + templates + sidebar).

Urutan ini sesuai spec §10. Rencana 2–4 ditulis setelah Rencana 1 disetujui, memakai antarmuka `types.ts` dari sini.

## Global Constraints

- Node ≥ 22. TypeScript `strict`. ESM (`"type": "module"`, `module: NodeNext`), jadi import relatif **wajib** berakhiran `.js`.
- `src/core/` tidak boleh mengimpor modul I/O (fs, http, database). Nol dependensi runtime.
- Nilai uang = bilangan bulat Rupiah. Angka hasil parsing dibulatkan ke rupiah terdekat **per sel**. Setiap pembagian biaya memakai `allocate()`.
- Bulan dan tanggal selalu dalam Asia/Jakarta (UTC+7 tetap, tanpa DST). Waktu tanpa offset dianggap WIB.
- Kode di luar `demo.ts` tidak boleh berisi nama kolom marketplace. Header fiktif hanya ada di `demo.ts`.
- Semua teks untuk pengguna berbahasa Indonesia:
  - Rupiah ditulis `Rp1.240.500`. Nilai negatif memakai tanda minus `−` (U+2212): `−Rp3.222`.
  - Persen ditulis `−8,3%`.
- Nama field JSON memakai snake_case persis seperti spec §5.2.
- Daftar `masalah` dibatasi 1.000 entri. `jumlah_masalah` selalu berisi hitungan lengkap.
- Perintah dijalankan dari folder `api/`. Tes dijalankan dengan `npx vitest run <file>`.
- Setiap pesan commit diakhiri baris: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Tafsiran spec yang ditetapkan rencana ini** (sudah dikonfirmasi ke pemilik produk; jangan diubah tanpa bertanya):

1. Untuk biaya level pesanan, nilai **0 diperlakukan seperti kosong** saat mencari "nilai pertama yang tidak kosong". Jika semua baris berisi 0, hasilnya 0. Alasannya: banyak export menulis 0 (bukan kosong) di baris lanjutan, dan tanpa aturan ini peringatan `NILAI_PESANAN_TIDAK_KONSISTEN` akan muncul berlebihan.
2. `qty` di laporan Produk dan Platform = qty terjual **tanpa** baris retur.
3. Beberapa kolom untuk satu field biaya dijumlahkan **dulu**, baru dimutlakkan (`|a + b|`).
4. Bulan sebuah pesanan diambil dari baris pertamanya di sheet.
5. Bagian diskon/voucher level pesanan yang jatuh ke baris retur dibuang, karena dikembalikan ke pembeli.
6. Nilai Biaya negatif dianggap tidak valid. Beberapa baris packaging untuk bulan dan platform yang sama dijumlahkan.

## Review Focus

Lima kondisi yang tersirat di spec tetapi mudah terlewat. Masing-masing sudah punya tes di task pemiliknya:

1. **Header di pemetaan berbeda spasi atau huruf besar dari header sheet** (`" no "` vs `"No"`): harus tetap cocok. Tes ada di Task 6.
2. **Baris lebih pendek dari header** (sel kosong di ujung baris terpotong): sel yang hilang diperlakukan kosong, tidak crash. Tes ada di Task 6.
3. **SKU di pesanan berbeda huruf atau spasi dari tab HPP** (`" s1 "` vs `"S1"`): HPP tetap ditemukan. Tes ada di Task 9.
4. **Angka desimal dari rumus Sheets** (`15000.4`): dibulatkan per sel, total tetap bilangan bulat. Tes ada di Task 6.
5. **Nama platform di tab Biaya berbeda huruf dari nama tab** (`"shopee"` vs `"Shopee"`): iklan tetap teralokasi. Tes ada di Task 10.

---

## Struktur File

```
hai-laba/
├─ .gitignore
├─ README.md                      (Task 16: dokumentasi rumus)
└─ api/
   ├─ package.json  tsconfig.json  vitest.config.ts
   ├─ src/core/
   │  ├─ types.ts       semua tipe bersama (input, internal, laporan)
   │  ├─ format.ts      formatRupiah, formatPersen, formatAngka, namaBulan
   │  ├─ catatan.ts     pengumpul masalah & info (batas 1.000)
   │  ├─ parse.ts       kosong, kunci, parseAngka, parseTanggal, bulanJakarta, tanggalJakarta, hariDalamBulan, parseBulan
   │  ├─ allocate.ts    allocate, bobotItem
   │  ├─ status.ts      tebakStatus, klasifikasiStatus
   │  ├─ extract.ts     ekstrakBaris (baris mentah + pemetaan → BarisItem)
   │  ├─ dedupe.ts      buangDuplikat
   │  ├─ orders.ts      bentukPesanan (nilai level pesanan)
   │  ├─ biaya.ts       validasiBiaya, saringPeriode, buatTarifPackaging
   │  ├─ hitung.ts      bangunHpp, hitungItem (biaya per item, retur, HPP, potongan_lainnya, packaging)
   │  ├─ iklan.ts       alokasiIklan
   │  ├─ info.ts        hitungPeriode, cekBulanTidakPenuh, infoBelumCair
   │  ├─ aggregate.ts   agregasi, margin
   │  ├─ highlights.ts  buatSorotan
   │  ├─ analyze.ts     analyze (orkestrasi)
   │  └─ demo.ts        buatDemo, demoKeAnalyzeInput, bulanPenuhTerakhir, mulberry32
   └─ test/core/
      ├─ helpers.ts     pembuat tab/baris uji
      └─ *.test.ts      satu file per modul
```

---

### Task 1: Kerangka proyek, tipe bersama, format, Catatan

**Files:**
- Create: `.gitignore`, `api/package.json`, `api/tsconfig.json`, `api/vitest.config.ts`
- Create: `api/src/core/types.ts`, `api/src/core/format.ts`, `api/src/core/catatan.ts`
- Test: `api/test/core/format.test.ts`, `api/test/core/catatan.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - Semua tipe di `types.ts` (dipakai semua task berikutnya).
  - `formatRupiah(n): string`, `formatPersen(p): string`, `formatAngka(n): string`, `namaBulan('2026-07'): 'Juli 2026'`, `namaBulanSaja('2026-07'): 'Juli'`.
  - `class Catatan { masalah; jumlah; info; tambah(m: MasalahBaru); tambahInfo(i: Info) }`, `BATAS_MASALAH = 1000`.

- [ ] **Step 1: Buat file konfigurasi**

`.gitignore` (root repo):
```
node_modules/
dist/
.env
coverage/
```

`api/package.json`:
```json
{
  "name": "hai-laba-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

`api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

`api/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
```

- [ ] **Step 2: Pasang dependensi dev**

Run: `cd api && npm install -D typescript@5 vitest@3 @types/node@22`
Expected: `package.json` mendapat `devDependencies`, dan `package-lock.json` terbentuk.

- [ ] **Step 3: Tulis `api/src/core/types.ts`**

```ts
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
```

- [ ] **Step 4: Tulis tes format dan Catatan (gagal dulu)**

`api/test/core/format.test.ts`:
```ts
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
```

`api/test/core/catatan.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BATAS_MASALAH, Catatan } from '../../src/core/catatan.js';

describe('Catatan', () => {
  it('mengisi field kosong dengan null dan menurunkan tingkat dari jenis', () => {
    const c = new Catatan();
    c.tambah({ jenis: 'DUPLIKAT', pesan: 'x' });
    c.tambah({ jenis: 'KOLOM_WAJIB_KOSONG', pesan: 'y', baris: 5 });
    c.tambah({ jenis: 'BARIS_GAGAL_DIBACA', pesan: 'z' });
    expect(c.masalah[0]).toEqual({
      jenis: 'DUPLIKAT', tingkat: 'peringatan', platform: null, sheet: null,
      baris: null, no_pesanan: null, sku: null, pesan: 'x',
    });
    expect(c.masalah[1].tingkat).toBe('error');
    expect(c.masalah[1].baris).toBe(5);
    expect(c.masalah[2].tingkat).toBe('error');
  });

  it('membatasi daftar 1.000 tetapi tetap menghitung semuanya', () => {
    const c = new Catatan();
    for (let i = 0; i < 1200; i++) c.tambah({ jenis: 'DUPLIKAT', pesan: String(i) });
    expect(BATAS_MASALAH).toBe(1000);
    expect(c.masalah).toHaveLength(1000);
    expect(c.jumlah).toEqual({ DUPLIKAT: 1200 });
  });

  it('menyimpan info apa adanya', () => {
    const c = new Catatan();
    c.tambahInfo({ jenis: 'PESANAN_BELUM_CAIR', platform: 'Shopee', jumlah: 2, pesan: 'p' });
    expect(c.info).toEqual([{ jenis: 'PESANAN_BELUM_CAIR', platform: 'Shopee', jumlah: 2, pesan: 'p' }]);
  });
});
```

- [ ] **Step 5: Jalankan tes, pastikan gagal**

Run: `npx vitest run test/core/format.test.ts test/core/catatan.test.ts`
Expected: FAIL karena modul `format.js` dan `catatan.js` belum ada.

- [ ] **Step 6: Implementasi `format.ts` dan `catatan.ts`**

`api/src/core/format.ts`:
```ts
const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const MINUS = '−'; // U+2212

/** Angka bulat dengan titik ribuan, tanpa tanda (nilai mutlak). */
export function formatAngka(n: number): string {
  return Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatRupiah(n: number): string {
  const r = Math.round(n);
  return (r < 0 ? MINUS : '') + 'Rp' + formatAngka(r);
}

export function formatPersen(p: number): string {
  return (p < 0 ? MINUS : '') + Math.abs(p).toFixed(1).replace('.', ',') + '%';
}

/** '2026-07' → 'Juli' */
export function namaBulanSaja(bulan: string): string {
  return NAMA_BULAN[Number(bulan.slice(5, 7)) - 1];
}

/** '2026-07' → 'Juli 2026' */
export function namaBulan(bulan: string): string {
  return `${namaBulanSaja(bulan)} ${bulan.slice(0, 4)}`;
}
```

`api/src/core/catatan.ts`:
```ts
import type { Info, JenisMasalah, Masalah } from './types.js';

export const BATAS_MASALAH = 1000;

const JENIS_ERROR: ReadonlySet<JenisMasalah> = new Set(['KOLOM_WAJIB_KOSONG', 'BARIS_GAGAL_DIBACA']);

export type MasalahBaru = Pick<Masalah, 'jenis' | 'pesan'> &
  Partial<Pick<Masalah, 'platform' | 'sheet' | 'baris' | 'no_pesanan' | 'sku'>>;

/** Pengumpul masalah data dan info selama satu analisis. */
export class Catatan {
  readonly masalah: Masalah[] = [];
  readonly jumlah: Partial<Record<JenisMasalah, number>> = {};
  readonly info: Info[] = [];

  tambah(m: MasalahBaru): void {
    this.jumlah[m.jenis] = (this.jumlah[m.jenis] ?? 0) + 1;
    if (this.masalah.length >= BATAS_MASALAH) return;
    this.masalah.push({
      jenis: m.jenis,
      tingkat: JENIS_ERROR.has(m.jenis) ? 'error' : 'peringatan',
      platform: m.platform ?? null,
      sheet: m.sheet ?? null,
      baris: m.baris ?? null,
      no_pesanan: m.no_pesanan ?? null,
      sku: m.sku ?? null,
      pesan: m.pesan,
    });
  }

  tambahInfo(i: Info): void {
    this.info.push(i);
  }
}
```

- [ ] **Step 7: Jalankan tes dan typecheck**

Run: `npx vitest run test/core/format.test.ts test/core/catatan.test.ts && npx tsc --noEmit`
Expected: semua PASS, tsc tanpa error.

- [ ] **Step 8: Commit**

```bash
git add .gitignore api/package.json api/package-lock.json api/tsconfig.json api/vitest.config.ts api/src/core/types.ts api/src/core/format.ts api/src/core/catatan.ts api/test/core/format.test.ts api/test/core/catatan.test.ts
git commit -m "feat(core): scaffold api package, shared types, format helpers, Catatan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Parsing angka

**Files:**
- Create: `api/src/core/parse.ts`
- Test: `api/test/core/parse-angka.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `kosong(v: unknown): boolean`
  - `kunci(s: string): string` (trim + huruf kecil)
  - `parseAngka(v: unknown): number | null`. Mengembalikan `null` untuk sel kosong, dan `NaN` untuk sel yang tidak terbaca.

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/parse-angka.test.ts`:
```ts
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/parse-angka.test.ts`
Expected: FAIL karena modul `parse.js` belum ada.

- [ ] **Step 3: Implementasi (bagian angka dari `parse.ts`)**

`api/src/core/parse.ts`:
```ts
export function kosong(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** Kunci pembanding: tanpa spasi tepi dan tanpa beda huruf besar/kecil. */
export function kunci(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Membaca angka dari sel. null = kosong, NaN = tidak terbaca.
 * Format Indonesia (titik = ribuan, koma = desimal) diutamakan saat ambigu.
 */
export function parseAngka(v: unknown): number | null {
  if (kosong(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;

  let s = v.trim().replace(/ /g, ' ');
  if (/^[-−]$/.test(s)) return null;
  let negatif = false;
  if (/^\(.*\)$/.test(s)) {
    negatif = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    negatif = !negatif;
    s = s.slice(1).trim();
  }
  s = s.replace(/^(rp\.?|idr)\s*/i, '').replace(/\s+/g, '');
  if (s.startsWith('-') || s.startsWith('−')) {
    negatif = !negatif;
    s = s.slice(1);
  }
  if (s === '' || !/^[\d.,]+$/.test(s)) return NaN;

  const titik = (s.match(/\./g) ?? []).length;
  const koma = (s.match(/,/g) ?? []).length;
  let normal: string;
  if (titik > 0 && koma > 0) {
    const desimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const ribuan = desimal === ',' ? '.' : ',';
    if ((desimal === ',' ? koma : titik) > 1) return NaN;
    normal = s.split(ribuan).join('').replace(desimal, '.');
  } else if (koma > 1) {
    normal = s.split(',').join('');
  } else if (koma === 1) {
    normal = s.replace(',', '.');
  } else if (titik > 1) {
    normal = s.split('.').join('');
  } else if (titik === 1 && /^\d+\.\d{3}$/.test(s)) {
    normal = s.replace('.', '');
  } else {
    normal = s;
  }
  if (!/^\d+(\.\d+)?$/.test(normal)) return NaN;
  const n = Number(normal);
  return negatif ? -n : n;
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/parse-angka.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/parse.ts api/test/core/parse-angka.test.ts
git commit -m "feat(core): parse Indonesian/English number formats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Parsing tanggal & bulan Asia/Jakarta

**Files:**
- Modify: `api/src/core/parse.ts` (tambahkan di bawah kode Task 2)
- Test: `api/test/core/parse-tanggal.test.ts`

**Interfaces:**
- Consumes: `kosong` (Task 2)
- Produces:
  - `OFFSET_WIB_MS`
  - `parseTanggal(v): number | null`. Mengembalikan epoch ms, `null` untuk kosong, `NaN` untuk tidak terbaca.
  - `bulanJakarta(ms): 'yyyy-mm'`
  - `tanggalJakarta(ms): 'yyyy-mm-dd'`
  - `hariDalamBulan('yyyy-mm'): number`
  - `parseBulan(v): 'yyyy-mm' | null`

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/parse-tanggal.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { bulanJakarta, hariDalamBulan, parseBulan, parseTanggal, tanggalJakarta } from '../../src/core/parse.js';

const bulanDari = (v: unknown) => bulanJakarta(parseTanggal(v) as number);
const seriSheets = (y: number, mo: number, d: number, h: number, mi: number) =>
  (Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(1899, 11, 30)) / 86_400_000;

describe('parseTanggal + bulanJakarta di sekitar pergantian bulan', () => {
  it.each([
    ['2026-07-31T23:59:59+07:00', '2026-07'],
    ['2026-07-31T17:00:00Z', '2026-08'], // 1 Agustus 00:00 WIB
    ['2026-07-31T16:59:59Z', '2026-07'],
    ['31/07/2026 23:59', '2026-07'],
    ['01/08/2026 00:00', '2026-08'],
    ['2026-12-31T17:30:00Z', '2027-01'], // pergantian tahun
    ['2026-07-31 23:30:00', '2026-07'], // tanpa offset = WIB
    ['31-07-2026 23:30', '2026-07'],
    ['2026/08/01', '2026-08'],
  ])('%s → %s', (v, bulan) => {
    expect(bulanDari(v)).toBe(bulan);
  });

  it('nomor seri Sheets dibaca sebagai waktu WIB, termasuk malam pergantian bulan', () => {
    expect(bulanDari(seriSheets(2026, 7, 31, 23, 59))).toBe('2026-07');
    expect(bulanDari(seriSheets(2026, 8, 1, 0, 0))).toBe('2026-08');
    expect(tanggalJakarta(parseTanggal(seriSheets(2026, 8, 1, 0, 0)) as number)).toBe('2026-08-01');
  });

  it('dd/mm diutamakan daripada mm/dd', () => {
    expect(tanggalJakarta(parseTanggal('03/07/2026') as number)).toBe('2026-07-03');
  });

  it('instan tepat', () => {
    expect(parseTanggal('2026-07-31T23:30:00+07:00')).toBe(Date.UTC(2026, 6, 31, 16, 30));
  });

  it.each(['31/02/2026', '2026-13-01', 'kemarin', '25:00', true, '01/01/1990'])('%j tidak terbaca', (v) => {
    expect(parseTanggal(v)).toBeNaN();
  });

  it.each([null, '', '  '])('%j kosong', (v) => {
    expect(parseTanggal(v)).toBeNull();
  });
});

describe('tanggalJakarta', () => {
  it('17:30 UTC tanggal 31 Juli = 1 Agustus WIB', () => {
    expect(tanggalJakarta(Date.UTC(2026, 6, 31, 17, 30))).toBe('2026-08-01');
  });
});

describe('hariDalamBulan', () => {
  it.each([['2026-07', 31], ['2026-09', 30], ['2026-02', 28], ['2028-02', 29]])('%s → %d', (b, n) => {
    expect(hariDalamBulan(b)).toBe(n);
  });
});

describe('parseBulan', () => {
  it.each([
    ['2026-07', '2026-07'],
    ['2026-7', '2026-07'],
    ['07/2026', '2026-07'],
    ['7-2026', '2026-07'],
    ['Juli 2026', '2026-07'],
    ['Agt 2026', '2026-08'],
    ['Des 2026', '2026-12'],
    ['2026-07-01T00:00:00+07:00', '2026-07'],
    ['2026-06-30T17:00:00Z', '2026-07'],
  ])('%j → %s', (v, b) => {
    expect(parseBulan(v)).toBe(b);
  });

  it.each(['2026-13', 'abc', '', null])('%j → null', (v) => {
    expect(parseBulan(v)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/parse-tanggal.test.ts`
Expected: FAIL karena `parseTanggal`, `bulanJakarta`, dan fungsi tanggal lain belum diekspor.

- [ ] **Step 3: Implementasi (tambahkan ke `parse.ts`)**

```ts
export const OFFSET_WIB_MS = 7 * 60 * 60 * 1000;
const EPOCH_SHEETS_MS = Date.UTC(1899, 11, 30);
const RE_YMD =
  /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;
const RE_DMY = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[ T,]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?$/;

/** Tolak tanggal di luar tahun 2000–2100 (biasanya kolom salah petakan). */
function wajar(ms: number): number {
  const y = new Date(ms + OFFSET_WIB_MS).getUTCFullYear();
  return y >= 2000 && y <= 2100 ? ms : NaN;
}

function offsetMenit(z: string | undefined): number {
  if (!z) return 7 * 60; // tanpa offset = WIB
  if (z.toUpperCase() === 'Z') return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(z);
  if (!m) return NaN;
  const v = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -v : v;
}

function dariKomponen(y: number, mo: number, d: number, h: number, mi: number, s: number, offset: number): number {
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59 || Number.isNaN(offset)) return NaN;
  const lokal = Date.UTC(y, mo - 1, d, h, mi, s);
  if (new Date(lokal).getUTCDate() !== d) return NaN; // mis. 31/02
  return wajar(lokal - offset * 60_000);
}

/** Epoch ms. null = kosong, NaN = tidak terbaca. Waktu tanpa offset dianggap WIB. */
export function parseTanggal(v: unknown): number | null {
  if (kosong(v)) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return NaN;
    return wajar(EPOCH_SHEETS_MS + Math.round(v * 86_400_000) - OFFSET_WIB_MS);
  }
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  let m = RE_YMD.exec(s);
  if (m) return dariKomponen(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), offsetMenit(m[7]));
  m = RE_DMY.exec(s);
  if (m) return dariKomponen(+m[3], +m[2], +m[1], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), 7 * 60);
  return NaN;
}

export function bulanJakarta(ms: number): string {
  return tanggalJakarta(ms).slice(0, 7);
}

export function tanggalJakarta(ms: number): string {
  return new Date(ms + OFFSET_WIB_MS).toISOString().slice(0, 10);
}

export function hariDalamBulan(bulan: string): number {
  const [y, m] = bulan.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const BULAN_NAMA: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3,
  apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
};

/** Bulan untuk tab Biaya: '2026-07', '07/2026', 'Juli 2026', atau tanggal apa pun. */
export function parseBulan(v: unknown): string | null {
  if (kosong(v)) return null;
  const fmt = (y: number, m: number) =>
    m >= 1 && m <= 12 && y >= 2000 && y <= 2100 ? `${y}-${String(m).padStart(2, '0')}` : null;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    let m = /^(\d{4})[-/](\d{1,2})$/.exec(s);
    if (m) return fmt(+m[1], +m[2]);
    m = /^(\d{1,2})[-/](\d{4})$/.exec(s);
    if (m) return fmt(+m[2], +m[1]);
    m = /^([a-z]+)\.?[\s-]+(\d{4})$/.exec(s);
    if (m && BULAN_NAMA[m[1]]) return fmt(+m[2], BULAN_NAMA[m[1]]);
  }
  const t = parseTanggal(v);
  return t === null || Number.isNaN(t) ? null : bulanJakarta(t);
}
```

- [ ] **Step 4: Jalankan tes Task 2 dan Task 3**

Run: `npx vitest run test/core/parse-tanggal.test.ts test/core/parse-angka.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/parse.ts api/test/core/parse-tanggal.test.ts
git commit -m "feat(core): parse dates/months in Asia/Jakarta incl. month-boundary tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Alokasi dengan pembulatan sisa terbesar

**Files:**
- Create: `api/src/core/allocate.ts`
- Test: `api/test/core/allocate.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `allocate(total: number, bobot: number[]): number[]`. Jumlah hasilnya selalu sama dengan `Math.round(total)`. Mendukung total negatif.
  - `bobotItem(items: Array<{nilai: number; qty: number}>): number[]`. Bobot diambil dari nilai; jika semua nilai 0 → dari qty; jika semua qty juga 0 → dibagi rata.

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/allocate.test.ts`:
```ts
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/allocate.test.ts`
Expected: FAIL karena modul `allocate.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/allocate.ts`:
```ts
/**
 * Membagi `total` (Rupiah bulat) proporsional terhadap `bobot`.
 * Metode sisa terbesar: setiap bagian dibulatkan ke bawah, sisanya dibagikan satu-satu ke
 * bagian dengan pecahan terbesar (seri → indeks lebih awal). Jumlah hasil selalu = total.
 * Bobot negatif/tak hingga dianggap 0; bila semua bobot 0, dibagi rata.
 */
export function allocate(total: number, bobot: number[]): number[] {
  const n = bobot.length;
  if (n === 0) return [];
  const t = Math.round(total);
  if (t < 0) return allocate(-t, bobot).map((x) => -x || 0);

  const w = bobot.map((b) => (Number.isFinite(b) && b > 0 ? b : 0));
  const jumlahBobot = w.reduce((a, b) => a + b, 0);
  const efektif = jumlahBobot > 0 ? w : w.map(() => 1);
  const pembagi = jumlahBobot > 0 ? jumlahBobot : n;

  const tepat = efektif.map((b) => (t * b) / pembagi);
  const hasil = tepat.map((x) => Math.floor(x));
  let sisa = t - hasil.reduce((a, b) => a + b, 0);
  const urutan = tepat
    .map((x, i) => ({ i, pecahan: x - Math.floor(x) }))
    .sort((a, b) => b.pecahan - a.pecahan || a.i - b.i);
  for (let k = 0; sisa > 0; k++, sisa--) hasil[urutan[k % n].i] += 1;
  return hasil;
}

/** Bobot pembagian ke item: nilai item → qty → rata (spec §6.3). */
export function bobotItem(items: Array<{ nilai: number; qty: number }>): number[] {
  if (items.some((i) => i.nilai > 0)) return items.map((i) => i.nilai);
  if (items.some((i) => i.qty > 0)) return items.map((i) => i.qty);
  return items.map(() => 1);
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/allocate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/allocate.ts api/test/core/allocate.test.ts
git commit -m "feat(core): largest-remainder allocation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Klasifikasi status

**Files:**
- Create: `api/src/core/status.ts`
- Test: `api/test/core/status.test.ts`

**Interfaces:**
- Consumes: `StatusKelompok` (Task 1)
- Produces:
  - `tebakStatus(raw: string): StatusKelompok | null`. Juga dipakai Rencana 4 untuk mapping suggest.
  - `klasifikasiStatus(raw: string | null, statusMap?): { status: StatusKelompok; dikenal: boolean }`

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/status.test.ts`:
```ts
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
    expect(tebakStatus(raw)).toBe(hasil);
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/status.test.ts`
Expected: FAIL karena modul `status.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/status.ts`:
```ts
import { kunci } from './parse.js';
import type { StatusKelompok } from './types.js';

/** Tebakan kelompok status dari kata kunci umum (bukan nama status marketplace tertentu). */
export function tebakStatus(raw: string): StatusKelompok | null {
  const s = kunci(raw);
  if (s === '') return null;
  if (/batal|cancel/.test(s)) return 'batal';
  if (/retur|return|refund|pengembalian/.test(s)) return 'retur';
  if (/selesai|complete|diterima|dikirim|delivered|shipped|terkirim|sampai/.test(s)) return 'selesai';
  return null;
}

/** status_map → kata kunci → 'selesai' (tidak dikenal). Spec §6.2. */
export function klasifikasiStatus(
  raw: string | null,
  statusMap: Record<string, StatusKelompok> | undefined,
): { status: StatusKelompok; dikenal: boolean } {
  const s = (raw ?? '').trim();
  if (statusMap) {
    const cocok = Object.keys(statusMap).find((k) => kunci(k) === kunci(s));
    if (cocok !== undefined) return { status: statusMap[cocok], dikenal: true };
  }
  const tebakan = tebakStatus(s);
  return tebakan ? { status: tebakan, dikenal: true } : { status: 'selesai', dikenal: false };
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/status.ts api/test/core/status.test.ts
git commit -m "feat(core): status classification via status_map and keywords

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ekstraksi baris (pemetaan → BarisItem)

**Files:**
- Create: `api/src/core/extract.ts`
- Create: `api/test/core/helpers.ts`
- Test: `api/test/core/extract.test.ts`

**Interfaces:**
- Consumes: `Catatan` (Task 1), `kosong`/`parseAngka`/`parseTanggal` (Task 2–3), `klasifikasiStatus` (Task 5)
- Produces:
  - `ekstrakBaris(input: PesananInput, catatan: Catatan): { baris: BarisItem[]; statusDipetakan: boolean }`. Melempar `KesalahanInput` dengan code `HEADER_TIDAK_DITEMUKAN` atau `PEMETAAN_TIDAK_LENGKAP`.
  - Helper tes (dipakai Task 7–14):
    - `HEADER`, `mappingStd(ganti?, lain?)`
    - `baris(no, sku, qty, harga, lain?)`. Defaultnya Tanggal `'2026-07-10 10:00'` dan Status `'Selesai'`.
    - `tab(platform, rows, mapping?)`, `biaya(bulan, jenis, nilai, platform?)`, `tangkap(fn)`

- [ ] **Step 1: Tulis helper tes**

`api/test/core/helpers.ts`:
```ts
import type { BiayaInput, FieldStandar, Pemetaan, PemetaanField, PesananInput, Sel } from '../../src/core/types.js';
import { KesalahanInput } from '../../src/core/types.js';

export const HEADER = ['No', 'Tanggal', 'Status', 'SKU', 'Nama', 'Qty', 'Harga', 'Diskon', 'Voucher', 'Admin', 'Layanan', 'Ongkir', 'Diterima'];

/** Pemetaan standar: diskon level item; voucher/admin/layanan/ongkir/total_diterima level pesanan. */
export function mappingStd(
  ganti: Partial<Record<FieldStandar, PemetaanField | undefined>> = {},
  lain: Omit<Pemetaan, 'fields'> = {},
): Pemetaan {
  return {
    fields: {
      no_pesanan: { headers: ['No'] },
      tanggal: { headers: ['Tanggal'] },
      status: { headers: ['Status'] },
      sku: { headers: ['SKU'] },
      nama_produk: { headers: ['Nama'] },
      qty: { headers: ['Qty'] },
      harga_jual: { headers: ['Harga'] },
      diskon_penjual: { headers: ['Diskon'] },
      voucher_penjual: { headers: ['Voucher'], level: 'order' },
      biaya_admin: { headers: ['Admin'], level: 'order' },
      biaya_layanan: { headers: ['Layanan'], level: 'order' },
      ongkir_ditanggung_penjual: { headers: ['Ongkir'], level: 'order' },
      total_diterima: { headers: ['Diterima'], level: 'order' },
      ...ganti,
    },
    ...lain,
  };
}

export type BarisUji = Partial<Record<string, Sel>>;

export function baris(no: string, sku: string, qty: Sel, harga: Sel, lain: BarisUji = {}): BarisUji {
  return { No: no, Tanggal: '2026-07-10 10:00', Status: 'Selesai', SKU: sku, Qty: qty, Harga: harga, ...lain };
}

export function tab(platform: string, rows: BarisUji[], mapping: Pemetaan = mappingStd()): PesananInput {
  return {
    platform,
    sheet: `Pesanan - ${platform}`,
    row_offset: 2,
    mapping,
    header: HEADER,
    rows: rows.map((r) => HEADER.map((h) => r[h] ?? null)),
  };
}

export function biaya(bulan: string, jenis: string, nilai: number, platform: string | null = null): BiayaInput {
  return { bulan, jenis, platform, nilai, keterangan: '' };
}

export function tangkap(fn: () => unknown): KesalahanInput {
  try {
    fn();
  } catch (e) {
    if (e instanceof KesalahanInput) return e;
    throw e;
  }
  throw new Error('fungsi tidak melempar KesalahanInput');
}
```

- [ ] **Step 2: Tulis tes yang gagal**

`api/test/core/extract.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { ekstrakBaris } from '../../src/core/extract.js';
import { baris, mappingStd, tab, tangkap } from './helpers.js';

const jalan = (input: Parameters<typeof ekstrakBaris>[0]) => {
  const c = new Catatan();
  return { ...ekstrakBaris(input, c), c };
};

describe('ekstrakBaris', () => {
  it('membaca baris standar: angka teks, biaya dimutlakkan, level item/pesanan', () => {
    const { baris: b, c, statusDipetakan } = jalan(
      tab('Shopee', [baris('A1', 'S1', 2, 'Rp 50.000', { Diskon: -1000, Admin: '8.000', Diterima: 90000, Nama: 'Kopi A' })]),
    );
    expect(statusDipetakan).toBe(true);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({
      platform: 'Shopee', sheet: 'Pesanan - Shopee', baris: 2, no_pesanan: 'A1', sku: 'S1',
      nama: 'Kopi A', qty: 2, nilai: 100000, status: 'selesai',
    });
    expect(b[0].waktu).toBe(Date.UTC(2026, 6, 10, 3, 0));
    expect(b[0].biayaItem).toEqual({
      diskon_penjual: 1000, voucher_penjual: 0, biaya_admin: 0, biaya_layanan: 0, ongkir_ditanggung_penjual: 0,
    });
    expect(b[0].biayaOrder).toEqual({
      voucher_penjual: null, biaya_admin: 8000, biaya_layanan: null, ongkir_ditanggung_penjual: null, total_diterima: 90000,
    });
    expect(c.masalah).toEqual([]);
  });

  it('harga_jual_basis = baris memakai harga sebagai total baris', () => {
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 2, 100000)], mappingStd({}, { options: { harga_jual_basis: 'baris' } })));
    expect(b[0].nilai).toBe(100000);
  });

  it('beberapa header dijumlahkan dulu lalu dimutlakkan', () => {
    const m = mappingStd({ biaya_admin: { headers: ['Admin', 'Layanan'] }, biaya_layanan: undefined });
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000, { Admin: -3000, Layanan: -2000 })], m));
    expect(b[0].biayaItem.biaya_admin).toBe(5000);
  });

  it('baris kosong dilewati tanpa masalah, nomor baris tetap sesuai sheet', () => {
    const { baris: b, c } = jalan(tab('Shopee', [{}, baris('A1', 'S1', 1, 1000)]));
    expect(b).toHaveLength(1);
    expect(b[0].baris).toBe(3);
    expect(c.masalah).toEqual([]);
  });

  it('KOLOM_WAJIB_KOSONG melewati baris', () => {
    const { baris: b, c } = jalan(tab('Shopee', [baris('A1', '', 1, 1000)]));
    expect(b).toEqual([]);
    expect(c.masalah).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'KOLOM_WAJIB_KOSONG', tingkat: 'error', baris: 2, sheet: 'Pesanan - Shopee' });
    expect(c.masalah[0].pesan).toContain('sku');
  });

  it('BARIS_GAGAL_DIBACA untuk angka atau tanggal tak terbaca', () => {
    const { baris: b, c } = jalan(tab('Shopee', [
      baris('A1', 'S1', 'dua', 1000),
      baris('A2', 'S1', 1, 1000, { Tanggal: 'kemarin' }),
      baris('A3', 'S1', 1, 1000, { Admin: 'gratis' }),
    ]));
    expect(b).toEqual([]);
    expect(c.jumlah).toEqual({ BARIS_GAGAL_DIBACA: 3 });
    expect(c.masalah[0].pesan).toContain('qty');
    expect(c.masalah[1].pesan).toContain('tanggal "kemarin"');
    expect(c.masalah[2].pesan).toContain('biaya_admin');
  });

  it('STATUS_TIDAK_DIKENAL dianggap selesai', () => {
    const { baris: b, c } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000, { Status: 'Sedang Dikemas' })]));
    expect(b[0].status).toBe('selesai');
    expect(c.masalah[0]).toMatchObject({ jenis: 'STATUS_TIDAK_DIKENAL', tingkat: 'peringatan' });
    expect(c.masalah[0].pesan).toContain('Sedang Dikemas');
  });

  it('status_map dipakai', () => {
    const m = mappingStd({}, { status_map: { Selesai: 'selesai', Kembali: 'retur' } });
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000, { Status: 'Kembali' })], m));
    expect(b[0].status).toBe('retur');
  });

  it('status tidak dipetakan → semua selesai, tanpa masalah', () => {
    const { baris: b, c, statusDipetakan } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000, { Status: 'Batal' })], mappingStd({ status: undefined })));
    expect(statusDipetakan).toBe(false);
    expect(b[0].status).toBe('selesai');
    expect(c.masalah).toEqual([]);
  });

  it('total_diterima tidak dipetakan → kuncinya tidak ada di biayaOrder', () => {
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000)], mappingStd({ total_diterima: undefined })));
    expect('total_diterima' in b[0].biayaOrder).toBe(false);
  });

  it('header pemetaan tidak ada di sheet → HEADER_TIDAK_DITEMUKAN', () => {
    const e = tangkap(() => ekstrakBaris(tab('Shopee', [], mappingStd({ sku: { headers: ['Kode SKU'] } })), new Catatan()));
    expect(e.code).toBe('HEADER_TIDAK_DITEMUKAN');
    expect(e.detail).toEqual(['Kode SKU']);
  });

  it('field wajib tidak dipetakan → PEMETAAN_TIDAK_LENGKAP', () => {
    const e = tangkap(() => ekstrakBaris(tab('Shopee', [], mappingStd({ qty: undefined })), new Catatan()));
    expect(e.code).toBe('PEMETAAN_TIDAK_LENGKAP');
    expect(e.detail).toEqual(['qty']);
  });

  // --- Review Focus ---
  it('header pemetaan cocok tanpa beda spasi dan huruf besar', () => {
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 1, 1000)], mappingStd({ no_pesanan: { headers: [' no '] } })));
    expect(b[0].no_pesanan).toBe('A1');
  });

  it('baris lebih pendek dari header: sel yang hilang dianggap kosong', () => {
    const input = tab('Shopee', []);
    input.rows = [['A1', '2026-07-10 10:00', 'Selesai', 'S1', null, 1, 1000]];
    const { baris: b, c } = jalan(input);
    expect(b).toHaveLength(1);
    expect(b[0].biayaItem.diskon_penjual).toBe(0);
    expect(b[0].biayaOrder.biaya_admin).toBeNull();
    expect(c.masalah).toEqual([]);
  });

  it('angka desimal dari rumus Sheets dibulatkan per sel', () => {
    const { baris: b } = jalan(tab('Shopee', [baris('A1', 'S1', 3, 15000.4, { Admin: 999.6 })]));
    expect(b[0].nilai).toBe(45000);
    expect(b[0].biayaOrder.biaya_admin).toBe(1000);
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/extract.test.ts`
Expected: FAIL karena modul `extract.js` belum ada.

- [ ] **Step 4: Implementasi**

`api/src/core/extract.ts`:
```ts
import type { Catatan } from './catatan.js';
import { kosong, parseAngka, parseTanggal } from './parse.js';
import { klasifikasiStatus } from './status.js';
import { FIELD_BIAYA, FIELD_WAJIB, KesalahanInput } from './types.js';
import type { BarisItem, FieldBiaya, FieldOrder, FieldStandar, PesananInput, Sel, StatusKelompok } from './types.js';

export interface HasilEkstrak {
  baris: BarisItem[];
  statusDipetakan: boolean;
}

/** field → indeks kolom. Header dicocokkan tanpa beda spasi tepi & huruf besar/kecil. */
function petaKolom(input: PesananInput): Map<FieldStandar, number[]> {
  const posisi = new Map<string, number>();
  input.header.forEach((h, i) => {
    const k = String(h ?? '').trim().toLowerCase();
    if (k !== '' && !posisi.has(k)) posisi.set(k, i);
  });
  const hasil = new Map<FieldStandar, number[]>();
  const hilang: string[] = [];
  for (const [field, pf] of Object.entries(input.mapping.fields) as Array<[FieldStandar, { headers: string[] } | undefined]>) {
    if (!pf || pf.headers.length === 0) continue;
    const idx: number[] = [];
    for (const h of pf.headers) {
      const i = posisi.get(h.trim().toLowerCase());
      if (i === undefined) hilang.push(h);
      else idx.push(i);
    }
    hasil.set(field, idx);
  }
  if (hilang.length > 0) {
    throw new KesalahanInput('HEADER_TIDAK_DITEMUKAN', `Kolom tidak ditemukan di ${input.sheet}: ${hilang.join(', ')}`, hilang);
  }
  const belum = FIELD_WAJIB.filter((f) => !hasil.has(f));
  if (belum.length > 0) {
    throw new KesalahanInput('PEMETAAN_TIDAK_LENGKAP', `Field wajib belum dipetakan di ${input.sheet}: ${belum.join(', ')}`, [...belum]);
  }
  return hasil;
}

/** Baris mentah + pemetaan → BarisItem. Baris bermasalah dicatat lalu dilewati. */
export function ekstrakBaris(input: PesananInput, catatan: Catatan): HasilEkstrak {
  const kolom = petaKolom(input);
  const statusDipetakan = kolom.has('status');
  const basisBaris = input.mapping.options?.harga_jual_basis === 'baris';
  const levelOrder = (f: FieldOrder) => f === 'total_diterima' || input.mapping.fields[f]?.level === 'order';
  const hasil: BarisItem[] = [];

  input.rows.forEach((row, i) => {
    if (row.every(kosong)) return;
    const baris = input.row_offset + i;
    const sel = (f: FieldStandar): Sel[] => (kolom.get(f) ?? []).map((c) => row[c] ?? null);
    const teks = (f: FieldStandar): string | null => {
      const v = sel(f).find((x) => !kosong(x));
      return v === undefined ? null : String(v).trim();
    };
    /** Jumlah semua sel field, tiap sel dibulatkan ke Rupiah; null bila semua kosong; NaN bila ada yang tak terbaca. */
    const angka = (f: FieldStandar): number | null => {
      let total: number | null = null;
      for (const v of sel(f)) {
        const n = parseAngka(v);
        if (n === null) continue;
        if (Number.isNaN(n)) return NaN;
        total = (total ?? 0) + Math.round(n);
      }
      return total;
    };

    const no_pesanan = teks('no_pesanan');
    const sku = teks('sku');
    const tanggalMentah = sel('tanggal').find((x) => !kosong(x)) ?? null;
    const qty = angka('qty');
    const harga = angka('harga_jual');
    const konteks = { platform: input.platform, sheet: input.sheet, baris, no_pesanan, sku };

    const wajib: Array<[string, unknown]> = [
      ['no_pesanan', no_pesanan], ['tanggal', tanggalMentah], ['sku', sku], ['qty', qty], ['harga_jual', harga],
    ];
    const wajibKosong = wajib.filter(([, v]) => v === null).map(([f]) => f);
    if (wajibKosong.length > 0) {
      catatan.tambah({ jenis: 'KOLOM_WAJIB_KOSONG', ...konteks, pesan: `Kolom wajib kosong: ${wajibKosong.join(', ')}. Baris dilewati.` });
      return;
    }

    const gagal: string[] = [];
    const waktu = parseTanggal(tanggalMentah);
    if (waktu === null || Number.isNaN(waktu)) gagal.push(`tanggal "${String(tanggalMentah)}"`);
    if (Number.isNaN(qty)) gagal.push('qty');
    if (Number.isNaN(harga)) gagal.push('harga_jual');

    const biayaItem: Record<FieldBiaya, number> = {
      diskon_penjual: 0, voucher_penjual: 0, biaya_admin: 0, biaya_layanan: 0, ongkir_ditanggung_penjual: 0,
    };
    const biayaOrder: Partial<Record<FieldOrder, number | null>> = {};
    for (const f of [...FIELD_BIAYA, 'total_diterima'] as FieldOrder[]) {
      if (!kolom.has(f)) continue;
      const n = angka(f);
      if (Number.isNaN(n)) {
        gagal.push(f);
        continue;
      }
      const nilai = n === null ? null : f === 'total_diterima' ? n : Math.abs(n);
      if (levelOrder(f)) biayaOrder[f] = nilai;
      else biayaItem[f as FieldBiaya] = nilai ?? 0;
    }
    if (gagal.length > 0) {
      catatan.tambah({ jenis: 'BARIS_GAGAL_DIBACA', ...konteks, pesan: `Nilai tidak terbaca: ${gagal.join(', ')}. Baris dilewati.` });
      return;
    }

    let status: StatusKelompok = 'selesai';
    if (statusDipetakan) {
      const mentah = teks('status');
      const k = klasifikasiStatus(mentah, input.mapping.status_map);
      status = k.status;
      if (!k.dikenal) {
        catatan.tambah({ jenis: 'STATUS_TIDAK_DIKENAL', ...konteks, pesan: `Status "${mentah ?? ''}" tidak dikenal, dianggap selesai.` });
      }
    }

    const q = qty as number;
    const h = harga as number;
    hasil.push({
      platform: input.platform,
      sheet: input.sheet,
      baris,
      no_pesanan: no_pesanan as string,
      waktu: waktu as number,
      status,
      sku: sku as string,
      nama: teks('nama_produk'),
      qty: q,
      nilai: basisBaris ? h : Math.round(h * q),
      biayaItem,
      biayaOrder,
    });
  });
  return { baris: hasil, statusDipetakan };
}
```

> Catatan: `angka()` membulatkan setiap sel ke bilangan bulat, termasuk qty. Qty pecahan memang tidak didukung di v1.

- [ ] **Step 5: Jalankan tes**

Run: `npx vitest run test/core/extract.test.ts`
Expected: PASS. Tes "angka desimal" membuktikan pembulatan per sel: 15000.4 → 15000 × 3 = 45000, dan 999.6 → 1000.

- [ ] **Step 6: Commit**

```bash
git add api/src/core/extract.ts api/test/core/helpers.ts api/test/core/extract.test.ts
git commit -m "feat(core): extract raw rows into BarisItem via mapping

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Duplikat & pembentukan pesanan (biaya level pesanan)

**Files:**
- Create: `api/src/core/dedupe.ts`, `api/src/core/orders.ts`
- Test: `api/test/core/orders.test.ts`

**Interfaces:**
- Consumes: `ekstrakBaris` (Task 6), `kunci`/`bulanJakarta`/`tanggalJakarta` (Task 2–3)
- Produces:
  - `buangDuplikat(baris: BarisItem[], catatan): BarisItem[]`
  - `bentukPesanan(baris: BarisItem[], catatan): Pesanan[]`. Urutan hasil mengikuti kemunculan pertama setiap pesanan.

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/orders.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { buangDuplikat } from '../../src/core/dedupe.js';
import { ekstrakBaris } from '../../src/core/extract.js';
import { bentukPesanan } from '../../src/core/orders.js';
import type { PesananInput, Sel } from '../../src/core/types.js';
import { baris, type BarisUji, tab } from './helpers.js';

function jalan(tabs: PesananInput[]) {
  const c = new Catatan();
  const semua = tabs.flatMap((t) => ekstrakBaris(t, c).baris);
  const unik = buangDuplikat(semua, c);
  return { unik, pesanan: bentukPesanan(unik, c), c };
}
const satuTab = (rows: BarisUji[]) => jalan([tab('Shopee', rows)]);

describe('buangDuplikat', () => {
  it('kunci platform + no_pesanan + sku; kemunculan pertama dipakai', () => {
    const { unik, c } = satuTab([baris('A1', 'S1', 1, 1000), baris('A1', 'S1', 1, 1000), baris('A1', 'S2', 1, 1000)]);
    expect(unik.map((b) => b.baris)).toEqual([2, 4]);
    expect(c.masalah).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'DUPLIKAT', baris: 3, no_pesanan: 'A1', sku: 'S1' });
    expect(c.masalah[0].pesan).toBe('Duplikat dari Pesanan - Shopee baris 2 (no_pesanan + sku sama). Baris ini diabaikan.');
  });

  it('lintas tab dengan platform yang sama', () => {
    const t2 = { ...tab('Shopee', [baris('A1', 'S1', 1, 1000)]), sheet: 'Pesanan - Shopee (2)' };
    const { unik, c } = jalan([tab('Shopee', [baris('A1', 'S1', 1, 1000)]), t2]);
    expect(unik).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'DUPLIKAT', sheet: 'Pesanan - Shopee (2)', baris: 2 });
  });

  it('platform berbeda bukan duplikat', () => {
    const { unik } = jalan([tab('Shopee', [baris('A1', 'S1', 1, 1000)]), tab('Tokopedia', [baris('A1', 'S1', 1, 1000)])]);
    expect(unik).toHaveLength(2);
  });

  it('tanpa beda huruf/spasi', () => {
    const { unik } = satuTab([baris('A1', 's1 ', 1, 1000), baris('a1', 'S1', 1, 1000)]);
    expect(unik).toHaveLength(1);
  });
});

describe('bentukPesanan — biaya level pesanan', () => {
  const dua = (admin2: Sel, diterima2: Sel) => [
    baris('A1', 'S1', 1, 60000, { Admin: 10000, Diterima: 85000 }),
    baris('A1', 'S2', 1, 40000, { Admin: admin2, Diterima: diterima2 }),
  ];

  it('pola 1: biaya diulang di setiap baris item', () => {
    const { pesanan, c } = satuTab(dua(10000, 85000));
    expect(pesanan).toHaveLength(1);
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(10000);
    expect(pesanan[0].nilaiOrder.total_diterima).toBe(85000);
    expect(c.masalah).toEqual([]);
  });

  it('pola 2: biaya hanya di baris pertama', () => {
    const { pesanan, c } = satuTab(dua(null, null));
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(10000);
    expect(pesanan[0].nilaiOrder.total_diterima).toBe(85000);
    expect(c.masalah).toEqual([]);
  });

  it('baris lanjutan berisi 0 diperlakukan seperti kosong', () => {
    const { pesanan, c } = satuTab(dua(0, 0));
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(10000);
    expect(c.masalah).toEqual([]);
  });

  it('nilai berbeda → nilai pertama dipakai + NILAI_PESANAN_TIDAK_KONSISTEN', () => {
    const { pesanan, c } = satuTab(dua(12000, 85000));
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(10000);
    expect(c.masalah).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'NILAI_PESANAN_TIDAK_KONSISTEN', baris: 3 });
  });

  it('nilai pertama yang tidak kosong boleh di baris kedua', () => {
    const { pesanan } = satuTab([baris('A1', 'S1', 1, 1000, { Admin: null }), baris('A1', 'S2', 1, 1000, { Admin: 7000 })]);
    expect(pesanan[0].nilaiOrder.biaya_admin).toBe(7000);
  });

  it('semua kosong → null; semua 0 → 0', () => {
    expect(satuTab([baris('A1', 'S1', 1, 1000)]).pesanan[0].nilaiOrder.total_diterima).toBeNull();
    expect(satuTab([baris('A1', 'S1', 1, 1000, { Diterima: 0 })]).pesanan[0].nilaiOrder.total_diterima).toBe(0);
  });

  it('pesanan batal bila semua barisnya batal; baris batal dikeluarkan dari aktif', () => {
    const { pesanan } = satuTab([
      baris('B1', 'S1', 1, 1000, { Status: 'Batal' }),
      baris('B1', 'S2', 1, 1000, { Status: 'Batal' }),
      baris('C1', 'S1', 1, 1000),
      baris('C1', 'S2', 1, 1000, { Status: 'Batal' }),
    ]);
    expect(pesanan.map((p) => [p.no_pesanan, p.batal, p.aktif.length])).toEqual([['B1', true, 0], ['C1', false, 1]]);
  });

  it('bulan & tanggal pesanan dari baris pertama, dalam WIB', () => {
    const { pesanan } = satuTab([baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-31T17:30:00Z' })]);
    expect(pesanan[0].bulan).toBe('2026-08');
    expect(pesanan[0].tanggal).toBe('2026-08-01');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/orders.test.ts`
Expected: FAIL karena modul `dedupe.js` dan `orders.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/dedupe.ts`:
```ts
import type { Catatan } from './catatan.js';
import { kunci } from './parse.js';
import type { BarisItem } from './types.js';

/** Kunci platform + no_pesanan + sku. Kemunculan pertama dipakai (spec §6.7). */
export function buangDuplikat(baris: BarisItem[], catatan: Catatan): BarisItem[] {
  const pertama = new Map<string, BarisItem>();
  const hasil: BarisItem[] = [];
  for (const b of baris) {
    const k = `${kunci(b.platform)}|${kunci(b.no_pesanan)}|${kunci(b.sku)}`;
    const ada = pertama.get(k);
    if (ada) {
      catatan.tambah({
        jenis: 'DUPLIKAT', platform: b.platform, sheet: b.sheet, baris: b.baris, no_pesanan: b.no_pesanan, sku: b.sku,
        pesan: `Duplikat dari ${ada.sheet} baris ${ada.baris} (no_pesanan + sku sama). Baris ini diabaikan.`,
      });
      continue;
    }
    pertama.set(k, b);
    hasil.push(b);
  }
  return hasil;
}
```

`api/src/core/orders.ts`:
```ts
import type { Catatan } from './catatan.js';
import { bulanJakarta, kunci, tanggalJakarta } from './parse.js';
import type { BarisItem, FieldOrder, Pesanan } from './types.js';

/** Mengelompokkan baris per platform + no_pesanan dan menentukan nilai level pesanan (spec §6.3). */
export function bentukPesanan(baris: BarisItem[], catatan: Catatan): Pesanan[] {
  const grup = new Map<string, BarisItem[]>();
  for (const b of baris) {
    const k = `${kunci(b.platform)}|${kunci(b.no_pesanan)}`;
    const g = grup.get(k);
    if (g) g.push(b);
    else grup.set(k, [b]);
  }

  const hasil: Pesanan[] = [];
  for (const semua of grup.values()) {
    const pertama = semua[0];
    const fields = new Set<FieldOrder>();
    for (const b of semua) for (const f of Object.keys(b.biayaOrder) as FieldOrder[]) fields.add(f);
    const nilaiOrder: Partial<Record<FieldOrder, number | null>> = {};
    for (const f of fields) nilaiOrder[f] = nilaiPesanan(semua, f, catatan);
    const aktif = semua.filter((b) => b.status !== 'batal');
    hasil.push({
      platform: pertama.platform,
      no_pesanan: pertama.no_pesanan,
      waktu: pertama.waktu,
      bulan: bulanJakarta(pertama.waktu),
      tanggal: tanggalJakarta(pertama.waktu),
      batal: aktif.length === 0,
      aktif,
      nilaiOrder,
    });
  }
  return hasil;
}

/**
 * Nilai pertama yang tidak kosong menurut urutan baris. 0 diperlakukan seperti kosong;
 * bila semua baris 0 hasilnya 0, bila semua kosong hasilnya null.
 */
function nilaiPesanan(semua: BarisItem[], f: FieldOrder, catatan: Catatan): number | null {
  let dipakai: number | null = null;
  let adaNol = false;
  for (const b of semua) {
    const v = b.biayaOrder[f];
    if (v === null || v === undefined) continue;
    if (v === 0) {
      adaNol = true;
      continue;
    }
    if (dipakai === null) {
      dipakai = v;
      continue;
    }
    if (v !== dipakai) {
      catatan.tambah({
        jenis: 'NILAI_PESANAN_TIDAK_KONSISTEN', platform: b.platform, sheet: b.sheet, baris: b.baris,
        no_pesanan: b.no_pesanan, sku: b.sku,
        pesan: `${f} berbeda antarbaris dalam satu pesanan (${v} vs ${dipakai}). Nilai pertama yang tidak kosong yang dipakai.`,
      });
      break;
    }
  }
  return dipakai ?? (adaNol ? 0 : null);
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/dedupe.ts api/src/core/orders.ts api/test/core/orders.test.ts
git commit -m "feat(core): dedupe by platform+order+sku and resolve order-level values

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tab Biaya — validasi, periode, tarif packaging

**Files:**
- Create: `api/src/core/biaya.ts`
- Test: `api/test/core/biaya.test.ts`

**Interfaces:**
- Consumes: `parseAngka`, `parseBulan`, `kosong`, `kunci` (Task 2–3), `formatRupiah`, `namaBulan` (Task 1)
- Produces:
  - `validasiBiaya(rows: BiayaInput[], catatan): BiayaValid[]`. Nomor baris = indeks + 2, sheet `'Biaya'`.
  - `saringPeriode(biaya: BiayaValid[], periode: Set<string>, catatan): BiayaValid[]`. Menambahkan info `BIAYA_DI_LUAR_PERIODE`.
  - `buatTarifPackaging(biaya: BiayaValid[]): (platform: string, bulan: string) => number`

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/biaya.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buatTarifPackaging, saringPeriode, validasiBiaya } from '../../src/core/biaya.js';
import { Catatan } from '../../src/core/catatan.js';
import type { BiayaInput } from '../../src/core/types.js';
import { biaya } from './helpers.js';

describe('validasiBiaya', () => {
  it('menerima & menormalkan baris valid', () => {
    const c = new Catatan();
    const hasil = validasiBiaya([
      biaya('2026-07', 'Iklan', 1500000, 'Shopee'),
      { bulan: 'Juli 2026', jenis: ' tetap ', platform: '', nilai: 'Rp 3.000.000', keterangan: 'gaji' },
    ], c);
    expect(hasil).toEqual([
      { baris: 2, bulan: '2026-07', jenis: 'iklan', platform: 'Shopee', nilai: 1500000, keterangan: '' },
      { baris: 3, bulan: '2026-07', jenis: 'tetap', platform: null, nilai: 3000000, keterangan: 'gaji' },
    ]);
    expect(c.masalah).toEqual([]);
  });

  it('baris kosong dilewati diam-diam', () => {
    const c = new Catatan();
    expect(validasiBiaya([{ bulan: null, jenis: null, platform: null, nilai: null, keterangan: null }], c)).toEqual([]);
    expect(c.masalah).toEqual([]);
  });

  it.each<[BiayaInput, string]>([
    [{ bulan: 'abc', jenis: 'tetap', nilai: 1 }, 'bulan'],
    [{ bulan: '2026-07', jenis: 'gaji', nilai: 1 }, 'jenis'],
    [{ bulan: '2026-07', jenis: 'tetap', nilai: -5 }, 'nilai'],
    [{ bulan: '2026-07', jenis: 'tetap', nilai: 'x' }, 'nilai'],
    [{ bulan: '2026-07', jenis: 'iklan', nilai: 1 }, 'platform'],
  ])('%j → BIAYA_TIDAK_VALID (%s)', (row, kata) => {
    const c = new Catatan();
    expect(validasiBiaya([row], c)).toEqual([]);
    expect(c.masalah[0]).toMatchObject({ jenis: 'BIAYA_TIDAK_VALID', sheet: 'Biaya', baris: 2 });
    expect(c.masalah[0].pesan).toContain(kata);
  });
});

describe('saringPeriode', () => {
  it('biaya di luar periode diabaikan dan dilaporkan sebagai info', () => {
    const c = new Catatan();
    const valid = validasiBiaya([
      biaya('2026-06', 'iklan', 100000, 'Shopee'),
      biaya('2026-06', 'tetap', 50000),
      biaya('2026-06', 'packaging', 1000),
      biaya('2026-07', 'tetap', 70000),
    ], c);
    const di = saringPeriode(valid, new Set(['2026-07']), c);
    expect(di.map((b) => b.bulan)).toEqual(['2026-07']);
    expect(c.masalah).toEqual([]);
    expect(c.info).toEqual([{
      jenis: 'BIAYA_DI_LUAR_PERIODE',
      platform: null,
      jumlah: 1,
      pesan: 'Biaya untuk 1 bulan di luar periode data diabaikan (Juni 2026), total Rp150.000. Tarif packaging bulan tersebut juga diabaikan.',
      detail: [{ bulan: '2026-06', total_diabaikan: 150000, tarif_packaging_diabaikan: 1000 }],
    }]);
  });

  it('tanpa info bila semua di dalam periode', () => {
    const c = new Catatan();
    saringPeriode(validasiBiaya([biaya('2026-07', 'tetap', 1)], c), new Set(['2026-07']), c);
    expect(c.info).toEqual([]);
  });
});

describe('buatTarifPackaging', () => {
  it('tarif per platform mengalahkan tarif umum; baris sejenis dijumlahkan', () => {
    const c = new Catatan();
    const tarif = buatTarifPackaging(validasiBiaya([
      biaya('2026-07', 'packaging', 1000),
      biaya('2026-07', 'packaging', 500),
      biaya('2026-07', 'packaging', 2000, 'TikTok Shop'),
    ], c));
    expect(tarif('Shopee', '2026-07')).toBe(1500);
    expect(tarif('tiktok shop', '2026-07')).toBe(2000);
    expect(tarif('Shopee', '2026-08')).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/biaya.test.ts`
Expected: FAIL karena modul `biaya.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/biaya.ts`:
```ts
import type { Catatan } from './catatan.js';
import { formatRupiah, namaBulan } from './format.js';
import { kosong, kunci, parseAngka, parseBulan } from './parse.js';
import type { BiayaInput, BiayaValid } from './types.js';

const JENIS = new Set(['iklan', 'packaging', 'tetap']);

/** Validasi baris tab Biaya (spec §6.8). Header di baris 1, data mulai baris 2. */
export function validasiBiaya(rows: BiayaInput[], catatan: Catatan): BiayaValid[] {
  const hasil: BiayaValid[] = [];
  rows.forEach((r, i) => {
    const baris = i + 2;
    if ([r.bulan, r.jenis, r.platform, r.nilai, r.keterangan].every(kosong)) return;
    const bulan = parseBulan(r.bulan);
    const jenis = kosong(r.jenis) ? '' : String(r.jenis).trim().toLowerCase();
    const platform = kosong(r.platform) ? null : String(r.platform).trim();
    const nilai = parseAngka(r.nilai);

    const alasan: string[] = [];
    if (!bulan) alasan.push(`bulan "${String(r.bulan ?? '')}" tidak terbaca`);
    if (!JENIS.has(jenis)) alasan.push(`jenis "${String(r.jenis ?? '')}" harus iklan, packaging, atau tetap`);
    if (nilai === null || Number.isNaN(nilai) || nilai < 0) alasan.push(`nilai "${String(r.nilai ?? '')}" tidak valid`);
    if (jenis === 'iklan' && !platform) alasan.push('iklan wajib diisi platform');
    if (alasan.length > 0) {
      catatan.tambah({ jenis: 'BIAYA_TIDAK_VALID', sheet: 'Biaya', baris, platform, pesan: `Baris Biaya dilewati: ${alasan.join('; ')}.` });
      return;
    }
    hasil.push({
      baris,
      bulan: bulan as string,
      jenis: jenis as BiayaValid['jenis'],
      platform,
      nilai: Math.round(nilai as number),
      keterangan: kosong(r.keterangan) ? '' : String(r.keterangan).trim(),
    });
  });
  return hasil;
}

/** Hanya biaya dalam periode laporan yang dipakai; sisanya dilaporkan sebagai info. */
export function saringPeriode(biaya: BiayaValid[], periode: Set<string>, catatan: Catatan): BiayaValid[] {
  const luar = biaya.filter((b) => !periode.has(b.bulan));
  if (luar.length > 0) {
    const perBulan = new Map<string, { total: number; packaging: number }>();
    for (const b of luar) {
      const x = perBulan.get(b.bulan) ?? { total: 0, packaging: 0 };
      if (b.jenis === 'packaging') x.packaging += b.nilai;
      else x.total += b.nilai;
      perBulan.set(b.bulan, x);
    }
    const bulan = [...perBulan.keys()].sort();
    const total = [...perBulan.values()].reduce((a, x) => a + x.total, 0);
    const adaPackaging = [...perBulan.values()].some((x) => x.packaging > 0);
    catatan.tambahInfo({
      jenis: 'BIAYA_DI_LUAR_PERIODE',
      platform: null,
      jumlah: bulan.length,
      pesan:
        `Biaya untuk ${bulan.length} bulan di luar periode data diabaikan (${bulan.map(namaBulan).join(', ')}), ` +
        `total ${formatRupiah(total)}.` + (adaPackaging ? ' Tarif packaging bulan tersebut juga diabaikan.' : ''),
      detail: bulan.map((b) => ({
        bulan: b,
        total_diabaikan: perBulan.get(b)!.total,
        tarif_packaging_diabaikan: perBulan.get(b)!.packaging,
      })),
    });
  }
  return biaya.filter((b) => periode.has(b.bulan));
}

/** Tarif packaging per pesanan; tarif per platform mengalahkan tarif umum bulan yang sama. */
export function buatTarifPackaging(biaya: BiayaValid[]): (platform: string, bulan: string) => number {
  const umum = new Map<string, number>();
  const khusus = new Map<string, number>();
  for (const b of biaya) {
    if (b.jenis !== 'packaging') continue;
    if (b.platform) {
      const k = `${kunci(b.platform)}|${b.bulan}`;
      khusus.set(k, (khusus.get(k) ?? 0) + b.nilai);
    } else {
      umum.set(b.bulan, (umum.get(b.bulan) ?? 0) + b.nilai);
    }
  }
  return (platform, bulan) => khusus.get(`${kunci(platform)}|${bulan}`) ?? umum.get(bulan) ?? 0;
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/biaya.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/biaya.ts api/test/core/biaya.test.ts
git commit -m "feat(core): validate Biaya tab, report-period filter, packaging rates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Perhitungan per item (alokasi biaya, retur, HPP, potongan_lainnya, packaging)

**Files:**
- Create: `api/src/core/hitung.ts`
- Test: `api/test/core/hitung.test.ts`

**Interfaces:**
- Consumes: `allocate`, `bobotItem` (Task 4), `Pesanan` dari `bentukPesanan` (Task 7), `formatRupiah`, `formatPersen` (Task 1)
- Produces:
  - `bangunHpp(rows: HppInput[]): Map<string, DataHpp>`. Kunci peta = `kunci(sku)`; jika ada SKU ganda, baris pertama yang dipakai.
  - `hitungItem(daftar: Pesanan[], ktx: KonteksHitung, catatan): { items: ItemHasil[]; pesanan: RingkasPesanan[] }`
  - `interface KonteksHitung { hpp: Map<string, DataHpp>; tarifPackaging: (platform, bulan) => number; opsi: Opsi }`

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/hitung.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { buangDuplikat } from '../../src/core/dedupe.js';
import { ekstrakBaris } from '../../src/core/extract.js';
import { bangunHpp, hitungItem } from '../../src/core/hitung.js';
import { bentukPesanan } from '../../src/core/orders.js';
import { OPSI_DEFAULT, type Opsi, type Pemetaan } from '../../src/core/types.js';
import { baris, type BarisUji, mappingStd, tab } from './helpers.js';

const HPP = bangunHpp([{ sku: 'S1', nama: 'Kopi A', hpp: 30000 }, { sku: 'S2', nama: 'Kopi B', hpp: 20000 }]);

function jalankan(rows: BarisUji[], o: { mapping?: Pemetaan; tarif?: number; opsi?: Partial<Opsi> } = {}) {
  const c = new Catatan();
  const pesanan = bentukPesanan(buangDuplikat(ekstrakBaris(tab('Shopee', rows, o.mapping ?? mappingStd()), c).baris, c), c);
  const h = hitungItem(pesanan, { hpp: HPP, tarifPackaging: () => o.tarif ?? 0, opsi: { ...OPSI_DEFAULT, ...o.opsi } }, c);
  return { ...h, c };
}
const ambil = (items: ReturnType<typeof jalankan>['items'], k: 'biaya_admin' | 'lainnya' | 'packaging' | 'diskon_voucher' | 'hpp') =>
  items.map((i) => i[k]);

describe('hitungItem — biaya level pesanan & potongan_lainnya', () => {
  const pola = (admin2: number | null, diterima2: number | null) => [
    baris('A1', 'S1', 1, 60000, { Admin: 10000, Diterima: 85000 }),
    baris('A1', 'S2', 1, 40000, { Admin: admin2, Diterima: diterima2 }),
  ];

  it('dibagi menurut nilai item; potongan_lainnya = nilai − terpetakan − total_diterima', () => {
    const { items, pesanan, c } = jalankan(pola(null, null));
    expect(ambil(items, 'biaya_admin')).toEqual([6000, 4000]);
    expect(ambil(items, 'lainnya')).toEqual([3000, 2000]);
    expect(pesanan).toEqual([{ platform: 'Shopee', no_pesanan: 'A1', bulan: '2026-07', tanggal: '2026-07-10', punyaRetur: false, belumCair: false }]);
    expect(c.masalah).toEqual([]);
  });

  it('pola diulang di setiap baris = pola hanya baris pertama', () => {
    expect(jalankan(pola(10000, 85000)).items).toEqual(jalankan(pola(null, null)).items);
  });

  it('diskon level item tetap milik barisnya', () => {
    const { items } = jalankan(
      [baris('A1', 'S1', 1, 60000, { Diskon: 5000 }), baris('A1', 'S2', 1, 40000)],
      { mapping: mappingStd({ total_diterima: undefined }) },
    );
    expect(ambil(items, 'diskon_voucher')).toEqual([5000, 0]);
  });

  it('nilai item nol semua → dibagi menurut qty', () => {
    const { items } = jalankan([baris('A1', 'S1', 1, 0, { Admin: 4000 }), baris('A1', 'S2', 3, 0)]);
    expect(ambil(items, 'biaya_admin')).toEqual([1000, 3000]);
  });

  it.each([null, 0])('belum cair (total_diterima = %j): lainnya 0, info bukan masalah', (v) => {
    const { items, pesanan, c } = jalankan([baris('A1', 'S1', 1, 100000, { Admin: 5000, Diterima: v })]);
    expect(ambil(items, 'lainnya')).toEqual([0]);
    expect(pesanan[0].belumCair).toBe(true);
    expect(c.masalah).toEqual([]);
  });

  it('total_diterima tidak dipetakan → lainnya 0 dan bukan belum cair', () => {
    const { items, pesanan } = jalankan([baris('A1', 'S1', 1, 100000)], { mapping: mappingStd({ total_diterima: undefined }) });
    expect(ambil(items, 'lainnya')).toEqual([0]);
    expect(pesanan[0].belumCair).toBe(false);
  });

  it('selisih negatif → SELISIH_REKONSILIASI dengan kemungkinan penyebab', () => {
    const { items, c } = jalankan([baris('A1', 'S1', 1, 100000, { Diskon: 10000, Diterima: 95000 })]);
    expect(ambil(items, 'lainnya')).toEqual([-5000]);
    expect(c.masalah).toHaveLength(1);
    expect(c.masalah[0]).toMatchObject({ jenis: 'SELISIH_REKONSILIASI', no_pesanan: 'A1', baris: 2 });
    expect(c.masalah[0].pesan).toBe(
      'Dana cair lebih besar Rp5.000 dari perhitungan. Kemungkinan harga_jual dipetakan ke harga setelah diskon ' +
        'sementara diskon_penjual juga dipetakan, atau ada subsidi dari marketplace.',
    );
  });

  it('selisih besar (> 50%) → SELISIH_REKONSILIASI', () => {
    const { items, c } = jalankan([baris('A1', 'S1', 1, 100000, { Diterima: 40000 })]);
    expect(ambil(items, 'lainnya')).toEqual([60000]);
    expect(c.masalah[0].pesan).toBe(
      'Potongan lainnya Rp60.000 (60,0% dari nilai pesanan). Periksa apakah ada kolom biaya yang belum dipetakan ' +
        'atau total_diterima dipetakan ke kolom yang salah.',
    );
  });

  it('selisih kecil tidak dicatat (−Rp1.000 s.d. 50%)', () => {
    expect(jalankan([baris('A1', 'S1', 1, 100000, { Diterima: 99500 })]).c.masalah).toEqual([]);
    expect(jalankan([baris('A1', 'S1', 1, 100000, { Diterima: 100800 })]).c.masalah).toEqual([]);
  });
});

describe('hitungItem — status', () => {
  it('retur: diskon/voucher tidak dihitung, biaya marketplace sesuai export, HPP 0', () => {
    const { items, pesanan } = jalankan([baris('A1', 'S1', 1, 50000, { Status: 'Retur', Diskon: 5000, Admin: 2000, Diterima: 0 })]);
    expect(items[0]).toMatchObject({ retur: true, nilai: 50000, diskon_voucher: 0, biaya_admin: 2000, hpp: 0, lainnya: 0 });
    expect(pesanan[0]).toMatchObject({ punyaRetur: true, belumCair: false });
  });

  it('retur barang rusak → HPP tetap dihitung', () => {
    const { items } = jalankan([baris('A1', 'S1', 1, 50000, { Status: 'Retur' })], { opsi: { retur_barang_rusak: true } });
    expect(items[0].hpp).toBe(30000);
  });

  it('pesanan campuran selesai + retur: rekonsiliasi hanya atas item non-retur', () => {
    const { items, pesanan, c } = jalankan([
      baris('A1', 'S1', 1, 60000, { Admin: 10000, Diterima: 54000 }),
      baris('A1', 'S2', 1, 40000, { Status: 'Retur' }),
    ]);
    expect(ambil(items, 'biaya_admin')).toEqual([6000, 4000]);
    expect(ambil(items, 'lainnya')).toEqual([0, 0]);
    expect(pesanan[0]).toMatchObject({ punyaRetur: true, belumCair: false });
    expect(c.masalah).toEqual([]);
  });

  it('baris batal dikeluarkan; pesanan batal tidak menghasilkan item', () => {
    const { items, pesanan } = jalankan([
      baris('B1', 'S1', 1, 50000, { Status: 'Batal' }),
      baris('C1', 'S1', 1, 60000, { Admin: 10000, Diterima: 50000 }),
      baris('C1', 'S2', 1, 40000, { Status: 'Batal' }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ no_pesanan: 'C1', sku: 'S1', biaya_admin: 10000, lainnya: 0 });
    expect(pesanan.map((p) => p.no_pesanan)).toEqual(['C1']);
  });
});

describe('hitungItem — HPP & packaging', () => {
  it('HPP = hpp_sku × qty; nama jatuh ke tab HPP', () => {
    const { items } = jalankan([baris('A1', 'S1', 2, 50000)]);
    expect(items[0]).toMatchObject({ hpp: 60000, hpp_tersedia: true, nama: 'Kopi A' });
  });

  it('SKU tanpa HPP: HPP 0 dan dicatat sekali per SKU', () => {
    const { items, c } = jalankan([baris('A1', 'S9', 1, 1000), baris('A2', 'S9', 1, 1000)]);
    expect(ambil(items, 'hpp')).toEqual([0, 0]);
    expect(items.every((i) => !i.hpp_tersedia)).toBe(true);
    expect(c.jumlah).toEqual({ SKU_TANPA_HPP: 1 });
    expect(c.masalah[0]).toMatchObject({ jenis: 'SKU_TANPA_HPP', sku: 'S9', baris: 2 });
    expect(c.masalah[0].pesan).toBe('SKU S9 belum ada di tab HPP (2 baris). HPP dianggap 0.');
  });

  it('packaging per pesanan dibagi menurut nilai; berlaku juga untuk retur', () => {
    const { items } = jalankan(
      [baris('A1', 'S1', 1, 60000), baris('A1', 'S2', 1, 40000), baris('A2', 'S1', 1, 50000, { Status: 'Retur' })],
      { tarif: 1500 },
    );
    expect(ambil(items, 'packaging')).toEqual([900, 600, 1500]);
  });

  // --- Review Focus ---
  it('SKU cocok dengan tab HPP tanpa beda huruf/spasi', () => {
    const { items } = jalankan([baris('A1', ' s1 ', 1, 50000)]);
    expect(items[0]).toMatchObject({ hpp: 30000, hpp_tersedia: true });
  });
});

describe('bangunHpp', () => {
  it('hpp tak terbaca dilewati; SKU ganda → baris pertama', () => {
    const peta = bangunHpp([
      { sku: 'A', hpp: 'x' },
      { sku: 'B', hpp: 'Rp 12.500', nama: ' Kopi ' },
      { sku: 'b', hpp: 99 },
      { sku: null, hpp: 1 },
    ]);
    expect([...peta.entries()]).toEqual([['b', { hpp: 12500, nama: 'Kopi' }]]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/hitung.test.ts`
Expected: FAIL karena modul `hitung.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/hitung.ts`:
```ts
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
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/hitung.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/hitung.ts api/test/core/hitung.test.ts
git commit -m "feat(core): per-item fees, returns, HPP, reconciliation, packaging

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Alokasi iklan

**Files:**
- Create: `api/src/core/iklan.ts`
- Test: `api/test/core/iklan.test.ts`

**Interfaces:**
- Consumes: `ItemHasil` (Task 9), `BiayaValid` (Task 8), `allocate` (Task 4)
- Produces: `alokasiIklan(items: ItemHasil[], biaya: BiayaValid[], catatan): { produk: IklanProduk[]; sisa: IklanSisa[] }`. Input `biaya` yang diterima sudah tersaring ke dalam periode.

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/iklan.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { alokasiIklan } from '../../src/core/iklan.js';
import type { BiayaValid, ItemHasil } from '../../src/core/types.js';

const item = (platform: string, bulan: string, sku: string, nilai: number, retur = false): ItemHasil => ({
  platform, bulan, tanggal: `${bulan}-10`, no_pesanan: 'X', sku, nama: null, qty: 1, retur, nilai,
  diskon_voucher: 0, biaya_admin: 0, biaya_layanan: 0, ongkir: 0, lainnya: 0, hpp: 0, hpp_tersedia: true, packaging: 0,
});
const iklan = (platform: string, bulan: string, nilai: number): BiayaValid => ({
  baris: 2, bulan, jenis: 'iklan', platform, nilai, keterangan: '',
});

describe('alokasiIklan', () => {
  const items = [
    item('Shopee', '2026-07', 'S1', 100000),
    item('Shopee', '2026-07', 'S2', 40000),
    item('Shopee', '2026-07', 'S2', 40000, true),
    item('TikTok Shop', '2026-07', 'S1', 50000),
  ];

  it('proporsional terhadap omzet kotor produk di platform & bulan itu (retur ikut omzet kotor)', () => {
    const c = new Catatan();
    const hasil = alokasiIklan(items, [iklan('Shopee', '2026-07', 14000)], c);
    expect(hasil.produk).toEqual([
      { platform: 'Shopee', bulan: '2026-07', sku: 'S1', nilai: 7778 },
      { platform: 'Shopee', bulan: '2026-07', sku: 'S2', nilai: 6222 },
    ]);
    expect(hasil.sisa).toEqual([]);
    expect(c.masalah).toEqual([]);
  });

  it('beberapa baris iklan platform-bulan yang sama dijumlahkan', () => {
    const hasil = alokasiIklan(items, [iklan('TikTok Shop', '2026-07', 3000), iklan('TikTok Shop', '2026-07', 2000)], new Catatan());
    expect(hasil.produk).toEqual([{ platform: 'TikTok Shop', bulan: '2026-07', sku: 'S1', nilai: 5000 }]);
  });

  it('platform tanpa penjualan di bulan itu → tidak teralokasi', () => {
    const c = new Catatan();
    const hasil = alokasiIklan(items, [iklan('TikTok Shop', '2026-08', 5000)], c);
    expect(hasil.produk).toEqual([]);
    expect(hasil.sisa).toEqual([{ platform: 'TikTok Shop', bulan: '2026-08', nilai: 5000 }]);
    expect(c.masalah[0]).toMatchObject({ jenis: 'IKLAN_TIDAK_TERALOKASI', platform: 'TikTok Shop', sheet: 'Biaya' });
    expect(c.masalah[0].pesan).toBe(
      'Iklan TikTok Shop Agustus 2026 sebesar Rp5.000 tidak bisa dibagi karena tidak ada penjualan TikTok Shop ' +
        'di bulan itu. Tetap mengurangi laba bersih.',
    );
  });

  // --- Review Focus ---
  it('nama platform di tab Biaya beda huruf tetap cocok', () => {
    const hasil = alokasiIklan(items, [iklan('shopee ', '2026-07', 1800)], new Catatan());
    expect(hasil.produk.map((p) => [p.platform, p.sku, p.nilai])).toEqual([['Shopee', 'S1', 1000], ['Shopee', 'S2', 800]]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/iklan.test.ts`
Expected: FAIL karena modul `iklan.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/iklan.ts`:
```ts
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
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/iklan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/iklan.ts api/test/core/iklan.test.ts
git commit -m "feat(core): allocate ad spend by product revenue per platform-month

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Periode, bulan tidak penuh, info belum cair

**Files:**
- Create: `api/src/core/info.ts`
- Test: `api/test/core/info.test.ts`

**Interfaces:**
- Consumes: `Pesanan` (Task 7), `RingkasPesanan` (Task 9), `hariDalamBulan` (Task 3), `namaBulan`, `namaBulanSaja` (Task 1)
- Produces:
  - `hitungPeriode(pesanan: Pesanan[]): string[]`. Bulan dari pesanan non-batal, unik dan terurut.
  - `cekBulanTidakPenuh(ringkas: RingkasPesanan[], catatan): void`
  - `infoBelumCair(ringkas: RingkasPesanan[], catatan): void`

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/info.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Catatan } from '../../src/core/catatan.js';
import { ekstrakBaris } from '../../src/core/extract.js';
import { cekBulanTidakPenuh, hitungPeriode, infoBelumCair } from '../../src/core/info.js';
import { bentukPesanan } from '../../src/core/orders.js';
import type { RingkasPesanan } from '../../src/core/types.js';
import { baris, tab } from './helpers.js';

const rp = (tanggal: string, platform = 'Shopee', belumCair = false): RingkasPesanan => ({
  platform, no_pesanan: tanggal, bulan: tanggal.slice(0, 7), tanggal, punyaRetur: false, belumCair,
});

describe('hitungPeriode', () => {
  it('bulan dari pesanan non-batal saja', () => {
    const c = new Catatan();
    const pesanan = bentukPesanan(ekstrakBaris(tab('Shopee', [
      baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-05 10:00' }),
      baris('A2', 'S1', 1, 1000, { Tanggal: '2026-08-05 10:00', Status: 'Batal' }),
      baris('A3', 'S1', 1, 1000, { Tanggal: '2026-06-05 10:00' }),
    ]), c).baris, c);
    expect(hitungPeriode(pesanan)).toEqual(['2026-06', '2026-07']);
  });
});

describe('cekBulanTidakPenuh', () => {
  const jalan = (tanggal: string[]) => {
    const c = new Catatan();
    cekBulanTidakPenuh(tanggal.map((t) => rp(t)), c);
    return c.info;
  };

  it('bulan penuh (ada tanggal 1 dan hari terakhir) → tanpa info', () => {
    expect(jalan(['2026-07-01', '2026-07-15', '2026-07-31'])).toEqual([]);
  });

  it('mulai tanggal 5 → info', () => {
    expect(jalan(['2026-07-05', '2026-07-31'])).toEqual([{
      jenis: 'BULAN_TIDAK_PENUH',
      platform: null,
      jumlah: 1,
      pesan: 'Data Juli 2026 hanya mencakup 5–31 Juli. Biaya tetap Juli tetap dihitung penuh.',
      detail: [{ bulan: '2026-07', hari_pertama: 5, hari_terakhir: 31 }],
    }]);
  });

  it('berakhir sebelum hari terakhir → info', () => {
    expect(jalan(['2026-09-01', '2026-09-29'])[0].pesan).toBe(
      'Data September 2026 hanya mencakup 1–29 September. Biaya tetap September tetap dihitung penuh.',
    );
  });

  it('Februari kabisat: hari terakhir 29', () => {
    expect(jalan(['2028-02-01', '2028-02-29'])).toEqual([]);
    expect(jalan(['2028-02-01', '2028-02-28'])).toHaveLength(1);
  });

  it('setiap bulan dinilai sendiri, terurut', () => {
    expect(jalan(['2026-08-03', '2026-08-31', '2026-07-01', '2026-07-31']).map((i) => i.detail?.[0].bulan)).toEqual(['2026-08']);
  });
});

describe('infoBelumCair', () => {
  it('satu info per platform, urut kemunculan', () => {
    const c = new Catatan();
    infoBelumCair([
      rp('2026-07-01', 'Shopee', true), rp('2026-07-02', 'TikTok Shop', true),
      rp('2026-07-03', 'Shopee', true), rp('2026-07-04', 'Shopee', false),
    ], c);
    expect(c.info).toEqual([
      { jenis: 'PESANAN_BELUM_CAIR', platform: 'Shopee', jumlah: 2, pesan: '2 pesanan Shopee belum cair; laba dihitung dari potongan yang terpetakan.' },
      { jenis: 'PESANAN_BELUM_CAIR', platform: 'TikTok Shop', jumlah: 1, pesan: '1 pesanan TikTok Shop belum cair; laba dihitung dari potongan yang terpetakan.' },
    ]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/info.test.ts`
Expected: FAIL karena modul `info.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/info.ts`:
```ts
import type { Catatan } from './catatan.js';
import { namaBulan, namaBulanSaja } from './format.js';
import { hariDalamBulan, kunci } from './parse.js';
import type { Pesanan, RingkasPesanan } from './types.js';

/** Periode laporan = bulan-bulan yang punya pesanan non-batal (spec §6.8). */
export function hitungPeriode(pesanan: Pesanan[]): string[] {
  return [...new Set(pesanan.filter((p) => !p.batal).map((p) => p.bulan))].sort();
}

export function cekBulanTidakPenuh(ringkas: RingkasPesanan[], catatan: Catatan): void {
  const rentang = new Map<string, { awal: number; akhir: number }>();
  for (const p of ringkas) {
    const hari = Number(p.tanggal.slice(8, 10));
    const r = rentang.get(p.bulan);
    if (!r) rentang.set(p.bulan, { awal: hari, akhir: hari });
    else {
      r.awal = Math.min(r.awal, hari);
      r.akhir = Math.max(r.akhir, hari);
    }
  }
  for (const bulan of [...rentang.keys()].sort()) {
    const { awal, akhir } = rentang.get(bulan)!;
    if (awal === 1 && akhir === hariDalamBulan(bulan)) continue;
    const nama = namaBulanSaja(bulan);
    catatan.tambahInfo({
      jenis: 'BULAN_TIDAK_PENUH',
      platform: null,
      jumlah: 1,
      pesan: `Data ${namaBulan(bulan)} hanya mencakup ${awal}–${akhir} ${nama}. Biaya tetap ${nama} tetap dihitung penuh.`,
      detail: [{ bulan, hari_pertama: awal, hari_terakhir: akhir }],
    });
  }
}

export function infoBelumCair(ringkas: RingkasPesanan[], catatan: Catatan): void {
  const per = new Map<string, { platform: string; jumlah: number }>();
  for (const p of ringkas) {
    if (!p.belumCair) continue;
    const x = per.get(kunci(p.platform));
    if (x) x.jumlah++;
    else per.set(kunci(p.platform), { platform: p.platform, jumlah: 1 });
  }
  for (const { platform, jumlah } of per.values()) {
    catatan.tambahInfo({
      jenis: 'PESANAN_BELUM_CAIR',
      platform,
      jumlah,
      pesan: `${jumlah} pesanan ${platform} belum cair; laba dihitung dari potongan yang terpetakan.`,
    });
  }
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/info.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/info.ts api/test/core/info.test.ts
git commit -m "feat(core): report period, partial-month and not-yet-paid info

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Agregasi laporan

**Files:**
- Create: `api/src/core/aggregate.ts`
- Test: `api/test/core/aggregate.test.ts`

**Interfaces:**
- Consumes: `ItemHasil`, `RingkasPesanan` (Task 9), `IklanProduk`, `IklanSisa` (Task 10), `BiayaValid` (Task 8)
- Produces:
  - `margin(laba: number, penjualanBersih: number): number`. Dibulatkan 1 desimal menjauhi nol; hasilnya 0 bila penjualan bersih = 0.
  - `agregasi(m: MasukanAgregasi): HasilAgregasi`. `HasilAgregasi` adalah `Pick<Laporan, 'ringkasan' | 'rincian_biaya_marketplace' | 'per_produk' | 'per_platform' | 'per_bulan'>`.
  - `interface MasukanAgregasi { items; pesanan: RingkasPesanan[]; jumlahBatal: number; iklanProduk; iklanSisa; biaya: BiayaValid[]; periode: string[] }`

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/aggregate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { agregasi, margin } from '../../src/core/aggregate.js';
import type { ItemHasil, RingkasPesanan } from '../../src/core/types.js';

const nolItem: Omit<ItemHasil, 'platform' | 'bulan' | 'tanggal' | 'no_pesanan' | 'sku' | 'nilai'> = {
  nama: null, qty: 1, retur: false, diskon_voucher: 0, biaya_admin: 0, biaya_layanan: 0, ongkir: 0, lainnya: 0,
  hpp: 0, hpp_tersedia: true, packaging: 0,
};
const rp = (platform: string, no: string, tanggal: string, punyaRetur = false): RingkasPesanan => ({
  platform, no_pesanan: no, bulan: tanggal.slice(0, 7), tanggal, punyaRetur, belumCair: false,
});

describe('margin', () => {
  it.each([
    [1, 3, 33.3], [-3222, 40000, -8.1], [5, 0, 0], [-1, 8, -12.5], [-1, 16, -6.3], [1, 16, 6.3], [1500, 150000, 1],
  ])('margin(%d, %d) = %d', (laba, pb, hasil) => {
    expect(margin(laba, pb)).toBe(hasil);
  });
});

describe('agregasi', () => {
  const hasil = agregasi({
    items: [
      { ...nolItem, platform: 'Shopee', bulan: '2026-07', tanggal: '2026-07-01', no_pesanan: 'A1', sku: 'S1', nama: 'Kopi A', qty: 2, nilai: 100000, biaya_admin: 8000, biaya_layanan: 2000, hpp: 60000, packaging: 1000 },
      { ...nolItem, platform: 'Shopee', bulan: '2026-07', tanggal: '2026-07-15', no_pesanan: 'A4', sku: 'S2', retur: true, nilai: 40000, packaging: 1000 },
      { ...nolItem, platform: 'TikTok Shop', bulan: '2026-08', tanggal: '2026-08-31', no_pesanan: 'B1', sku: 'S1', nama: 'Kopi A', nilai: 50000, diskon_voucher: 1000, biaya_admin: 5000, lainnya: 500, hpp: 30000, packaging: 1000 },
    ],
    pesanan: [rp('Shopee', 'A1', '2026-07-01'), rp('Shopee', 'A4', '2026-07-15', true), rp('TikTok Shop', 'B1', '2026-08-31')],
    jumlahBatal: 1,
    iklanProduk: [{ platform: 'Shopee', bulan: '2026-07', sku: 'S1', nilai: 7000 }],
    iklanSisa: [{ platform: 'TikTok Shop', bulan: '2026-08', nilai: 2000 }],
    biaya: [
      { baris: 2, bulan: '2026-07', jenis: 'tetap', platform: null, nilai: 10000, keterangan: '' },
      { baris: 3, bulan: '2026-08', jenis: 'tetap', platform: null, nilai: 20000, keterangan: '' },
      { baris: 4, bulan: '2026-08', jenis: 'iklan', platform: 'TikTok Shop', nilai: 2000, keterangan: '' },
    ],
    periode: ['2026-07', '2026-08'],
  });

  it('ringkasan mengikuti rantai laba', () => {
    expect(hasil.ringkasan).toEqual({
      omzet_kotor: 190000, retur: 40000, penjualan_bersih: 150000,
      diskon_voucher_penjual: 1000, biaya_marketplace: 15500, total_potongan_marketplace: 16500, dana_diterima: 133500,
      hpp: 90000, iklan: 7000, packaging: 3000, laba_kontribusi: 33500,
      biaya_tetap: 30000, laba_bersih: 1500, margin_persen: 1,
      jumlah_pesanan: 3, jumlah_pesanan_batal: 1, jumlah_pesanan_retur: 1, jumlah_pesanan_belum_cair: 0,
      iklan_tidak_teralokasi: 2000, tanggal_pertama: '2026-07-01', tanggal_terakhir: '2026-08-31',
      periode: ['2026-07', '2026-08'],
    });
    expect(hasil.rincian_biaya_marketplace).toEqual({ biaya_admin: 13000, biaya_layanan: 2000, ongkir_ditanggung_penjual: 0, potongan_lainnya: 500 });
  });

  it('per produk: urut dari laba terkecil; qty tanpa retur; nama jatuh ke sku', () => {
    expect(hasil.per_produk).toEqual([
      { sku: 'S2', nama: 'S2', qty: 0, omzet_kotor: 40000, retur: 40000, penjualan_bersih: 0, potongan_marketplace: 0, hpp: 0, iklan: 0, packaging: 1000, laba_kontribusi: -1000, margin_persen: 0, hpp_tersedia: true },
      { sku: 'S1', nama: 'Kopi A', qty: 3, omzet_kotor: 150000, retur: 0, penjualan_bersih: 150000, potongan_marketplace: 16500, hpp: 90000, iklan: 7000, packaging: 2000, laba_kontribusi: 34500, margin_persen: 23, hpp_tersedia: true },
    ]);
  });

  it('per platform: urut nama', () => {
    expect(hasil.per_platform).toEqual([
      { platform: 'Shopee', jumlah_pesanan: 2, qty: 2, omzet_kotor: 140000, retur: 40000, penjualan_bersih: 100000, potongan_marketplace: 10000, hpp: 60000, iklan: 7000, packaging: 2000, laba_kontribusi: 21000, margin_persen: 21 },
      { platform: 'TikTok Shop', jumlah_pesanan: 1, qty: 1, omzet_kotor: 50000, retur: 0, penjualan_bersih: 50000, potongan_marketplace: 6500, hpp: 30000, iklan: 0, packaging: 1000, laba_kontribusi: 12500, margin_persen: 25 },
    ]);
  });

  it('per bulan: iklan hanya teralokasi; iklan tak teralokasi & biaya tetap terpisah; margin dari laba bersih', () => {
    expect(hasil.per_bulan).toEqual([
      { bulan: '2026-07', jumlah_pesanan: 2, omzet_kotor: 140000, retur: 40000, penjualan_bersih: 100000, potongan_marketplace: 10000, hpp: 60000, iklan: 7000, packaging: 2000, laba_kontribusi: 21000, iklan_tidak_teralokasi: 0, biaya_tetap: 10000, laba_bersih: 11000, margin_persen: 11 },
      { bulan: '2026-08', jumlah_pesanan: 1, omzet_kotor: 50000, retur: 0, penjualan_bersih: 50000, potongan_marketplace: 6500, hpp: 30000, iklan: 0, packaging: 1000, laba_kontribusi: 12500, iklan_tidak_teralokasi: 2000, biaya_tetap: 20000, laba_bersih: -9500, margin_persen: -19 },
    ]);
  });

  it('tanpa item: tanggal null, angka nol', () => {
    const kosong = agregasi({ items: [], pesanan: [], jumlahBatal: 0, iklanProduk: [], iklanSisa: [], biaya: [], periode: [] });
    expect(kosong.ringkasan.tanggal_pertama).toBeNull();
    expect(kosong.ringkasan.laba_bersih).toBe(0);
    expect(kosong.per_bulan).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/aggregate.test.ts`
Expected: FAIL karena modul `aggregate.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/aggregate.ts`:
```ts
import { kunci } from './parse.js';
import type {
  BarisBulan, BarisPlatform, BarisProduk, BiayaValid, IklanProduk, IklanSisa, ItemHasil, KolomLaba, Laporan, RingkasPesanan,
} from './types.js';

export interface MasukanAgregasi {
  items: ItemHasil[];
  pesanan: RingkasPesanan[];
  jumlahBatal: number;
  iklanProduk: IklanProduk[];
  iklanSisa: IklanSisa[];
  /** Biaya dalam periode. */
  biaya: BiayaValid[];
  periode: string[];
}
export type HasilAgregasi = Pick<Laporan, 'ringkasan' | 'rincian_biaya_marketplace' | 'per_produk' | 'per_platform' | 'per_bulan'>;

interface Akumulasi {
  qty: number; omzet_kotor: number; retur: number; diskon_voucher: number;
  biaya_admin: number; biaya_layanan: number; ongkir: number; lainnya: number;
  hpp: number; iklan: number; packaging: number;
}
const baru = (): Akumulasi => ({
  qty: 0, omzet_kotor: 0, retur: 0, diskon_voucher: 0, biaya_admin: 0, biaya_layanan: 0, ongkir: 0, lainnya: 0, hpp: 0, iklan: 0, packaging: 0,
});
const jumlah = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Laba ÷ penjualan bersih × 100, 1 desimal (dibulatkan menjauhi nol); 0 bila penjualan bersih 0. */
export function margin(laba: number, penjualanBersih: number): number {
  if (penjualanBersih === 0) return 0;
  const x = (laba / penjualanBersih) * 100;
  return (Math.sign(x) * Math.round(Math.abs(x) * 10)) / 10 || 0;
}

function tambah(a: Akumulasi, it: ItemHasil): void {
  if (!it.retur) a.qty += it.qty;
  a.omzet_kotor += it.nilai;
  if (it.retur) a.retur += it.nilai;
  a.diskon_voucher += it.diskon_voucher;
  a.biaya_admin += it.biaya_admin;
  a.biaya_layanan += it.biaya_layanan;
  a.ongkir += it.ongkir;
  a.lainnya += it.lainnya;
  a.hpp += it.hpp;
  a.packaging += it.packaging;
}

const biayaMarketplace = (a: Akumulasi) => a.biaya_admin + a.biaya_layanan + a.ongkir + a.lainnya;

/** Rantai laba spec §6.9 sampai laba kontribusi. */
function kolomLaba(a: Akumulasi): KolomLaba {
  const penjualan_bersih = a.omzet_kotor - a.retur;
  const potongan_marketplace = a.diskon_voucher + biayaMarketplace(a);
  const laba_kontribusi = penjualan_bersih - potongan_marketplace - a.hpp - a.iklan - a.packaging;
  return {
    omzet_kotor: a.omzet_kotor, retur: a.retur, penjualan_bersih, potongan_marketplace,
    hpp: a.hpp, iklan: a.iklan, packaging: a.packaging, laba_kontribusi,
    margin_persen: margin(laba_kontribusi, penjualan_bersih),
  };
}

function ambil<T>(m: Map<string, T>, k: string, buat: () => T): T {
  let v = m.get(k);
  if (v === undefined) m.set(k, (v = buat()));
  return v;
}

export function agregasi(m: MasukanAgregasi): HasilAgregasi {
  const total = baru();
  const produk = new Map<string, { sku: string; nama: string | null; hpp_tersedia: boolean; a: Akumulasi }>();
  const platform = new Map<string, { platform: string; pesanan: number; a: Akumulasi }>();
  const bulan = new Map<string, { pesanan: number; a: Akumulasi; iklanSisa: number; tetap: number }>();
  const bulanBaru = () => ({ pesanan: 0, a: baru(), iklanSisa: 0, tetap: 0 });
  for (const b of m.periode) ambil(bulan, b, bulanBaru);

  for (const it of m.items) {
    const p = ambil(produk, kunci(it.sku), () => ({ sku: it.sku, nama: null as string | null, hpp_tersedia: true, a: baru() }));
    p.nama ??= it.nama;
    if (!it.hpp_tersedia) p.hpp_tersedia = false;
    tambah(p.a, it);
    tambah(ambil(platform, kunci(it.platform), () => ({ platform: it.platform, pesanan: 0, a: baru() })).a, it);
    tambah(ambil(bulan, it.bulan, bulanBaru).a, it);
    tambah(total, it);
  }
  for (const ik of m.iklanProduk) {
    ambil(produk, kunci(ik.sku), () => ({ sku: ik.sku, nama: null as string | null, hpp_tersedia: true, a: baru() })).a.iklan += ik.nilai;
    ambil(platform, kunci(ik.platform), () => ({ platform: ik.platform, pesanan: 0, a: baru() })).a.iklan += ik.nilai;
    ambil(bulan, ik.bulan, bulanBaru).a.iklan += ik.nilai;
    total.iklan += ik.nilai;
  }
  for (const s of m.iklanSisa) ambil(bulan, s.bulan, bulanBaru).iklanSisa += s.nilai;
  for (const b of m.biaya) if (b.jenis === 'tetap') ambil(bulan, b.bulan, bulanBaru).tetap += b.nilai;
  for (const ps of m.pesanan) {
    ambil(platform, kunci(ps.platform), () => ({ platform: ps.platform, pesanan: 0, a: baru() })).pesanan++;
    ambil(bulan, ps.bulan, bulanBaru).pesanan++;
  }

  const k = kolomLaba(total);
  const iklanSisa = jumlah(m.iklanSisa.map((s) => s.nilai));
  const tetap = jumlah(m.biaya.filter((b) => b.jenis === 'tetap').map((b) => b.nilai));
  const laba_bersih = k.laba_kontribusi - iklanSisa - tetap;
  const tanggal = m.pesanan.map((p) => p.tanggal).sort();

  const per_produk: BarisProduk[] = [...produk.values()]
    .map((p) => ({ sku: p.sku, nama: p.nama ?? p.sku, qty: p.a.qty, ...kolomLaba(p.a), hpp_tersedia: p.hpp_tersedia }))
    .sort((a, b) => a.laba_kontribusi - b.laba_kontribusi || a.sku.localeCompare(b.sku));
  const per_platform: BarisPlatform[] = [...platform.values()]
    .map((p) => ({ platform: p.platform, jumlah_pesanan: p.pesanan, qty: p.a.qty, ...kolomLaba(p.a) }))
    .sort((a, b) => a.platform.localeCompare(b.platform, 'id'));
  const per_bulan: BarisBulan[] = [...bulan.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([b, x]) => {
      const kb = kolomLaba(x.a);
      const lb = kb.laba_kontribusi - x.iklanSisa - x.tetap;
      return {
        bulan: b, jumlah_pesanan: x.pesanan, ...kb,
        iklan_tidak_teralokasi: x.iklanSisa, biaya_tetap: x.tetap, laba_bersih: lb,
        margin_persen: margin(lb, kb.penjualan_bersih),
      };
    });

  return {
    ringkasan: {
      omzet_kotor: k.omzet_kotor,
      retur: k.retur,
      penjualan_bersih: k.penjualan_bersih,
      diskon_voucher_penjual: total.diskon_voucher,
      biaya_marketplace: biayaMarketplace(total),
      total_potongan_marketplace: k.potongan_marketplace,
      dana_diterima: k.penjualan_bersih - k.potongan_marketplace,
      hpp: k.hpp,
      iklan: k.iklan,
      packaging: k.packaging,
      laba_kontribusi: k.laba_kontribusi,
      biaya_tetap: tetap,
      laba_bersih,
      margin_persen: margin(laba_bersih, k.penjualan_bersih),
      jumlah_pesanan: m.pesanan.length,
      jumlah_pesanan_batal: m.jumlahBatal,
      jumlah_pesanan_retur: m.pesanan.filter((p) => p.punyaRetur).length,
      jumlah_pesanan_belum_cair: m.pesanan.filter((p) => p.belumCair).length,
      iklan_tidak_teralokasi: iklanSisa,
      tanggal_pertama: tanggal[0] ?? null,
      tanggal_terakhir: tanggal[tanggal.length - 1] ?? null,
      periode: [...m.periode],
    },
    rincian_biaya_marketplace: {
      biaya_admin: total.biaya_admin,
      biaya_layanan: total.biaya_layanan,
      ongkir_ditanggung_penjual: total.ongkir,
      potongan_lainnya: total.lainnya,
    },
    per_produk,
    per_platform,
    per_bulan,
  };
}
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/aggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/aggregate.ts api/test/core/aggregate.test.ts
git commit -m "feat(core): aggregate summary, per product/platform/month

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Sorotan otomatis

**Files:**
- Create: `api/src/core/highlights.ts`
- Test: `api/test/core/highlights.test.ts`

**Interfaces:**
- Consumes: `BarisProduk`, `BarisPlatform`, `Opsi` (Task 1), `formatAngka`, `formatPersen`, `formatRupiah` (Task 1)
- Produces: `buatSorotan(produk: BarisProduk[], platform: BarisPlatform[], opsi: Opsi): Sorotan[]`. Urutan output: sorotan laris → produk paling untung → platform.

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/highlights.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buatSorotan } from '../../src/core/highlights.js';
import { type BarisPlatform, type BarisProduk, OPSI_DEFAULT } from '../../src/core/types.js';

const prod = (sku: string, qty: number, laba: number, margin: number, hpp_tersedia = true): BarisProduk => ({
  sku, nama: `Produk ${sku}`, qty, omzet_kotor: 0, retur: 0, penjualan_bersih: 0, potongan_marketplace: 0,
  hpp: 0, iklan: 0, packaging: 0, laba_kontribusi: laba, margin_persen: margin, hpp_tersedia,
});
const plat = (platform: string, laba: number, margin: number, pb = 100): BarisPlatform => ({
  platform, jumlah_pesanan: 1, qty: 1, omzet_kotor: pb, retur: 0, penjualan_bersih: pb, potongan_marketplace: 0,
  hpp: 0, iklan: 0, packaging: 0, laba_kontribusi: laba, margin_persen: margin,
});

const SEPULUH = [
  prod('P01', 500, -1240500, -8.3),
  prod('P02', 412, 5000, 4),
  prod('P03', 300, 900000, 25),
  prod('P04', 299, -10, -0.1),
  prod('P05', 10, 6000, 30), prod('P06', 9, 7000, 30), prod('P07', 8, 8000, 30),
  prod('P08', 7, 9000, 30), prod('P09', 6, 10000, 30), prod('P10', 5, 11000, 30),
];

describe('buatSorotan — produk laris', () => {
  it('top max(3, 20%) menurut qty: rugi dan margin tipis', () => {
    const s = buatSorotan(SEPULUH, [], OPSI_DEFAULT).filter((x) => x.jenis.startsWith('LARIS'));
    expect(s).toEqual([
      { jenis: 'LARIS_TAPI_RUGI', teks: 'Produk P01 terjual 500 pcs (terlaris #1) tetapi rugi Rp1.240.500 (margin −8,3%).', sku: 'P01', platform: null },
      { jenis: 'LARIS_MARGIN_TIPIS', teks: 'Produk P02 terjual 412 pcs (terlaris #2) tetapi marginnya tipis: 4,0% (laba Rp5.000).', sku: 'P02', platform: null },
    ]);
  });

  it('produk tanpa HPP tidak disorot, peringkat lain tetap', () => {
    const data = SEPULUH.map((p) => (p.sku === 'P01' ? { ...p, hpp_tersedia: false } : p));
    const s = buatSorotan(data, [], OPSI_DEFAULT).filter((x) => x.jenis.startsWith('LARIS'));
    expect(s.map((x) => x.sku)).toEqual(['P02']);
    expect(s[0].teks).toContain('terlaris #2');
  });

  it('20% dari 20 produk = 4 produk teratas', () => {
    const data = Array.from({ length: 20 }, (_, i) => {
      const sku = `Q${String(i + 1).padStart(2, '0')}`;
      return sku === 'Q04' || sku === 'Q05' ? prod(sku, 100 - i, -1, -1) : prod(sku, 100 - i, 1000, 30);
    });
    expect(buatSorotan(data, [], OPSI_DEFAULT).filter((x) => x.jenis === 'LARIS_TAPI_RUGI').map((x) => x.sku)).toEqual(['Q04']);
  });

  it('ambang margin tipis bisa diatur', () => {
    const s = buatSorotan(SEPULUH, [], { ...OPSI_DEFAULT, ambang_margin_tipis_persen: 30 });
    expect(s.filter((x) => x.jenis === 'LARIS_MARGIN_TIPIS').map((x) => x.sku)).toEqual(['P02', 'P03']);
  });

  it('qty ditulis dengan titik ribuan', () => {
    const s = buatSorotan([prod('A', 1412, -1, -1), prod('B', 1, 1, 50), prod('C', 1, 1, 50)], [], OPSI_DEFAULT);
    expect(s[0].teks).toContain('terjual 1.412 pcs');
  });
});

describe('buatSorotan — paling untung', () => {
  it('3 produk dengan laba tertinggi (> 0)', () => {
    const s = buatSorotan(SEPULUH, [], OPSI_DEFAULT).filter((x) => x.jenis === 'PRODUK_PALING_UNTUNG');
    expect(s.map((x) => x.sku)).toEqual(['P03', 'P10', 'P09']);
    expect(s[0].teks).toBe('Produk P03 produk paling untung #1: laba Rp900.000 (margin 25,0%).');
  });

  it('platform paling untung dan margin terbaik (bila berbeda)', () => {
    const s = buatSorotan([], [plat('Shopee', 18000, 12.9), plat('TikTok Shop', 14000, 28)], OPSI_DEFAULT);
    expect(s).toEqual([
      { jenis: 'PLATFORM_PALING_UNTUNG', teks: 'Shopee paling untung: laba kontribusi Rp18.000 (margin 12,9%).', sku: null, platform: 'Shopee' },
      { jenis: 'PLATFORM_MARGIN_TERBAIK', teks: 'TikTok Shop punya margin terbaik: 28,0%.', sku: null, platform: 'TikTok Shop' },
    ]);
  });

  it('margin terbaik tidak ditulis bila sama dengan paling untung', () => {
    const s = buatSorotan([], [plat('Shopee', 18000, 30), plat('TikTok Shop', 14000, 28)], OPSI_DEFAULT);
    expect(s.map((x) => x.jenis)).toEqual(['PLATFORM_PALING_UNTUNG']);
  });

  it('tanpa platform untung → tanpa sorotan platform', () => {
    expect(buatSorotan([], [plat('A', -5, -1), plat('B', -3, -2)], OPSI_DEFAULT)).toEqual([]);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/highlights.test.ts`
Expected: FAIL karena modul `highlights.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/highlights.ts`:
```ts
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
```

- [ ] **Step 4: Jalankan tes**

Run: `npx vitest run test/core/highlights.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/highlights.ts api/test/core/highlights.test.ts
git commit -m "feat(core): automatic highlights (bestsellers losing money, top earners)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: `analyze()` — orkestrasi & uji ujung-ke-ujung

**Files:**
- Create: `api/src/core/analyze.ts`
- Test: `api/test/core/analyze.test.ts`

**Interfaces:**
- Consumes: semua modul Task 1–13
- Produces: `analyze(input: AnalyzeInput): Laporan`. Melempar `KesalahanInput` dari `ekstrakBaris`. Fungsi ini titik masuk tunggal untuk Rencana 2.

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/analyze.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/core/analyze.js';
import type { AnalyzeInput, BiayaInput } from '../../src/core/types.js';
import { baris, biaya, mappingStd, tab, tangkap } from './helpers.js';

const HPP = [{ sku: 'S1', nama: 'Kopi A', hpp: 30000 }, { sku: 'S2', nama: 'Kopi B', hpp: 25000 }];

describe('analyze — contoh lengkap (angka dihitung tangan)', () => {
  const input: AnalyzeInput = {
    pesanan: [
      tab('Shopee', [
        baris('A1', 'S1', 2, 50000, { Tanggal: '2026-07-01 08:00', Admin: 8000, Layanan: 2000, Diterima: 90000 }),
        baris('A2', 'S2', 1, 40000, { Tanggal: '15/07/2026 12:00', Admin: 3200, Layanan: 800, Diterima: 30000 }),
        baris('A3', 'S1', 1, 50000, { Tanggal: '2026-07-20 10:00', Status: 'Batal', Diterima: 0 }),
        baris('A4', 'S2', 1, 40000, { Tanggal: '2026-07-21 10:00', Status: 'Retur', Diterima: 0 }),
      ]),
      tab('TikTok Shop', [
        baris('B1', 'S1', 1, 50000, { Tanggal: '2026-07-31T23:30:00+07:00', Admin: 5000, Diterima: 45000 }),
      ]),
    ],
    hpp: HPP,
    biaya: [
      biaya('2026-07', 'iklan', 14000, 'Shopee'),
      biaya('2026-07', 'packaging', 1000),
      biaya('2026-07', 'tetap', 50000),
      biaya('2026-08', 'tetap', 999999),
    ],
  };
  const lap = analyze(input);

  it('ringkasan', () => {
    expect(lap.ringkasan).toEqual({
      omzet_kotor: 230000, retur: 40000, penjualan_bersih: 190000,
      diskon_voucher_penjual: 0, biaya_marketplace: 25000, total_potongan_marketplace: 25000, dana_diterima: 165000,
      hpp: 115000, iklan: 14000, packaging: 4000, laba_kontribusi: 32000,
      biaya_tetap: 50000, laba_bersih: -18000, margin_persen: -9.5,
      jumlah_pesanan: 4, jumlah_pesanan_batal: 1, jumlah_pesanan_retur: 1, jumlah_pesanan_belum_cair: 0,
      iklan_tidak_teralokasi: 0, tanggal_pertama: '2026-07-01', tanggal_terakhir: '2026-07-31', periode: ['2026-07'],
    });
    expect(lap.rincian_biaya_marketplace).toEqual({ biaya_admin: 16200, biaya_layanan: 2800, ongkir_ditanggung_penjual: 0, potongan_lainnya: 6000 });
  });

  it('per produk, platform, bulan', () => {
    expect(lap.per_produk).toEqual([
      { sku: 'S2', nama: 'Kopi B', qty: 1, omzet_kotor: 80000, retur: 40000, penjualan_bersih: 40000, potongan_marketplace: 10000, hpp: 25000, iklan: 6222, packaging: 2000, laba_kontribusi: -3222, margin_persen: -8.1, hpp_tersedia: true },
      { sku: 'S1', nama: 'Kopi A', qty: 3, omzet_kotor: 150000, retur: 0, penjualan_bersih: 150000, potongan_marketplace: 15000, hpp: 90000, iklan: 7778, packaging: 2000, laba_kontribusi: 35222, margin_persen: 23.5, hpp_tersedia: true },
    ]);
    expect(lap.per_platform).toEqual([
      { platform: 'Shopee', jumlah_pesanan: 3, qty: 3, omzet_kotor: 180000, retur: 40000, penjualan_bersih: 140000, potongan_marketplace: 20000, hpp: 85000, iklan: 14000, packaging: 3000, laba_kontribusi: 18000, margin_persen: 12.9 },
      { platform: 'TikTok Shop', jumlah_pesanan: 1, qty: 1, omzet_kotor: 50000, retur: 0, penjualan_bersih: 50000, potongan_marketplace: 5000, hpp: 30000, iklan: 0, packaging: 1000, laba_kontribusi: 14000, margin_persen: 28 },
    ]);
    expect(lap.per_bulan).toEqual([
      { bulan: '2026-07', jumlah_pesanan: 4, omzet_kotor: 230000, retur: 40000, penjualan_bersih: 190000, potongan_marketplace: 25000, hpp: 115000, iklan: 14000, packaging: 4000, laba_kontribusi: 32000, iklan_tidak_teralokasi: 0, biaya_tetap: 50000, laba_bersih: -18000, margin_persen: -9.5 },
    ]);
  });

  it('sorotan', () => {
    expect(lap.sorotan).toEqual([
      { jenis: 'LARIS_TAPI_RUGI', teks: 'Kopi B terjual 1 pcs (terlaris #2) tetapi rugi Rp3.222 (margin −8,1%).', sku: 'S2', platform: null },
      { jenis: 'PRODUK_PALING_UNTUNG', teks: 'Kopi A produk paling untung #1: laba Rp35.222 (margin 23,5%).', sku: 'S1', platform: null },
      { jenis: 'PLATFORM_PALING_UNTUNG', teks: 'Shopee paling untung: laba kontribusi Rp18.000 (margin 12,9%).', sku: null, platform: 'Shopee' },
      { jenis: 'PLATFORM_MARGIN_TERBAIK', teks: 'TikTok Shop punya margin terbaik: 28,0%.', sku: null, platform: 'TikTok Shop' },
    ]);
  });

  it('masalah & info', () => {
    expect(lap.masalah).toEqual([]);
    expect(lap.jumlah_masalah).toEqual({});
    expect(lap.info).toEqual([{
      jenis: 'BIAYA_DI_LUAR_PERIODE', platform: null, jumlah: 1,
      pesan: 'Biaya untuk 1 bulan di luar periode data diabaikan (Agustus 2026), total Rp999.999.',
      detail: [{ bulan: '2026-08', total_diabaikan: 999999, tarif_packaging_diabaikan: 0 }],
    }]);
  });
});

describe('analyze — periode biaya', () => {
  it('tab Biaya 12 bulan, pesanan hanya 1 bulan', () => {
    const biayaSetahun: BiayaInput[] = [];
    for (let m = 1; m <= 12; m++) {
      const b = `2026-${String(m).padStart(2, '0')}`;
      biayaSetahun.push(biaya(b, 'iklan', 100000, 'Shopee'), biaya(b, 'packaging', 1000), biaya(b, 'tetap', 500000));
    }
    const lap = analyze({
      pesanan: [tab('Shopee', [baris('A1', 'S1', 1, 200000, { Tanggal: '2026-03-15 10:00' })], mappingStd({ total_diterima: undefined }))],
      hpp: HPP,
      biaya: biayaSetahun,
    });
    expect(lap.ringkasan).toMatchObject({
      periode: ['2026-03'], iklan: 100000, packaging: 1000, biaya_tetap: 500000, iklan_tidak_teralokasi: 0,
      laba_kontribusi: 69000, laba_bersih: -431000,
    });
    expect(lap.jumlah_masalah.IKLAN_TIDAK_TERALOKASI).toBeUndefined();
    const info = lap.info.find((i) => i.jenis === 'BIAYA_DI_LUAR_PERIODE')!;
    expect(info.jumlah).toBe(11);
    expect(info.detail).toHaveLength(11);
    expect(info.detail!.every((d) => d.total_diabaikan === 600000 && d.tarif_packaging_diabaikan === 1000)).toBe(true);
    expect(info.pesan).toContain('total Rp6.600.000');
  });

  it('bulan yang semua pesanannya batal tidak masuk periode', () => {
    const lap = analyze({
      pesanan: [tab('Shopee', [
        baris('A1', 'S1', 1, 1000, { Tanggal: '2026-03-15 10:00' }),
        baris('A2', 'S1', 1, 1000, { Tanggal: '2026-04-10 10:00', Status: 'Batal' }),
      ])],
      hpp: HPP,
      biaya: [biaya('2026-04', 'tetap', 70000)],
    });
    expect(lap.ringkasan.periode).toEqual(['2026-03']);
    expect(lap.ringkasan.biaya_tetap).toBe(0);
    expect(lap.info.find((i) => i.jenis === 'BIAYA_DI_LUAR_PERIODE')!.detail).toEqual([
      { bulan: '2026-04', total_diabaikan: 70000, tarif_packaging_diabaikan: 0 },
    ]);
  });

  it('iklan platform tanpa penjualan di bulan dalam periode → tidak teralokasi, tetap mengurangi laba bersih', () => {
    const lap = analyze({
      pesanan: [
        tab('Shopee', [baris('A1', 'S1', 1, 100000, { Tanggal: '2026-07-10 10:00' })], mappingStd({ total_diterima: undefined })),
        tab('TikTok Shop', [baris('B1', 'S1', 1, 100000, { Tanggal: '2026-06-10 10:00' })], mappingStd({ total_diterima: undefined })),
      ],
      hpp: HPP,
      biaya: [biaya('2026-07', 'iklan', 5000, 'TikTok Shop')],
    });
    expect(lap.ringkasan.iklan).toBe(0);
    expect(lap.ringkasan.iklan_tidak_teralokasi).toBe(5000);
    expect(lap.ringkasan.laba_bersih).toBe(lap.ringkasan.laba_kontribusi - 5000);
    expect(lap.per_bulan.find((b) => b.bulan === '2026-07')!.iklan_tidak_teralokasi).toBe(5000);
    expect(lap.jumlah_masalah.IKLAN_TIDAK_TERALOKASI).toBe(1);
  });
});

describe('analyze — info', () => {
  it('31 Juli 17:30 UTC dihitung 1 Agustus; Agustus penuh tanpa info', () => {
    const lap = analyze({
      pesanan: [tab('Shopee', [
        baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-31T17:30:00Z' }),
        baris('A2', 'S1', 1, 1000, { Tanggal: '2026-08-31 10:00' }),
      ], mappingStd({ total_diterima: undefined }))],
      hpp: HPP,
      biaya: [],
    });
    expect(lap.ringkasan.periode).toEqual(['2026-08']);
    expect(lap.ringkasan.tanggal_pertama).toBe('2026-08-01');
    expect(lap.info.filter((i) => i.jenis === 'BULAN_TIDAK_PENUH')).toEqual([]);
  });

  it('pesanan belum cair → info & hitungan ringkasan, bukan masalah', () => {
    const lap = analyze({
      pesanan: [tab('Shopee', [
        baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-01 10:00' }),
        baris('A2', 'S1', 1, 1000, { Tanggal: '2026-07-31 10:00', Diterima: 0 }),
      ])],
      hpp: HPP,
      biaya: [],
    });
    expect(lap.ringkasan.jumlah_pesanan_belum_cair).toBe(2);
    expect(lap.info).toEqual([{
      jenis: 'PESANAN_BELUM_CAIR', platform: 'Shopee', jumlah: 2,
      pesan: '2 pesanan Shopee belum cair; laba dihitung dari potongan yang terpetakan.',
    }]);
    expect(lap.masalah).toEqual([]);
  });

  it('status tidak dipetakan → info STATUS_TIDAK_DIPETAKAN', () => {
    const lap = analyze({
      pesanan: [tab('Shopee', [baris('A1', 'S1', 1, 1000, { Tanggal: '2026-07-01 10:00' }), baris('A2', 'S1', 1, 1000, { Tanggal: '2026-07-31 10:00' })], mappingStd({ status: undefined, total_diterima: undefined }))],
      hpp: HPP,
      biaya: [],
    });
    expect(lap.info).toEqual([{
      jenis: 'STATUS_TIDAK_DIPETAKAN', platform: 'Shopee', jumlah: 2,
      pesan: 'Kolom status di Pesanan - Shopee tidak dipetakan; semua baris dianggap selesai.',
    }]);
  });
});

describe('analyze — batas & kesalahan', () => {
  it('masalah dibatasi 1.000, jumlah lengkap', () => {
    const rows = Array.from({ length: 1200 }, (_, i) => baris(`X${i}`, '', 1, 1000));
    const lap = analyze({ pesanan: [tab('Shopee', rows)], hpp: [], biaya: [] });
    expect(lap.masalah).toHaveLength(1000);
    expect(lap.jumlah_masalah).toEqual({ KOLOM_WAJIB_KOSONG: 1200 });
  });

  it('KesalahanInput diteruskan', () => {
    const e = tangkap(() => analyze({ pesanan: [tab('Shopee', [], mappingStd({ sku: undefined }))], hpp: [], biaya: [] }));
    expect(e.code).toBe('PEMETAAN_TIDAK_LENGKAP');
  });

  it('opsi parsial digabung dengan default', () => {
    const rows = [baris('A1', 'S1', 1, 50000, { Status: 'Retur', Tanggal: '2026-07-01 10:00' })];
    expect(analyze({ pesanan: [tab('Shopee', rows)], hpp: HPP, biaya: [] }).ringkasan.hpp).toBe(0);
    expect(analyze({ pesanan: [tab('Shopee', rows)], hpp: HPP, biaya: [], opsi: { retur_barang_rusak: true } }).ringkasan.hpp).toBe(30000);
  });
});

describe('analyze — konsistensi (data acak)', () => {
  const jumlah = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  it.each([1, 2, 3, 4, 5])('seed %d: Σ produk = Σ platform = ringkasan; Σ bulan = ringkasan (kecuali margin)', (seed) => {
    let s = seed;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const platforms = ['Shopee', 'TikTok Shop', 'Tokopedia'];
    const pesanan = platforms.map((pf) => tab(pf, Array.from({ length: 60 }, (_, i) => {
      const bln = 7 + Math.floor(r() * 3);
      const hari = 1 + Math.floor(r() * 28);
      const u = r();
      return baris(`${pf}-${Math.floor(i / 2)}`, `S${1 + Math.floor(r() * 5)}`, 1 + Math.floor(r() * 3), 10000 + Math.floor(r() * 90) * 1000, {
        Tanggal: `2026-${String(bln).padStart(2, '0')}-${String(hari).padStart(2, '0')} 10:00`,
        Status: u < 0.1 ? 'Batal' : u < 0.2 ? 'Retur' : 'Selesai',
        Diskon: Math.floor(r() * 3) * 1000,
        Admin: Math.floor(r() * 10) * 500,
        Ongkir: r() < 0.3 ? 5000 : null,
        Diterima: r() < 0.2 ? null : 50000 + Math.floor(r() * 50) * 1000,
      });
    })));
    const biayaAcak: BiayaInput[] = [];
    for (const b of ['2026-07', '2026-08', '2026-09']) {
      for (const pf of platforms) biayaAcak.push(biaya(b, 'iklan', Math.floor(r() * 500000), pf));
      biayaAcak.push(biaya(b, 'packaging', 1500), biaya(b, 'tetap', 1000000));
    }
    biayaAcak.push(biaya('2026-10', 'iklan', 777777, 'Shopee'));
    const lap = analyze({
      pesanan,
      hpp: [1, 2, 3, 4].map((i) => ({ sku: `S${i}`, hpp: 5000 * i })),
      biaya: biayaAcak,
      opsi: { retur_barang_rusak: seed % 2 === 0 },
    });
    const R = lap.ringkasan;

    expect(jumlah(lap.per_produk.map((p) => p.laba_kontribusi))).toBe(R.laba_kontribusi);
    expect(jumlah(lap.per_platform.map((p) => p.laba_kontribusi))).toBe(R.laba_kontribusi);
    expect(jumlah(lap.per_produk.map((p) => p.omzet_kotor))).toBe(R.omzet_kotor);
    expect(jumlah(lap.per_platform.map((p) => p.jumlah_pesanan))).toBe(R.jumlah_pesanan);
    for (const k of ['omzet_kotor', 'retur', 'penjualan_bersih', 'hpp', 'iklan', 'packaging', 'laba_kontribusi',
      'iklan_tidak_teralokasi', 'biaya_tetap', 'laba_bersih', 'jumlah_pesanan'] as const) {
      expect(jumlah(lap.per_bulan.map((b) => b[k]))).toBe(R[k]);
    }
    expect(jumlah(lap.per_bulan.map((b) => b.potongan_marketplace))).toBe(R.total_potongan_marketplace);
    expect(R.dana_diterima).toBe(R.penjualan_bersih - R.total_potongan_marketplace);
    expect(R.total_potongan_marketplace).toBe(R.diskon_voucher_penjual + R.biaya_marketplace);
    expect(R.laba_bersih).toBe(R.laba_kontribusi - R.iklan_tidak_teralokasi - R.biaya_tetap);
    expect(R.biaya_marketplace).toBe(jumlah(Object.values(lap.rincian_biaya_marketplace)));
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/analyze.test.ts`
Expected: FAIL karena modul `analyze.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/analyze.ts`:
```ts
import { agregasi } from './aggregate.js';
import { buatTarifPackaging, saringPeriode, validasiBiaya } from './biaya.js';
import { Catatan } from './catatan.js';
import { buangDuplikat } from './dedupe.js';
import { ekstrakBaris } from './extract.js';
import { buatSorotan } from './highlights.js';
import { bangunHpp, hitungItem } from './hitung.js';
import { alokasiIklan } from './iklan.js';
import { cekBulanTidakPenuh, hitungPeriode, infoBelumCair } from './info.js';
import { bentukPesanan } from './orders.js';
import { type AnalyzeInput, type BarisItem, type Laporan, OPSI_DEFAULT } from './types.js';

/** Titik masuk tunggal mesin perhitungan. Tidak menyimpan apa pun. */
export function analyze(input: AnalyzeInput): Laporan {
  const opsi = { ...OPSI_DEFAULT, ...input.opsi };
  const catatan = new Catatan();

  const semua: BarisItem[] = [];
  for (const p of input.pesanan) {
    const { baris, statusDipetakan } = ekstrakBaris(p, catatan);
    if (!statusDipetakan) {
      catatan.tambahInfo({
        jenis: 'STATUS_TIDAK_DIPETAKAN', platform: p.platform, jumlah: baris.length,
        pesan: `Kolom status di ${p.sheet} tidak dipetakan; semua baris dianggap selesai.`,
      });
    }
    semua.push(...baris);
  }

  const pesanan = bentukPesanan(buangDuplikat(semua, catatan), catatan);
  const periode = hitungPeriode(pesanan);
  const biaya = saringPeriode(validasiBiaya(input.biaya, catatan), new Set(periode), catatan);
  const { items, pesanan: ringkas } = hitungItem(
    pesanan,
    { hpp: bangunHpp(input.hpp), tarifPackaging: buatTarifPackaging(biaya), opsi },
    catatan,
  );
  const iklan = alokasiIklan(items, biaya, catatan);
  cekBulanTidakPenuh(ringkas, catatan);
  infoBelumCair(ringkas, catatan);

  const agregat = agregasi({
    items,
    pesanan: ringkas,
    jumlahBatal: pesanan.filter((p) => p.batal).length,
    iklanProduk: iklan.produk,
    iklanSisa: iklan.sisa,
    biaya,
    periode,
  });
  return {
    ...agregat,
    sorotan: buatSorotan(agregat.per_produk, agregat.per_platform, opsi),
    masalah: catatan.masalah,
    jumlah_masalah: catatan.jumlah,
    info: catatan.info,
  };
}
```

- [ ] **Step 4: Jalankan seluruh tes + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS, tsc tanpa error.

- [ ] **Step 5: Commit**

```bash
git add api/src/core/analyze.ts api/test/core/analyze.test.ts
git commit -m "feat(core): analyze() orchestration with end-to-end and consistency tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Generator data demo

**Files:**
- Create: `api/src/core/demo.ts`
- Test: `api/test/core/demo.test.ts`

**Interfaces:**
- Consumes: `analyze` (Task 14), `hariDalamBulan`, `bulanJakarta`, `OFFSET_WIB_MS` (Task 3)
- Produces (dipakai Rencana 2 dan 3):
  - `buatDemo(opsi?: { seed?: number; bulan_akhir?: string; sekarang?: Date }): DemoData`
  - `demoKeAnalyzeInput(d: DemoData): AnalyzeInput`
  - `bulanPenuhTerakhir(sekarang: Date): string`, `geserBulan(bulan, n): string`, `mulberry32(seed)`
  - `interface DemoTab { header: string[]; rows: Sel[][]; mapping?: Pemetaan }`, `interface DemoData { brand: string; tabs: Record<string, DemoTab> }`
  - `BRAND_DEMO = 'Senja Roastery'`, `SKU_DEMO_TANPA_HPP = 'SR-TMB-01'`

- [ ] **Step 1: Tulis tes yang gagal**

`api/test/core/demo.test.ts`:
```ts
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
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run test/core/demo.test.ts`
Expected: FAIL karena modul `demo.js` belum ada.

- [ ] **Step 3: Implementasi**

`api/src/core/demo.ts`:
```ts
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
```

- [ ] **Step 4: Jalankan tes demo**

Run: `npx vitest run test/core/demo.test.ts`
Expected: PASS.

Jika `jumlah_masalah` memuat jenis tambahan, jangan ubah tesnya. Cari sumbernya dulu, karena data demo harus bersih di luar tiga masalah yang disengaja:
- `SELISIH_REKONSILIASI` → periksa rumus `diterima` di `buatPesanan`.
- `NILAI_PESANAN_TIDAK_KONSISTEN` → periksa kolom level pesanan.

- [ ] **Step 5: Seluruh tes + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: semua PASS.

- [ ] **Step 6: Commit**

```bash
git add api/src/core/demo.ts api/test/core/demo.test.ts
git commit -m "feat(core): deterministic demo data generator (3 platforms, 3 months, 15 products)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: README — dokumentasi rumus untuk klien

**Files:**
- Create: `README.md` (root repo)

**Interfaces:**
- Consumes: perilaku Task 1–15 (rumus harus cocok dengan kode dan tes)
- Produces: bagian README "Cara HAI Laba Menghitung". Rencana 2–4 nanti menambahkan bagian deploy, API, dan add-on.

- [ ] **Step 1: Tulis README**

`README.md`:
````markdown
# HAI Laba

Menghitung **laba bersih** penjual online dari file export marketplace (Shopee, TikTok Shop,
Tokopedia, dan lainnya), langsung dari Google Sheets.

- `api/` — mesin perhitungan (TypeScript). Rumus hanya ada di `api/src/core/`.
- `addon/` — add-on Google Sheets (menyusul).

## Menjalankan tes

```bash
cd api
npm install
npx vitest run
```

## Cara HAI Laba Menghitung

Bagian ini bisa dibacakan ke klien. Semua angka dalam Rupiah bulat. Bulan mengikuti
waktu Indonesia Barat (WIB): pesanan pukul 00:30 WIB tanggal 1 Agustus masuk bulan Agustus.

### Rantai laba

```
Omzet kotor               semua penjualan (termasuk yang kemudian diretur)
− Retur                   nilai barang yang dikembalikan pembeli
= Penjualan bersih
− Diskon & voucher penjual
− Biaya marketplace       admin + layanan + ongkir yang ditanggung penjual + potongan lainnya
= Dana diterima           (seharusnya sama dengan uang yang cair dari marketplace)
− HPP                     harga pokok barang yang terjual
− Iklan
− Packaging
= Laba kontribusi         ← laba per produk dan per platform
− Iklan yang tidak bisa dibagi ke produk
− Biaya tetap             gaji, sewa, dll.
= Laba bersih             ← laba toko per bulan dan total
```

**Margin** = laba ÷ penjualan bersih × 100%, satu angka di belakang koma.

### Aturan penting

1. **Pesanan batal** tidak dihitung sama sekali.
2. **Retur:** nilai barang tetap masuk omzet kotor lalu dikurangkan lagi sebagai retur.
   - Diskon dan voucher tidak dihitung, karena ikut dikembalikan.
   - Biaya marketplace dihitung sesuai angka di export.
   - HPP = 0 karena barang kembali ke stok. Kalau barang retur rusak, HPP bisa diatur tetap dihitung.
3. **Duplikat:** baris dengan nomor pesanan + SKU yang sama di platform yang sama hanya
   dihitung sekali. Baris pertama yang dipakai.
4. **Biaya per pesanan** (mis. biaya admin yang tertulis sekali untuk satu pesanan berisi
   beberapa produk) dibagi ke produk sesuai nilai masing-masing.
   - Contoh: pesanan Rp100.000 berisi produk A Rp60.000 dan B Rp40.000, biaya admin Rp10.000
     → A menanggung Rp6.000 dan B Rp4.000.
   - Pembulatan selalu dijaga agar totalnya tetap persis Rp10.000.
5. **Potongan lainnya:** jika kolom "dana diterima" dipetakan, HAI Laba menghitung
   `nilai pesanan − potongan yang terpetakan − dana diterima`. Selisih ini adalah biaya yang
   tidak punya kolom sendiri (mis. komisi afiliasi). Dengan begitu laba cocok dengan uang yang
   benar-benar cair.
   - Jika dana diterima masih kosong atau 0, pesanan dianggap **belum cair**. Laba dihitung
     dari potongan yang terpetakan saja, dan jumlah pesanan belum cair ditampilkan di Ringkasan.
6. **Iklan** per platform per bulan dibagi ke produk sesuai omzet produk di platform dan bulan
   itu.
   - Contoh: iklan Shopee Juli Rp14.000, omzet Shopee Juli produk A Rp100.000 dan B Rp80.000
     → A Rp7.778, B Rp6.222.
7. **Packaging** = tarif per pesanan × jumlah pesanan (termasuk retur). Tarif khusus satu
   platform menggantikan tarif umum.
8. **Biaya tetap** hanya mengurangi laba toko (Ringkasan & Bulanan), tidak dibagi ke produk.
9. **Periode laporan** = bulan-bulan yang ada pesanannya. Biaya untuk bulan lain diabaikan dan
   dilaporkan sebagai info.
   - Jika data suatu bulan tidak lengkap (mis. hanya 5–31 Juli), biaya tetap bulan itu tetap
     dihitung penuh, dan HAI Laba memberi tahu.
10. **SKU tanpa HPP** dihitung dengan HPP 0 dan ditandai di "Masalah Data". Lengkapi tab HPP
    agar laba akurat.

### Sorotan otomatis

- **Laris tapi rugi / margin tipis:** produk di 20% teratas menurut jumlah terjual (minimal 3
  produk) yang labanya negatif atau marginnya di bawah 10%.
- **Produk paling untung:** 3 produk dengan laba kontribusi terbesar.
- **Platform paling untung**, dan platform dengan margin terbaik bila berbeda.

### Privasi

Data pesanan diproses lalu langsung dibuang. Yang disimpan hanya akun klien, API key (dalam
bentuk hash), template pemetaan kolom (nama header saja), dan log pemakaian (waktu dan jumlah
baris).
````

- [ ] **Step 2: Cocokkan contoh angka README dengan tes**

Contoh di README harus sama dengan tes:
- Aturan 4 (6.000/4.000) cocok dengan `hitung.test.ts` "dibagi menurut nilai item".
- Aturan 6 (7.778/6.222) cocok dengan `iklan.test.ts` "proporsional".

Run: `npx vitest run` (dari `api/`)
Expected: semua PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README with client-facing formula documentation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-Review (sudah dijalankan penulis rencana)

**1. Cakupan spec.** Setiap bagian spec dan task yang mencakupnya:

| Spec | Task |
|---|---|
| §5.1 Pemetaan | Task 1 (tipe) dan Task 6 |
| §5.2 bentuk laporan | Task 1 dan Task 12–14 |
| §5.3 isi demo | Task 15 |
| §6.1 parsing | Task 2–3 |
| §6.2 status | Task 5–6 |
| §6.3 level pesanan | Task 7 dan Task 9 |
| §6.4–6.6 item, potongan lainnya, belum cair, retur | Task 9 |
| §6.7 duplikat | Task 7 |
| §6.8 biaya, periode, bulan tidak penuh | Task 8, Task 10, Task 11 |
| §6.9 rantai laba dan konsistensi | Task 12 dan Task 14 |
| §6.10 SKU tanpa HPP | Task 9 |
| §6.11 sorotan | Task 13 |
| §6.12 jenis masalah | Task 1 dan Task 6–11 |
| §8 daftar uji minimal | Task 2–15 |
| README rumus | Task 16 |

Di luar cakupan rencana ini, sesuai Peta rencana:
- §2–5 bagian API → Rencana 2
- §7 add-on → Rencana 3
- §5.4–5.5 template dan suggest → Rencana 4

**2. Placeholder.** Tidak ada TBD atau TODO. Setiap langkah kode berisi kode lengkap.

**3. Konsistensi tipe.**
- `KonteksHitung`, `MasukanAgregasi`, `IklanProduk`, `IklanSisa`, dan `RingkasPesanan` dipakai dengan nama field yang sama di semua task.
- `bangunHpp` memakai kunci `kunci(sku)`.
- `Catatan.tambah` menerima `MasalahBaru`.

**4. Review Focus.** Kelima butir punya tes di task pemiliknya: Task 6 (tiga tes), Task 9, dan Task 10.
