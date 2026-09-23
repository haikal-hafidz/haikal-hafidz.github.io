import { useEffect } from 'react';

export default function DocumentLoader({ onFinished, minimumDuration = 750 }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onFinished?.(), minimumDuration);
    return () => window.clearTimeout(timer);
  }, [minimumDuration, onFinished]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#d9d9d9] dark:bg-[#2b2b2b] px-6" role="status" aria-label="Membuka dokumen portofolio">
      <style>{`
        @keyframes documentDance {
          0%, 100% { transform: translateY(0) rotate(-1.5deg); }
          25% { transform: translateY(-8px) rotate(1.5deg); }
          50% { transform: translateY(-2px) rotate(-0.75deg); }
          75% { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes loadingSweep {
          0% { transform: translateX(-115%); }
          100% { transform: translateX(315%); }
        }
        .loading-document { animation: documentDance 1.15s ease-in-out infinite; }
        .loading-sweep { animation: loadingSweep 1.05s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .loading-document, .loading-sweep { animation: none; }
          .loading-sweep { transform: translateX(100%); }
        }
      `}</style>

      <div className="flex flex-col items-center gap-5" aria-hidden="true">
        <div className="loading-document relative w-20 h-28 sm:w-24 sm:h-32 rounded-[4px] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.16)]">
          <div className="absolute top-4 left-4 right-4 space-y-2 opacity-70">
            <span className="block h-[3px] w-3/4 rounded-full bg-gray-200" />
            <span className="block h-[3px] w-full rounded-full bg-gray-200" />
            <span className="block h-[3px] w-5/6 rounded-full bg-gray-200" />
          </div>
        </div>
        <div className="relative h-[3px] w-28 sm:w-32 overflow-hidden rounded-full bg-white/35">
          <span className="loading-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}
