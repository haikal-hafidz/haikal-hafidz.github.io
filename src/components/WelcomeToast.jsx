import React, { useState, useEffect } from 'react';

// Kunci sessionStorage biar notif cuma muncul SEKALI per sesi tab browser (bukan tiap
// pindah-pindah tab Home/About/dst, dan bukan tiap refresh — tapi tetep muncul lagi
// kalau tab/browser-nya beneran ditutup terus dibuka baru).
const SEEN_KEY = 'portfolio_welcome_seen';

export default function WelcomeToast({ settings, isMobileLayout }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const enabled = settings?.enabled;
  const title = settings?.title || 'Selamat datang! 👋';
  const message = settings?.message || '';
  const items = Array.isArray(settings?.items)
    ? settings.items.filter((item) => item && (String(item.title || '').trim() || String(item.description || '').trim()))
    : [];
  const delaySeconds = Number.isFinite(settings?.delaySeconds) ? settings.delaySeconds : 2;

  useEffect(() => {
    if (!enabled) return;

    let alreadySeen = false;
    try {
      alreadySeen = sessionStorage.getItem(SEEN_KEY) === 'true';
    } catch {
      /* sessionStorage gak tersedia — anggap belum pernah lihat, gapapa muncul lagi */
    }
    if (alreadySeen) return;

    const timer = setTimeout(() => {
      setVisible(true);
      try {
        sessionStorage.setItem(SEEN_KEY, 'true');
      } catch {
        /* diamkan kalau gagal nulis, gak fatal */
      }
    }, Math.max(0, delaySeconds) * 1000);

    return () => clearTimeout(timer);
  }, [enabled, delaySeconds]);

  const handleClose = () => {
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
          <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
            {title}
          </h4>
          <div className="mt-1 max-h-40 overflow-y-auto overscroll-contain pr-1">
            {items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={`welcome-patch-${index}`} className="text-xs leading-relaxed">
                    {item.title && (
                      <div className="font-semibold text-gray-700 dark:text-gray-200">
                        {String(index + 1).padStart(2, '0')} · {item.title}
                      </div>
                    )}
                    {item.description && (
                      <div className="text-gray-500 dark:text-gray-400">
                        {item.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : message ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {message}
              </p>
            ) : null}
          </div>
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
