import { useEffect, useState } from 'react';

const STORAGE_KEY = 'portfolio_language';
const CALLBACK_NAME = 'portfolioGoogleTranslateReady';

function readLanguage() {
  try { return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'id'; }
  catch { return 'id'; }
}

function setTranslateCookie(language) {
  const value = language === 'en' ? '/id/en' : '/id/id';
  const host = window.location.hostname;
  document.cookie = `googtrans=${value};path=/;max-age=31536000;SameSite=Lax`;
  if (host && host !== 'localhost') {
    document.cookie = `googtrans=${value};path=/;domain=.${host};max-age=31536000;SameSite=Lax`;
  }
}

export default function LanguageToggle() {
  const [language, setLanguage] = useState(readLanguage);
  const [ready, setReady] = useState(Boolean(window.google?.translate?.TranslateElement));

  useEffect(() => {
    document.documentElement.lang = language;
    setTranslateCookie(language);

    const initialise = () => {
      if (!window.google?.translate?.TranslateElement) return;
      const mount = document.getElementById('portfolio-google-translate');
      if (mount && !mount.hasChildNodes()) {
        new window.google.translate.TranslateElement({
          pageLanguage: 'id',
          includedLanguages: 'en',
          autoDisplay: false,
        }, 'portfolio-google-translate');
      }
      setReady(true);
    };

    window[CALLBACK_NAME] = initialise;
    if (window.google?.translate?.TranslateElement) initialise();
    else if (!document.getElementById('portfolio-google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'portfolio-google-translate-script';
      script.src = `https://translate.google.com/translate_a/element.js?cb=${CALLBACK_NAME}`;
      script.async = true;
      document.head.appendChild(script);
    }

    return () => { if (window[CALLBACK_NAME] === initialise) delete window[CALLBACK_NAME]; };
  }, [language]);

  const toggleLanguage = () => {
    const next = language === 'id' ? 'en' : 'id';
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* optional */ }
    setTranslateCookie(next);
    setLanguage(next);

    // Google Translate membaca cookie saat bootstrap. Reload membuat seluruh DOM,
    // termasuk halaman/section React yang belum pernah dibuka, memakai bahasa sama.
    window.location.reload();
  };

  return (
    <>
      <div id="portfolio-google-translate" className="portfolio-google-translate" aria-hidden="true" />
      <button
        type="button"
        onClick={toggleLanguage}
        data-hint-id="titlebar-translate"
        data-hint-surface="blue"
        className="notranslate grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/35 bg-white/10 font-mono text-[10px] font-bold uppercase text-white shadow-sm transition-all hover:scale-105 hover:bg-white hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        title={language === 'id' ? 'Switch to English' : 'Ubah ke Bahasa Indonesia'}
        aria-label={language === 'id' ? 'Switch to English' : 'Ubah ke Bahasa Indonesia'}
        aria-pressed={language === 'en'}
      >
        {language === 'id' ? 'EN' : 'ID'}
        {!ready && <span className="sr-only"> — translator loading</span>}
      </button>
    </>
  );
}
