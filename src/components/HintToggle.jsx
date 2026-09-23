
// Tombol "Hint" — GANTI TOTAL dari GuidanceNote.jsx yang lama (kotak teks statis).
// Sekarang konsepnya: nempel di pojok KIRI BAWAH, di luar kertas A4 (SENGAJA dipindah
// dari kiri atas — di atas situ udah penuh sama TitleBar/Ribbon/Ruler yang sticky &
// gampang numpuk-nampuk z-index). Posisinya digeser `bottom-12` (bukan `bottom-4`
// polos) biar ada jarak aman dari StatusBar yang nempel di paling bawah viewport —
// kalau dipepetin ke bottom-4 dia numpuk sama StatusBar. Pas diklik dia TOGGLE mode
// hint on/off. Pas mode hint AKTIF, semua elemen interaktif yang ditandai
// `data-hint-id="..."` di halaman yang lagi kebuka bakal blink/pulse otomatis lewat
// CSS global (lihat App.jsx, class `.hint-mode-active`).
//
// Kenapa gak perlu daftar/registry manual per tab: karena yang di-scan itu DOM yang
// LAGI kerender (activeTab yang lagi kebuka), jadi otomatis "tau" elemen mana yang
// relevan tanpa perlu logic tambahan. Elemen dinamis dari CMS (mis. nama perusahaan
// di Career) tinggal dikasih `data-hint-id` bersyarat sesuai field `hintEnabled` dari
// data itemnya masing-masing.
//
// Sama kayak GuidanceNote lama: disembunyiin di HP (gak ada ruang) & pas Admin Mode,
// dan posisinya `fixed` relatif ke viewport asli — makanya dipasang di App.jsx DI LUAR
// div kertas yang punya `transform: scale` pas zoom.
export default function HintToggle({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? 'Matikan mode hint' : 'Tunjukkan apa aja yang bisa diklik'}
      style={{ position: 'fixed', left: '12px', right: 'auto', top: 'auto', bottom: '48px', width: 'auto', height: 'auto' }}
      className={`portfolio-help-toggle flex z-[90] items-center gap-1.5 p-2 sm:pl-2.5 sm:pr-3 sm:py-2 rounded-full border shadow-lg font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
        active
          ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
          : 'bg-white dark:bg-[#202020] border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-800'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5 shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-1.5c0-.9.5-1.4 1.2-1.9.8-.6 1.3-1.3 1.3-2.3A2.5 2.5 0 0 0 12 7.8a2.5 2.5 0 0 0-2.5 2.5" strokeLinecap="round" />
        <circle cx="12" cy="17.6" r="0.6" fill="currentColor" stroke="none" />
      </svg>
      <span className="hidden sm:inline">{active ? 'Help On' : 'Help'}</span>
    </button>
  );
}
