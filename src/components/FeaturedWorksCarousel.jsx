import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const PreviewImage = ({ work, className = '' }) => (
  <div aria-hidden="true" className={`overflow-hidden bg-white dark:bg-[#202020] opacity-25 grayscale pointer-events-none ${className}`}>
    {work?.image && <img src={work.image} alt="" draggable="false" className="w-full h-full object-cover" />}
  </div>
);

export default function FeaturedWorksCarousel({ featuredWorks = [], heading, onOpenWork, axis = 'vertical' }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const railRef = useRef(null);
  const panelRef = useRef(null);
  const dragStart = useRef(null);
  const dragOffset = useRef(0);
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const wheelLocked = useRef(false);
  const horizontal = axis === 'horizontal';

  const safeActiveIndex = featuredWorks.length ? activeIndex % featuredWorks.length : 0;

  const changeWork = useCallback((direction) => {
    if (featuredWorks.length < 2) return;
    setActiveIndex((current) => direction === 'next'
      ? (current + 1) % featuredWorks.length
      : (current - 1 + featuredWorks.length) % featuredWorks.length);
  }, [featuredWorks.length]);

  useEffect(() => {
    if (!featuredWorks.length) return;

    // Preload hanya gambar yang berdekatan dengan kartu aktif.
    // Tampilan/markup/animasi carousel tidak berubah; ini hanya menghindari
    // browser mengunduh seluruh galeri sekaligus saat Home pertama dibuka.
    const indexes = featuredWorks.length <= 2
      ? featuredWorks.map((_, index) => index)
      : [
          (safeActiveIndex - 1 + featuredWorks.length) % featuredWorks.length,
          safeActiveIndex,
          (safeActiveIndex + 1) % featuredWorks.length,
        ];

    [...new Set(indexes)].forEach((index) => {
      const source = featuredWorks[index]?.image;
      if (!source) return;
      const image = new Image();
      image.src = source;
    });
  }, [featuredWorks, safeActiveIndex]);

  // Wheel carousel desktop benar-benar punya jalur sendiri. Listener native non-passive
  // diperlukan supaya preventDefault tidak diabaikan browser dan halaman tidak ikut turun.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || horizontal) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (featuredWorks.length < 2 || wheelLocked.current) return;
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(delta) < 8) return;
      wheelLocked.current = true;
      changeWork(delta > 0 ? 'next' : 'previous');
      window.setTimeout(() => { wheelLocked.current = false; }, 420);
    };
    rail.addEventListener('wheel', onWheel, { passive: false });
    return () => rail.removeEventListener('wheel', onWheel);
  }, [changeWork, featuredWorks.length, horizontal]);

  if (!featuredWorks.length) return null;

  const activeWork = featuredWorks[safeActiveIndex];
  const previousWork = featuredWorks[(safeActiveIndex - 1 + featuredWorks.length) % featuredWorks.length];
  const nextWork = featuredWorks[(safeActiveIndex + 1) % featuredWorks.length];

  const pointerCoordinate = (event) => horizontal ? event.clientX : event.clientY;
  const translate = (value) => horizontal ? `translateX(${value}px)` : `translateY(${value}px)`;

  const handlePointerDown = (event) => {
    if (featuredWorks.length < 2 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    didDrag.current = false;
    dragging.current = true;
    dragStart.current = pointerCoordinate(event);
    dragOffset.current = 0;
    event.currentTarget.style.cursor = 'grabbing';
    event.currentTarget.style.transition = 'none';
  };

  const handlePointerMove = (event) => {
    if (!dragging.current || dragStart.current === null) return;
    const offset = Math.max(-80, Math.min(80, pointerCoordinate(event) - dragStart.current));
    if (Math.abs(offset) > 6) didDrag.current = true;
    dragOffset.current = offset;
    if (panelRef.current) {
      panelRef.current.style.transform = translate(offset);
      panelRef.current.style.opacity = String(Math.max(0.78, 1 - Math.abs(offset) / 320));
    }
  };

  const finishDrag = (event) => {
    if (!dragging.current) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const shouldChange = Math.abs(dragOffset.current) >= 38;
    const direction = dragOffset.current < 0 ? 'next' : 'previous';
    dragging.current = false;
    dragStart.current = null;
    dragOffset.current = 0;
    event.currentTarget.style.cursor = 'grab';
    event.currentTarget.style.transition = 'transform 200ms ease, opacity 200ms ease';
    event.currentTarget.style.transform = translate(0);
    event.currentTarget.style.opacity = '1';
    if (shouldChange) changeWork(direction);
  };

  const activeCard = (
    <div key={`${activeWork.type}-${activeWork.sectionId || 'main'}-${activeWork.itemId}-${safeActiveIndex}`} style={{ animation: 'featured-work-fade 220ms ease-out' }}>
      <button
        type="button"
        onClick={() => {
          if (didDrag.current) {
            didDrag.current = false;
            return;
          }
          onOpenWork?.(activeWork);
        }}
        className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC]"
        data-hint-id="home-featured-work"
        aria-label={`Buka karya ${activeWork.title}`}
      >
        <div className={`${horizontal ? 'h-44 sm:h-52' : 'h-36 xl:h-40'} w-full flex items-center justify-center overflow-hidden rounded-2xl bg-white/80 dark:bg-[#202020]/80 mb-2.5`}>
          {activeWork.image ? (
            <img src={activeWork.image} alt={activeWork.title ? `Pratinjau ${activeWork.title}` : 'Pratinjau karya pilihan'} draggable="false" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono text-[0.6875em] uppercase tracking-[0.18em] text-gray-400">Tanpa Gambar</div>
          )}
        </div>
        <div className={horizontal ? '' : 'min-h-[5.75rem]'}>
          <p className="font-mono text-[0.75em] uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300 mb-1.5">{activeWork.typeLabel}</p>
          <h2 className="text-[1.0625em] sm:text-[1.125em] font-semibold leading-tight text-gray-900 dark:text-white group-hover:text-[#2B579A] dark:group-hover:text-[#6FA8DC] transition-colors overflow-hidden" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{activeWork.title}</h2>
          {activeWork.teaser && <p className="mt-1.5 text-[0.875em] leading-relaxed text-gray-600 dark:text-gray-300 overflow-hidden" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>{activeWork.teaser}</p>}
        </div>
      </button>
    </div>
  );

  return (
    <section
      ref={railRef}
      aria-label="Karya pilihan"
      className={`w-full min-w-0 ${horizontal ? '' : 'h-full overflow-hidden overscroll-contain'}`}
      style={horizontal ? undefined : { overscrollBehavior: 'contain', touchAction: 'none' }}
    >
      <style>{`@keyframes featured-work-fade { from { opacity: .35; } to { opacity: 1; } }`}</style>
      {heading && <p className="mb-3 font-mono text-[0.75em] uppercase tracking-[0.18em] text-gray-600 dark:text-gray-300">{heading}</p>}
      <div
        ref={panelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className={`${featuredWorks.length > 1 ? 'cursor-grab' : ''} select-none will-change-transform`}
        style={{ transform: translate(0), transition: 'transform 200ms ease, opacity 200ms ease', touchAction: horizontal ? 'pan-y' : 'none', overscrollBehavior: 'contain', contain: 'layout paint' }}
      >
        {horizontal ? (
          <div className="grid grid-cols-[minmax(0,1fr)_3.25rem] sm:grid-cols-[minmax(0,1fr)_4.5rem] gap-2.5 items-start overflow-hidden rounded-2xl">
            <div>{activeCard}</div>
            <PreviewImage work={nextWork} className="h-44 sm:h-52 rounded-2xl" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl" data-hint-id="home-carousel-drag">
            {featuredWorks.length > 1 && <PreviewImage work={previousWork} className="h-12 mb-3 rounded-2xl !opacity-15" />}
            {activeCard}
            {featuredWorks.length > 1 && <PreviewImage work={nextWork} className="h-14 mt-3 rounded-2xl !opacity-25" />}
          </div>
        )}
      </div>
    </section>
  );
}

export function FeaturedWorksRail(props) {
  return <FeaturedWorksCarousel {...props} axis="vertical" />;
}

// Desktop rail hidup langsung di document.body agar tidak masuk/menimpa kertas A4.
// Posisi absolute sengaja dipakai: carousel menetap di titik awal kanvas dan
// tertinggal di atas ketika pengguna menggulir halaman.
export function FeaturedWorksRailPortal({
  style,
  darkMode = false,
  helpActive = false,
  ...props
}) {
  if (typeof document === 'undefined' || !style) return null;

  return createPortal(
    <div
      className={`portfolio-rail ${darkMode ? 'dark' : ''} ${helpActive ? 'hint-mode-active' : ''} absolute z-30 overflow-hidden overscroll-contain opacity-80 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100`}
      style={{
        position: 'absolute',
        left: `${style.left}px`,
        width: `${style.width}px`,
        top: `${style.top}px`,
        height: `${style.maxHeight}px`,
        maxHeight: `${style.maxHeight}px`,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        overscrollBehavior: 'contain',
        transform: 'none',
        isolation: 'isolate',
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <FeaturedWorksRail {...props} />
    </div>,
    document.body,
  );
}
