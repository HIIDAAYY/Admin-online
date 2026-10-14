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
- Produk tanpa HPP tidak ikut disorot, karena labanya belum akurat.

### Privasi

Data pesanan diproses lalu langsung dibuang. Yang disimpan hanya akun klien, API key (dalam
bentuk hash), template pemetaan kolom (nama header saja), dan log pemakaian (waktu dan jumlah
baris).
