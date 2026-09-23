import { useState } from 'react';

export default function Ribbon({
  activeTab,
  setActiveTab,
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  isBold,
  setIsBold,
  isItalic,
  setIsItalic,
  isUnderline,
  setIsUnderline
}) {
  // Daftar tab navigasi murni sesuai kebutuhan website portofolio lo — TIDAK DIUBAH
  const portfolioTabs = ['Home', 'About', 'Projects', 'Career', 'Book', 'Contact'];

  // State lokal buat tombol-tombol tambahan ala Word (gak ganggu prop dari parent)
  const [isStrike, setIsStrike] = useState(false);
  const [isSub, setIsSub] = useState(false);
  const [isSup, setIsSup] = useState(false);
  const [alignment, setAlignment] = useState('left');
  const [activeStyle, setActiveStyle] = useState('Normal');
  const [showMarks, setShowMarks] = useState(false);
  // Ribbon bisa di-unpin (disembunyiin) biar gak nutupin konten — baris tab tetep
  // kelihatan terus biar orang masih bisa pindah halaman & nampilin ribbon lagi.
  // Selalu mulai tertutup di semua ukuran layar. Setelah visitor menekan pin,
  // state ini tetap hidup saat berpindah navbar dan tidak di-reset oleh resize.
  const [isPinned, setIsPinned] = useState(false);

  const wordFonts = ['Calibri (Body)', 'Garamond', 'Times New Roman', 'Arial', 'Cambria', 'Courier New'];
  const wordSizes = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

  const styleGallery = [
    { key: 'Normal', label: 'Normal', preview: 'AaBbCcD', className: 'text-[12px] font-normal text-gray-800 dark:text-gray-100' },
    { key: 'NoSpacing', label: 'No Spac...', preview: 'AaBbCcD', className: 'text-[12px] font-normal text-gray-800 dark:text-gray-100' },
    { key: 'Heading1', label: 'Heading 1', preview: 'AaBbCc', className: 'text-[14px] font-semibold text-[#2b579a] dark:text-blue-400' },
    { key: 'Heading2', label: 'Heading 2', preview: 'AaBbCc', className: 'text-[14px] font-semibold text-[#2b579a] dark:text-blue-400' },
    { key: 'Title', label: 'Title', preview: 'AaB', className: 'text-[26px] font-bold text-gray-800 dark:text-gray-100 leading-none' },
  ];

  // Ikon panah kecil (dropdown chevron) — dipakai berulang, gantiin karakter unicode biar tajam
  const Chevron = ({ className = 'w-2 h-2' }) => (
    <svg className={className} viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 1l4 3.2L9 1" />
    </svg>
  );

  // Ikon "dialog box launcher" — panah diagonal kecil di pojok tiap grup, ciri khas ribbon Word
  const DialogLauncher = ({ title }) => (
    <button
      title={title}
      className="absolute bottom-[3px] right-0 p-[3px] rounded-sm hover:bg-[#e5f1fb] dark:hover:bg-[#2a3e4c] text-gray-500 dark:text-gray-400"
    >
      <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="1" y="1" width="10" height="10" rx="0.5" />
        <path d="M4 8l4-4M4 4h4v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  // Jangan otomatis menganggap semua tombol Ribbon sebagai fitur website.
  // Mayoritas tombol di toolbar cuma dekorasi ala Word. Hanya kontrol yang
  // secara eksplisit diberi data-hint-id yang boleh disorot oleh mode Help.
  const RibbonButton = ({ onClick, active, title, children, className = '', disabled, ...rest }) => (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      {...rest}
      className={`flex items-center justify-center rounded-[2px] p-[4px] border border-transparent transition-colors text-gray-700 dark:text-gray-200 ${
        active
          ? 'bg-[#c7e0f4] dark:bg-[#0e3a5f] border-[#90c0e8] dark:border-[#1d5a8f] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]'
          : 'hover:bg-[#e5f1fb] hover:border-[#cfe4f7] dark:hover:bg-[#2a3e4c] dark:hover:border-transparent'
      } ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
    >
      {children}
    </button>
  );

  const GroupDivider = () => (
    <div className="w-px self-stretch shrink-0 bg-[#e1e1e1] dark:bg-[#3a3a3a] mx-2 my-1.5" />
  );

  const GroupLabel = ({ children }) => (
    <div className="text-center text-[10.5px] leading-[16px] text-gray-500 dark:text-gray-400 pt-[3px] border-t border-[#e5e5e5] dark:border-[#3a3a3a] mt-auto select-none whitespace-nowrap">
      {children}
    </div>
  );

  const iconStroke = 'text-[#3b3b3b] dark:text-gray-300';

  return (
    <div className="bg-[#f3f3f3] dark:bg-[#252526] border-b border-[#c8c8c8] dark:border-[#333] select-none text-[10pt] text-gray-700 dark:text-gray-200 transition-colors font-sans">

      {/* 1. DERETAN TAB NAVIGASI UTAMA (Murni Menu Portofolio) — solid biru dari ujung ke ujung ala Word asli,
          tab aktif "muncul" putih, tab lain nyatu sama warna biru latar.
          Di layar sempit dibikin scroll horizontal (bukan numpuk/kepotong) biar semua 6 tab tetep bisa dijangkau. */}
      <div className="flex items-center bg-[#2b579a] dark:bg-[#1e3a5f] px-2 pt-1.5 border-b border-black/10">
        <div className="flex flex-1 overflow-x-auto gap-0.5">
          {portfolioTabs.map((tab) => {
            const isCurrent = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                data-hint-id={`navigation-${tab.toLowerCase()}`}
                className={`px-3 sm:px-4 py-1.5 transition-colors font-medium text-[10pt] leading-4 whitespace-nowrap shrink-0 rounded-t-md ${
                  isCurrent
                    ? 'bg-white dark:bg-[#1e1e1e] text-[#2b579a] dark:text-blue-400 shadow-sm'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Tombol Pin/Unpin Ribbon — buat orang yang keganggu ribbon nutupin konten */}
        <button
          onClick={() => setIsPinned((v) => !v)}
          data-hint-id="ribbon-pin-toggle"
          data-hint-surface="blue"
          title={isPinned ? 'Sembunyikan ribbon (unpin)' : 'Tampilkan ribbon (pin)'}
          className="flex items-center gap-1 px-2 py-1 mb-1 rounded border border-white/25 bg-white/10 text-[11px] text-white/90 hover:bg-white/20 hover:border-white/50 hover:text-white transition-colors shrink-0"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${isPinned ? '' : '-rotate-45'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M12 2v6" strokeLinecap="round" />
            <path d="M8 8h8l1.5 5h-11L8 8Z" strokeLinejoin="round" />
            <path d="M12 13v9" strokeLinecap="round" />
          </svg>
          <Chevron className={`w-2 h-2 transition-transform ${isPinned ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* 2. RIBBON TOOLBAR ALA MICROSOFT WORD — disembunyiin total kalau di-unpin */}
      {isPinned && (
      <div className="relative">
        <div className="bg-[#fafafa] dark:bg-[#1e1e1e] px-2 py-1 flex items-stretch gap-0 min-h-[96px] overflow-x-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">

        {/* GRUP: CLIPBOARD */}
        <div className="relative flex flex-col min-w-[92px] shrink-0 pr-4">
          <div className="flex items-stretch gap-1.5 flex-1 pt-1">
            {/* Split button Paste: icon besar + label "Paste" + chevron, dipisah garis tipis */}
            <RibbonButton title="Paste" className="flex-col h-full w-[52px] !p-1 gap-0.5">
              <svg className={`w-7 h-7 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="6" y="4" width="12" height="17" rx="1" />
                <rect x="9" y="2.2" width="6" height="3.6" rx="0.8" fill="currentColor" stroke="none" />
                <line x1="8" y1="11" x2="16" y2="11" />
                <line x1="8" y1="14" x2="16" y2="14" />
                <line x1="8" y1="17" x2="13" y2="17" />
              </svg>
              <div className="w-full border-t border-gray-300/70 dark:border-gray-600 mt-0.5 pt-0.5 flex items-center justify-center gap-0.5">
                <span className="text-[10.5px] leading-none">Paste</span>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </div>
            </RibbonButton>
            <div className="flex flex-col gap-[3px] justify-start pt-0.5">
              <RibbonButton title="Cut" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>
              </RibbonButton>
              <RibbonButton title="Copy" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="11" height="11" rx="1" /><path d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" /></svg>
              </RibbonButton>
              <RibbonButton title="Format Painter" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3h6v4H9z" /><path d="M9 7v4H5a2 2 0 00-2 2v6h6v-4h6v4h6v-6a2 2 0 00-2-2h-4V7" /></svg>
              </RibbonButton>
            </div>
          </div>
          <GroupLabel>Clipboard</GroupLabel>
          <DialogLauncher title="Clipboard options" />
        </div>

        <GroupDivider />

        {/* GRUP: FONT */}
        <div className="relative flex flex-col min-w-[300px] shrink-0 pr-4">
          <div className="flex-1 flex flex-col justify-start gap-[6px] pt-1.5">
            <div className="flex items-center gap-1">
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                data-hint-id="ribbon-font-family"
                className="border border-gray-300 dark:border-gray-600 dark:bg-[#2d2d2d] dark:text-white rounded-[2px] px-1.5 py-[3px] text-[11.5px] w-[130px] focus:outline-none focus:border-[#2b579a] shadow-sm"
              >
                {wordFonts.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                data-hint-id="ribbon-font-size"
                className="border border-gray-300 dark:border-gray-600 dark:bg-[#2d2d2d] dark:text-white rounded-[2px] px-1 py-[3px] text-[11.5px] w-11 focus:outline-none focus:border-[#2b579a] shadow-sm"
              >
                {wordSizes.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <RibbonButton title="Grow Font" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 17l5-11 5 11M4.5 13h7" /><path d="M16 8v7M13 11.5h6" /></svg>
              </RibbonButton>
              <RibbonButton title="Shrink Font" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 17l5-11 5 11M4.5 13h7" /><path d="M13 11.5h6" /></svg>
              </RibbonButton>
            </div>

            <div className="flex items-center gap-[3px]">
              <RibbonButton title="Change Case" className="!p-1 gap-0.5 flex-row">
                <span className="text-[11.5px] leading-none">Aa</span>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </RibbonButton>
              <RibbonButton title="Clear Formatting" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4.5 6h9.5M8 6l2 12M4 20l14-14" /></svg>
              </RibbonButton>

              <div className="w-px h-4 bg-gray-300/70 dark:bg-gray-700 mx-[2px]" />

              <RibbonButton active={isBold} onClick={() => setIsBold(!isBold)} title="Bold (Ctrl+B)" data-hint-id="ribbon-bold" className="!p-1">
                <span className="text-[13px] font-bold w-3.5 text-center leading-none">B</span>
              </RibbonButton>
              <RibbonButton active={isItalic} onClick={() => setIsItalic(!isItalic)} title="Italic (Ctrl+I)" data-hint-id="ribbon-italic" className="!p-1">
                <span className="text-[13px] italic font-serif w-3.5 text-center leading-none">I</span>
              </RibbonButton>
              <RibbonButton active={isUnderline} onClick={() => setIsUnderline(!isUnderline)} title="Underline (Ctrl+U)" data-hint-id="ribbon-underline" className="!p-1 gap-0.5 flex-row">
                <span className="text-[13px] underline w-3 text-center leading-none">U</span>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </RibbonButton>
              <RibbonButton active={isStrike} onClick={() => setIsStrike(!isStrike)} title="Strikethrough" className="!p-1">
                <span className="text-[12px] line-through w-3.5 text-center leading-none">ab</span>
              </RibbonButton>
              <RibbonButton active={isSub} onClick={() => { setIsSub(!isSub); setIsSup(false); }} title="Subscript (Ctrl+=)" className="!p-1">
                <span className="text-[11px] w-4 text-center leading-none">x<sub>2</sub></span>
              </RibbonButton>
              <RibbonButton active={isSup} onClick={() => { setIsSup(!isSup); setIsSub(false); }} title="Superscript (Ctrl+Shift+=)" className="!p-1">
                <span className="text-[11px] w-4 text-center leading-none">x<sup>2</sup></span>
              </RibbonButton>
              <RibbonButton title="Text Highlight Color" className="!p-1 gap-0.5 flex-row">
                <span className="text-[11px] leading-none px-[1px] bg-yellow-300 dark:bg-yellow-500/70 rounded-[1px]">ab</span>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </RibbonButton>
              <RibbonButton title="Font Color" className="!p-1 gap-0 flex-col">
                <span className="text-[12px] font-bold leading-none">A</span>
                <span className="w-3.5 h-[3px] bg-red-600 rounded-[1px] mt-[1px]" />
              </RibbonButton>
            </div>
          </div>
          <GroupLabel>Font</GroupLabel>
          <DialogLauncher title="Font options" />
        </div>

        <GroupDivider />

        {/* GRUP: PARAGRAPH */}
        <div className="relative flex flex-col min-w-[236px] shrink-0 pr-4">
          <div className="flex-1 flex flex-col justify-start gap-[6px] pt-1.5">
            <div className="flex items-center gap-1">
              <RibbonButton title="Bullets" className="!p-1 gap-0.5 flex-row">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="6" r="1.4" /><circle cx="4" cy="12" r="1.4" /><circle cx="4" cy="18" r="1.4" /><rect x="8" y="5.2" width="13" height="1.6" /><rect x="8" y="11.2" width="13" height="1.6" /><rect x="8" y="17.2" width="13" height="1.6" /></svg>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </RibbonButton>
              <RibbonButton title="Numbering" className="!p-1 gap-0.5 flex-row">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="currentColor"><text x="0.5" y="7.5" fontSize="6.5" stroke="none">1.</text><text x="0.5" y="14.5" fontSize="6.5" stroke="none">2.</text><text x="0.5" y="21.5" fontSize="6.5" stroke="none">3.</text><rect x="8" y="5.2" width="13" height="1.6" /><rect x="8" y="11.2" width="13" height="1.6" /><rect x="8" y="17.2" width="13" height="1.6" /></svg>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </RibbonButton>
              <RibbonButton title="Multilevel List" className="!p-1 gap-0.5 flex-row">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="3" y1="5" x2="18" y2="5" /><line x1="6" y1="11" x2="20" y2="11" /><line x1="9" y1="17" x2="20" y2="17" /></svg>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </RibbonButton>
              <div className="w-px h-4 bg-gray-300/70 dark:bg-gray-700 mx-[2px]" />
              <RibbonButton title="Decrease Indent" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 6l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" /><line x1="10" y1="6" x2="20" y2="6" /><line x1="14" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /></svg>
              </RibbonButton>
              <RibbonButton title="Increase Indent" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /><line x1="10" y1="6" x2="20" y2="6" /><line x1="14" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /></svg>
              </RibbonButton>
              <RibbonButton title="Sort" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 4v16M6 4l-3 3M6 4l3 3" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 6h6M14 12h4M14 18h2" /></svg>
              </RibbonButton>
              <RibbonButton active={showMarks} onClick={() => setShowMarks(!showMarks)} title="Show/Hide ¶" className="!p-1">
                <span className="text-[13px] leading-none w-3.5 text-center">¶</span>
              </RibbonButton>
            </div>

            <div className="flex items-center gap-1">
              <RibbonButton active={alignment === 'left'} onClick={() => setAlignment('left')} title="Align Left (Ctrl+L)" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="1.8" /><rect x="3" y="10.5" width="12" height="1.8" /><rect x="3" y="16" width="15" height="1.8" /></svg>
              </RibbonButton>
              <RibbonButton active={alignment === 'center'} onClick={() => setAlignment('center')} title="Center (Ctrl+E)" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="1.8" /><rect x="6" y="10.5" width="12" height="1.8" /><rect x="4.5" y="16" width="15" height="1.8" /></svg>
              </RibbonButton>
              <RibbonButton active={alignment === 'right'} onClick={() => setAlignment('right')} title="Align Right (Ctrl+R)" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="1.8" /><rect x="9" y="10.5" width="12" height="1.8" /><rect x="6" y="16" width="15" height="1.8" /></svg>
              </RibbonButton>
              <RibbonButton active={alignment === 'justify'} onClick={() => setAlignment('justify')} title="Justify (Ctrl+J)" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="18" height="1.8" /><rect x="3" y="10.5" width="18" height="1.8" /><rect x="3" y="16" width="18" height="1.8" /></svg>
              </RibbonButton>
              <RibbonButton title="Line and Paragraph Spacing" className="!p-1">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3v18M7 3l-2.5 2.5M7 3l2.5 2.5M7 21l-2.5-2.5M7 21l2.5-2.5" strokeLinecap="round" strokeLinejoin="round" /><line x1="12" y1="6" x2="20" y2="6" /><line x1="12" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" /></svg>
              </RibbonButton>
              <RibbonButton title="Shading" className="!p-1 gap-0.5 flex-row">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" opacity="0.5" /></svg>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </RibbonButton>
              <RibbonButton title="Borders" className="!p-1 gap-0.5 flex-row">
                <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
                <Chevron className="w-1.5 h-1.5 text-gray-500" />
              </RibbonButton>
            </div>
          </div>
          <GroupLabel>Paragraph</GroupLabel>
          <DialogLauncher title="Paragraph options" />
        </div>

        <GroupDivider />

        {/* GRUP: STYLES */}
        <div className="relative flex flex-col min-w-[380px] shrink-0 pr-4">
          <div className="flex-1 flex items-stretch gap-[3px] pt-2 overflow-x-auto">
            {styleGallery.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveStyle(s.key)}
                title={s.label}
                className={`flex flex-col items-center justify-center px-3 py-1 rounded-[2px] border min-w-[70px] transition-colors bg-white dark:bg-[#252526] ${
                  activeStyle === s.key
                    ? 'border-[#2b579a] ring-1 ring-[#2b579a] bg-[#e5f1fb] dark:bg-[#0e3a5f]'
                    : 'border-gray-300/60 dark:border-gray-700 hover:border-[#2b579a] hover:bg-[#f4f9fe] dark:hover:bg-[#2a2a2a]'
                }`}
              >
                <span className={s.className}>{s.preview}</span>
                <span className="text-[9.5px] text-gray-600 dark:text-gray-300 mt-0.5 whitespace-nowrap">{s.label}</span>
              </button>
            ))}
            <div className="flex flex-col justify-center gap-[2px] pl-1">
              <button title="Scroll up" className="p-[2px] hover:bg-[#e5f1fb] dark:hover:bg-[#2a3e4c] rounded-sm text-gray-500">
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 5l4-3.2L9 5" /></svg>
              </button>
              <button title="Scroll down" className="p-[2px] hover:bg-[#e5f1fb] dark:hover:bg-[#2a3e4c] rounded-sm text-gray-500">
                <Chevron className="w-2.5 h-2.5" />
              </button>
              <button title="More Styles" className="p-[2px] hover:bg-[#e5f1fb] dark:hover:bg-[#2a3e4c] rounded-sm text-gray-500">
                <svg className="w-2.5 h-2.5" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="2" y1="1.5" x2="10" y2="1.5" /><path d="M1 6l5-4.5L11 6" /></svg>
              </button>
            </div>
          </div>
          <GroupLabel>Styles</GroupLabel>
          <DialogLauncher title="Styles pane" />
        </div>

        <GroupDivider />

        {/* GRUP: EDITING */}
        <div className="flex flex-col min-w-[104px] shrink-0 pr-1">
          <div className="flex-1 flex flex-col justify-start gap-[3px] pt-1.5">
            <RibbonButton title="Find (Ctrl+F)" className="!p-1 justify-start gap-1.5 flex-row px-1.5">
              <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" /></svg>
              <span className="text-[11.5px]">Find</span>
            </RibbonButton>
            <RibbonButton title="Replace (Ctrl+H)" className="!p-1 justify-start gap-1.5 flex-row px-1.5">
              <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4v6h6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 10a8 8 0 00-14-5" /><path d="M4 14a8 8 0 0014 5" /></svg>
              <span className="text-[11.5px]">Replace</span>
            </RibbonButton>
            <RibbonButton title="Select" className="!p-1 justify-start gap-1.5 flex-row px-1.5">
              <svg className={`w-3.5 h-3.5 ${iconStroke}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l7 16 2-7 7-2z" strokeLinejoin="round" /></svg>
              <span className="text-[11.5px]">Select</span>
              <Chevron className="w-1.5 h-1.5 text-gray-500 ml-auto" />
            </RibbonButton>
          </div>
          <GroupLabel>Editing</GroupLabel>
        </div>

        <GroupDivider />

        {/* Info status aktif dari state asli komponen */}
        <div className="flex flex-col justify-center text-gray-500 dark:text-gray-400 text-[11px] space-y-1 pl-2 shrink-0 min-w-[150px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Tab Aktif: <strong className="text-gray-700 dark:text-gray-200">{activeTab}</strong></span>
          </div>
          <div className="text-[10px] text-gray-400">
            Font: <span className="font-semibold">{fontFamily}</span> ({fontSize}pt)
          </div>
        </div>

      </div>
      </div>
      )}
    </div>
  );
}
