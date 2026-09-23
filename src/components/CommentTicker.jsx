import { useMemo } from 'react';

// Palet warna balon komentar — dicycle berurutan biar tiap kutipan beda warna dari
// tetangganya, kesannya "hidup" & warna-warni kayak yang diminta.
const PALETTE = [
  'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200',
  'bg-sky-50 border-sky-300 text-sky-800 dark:bg-sky-950/40 dark:border-sky-700 dark:text-sky-200',
  'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200',
  'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-200',
  'bg-violet-50 border-violet-300 text-violet-800 dark:bg-violet-950/40 dark:border-violet-700 dark:text-violet-200',
];

// Durasi satu putaran penuh loop — makin banyak kutipan, makin lama durasinya
// (biar kecepatan geraknya kerasa konsisten, bukan makin ngebut pas kutipan banyak).
const SECONDS_PER_QUOTE = 6;
const MIN_DURATION = 24;

function QuoteBubble({ text, colorClass }) {
  return (
    <div className={`shrink-0 rounded-2xl border px-3.5 py-2.5 shadow-sm mb-4 ${colorClass}`}>
      <p className="text-[11px] leading-relaxed font-mono italic">“{text}”</p>
    </div>
  );
}

// Balon-balon kutipan yang nempel di tepi kanan VIEWPORT (position: fixed), jalan
// ke atas terus-menerus & loop tanpa henti. SENGAJA dirender sebagai fixed relatif ke
// viewport asli — makanya komponen ini harus dipasang DI LUAR elemen manapun yang
// punya `transform` (mis. kertas .word-page yang di-scale pas zoom), soalnya transform
// di ancestor bikin `position: fixed` di dalamnya jadi ke-"jebak" ikut ke-scale juga.
export default function CommentTicker({ quotes }) {
  const cleanQuotes = useMemo(
    () => (Array.isArray(quotes) ? quotes.map((q) => q.trim()).filter(Boolean) : []),
    [quotes]
  );

  if (cleanQuotes.length === 0) return null;

  const duration = Math.max(MIN_DURATION, cleanQuotes.length * SECONDS_PER_QUOTE);
  // Konten diduplikasi 2x biar loop-nya mulus (translateY(-50%) pas ketemu titik
  // sambungan, isinya udah persis sama kayak awal lagi — gak kerasa "patah").
  const doubled = [...cleanQuotes, ...cleanQuotes];

  return (
    <>
      <style>{`
        @keyframes comment-ticker-scroll {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
      `}</style>
      <div
        className="hidden lg:block fixed right-3 top-28 bottom-16 w-52 z-20 pointer-events-none overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]"
        aria-hidden="true"
      >
        <div
          className="flex flex-col"
          style={{ animation: `comment-ticker-scroll ${duration}s linear infinite` }}
        >
          {doubled.map((text, idx) => (
            <QuoteBubble key={idx} text={text} colorClass={PALETTE[idx % PALETTE.length]} />
          ))}
        </div>
      </div>
    </>
  );
}
