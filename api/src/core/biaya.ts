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
