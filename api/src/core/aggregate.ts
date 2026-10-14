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
