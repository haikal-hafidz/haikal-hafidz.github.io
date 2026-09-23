
// Kotak "Guidance / Hint" — beda dari CommentTicker (yang isinya kutipan warna-warni
// jalan terus/loop di tepi KANAN), komponen ini SENGAJA diem di tempat (gak ada animasi
// sama sekali) dan nempel di tepi KIRI, nunjukin panduan singkat buat pengunjung yang
// masih bingung navigasi web-nya. Satu teks per tab (Home/About/Career/Book/Projects/
// Contact), diedit lewat CMS tab "Patrol" — otomatis ganti isinya begitu `activeTab`
// (tab publik yang lagi dibuka) berubah.
//
// SAMA KAYAK CommentTicker: dirender pakai `position: fixed` relatif ke VIEWPORT asli,
// makanya komponen ini harus dipasang DI LUAR elemen manapun yang punya `transform`
// (mis. kertas .word-page yang di-scale pas zoom) — kalau kepasang di dalam situ,
// `position: fixed`-nya bakal ke-"jebak" ikut ke-scale juga. Taro di App.jsx sejajar
// sama <CommentTicker />.
export default function GuidanceNote({ text, heading }) {
  const cleanText = typeof text === 'string' ? text.trim() : '';

  // Kalau tab yang lagi aktif belum diisi guidance-nya di CMS, kotaknya gak usah nongol
  // sama sekali (daripada nampilin kotak kosong).
  if (!cleanText) return null;

  return (
    <div
      className="hidden lg:block fixed left-3 bottom-16 w-56 z-20"
      aria-live="polite"
    >
      <div className="bg-white dark:bg-[#202020] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg px-4 py-3 max-h-[55vh] overflow-y-auto">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1.5">
          {heading || 'Guidance / Hint'}
        </p>
        <p className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line">
          {cleanText}
        </p>
      </div>
    </div>
  );
}
