import { useEffect, useState } from 'react';

const STORAGE_KEY = 'portfolio_language';

export default function LanguageToggle({ language = 'id', onLanguageChange }) {
  const [displayLanguage, setDisplayLanguage] = useState(language === 'en' ? 'en' : 'id');

  useEffect(() => {
    setDisplayLanguage(language === 'en' ? 'en' : 'id');
  }, [language]);
  const toggleLanguage = () => {
    const next = displayLanguage === 'id' ? 'en' : 'id';
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* optional */ }
    setDisplayLanguage(next);
    document.documentElement.lang = next;
    onLanguageChange?.(next);
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      data-hint-id="titlebar-translate"
      data-hint-surface="blue"
      className="notranslate grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/35 bg-white/10 font-mono text-[10px] font-bold uppercase text-white shadow-sm transition-all hover:scale-105 hover:bg-white hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      title={displayLanguage === 'id' ? 'Switch to English' : 'Ubah ke Bahasa Indonesia'}
      aria-label={displayLanguage === 'id' ? 'Switch to English' : 'Ubah ke Bahasa Indonesia'}
      aria-pressed={displayLanguage === 'en'}
    >
      {displayLanguage === 'id' ? 'EN' : 'ID'}
    </button>
  );
}
