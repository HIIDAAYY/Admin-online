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
