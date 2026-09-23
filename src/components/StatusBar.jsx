
export default function StatusBar({ activePage, wordCount, viewMode, setViewMode, zoomLevel, setZoomLevel, isMobileLayout }) {

  // Pemetaan nomor halaman dinamis berdasarkan tab aktif — TIDAK DIUBAH
  const pageMap = {
    'Home': { current: 1, total: 6 },
    'About': { current: 2, total: 6 },
    'Projects': { current: 3, total: 6 },
    'Career': { current: 4, total: 6 },
    'Book': { current: 5, total: 6 },
    'Contact': { current: 6, total: 6 },
  };

  const currentPageInfo = pageMap[activePage] || { current: 1, total: 6 };
  const currentZoom = zoomLevel || 100;

  const handleZoomOut = () => setZoomLevel && setZoomLevel(Math.max(50, currentZoom - 10));
  const handleZoomIn = () => setZoomLevel && setZoomLevel(Math.min(200, currentZoom + 10));
  const handleZoomSlide = (e) => setZoomLevel && setZoomLevel(Number(e.target.value));

  const ViewIcon = ({ active, title, onClick, children, ...rest }) => (
    <button
      onClick={onClick}
      title={title}
      {...rest}
      className={`p-1 rounded transition-colors ${
        active
          ? 'bg-gray-300/80 dark:bg-gray-600/70'
          : 'hover:bg-gray-300/40 dark:hover:bg-gray-600/40'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="sticky bottom-0 z-50 bg-[#e6e6e6] dark:bg-[#1e1e1e] text-[#444] dark:text-gray-300 flex flex-wrap justify-between items-center px-3 py-1 text-[11px] select-none border-t border-gray-300 dark:border-gray-700">

      {/* Sisi Kiri: info dokumen ala status bar Word asli — disederhanain di layar sempit */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline">Section: 1</span>
        <span>Page {currentPageInfo.current} of {currentPageInfo.total}</span>
        <span>{wordCount} words</span>

        <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 shrink-0 hidden sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 3h9l3 3v15H6z" strokeLinejoin="round" />
          <path d="M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <span className="hidden md:inline-block">Bahasa Indonesia</span>

        <span className="hidden lg:flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 10.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Accessibility: Good to go
        </span>
      </div>

      {/* Sisi Kanan: View mode icons + zoom slider ala Word — di HP disederhanain jadi
          persentase zoom doang (slidernya gak nyaman dipakai jari & gak krusial di HP) */}
      <div className="flex items-center gap-3">

        <div className="hidden sm:flex items-center gap-0.5">
          <ViewIcon active={viewMode === 'read'} onClick={() => setViewMode('read')} title="Read Mode" data-hint-id="statusbar-view-read">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 5c-2-1.3-4.5-2-7-2v14c2.5 0 5 .7 7 2 2-1.3 4.5-2 7-2V3c-2.5 0-5 .7-7 2z" strokeLinejoin="round" />
              <line x1="12" y1="5" x2="12" y2="19" />
            </svg>
          </ViewIcon>
          <ViewIcon active={viewMode === 'print'} onClick={() => setViewMode('print')} title="Print Layout" data-hint-id="statusbar-view-print">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="6" y="3" width="12" height="18" rx="0.5" />
              <line x1="8.5" y1="8" x2="15.5" y2="8" />
              <line x1="8.5" y1="11" x2="15.5" y2="11" />
              <line x1="8.5" y1="14" x2="13" y2="14" />
            </svg>
          </ViewIcon>
          <ViewIcon active={viewMode === 'web'} onClick={() => setViewMode('web')} title="Web Layout" data-hint-id="statusbar-view-web">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="4" width="18" height="16" rx="1" />
              <line x1="3" y1="8" x2="21" y2="8" />
            </svg>
          </ViewIcon>
        </div>

        <div className="hidden sm:block w-px h-4 bg-gray-400/50 dark:bg-gray-600" />

        {isMobileLayout ? (
          // Di HP: dokumen udah fluid & gak di-scale (lihat App.jsx), jadi slider zoom
          // gak relevan lagi — cukup tampilin badge persentase biar gak bikin bingung.
          <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">{currentZoom}%</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <button onClick={handleZoomOut} data-hint-id="statusbar-zoom-out" className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" title="Zoom Out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" /></svg>
            </button>

            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={currentZoom}
              onChange={handleZoomSlide}
              data-hint-id="statusbar-zoom-slider"
              className="w-24 accent-gray-600 dark:accent-gray-300 cursor-pointer"
              title={`Zoom: ${currentZoom}%`}
            />

            <button onClick={handleZoomIn} data-hint-id="statusbar-zoom-in" className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" title="Zoom In">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" /></svg>
            </button>

            <span className="w-9 text-right font-mono">{currentZoom}%</span>
          </div>
        )}

      </div>

    </div>
  );
}
