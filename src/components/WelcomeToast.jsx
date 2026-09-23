import { useState, useEffect } from 'react';

export default function WelcomeToast({ settings, isMobileLayout }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const enabled = settings?.enabled;
  const title = settings?.title || 'Update terbaru';
  const message = settings?.message || '';
  const version = String(settings?.version || '').trim();
  const delaySeconds = Number.isFinite(settings?.delaySeconds) ? settings.delaySeconds : 2;

  // Versi adalah identitas patch. Kalau admin lupa mengisinya, gabungan judul + pesan
  // tetap jadi fallback agar perubahan isi otomatis dianggap sebagai patch baru.
  const patchId = version || `${title}|${message}`;
  const seenKey = `portfolio_patch_seen:${patchId}`;

  useEffect(() => {
    if (!enabled) return;

    let alreadySeen = false;
    try {
      alreadySeen = localStorage.getItem(seenKey) === 'true';
    } catch {
      /* localStorage gak tersedia — anggap belum pernah lihat, gapapa muncul lagi */
    }
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      setVisible(true);
    }, Math.max(0, delaySeconds) * 1000);

    return () => clearTimeout(timer);
  }, [enabled, delaySeconds, seenKey]);

  const handleClose = () => {
    try {
      localStorage.setItem(seenKey, 'true');
    } catch {
      /* diamkan kalau gagal nulis, gak fatal */
    }
    setClosing(true);
    // Kasih waktu buat animasi keluar main dulu sebelum bener-bener di-unmount
    setTimeout(() => setVisible(false), 200);
  };

  if (!enabled || !visible) return null;

  return (
    <div
      className={
        isMobileLayout
          ? `fixed left-3 right-3 bottom-3 z-[90] transition-all duration-200 ${
              closing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            }`
          : `fixed right-4 bottom-4 z-[90] w-full max-w-xs transition-all duration-200 ${
              closing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            }`
      }
      role="status"
    >
      <div className="bg-white dark:bg-[#242424] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 flex gap-3 items-start">
        <span className="shrink-0 mt-0.5 w-9 h-9 rounded-full bg-[#2b579a] dark:bg-[#3a72c4] text-white flex items-center justify-center">
          {/* Siluet pelikan lagi terbang & ngepakin sayap — cuma bentuk polosnya, warna putih ngikutin currentColor */}
          <svg viewBox="25 50 180 130" className="w-5 h-5" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
            <path d="M116 150 Q108 152 96 149 Q106 145 114 144 Z" />
            <path d="M104 140 Q60 138 40 148 Q54 132 70 128 Q86 126 106 136 Z" />
            <ellipse cx="132" cy="140" rx="34" ry="13" transform="rotate(-8 132 140)" />
            <path d="M110 132 Q100 128 92 129 Q98 132 104 136 Q107 138 111 137 Z" />
            <path d="M128 122 Q134 84 168 68 Q160 96 148 116 Q140 124 128 122 Z" />
            <path d="M122 118 Q126 76 158 58 Q152 88 140 110 Q132 118 122 118 Z" />
            <path
              d="M176 150 L182 166 M188 148 L196 163"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          {version && (
            <span className="block mb-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#2b579a] dark:text-[#7fb0f1]">
              Patch {version}
            </span>
          )}
          <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
            {title}
          </h4>
          {message && (
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1">
              {message}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClose}
          data-hint-id="welcome-toast-close"
          aria-label="Tutup notifikasi"
          className="shrink-0 -mt-1 -mr-1 w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
