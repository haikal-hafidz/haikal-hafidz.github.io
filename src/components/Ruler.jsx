import { useState, useRef } from 'react';

export default function Ruler({ zoomLevel, setZoomLevel }) {
  // zoomLevel: misal 100 (%) sebagai default. 
  // Di rentang ruler kita, angka 10 merepresentasikan 100%.
  // Skala penggaris dari 1 sampai 20 (default 10 = 100%)
  
  const rulerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Hitung posisi persen berdasarkan nilai zoom (10 = 100% -> posisi 50% dari total lebar)
  // Misal rentang angka ruler 1 sampai 20, angka 10 pas di tengah.
  const minZoom = 50;   // 50% (angka 5)
  const maxZoom = 200;  // 200% (angka 20)

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !rulerRef.current) return;
    
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left; // posisi kursor dalam elemen ruler
    const width = rect.width;
    
    // Batasi dalam area ruler (misal padding kiri-kanan 48px)
    const effectiveWidth = width - 96; 
    const relativeX = Math.max(0, Math.min(x - 48, effectiveWidth));
    
    // Petakan posisi pixel ke nilai angka ruler (1 sampai 20) atau langsung zoom (50% - 200%)
    const percentage = relativeX / effectiveWidth;
    const newZoom = Math.round(minZoom + percentage * (maxZoom - minZoom));
    
    if (setZoomLevel) {
      setZoomLevel(newZoom);
    }
  };

  // Tentukan posisi persentase CSS untuk penanda segitiga berdasarkan zoomLevel saat ini
  // Default 100% ada di tengah (angka 10 dari rentang 1-20)
  const currentZoom = zoomLevel || 100;
  const positionPercentage = ((currentZoom - minZoom) / (maxZoom - minZoom)) * 100;

  const rulerNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  return (
    <div 
      ref={rulerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="word-ruler-chrome w-full max-w-[850px] mx-auto bg-[#f2f2f2] dark:bg-[#2d2d2d] border-x border-b border-[#d1d1d1] dark:border-[#404040] h-6 select-none relative flex items-center text-[9px] text-gray-500 dark:text-gray-400 font-sans shadow-sm overflow-hidden"
    >
      
      {/* SISI KIRI & KANAN CONTAINER */}
      <div className="ruler-edge-label absolute left-0 top-0 bottom-0 w-12 bg-[#e6e6e6] dark:bg-[#353535] border-r border-[#d1d1d1] dark:border-[#444] flex items-center justify-center text-[9px] font-mono text-gray-600 dark:text-gray-300">
        {currentZoom}%
      </div>

      {/* SKALA PENGGARIS UTAMA */}
      <div className="flex-1 flex justify-between px-14 h-full items-end pb-[2px] relative">
        {rulerNumbers.map((num) => (
          <div key={num} className="flex flex-col items-center relative h-full justify-end">
            <span className={`ruler-number absolute top-[1px] text-[8px] transform -translate-x-1/2 font-mono ${num === 10 ? 'text-[#2b579a] font-bold dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}>
              {num}
            </span>
            <div className="flex items-end space-x-[2px]">
              <div className={`w-[1px] ${num % 5 === 0 ? 'h-3 bg-gray-500' : 'h-2 bg-gray-400'} dark:bg-gray-500`}></div>
              <div className="w-[1px] h-1 bg-gray-300 dark:bg-gray-600"></div>
              <div className="w-[1px] h-1.5 bg-gray-300 dark:bg-gray-600"></div>
              <div className="w-[1px] h-1 bg-gray-300 dark:bg-gray-600"></div>
            </div>
          </div>
        ))}

        {/* PENANDA SEGITIGA GANDA (SLIDER HANDLE INTERAKTIF) */}
        <div 
          onMouseDown={handleMouseDown}
          style={{ left: `calc(48px + ${positionPercentage}% * 0.85)` }}
          data-hint-id="ruler-zoom-handle"
          className="absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize flex flex-col items-center justify-between z-20 group"
          title={`Zoom: ${currentZoom}% (Geser untuk ubah ukuran)`}
        >
          {/* Segitiga Atas (First Line Indent / Slider Pointer) */}
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-[#2b579a] dark:border-t-blue-400 drop-shadow-sm group-hover:scale-125 transition-transform"></div>
          
          {/* Garis Vertikal Penghubung Slider */}
          <div className="w-[2px] flex-1 bg-[#2b579a] dark:bg-blue-400 my-0.5"></div>

          {/* Segitiga Bawah (Hanging Indent) */}
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-[#2b579a] dark:border-b-blue-400 drop-shadow-sm group-hover:scale-125 transition-transform"></div>
        </div>
      </div>

      <div className="ruler-edge-label absolute right-0 top-0 bottom-0 w-12 bg-[#e6e6e6] dark:bg-[#353535] border-l border-[#d1d1d1] dark:border-[#444] flex items-center justify-center text-[9px] font-mono text-gray-500">
        Zoom
      </div>

    </div>
  );
}
