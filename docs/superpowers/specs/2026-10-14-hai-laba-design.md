# HAI Laba — Spesifikasi Desain v1

Tanggal: 2026-10-14
Status: disetujui (spec + koreksi A–E, 2026-10-14)

## 1. Tujuan

Penjual online menghitung laba bersih dari file export marketplace (Shopee, TikTok
Shop, Tokopedia, dan platform lain) tanpa pindah aplikasi. Mereka menempel export
apa adanya di Google Sheets, mengklik menu "HAI", dan mendapat laporan laba.

Sistem terdiri dari:

1. **API** — mesin perhitungan. Satu-satunya tempat rumus laba berada.
2. **Add-on Google Sheets (Apps Script)** — antarmuka. Hanya membaca sel, mengirim
   data, dan menulis hasil. Tidak berisi rumus perhitungan.

Bahasa antarmuka dan pesan: Bahasa Indonesia. Mata uang: Rupiah (bilangan bulat).

### Kriteria keberhasilan v1

- Demo bisa ditunjukkan ke calon klien secepatnya: "Isi Data Demo" mengisi semua tab
  dan "Hitung Laba" menghasilkan 5 tab laporan lengkap dengan format, warna, dan grafik.
- Data export asli bisa dipetakan lewat sidebar dan dihitung dengan rumus yang sama.
- Semua rumus perhitungan dan alokasi biaya tercakup unit test.
- Rumus terdokumentasi di README dalam bahasa yang bisa dijelaskan ke klien.

### Di luar cakupan v1

Chrome extension, Excel add-in, integrasi API marketplace, pembayaran, pengiriman
data bertahap (chunking — lihat §9), biaya iklan per SKU (lihat §9).

## 2. Arsitektur

```
hai-laba/
├─ api/
│  ├─ src/core/          SEMUA RUMUS. Fungsi murni tanpa I/O, diuji penuh.
│  │   parse.ts          angka & tanggal
│  │   status.ts         klasifikasi status → selesai | batal | retur | tidak_dikenal
│  │   normalize.ts      baris mentah + pemetaan → item standar + masalah
│  │   allocate.ts       alokasi proporsional dengan pembulatan sisa terbesar
│  │   aggregate.ts      rekap produk / platform / bulan / ringkasan
│  │   highlights.ts     sorotan otomatis
│  │   analyze.ts        orkestrasi: normalize → alokasi → agregasi → sorotan
│  │   mapping.ts        tebakan pemetaan header (fase 5)
│  │   demo.ts           generator data dummy deterministik
│  ├─ src/routes/        analyze, demo, mapping, templates
│  ├─ src/middleware/    auth API key, log pemakaian, batas ukuran body
│  ├─ prisma/schema.prisma
│  ├─ scripts/create-client.ts
│  ├─ Dockerfile
│  └─ docker-compose.yml   (Postgres lokal)
├─ addon/                 Apps Script, dikelola dengan clasp
│  ├─ Menu.gs  Settings.gs  Api.gs  Analyze.gs  Reports.gs  Demo.gs  Mapping.gs
│  └─ MappingSidebar.html
└─ README.md              termasuk dokumentasi rumus
```

Stack API: TypeScript, Node 22, Hono (`@hono/node-server`), zod, Prisma +
PostgreSQL, Vitest, pino (body request tidak pernah dicatat).

### Alur data

1. Add-on membaca tab "Pesanan - [Platform]", "HPP", "Biaya".
2. Add-on hanya mengambil kolom yang dipakai pemetaan (nilai mentah, tanpa diolah).
3. Satu request `POST /v1/analyze`.
4. API menghitung di memori, mengembalikan laporan JSON, lalu membuang datanya.
5. Add-on menulis 5 tab laporan.

## 3. Privasi

API **tidak menyimpan** data pesanan, HPP, maupun biaya. Data diproses di memori
lalu dibuang. Yang disimpan hanya:

- klien,
- API key (hanya hash SHA-256),
- template pemetaan (nama header & pilihan pemetaan, tanpa isi baris),
- log pemakaian: waktu, endpoint, jumlah baris, kode status, durasi.

Logger dikonfigurasi agar tidak mencatat body request maupun response. Contoh baris
yang dikirim ke `/v1/mapping/suggest` hanya dipakai untuk menebak tipe kolom lalu
dibuang.

## 4. Skema database (Prisma)

```prisma
model Client {
  id        String   @id @default(cuid())
  name      String
  email     String?
  status    String   @default("active")   // active | suspended
  createdAt DateTime @default(now())
  apiKeys   ApiKey[]
  templates MappingTemplate[]
  usage     UsageLog[]
}

model ApiKey {
  id         String    @id @default(cuid())
  clientId   String
  prefix     String                 // mis. "hai_live_ab12", hanya untuk tampilan
  keyHash    String    @unique      // SHA-256 dari key; key asli tidak disimpan
  label      String?
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  client     Client    @relation(fields: [clientId], references: [id])
}

model MappingTemplate {
  id              String   @id @default(cuid())
  clientId        String
  platform        String   // teks bebas dari nama tab: "Shopee", "Lazada", ...
  name            String
  headerSignature String   // hash header ternormalisasi (deteksi export berubah)
  headers         Json     // daftar header asli
  headerRow       Int      @default(1)
  mapping         Json     // objek Pemetaan, lihat §5.1
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  client          Client   @relation(fields: [clientId], references: [id])
  @@index([clientId, platform])
}

model UsageLog {
  id         String   @id @default(cuid())
  clientId   String
  apiKeyId   String
  endpoint   String
  rowCount   Int
  statusCode Int
  durationMs Int
  createdAt  DateTime @default(now())
  @@index([clientId, createdAt])
}
```

Klien dan API key dibuat lewat CLI `npm run create-client -- --name "..."`. Key
dicetak sekali di terminal. Format key: `hai_live_` + 32 karakter acak base62.
Tidak ada endpoint admin di v1.

## 5. Kontrak API

Konvensi umum:

- Semua endpoint di bawah `/v1` mewajibkan header `Authorization: Bearer <api_key>`.
- Body dan response berupa JSON, nama field memakai snake_case.
- Format error: `{ "error": { "code": "KODE", "message": "Pesan bahasa Indonesia" } }`.
- Kode error: `UNAUTHORIZED` (401), `VALIDASI_GAGAL` (400), `TEMPLATE_TIDAK_DITEMUKAN`
  (404), `HEADER_BERUBAH` (409), `BODY_TERLALU_BESAR` (413), `TERLALU_BANYAK_REQUEST`
  (429), `KESALAHAN_SERVER` (500).
- Batas body: 20 MB.
- Batas laju: 60 request/menit per key (token bucket di memori).
- `GET /health` tidak memerlukan auth.

### 5.1 Objek Pemetaan

Field standar:

| Field | Wajib | Keterangan |
|---|---|---|
| no_pesanan | ya | |
| tanggal | ya | tanggal pesanan |
| status | tidak | jika tidak dipetakan, semua baris dianggap selesai + info |
| sku | ya | |
| nama_produk | tidak | fallback ke nama di tab HPP |
| qty | ya | |
| harga_jual | ya | harga satuan, atau total baris (lihat `harga_jual_basis`) |
| diskon_penjual | tidak | |
| voucher_penjual | tidak | |
| biaya_admin | tidak | |
| biaya_layanan | tidak | |
| ongkir_ditanggung_penjual | tidak | |
| total_diterima | tidak | dana cair per pesanan, acuan potongan_lainnya |

```json
{
  "fields": {
    "no_pesanan":  { "headers": ["No. Pesanan"], "level": "item" },
    "biaya_admin": { "headers": ["Biaya Admin", "Biaya Proses"], "level": "order" }
  },
  "status_map": { "Selesai": "selesai", "Dibatalkan": "batal", "Pengembalian": "retur" },
  "options": { "harga_jual_basis": "unit" }
}
```

- `headers` boleh lebih dari satu. Nilainya dijumlahkan (untuk field angka) atau
  diambil yang pertama tidak kosong (untuk field teks).
- `level` hanya relevan untuk field biaya dan `total_diterima`: `item` berarti nilai
  milik baris itu, `order` berarti nilai milik pesanan (lihat §6.3).
  `total_diterima` selalu diperlakukan sebagai level `order`.
- `harga_jual_basis`: `unit` (harga × qty) atau `baris` (sudah total baris).

### 5.2 `POST /v1/analyze`

Request:

```json
{
  "pesanan": [
    {
      "platform": "Shopee",
      "sheet": "Pesanan - Shopee",
      "row_offset": 2,
      "template_id": "ckx...",
      "mapping": { },
      "header": ["No. Pesanan", "Waktu Pesanan Dibuat", "..."],
      "rows": [["2607310001", "2026-07-31T23:30:00+07:00", "..."]]
    }
  ],
  "hpp":   [{ "sku": "KS-01", "nama": "Kopi Susu 250ml", "hpp": 12000 }],
  "biaya": [
    { "bulan": "2026-07", "jenis": "iklan",     "platform": "Shopee", "nilai": 1500000, "keterangan": "" },
    { "bulan": "2026-07", "jenis": "packaging", "platform": null,     "nilai": 1500,    "keterangan": "per pesanan" },
    { "bulan": "2026-07", "jenis": "tetap",     "platform": null,     "nilai": 3000000, "keterangan": "gaji admin" }
  ],
  "opsi": {
    "retur_barang_rusak": false,
    "ambang_laris_persen": 20,
    "ambang_margin_tipis_persen": 10
  }
}
```

- `template_id` **atau** `mapping` (pemetaan langsung) wajib diisi salah satu. Mode
  `mapping` langsung dipakai oleh demo dan sebelum fase template selesai.
- Jika `template_id` dipakai dan header berbeda dari `headers` template untuk kolom
  yang dibutuhkan, API membalas 409 `HEADER_BERUBAH` beserta daftar kolom yang hilang.
- `row_offset` adalah nomor baris sheet untuk `rows[0]`. Dipakai agar Masalah Data
  menyebut nomor baris asli.
- `biaya.jenis`:
  - `iklan`: total per platform per bulan, `platform` wajib.
  - `packaging`: tarif per pesanan. `platform` boleh null (berlaku semua platform)
    atau diisi (berlaku platform itu saja; mengalahkan tarif umum).
  - `tetap`: total per bulan.
- Nilai `rows` bisa berupa string atau angka. Sel tanggal dikirim add-on sebagai
  string ISO dengan offset zona waktu spreadsheet.

Response 200:

```json
{
  "ringkasan": {
    "omzet_kotor": 0, "retur": 0, "penjualan_bersih": 0,
    "diskon_voucher_penjual": 0, "biaya_marketplace": 0,
    "total_potongan_marketplace": 0, "dana_diterima": 0,
    "hpp": 0, "iklan": 0, "packaging": 0, "laba_kontribusi": 0,
    "biaya_tetap": 0, "laba_bersih": 0, "margin_persen": 0,
    "jumlah_pesanan": 0, "jumlah_pesanan_batal": 0, "jumlah_pesanan_retur": 0,
    "jumlah_pesanan_belum_cair": 0, "iklan_tidak_teralokasi": 0,
    "tanggal_pertama": "2026-07-01", "tanggal_terakhir": "2026-09-30",
    "periode": ["2026-07", "2026-08", "2026-09"]
  },
  "rincian_biaya_marketplace": {
    "biaya_admin": 0, "biaya_layanan": 0,
    "ongkir_ditanggung_penjual": 0, "potongan_lainnya": 0
  },
  "per_produk":   [{ "sku": "", "nama": "", "qty": 0, "omzet_kotor": 0, "retur": 0,
                     "penjualan_bersih": 0, "potongan_marketplace": 0, "hpp": 0,
                     "iklan": 0, "packaging": 0, "laba_kontribusi": 0,
                     "margin_persen": 0, "hpp_tersedia": true }],
  "per_platform": [{ "platform": "", "jumlah_pesanan": 0, "qty": 0, "omzet_kotor": 0,
                     "retur": 0, "penjualan_bersih": 0, "potongan_marketplace": 0,
                     "hpp": 0, "iklan": 0, "packaging": 0, "laba_kontribusi": 0,
                     "margin_persen": 0 }],
  "per_bulan":    [{ "bulan": "2026-07", "jumlah_pesanan": 0, "omzet_kotor": 0,
                     "retur": 0, "penjualan_bersih": 0, "potongan_marketplace": 0,
                     "hpp": 0, "iklan": 0, "packaging": 0, "laba_kontribusi": 0,
                     "iklan_tidak_teralokasi": 0, "biaya_tetap": 0,
                     "laba_bersih": 0, "margin_persen": 0 }],
  "sorotan":  [{ "jenis": "LARIS_TAPI_RUGI", "teks": "…", "sku": "KS-01", "platform": null }],
  "masalah":  [{ "jenis": "SKU_TANPA_HPP", "tingkat": "peringatan", "platform": "Shopee",
                 "sheet": "Pesanan - Shopee", "baris": 17, "no_pesanan": "…",
                 "sku": "…", "pesan": "…" }],
  "jumlah_masalah": { "SKU_TANPA_HPP": 3 },
  "info": [{ "jenis": "PESANAN_BELUM_CAIR", "platform": "Shopee", "jumlah": 12,
             "pesan": "12 pesanan Shopee belum cair; laba dihitung dari potongan yang terpetakan." }]
}
```

- `ringkasan.iklan` dan `per_bulan[].iklan` hanya berisi iklan **teralokasi**. Iklan
  tidak teralokasi dilaporkan terpisah di `iklan_tidak_teralokasi`.
- `tanggal_pertama` / `tanggal_terakhir`: tanggal (Asia/Jakarta, `yyyy-mm-dd`) pesanan
  non-batal paling awal dan paling akhir. `periode` = daftar bulan periode laporan
  (§6.8).
- `per_produk` diurutkan dari laba_kontribusi terkecil (yang rugi tampil di atas).
  `per_platform` dan `per_bulan` diurutkan menurut nama dan bulan.
- `masalah` dibatasi 1.000 entri. `jumlah_masalah` selalu berisi hitungan lengkap.
- Satu baris log pemakaian dicatat per request dengan `rowCount` = total baris pesanan.

### 5.3 `POST /v1/demo`

Request: `{ "seed": 42, "bulan_akhir": "2026-09" }`. Keduanya opsional. Default
`bulan_akhir` adalah bulan penuh terakhir menurut Asia/Jakarta.

Response:

```json
{
  "brand": "…",
  "tabs": {
    "Pesanan - Shopee":      { "header": [], "rows": [], "mapping": { } },
    "Pesanan - TikTok Shop": { "header": [], "rows": [], "mapping": { } },
    "Pesanan - Tokopedia":   { "header": [], "rows": [], "mapping": { } },
    "HPP":   { "header": ["sku", "nama", "hpp"], "rows": [] },
    "Biaya": { "header": ["bulan", "jenis", "platform", "nilai", "keterangan"], "rows": [] }
  }
}
```

Isi data demo:

- 1 brand fiktif, 3 platform, 3 bulan, 15 produk.
- Gaya header per platform sengaja dibuat berbeda (nama kolom fiktif, bukan salinan
  export asli) supaya fitur pemetaan ikut terdemokan.
- Dua pola biaya level pesanan: satu platform mengulang biaya di setiap baris item,
  satu platform hanya mengisinya di baris pertama pesanan.
- Termasuk: 2–3 produk laris yang rugi (harga murah + subsidi ongkir + iklan berat),
  pesanan batal, retur, 2 duplikat, 1 SKU tanpa HPP, 1 baris rusak, dan beberapa
  pesanan belum cair (total_diterima kosong) di bulan terakhir.
- Setiap bulan demo punya pesanan pada tanggal 1 dan hari terakhir bulan, sehingga
  demo tidak memunculkan `BULAN_TIDAK_PENUH`. Tab Biaya demo hanya berisi 3 bulan
  periode itu.
- Sama seed dan sama `bulan_akhir` selalu menghasilkan data identik.

### 5.4 `POST /v1/mapping/suggest` (fase 5)

Request: `{ "platform": "Shopee", "rows": [[...], ...] }`. Isinya 30 baris teratas
sheet apa adanya, termasuk kemungkinan baris judul di atas header.

Response:

```json
{
  "header_row": 1,
  "template_cocok": { "id": "ckx...", "name": "…" },
  "saran": {
    "fields": {
      "harga_jual": { "headers": ["Harga Awal"], "level": "item", "skor": 0.82,
                      "alternatif": [{ "header": "Harga Setelah Diskon", "skor": 0.71 }] }
    },
    "status_map": { "Selesai": "selesai", "Batal": "batal" },
    "options": { "harga_jual_basis": "unit" }
  },
  "field_wajib_belum_terpetakan": []
}
```

Cara menebak:

- Kode tidak berisi nama kolom marketplace mana pun. Yang ada hanya kosakata umum per
  field. Contoh: `tanggal` → {tanggal, waktu, date, dibuat, created};
  `no_pesanan` → {pesanan, order, no, id, invoice}.
- Header dinormalisasi: huruf kecil, tanda baca dibuang, dipecah per kata.
- Skor = gabungan kecocokan kata (berbobot) dan kemiripan trigram, lalu disesuaikan
  dengan tipe isi kolom (tanggal, angka, teks) dari baris contoh.
- `header_row`: baris pertama yang sebagian besar selnya teks tidak kosong dan
  diikuti baris data.
- `template_cocok`: template milik klien untuk platform yang sama dengan
  `headerSignature` identik. Jika ada, saran diambil dari template itu.
- `status_map`: diisi dari nilai unik kolom status. Klasifikasinya lewat kata kunci
  (batal/cancel → batal; retur/return/refund/pengembalian → retur; selesai/complete/
  diterima/dikirim → selesai; lainnya → tidak_dikenal).

### 5.5 Template (fase 5)

- `POST /v1/mapping/templates` — `{ platform, name, headers, header_row, mapping }` → template
- `GET /v1/mapping/templates?platform=` → daftar template milik klien
- `GET /v1/mapping/templates/:id`
- `PUT /v1/mapping/templates/:id`
- `DELETE /v1/mapping/templates/:id`

Template hanya bisa diakses klien pemiliknya. Template milik klien lain dibalas 404.

## 6. Rumus perhitungan

Semua nilai uang berupa bilangan bulat Rupiah. Angka hasil parsing dibulatkan ke
rupiah terdekat per sel.

### 6.1 Parsing

- **Angka:**
  - Menerima `1250000`, `"Rp 1.250.000"`, `"1.250.000,50"`, `"1,250,000"`, `"-1.500"`,
    `"(1.500)"`.
  - Format Indonesia (titik = ribuan, koma = desimal) diutamakan saat ambigu.
  - Sel kosong = 0 untuk field biaya, dan "kosong" untuk field wajib.
  - Teks tak terbaca menghasilkan `BARIS_GAGAL_DIBACA`.
- **Biaya diambil nilai mutlaknya**, karena export sering menulis biaya sebagai
  angka negatif. Berlaku untuk diskon_penjual, voucher_penjual, biaya_admin,
  biaya_layanan, dan ongkir_ditanggung_penjual.
- **Tanggal:**
  - Menerima ISO dengan offset, ISO tanpa offset, `dd/mm/yyyy [HH:mm[:ss]]`,
    `dd-mm-yyyy`, `yyyy/mm/dd`, dan nomor seri tanggal Sheets.
  - Format `dd/mm` diutamakan (bukan `mm/dd`).
  - Waktu tanpa offset dianggap waktu Asia/Jakarta (WIB, UTC+7, tanpa DST).
- **Bulan** = `yyyy-mm` dari tanggal pesanan **setelah dikonversi ke Asia/Jakarta**.
  Contoh: `2026-07-31T17:30:00Z` = 1 Agustus 00:30 WIB → bulan `2026-08`.

### 6.2 Status

- `status_map` memetakan nilai mentah ke `selesai | batal | retur`.
- Nilai yang tidak ada di peta diklasifikasi dengan kata kunci (§5.4). Jika tetap
  tidak dikenal, baris dianggap **selesai** dan dicatat `STATUS_TIDAK_DIKENAL`.
- **Batal:** baris dikecualikan seluruhnya dari semua perhitungan dan hanya dihitung
  di `jumlah_pesanan_batal`. Sebuah pesanan berstatus batal jika semua barisnya batal.

### 6.3 Biaya level pesanan

Untuk field ber-`level: order` dan `total_diterima`:

1. **Nilai pesanan** = nilai **pertama yang tidak kosong** di antara baris-baris
   pesanan itu, menurut urutan baris di sheet. Ini menangani dua pola export:
   biaya diulang di setiap baris item, dan biaya hanya ada di baris pertama.
   Jika baris lain berisi nilai berbeda yang tidak kosong, nilai pertama tetap dipakai
   dan dicatat `NILAI_PESANAN_TIDAK_KONSISTEN` (peringatan).
2. **Dibagi ke item** non-batal dalam pesanan, proporsional terhadap nilai item:
   `biaya_item = biaya_pesanan × nilai_item ÷ Σ nilai_item`.
   Jika Σ nilai_item = 0, dibagi proporsional terhadap qty. Jika Σ qty juga 0,
   dibagi rata.
3. **Pembulatan sisa terbesar:**
   - Setiap bagian dibulatkan ke bawah.
   - Sisa rupiah dibagikan satu per satu ke bagian dengan pecahan terbesar.
   - Jika pecahan sama besar, bagian yang tampil lebih dulu didahulukan.
   - Jumlah hasil alokasi **selalu persis sama** dengan nilai awal.

Fungsi yang sama (`allocate(total, bobot[])`) dipakai untuk semua alokasi di sistem.

### 6.4 Per baris item (non-batal)

```
nilai_item     = harga_jual × qty          (atau harga_jual jika basis = baris)
diskon_voucher = diskon_penjual + voucher_penjual
biaya_mp       = biaya_admin + biaya_layanan + ongkir_ditanggung_penjual + potongan_lainnya
potongan_item  = diskon_voucher + biaya_mp
hpp_item       = hpp_sku × qty
```

### 6.5 potongan_lainnya dan pesanan belum cair

Dihitung per pesanan, hanya jika `total_diterima` dipetakan:

- **Pesanan belum cair:** `total_diterima` kosong atau 0 pada pesanan non-batal.
  - `potongan_lainnya = 0`. Laba dihitung dari potongan yang terpetakan saja.
  - Pesanan dihitung di `ringkasan.jumlah_pesanan_belum_cair` dan dilaporkan di
    `info` (bukan di `masalah`).
  - Pesanan yang seluruhnya retur tidak dihitung sebagai belum cair, karena memang
    tidak ada dana yang diharapkan.
- **Pesanan sudah cair:**
  ```
  potongan_lainnya_pesanan = Σ nilai_item(non-retur) − Σ potongan terpetakan(semua item aktif) − total_diterima
  ```
  - "Σ potongan terpetakan" adalah diskon, voucher, admin, layanan, dan ongkir pada
    **semua** item non-batal, termasuk biaya yang tercatat di baris retur. Dengan begitu
    Σ dana diterima item pesanan = total_diterima persis, baik marketplace mengembalikan
    biaya bagian retur maupun tidak. (Revisi 2026-10-14 setelah review akhir: versi awal
    hanya menghitung item non-retur, sehingga pesanan campuran retur tidak cocok dengan
    dana cair.)
  - Nilai item hanya dari item non-retur. Retur tidak menghasilkan dana cair.
  - Hasilnya dialokasikan ke item non-retur menurut nilai_item (§6.3).
  - `SELISIH_REKONSILIASI` (peringatan) dinilai atas item **non-retur** saja
    (`Σ nilai_item − Σ potongan item non-retur − total_diterima`), supaya biaya retur
    yang dikembalikan marketplace tidak memicu peringatan palsu. Dicatat jika hasilnya
    negatif kurang dari −Rp1.000, atau lebih dari 50% Σ nilai_item.
  - Pesan untuk selisih **negatif** (dana cair lebih besar dari perhitungan) wajib
    menyebut kemungkinan penyebab: "Dana cair lebih besar Rp… dari perhitungan.
    Kemungkinan harga_jual dipetakan ke harga setelah diskon sementara
    diskon_penjual juga dipetakan, atau ada subsidi dari marketplace."
  - Pesan untuk selisih **besar** (> 50%): "Potongan lainnya Rp… (…% dari nilai
    pesanan). Periksa apakah ada kolom biaya yang belum dipetakan atau total_diterima
    dipetakan ke kolom yang salah."

Jika `total_diterima` tidak dipetakan, `potongan_lainnya = 0` untuk semua pesanan.

### 6.6 Retur

Baris berstatus retur:

- `nilai_item` masuk **omzet kotor**, lalu dikurangkan lagi sebagai **retur**.
  Penjualan bersihnya 0.
- Diskon dan voucher penjual **tidak** dihitung (dikembalikan bersama dana pembeli).
- Biaya admin, biaya layanan, dan ongkir ditanggung penjual dihitung **sesuai angka di
  export** (bisa 0 bila marketplace mengembalikannya).
- `potongan_lainnya` = 0.
- **HPP = 0**, karena barang kembali ke stok. Jika `opsi.retur_barang_rusak = true`,
  HPP tetap dihitung `hpp_sku × qty`.
- Packaging tetap dihitung (sudah terpakai).
- Retur parsial (sebagian qty) tidak didukung di v1. Status baris berlaku untuk seluruh
  qty baris itu.

### 6.7 Duplikat

- Kunci baris: `platform + no_pesanan + sku`. Perbandingannya setelah trim, tanpa
  membedakan huruf besar/kecil.
- Kemunculan pertama (urutan tab, lalu urutan baris) dipakai. Kemunculan berikutnya
  dibuang dan dicatat `DUPLIKAT`, dengan nomor baris kemunculan pertama.
- Duplikat dicek **sebelum** pembentukan pesanan, sehingga baris duplikat tidak ikut
  menentukan nilai biaya level pesanan.

### 6.8 Biaya tambahan (tab Biaya)

**Periode laporan** = himpunan bulan (Asia/Jakarta) yang muncul di data pesanan
**non-batal**, setelah baris gagal dan duplikat dibuang.

- Baris Biaya (iklan, packaging, tetap) dengan bulan **di luar periode** diabaikan
  seluruhnya: tidak mengurangi laba, tidak dialokasikan, dan **tidak** dicatat sebagai
  `IKLAN_TIDAK_TERALOKASI`.
- Jika ada yang diabaikan, dicatat info `BIAYA_DI_LUAR_PERIODE` berisi daftar bulan dan
  total nilai yang diabaikan per bulan. Untuk packaging (tarif, bukan total), yang
  dilaporkan adalah tarifnya beserta catatan "tarif per pesanan".
- Aturan di bawah hanya berlaku untuk baris Biaya di dalam periode.

**Bulan tidak penuh:**

- Untuk setiap bulan dalam periode, jika tanggal pesanan non-batal paling awal di
  bulan itu bukan tanggal 1, atau yang paling akhir bukan hari terakhir bulan itu,
  dicatat info `BULAN_TIDAK_PENUH`.
- Contoh pesan: "Data Juli 2026 hanya mencakup 5–31 Juli. Biaya tetap Juli tetap
  dihitung penuh."
- Perhitungan tidak berubah. Biaya tetap dan iklan bulan itu tetap dihitung penuh.

- **Packaging:**
  - Biaya per pesanan = tarif bulan pesanan itu (tarif per platform mengalahkan tarif
    umum).
  - Berlaku untuk setiap pesanan non-batal, termasuk retur.
  - Dibagi ke item pesanan menurut nilai_item (§6.3).
  - Bulan tanpa tarif berarti packaging 0.
- **Iklan:**
  ```
  iklan_produk(p, b) = iklan(p, b) × omzet_kotor_produk(p, b) ÷ omzet_kotor(p, b)
  ```
  - Alokasi dengan §6.3, bobotnya omzet kotor produk di platform p dan bulan b.
  - Jika omzet kotor platform p di bulan b = 0, seluruh iklan itu masuk
    `iklan_tidak_teralokasi`.
  - Iklan yang tidak teralokasi tetap mengurangi laba bersih di Ringkasan dan Bulanan,
    tetapi tidak di Produk maupun Platform. Dicatat `IKLAN_TIDAK_TERALOKASI`.
    Kondisi ini hanya mungkin untuk bulan **di dalam** periode, yaitu ada pesanan di
    bulan itu tetapi tidak ada di platform p.
- **Biaya tetap:** tidak dialokasikan ke produk maupun platform. Hanya mengurangi laba
  di Ringkasan dan Bulanan.
- Baris Biaya dengan bulan atau nilai tak terbaca, atau jenis tidak dikenal, dicatat
  `BIAYA_TIDAK_VALID` dan dilewati.
- Tarif packaging khusus platform yang nama platformnya tidak cocok dengan tab pesanan
  mana pun juga dicatat `BIAYA_TIDAK_VALID` (biasanya salah ketik), karena tarifnya tidak
  akan pernah terpakai.

### 6.9 Rantai laba

```
Omzet kotor               = Σ nilai_item (selesai + retur)
− Retur                   = Σ nilai_item (retur)
= Penjualan bersih
− Diskon & voucher penjual
− Biaya marketplace       = admin + layanan + ongkir ditanggung + potongan lainnya
= Dana diterima
− HPP
− Iklan (teralokasi)
− Packaging
= Laba kontribusi         ← level Produk dan Platform berhenti di sini
− Iklan tidak teralokasi
− Biaya tetap
= Laba bersih             ← Ringkasan dan Bulanan

Total potongan marketplace = Diskon & voucher penjual + Biaya marketplace
Margin %                   = Laba ÷ Penjualan bersih × 100  (dibulatkan 1 desimal;
                             0 bila penjualan bersih = 0)
```

`jumlah_pesanan` = jumlah pesanan non-batal (termasuk retur), dihitung per
`platform + no_pesanan`. `jumlah_pesanan_retur` = pesanan yang punya minimal satu
baris retur.

Margin produk dan platform memakai laba kontribusi. Margin ringkasan dan bulanan
memakai laba bersih.

`Iklan` di rantai ini, di `ringkasan.iklan`, dan di `per_bulan[].iklan` hanya berisi
iklan teralokasi. Iklan tidak teralokasi selalu ditampilkan sebagai baris terpisah.

Konsistensi (diuji):

- Σ laba_kontribusi per produk = Σ per platform = laba_kontribusi ringkasan.
- Σ per bulan = nilai ringkasan, untuk setiap kolom uang dan jumlah. Kolom
  `margin_persen` dikecualikan.

### 6.10 SKU tanpa HPP

HPP dianggap 0 dan `hpp_tersedia = false`. Dicatat `SKU_TANPA_HPP` satu kali per SKU,
dengan jumlah baris terdampak. Di laporan Produk, SKU ini diberi tanda
"HPP belum diisi". Pencocokan SKU dengan tab HPP setelah trim, tanpa membedakan huruf
besar/kecil.

### 6.11 Sorotan

Dihitung dari `per_produk` dan `per_platform`:

- `LARIS_TAPI_RUGI` / `LARIS_MARGIN_TIPIS`:
  - Berlaku untuk produk di `ambang_laris_persen` teratas menurut qty (minimal 3
    produk), dengan laba_kontribusi < 0 (rugi) atau margin < `ambang_margin_tipis_persen`
    (tipis).
  - Produk tanpa HPP dikecualikan.
- `PRODUK_PALING_UNTUNG`: 3 produk teratas menurut laba_kontribusi (produk tanpa HPP dikecualikan, karena labanya membengkak).
- `PLATFORM_PALING_UNTUNG`: menurut laba_kontribusi.
- `PLATFORM_MARGIN_TERBAIK`: hanya jika platformnya berbeda dari yang paling untung.

Setiap sorotan berisi `teks` siap tampil, contoh: "Kopi Susu 250ml terjual 412 pcs
(terlaris #2) tetapi rugi Rp1.240.500 (margin −8,3%)."

### 6.12 Jenis masalah data

| Jenis | Tingkat | Kapan |
|---|---|---|
| KOLOM_WAJIB_KOSONG | error | no_pesanan, tanggal, sku, qty, atau harga_jual kosong → baris dilewati |
| BARIS_GAGAL_DIBACA | error | angka atau tanggal tak terbaca → baris dilewati |
| DUPLIKAT | peringatan | §6.7 |
| SKU_TANPA_HPP | peringatan | §6.10 |
| STATUS_TIDAK_DIKENAL | peringatan | §6.2 |
| NILAI_PESANAN_TIDAK_KONSISTEN | peringatan | §6.3 |
| SELISIH_REKONSILIASI | peringatan | §6.5 |
| IKLAN_TIDAK_TERALOKASI | peringatan | §6.8 |
| BIAYA_TIDAK_VALID | peringatan | §6.8 |

Baris yang seluruh selnya kosong dilewati tanpa dicatat.

Info (bukan masalah):

- `PESANAN_BELUM_CAIR` (§6.5)
- `STATUS_TIDAK_DIPETAKAN` (kolom status tidak dipetakan, semua baris dianggap selesai)
- `BIAYA_DI_LUAR_PERIODE` (§6.8)
- `BULAN_TIDAK_PENUH` (§6.8)

## 7. Add-on Google Sheets

Distribusi v1: **spreadsheet template** berisi script terikat. Pengguna cukup
"Buat salinan". Kode ditulis dengan pola Editor Add-on (`onOpen(e)` sadar `authMode`,
`onInstall`) agar kelak bisa diterbitkan ke Workspace Marketplace.

### 7.1 Struktur spreadsheet

Spreadsheet template diatur ke locale **Indonesia (`id_ID`)** dan zona waktu
**`Asia/Jakarta`**.

- `Pesanan - [Platform]`: isi export ditempel apa adanya. Nama platform diambil dari
  teks setelah "Pesanan - ".
- `HPP`: kolom `sku | nama | hpp`, header di baris 1.
- `Biaya`: kolom `bulan | jenis | platform | nilai | keterangan`, header di baris 1.
  Kolom `jenis` memakai dropdown validasi iklan/packaging/tetap.
- Tab laporan dibuat atau ditimpa oleh add-on: `Laporan - Ringkasan`,
  `Laporan - Produk`, `Laporan - Platform`, `Laporan - Bulanan`, `Masalah Data`.

### 7.2 Menu "HAI"

**Cek locale dan zona waktu.** Dijalankan di awal **Hitung Laba** dan **Isi Data Demo**,
sebelum langkah lain:

1. Bandingkan `getSpreadsheetLocale()` dengan `id_ID` dan `getSpreadsheetTimeZone()`
   dengan `Asia/Jakarta`.
2. Jika salah satu berbeda, tampilkan dialog (HTML modal) yang menyebut nilai saat ini
   dan risikonya: "Tanggal seperti 03/07/2026 bisa terbaca sebagai 7 Maret, bukan
   3 Juli, saat export ditempel. Pengelompokan per bulan juga bisa bergeser."
3. Dialog punya tiga tombol:
   - **Ubah ke Indonesia & Asia/Jakarta lalu lanjut:** memanggil `setSpreadsheetLocale`
     dan `setSpreadsheetTimeZone`. Disertai catatan: "Data yang sudah ditempel tidak
     ikut berubah. Jika tanggal terlihat salah, tempel ulang export-nya."
   - **Lanjut tanpa mengubah**
   - **Batal**
4. Proses **tidak berlanjut** sebelum pengguna memilih. Logika perbandingannya ditaruh
   di fungsi murni agar bisa diuji.

- **Pengaturan:** dialog untuk mengisi API key dan URL API.
  - Disimpan di `UserProperties`, jadi per pengguna dan tidak terlihat editor lain.
  - Tombol "Tes koneksi" memanggil `/health` dan endpoint ber-auth.
- **Petakan Kolom** (fase 5):
  1. Untuk tab aktif, kirim 30 baris teratas ke `/mapping/suggest`.
  2. `MappingSidebar.html` menampilkan per field: dropdown header (bisa pilih lebih
     dari satu), pilihan item/pesanan untuk field biaya, opsi `harga_jual_basis`, dan
     daftar nilai status dengan dropdown kelompoknya.
  3. Field wajib yang kosong diberi tanda merah. Field `harga_jual` diberi petunjuk
     singkat: "Pilih harga **sebelum** diskon penjual. Jika Anda memilih harga setelah
     diskon, jangan petakan diskon_penjual. Kalau tidak, diskon terhitung dua kali dan
     muncul selisih rekonsiliasi."
  4. Saat disimpan, template disimpan ke API dan id-nya disimpan di
     `DocumentProperties` dengan kunci `hai.template.<nama tab>`.
- **Hitung Laba:**
  1. Untuk setiap tab Pesanan, ambil pemetaan dari `DocumentProperties`: `template_id`,
     atau `mapping` langsung untuk tab demo. Tab tanpa pemetaan menghentikan proses
     dengan pesan "Petakan kolom tab X dulu".
  2. Baca hanya kolom yang dipakai pemetaan, mulai dari `headerRow + 1` sampai baris
     terakhir berisi. Tanggal dikirim sebagai string ISO dengan offset zona waktu
     spreadsheet.
  3. Baca HPP dan Biaya.
  4. **Cek ukuran** sebelum mengirim. Jika body JSON melebihi **15 MB** atau total
     baris melebihi **60.000**, proses berhenti dengan pesan: "Data terlalu besar
     untuk satu kali hitung (X baris, Y MB). Batas saat ini 60.000 baris / 15 MB.
     Bagi data per periode (mis. per bulan) lalu hitung terpisah."
     Angka batas disimpan sebagai konstanta di `Analyze.gs`.
  5. Progres ditampilkan lewat `SpreadsheetApp.getActive().toast()` per tahap:
     membaca data → menghitung → menulis laporan (per tab).
  6. Tulis 5 tab laporan (§7.3), lalu aktifkan tab Ringkasan.
  7. Error API ditampilkan sebagai dialog berbahasa Indonesia berdasarkan
     `error.code`. Untuk `HEADER_BERUBAH`, pengguna diarahkan ke Petakan Kolom.
- **Isi Data Demo:**
  1. Konfirmasi dulu, karena tab dengan nama yang sama akan ditimpa.
  2. Panggil `/demo`, buat dan isi semua tab, lalu simpan `mapping` demo di
     `DocumentProperties`.
  3. Tawarkan langsung menjalankan Hitung Laba.

Pemanggilan API (`Api.gs`): `UrlFetchApp` dengan `muteHttpExceptions`, retry hingga
2 kali dengan jeda bertahap untuk 429/5xx, dan timeout bawaan Apps Script.

### 7.3 Tab laporan

Semua nilai uang memakai format `"Rp "#,##0;[Red]"-Rp "#,##0`, dan persen memakai
`0.0"%"`. Setiap tab ditulis ulang dari kosong (clear isi, format, dan grafik).

- **Laporan - Ringkasan:**
  - Rentang data di bagian atas: "Data 1 Jul 2026 – 30 Sep 2026 (3 bulan)", dari
    `tanggal_pertama`, `tanggal_terakhir`, dan `periode`.
  - Tabel rantai laba §6.9 (label | nilai), dengan baris iklan tidak teralokasi
    terpisah.
  - Rincian biaya marketplace.
  - Jumlah pesanan (total, batal, retur, belum cair).
  - Daftar sorotan.
  - Catatan kecil "Dihitung pada <waktu>".
  - Grafik: kolom komposisi potongan dan biaya.
- **Laporan - Produk:**
  - Tabel per_produk, header dibekukan.
  - Baris dengan laba < 0 diberi latar merah muda dan teks merah. Margin di bawah
    ambang diberi latar kuning.
  - SKU tanpa HPP diberi catatan.
  - Grafik: batang horizontal 10 produk dengan laba kontribusi tertinggi dan 5
    terendah.
- **Laporan - Platform:** tabel per_platform. Grafik kolom penjualan bersih vs laba
  kontribusi per platform.
- **Laporan - Bulanan:** tabel per_bulan. Grafik kombinasi: kolom penjualan bersih,
  garis laba bersih.
- **Masalah Data:**
  - Bagian info di atas: belum cair, biaya di luar periode, bulan tidak penuh, status
    tidak dipetakan.
  - Ringkasan `jumlah_masalah` per jenis.
  - Tabel masalah: tingkat | jenis | platform | sheet | baris | no_pesanan | sku | pesan.
  - Jika ada lebih dari 1.000 masalah, ditambahkan catatan bahwa daftar dipotong.

## 8. Pengujian

- **Unit test (Vitest) untuk `core/`, ditulis dengan TDD.** Minimal mencakup:
  - parse angka: semua format §6.1, nilai negatif, kurung, sel kosong, teks rusak.
  - parse tanggal + bulan Asia/Jakarta, khususnya di sekitar pergantian bulan:
    - `2026-07-31T23:59:59+07:00` → 2026-07
    - `2026-07-31T17:00:00Z` → 2026-08 (00:00 WIB)
    - `2026-07-31T16:59:59Z` → 2026-07
    - `"31/07/2026 23:59"` → 2026-07
    - `"01/08/2026 00:00"` → 2026-08
    - nomor seri Sheets di malam pergantian bulan
    - pergantian tahun `2026-12-31T17:30:00Z` → 2027-01
  - allocate: jumlah selalu sama dengan total, aturan seri (tie), bobot nol → qty →
    rata, satu item, total 0. Ditambah uji properti dengan input acak.
  - biaya level pesanan: pola diulang per baris, pola hanya baris pertama, nilai
    tidak konsisten.
  - potongan_lainnya: sudah cair, belum cair (kosong dan 0), selisih negatif/besar,
    pesanan campuran retur.
  - status: batal dikecualikan, retur (HPP 0 dan opsi rusak), tidak dikenal.
  - duplikat lintas tab dan dalam satu tab.
  - packaging (tarif umum vs per platform), iklan (proporsional, tidak teralokasi),
    biaya tetap.
  - periode biaya: tab Biaya berisi 12 bulan (iklan, packaging, tetap), pesanan
    hanya 1 bulan. Yang diuji:
    - hanya biaya bulan itu yang mengurangi laba,
    - tidak ada `IKLAN_TIDAK_TERALOKASI` untuk 11 bulan lainnya,
    - info `BIAYA_DI_LUAR_PERIODE` berisi 11 bulan dengan total yang benar.
    Juga diuji: bulan yang semua pesanannya batal tidak masuk periode.
  - rentang data dan `BULAN_TIDAK_PENUH`:
    - bulan penuh (ada pesanan tanggal 1 dan hari terakhir) → tanpa info,
    - mulai tanggal 5 → info,
    - berakhir sebelum hari terakhir → info,
    - Februari 2028 (kabisat, hari terakhir 29),
    - pesanan `2026-07-31T17:30:00Z` dihitung sebagai 1 Agustus.
  - agregasi dan uji konsistensi §6.9 (tanpa margin_persen), sorotan, batas 1.000
    masalah.
  - pesan `SELISIH_REKONSILIASI` negatif memuat kalimat kemungkinan penyebab.
  - generator demo: deterministik, jumlah produk/platform/bulan benar, berisi produk
    laris yang rugi menurut `analyze`.
- **Tes integrasi route:**
  - Dengan `app.request` Hono dan Postgres dari docker-compose.
  - Cakupan: auth (tanpa key, key salah, key dicabut), validasi, `/analyze` dengan
    `mapping` langsung dan dengan `template_id`, `HEADER_BERUBAH`, log pemakaian
    tercatat tanpa isi data, kepemilikan template.
- **Add-on:**
  - Logika non-rumus yang bisa diuji (pemilihan kolom dari pemetaan, cek ukuran,
    konversi tanggal, perbandingan locale/zona waktu) ditaruh di fungsi murni dan
    diuji dengan Vitest lewat `vm`.
  - Selebihnya diuji manual dengan checklist di README. Checklist minimal memuat:
    - Ubah locale spreadsheet ke English (US) dan zona waktu ke selain Asia/Jakarta.
      Jalankan Hitung Laba dan Isi Data Demo: dialog peringatan muncul, ketiga tombol
      bekerja, dan tidak ada perhitungan sebelum tombol dipilih.
    - Tempel tanggal `03/07/2026` di locale en_US vs id_ID dan amati perbedaannya.
    - Isi Data Demo → Hitung Laba → kelima tab laporan, format Rupiah, warna merah,
      dan grafik.
    - Data melebihi batas ukuran memunculkan pesan yang jelas.

## 9. Rencana versi 2 (tidak dikerjakan di v1)

### 9.1 Pengiriman data bertahap (chunking)

Untuk data di atas batas §7.2:

- **Endpoint:**
  - `POST /v1/analyze/chunk` — `{state?, bagian}` → `{state, baris_diproses, masalah_sementara}`
  - `POST /v1/analyze/finalize` — `{state, hpp, biaya, opsi}` → laporan.
  - `/v1/analyze` tetap ada untuk sekali kirim.
- **Isi `state`:**
  - rekap parsial per (platform, bulan, sku) dan per pesanan untuk packaging,
  - hash 64-bit kunci duplikat dan no_pesanan,
  - masalah sementara.
- **Keamanan `state`:** dienkripsi AES-256-GCM dengan kunci server, terikat ke
  client_id, dan kedaluwarsa dalam 1 jam. Server tetap tanpa penyimpanan.
- **Add-on:**
  - Sidebar progres menjalankan loop `google.script.run.kirimBagian(i, state)`. Setiap
    panggilan adalah eksekusi baru dengan jatah 6 menitnya sendiri.
  - Setiap bagian berisi kira-kira 5.000 baris, dipotong hanya di pergantian
    no_pesanan.
  - Pesanan yang barisnya muncul lagi di bagian lain dicatat `PESANAN_TERPISAH`.
- **Syarat uji:** hasil yang dipecah per bagian harus identik dengan hasil sekali kirim.

### 9.2 Biaya iklan per SKU

- Tab Biaya mendapat kolom `sku` opsional untuk jenis iklan.
- Iklan ber-SKU dibebankan langsung ke SKU itu (dan platform/bulannya).
- Iklan tanpa SKU tetap dialokasikan menurut omzet (§6.8), hanya di antara produk
  platform tersebut.

## 10. Urutan kerja

1. **Core (TDD):** parse, status, allocate, normalize, aggregate, highlights, analyze.
2. **Generator demo:** `core/demo.ts` beserta tesnya. Datanya dijalankan lewat
   `analyze` untuk memastikan cerita demo muncul.
3. **API `/v1/analyze` + `/v1/demo` + auth:**
   - Prisma (Client, ApiKey, UsageLog), CLI create-client, middleware, Dockerfile,
     docker-compose.
   - `/analyze` menerima `mapping` langsung.
4. **Add-on:** Pengaturan, cek locale dan zona waktu, Isi Data Demo, Hitung Laba,
   penulisan 5 tab laporan beserta format dan grafik, cek ukuran. **Pada titik ini demo siap ditunjukkan.**
5. **Template pemetaan:**
   - Model MappingTemplate, `core/mapping.ts` (suggest), endpoint suggest + templates.
   - Dukungan `template_id` + `HEADER_BERUBAH` di `/analyze`.
   - Menu Petakan Kolom + `MappingSidebar.html`.
6. **README:** dokumentasi rumus (bahasa klien), cara deploy, cara membuat klien,
   checklist uji manual add-on. Bagian rumus ditulis bertahap sejak fase 1.
