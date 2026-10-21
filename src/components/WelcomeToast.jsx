import { useState } from 'react';

export default function WelcomeToast({ settings, isMobileLayout, isOpen, onClose, onUnreadStateChange }) {
  const [closing, setClosing] = useState(false);

  const enabled = settings?.enabled !== false;
  const title = settings?.title || 'Update terbaru';
  const message = settings?.message || '';
  const items = Array.isArray(settings?.items) ? settings.items.filter((item) => item?.title?.trim() || item?.description?.trim()) : [];
  const version = String(settings?.version || '1.0.0').trim();

  const patchId = version || `${title}|${message}|${items.map((item) => `${item.title}:${item.description}`).join('|')}`;
  const seenKey = `portfolio_patch_seen:${patchId}`;

  const handleClose = () => {
    try {
      localStorage.setItem(seenKey, 'true');
    } catch {
      /* optional */
    }
    if (onUnreadStateChange) onUnreadStateChange(false);
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      if (onClose) onClose();
    }, 200);
  };

  if (!enabled || !isOpen) return null;

  return (
    <div
      className={
        isMobileLayout
          ? `fixed left-3 right-3 bottom-3 z-[100] transition-all duration-200 ${
              closing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            }`
          : `fixed right-4 bottom-4 z-[100] w-full max-w-xs transition-all duration-200 ${
              closing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            }`
      }
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-[#242424] border border-gray-300 dark:border-gray-700 rounded-xl shadow-2xl p-4 flex gap-3 items-start">
        <span className="shrink-0 mt-0.5 w-9 h-9 rounded-full bg-[#2b579a] dark:bg-[#3a72c4] text-white flex items-center justify-center">
          <svg viewBox="25 50 180 130" className="w-5 h-5" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
            <path d="M116 150 Q108 152 96 149 Q106 145 114 144 Z" />
            <path d="M104 140 Q60 138 40 148 Q54 132 70 128 Q86 126 106 136 Z" />
            <ellipse cx="132" cy="140" rx="34" ry="13" transform="rotate(-8 132 140)" />
            <path d="M110 132 Q100 128 92 129 Q98 132 104 136 Q107 138 111 137 Z" />
            <path d="M128 122 Q134 84 168 68 Q160 96 148 116 Q140 124 128 122 Z" />
            <path d="M122 118 Q126 76 158 58 Q152 88 140 110 Q132 118 122 118 Z" />
            <path d="M176 150 L182 166 M188 148 L196 163" strokeWidth="4" strokeLinecap="round" fill="none" />
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
          {items.length > 0 ? (
            <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div key={`${item.title || 'patch'}-${index}`} className="border-t border-gray-100 pt-2 first:border-0 first:pt-0 dark:border-gray-700">
                  {item.title && <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">{item.title}</p>}
                  {item.description && (
                    <div
                      className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-[#2b579a] [&_a]:underline dark:[&_a]:text-[#7fb0f1]"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : message ? (
            <div
              className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_a]:text-[#2b579a] [&_a]:underline dark:[&_a]:text-[#7fb0f1]"
              dangerouslySetInnerHTML={{ __html: message }}
            />
          ) : null}
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
