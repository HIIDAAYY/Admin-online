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
