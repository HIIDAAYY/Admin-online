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
