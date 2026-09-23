// src/App.jsx
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { initialPortfolioData } from './cms/CmsData';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
import { initAnalytics, trackPageView } from './lib/analytics';
import { setPageMeta, setSiteIdentity } from './lib/pageMeta';

// Import Komponen Halaman Publik
import Home from './pages/Home';
import { FeaturedWorksRailPortal } from './components/FeaturedWorksCarousel';
import LastFmFootnote from './components/LastFmFootnote';
import VisitorIntroduction from './components/VisitorIntroduction';
import { normalizeVisitorIntroduction } from './lib/visitorIntroductionData';
import About, { AboutNotesPortal } from './pages/About';
import Career from './pages/Career';
import Book from './pages/Book';
import Projects from './pages/Projects';
import Contact from './pages/Contact';

// Import Komponen Ala Microsoft Word & CMS
import TitleBar from './components/TitleBar';
import Ribbon from './components/Ribbon';
import Ruler from './components/Ruler';
import StatusBar from './components/StatusBar';
import WelcomeToast from './components/WelcomeToast';
import HintToggle from './components/HintToggle';
import DocumentLoader from './components/DocumentLoader';

// CMS tidak dibutuhkan pengunjung halaman publik. Pisahkan chunk-nya supaya membuka
// Home/Projects tidak ikut mengunduh seluruh editor dan utilitas admin.
const CmsDashboard = lazy(() => import('./cms/CmsDashboard'));

// Menghitung total kata secara rekursif dari objek/array data apapun (dipakai untuk word count di StatusBar)
function countWords(value) {
  if (value == null) return 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countWords(item), 0);
  }
  if (typeof value === 'object') {
    return Object.values(value).reduce((sum, v) => sum + countWords(v), 0);
  }
  return 0;
}

// Email login admin disimpan di environment variable supaya identitas akun CMS tidak
// tercecer di source file. Ini bukan rahasia absolut (semua VITE_* ikut masuk bundle),
// tetapi memudahkan rotasi akun tanpa mengedit App.jsx. Otorisasi sebenarnya tetap
// dilakukan oleh Supabase Auth + RLS berbasis user UUID di database.
const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();

// Skala dasar tampilan dokumen KHUSUS DESKTOP — ini "zoom out by system" yang diminta,
// TERPISAH dari slider zoom manual di StatusBar/Ruler (itu tetep nunjuk 50-200%, defaultnya 100%).
// Angka render final = (zoomLevel dari slider / 100) dikali BASE_VIEW_SCALE ini.
// Di HP, skala ini SENGAJA GAK DIPAKAI (lihat isMobileLayout di bawah) — dokumen dibikin
// full-width & fluid, bukan ala "kertas Word" yang di-scale-down, karena itu yang bikin
// tampilan HP berantakan.
const BASE_VIEW_SCALE = 0.9;

// Ukuran pt default fontSize (dipakai sebagai nilai awal state `fontSize`, BUKAN lagi
// dipakai buat itung faktor scale/zoom — lihat catatan di bawah).
//
// CATATAN SEJARAH (biar gak keulang lagi kalau ada yang nyoba "benerin" ini balik lagi):
// Dulu nilai pt dari Ribbon diterjemahin jadi faktor `transform: scale(...)` yang digabung
// ke transform zoom di bawah. Itu SALAH — efeknya beneran cuma kayak nge-zoom seluruh
// kertas (gambar, spacing, border ikut membesar/mengecil semua), BUKAN beneran ngubah
// ukuran huruf doang. Sekarang pendekatannya: fontSize dipasang murni lewat inline style
// `fontSize: ${fontSize}pt` di pembungkus dokumen, dan supaya itu beneran nembus ke teks
// di dalam Home/About/Career/dst, semua class ukuran teks Tailwind di halaman-halaman itu
// udah dikonversi dari `rem` (text-sm, text-2xl, dst — yang SELALU ngikut <html> root, gak
// peduli pembungkusnya) ke `em` arbitrary value (text-[0.875em], dst — yang ngikut font-size
// elemen pembungkus terdekat). Jadi sekarang: geser slider font size = teks membesar &
// reflow, layout/gambar/lebar kertas tetep. Geser slider Zoom (Ruler) = baru itu yang
// beneran scale seluruh kertas.
const FONT_SIZE_BASELINE_PT = 12;

// Breakpoint bawah dari sini dianggap "HP" — dipakai buat matiin efek kertas Word,
// sembunyiin Ruler, dan nyederhanain TitleBar/StatusBar secara OTOMATIS (bukan manual toggle).
const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)';

// ID baris tetap di tabel `portfolio` — kita cuma pakai 1 baris yang terus di-update.
const PORTFOLIO_ROW_ID = 1;

// Default & jaring pengaman buat field `general` — SAMA PERSIS kayak yang ada di
// CmsDashboard.jsx (DEFAULT_GENERAL / normalizeGeneral di sana). Ini WAJIB
// dipasang juga di sini (bukan cuma di form edit CMS-nya), soalnya kalau baris di
// Supabase belum punya field `general` sama sekali (mis. data lama dari sebelum
// field ini ditambahin), tanpa normalisasi ini `portfolioData.general` bakal
// `undefined` → WelcomeToast nganggep `enabled` juga `undefined` (falsy) → info
// patch-nya gak pernah muncul di halaman publik, PADAHAL di CMS Dashboard
// toggle-nya keliatan "Aktif" (karena normalisasi versi CmsDashboard cuma dipakai
// buat form edit-nya doang, gak nembus ke sini).
const DEFAULT_GENERAL = {
  welcomeNotification: {
    enabled: true,
    version: '1.0.0',
    title: 'Update terbaru',
    message: 'Catatan perubahan terbaru portofolio akan muncul di sini.',
    delaySeconds: 2,
  },
  soundEffects: true,
};
const normalizeGeneral = (raw) => ({
  soundEffects: raw?.soundEffects !== false,
  welcomeNotification: {
    ...DEFAULT_GENERAL.welcomeNotification,
    ...(raw?.welcomeNotification || {}),
  },
});

const EMPTY_FEATURED_WORK = { type: '', itemId: '', sectionId: '', teaser: '' };
const DEFAULT_DYNAMIC_STATEMENT = {
  enabled: true,
  prefix: 'Gue',
  highlightedWord: 'mengubah',
  connector: 'menjadi',
  size: 'large',
  speed: 'normal',
  pauseDuration: 2700,
  pairs: [
    { source: 'pengamatan', result: 'cerita' },
    { source: 'keruwetan', result: 'esai' },
    { source: 'gagasan mentah', result: 'naskah' },
    { source: 'momen biasa', result: 'cerita visual' },
  ],
};
const DEFAULT_HOME_EXPERIENCE = {
  enabled: true,
  cursorHint: 'Click to interrupt',
  choicePrompt: 'Mau main atau membawa pulang sesuatu?',
  signatureRole: 'Writer & Editor',
  dialogue: [
    { prompt: 'Eh—lo sadar gue ada di sini?', yes: 'Sadar.', no: 'Baru sadar.' },
    { prompt: 'Bagus. Gue menyimpan dua jalan kecil di dokumen ini.', yes: 'Tunjukin.', no: 'Tetap tunjukin.' },
  ],
};
const DEFAULT_ZINE = { enabled: true, menuLabel: 'Wassup?', title: 'Write one. Receive one.', writePrompt: 'Tulis sesuatu yang layak ditemukan orang lain…', submitSuccess: 'Tulisan tersimpan. Publikasi dilakukan setelah melewati kurasi.', maxLength: 1200, entries: [] };
const DEFAULT_MINI_GAME = {
  enabled: true,
  menuLabel: 'Mini Game',
  libraryTitle: 'Choose a desk.',
  libraryDescription: 'Pilih satu meja kerja. Setiap permainan menguji bagian berbeda dari proses mengubah gagasan mentah menjadi naskah.',
  gameName: 'The Red Pen',
  gameCategory: 'Editorial',
  gameCardDescription: 'Temukan bagian yang janggal, ambigu, dan tidak efektif sebelum draft dikirim.',
  showInLibrary: true,
  illustration: '',
  title: 'Inspect the unfinished draft.',
  objective: 'Lima draft belum selesai menunggu meja editor. Temukan bagian yang janggal, bertele-tele, ambigu, atau tidak efektif sebelum waktunya habis.',
  rules: { click: 'Klik atau tap kata/frasa bermasalah.', timer: 'Tiap draft punya waktu 60 detik.', wrong: 'Pilihan salah menurunkan akurasi dan skor.', hint: 'Satu hint tersedia untuk seluruh sesi.', review: 'Seusai tiap draft, baca alasan editorialnya—waktu berhenti saat review.' },
  startButtonLabel: 'Mulai Mengedit',
  secondsPerDraft: 60,
  draftsPerSession: 5,
  scoreSettings: { correctPoints: 100, wrongPenalty: 25, completionBonus: 100, maxTimeBonus: 100, hintPenalty: 75 },
  gradeTitles: [{ min: 90, label: 'Senior Red Pen' }, { min: 75, label: 'Sharp-eyed Editor' }, { min: 55, label: 'Promising Proofreader' }, { min: 0, label: 'Draft Survivor' }],
  resultEyebrow: 'Final editorial report',
  replayLabel: 'Main lagi',
  projectsCtaLabel: 'Lihat tulisan Haikal',
  contactCtaLabel: 'Hubungi Haikal',
  gameSlots: [],
  drafts: initialPortfolioData.miniGame?.drafts || [],
};
const normalizeFeaturedWorks = (raw) =>
  (Array.isArray(raw) ? raw : []).slice(0, 5).map((item) => ({
    ...EMPTY_FEATURED_WORK,
    ...(item || {}),
  }));

const normalizeHome = (raw) => ({
  ...(raw || {}),
  dynamicStatement: {
    ...DEFAULT_DYNAMIC_STATEMENT,
    ...(raw?.dynamicStatement || {}),
    pairs: Array.isArray(raw?.dynamicStatement?.pairs)
      ? raw.dynamicStatement.pairs.slice(0, 8)
      : DEFAULT_DYNAMIC_STATEMENT.pairs,
  },
  featuredWorksHeading: raw?.featuredWorksHeading ?? 'Pilihan Karya',
  featuredWorks: normalizeFeaturedWorks(raw?.featuredWorks),
  experience: {
    ...DEFAULT_HOME_EXPERIENCE,
    ...(raw?.experience || {}),
    dialogue: Array.isArray(raw?.experience?.dialogue) && raw.experience.dialogue.length ? raw.experience.dialogue : DEFAULT_HOME_EXPERIENCE.dialogue,
  },
  visitorIntroduction: normalizeVisitorIntroduction(raw?.visitorIntroduction),
});

const normalizeZine = (raw) => ({ ...DEFAULT_ZINE, ...(raw || {}), entries: Array.isArray(raw?.entries) ? raw.entries : [] });
const normalizeMiniGame = (raw) => ({
  ...DEFAULT_MINI_GAME,
  ...(raw || {}),
  rules: { ...DEFAULT_MINI_GAME.rules, ...(raw?.rules || {}) },
  scoreSettings: { ...DEFAULT_MINI_GAME.scoreSettings, ...(raw?.scoreSettings || {}) },
  gradeTitles: Array.isArray(raw?.gradeTitles) && raw.gradeTitles.length ? raw.gradeTitles : DEFAULT_MINI_GAME.gradeTitles,
  gameSlots: Array.isArray(raw?.gameSlots) ? raw.gameSlots.map((slot) => ({ showInLibrary: false, illustration: '', ...slot })) : [],
  drafts: Array.isArray(raw?.drafts)
    ? raw.drafts.map((draft) => ({ ...draft, issues: Array.isArray(draft?.issues) ? draft.issues : [] }))
    : DEFAULT_MINI_GAME.drafts,
});

const DEFAULT_AUTHOR_PROPERTIES = {
  enabled: true,
  buttonLabel: 'View author properties…',
  panelTitle: 'Author Properties',
  lastRevised: '',
  items: [
    { id: 'author-status', label: 'Status', value: 'Mid-river / Still becoming', url: '' },
    { id: 'author-based-in', label: 'Based in', value: 'Batam, Indonesia', url: '' },
    { id: 'author-writing', label: 'Currently writing', value: '', url: '' },
    { id: 'author-reading', label: 'Currently reading', value: '', url: '' },
    { id: 'author-soundtrack', label: 'Current soundtrack', value: '', url: '' },
    { id: 'author-fixation', label: 'Current fixation', value: '', url: '' },
    { id: 'author-conditions', label: 'Works best when', value: '', url: '' },
  ],
};

const DEFAULT_LISTENING_FOOTNOTE = {
  enabled: true,
  username: '',
  nowPlayingLabel: 'Playing while editing',
  lastPlayedLabel: 'Last heard',
  fallbackLabel: 'On repeat lately',
  fallbackTitle: '',
  fallbackArtist: '',
  fallbackImage: '',
  fallbackUrl: '',
};

const normalizeAbout = (raw) => ({
  ...(raw || {}),
  authorProperties: {
    ...DEFAULT_AUTHOR_PROPERTIES,
    ...(raw?.authorProperties || {}),
    items: Array.isArray(raw?.authorProperties?.items)
      ? raw.authorProperties.items
      : DEFAULT_AUTHOR_PROPERTIES.items,
  },
  listeningFootnote: {
    ...DEFAULT_LISTENING_FOOTNOTE,
    ...(raw?.listeningFootnote || {}),
  },
});

export default function App() {
  const desktopStageRef = useRef(null);
  const desktopPageRef = useRef(null);
  const [desktopRailStyle, setDesktopRailStyle] = useState(null);
  const [desktopLeftRailStyle, setDesktopLeftRailStyle] = useState(null);
  const [railPrintedTab, setRailPrintedTab] = useState(null);
  const railPrintTimerRef = useRef(null);
  const [portfolioData, setPortfolioData] = useState(initialPortfolioData);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const audioContextRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('portfolio_sound') !== 'off'; } catch { return true; }
  });

  const getAudioContext = useCallback(() => {
    if (!soundEnabled) return null;
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
      return audioContextRef.current;
    } catch { return null; }
  }, [soundEnabled]);

  const playMechanicalSound = useCallback(() => {
    const context = getAudioContext();
    if (!context) return;
    const play = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(145, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(85, context.currentTime + 0.035);
      gain.gain.setValueAtTime(0.018, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.045);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.05);
    };
    if (context.state === 'suspended') context.resume().then(play).catch(() => {});
    else play();
  }, [getAudioContext]);

  useEffect(() => {
    try { localStorage.setItem('portfolio_sound', soundEnabled ? 'on' : 'off'); } catch { /* optional */ }
  }, [soundEnabled]);

  useEffect(() => {
    if (!soundEnabled || portfolioData.general?.soundEffects === false) return undefined;
    const onPointerDown = (event) => {
      if (event.target.closest('[data-printer-action="true"]')) return;
      if (event.target.closest('button, a, [role="button"], select, input[type="checkbox"]')) playMechanicalSound();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [soundEnabled, portfolioData.general?.soundEffects, playMechanicalSound]);

  // Dua syarat yang HARUS dua-duanya kepenuhin sebelum layar loading (PelicanLoader)
  // ditutup: (1) data dari Supabase udah kelar diambil, (2) pesan di splash-nya
  // udah kelar diketik + jeda baca-nya (lihat prop `holdAfterMs` di PelicanLoader)
  // udah kelewat. Jadi walau fetch-nya kenceng banget, tetep nunggu pesannya
  // "tersampaikan" dulu — dan walau fetch-nya lambat, teksnya juga gak keburu
  // hilang sebelum data selesai disiapin.
  const [isDataReady, setIsDataReady] = useState(false);
  const [isSplashDone, setIsSplashDone] = useState(false);
  useEffect(() => {
    if (isDataReady && isSplashDone) {
      setIsLoading(false);
    }
  }, [isDataReady, isSplashDone]);

  // Splash tetap sempat terlihat sebagai bagian dari identitas visual website, tetapi
  // jangan sampai animasi mengetiknya menahan konten utama dan memperburuk LCP.
  // Callback DocumentLoader tetap boleh menyelesaikannya lebih cepat; timer ini hanya
  // menjadi batas maksimum penantian di perangkat atau jaringan yang lebih lambat.
  useEffect(() => {
    const splashDeadline = window.setTimeout(() => setIsSplashDone(true), 900);
    return () => window.clearTimeout(splashDeadline);
  }, []);

  // Ambil data dari Supabase sekali pas app pertama kali dibuka.
  // Ini yang bikin data konsisten di semua device/browser/akun — bukan lagi localStorage.
  useEffect(() => {
    let ignore = false;

    async function loadPortfolioData() {
      if (!isSupabaseConfigured) {
        setLoadError('Konten live belum terhubung. Menampilkan salinan lokal.');
        setPortfolioData(initialPortfolioData);
        setIsDataReady(true);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('portfolio')
          .select('data')
          .eq('id', PORTFOLIO_ROW_ID)
          .single();

        if (ignore) return;

        if (error) {
          console.error('Gagal ambil data dari Supabase:', error);
          setLoadError(
            'Gagal konek ke server. Pastikan .env sudah diisi & tabel "portfolio" sudah dibikin. ' +
            'Sementara nampilin data default.'
          );
          setPortfolioData(initialPortfolioData);
        } else if (data?.data && Object.keys(data.data).length > 0) {
          setPortfolioData({
            ...data.data,
            home: normalizeHome(data.data.home),
            about: normalizeAbout(data.data.about),
            zine: normalizeZine(data.data.zine),
            miniGame: normalizeMiniGame(data.data.miniGame),
            general: normalizeGeneral(data.data.general),
          });
        } else {
          // Baris ada tapi masih kosong (baru setup) → pakai default template.
          setPortfolioData(initialPortfolioData);
        }
      } catch (err) {
        // Beda dari `error` di atas (yang di-return rapi sama Supabase) — ini nangkep
        // kegagalan yang beneran nge-throw (mis. .env belum keisi/salah, client gagal
        // ke-init, network putus total). TANPA try/catch ini, exception di atas bakal
        // ngehentiin fungsi ini di tengah jalan SEBELUM sempet manggil setIsDataReady,
        // yang bikin isLoading nyangkut `true` selamanya — splash loading gak akan
        // pernah ketutup, dan semua yang di bawahnya (termasuk WelcomeToast) gak akan
        // pernah sempet dirender sama sekali.
        if (ignore) return;
        console.error('Gagal ambil data dari Supabase (exception):', err);
        setLoadError(
          'Gagal konek ke server. Pastikan .env sudah diisi & tabel "portfolio" sudah dibikin. ' +
          'Sementara nampilin data default.'
        );
        setPortfolioData(initialPortfolioData);
      } finally {
        if (!ignore) setIsDataReady(true);
      }
    }

    loadPortfolioData();
    return () => { ignore = true; };
  }, []);

  // Dipanggil dari CmsDashboard pas admin klik "Save Changes".
  // Return true/false biar CmsDashboard tau apakah save-nya berhasil.
  const savePortfolioData = async (newData) => {
    setSaveError(null);
    const { error } = await supabase
      .from('portfolio')
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq('id', PORTFOLIO_ROW_ID);

    if (error) {
      console.error('Gagal simpan ke Supabase:', error);
      setSaveError('Gagal simpan perubahan ke server. Cek koneksi internet lo & coba lagi.');
      return false;
    }

    setPortfolioData(newData);
    return true;
  };

  // Baca deep-link dari URL pas app pertama kali dibuka (mis. ?tab=Projects&article=art-1),
  // dipakai buat fitur Share artikel — biar link yang di-share beneran ngarah ke artikel
  // yang dimaksud, bukan cuma mendarat di Home. `initialArticleId` diteruskan ke Projects.jsx.
  const VALID_TABS = ['Home', 'About', 'Projects', 'Career', 'Book', 'Contact'];
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const urlTab = urlParams?.get('tab');
  const initialArticleId = urlParams?.get('article') || null;

  const [activeTab, setActiveTab] = useState(
    VALID_TABS.includes(urlTab) ? urlTab : 'Home'
  );
  const openPrintedTab = useCallback((tab) => {
    if (railPrintTimerRef.current) window.clearTimeout(railPrintTimerRef.current);
    setRailPrintedTab(tab);
    setActiveTab(tab);
    railPrintTimerRef.current = window.setTimeout(() => {
      setRailPrintedTab(null);
      railPrintTimerRef.current = null;
    }, 680);
  }, []);

  useEffect(() => () => {
    if (railPrintTimerRef.current) window.clearTimeout(railPrintTimerRef.current);
  }, []);

  const [workNavigation, setWorkNavigation] = useState(null);

  // Satukan pilihan carousel dengan data karya aslinya. Home cuma menyimpan pilihan
  // item + teaser; judul, gambar, dan jenis output selalu mengikuti sumbernya.
  const featuredWorks = useMemo(() => normalizeFeaturedWorks(portfolioData.home?.featuredWorks)
    .map((entry) => {
      let source = null;
      if (entry.type === 'book') {
        source = portfolioData.books?.items?.find((item) => item.id === entry.itemId);
      } else if (entry.type === 'article') {
        source = portfolioData.projects?.articles?.find((item) => item.id === entry.itemId);
      } else if (entry.type === 'directing') {
        source = portfolioData.projects?.directing?.items?.find((item) => item.id === entry.itemId);
      } else if (entry.type === 'poster') {
        source = portfolioData.projects?.poster?.items?.find((item) => item.id === entry.itemId);
      } else if (entry.type === 'custom') {
        const section = portfolioData.projects?.customSections?.find((item) => item.id === entry.sectionId);
        source = section?.items?.find((item) => item.id === entry.itemId);
      }

      if (!source) return null;
      return {
        ...entry,
        title: source.title,
        image: entry.type === 'book' ? source.coverImage : (entry.type === 'article' ? source.image : entry.type === 'directing' ? source.posterImage : source.imageUrl),
        typeLabel: source.category || (entry.type === 'book' ? 'Book' : entry.type === 'article' ? 'Article' : entry.type === 'directing' ? 'Directing' : entry.type === 'poster' ? 'Poster' : 'Project'),
        teaser: entry.teaser || source.summary || source.snippet || source.premise || source.description || '',
      };
    })
    .filter(Boolean), [portfolioData]);

  const openFeaturedWork = (work) => {
    setWorkNavigation({ ...work, requestKey: Date.now() });
    setActiveTab(work.type === 'book' ? 'Book' : 'Projects');
  };

  // Begitu tab/article dari deep-link kepake buat nentuin tampilan awal, langsung bersihin
  // URL-nya balik ke root (tanpa reload) pake history.replaceState. Ini SENGAJA dilakukan
  // biar kalau visitor nge-bookmark / save-to-home-screen / browser-nya autocomplete ke
  // URL itu lagi nanti, yang ke-save udah URL polos — bukan nyangkut permanen di tab
  // artikel yang pernah di-share. Fitur share artikel sendiri TETEP jalan normal (link-nya
  // masih valid sekali buka), ini cuma nyegah dia "nempel" jadi default buat kunjungan
  // berikutnya.
  useEffect(() => {
    if (urlTab || initialArticleId) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [initialArticleId, urlTab]);

  // Nyalain Google Analytics (GA4) sekali pas app pertama kali kebuka — otomatis gak
  // ngapa-ngapain kalau .env belum diisi VITE_GA_MEASUREMENT_ID (lihat src/lib/analytics.js).
  useEffect(() => {
    initAnalytics();
  }, []);

  const [darkMode, setDarkMode] = useState(false);
  const [isAdminMode, setIsAdminModeRaw] = useState(false);

  // Status login admin SEKARANG ngikutin session Supabase Auth yang beneran (JWT
  // tervalidasi server), BUKAN lagi sessionStorage flag polos yang dulu ada di sini.
  // Dulu itu gampang di-bypass: buka console browser, ketik
  // `sessionStorage.setItem('cms_admin_authed', 'true')`, refresh — langsung masuk
  // admin tanpa password sama sekali, karena "otentikasi"-nya cuma nge-cek string di
  // JS. Supabase-js otomatis nyimpen & nge-refresh session-nya sendiri (di
  // localStorage), jadi di sini kita tinggal DENGERIN status-nya, gak perlu ngatur
  // penyimpanannya manual lagi.
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const verifyAdminSession = useCallback(async (session) => {
    if (!session) return false;
    const { data, error } = await supabase.rpc('is_portfolio_admin');
    return !error && data === true;
  }, []);
  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      verifyAdminSession(session).then((isAdmin) => {
        if (!ignore) setIsAdminAuthed(isAdmin);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      verifyAdminSession(session).then((isAdmin) => {
        if (!ignore) setIsAdminAuthed(isAdmin);
      });
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [verifyAdminSession]);

  // Mode "Full Screen" — dipanggil dari tombol di TitleBar. Pakai Fullscreen API bawaan
  // browser (bikin seluruh tab expand nutupin address bar dkk), BUKAN cuma gede-gedein
  // elemen di CSS doang. `isFullscreen` disinkronin ke event `fullscreenchange` juga
  // (bukan cuma di-set manual pas klik tombol), soalnya user bisa keluar full screen
  // lewat cara lain di luar tombol kita (misal pencet Esc, atau klik UI browser) — kalau
  // gak disinkronin, status tombol bisa "nyangkut" gak sesuai kenyataan.
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement
  );
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // documentElement dipilih (bukan cuma div kertas) biar TitleBar/Ribbon/StatusBar
        // ikut kepake pas full screen, bukan cuma kontennya doang.
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      // Beberapa browser/situasi (mis. iframe tanpa izin, atau browser lawas yang gak
      // dukung Fullscreen API) bisa nolak request-nya — diamkan aja, tombolnya tetep
      // ada tapi gak ngefek, daripada bikin app crash.
      console.warn('Full screen tidak didukung atau ditolak:', err);
    }
  };

  // Mode "Hint" — toggle dari tombol HintToggle. Pas true, seluruh kontrol interaktif
  // yang sedang tampil ikut disorot otomatis; `data-hint-id` tetap dipakai untuk area
  // interaktif non-standar seperti permukaan drag. SENGAJA gak ada auto-off pas ganti tab
  // (activeTab) — biar visitor bisa nyalain hint sekali terus keliling semua tab
  // sambil hint-nya tetep nyala, sampe dia matiin manual lewat tombolnya lagi.
  const [hintActive, setHintActive] = useState(false);

  // Kirim "page view" tiap kali visitor pindah tab (Home/About/Career/dst) — biar
  // tiap tab kehitung sebagai halaman sendiri di laporan Analytics, bukan cuma
  // sekali doang pas web pertama dibuka. Skip pas lagi di Admin Mode.
  useEffect(() => {
    if (!isAdminMode) {
      trackPageView(activeTab);
    }
  }, [activeTab, isAdminMode]);

  // Update <title> browser + meta description/Open Graph/Twitter Card tiap kali pindah
  // tab, biar tiap halaman punya identitas sendiri (bukan cuma judul situs polos terus-
  // terusan) — dan biar ada baseline OG tag yang kepasang duluan sebelum Projects.jsx
  // nge-override lagi jadi lebih spesifik pas satu artikel dibuka (lihat pageMeta.js buat
  // catatan penting soal batasan client-side meta tag ini buat preview share). Skip pas
  // Admin Mode karena lagi di CMS, bukan halaman publik yang mau di-share orang.
  useEffect(() => {
    if (isAdminMode) return;
    setSiteIdentity({
      name: portfolioData.home?.name,
      role: portfolioData.home?.role,
    });
    const tabMeta = {
      Home: {
        description: portfolioData.home?.bio,
        image: featuredWorks[0]?.image,
      },
      About: {
        title: 'About',
        description: portfolioData.about?.live,
      },
      Career: {
        title: portfolioData.career?.heading || 'Career',
        description: portfolioData.career?.subheading,
      },
      Book: {
        title: portfolioData.books?.heading || 'Book',
        description: portfolioData.books?.subheading,
      },
      Projects: {
        title: portfolioData.projects?.heading || 'Projects',
        description: portfolioData.projects?.subheading,
      },
      Contact: {
        title: 'Contact',
        description: portfolioData.contact?.subheading,
      },
    };
    setPageMeta(tabMeta[activeTab] || {});
  }, [activeTab, portfolioData, isAdminMode, featuredWorks]);


  // Deteksi layar sempit (HP) SECARA OTOMATIS lewat matchMedia — bukan toggle manual.
  // Ini beneran ngikutin lebar browser asli, jadi kalau dibuka dari HP sungguhan
  // (misal abis di-publish ke Netlify), otomatis kepakai tanpa visitor perlu ngapa-ngapain.
  const [isMobileLayout, setIsMobileLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const handleChange = () => setIsMobileLayout(mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Dipanggil kapanpun mau KELUAR dari admin mode (Exit Admin, Save, atau Cancel) —
  // signOut Supabase Auth beneran (bukan cuma hapus flag lokal), jadi session/token-nya
  // beneran diinvalidasi. isAdminAuthed otomatis ke-update ke false lewat listener
  // onAuthStateChange di atas — gak perlu di-set manual di sini.
  const exitAdminMode = () => {
    setIsAdminModeRaw(false);
    supabase.auth.signOut();
  };

  // Dipanggil dari tombol "Admin Only" di TitleBar. Kalau mau MASUK admin mode dan
  // belum login di percobaan ini, buka modal password (bukan window.prompt lagi — prompt
  // bawaan browser gak bisa di-mask jadi titik/pagar, makanya dipindah ke input sendiri).
  // Kalau mau KELUAR (Exit Admin), langsung logout tanpa password.
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSatpamModal, setShowSatpamModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordWrong, setPasswordWrong] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSetIsAdminMode = (wantsAdmin) => {
    if (!wantsAdmin) {
      exitAdminMode();
      return;
    }
    if (isAdminAuthed) {
      setIsAdminModeRaw(true);
      setShowSatpamModal(true);
      return;
    }
    if (!ADMIN_EMAIL) {
      setSaveError('Email admin belum dikonfigurasi. Tambahkan VITE_ADMIN_EMAIL ke file .env lalu restart npm run dev.');
      return;
    }
    setPasswordInput('');
    setPasswordWrong(false);
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsSigningIn(true);
    // Login beneran ke Supabase Auth — server yang validasi password-nya, bukan JS
    // di browser lagi. `data.data.session` yang dihasilkan ini yang nantinya dipake
    // sama Row Level Security di tabel `portfolio` buat ngizinin/nolak UPDATE.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: passwordInput,
    });

    const isAdmin = !error && await verifyAdminSession(data?.session);
    setIsSigningIn(false);

    if (isAdmin) {
      setIsAdminAuthed(true);
      setIsAdminModeRaw(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setShowSatpamModal(true);
    } else {
      if (!error) await supabase.auth.signOut();
      console.error('Login admin gagal:', error?.message || 'Akun ini tidak terdaftar sebagai admin portfolio.');
      setPasswordWrong(true);
      setPasswordInput('');
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordWrong(false);
  };

  // Dipanggil dari CmsDashboard pas Save. Simpen ke Supabase doang — TIDAK keluar dari
  // admin mode. CmsDashboard sendiri yang nentuin balik ke menu tab (bukan App.jsx),
  // biar admin tetep di dalem fitur CMS sampe dia beneran klik "Exit Admin".
  const handleCmsSave = async (newData) => {
    const success = await savePortfolioData(newData);
    return success;
  };

  // State Editor Word
  const [fontFamily, setFontFamily] = useState('Garamond');
  const [fontSize, setFontSize] = useState(FONT_SIZE_BASELINE_PT);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [viewMode, setViewMode] = useState('web');

  useLayoutEffect(() => {
    // Area kanan dipakai carousel Home, notes About, dan Document History Career.
    if (isMobileLayout || !['Home', 'About', 'Career'].includes(activeTab)) {
      setDesktopRailStyle(null);
      return undefined;
    }

    const measureRail = () => {
      const stage = desktopStageRef.current;
      const page = desktopPageRef.current;
      if (!stage || !page) return;
      const pageRect = page.getBoundingClientRect();
      const gap = 16;
      const rightMargin = 16;
      const left = Math.ceil(pageRect.right + window.scrollX + gap);
      const width = Math.floor(window.innerWidth - pageRect.right - gap - rightMargin);
      setDesktopRailStyle(() => {
        if (width < 96) return null;
        // getBoundingClientRect() memakai koordinat viewport. Tambahkan scrollY
        // agar rail dipaku ke koordinat dokumen dan tidak mengikuti pengguna.
        const top = Math.ceil(pageRect.top + window.scrollY + 16);
        const maxHeight = Math.max(180, Math.floor(window.innerHeight - top - 48));
        return { left, width, top, maxHeight };
      });
    };

    measureRail();
    const observer = new ResizeObserver(measureRail);
    if (desktopStageRef.current) observer.observe(desktopStageRef.current);
    if (desktopPageRef.current) observer.observe(desktopPageRef.current);
    window.addEventListener('resize', measureRail);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measureRail);
    };
  }, [activeTab, isMobileLayout, viewMode, zoomLevel, isLoading]);

  useLayoutEffect(() => {
    if (isMobileLayout || !['Home', 'About'].includes(activeTab)) {
      setDesktopLeftRailStyle(null);
      return undefined;
    }
    const measureLeftRail = () => {
      const page = desktopPageRef.current;
      if (!page) return;
      const pageRect = page.getBoundingClientRect();
      const gap = 18;
      const outerMargin = 18;
      const width = Math.floor(pageRect.left - gap - outerMargin);
      if (width < 150) {
        setDesktopLeftRailStyle(null);
        return;
      }
      setDesktopLeftRailStyle({
        left: outerMargin,
        width: Math.min(width, 280),
        top: Math.ceil(pageRect.top + window.scrollY + 28),
        fontFamily,
        fontSize: `${fontSize}pt`,
      });
    };
    measureLeftRail();
    const observer = new ResizeObserver(measureLeftRail);
    if (desktopPageRef.current) observer.observe(desktopPageRef.current);
    window.addEventListener('resize', measureLeftRail);
    return () => { observer.disconnect(); window.removeEventListener('resize', measureLeftRail); };
  }, [activeTab, fontFamily, fontSize, isLoading, isMobileLayout, viewMode, zoomLevel]);

  // Data & word count dinamis sesuai tab yang lagi aktif
  const currentWordCount = useMemo(
    () => countWords({
      Home: portfolioData.home,
      About: portfolioData.about,
      Career: portfolioData.career,
      Book: portfolioData.books,
      Projects: portfolioData.projects,
      Contact: portfolioData.contact,
    }[activeTab]),
    [activeTab, portfolioData]
  );

  // Sementara data masih di-fetch dari Supabase, tampilin loading simpel
  // biar gak kelihatan "flash" dari data default ke data asli.
  if (isLoading) {
    return <DocumentLoader onFinished={() => setIsSplashDone(true)} />;
  }

  const documentBody = (
    <main className={`relative z-10 w-full h-full ${isBold ? 'font-bold' : ''} ${isItalic ? 'italic' : ''} ${isUnderline ? 'underline' : ''}`}>
      {activeTab === 'Home' && (
        <Home
          data={portfolioData.home}
          zineData={normalizeZine(portfolioData.zine)}
          miniGameData={normalizeMiniGame(portfolioData.miniGame)}
          featuredWorks={featuredWorks}
          onOpenWork={openFeaturedWork}
          interactiveWords={portfolioData.interactiveWords}
          onNavigate={setActiveTab}
        />
      )}
      {activeTab === 'About' && <About data={portfolioData.about} interactiveWords={portfolioData.interactiveWords} onNavigate={setActiveTab} />}
      {activeTab === 'Career' && <Career data={portfolioData.career} interactiveWords={portfolioData.interactiveWords} onNavigate={setActiveTab} railStyle={!isAdminMode && !isMobileLayout ? desktopRailStyle : null} darkMode={darkMode} />}
      {activeTab === 'Book' && (
        <Book
          data={portfolioData.books}
          interactiveWords={portfolioData.interactiveWords}
          onNavigate={setActiveTab}
          initialBookId={workNavigation?.type === 'book' ? workNavigation.itemId : null}
          navigationRequestKey={workNavigation?.requestKey}
        />
      )}
      {activeTab === 'Projects' && (
        <Projects
          data={portfolioData.projects}
          interactiveWords={portfolioData.interactiveWords}
          onNavigate={setActiveTab}
          initialArticleId={initialArticleId}
          initialWorkTarget={workNavigation?.type !== 'book' ? workNavigation : null}
          navigationRequestKey={workNavigation?.requestKey}
        />
      )}
      {activeTab === 'Contact' && <Contact data={portfolioData.contact} interactiveWords={portfolioData.interactiveWords} onNavigate={setActiveTab} />}
    </main>
  );

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className={`min-h-screen bg-[#e6e6e6] dark:bg-[#181818] flex flex-col justify-between selection:bg-blue-500 selection:text-white ${hintActive ? 'hint-mode-active' : ''}`}>

        {/* Pesan error kalau gagal konek/simpen ke Supabase */}
        {(loadError || saveError) && (
          <div className="bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs font-mono text-center py-2 px-4">
            {loadError || saveError}
          </div>
        )}

        {/* Modal password buat masuk Admin Only — pakai input type="password" beneran
            (otomatis di-mask jadi titik/pagar sama browser), bukan window.prompt lagi. */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
            <form
              onSubmit={handlePasswordSubmit}
              className="w-full max-w-xs bg-white dark:bg-[#202020] rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3"
            >
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">Masuk Admin</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Masukkan password admin buat lanjut.</p>
              <input
                type="password"
                autoFocus
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordWrong(false); }}
                placeholder="Password"
                disabled={isSigningIn}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#2d2d2d] border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:border-[#2b579a] disabled:opacity-60"
              />
              {passwordWrong && (
                <p className="text-xs text-red-500 font-medium">Login gagal. Periksa akun admin atau password.</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePasswordCancel}
                  disabled={isSigningIn}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded bg-[#2b579a] hover:bg-[#1e3f73] text-white shadow transition-colors disabled:opacity-60"
                >
                  {isSigningIn ? 'Memeriksa...' : 'Masuk'}
                </button>
              </div>
            </form>
          </div>
        )}

        {showSatpamModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="satpam-title">
            <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202020] shadow-2xl">
              <div className="bg-[#2B579A] px-5 py-3 text-white"><h2 id="satpam-title" className="font-mono text-sm font-bold tracking-wider">SAYA SATPAM!</h2></div>
              <div className="p-5"><p className="text-sm text-gray-700 dark:text-gray-200">ada yang bisa dibanting di sini?</p><div className="mt-5 flex justify-end"><button type="button" autoFocus onClick={() => setShowSatpamModal(false)} className="rounded-md bg-[#2B579A] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a84]">Siap, Pak</button></div></div>
            </div>
          </div>
        )}

        {/* 1. Baris Judul Paling Atas — otomatis nyederhanain diri di layar sempit lewat class Tailwind di dalamnya */}
        <TitleBar 
          isAdminMode={isAdminMode}
          setIsAdminMode={handleSetIsAdminMode}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onSave={() => document.getElementById('cms-admin-form')?.requestSubmit()}
          activeTab={activeTab}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled((value) => !value)}
        />

        {/* Tombol "Hint" — nempel di pojok KIRI ATAS, di luar kertas A4. Diklik = toggle
            mode hint on/off, yang bikin semua elemen `data-hint-id` di tab yang lagi
            kebuka ikut blink (lihat CSS `.hint-mode-active` di bawah). GANTI dari
            GuidanceNote lama (kotak teks statis per-tab). Sama kayak sebelumnya:
            disembunyiin di HP & pas Admin Mode, dipasang di luar div kertas yang
            punya transform: scale biar posisinya gak ikut ke-scale pas zoom. */}
        {!isAdminMode && (
          <HintToggle active={hintActive} onToggle={() => setHintActive((v) => !v)} />
        )}

        {/* Notifikasi welcome tetap muncul di HP juga; posisinya mengikuti
            isMobileLayout di dalam komponennya sendiri. */}
        {!isAdminMode && (
          <WelcomeToast
            settings={portfolioData.general?.welcomeNotification}
            isMobileLayout={isMobileLayout}
          />
        )}

        {/* 2. Konten Utama: Admin CMS atau Lembar Dokumen */}
        {isAdminMode ? (
          <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full bg-white dark:bg-[#202020] my-4 sm:my-6 rounded shadow-lg">
            <Suspense fallback={<div className="p-10 text-center font-mono text-xs uppercase tracking-widest text-gray-400">Membuka CMS…</div>}>
              <CmsDashboard 
                data={portfolioData} 
                onSave={handleCmsSave} 
              />
            </Suspense>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center">
            
            {/* Ribbon Menu (Cukup dipanggil sekali di sini, jangan diduplikat!) */}
            <div className="w-full sticky top-0 z-40 shadow-sm">
              <Ribbon 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                fontSize={fontSize}
                setFontSize={setFontSize}
                isBold={isBold}
                setIsBold={setIsBold}
                isItalic={isItalic}
                setIsItalic={setIsItalic}
                isUnderline={isUnderline}
                setIsUnderline={setIsUnderline}
              />
            </div>

            {/* Penggaris Dokumen — HANYA tampil di desktop. Di HP gak relevan & cuma makan tempat,
                jadi disembunyiin otomatis (bukan berdasarkan toggle manual). */}
            {!isMobileLayout && (
              <Ruler zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} activeTab={activeTab} />
            )}

            {/* Lembar Kertas Utama — di HP dibikin nempel penuh (gak ada padding/gap abu-abu
                di sekitarnya) dan flex-1 biar ngisi sisa tinggi layar, jadi berasa kayak app
                native, bukan "kertas di atas meja abu-abu". Desktop TIDAK berubah sama sekali. */}
            <div className={
              isMobileLayout
                ? 'w-full flex-1 flex justify-center overflow-x-auto overflow-y-visible'
                : 'w-full flex justify-center py-2 sm:py-4 px-0 sm:px-2 overflow-x-auto overflow-y-visible'
            }>
              {isMobileLayout ? (
                // ===== DI HP: full-width & fluid, TANPA efek "kertas Word" & TANPA di-scale.
                // Ini yang paling nentuin — versi lama maksa lebar/skala dokumen dekstop
                // ke layar kecil, itu penyebab utama tampilannya berantakan pas dibuka di HP.
                <div
                  className="portfolio-public relative w-full px-4 py-4 text-gray-900 dark:text-gray-100 bg-white dark:bg-[#202020]"
                  style={{
                    fontFamily,
                    fontSize: `${fontSize}pt`,
                  }}
                >
                  {documentBody}
                </div>
              ) : (
                <div ref={desktopStageRef} className="relative w-full flex justify-center">
                  <div 
                    ref={desktopPageRef}
                    className={`portfolio-public relative transition-all duration-300 text-gray-900 dark:text-gray-100 ${railPrintedTab === activeTab ? 'rail-page-print-in' : ''} ${
                      viewMode === 'print' 
                        ? 'word-page' 
                        : 'w-full max-w-4xl bg-white dark:bg-[#202020] p-8 min-h-[500px] rounded shadow-xl border border-gray-300 dark:border-gray-700'
                    }`}
                    style={{ 
                      fontFamily: fontFamily, 
                      fontSize: `${fontSize}pt`,
                      transform: `scale(${(zoomLevel / 100) * BASE_VIEW_SCALE})`,
                      transformOrigin: 'top center'
                    }}
                  >
                    {documentBody}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {!isAdminMode && !isMobileLayout && activeTab === 'Home' && desktopRailStyle && (
          <FeaturedWorksRailPortal
            style={{
              ...desktopRailStyle,
              fontFamily,
              fontSize: `${fontSize}pt`,
            }}
            darkMode={darkMode}
            helpActive={hintActive}
            featuredWorks={featuredWorks}
            heading={portfolioData.home?.featuredWorksHeading}
            onOpenWork={openFeaturedWork}
          />
        )}

        {!isAdminMode && !isMobileLayout && activeTab === 'About' && desktopRailStyle && (
          <AboutNotesPortal data={portfolioData.about} style={desktopRailStyle} darkMode={darkMode} />
        )}

        {!isAdminMode && !isMobileLayout && activeTab === 'Home' && desktopLeftRailStyle && (
          <VisitorIntroduction
            data={normalizeHome(portfolioData.home).visitorIntroduction}
            style={desktopLeftRailStyle}
            darkMode={darkMode}
            soundEnabled={soundEnabled && portfolioData.general?.soundEffects !== false}
            hintActive={hintActive}
            homeNavigation={{
              onNavigate: setActiveTab,
              onPrintNavigate: openPrintedTab,
              zineEnabled: normalizeZine(portfolioData.zine).enabled !== false,
              zineLabel: normalizeZine(portfolioData.zine).menuLabel || 'Wassup?',
              gameEnabled: normalizeMiniGame(portfolioData.miniGame).enabled !== false,
            }}
          />
        )}

        {!isAdminMode && !isMobileLayout && activeTab === 'About' && desktopLeftRailStyle && (
          <LastFmFootnote
            data={normalizeAbout(portfolioData.about).listeningFootnote}
            style={desktopLeftRailStyle}
            darkMode={darkMode}
          />
        )}

        {/* 3. Status Bar Bawah — otomatis nyederhanain diri di layar sempit lewat class Tailwind di dalamnya */}
        <StatusBar 
          activePage={activeTab}
          wordCount={currentWordCount}
          viewMode={viewMode}
          setViewMode={setViewMode}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          isMobileLayout={isMobileLayout}
        />

        {/* CSS global mode Hint. Selain area khusus ber-data-hint-id, selector ini memindai
            kontrol HTML yang memang dapat dipakai pengunjung: button, link, input, select,
            textarea, tab, dan elemen bertabindex. Outline tidak mengubah ukuran/layout. */}
        <style>{`
          .typing-caret { display:inline-block; width:2px; height:.82em; margin-left:.08em; background:currentColor; vertical-align:-.04em; animation:caretBlink 1s steps(1,end) infinite; }
          @keyframes caretBlink { 0%,48%{opacity:1} 49%,100%{opacity:0} }
          .rail-page-print-in { animation:railPagePrintIn .68s cubic-bezier(.2,.78,.2,1) both; }
          @keyframes railPagePrintIn {
            0% { opacity:.72; clip-path:inset(0 0 16% 0); }
            58% { opacity:1; clip-path:inset(0 0 3% 0); }
            100% { opacity:1; clip-path:inset(0); }
          }
          @media (prefers-reduced-motion:reduce) { .rail-page-print-in { animation:none; } }
          .portfolio-google-translate,.goog-te-banner-frame,.goog-te-gadget-icon{display:none!important}
          body{top:0!important}.skiptranslate iframe{display:none!important}
          #goog-gt-tt,.goog-te-balloon-frame{display:none!important}
          font{background-color:transparent!important;box-shadow:none!important}
          .interactive-word { display:inline; padding:0; border:0; background:none; font:inherit; cursor:pointer; text-decoration-line:underline; text-decoration-style:wavy; text-decoration-thickness:1.5px; text-underline-offset:3px; }
          .interactive-word:hover { filter:brightness(.78); }
          .hint-mode-active :is(
            [data-hint-id],
            a[href],
            button:not([disabled]),
            input:not([type="hidden"]):not([disabled]),
            select:not([disabled]),
            textarea:not([disabled]),
            [role="button"]:not([aria-disabled="true"]),
            [role="tab"]:not([aria-disabled="true"]),
            [tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])
          ):not(.portfolio-help-toggle) {
            animation: hintPulse 1.5s ease-in-out infinite;
            outline: 3px solid #2B579A;
            outline-offset: 4px;
            border-radius: 6px;
            box-shadow: 0 0 0 5px rgba(43, 87, 154, 0.13);
          }
          .hint-mode-active :is(
            [data-hint-id][data-hint-surface="blue"],
            [class*="bg-[#2B579A]"] button:not([disabled]),
            [class*="bg-[#2B579A]"] a[href]
          ):not(.portfolio-help-toggle) {
            outline-color: #FDE68A;
            box-shadow: 0 0 0 3px rgba(253, 230, 138, 0.2);
            animation-name: hintPulseBlueSurface;
          }
          .dark .hint-mode-active :is(
            [data-hint-id], a[href], button:not([disabled]),
            input:not([type="hidden"]):not([disabled]), select:not([disabled]),
            textarea:not([disabled]), [role="button"]:not([aria-disabled="true"]),
            [role="tab"]:not([aria-disabled="true"]),
            [tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])
          ):not(.portfolio-help-toggle) {
            outline-color: #6FA8DC;
          }
          @keyframes hintPulse {
            0%, 100% { outline-color: rgba(43, 87, 154, 0.35); box-shadow: 0 0 0 0 rgba(43, 87, 154, 0.25); }
            50% { outline-color: rgba(43, 87, 154, 1); box-shadow: 0 0 0 4px rgba(43, 87, 154, 0.12); }
          }
          @keyframes hintPulseBlueSurface {
            0%, 100% { outline-color: rgba(253, 230, 138, 0.55); box-shadow: 0 0 0 0 rgba(253, 230, 138, 0.18); }
            50% { outline-color: rgba(255, 255, 255, 1); box-shadow: 0 0 0 4px rgba(253, 230, 138, 0.24); }
          }
          @media (prefers-reduced-motion: reduce) {
            .hint-mode-active :is(
              [data-hint-id], a[href], button:not([disabled]),
              input:not([type="hidden"]):not([disabled]), select:not([disabled]),
              textarea:not([disabled]), [role="button"]:not([aria-disabled="true"]),
              [role="tab"]:not([aria-disabled="true"]),
              [tabindex]:not([tabindex="-1"]):not([aria-disabled="true"])
            ):not(.portfolio-help-toggle) { animation: none; outline-color: #2B579A; }
          }
        `}</style>

      </div>
    </div>
  );
}
