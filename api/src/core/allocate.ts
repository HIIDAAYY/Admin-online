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
