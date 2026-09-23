import React, { useState, useRef, useEffect } from 'react';
import { supabase, IMAGES_BUCKET } from '../lib/supabaseClient';
import InteractiveLinksEditor from './InteractiveLinksEditor';
import { normalizeVisitorIntroduction } from '../lib/visitorIntroductionData';
import { getZineModerationQueue, moderateZineSubmission } from '../lib/homeExperienceApi';

// Komponen kartu editor HARUS berada di luar CmsDashboard. Kalau didefinisikan di
// dalam fungsi utama, React menganggapnya sebagai tipe komponen baru pada setiap
// keystroke, lalu membongkar dan memasang ulang seluruh kartu. Akibatnya input
// kehilangan fokus setelah satu huruf. Context hanya meneruskan state/handler drag;
// identitas komponen tetap stabil selama pengguna mengetik.
const CmsCardContext = React.createContext(null);

function ReorderHandle({ listKey, idx, count }) {
  const context = React.useContext(CmsCardContext);
  if (!context) return null;
  const { reorderList, handleDragStart, handleDragEnd } = context;
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <span draggable onDragStart={handleDragStart(listKey, idx)} onDragEnd={handleDragEnd} title="Seret buat urutin" className="cursor-grab active:cursor-grabbing select-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1 text-sm leading-none">⠿</span>
      <button type="button" onClick={() => reorderList(listKey, idx, idx - 1)} disabled={idx === 0} title="Naikkan urutan" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed text-[10px] leading-none px-1 py-0.5">▲</button>
      <button type="button" onClick={() => reorderList(listKey, idx, idx + 1)} disabled={idx === count - 1} title="Turunkan urutan" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed text-[10px] leading-none px-1 py-0.5">▼</button>
    </div>
  );
}

function RemoveBtn({ onClick, label = 'Hapus' }) {
  return <button type="button" onClick={onClick} className="text-[10px] text-red-500 hover:text-red-600 font-semibold">{label}</button>;
}

function AddBtn({ onClick, label }) {
  return <button type="button" onClick={onClick} className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40">+ {label}</button>;
}

function ContentCard({ cardKey, listKey, idx, count, title, subtitle, onRemove, children }) {
  const context = React.useContext(CmsCardContext);
  if (!context) return null;
  const { expandedContentKey, draggingKey, toggleContentCard, handleDragOver, handleDrop } = context;
  const isOpen = expandedContentKey === cardKey;
  return (
    <div onDragOver={handleDragOver} onDrop={handleDrop(listKey, idx)} className={`overflow-hidden rounded-lg border border-gray-200 bg-white transition-opacity dark:border-gray-700 dark:bg-[#282828] ${draggingKey === `${listKey}-${idx}` ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2 p-3">
        <ReorderHandle listKey={listKey} idx={idx} count={count} />
        <button type="button" onClick={() => toggleContentCard(cardKey)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-xs font-bold text-gray-700 dark:text-gray-200">{title}</span>
          {subtitle && <span className="mt-0.5 block truncate font-mono text-[10px] text-gray-400">{subtitle}</span>}
        </button>
        <button type="button" onClick={() => toggleContentCard(cardKey)} className="grid h-7 w-7 place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-white/5" aria-label={isOpen ? 'Tutup editor' : 'Buka editor'}>{isOpen ? '⌃' : '⌄'}</button>
        {onRemove && <RemoveBtn onClick={onRemove} />}
      </div>
      {isOpen && <div className="space-y-3 border-t border-gray-200 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-[#242424]">{children}</div>}
    </div>
  );
}

// Enam halaman publik selalu tampil dulu sesuai urutan navbar. Semua pengaturan
// tambahan diletakkan setelah Contact supaya menu CMS mudah dipindai.
const MAIN_TABS = ['home', 'about', 'career', 'book', 'projects', 'contact', 'featuredWorks', 'visitorIntroduction', 'interactiveWords', 'general'];
const EXTRA_TABS = ['zine', 'miniGame'];

// Metadata buat kartu menu utama CMS — cukup diedit di sini kalau mau ganti label/ikon/deskripsi
const TAB_META = {
  home: { label: 'Home', desc: 'Nama, role & kalimat dinamis' },
  featuredWorks: { label: 'Featured Works', desc: 'Heading dan pilihan karya pada carousel Home' },
  visitorIntroduction: { label: 'Visitor Introduction', desc: 'Printer kiri Home dan lembar perkenalan fullscreen' },
  about: { label: 'About', desc: 'Author’s Note dan catatan pinggir' },
  career: { label: 'Career', desc: 'Riwayat kerja, pendidikan, pencapaian & sertifikat' },
  book: { label: 'Book', desc: 'Buku, tulisan & karya open-source' },
  projects: { label: 'Projects', desc: 'Artikel, Poster & tab tambahan bebas' },
  contact: { label: 'Contact', desc: 'Info kontak, sosmed & tombol aksi' },
  zine: { label: 'Wassup?', desc: 'Pengaturan menulis, menerima & moderasi kiriman' },
  miniGame: { label: 'Mini Game', desc: 'Game shelf, draft The Red Pen & koreksi editorial' },
  interactiveWords: { label: 'Interactive Words', desc: 'Frasa klik, tujuan, warna & spellcheck underline' },
  general: { label: 'General', desc: 'Pengaturan situs — info update patch, suara, dll' },
};

const DEFAULT_GENERAL = {
  soundEffects: true,
  welcomeNotification: {
    enabled: true,
    version: '1.0.0',
    title: 'Update terbaru',
    message: 'Catatan perubahan terbaru portofolio akan muncul di sini.',
    delaySeconds: 2,
  },
};

// Jaring pengaman kalau data lama di Supabase belum punya field `general` sama sekali,
// atau field welcomeNotification-nya cuma sebagian — gabungin sama default biar gak crash.
const normalizeGeneral = (raw) => ({
  soundEffects: raw?.soundEffects !== false,
  welcomeNotification: {
    ...DEFAULT_GENERAL.welcomeNotification,
    ...(raw?.welcomeNotification || {}),
  },
});

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
const DEFAULT_RED_PEN_DRAFTS = [
  {
    id: 'red-pen-1', label: 'Pemanasan', enabled: true,
    passage: 'Tim kami berkolaborasi bersama untuk menyusun panduan penggunaan aplikasi yang mudah dipahami oleh pengguna baru.',
    issues: [
      { id: 'rp-1-1', phrase: 'berkolaborasi bersama', replacement: 'berkolaborasi', explanation: 'Kata “berkolaborasi” sudah mengandung makna bekerja bersama; “bersama” menjadi redundan.' },
      { id: 'rp-1-2', phrase: 'oleh pengguna baru', replacement: 'pengguna baru', explanation: 'Bentuk aktif lebih langsung: “yang mudah dipahami pengguna baru”.' },
    ],
  },
  {
    id: 'red-pen-2', label: 'Instruksi', enabled: true,
    passage: 'Untuk dapat memulai proses instalasi, pengguna terlebih dahulu harus melakukan klik pada tombol Unduh yang terdapat di bagian atas halaman.',
    issues: [
      { id: 'rp-2-1', phrase: 'Untuk dapat memulai proses instalasi', replacement: 'Untuk memulai instalasi', explanation: '“Dapat” dan “proses” tidak menambah informasi pada instruksi ini.' },
      { id: 'rp-2-2', phrase: 'terlebih dahulu harus melakukan klik pada', replacement: 'klik', explanation: 'Instruksi teknis sebaiknya memakai verba langsung dan ringkas.' },
      { id: 'rp-2-3', phrase: 'yang terdapat di bagian atas halaman', replacement: 'di bagian atas halaman', explanation: 'Frasa “yang terdapat” dapat dipangkas tanpa mengubah makna.' },
    ],
  },
  {
    id: 'red-pen-3', label: 'Antarmuka', enabled: true,
    passage: 'Apabila pengguna lupa kata sandi miliknya sendiri, mereka bisa menekan tautan Lupa Kata Sandi agar supaya sistem dapat mengirimkan email pemulihan.',
    issues: [
      { id: 'rp-3-1', phrase: 'miliknya sendiri', replacement: 'hapus', explanation: 'Kepemilikan sudah jelas dari konteks; frasa ini berlebihan.' },
      { id: 'rp-3-2', phrase: 'bisa menekan', replacement: 'pilih', explanation: 'Gunakan istilah tindakan antarmuka yang konsisten dan langsung.' },
      { id: 'rp-3-3', phrase: 'agar supaya', replacement: 'agar', explanation: '“Agar” dan “supaya” memiliki fungsi sama; gunakan salah satu.' },
    ],
  },
  {
    id: 'red-pen-4', label: 'Prosedur', enabled: true,
    passage: 'Setelah file berhasil selesai diunggah, kemudian sistem nantinya akan secara otomatis menampilkan sebuah notifikasi pemberitahuan kepada pengguna.',
    issues: [
      { id: 'rp-4-1', phrase: 'berhasil selesai diunggah', replacement: 'selesai diunggah', explanation: '“Berhasil” dan “selesai” bertumpuk dalam konteks hasil unggahan.' },
      { id: 'rp-4-2', phrase: 'kemudian', replacement: 'hapus', explanation: 'Kata “setelah” sudah menandai urutan; “kemudian” tidak diperlukan.' },
      { id: 'rp-4-3', phrase: 'nantinya akan secara otomatis', replacement: 'akan otomatis', explanation: 'Pangkas penanda waktu dan cara yang bertumpuk.' },
      { id: 'rp-4-4', phrase: 'sebuah notifikasi pemberitahuan', replacement: 'notifikasi', explanation: 'Notifikasi sudah berarti pemberitahuan.' },
    ],
  },
  {
    id: 'red-pen-5', label: 'Final Draft', enabled: true,
    passage: 'Fitur ini dibuat dengan tujuan untuk membantu para pengguna-pengguna dalam melakukan pengelolaan data secara lebih mudah, cepat, dan juga efisien dalam waktu yang bersamaan.',
    issues: [
      { id: 'rp-5-1', phrase: 'dibuat dengan tujuan untuk membantu', replacement: 'membantu', explanation: 'Pembuka nominal ini dapat diganti verba langsung.' },
      { id: 'rp-5-2', phrase: 'para pengguna-pengguna', replacement: 'pengguna', explanation: 'Jamak ganda: “para” dan pengulangan kata tidak dipakai bersamaan.' },
      { id: 'rp-5-3', phrase: 'dalam melakukan pengelolaan', replacement: 'mengelola', explanation: 'Nominalisasi membuat kalimat lebih panjang daripada verba aktif.' },
      { id: 'rp-5-4', phrase: 'dan juga', replacement: 'dan', explanation: '“Juga” tidak diperlukan dalam deret setara ini.' },
    ],
  },
];
const DEFAULT_MINI_GAME = {
  enabled: true, menuLabel: 'Mini Game', libraryTitle: 'Choose a desk.',
  libraryDescription: 'Pilih satu meja kerja. Setiap permainan menguji bagian berbeda dari proses mengubah gagasan mentah menjadi naskah.',
  gameName: 'The Red Pen', gameCategory: 'Editorial', gameCardDescription: 'Temukan bagian yang janggal, ambigu, dan tidak efektif sebelum draft dikirim.',
  title: 'Inspect the unfinished draft.', objective: 'Lima draft belum selesai menunggu meja editor. Temukan bagian yang janggal, bertele-tele, ambigu, atau tidak efektif sebelum waktunya habis.',
  rules: { click: 'Klik atau tap kata/frasa bermasalah.', timer: 'Tiap draft punya waktu 60 detik.', wrong: 'Pilihan salah menurunkan akurasi dan skor.', hint: 'Satu hint tersedia untuk seluruh sesi.', review: 'Seusai tiap draft, baca alasan editorialnya—waktu berhenti saat review.' },
  startButtonLabel: 'Mulai Mengedit', secondsPerDraft: 60, draftsPerSession: 5,
  scoreSettings: { correctPoints: 100, wrongPenalty: 25, completionBonus: 100, maxTimeBonus: 100, hintPenalty: 75 },
  gradeTitles: [{ min: 90, label: 'Senior Red Pen' }, { min: 75, label: 'Sharp-eyed Editor' }, { min: 55, label: 'Promising Proofreader' }, { min: 0, label: 'Draft Survivor' }],
  resultEyebrow: 'Final editorial report', replayLabel: 'Main lagi', projectsCtaLabel: 'Lihat tulisan Haikal', contactCtaLabel: 'Hubungi Haikal', gameSlots: [], drafts: DEFAULT_RED_PEN_DRAFTS,
  showInLibrary: true, illustration: '',
};

const emptyMiniGameSlot = (position = 2, existing = {}) => ({
  id: existing.id || `game-slot-${Date.now()}-${position}`,
  enabled: existing.enabled ?? true,
  showInLibrary: existing.showInLibrary ?? false,
  illustration: existing.illustration || '',
  menuLabel: existing.menuLabel || '',
  libraryTitle: existing.libraryTitle || '',
  libraryDescription: existing.libraryDescription || '',
  gameName: existing.gameName || existing.name || `Game ${position}`,
  gameCategory: existing.gameCategory || '',
  gameCardDescription: existing.gameCardDescription || '',
  title: existing.title || '',
  objective: existing.objective || '',
  rules: { click: '', timer: '', wrong: '', hint: '', review: '', ...(existing.rules || {}) },
  startButtonLabel: existing.startButtonLabel || '',
  secondsPerDraft: Number(existing.secondsPerDraft) || 60,
  draftsPerSession: Number(existing.draftsPerSession) || 5,
  scoreSettings: { correctPoints: 0, wrongPenalty: 0, completionBonus: 0, maxTimeBonus: 0, hintPenalty: 0, ...(existing.scoreSettings || {}) },
  gradeTitles: Array.isArray(existing.gradeTitles) && existing.gradeTitles.length
    ? existing.gradeTitles
    : [{ min: 90, label: '' }, { min: 75, label: '' }, { min: 55, label: '' }, { min: 0, label: '' }],
  resultEyebrow: existing.resultEyebrow || '',
  replayLabel: existing.replayLabel || '',
  projectsCtaLabel: existing.projectsCtaLabel || '',
  contactCtaLabel: existing.contactCtaLabel || '',
  drafts: Array.isArray(existing.drafts) ? existing.drafts.map((draft) => ({ ...draft, issues: Array.isArray(draft?.issues) ? draft.issues : [] })) : [],
});

const normalizeHomeData = (raw) => ({
  ...(raw || {}),
  featuredWorks: Array.isArray(raw?.featuredWorks) ? raw.featuredWorks : [],
  dynamicStatement: {
    ...DEFAULT_DYNAMIC_STATEMENT,
    ...(raw?.dynamicStatement || {}),
    pairs: Array.isArray(raw?.dynamicStatement?.pairs)
      ? raw.dynamicStatement.pairs.slice(0, 8)
      : DEFAULT_DYNAMIC_STATEMENT.pairs,
  },
  experience: {
    ...DEFAULT_HOME_EXPERIENCE,
    ...(raw?.experience || {}),
    dialogue: Array.isArray(raw?.experience?.dialogue) && raw.experience.dialogue.length ? raw.experience.dialogue : DEFAULT_HOME_EXPERIENCE.dialogue,
  },
  visitorIntroduction: normalizeVisitorIntroduction(raw?.visitorIntroduction),
});

const normalizeZineData = (raw) => ({ ...DEFAULT_ZINE, ...(raw || {}), entries: Array.isArray(raw?.entries) ? raw.entries : [] });
const normalizeMiniGameData = (raw) => ({
  ...DEFAULT_MINI_GAME,
  ...(raw || {}),
  rules: { ...DEFAULT_MINI_GAME.rules, ...(raw?.rules || {}) },
  scoreSettings: { ...DEFAULT_MINI_GAME.scoreSettings, ...(raw?.scoreSettings || {}) },
  gradeTitles: Array.isArray(raw?.gradeTitles) && raw.gradeTitles.length ? raw.gradeTitles : DEFAULT_MINI_GAME.gradeTitles,
  gameSlots: Array.isArray(raw?.gameSlots) ? raw.gameSlots.map((slot, index) => emptyMiniGameSlot(index + 2, slot)) : [],
  drafts: Array.isArray(raw?.drafts) ? raw.drafts.map((draft) => ({ ...draft, issues: Array.isArray(draft?.issues) ? draft.issues : [] })) : DEFAULT_RED_PEN_DRAFTS,
});

const phraseOccurrences = (text, phrase) => {
  if (!phrase) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = text.indexOf(phrase, cursor)) !== -1) {
    count += 1;
    cursor += phrase.length;
  }
  return count;
};

const redPenDraftErrors = (draft) => (draft?.issues || []).flatMap((issue, issueIndex) => {
  const phrase = String(issue?.phrase || '').trim();
  if (!phrase) return [`Koreksi ${issueIndex + 1}: frasa bermasalah masih kosong.`];
  const count = phraseOccurrences(draft?.passage || '', phrase);
  if (count === 0) return [`Koreksi ${issueIndex + 1}: frasa “${phrase}” tidak ditemukan persis di paragraf.`];
  if (count > 1) return [`Koreksi ${issueIndex + 1}: frasa “${phrase}” muncul ${count} kali. Buat frasanya lebih spesifik.`];
  if (!String(issue?.replacement || '').trim()) return [`Koreksi ${issueIndex + 1}: pengganti/kata “hapus” belum diisi.`];
  return [];
}).concat(!String(draft?.passage || '').trim() ? ['Paragraf masih kosong.'] : [], !(draft?.issues || []).length ? ['Tambahkan minimal satu koreksi editorial.'] : []);

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

const normalizeAboutData = (raw) => ({
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

const DEFAULT_CONTACT = {
  eyebrow: 'NEW DOCUMENT / CONTACT',
  heading: 'Every collaboration begins with an unfinished sentence.',
  subheading: "Tell me what you're trying to make. We can revise the rest together.",
  email: '', location: 'Batam, Indonesia',
  draftButtonLabel: 'Create Email Draft',
  responseNote: 'Draft created — review before sending.',
  inquiryPaths: [
    { id: 'project', kind: 'project', label: 'Start a project', subject: 'Project Inquiry', enabled: true },
    { id: 'opportunity', kind: 'opportunity', label: 'Offer an opportunity', subject: 'Opportunity', enabled: true },
    { id: 'hello', kind: 'hello', label: 'Just say hello', subject: 'Hello', enabled: true },
  ],
  serviceOptions: ['Writing', 'Editing', 'Directing', 'Creative Development'],
  stageOptions: ['Just an idea', 'In progress', 'Ready to begin'],
  timelineOptions: ['Flexible', 'This month', 'Specific date'],
  properties: [
    { id: 'status', label: 'Status', value: 'Open for selected projects', enabled: true },
    { id: 'based', label: 'Based in', value: 'Batam, Indonesia', enabled: true },
    { id: 'mode', label: 'Working mode', value: 'Remote / Batam-based', enabled: true },
    { id: 'response', label: 'Response', value: 'Usually within 1–3 days', enabled: true },
    { id: 'fit', label: 'Best fit', value: 'Writing, editing, directing, creative development', enabled: true },
  ],
  socials: [], actionButtons: [],
};

const normalizeContactData = (raw) => ({
  ...DEFAULT_CONTACT, ...(raw || {}),
  inquiryPaths: Array.isArray(raw?.inquiryPaths) && raw.inquiryPaths.length ? raw.inquiryPaths : DEFAULT_CONTACT.inquiryPaths,
  serviceOptions: Array.isArray(raw?.serviceOptions) && raw.serviceOptions.length ? raw.serviceOptions : DEFAULT_CONTACT.serviceOptions,
  stageOptions: Array.isArray(raw?.stageOptions) && raw.stageOptions.length ? raw.stageOptions : DEFAULT_CONTACT.stageOptions,
  timelineOptions: Array.isArray(raw?.timelineOptions) && raw.timelineOptions.length ? raw.timelineOptions : DEFAULT_CONTACT.timelineOptions,
  properties: Array.isArray(raw?.properties) && raw.properties.length ? raw.properties : DEFAULT_CONTACT.properties,
  socials: Array.isArray(raw?.socials) ? raw.socials : [],
  actionButtons: Array.isArray(raw?.actionButtons) ? raw.actionButtons : [],
});

// Kategori Career SEKARANG bebas ditambah/dihapus/diubah namanya lewat CMS (gak lagi
// di-hardcode Professional/School/College). Tiap kategori punya `type`:
//  - 'career': format lama — Posisi @ Instansi, periode, pop-up detail instansi.
//  - 'credential': format baru — nama pencapaian/sertifikat, penyelenggara, tanggal,
//    gambar bukti, link verifikasi (buat Achievements/Certificates/dll).
const CAREER_TYPE_LABEL = {
  career: 'Riwayat (Posisi @ Instansi)',
  credential: 'Pencapaian / Sertifikat',
};

const emptyCareerItem = () => ({
  id: `item-${Date.now()}`,
  role: '',
  company: '',
  location: '',
  period: '',
  description: '',
  timelineOrder: '',
  revisionTitle: '',
  shortSummary: '',
  whatChanged: '',
  coverImage: '',
  relatedLabel: '',
  relatedUrl: '',
  hintEnabled: true,
  companyInfo: { name: '', address: '', photo: '', about: '' },
});

const emptyCredentialItem = () => ({
  id: `cred-${Date.now()}`,
  title: '',
  author: '',
  publisher: '',
  publicationDate: '',
  isbn: '',
  edition: '',
  issuer: '',
  date: '',
  image: '',
  description: '',
  verifyUrl: '',
  showOnTimeline: false,
  timelineOrder: '',
  revisionTitle: '',
  whatChanged: '',
  hintEnabled: true,
});

const emptyCareerCategory = (type = 'career') => ({
  id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  type,
  bgImage: '',
  items: [],
});

// Jaga-jaga: data career di Supabase bisa aja masih format LAMA (key tetap
// school/college/professional, masing-masing { bgImage, items } atau array polos),
// sementara format BARU butuh { heading, subheading, categories: [...] }. Fungsi ini
// nyamain semua kemungkinan bentuk lama jadi format baru — kategori "school" SENGAJA
// didrop (dianggap gak relevan lagi), Professional & College dipertahankan.
function normalizeCareerData(raw) {
  const careerData = raw || {};

  const professionalFirst = (categories) => [...categories].sort((a, b) => {
    const aProfessional = String(a.name || '').trim().toLowerCase() === 'professional' || a.id === 'professional';
    const bProfessional = String(b.name || '').trim().toLowerCase() === 'professional' || b.id === 'professional';
    return Number(bProfessional) - Number(aProfessional);
  });

  if (Array.isArray(careerData.categories)) {
    return {
      heading: careerData.heading || '',
      subheading: careerData.subheading || '',
      archiveTitle: careerData.archiveTitle || '',
      archiveIntro: careerData.archiveIntro || '',
      archiveButtonLabel: careerData.archiveButtonLabel || '',
      credentialsButtonLabel: careerData.credentialsButtonLabel || '',
      categories: professionalFirst(careerData.categories.map((cat) => ({
        id: cat.id || emptyCareerCategory().id,
        name: cat.name || '',
        type: cat.type === 'credential' ? 'credential' : 'career',
        bgImage: cat.bgImage || '',
        items: Array.isArray(cat.items) ? cat.items : [],
      }))),
    };
  }

  const legacyToCategory = (raw, id, name) => {
    const legacy = Array.isArray(raw) ? { bgImage: '', items: raw } : (raw || {});
    return {
      id,
      name,
      type: 'career',
      bgImage: legacy.bgImage || '',
      items: Array.isArray(legacy.items) ? legacy.items : [],
    };
  };

  return {
    heading: careerData.heading || '',
    subheading: careerData.subheading || '',
    archiveTitle: careerData.archiveTitle || '',
    archiveIntro: careerData.archiveIntro || '',
    archiveButtonLabel: careerData.archiveButtonLabel || '',
    credentialsButtonLabel: careerData.credentialsButtonLabel || '',
    categories: professionalFirst([
      legacyToCategory(careerData.professional, 'professional', 'Professional'),
      legacyToCategory(careerData.college, 'college', 'College'),
    ]),
  };
}

// Sama kayak career: jaga-jaga data books di Supabase masih array polos yang lama,
// padahal format baru butuh { heading, subheading, items }.
function normalizeBooksData(raw) {
  if (Array.isArray(raw)) return { heading: '', subheading: '', items: raw };
  if (raw && typeof raw === 'object') {
    return {
      heading: raw.heading || '',
      subheading: raw.subheading || '',
      items: Array.isArray(raw.items) ? raw.items : [],
    };
  }
  return { heading: '', subheading: '', items: [] };
}

const emptyBook = () => ({
  id: `book-${Date.now()}`,
  title: '',
  myRoles: '',
  category: '',
  status: 'draft',
  year: '',
  language: 'Indonesia',
  format: '',
  pitch: '',
  whyWritten: '',
  origin: '',
  coreQuestion: '',
  writtenDuring: '',
  almostDeleted: '',
  progress: '',
  featured: false,
  startHere: false,
  summary: '',
  fullDescription: '',
  coverImage: '',
  overviewImage: '',
  pageCount: '',
  actionText: '',
  actionUrl: '',
  secondaryText: '',
  secondaryUrl: '',
  hintEnabled: true,
});

const emptyArticle = () => ({
  id: `art-${Date.now()}`,
  title: '',
  date: '',
  category: '',
  author: '',
  snippet: '',
  content: '',
  image: '',
  hintEnabled: true,
});

const emptyPosterItem = () => ({
  id: `poster-item-${Date.now()}`,
  title: '',
  category: '',
  dimensions: '',
  imageUrl: '',
  description: '',
  hintEnabled: true,
});

const emptyDirectingItem = () => ({
  id: `film-${Date.now()}`,
  title: '', premise: '', role: 'Director', year: '', runtime: '',
  mediaType: 'youtube', mediaUrl: '', posterImage: '',
  contribution: '', credits: '', externalLabel: '', externalUrl: '', hintEnabled: true,
});

// Tab tambahan bebas (di luar Articles & Poster bawaan) — tiap tab punya nama sendiri
// (label yang tampil di navigasi) + daftar kartu sederhana di dalamnya.
// `wordContent` = HTML hasil convert dari file .docx yang di-upload (BUKAN file
// mentahnya yang disimpen — cuma teksnya, udah dikonversi sekali pas upload di CMS,
// jadi pas ditampilin ke publik gak perlu convert ulang tiap buka halaman). Isinya
// dipake gantiin `description` di tampilan detail kalau ada (lihat Projects.jsx).
// `wordFileName` cuma buat ditampilin di CMS ini doang (biar admin tau file mana yang
// udah ke-upload), gak ikut dipake di halaman publik.
const emptyCustomItem = () => ({
  id: `custom-item-${Date.now()}`,
  title: '',
  category: '',
  imageUrl: '',
  description: '',
  wordContent: '',
  wordFileName: '',
  url: '',
  buttonLabel: '',
  dimensions: '',
  mediaType: 'youtube',
  mediaUrl: '',
  role: '',
  year: '',
  runtime: '',
  credits: '',
  fileUrl: '',
  fileName: '',
  hintEnabled: true,
});

const emptyCustomSection = (label = '') => ({
  id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  label,
  contentType: 'writing',
  // 'gallery' = grid foto (perilaku lama/default, buat poster/dokumentasi visual).
  // 'articles' = tampilan gaya portal berita kayak tab Articles (kartu unggulan besar +
  // daftar kecil), buat tab tambahan yang konteksnya tulisan (esai, cerpen, dll).
  layout: 'gallery',
  items: [],
});

// Jaga-jaga: data projects di Supabase bisa aja masih format lama:
//  - projects.posters: array polos (format paling lama)
//  - projects.gallery: { poster: [...], photo: [...] } (format sebelum ada Sub Bab)
//  - projects.poster.subBabs: array sub bab, tiap sub bab punya items sendiri
//    (format saat Poster masih dikelompokkan per Sub Bab — fitur ini udah dihapus)
// Semua itu dimigrasiin otomatis jadi format baru: projects.poster.items (array
// poster polos, langsung tanpa pengelompokan). Item dari semua sub bab lama
// digabung jadi 1 daftar biar gak ada yang ilang.
// `photo` SENGAJA gak dimigrasiin lagi — fitur Photo udah dihapus dari CMS & halaman publik.
function normalizeProjectsData(raw) {
  const projects = raw || {};
  const articles = Array.isArray(projects.articles) ? projects.articles : [];

  let items;
  if (projects.poster && Array.isArray(projects.poster.items)) {
    // Format terbaru — sudah flat, tinggal pastiin array
    items = projects.poster.items;
  } else if (projects.poster && Array.isArray(projects.poster.subBabs)) {
    // Format lama (per Sub Bab) — gabungin semua item dari tiap sub bab jadi 1 daftar
    items = projects.poster.subBabs.flatMap((sb) => (Array.isArray(sb.items) ? sb.items : []));
  } else {
    // Format lebih lama lagi: gallery.poster atau projects.posters
    items = Array.isArray(projects.gallery?.poster)
      ? projects.gallery.poster
      : Array.isArray(projects.posters)
      ? projects.posters
      : [];
  }

  return {
    heading: projects.heading || '',
    subheading: projects.subheading || '',
    // Label tab navigasi buat Articles & Poster — kosong berarti pakai default
    // ('Articles'/'Poster') di halaman publik.
    articlesLabel: projects.articlesLabel || '',
    directingLabel: projects.directingLabel || '',
    posterLabel: projects.posterLabel || '',
    articles,
    directing: { items: Array.isArray(projects.directing?.items) ? projects.directing.items : [] },
    poster: { items },
    // Tab tambahan bebas (di luar Articles & Poster) — kalau data lama belum punya
    // field ini sama sekali, defaultnya array kosong (bukan ilang pas disave ulang).
    customSections: Array.isArray(projects.customSections)
      ? projects.customSections.map((s) => ({
          id: s.id || emptyCustomSection().id,
          label: s.label || '',
          contentType: ['writing', 'video', 'image', 'document', 'link'].includes(s.contentType)
            ? s.contentType
            : (s.layout === 'articles' ? 'writing' : 'image'),
          layout: s.layout === 'articles' ? 'articles' : 'gallery',
          items: Array.isArray(s.items) ? s.items : [],
        }))
      : [],
  };
}

/* Input & textarea kecil biar gak nulis className berulang-ulang */
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded";
const inputClsSm = "w-full px-3 py-1.5 text-xs bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded";

// Tetap di module scope supaya tombol toolbar tidak dianggap sebagai tipe komponen
// baru setiap RichTextEditor merender ulang (misalnya saat URL link sedang diketik).
function ToolbarBtn({ onClick, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
      className="px-2 py-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
    >
      {children}
    </button>
  );
}

// Editor teks kaya (rich text) sederhana pakai contentEditable bawaan browser — gak butuh
// library tambahan. Isinya disimpen & di-onChange sebagai string HTML (bukan plain text),
// biar Bold/Italic/Underline/dll yang lo pake di sini kebawa pas ditampilin di halaman publik.
//
// PENTING soal cara kerjanya: initialValue cuma dipasang SEKALI pas komponen ini pertama
// kali muncul (lewat useEffect kosong deps-nya) — SENGAJA gak disinkron ulang tiap kali
// value berubah, karena kalau disinkron ulang tiap ketikan, kursor bakal lompat balik ke
// awal terus (masalah klasik contentEditable yang dikontrol React). Makanya, tiap
// pindah/tambah artikel, pasang prop `key` yang beda (pake id artikelnya) di tempat
// manggil <RichTextEditor> ini, biar React bikin instance baru yang initial value-nya bener.
function RichTextEditor({ initialValue, onChange, placeholder }) {
  const ref = useRef(null);
  const savedSelection = useRef(null);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialValue || '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && ref.current?.contains(selection.anchorNode)) {
      savedSelection.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedSelection.current) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelection.current);
  };

  const exec = (command, arg = null) => {
    restoreSelection();
    document.execCommand(command, false, arg);
    ref.current?.focus();
    rememberSelection();
    onChange(ref.current.innerHTML);
  };

  const handleLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    exec('createLink', url);
    setLinkUrl('');
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1e1e1e] overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2d2d2d] px-1 py-1">
        <select onMouseDown={(e) => { rememberSelection(); e.stopPropagation(); }} onChange={(e) => { exec('formatBlock', e.target.value); e.target.value = 'p'; }} defaultValue="p" title="Text style" className="mr-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]">
          <option value="p">Normal</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option>
        </select>
        <ToolbarBtn onClick={() => exec('bold')} title="Bold"><span className="font-bold">B</span></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('italic')} title="Italic"><span className="italic">I</span></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('underline')} title="Underline"><span className="underline">U</span></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('strikeThrough')} title="Strikethrough"><span className="line-through">S</span></ToolbarBtn>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Bullet List">• List</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Numbered List">1. List</ToolbarBtn>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarBtn onClick={() => exec('justifyLeft')} title="Rata kiri">≡←</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyCenter')} title="Rata tengah">≡</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyRight')} title="Rata kanan">→≡</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyFull')} title="Justify">☰</ToolbarBtn>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarBtn onClick={() => exec('undo')} title="Undo">↶</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('redo')} title="Redo">↷</ToolbarBtn>
        <input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onMouseDown={(event) => { const selection = window.getSelection(); if (selection?.rangeCount) savedSelection.current = selection.getRangeAt(0).cloneRange(); event.stopPropagation(); }} placeholder="https://..." className="ml-1 w-28 rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]" />
        <ToolbarBtn onClick={handleLink} title="Insert Link">🔗 Link</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('removeFormat')} title="Clear Formatting">Clear</ToolbarBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        className="min-h-[140px] px-3 py-2 text-xs leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  );
}

// Upload file gambar dari perangkat/galeri lo ke Supabase Storage, terus balikin
// URL publiknya. Dulu ini nyimpen base64 langsung ke data (bikin data super berat),
// sekarang cuma nyimpen link-nya aja.
const dispatchCmsNotice = (message) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cms-notice', { detail: message }));
};

const PROJECT_COVER_GUIDES = {
  writing: { text: '1600 × 1000 px (16:10) · WebP/JPG · ideal ≤ 350 KB · maksimal 700 KB', maxBytes: 700 * 1024 },
  video: { text: '1600 × 900 px (16:9) · WebP/JPG · ideal ≤ 350 KB · maksimal 700 KB', maxBytes: 700 * 1024 },
  image: { text: 'Sisi panjang 1600 px, rasio asli · WebP/JPG · ideal ≤ 500 KB · maksimal 1 MB', maxBytes: 1024 * 1024 },
  document: { text: '1600 × 1000 px (16:10) · WebP/JPG · ideal ≤ 350 KB · maksimal 700 KB', maxBytes: 700 * 1024 },
  link: { text: '1600 × 1000 px (16:10) · WebP/JPG · ideal ≤ 350 KB · maksimal 700 KB', maxBytes: 700 * 1024 },
};

const getProjectCoverGuide = (contentType = 'writing') => PROJECT_COVER_GUIDES[contentType] || PROJECT_COVER_GUIDES.writing;

function validateProjectCover(file, contentType = 'writing') {
  const guide = getProjectCoverGuide(contentType);
  if (!file?.type?.startsWith('image/')) {
    dispatchCmsNotice('File cover harus berupa gambar, mang. Pakai WebP atau JPG.');
    return false;
  }
  if (file.size > guide.maxBytes) {
    dispatchCmsNotice(`Cover terlalu berat. Patokan: ${guide.text}`);
    return false;
  }
  return true;
}

function ProjectCoverHint({ contentType = 'writing' }) {
  return <p className="mt-1 text-[10px] leading-relaxed text-gray-400">Cover: {getProjectCoverGuide(contentType).text}</p>;
}

async function uploadImageToStorage(file) {
  if (!file) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(fileName, file);

  if (error) {
    console.error('Gagal upload gambar:', error);
    dispatchCmsNotice('Upload gambar gagal, mang. Cek koneksi internet atau coba lagi.');
    return null;
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// Convert file .docx (Word) yang di-upload admin jadi HTML, dipakai buat isi cerpen/tulisan
// panjang di Tab Tambahan Projects. Jalan di browser (client-side), gak lewat server —
// mammoth baca ArrayBuffer file-nya langsung terus keluarin HTML (paragraf, bold/italic,
// heading, list dasar ikut kebawa; format kompleks kayak gambar/tabel di dalam docx-nya
// gak didukung mammoth, bakal di-skip). Hasil HTML ini yang DISIMPEN ke data (bukan file
// .docx mentahnya) — jadi pas halaman publik dibuka, tinggal render HTML-nya langsung,
// gak perlu convert ulang tiap kali (lebih cepet & gak butuh mammoth di sisi pengunjung).
async function convertWordFileToHtml(file) {
  if (!file) return null;
  try {
    // Mammoth cukup besar. Muat hanya saat admin benar-benar memilih file .docx,
    // jangan ikut membebani bundle halaman publik.
    const { default: mammoth } = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value; // string HTML
  } catch (err) {
    console.error('Gagal convert file Word:', err);
    dispatchCmsNotice('Gagal baca file Word ini, mang. Pastiin formatnya .docx (bukan .doc lama) dan coba lagi.');
    return null;
  }
}

export default function CmsDashboard({ data, onSave }) {
  // Salinan lokal yang bisa diedit bebas — baru dikirim ke portfolioData asli pas Save ditekan.
  const [formData, setFormData] = useState(() => {
    const cloned = JSON.parse(JSON.stringify(data));
    return {
      ...cloned,
      home: normalizeHomeData(cloned.home),
      about: normalizeAboutData(cloned.about),
      career: normalizeCareerData(cloned.career),
      books: normalizeBooksData(cloned.books),
      projects: normalizeProjectsData(cloned.projects),
      zine: normalizeZineData(cloned.zine),
      miniGame: normalizeMiniGameData(cloned.miniGame),
      interactiveWords: Array.isArray(cloned.interactiveWords) ? cloned.interactiveWords : [],
      general: normalizeGeneral(cloned.general),
    };
  });
  // null = layar menu utama (pilih salah satu dari 6 tab dulu sebelum masuk ke isinya)
  const [activeTab, setActiveTab] = useState(null);
  const [cmsSection, setCmsSection] = useState(null);
  const [activeMiniGameEditor, setActiveMiniGameEditor] = useState(null);
  // Sub-tab DI DALAM panel "Projects": 'articles' | 'poster' | 'custom'. Dipisah biar
  // admin gak harus scroll ngelewatin Articles+Poster+Tab Tambahan sekaligus dalam 1
  // halaman panjang — cuma 1 section yang di-render/kelihatan dalam satu waktu, mirip
  // nav Articles/Poster di halaman publiknya sendiri.
  const [activeProjectsSubTab, setActiveProjectsSubTab] = useState('articles');
  // Artikel mana yang lagi "dibuka" buat diedit penuh (judul, gambar, isi lengkap, dst).
  // null = semua artikel collapsed (cuma judul + tombol Edit doang). Sengaja dibikin
  // begini biar admin gak usah scroll ngelewatin artikel lain yang isinya panjang cuma
  // buat pindah ke artikel berikutnya — dan biar RichTextEditor (yang lumayan berat)
  // cuma ke-mount 1 biji dalam satu waktu, bukan sekaligus buat semua artikel.
  const [expandedArticleIdx, setExpandedArticleIdx] = useState(null);
  // Item Career mana (di kategori mana) yang lagi "dibuka" buat diedit penuh — sama
  // konsepnya kayak expandedArticleIdx di atas, tapi keynya gabungan "catIdx-idx" karena
  // Career punya banyak kategori sekaligus (bukan 1 daftar rata kayak Articles). null =
  // semua item collapsed (cuma judul singkat + tombol Edit), biar kategori yang isinya
  // banyak item gak bikin CMS numpuk panjang ke bawah.
  const [expandedCareerKey, setExpandedCareerKey] = useState(null);
  // Satu pola accordion untuk seluruh kartu konten berulang di CMS.
  // Key dibuat per daftar supaya item berbeda tidak saling membuka/menutup.
  const [expandedContentKey, setExpandedContentKey] = useState(null);
  const toggleContentCard = (key) => setExpandedContentKey((current) => current === key ? null : key);
  // Kategori Career mana yang lagi ditampilin (id kategori) — sama konsepnya kayak
  // activeProjectsSubTab: cuma 1 kategori yang keliatan isinya dalam satu waktu, sisanya
  // disembunyiin di balik pill tab. null = fallback ke kategori pertama (lihat currentCareerCatIdx
  // di render). Direset ke null kalau kategori yang lagi aktif dihapus.
  const [activeCareerCategory, setActiveCareerCategory] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  // Nyimpen kategori career mana yang lagi proses upload bgImage-nya (biar spinner-nya per-kategori)
  const [uploadingCareerBg, setUploadingCareerBg] = useState(null);
  // Kunci berupa "kategori-idx" buat nandain item mana yang lagi upload foto instansinya
  const [uploadingCompanyPhoto, setUploadingCompanyPhoto] = useState(null);
  // Index buku yang lagi proses upload cover-nya
  const [uploadingBookCover, setUploadingBookCover] = useState(null);
  // Index buku yang lagi proses upload foto overview-nya (halaman kiri pas dibuka)
  const [uploadingBookOverview, setUploadingBookOverview] = useState(null);
  // Index artikel yang lagi proses upload gambarnya
  const [uploadingArticleImage, setUploadingArticleImage] = useState(null);
  // Index tombol aksi (di tab Contact) yang lagi proses upload file-nya (mis. PDF resume)
  const [uploadingActionButton, setUploadingActionButton] = useState(null);
  // Kunci berupa "poster-{itemIdx}" buat nandain item poster mana yang lagi upload
  const [uploadingGalleryImage, setUploadingGalleryImage] = useState(null);
  // Kunci berupa "{sectionIdx}-{itemIdx}" buat nandain item di tab tambahan (custom section)
  // mana yang lagi proses upload gambarnya
  const [uploadingCustomImage, setUploadingCustomImage] = useState(null);
  // Sama kayak uploadingCustomImage di atas (key: "sectionIdx-itemIdx"), tapi buat proses
  // convert file .docx → HTML yang lagi jalan di item mana.
  const [convertingCustomWord, setConvertingCustomWord] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [notice, setNotice] = useState('');
  const [zineInbox, setZineInbox] = useState([]);
  const [zineInboxLoading, setZineInboxLoading] = useState(false);
  const [zineInboxError, setZineInboxError] = useState('');
  const [moderatingZineId, setModeratingZineId] = useState(null);
  useEffect(() => {
    const handleNotice = (event) => setNotice(String(event.detail || 'Terjadi kesalahan.'));
    window.addEventListener('cms-notice', handleNotice);
    return () => window.removeEventListener('cms-notice', handleNotice);
  }, []);

  const loadZineInbox = async () => {
    setZineInboxLoading(true);
    setZineInboxError('');
    try {
      setZineInbox(await getZineModerationQueue());
    } catch (error) {
      console.error('Gagal memuat inbox Zine:', error);
      setZineInboxError('Inbox belum bisa dibaca. Pastikan SQL policy lanjutan sudah dijalankan dan akun admin sedang login.');
    } finally {
      setZineInboxLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'zine') loadZineInbox();
  }, [activeTab]);

  const editInboxZine = (id, body) => setZineInbox((current) => current.map((entry) => entry.id === id ? { ...entry, body } : entry));
  const moderateInboxZine = async (entry, status) => {
    const body = String(entry.body || '').trim();
    if (!body) {
      setZineInboxError('Isi Zine tidak boleh kosong.');
      return;
    }
    setModeratingZineId(entry.id);
    setZineInboxError('');
    try {
      const updated = await moderateZineSubmission(entry.id, { body, status });
      setZineInbox((current) => current.map((item) => item.id === entry.id ? updated : item));
    } catch (error) {
      console.error('Gagal memoderasi Zine:', error);
      setZineInboxError('Perubahan gagal disimpan. Periksa policy admin Supabase dan coba lagi.');
    } finally {
      setModeratingZineId(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const miniGamesToValidate = [formData.miniGame, ...(formData.miniGame?.gameSlots || [])];
    const invalidDrafts = miniGamesToValidate.flatMap((game) => (game?.drafts || []).flatMap((draft, index) => draft.enabled === false ? [] : redPenDraftErrors(draft).map((error) => `${game.gameName || 'Game baru'} · Draft ${index + 1}: ${error}`)));
    if (invalidDrafts.length) {
      setActiveTab('miniGame');
      setNotice(`Mini Game belum bisa disimpan. ${invalidDrafts[0]}`);
      return;
    }
    setIsSaving(true);
    const cleanData = { ...formData };
    delete cleanData.odds;
    delete cleanData.quotes;
    const success = await onSave(cleanData);
    setIsSaving(false);
    if (success === false) {
      setNotice('Gagal simpan perubahan. Cek koneksi internet lo dan coba lagi.');
      return;
    }
    // Berhasil disimpan — balik ke menu pilih tab, TETEP di dalem admin mode.
    // Keluar dari admin mode sepenuhnya cuma lewat tombol "Exit Admin" di TitleBar.
    setActiveTab(null);
  };

  const handleCancel = () => setShowCancelConfirm(true);

  const discardChanges = () => {
    const cloned = JSON.parse(JSON.stringify(data));
    setFormData({
      ...cloned,
      home: normalizeHomeData(cloned.home),
      about: normalizeAboutData(cloned.about),
      career: normalizeCareerData(cloned.career),
      books: normalizeBooksData(cloned.books),
      projects: normalizeProjectsData(cloned.projects),
      contact: normalizeContactData(cloned.contact),
      zine: normalizeZineData(cloned.zine),
      miniGame: normalizeMiniGameData(cloned.miniGame),
      interactiveWords: Array.isArray(cloned.interactiveWords) ? cloned.interactiveWords : [],
      general: normalizeGeneral(cloned.general),
    });
    setActiveTab(null);
    setCmsSection(null);
    setActiveMiniGameEditor(null);
    setShowCancelConfirm(false);
  };

  /* ============ HOME ============ */
  const setHome = (field, value) =>
    setFormData((p) => ({ ...p, home: { ...p.home, [field]: value } }));

  const setDynamicStatement = (field, value) =>
    setFormData((previous) => ({
      ...previous,
      home: {
        ...previous.home,
        dynamicStatement: { ...previous.home.dynamicStatement, [field]: value },
      },
    }));

  const setDynamicPair = (index, field, value) =>
    setFormData((previous) => {
      const pairs = [...(previous.home.dynamicStatement.pairs || [])];
      pairs[index] = { ...(pairs[index] || {}), [field]: value };
      return { ...previous, home: { ...previous.home, dynamicStatement: { ...previous.home.dynamicStatement, pairs } } };
    });

  const addDynamicPair = () =>
    setFormData((previous) => ({
      ...previous,
      home: {
        ...previous.home,
        dynamicStatement: {
          ...previous.home.dynamicStatement,
          pairs: [...(previous.home.dynamicStatement.pairs || []), { source: '', result: '' }].slice(0, 8),
        },
      },
    }));

  const removeDynamicPair = (index) =>
    setFormData((previous) => ({
      ...previous,
      home: {
        ...previous.home,
        dynamicStatement: {
          ...previous.home.dynamicStatement,
          pairs: (previous.home.dynamicStatement.pairs || []).filter((_, pairIndex) => pairIndex !== index),
        },
      },
    }));

  const moveDynamicPair = (index, direction) =>
    setFormData((previous) => {
      const pairs = [...(previous.home.dynamicStatement.pairs || [])];
      const target = index + direction;
      if (target < 0 || target >= pairs.length) return previous;
      [pairs[index], pairs[target]] = [pairs[target], pairs[index]];
      return { ...previous, home: { ...previous.home, dynamicStatement: { ...previous.home.dynamicStatement, pairs } } };
    });

  const setVisitorIntroduction = (field, value) => setFormData((previous) => ({
    ...previous,
    home: {
      ...previous.home,
      visitorIntroduction: { ...previous.home.visitorIntroduction, [field]: value },
    },
  }));
  const setZine = (field, value) => setFormData((previous) => ({ ...previous, zine: { ...previous.zine, [field]: value } }));
  const updateZineEntry = (index, patch) => setFormData((previous) => {
    const entries = [...previous.zine.entries];
    entries[index] = { ...entries[index], ...patch };
    return { ...previous, zine: { ...previous.zine, entries } };
  });
  const addZineEntry = () => setFormData((previous) => ({ ...previous, zine: { ...previous.zine, entries: [...previous.zine.entries, { id: `zine-${Date.now()}`, label: 'Zine for a stranger', title: '', author: '', body: '', published: true }] } }));
  const removeZineEntry = (index) => setFormData((previous) => ({ ...previous, zine: { ...previous.zine, entries: previous.zine.entries.filter((_, itemIndex) => itemIndex !== index) } }));

  const activeMiniGameSlotIndex = typeof activeMiniGameEditor === 'string' && activeMiniGameEditor.startsWith('slot-')
    ? Number(activeMiniGameEditor.slice(5))
    : -1;
  const editingMiniGame = activeMiniGameSlotIndex >= 0
    ? formData.miniGame.gameSlots?.[activeMiniGameSlotIndex] || emptyMiniGameSlot(activeMiniGameSlotIndex + 2)
    : formData.miniGame;
  const updateEditingMiniGame = (updater) => setFormData((previous) => {
    if (activeMiniGameSlotIndex < 0) {
      const nextGame = typeof updater === 'function' ? updater(previous.miniGame) : updater;
      return { ...previous, miniGame: nextGame };
    }
    const gameSlots = [...(previous.miniGame.gameSlots || [])];
    const current = gameSlots[activeMiniGameSlotIndex] || emptyMiniGameSlot(activeMiniGameSlotIndex + 2);
    gameSlots[activeMiniGameSlotIndex] = typeof updater === 'function' ? updater(current) : updater;
    return { ...previous, miniGame: { ...previous.miniGame, gameSlots } };
  });
  const setMiniGame = (field, value) => updateEditingMiniGame((game) => ({ ...game, [field]: value }));
  const addMiniGameSlot = () => setFormData((previous) => ({
    ...previous,
    miniGame: {
      ...previous.miniGame,
      gameSlots: [
        ...(previous.miniGame.gameSlots || []),
        emptyMiniGameSlot((previous.miniGame.gameSlots || []).length + 2),
      ],
    },
  }));
  const removeMiniGameSlot = (index) => setFormData((previous) => ({
    ...previous,
    miniGame: { ...previous.miniGame, gameSlots: (previous.miniGame.gameSlots || []).filter((_, slotIndex) => slotIndex !== index) },
  }));
  const setMiniGameRule = (field, value) => updateEditingMiniGame((game) => ({ ...game, rules: { ...game.rules, [field]: value } }));
  const setMiniGameScore = (field, value) => updateEditingMiniGame((game) => ({ ...game, scoreSettings: { ...game.scoreSettings, [field]: Math.max(0, Number(value) || 0) } }));
  const updateGradeTitle = (index, patch) => updateEditingMiniGame((game) => {
    const gradeTitles = [...game.gradeTitles];
    gradeTitles[index] = { ...gradeTitles[index], ...patch };
    return { ...game, gradeTitles };
  });
  const updateGameDraft = (index, patch) => updateEditingMiniGame((game) => {
    const drafts = [...game.drafts];
    drafts[index] = { ...drafts[index], ...patch };
    return { ...game, drafts };
  });
  const addGameDraft = () => updateEditingMiniGame((game) => ({ ...game, drafts: [...game.drafts, { id: `game-draft-${Date.now()}`, label: `Draft ${game.drafts.length + 1}`, enabled: true, passage: '', issues: [] }] }));
  const removeGameDraft = (index) => updateEditingMiniGame((game) => ({ ...game, drafts: game.drafts.filter((_, itemIndex) => itemIndex !== index) }));
  const addGameIssue = (draftIndex) => updateEditingMiniGame((game) => {
    const drafts = [...game.drafts];
    const issues = [...(drafts[draftIndex].issues || []), { id: `issue-${Date.now()}`, phrase: '', replacement: '', explanation: '' }];
    drafts[draftIndex] = { ...drafts[draftIndex], issues };
    return { ...game, drafts };
  });
  const updateGameIssue = (draftIndex, issueIndex, patch) => updateEditingMiniGame((game) => {
    const drafts = [...game.drafts];
    const issues = [...(drafts[draftIndex].issues || [])];
    issues[issueIndex] = { ...issues[issueIndex], ...patch };
    drafts[draftIndex] = { ...drafts[draftIndex], issues };
    return { ...game, drafts };
  });
  const removeGameIssue = (draftIndex, issueIndex) => updateEditingMiniGame((game) => {
    const drafts = [...game.drafts];
    drafts[draftIndex] = { ...drafts[draftIndex], issues: (drafts[draftIndex].issues || []).filter((_, index) => index !== issueIndex) };
    return { ...game, drafts };
  });

  /* ============ GENERAL ============ */
  // Semua pengaturan di sini sifatnya site-wide (bukan punya satu halaman doang),
  // makanya field-nya dikelompokkan lewat 1 setter yang nerima nested key.
  const setWelcomeNotification = (field, value) =>
    setFormData((p) => ({
      ...p,
      general: {
        ...p.general,
        welcomeNotification: { ...p.general.welcomeNotification, [field]: value },
      },
    }));

  const setFeaturedWork = (index, patch) => setFormData((previous) => {
    const featuredWorks = [...(previous.home.featuredWorks || [])];
    featuredWorks[index] = { ...(featuredWorks[index] || {}), ...patch };
    return { ...previous, home: { ...previous.home, featuredWorks } };
  });
  const addFeaturedWork = () => setFormData((previous) => ({
    ...previous,
    home: { ...previous.home, featuredWorks: [...(previous.home.featuredWorks || []), { type: '', itemId: '', sectionId: '', teaser: '' }].slice(0, 5) },
  }));
  const removeFeaturedWork = (index) => setFormData((previous) => ({
    ...previous,
    home: { ...previous.home, featuredWorks: (previous.home.featuredWorks || []).filter((_, itemIndex) => itemIndex !== index) },
  }));

  /* ============ ABOUT ============ */
  // Author's Note dan annotation yang tampil di area abu-abu kanan.
  const setAboutField = (field, value) =>
    setFormData((p) => ({ ...p, about: { ...p.about, [field]: value } }));

  const setListeningFootnote = (field, value) =>
    setFormData((p) => ({
      ...p,
      about: {
        ...p.about,
        listeningFootnote: { ...p.about.listeningFootnote, [field]: value },
      },
    }));

  const setAuthorPropertiesField = (field, value) =>
    setFormData((p) => ({ ...p, about: { ...p.about, authorProperties: { ...p.about.authorProperties, [field]: value } } }));

  const updateAuthorProperty = (index, patch) => setFormData((p) => {
    const items = [...p.about.authorProperties.items];
    items[index] = { ...items[index], ...patch };
    return { ...p, about: { ...p.about, authorProperties: { ...p.about.authorProperties, items } } };
  });

  const addAuthorProperty = () => setFormData((p) => ({
    ...p,
    about: {
      ...p.about,
      authorProperties: {
        ...p.about.authorProperties,
        items: [...p.about.authorProperties.items, { id: `author-property-${Date.now()}`, label: '', value: '', url: '' }],
      },
    },
  }));

  const removeAuthorProperty = (index) => setFormData((p) => ({
    ...p,
    about: { ...p.about, authorProperties: { ...p.about.authorProperties, items: p.about.authorProperties.items.filter((_, itemIndex) => itemIndex !== index) } },
  }));

  /* ============ CAREER ============ */
  // Judul & sub-judul di layar menu utama halaman Career
  const setCareerHeading = (field, value) =>
    setFormData((p) => ({ ...p, career: { ...p.career, [field]: value } }));

  // Helper: update 1 kategori di dalam array career.categories berdasarkan index-nya
  const updateCareerCategory = (catIdx, updater) =>
    setFormData((p) => {
      const categories = [...p.career.categories];
      categories[catIdx] = updater(categories[catIdx]);
      return { ...p, career: { ...p.career, categories } };
    });

  // Nambah kategori baru (kosong) — tipe dipilih pas nambah, bisa diganti lagi belakangan
  const addCareerCategory = (type = 'career') => {
    const newCat = emptyCareerCategory(type);
    setActiveCareerCategory(newCat.id);
    setFormData((p) => ({
      ...p,
      career: { ...p.career, categories: [...p.career.categories, newCat] },
    }));
  };

  const removeCareerCategory = (catIdx) => {
    const removedId = formData.career.categories[catIdx]?.id;
    setActiveCareerCategory((cur) => (cur === removedId ? null : cur));
    setFormData((p) => ({
      ...p,
      career: { ...p.career, categories: p.career.categories.filter((_, i) => i !== catIdx) },
    }));
  };

  // Nama kategori yang tampil di kartu menu (bebas diganti, mis. "Professional" -> "Kerja")
  const setCareerCategoryName = (catIdx, value) =>
    updateCareerCategory(catIdx, (cat) => ({ ...cat, name: value }));

  // Tipe kartu kategori: 'career' (Posisi @ Instansi) atau 'credential' (Pencapaian/Sertifikat).
  // Ganti tipe TIDAK ngubah item yang udah ada (field yang gak relevan cuma gak dipakai di
  // tampilan publik) — biar aman kalau kepencet gak sengaja, tapi sebaiknya diisi ulang.
  const setCareerCategoryType = (catIdx, value) =>
    updateCareerCategory(catIdx, (cat) => ({ ...cat, type: value }));

  // Ganti gambar latar kartu menu kategori di halaman publik
  const setCareerBgImage = (catIdx, value) =>
    updateCareerCategory(catIdx, (cat) => ({ ...cat, bgImage: value }));

  const setCareerItemField = (catIdx, idx, field, value) =>
    updateCareerCategory(catIdx, (cat) => {
      const items = [...cat.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...cat, items };
    });

  const setCareerCompanyInfoField = (catIdx, idx, field, value) =>
    updateCareerCategory(catIdx, (cat) => {
      const items = [...cat.items];
      items[idx] = {
        ...items[idx],
        companyInfo: { ...items[idx].companyInfo, [field]: value },
      };
      return { ...cat, items };
    });

  const addCareerItem = (catIdx) => {
    const newIdx = formData.career.categories[catIdx]?.items.length ?? 0;
    setExpandedCareerKey(`${catIdx}-${newIdx}`);
    updateCareerCategory(catIdx, (cat) => ({
      ...cat,
      items: [...cat.items, cat.type === 'credential' ? emptyCredentialItem() : emptyCareerItem()],
    }));
  };

  const removeCareerItem = (catIdx, idx) => {
    setExpandedCareerKey((cur) => (cur === `${catIdx}-${idx}` ? null : cur));
    updateCareerCategory(catIdx, (cat) => ({
      ...cat,
      items: cat.items.filter((_, i) => i !== idx),
    }));
  };

  /* ============ BOOKS ============ */
  // Judul & sub-judul di halaman Book (di atas rak buku)
  const setBooksHeading = (field, value) =>
    setFormData((p) => ({ ...p, books: { ...p.books, [field]: value } }));

  const setBookField = (idx, field, value) =>
    setFormData((p) => {
      const items = [...p.books.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...p, books: { ...p.books, items } };
    });

  const addBook = () =>
    setFormData((p) => ({ ...p, books: { ...p.books, items: [...p.books.items, emptyBook()] } }));
  const removeBook = (idx) =>
    setFormData((p) => ({ ...p, books: { ...p.books, items: p.books.items.filter((_, i) => i !== idx) } }));

  /* ============ PROJECTS: ARTICLES & GALLERY (Poster/Photo) ============ */
  const setProjectsField = (field, value) =>
    setFormData((p) => ({ ...p, projects: { ...p.projects, [field]: value } }));

  const setArticleField = (idx, field, value) =>
    setFormData((p) => {
      const articles = [...p.projects.articles];
      articles[idx] = { ...articles[idx], [field]: value };
      return { ...p, projects: { ...p.projects, articles } };
    });
  const addArticle = () => {
    setExpandedArticleIdx(formData.projects.articles.length);
    setFormData((p) => ({
      ...p,
      projects: { ...p.projects, articles: [...p.projects.articles, emptyArticle()] },
    }));
  };
  const removeArticle = (idx) => {
    setExpandedArticleIdx((cur) => (cur === idx ? null : cur));
    setFormData((p) => ({
      ...p,
      projects: { ...p.projects, articles: p.projects.articles.filter((_, i) => i !== idx) },
    }));
  };

  const setDirectingItemField = (idx, field, value) =>
    setFormData((p) => {
      const items = [...p.projects.directing.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...p, projects: { ...p.projects, directing: { items } } };
    });

  // Current Manuscript dan Start Here masing-masing cuma boleh menunjuk satu buku.
  const setExclusiveBookFlag = (idx, field, checked) =>
    setFormData((p) => ({
      ...p,
      books: {
        ...p.books,
        items: p.books.items.map((item, itemIdx) => ({
          ...item,
          [field]: checked ? itemIdx === idx : (itemIdx === idx ? false : item[field]),
        })),
      },
    }));
  const addDirectingItem = () => setFormData((p) => ({
    ...p, projects: { ...p.projects, directing: { items: [...p.projects.directing.items, emptyDirectingItem()] } },
  }));
  const removeDirectingItem = (idx) => setFormData((p) => ({
    ...p, projects: { ...p.projects, directing: { items: p.projects.directing.items.filter((_, i) => i !== idx) } },
  }));

  /* ============ PROJECTS: POSTER (daftar file langsung, tanpa Sub Bab) ============ */
  const setPosterItemField = (itemIdx, field, value) =>
    setFormData((p) => {
      const items = [...p.projects.poster.items];
      items[itemIdx] = { ...items[itemIdx], [field]: value };
      return { ...p, projects: { ...p.projects, poster: { items } } };
    });
  const addPosterItem = () =>
    setFormData((p) => ({
      ...p,
      projects: { ...p.projects, poster: { items: [...p.projects.poster.items, emptyPosterItem()] } },
    }));
  const removePosterItem = (itemIdx) =>
    setFormData((p) => ({
      ...p,
      projects: {
        ...p.projects,
        poster: { items: p.projects.poster.items.filter((_, i) => i !== itemIdx) },
      },
    }));

  /* ============ PROJECTS: TAB TAMBAHAN (CUSTOM SECTIONS) ============ */
  // Nama tab-nya sendiri bebas ditentuin (mis. "Dummy Projects", "Eksperimen", dll).
  // Tiap custom section dapet pill nav sendiri (sejajar Articles/Poster) — begitu
  // ditambah, langsung pindah ke pill barunya biar bisa langsung diedit namanya,
  // gak numpuk collapsed di dalam 1 wrapper tab generik lagi.
  const addCustomSection = () => {
    const newSection = emptyCustomSection();
    setFormData((p) => ({
      ...p,
      projects: { ...p.projects, customSections: [...p.projects.customSections, newSection] },
    }));
    setActiveProjectsSubTab(`custom:${newSection.id}`);
  };
  const removeCustomSection = (sectionIdx) => {
    const removedId = formData.projects.customSections[sectionIdx]?.id;
    if (removedId && activeProjectsSubTab === `custom:${removedId}`) {
      setActiveProjectsSubTab('articles');
    }
    setFormData((p) => ({
      ...p,
      projects: { ...p.projects, customSections: p.projects.customSections.filter((_, i) => i !== sectionIdx) },
    }));
  };
  const setCustomSectionLabel = (sectionIdx, label) =>
    setFormData((p) => {
      const customSections = [...p.projects.customSections];
      customSections[sectionIdx] = { ...customSections[sectionIdx], label };
      return { ...p, projects: { ...p.projects, customSections } };
    });
  const setCustomSectionContentType = (sectionIdx, contentType) =>
    setFormData((p) => {
      const customSections = [...p.projects.customSections];
      customSections[sectionIdx] = {
        ...customSections[sectionIdx],
        contentType,
        layout: contentType === 'writing' ? 'articles' : 'gallery',
      };
      return { ...p, projects: { ...p.projects, customSections } };
    });
  const setCustomItemField = (sectionIdx, itemIdx, field, value) =>
    setFormData((p) => {
      const customSections = [...p.projects.customSections];
      const items = [...customSections[sectionIdx].items];
      items[itemIdx] = { ...items[itemIdx], [field]: value };
      customSections[sectionIdx] = { ...customSections[sectionIdx], items };
      return { ...p, projects: { ...p.projects, customSections } };
    });
  const addCustomItem = (sectionIdx) =>
    setFormData((p) => {
      const customSections = [...p.projects.customSections];
      customSections[sectionIdx] = {
        ...customSections[sectionIdx],
        items: [...customSections[sectionIdx].items, emptyCustomItem()],
      };
      return { ...p, projects: { ...p.projects, customSections } };
    });
  const removeCustomItem = (sectionIdx, itemIdx) =>
    setFormData((p) => {
      const customSections = [...p.projects.customSections];
      customSections[sectionIdx] = {
        ...customSections[sectionIdx],
        items: customSections[sectionIdx].items.filter((_, i) => i !== itemIdx),
      };
      return { ...p, projects: { ...p.projects, customSections } };
    });

  /* ============ CONTACT ============ */
  const setContactField = (field, value) =>
    setFormData((p) => ({ ...p, contact: { ...p.contact, [field]: value } }));

  const setContactListItem = (listKey, idx, patch) =>
    setFormData((p) => {
      const items = [...p.contact[listKey]];
      items[idx] = { ...items[idx], ...patch };
      return { ...p, contact: { ...p.contact, [listKey]: items } };
    });
  const addContactListItem = (listKey, item) =>
    setFormData((p) => ({ ...p, contact: { ...p.contact, [listKey]: [...p.contact[listKey], item] } }));
  const removeContactListItem = (listKey, idx) =>
    setFormData((p) => ({ ...p, contact: { ...p.contact, [listKey]: p.contact[listKey].filter((_, i) => i !== idx) } }));
  const setStringListItem = (listKey, idx, value) =>
    setFormData((p) => {
      const items = [...p.contact[listKey]]; items[idx] = value;
      return { ...p, contact: { ...p.contact, [listKey]: items } };
    });

  const setSocialField = (idx, field, value) =>
    setFormData((p) => {
      const socials = [...p.contact.socials];
      socials[idx] = { ...socials[idx], [field]: value };
      return { ...p, contact: { ...p.contact, socials } };
    });
  const addSocial = () =>
    setFormData((p) => ({
      ...p,
      contact: { ...p.contact, socials: [...p.contact.socials, { name: '', url: '', label: '' }] },
    }));
  const removeSocial = (idx) =>
    setFormData((p) => ({
      ...p,
      contact: { ...p.contact, socials: p.contact.socials.filter((_, i) => i !== idx) },
    }));

  const setActionButtonField = (idx, field, value) =>
    setFormData((p) => {
      const buttons = [...p.contact.actionButtons];
      buttons[idx] = { ...buttons[idx], [field]: value };
      return { ...p, contact: { ...p.contact, actionButtons: buttons } };
    });
  const addActionButton = () =>
    setFormData((p) => ({
      ...p,
      contact: {
        ...p.contact,
        actionButtons: [...p.contact.actionButtons, { label: '', url: '', primary: false, body: '' }],
      },
    }));
  const removeActionButton = (idx) =>
    setFormData((p) => ({
      ...p,
      contact: { ...p.contact, actionButtons: p.contact.actionButtons.filter((_, i) => i !== idx) },
    }));

  /* ============ REORDER (Articles & Poster items) ============ */
  // listKey: 'articles' ATAU 'poster' — nyimpen daftar mana yang lagi diurutin
  const dragInfo = useRef({ listKey: null, index: null });
  const [draggingKey, setDraggingKey] = useState(null);

  const reorderList = (listKey, fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    if (listKey === 'articles') {
      setFormData((p) => {
        if (toIdx >= p.projects.articles.length) return p;
        const articles = [...p.projects.articles];
        const [moved] = articles.splice(fromIdx, 1);
        articles.splice(toIdx, 0, moved);
        return { ...p, projects: { ...p.projects, articles } };
      });
    } else if (listKey === 'directing') {
      setFormData((p) => {
        const items = [...p.projects.directing.items];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        return { ...p, projects: { ...p.projects, directing: { items } } };
      });
    } else if (listKey === 'poster') {
      setFormData((p) => {
        const items = p.projects.poster.items;
        if (toIdx >= items.length) return p;
        const newItems = [...items];
        const [moved] = newItems.splice(fromIdx, 1);
        newItems.splice(toIdx, 0, moved);
        return { ...p, projects: { ...p.projects, poster: { items: newItems } } };
      });
    } else if (listKey.startsWith('career:')) {
      // listKey = "career:<catIdx>" — urutin item DI DALAM kategori itu doang.
      const catIdx = Number(listKey.slice('career:'.length));
      setFormData((p) => {
        const categories = [...p.career.categories];
        const items = categories[catIdx]?.items;
        if (!items || toIdx >= items.length) return p;
        const newItems = [...items];
        const [moved] = newItems.splice(fromIdx, 1);
        newItems.splice(toIdx, 0, moved);
        categories[catIdx] = { ...categories[catIdx], items: newItems };
        return { ...p, career: { ...p.career, categories } };
      });
    } else if (listKey === 'featuredWorks') {
      setFormData((p) => {
        const items = [...(p.home.featuredWorks || [])];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        return { ...p, home: { ...p.home, featuredWorks: items } };
      });
    } else if (listKey === 'authorProperties') {
      setFormData((p) => {
        const items = [...p.about.authorProperties.items];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        return { ...p, about: { ...p.about, authorProperties: { ...p.about.authorProperties, items } } };
      });
    } else if (listKey === 'books') {
      setFormData((p) => {
        const items = [...p.books.items];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        return { ...p, books: { ...p.books, items } };
      });
    } else if (listKey === 'dialogue') {
      setFormData((p) => {
        const items = [...p.home.experience.dialogue];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        return { ...p, home: { ...p.home, experience: { ...p.home.experience, dialogue: items } } };
      });
    } else if (listKey === 'zines') {
      setFormData((p) => {
        const items = [...p.zine.entries];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        return { ...p, zine: { ...p.zine, entries: items } };
      });
    } else if (listKey === 'gameDrafts') {
      updateEditingMiniGame((game) => {
        const items = [...game.drafts];
        if (toIdx >= items.length) return game;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        return { ...game, drafts: items };
      });
    } else if (['socials', 'actionButtons', 'inquiryPaths', 'properties', 'serviceOptions', 'stageOptions', 'timelineOptions'].includes(listKey)) {
      setFormData((p) => {
        const items = [...p.contact[listKey]];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        return { ...p, contact: { ...p.contact, [listKey]: items } };
      });
    } else if (listKey.startsWith('custom:')) {
      const sectionIdx = Number(listKey.slice('custom:'.length));
      setFormData((p) => {
        const sections = [...p.projects.customSections];
        const items = [...(sections[sectionIdx]?.items || [])];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1); items.splice(toIdx, 0, moved);
        sections[sectionIdx] = { ...sections[sectionIdx], items };
        return { ...p, projects: { ...p.projects, customSections: sections } };
      });
    }
  };

  const handleDragStart = (listKey, idx) => (e) => {
    dragInfo.current = { listKey, index: idx };
    setDraggingKey(`${listKey}-${idx}`);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (listKey, idx) => (e) => {
    e.preventDefault();
    const from = dragInfo.current;
    if (!from || from.listKey !== listKey || from.index === null) return;
    reorderList(listKey, from.index, idx);
    dragInfo.current = { listKey: null, index: null };
    setDraggingKey(null);
  };
  const handleDragEnd = () => {
    dragInfo.current = { listKey: null, index: null };
    setDraggingKey(null);
  };

  // Blok form 1 item Poster — file langsung tanpa Sub Bab, tinggal "Tambah Poster"
  // dan item baru langsung nongol di daftar (bisa diurutin/dihapus).
  const renderPosterItem = (it, idx, items) => {
    const listKey = 'poster';
    return (
      <ContentCard
        key={it.id || idx}
        cardKey={`poster-${it.id || idx}`}
        listKey={listKey}
        idx={idx}
        count={items.length}
        title={it.title || `Poster #${idx + 1}`}
        subtitle={[it.category, it.dimensions].filter(Boolean).join(' · ')}
        onRemove={() => removePosterItem(idx)}
      >
          <div className="flex justify-end">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={it.hintEnabled !== false}
                onChange={(e) => setPosterItemField(idx, 'hintEnabled', e.target.checked)}
                className="accent-blue-600"
              />
              Blink pas mode Hint
            </label>
          </div>
        <input type="text" value={it.title} onChange={(e) => setPosterItemField(idx, 'title', e.target.value)} placeholder="Judul" className={inputClsSm} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input type="text" value={it.category} onChange={(e) => setPosterItemField(idx, 'category', e.target.value)} placeholder="Kategori" className={inputClsSm} />
          <input type="text" value={it.dimensions} onChange={(e) => setPosterItemField(idx, 'dimensions', e.target.value)} placeholder="Dimensi/Info (mis. 2400x3000px)" className={inputClsSm} />
        </div>

        <div className="flex items-center gap-2">
          {it.imageUrl && (
            <img src={it.imageUrl} alt={it.title} className="w-14 h-14 rounded object-cover border border-gray-300 dark:border-gray-600 shrink-0" />
          )}
          <input
            type="file"
            accept="image/*"
            disabled={uploadingGalleryImage === `${listKey}-${idx}`}
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              if (!validateProjectCover(file, 'image')) { e.target.value = ''; return; }
              setUploadingGalleryImage(`${listKey}-${idx}`);
              const url = await uploadImageToStorage(file);
              setUploadingGalleryImage(null);
              if (url) setPosterItemField(idx, 'imageUrl', url);
              e.target.value = '';
            }}
            className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
          />
        </div>
        <ProjectCoverHint contentType="image" />
        <input type="text" value={it.imageUrl} onChange={(e) => setPosterItemField(idx, 'imageUrl', e.target.value)} placeholder="Atau tempel URL Gambar (dari galeri/hosting lain)" className={inputClsSm} />

        <textarea rows={2} value={it.description} onChange={(e) => setPosterItemField(idx, 'description', e.target.value)} placeholder="Deskripsi singkat (penjelasan karya)" className={`${inputClsSm} resize-none`} />
      </ContentCard>
    );
  };

  // Blok form 1 Tab Tambahan (Custom Section) — label tab (bisa diedit/dihapus) + daftar
  // kartu sederhana di dalamnya (judul, kategori, gambar, deskripsi, link opsional).
  // Sama kayak renderPosterItem: fungsi biasa yang nge-return JSX, BUKAN komponen
  // JSX tag, biar input gak kehilangan fokus tiap ngetik (lihat catatan di
  // renderPosterItem soal kenapa ini penting).
  //
  // Beda dari renderPosterItem: gak ada collapse/expand di sini, soalnya
  // masing-masing custom section UDAH dapet pill nav sendiri di atas (sejajar
  // Articles/Poster) — jadi "buka" section ini ya klik pill-nya langsung, gak perlu
  // tombol Edit/Tutup terpisah lagi kayak dulu waktu semua numpuk di 1 wrapper tab.
  const renderCustomSectionBlock = (section, sectionIdx) => {
    const items = section.items;
    const contentType = section.contentType || (section.layout === 'articles' ? 'writing' : 'image');
    return (
      <div key={section.id || sectionIdx} className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={section.label}
            onChange={(e) => setCustomSectionLabel(sectionIdx, e.target.value)}
            placeholder="Nama Tab (mis. Dummy Projects, Eksperimen, dst) — ini yang tampil di pill nav"
            className={`${inputClsSm} font-semibold flex-1`}
          />
          <RemoveBtn onClick={() => removeCustomSection(sectionIdx)} label="Hapus Tab Ini" />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Jenis konten tab</label>
          <select value={contentType} onChange={(e) => setCustomSectionContentType(sectionIdx, e.target.value)} className={inputClsSm}>
            <option value="writing">Writing — Cerpen, puisi, esai, script</option>
            <option value="video">Video — Film, directing, reel</option>
            <option value="image">Image — Poster, foto, visual</option>
            <option value="document">Document — PDF, Word, laporan</option>
            <option value="link">External Link — Karya di website lain</option>
          </select>
          <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">Form item di bawah otomatis mengikuti jenis ini. Mengganti jenis tidak menghapus data lama; field yang tidak relevan hanya disembunyikan.</p>
        </div>

        <div className="space-y-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Item ({items.length})
            </h4>
            <AddBtn onClick={() => addCustomItem(sectionIdx)} label="Tambah Item" />
          </div>

          {items.length === 0 && (
            <p className="text-[10px] text-gray-400 italic">Belum ada item.</p>
          )}

          {items.map((it, idx) => (
            <ContentCard
              key={it.id || idx}
              cardKey={`custom-${sectionIdx}-${it.id || idx}`}
              listKey={`custom:${sectionIdx}`}
              idx={idx}
              count={items.length}
              title={it.title || `Item #${idx + 1}`}
              subtitle={it.category || 'Belum ada kategori'}
              onRemove={() => removeCustomItem(sectionIdx, idx)}
            >
                <div className="flex justify-end">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={it.hintEnabled !== false}
                      onChange={(e) => setCustomItemField(sectionIdx, idx, 'hintEnabled', e.target.checked)}
                      className="accent-blue-600"
                    />
                    Blink pas mode Hint
                  </label>
                </div>
              <input type="text" value={it.title} onChange={(e) => setCustomItemField(sectionIdx, idx, 'title', e.target.value)} placeholder="Judul" className={inputClsSm} />
              <input type="text" value={it.category} onChange={(e) => setCustomItemField(sectionIdx, idx, 'category', e.target.value)} placeholder="Kategori (opsional)" className={inputClsSm} />

              {['writing', 'video', 'image', 'document', 'link'].includes(contentType) && (
                <>
                  <div className="flex items-center gap-2">
                    {it.imageUrl && <img src={it.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded object-cover border border-gray-300 dark:border-gray-600" />}
                    <input type="file" accept="image/*" disabled={uploadingCustomImage === `${sectionIdx}-${idx}`} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; if (!validateProjectCover(file, contentType)) { e.target.value = ''; return; } setUploadingCustomImage(`${sectionIdx}-${idx}`); const url = await uploadImageToStorage(file); setUploadingCustomImage(null); if (url) setCustomItemField(sectionIdx, idx, 'imageUrl', url); e.target.value = ''; }} className="flex-1 text-[10px]" />
                  </div>
                  <ProjectCoverHint contentType={contentType} />
                  <input type="text" value={it.imageUrl || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'imageUrl', e.target.value)} placeholder={contentType === 'video' ? 'URL thumbnail/poster' : 'Atau tempel URL gambar/cover'} className={inputClsSm} />
                </>
              )}

              <textarea rows={2} value={it.description || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'description', e.target.value)} placeholder={contentType === 'video' ? 'Premise / ringkasan video' : 'Deskripsi singkat'} className={`${inputClsSm} resize-y`} />

              {contentType === 'writing' && (
                <div className="space-y-3 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
                  <RichTextEditor key={`${it.id || idx}-${it.wordFileName || 'manual'}`} initialValue={it.wordContent || ''} onChange={(html) => setCustomItemField(sectionIdx, idx, 'wordContent', html)} placeholder="Tulis cerpen, puisi, esai, atau script di sini..." />
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Atau import dari Word (.docx)</label>
                    <input type="file" accept=".docx" disabled={convertingCustomWord === `${sectionIdx}-${idx}`} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; setConvertingCustomWord(`${sectionIdx}-${idx}`); const html = await convertWordFileToHtml(file); setConvertingCustomWord(null); if (html != null) { setCustomItemField(sectionIdx, idx, 'wordContent', html); setCustomItemField(sectionIdx, idx, 'wordFileName', file.name); } e.target.value = ''; }} className="w-full text-[10px]" />
                    {convertingCustomWord === `${sectionIdx}-${idx}` && <p className="mt-1 text-[10px] font-semibold text-blue-600">Lagi mengonversi Word...</p>}
                    {it.wordFileName && <p className="mt-1 text-[10px] text-green-700 dark:text-green-400">✓ Diimpor dari {it.wordFileName}</p>}
                  </div>
                </div>
              )}

              {contentType === 'video' && (
                <div className="space-y-2 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3"><input value={it.role || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'role', e.target.value)} placeholder="Role" className={inputClsSm} /><input value={it.year || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'year', e.target.value)} placeholder="Tahun" className={inputClsSm} /><input value={it.runtime || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'runtime', e.target.value)} placeholder="Durasi" className={inputClsSm} /></div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.35fr_1fr]"><select value={it.mediaType || 'youtube'} onChange={(e) => setCustomItemField(sectionIdx, idx, 'mediaType', e.target.value)} className={inputClsSm}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="drive">Google Drive</option><option value="video">MP4/WebM</option><option value="external">External</option></select><input value={it.mediaUrl || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'mediaUrl', e.target.value)} placeholder="URL video" className={inputClsSm} /></div>
                  <Field label="Credits / catatan produksi"><RichTextEditor key={`custom-video-${it.id || idx}`} initialValue={it.credits || ''} onChange={(html) => setCustomItemField(sectionIdx, idx, 'credits', html)} placeholder="Cast, crew, kontribusi, dan catatan produksi..." /></Field>
                </div>
              )}

              {contentType === 'image' && <input value={it.dimensions || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'dimensions', e.target.value)} placeholder="Dimensi / medium / tahun (opsional)" className={inputClsSm} />}

              {contentType === 'document' && (
                <div className="space-y-2 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
                  <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={uploadingCustomImage === `file-${sectionIdx}-${idx}`} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; setUploadingCustomImage(`file-${sectionIdx}-${idx}`); const url = await uploadImageToStorage(file); setUploadingCustomImage(null); if (url) { setCustomItemField(sectionIdx, idx, 'fileUrl', url); setCustomItemField(sectionIdx, idx, 'fileName', file.name); } e.target.value = ''; }} className="w-full text-[10px]" />
                  {it.fileName && <p className="text-[10px] text-green-700 dark:text-green-400">✓ {it.fileName}</p>}
                </div>
              )}

              {['document', 'link', 'writing', 'video'].includes(contentType) && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2"><input value={it.buttonLabel || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'buttonLabel', e.target.value)} placeholder="Label tombol (opsional)" className={inputClsSm} /><input value={contentType === 'document' ? (it.fileUrl || '') : (it.url || '')} onChange={(e) => setCustomItemField(sectionIdx, idx, contentType === 'document' ? 'fileUrl' : 'url', e.target.value)} placeholder="URL tujuan (opsional)" className={inputClsSm} /></div>
              )}
            </ContentCard>
          ))}
        </div>
      </div>
    );
  };

  const featuredWorkOptions = [
    ...(formData.books?.items || []).map((item) => ({ value: `book||${item.id}`, label: `Book — ${item.title}` })),
    ...(formData.projects?.articles || []).map((item) => ({ value: `article||${item.id}`, label: `Article — ${item.title}` })),
    ...(formData.projects?.directing?.items || []).map((item) => ({ value: `directing||${item.id}`, label: `Directing — ${item.title}` })),
    ...(formData.projects?.poster?.items || []).map((item) => ({ value: `poster||${item.id}`, label: `Poster — ${item.title}` })),
    ...(formData.projects?.customSections || []).flatMap((section) => (section.items || []).map((item) => ({ value: `custom|${section.id}|${item.id}`, label: `${section.label || 'Project'} — ${item.title}` }))),
  ];

  return (
    <CmsCardContext.Provider value={{ expandedContentKey, draggingKey, toggleContentCard, reorderList, handleDragStart, handleDragEnd, handleDragOver, handleDrop }}>
    <div className="max-w-4xl mx-auto space-y-6 text-gray-900 dark:text-gray-100 p-4">

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true" aria-labelledby="cancel-cms-title">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202020] shadow-2xl">
            <div className="bg-[#2B579A] px-5 py-3 text-white">
              <h2 id="cancel-cms-title" className="font-mono text-sm font-bold tracking-wider">SAYA SATPAM!</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 dark:text-gray-200">Batalin semua perubahan yang belum disimpan?</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCancelConfirm(false)} className="rounded-md bg-gray-200 dark:bg-gray-700 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600">Lanjut Edit</button>
                <button type="button" onClick={discardChanges} className="rounded-md bg-[#2B579A] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a84]">Ya, Batalkan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/55 px-4" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202020] shadow-2xl">
            <div className="bg-[#2B579A] px-5 py-3 text-white"><h2 className="font-mono text-sm font-bold tracking-wider">SAYA SATPAM!</h2></div>
            <div className="p-5"><p className="text-sm text-gray-700 dark:text-gray-200">{notice}</p><div className="mt-5 flex justify-end"><button type="button" onClick={() => setNotice('')} className="rounded-md bg-[#2B579A] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a84]">Oke</button></div></div>
          </div>
        </div>
      )}

      {/* HEADER & TOMBOL GLOBAL SAVE / NOPE */}
      <div className="border-b pb-4 border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono">PANEL KONTROL CMS ADMIN</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Edit seluruh konten dan fitur website dari sini — perubahan langsung dipakai di halaman publik setelah Save ditekan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3.5 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs font-semibold rounded transition-colors"
          >
            Nope / Cancel
          </button>
          <button
            type="submit"
            form="cms-admin-form"
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold rounded shadow transition-colors"
          >
            {isSaving ? 'Menyimpan...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <form id="cms-admin-form" onSubmit={handleSave} className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm space-y-6 max-h-[calc(100vh-11rem)] overflow-y-auto overscroll-contain">

      {activeTab === null ? (
        <div>
          {cmsSection === null ? <><h2 className="mb-4 text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-gray-500">Pilih kelompok pengaturan</h2><div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2"><button type="button" onClick={() => setCmsSection('main')} className="min-h-44 rounded-lg border border-gray-200 bg-gray-50 p-5 text-left transition-all hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#2d2d2d]"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">01 / Pokok</span><strong className="mt-4 block font-mono text-xl">UTAMA</strong><span className="mt-2 block text-xs leading-relaxed text-gray-500">Halaman, karya, identitas, kata interaktif, tampilan Home, dan pengaturan situs.</span></button><button type="button" onClick={() => setCmsSection('extra')} className="min-h-44 rounded-lg border border-gray-200 bg-gray-50 p-5 text-left transition-all hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#2d2d2d]"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">02 / Interaktif</span><strong className="mt-4 block font-mono text-xl">TAMBAHAN</strong><span className="mt-2 block text-xs leading-relaxed text-gray-500">Wassup? dan Mini Game untuk pengalaman tambahan pengunjung.</span></button></div></> : <><div className="mb-4 flex items-center justify-between gap-3"><div><button type="button" onClick={() => setCmsSection(null)} className="mb-2 font-mono text-xs text-gray-500 hover:text-blue-600">← Pilih kelompok lain</button><h2 className="text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-gray-500">{cmsSection === 'main' ? 'Utama / kebutuhan pokok portofolio' : 'Tambahan / pengalaman interaktif'}</h2></div></div><div className="grid max-h-[calc(100vh-17rem)] grid-cols-2 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-3">
            {(cmsSection === 'main' ? MAIN_TABS : EXTRA_TABS).map((tab) => {
              const meta = TAB_META[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="flex flex-col items-start gap-1.5 p-4 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all text-left"
                >
                  <span className="text-2xl leading-none">{meta.emoji}</span>
                  <span className="text-sm font-bold font-mono uppercase tracking-wide text-gray-800 dark:text-gray-100">
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                    {meta.desc}
                  </span>
                </button>
              );
            })}</div></>}
        </div>
      ) : (
      <>
        {/* Tombol kembali ke menu — pola sama kayak halaman publik Career.jsx */}
        <button
          type="button"
          onClick={() => { setActiveTab(null); setActiveMiniGameEditor(null); }}
          className="flex items-center gap-1.5 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors"
        >
          <span>←</span> Kembali ke {cmsSection === 'extra' ? 'Tambahan' : 'Utama'}
        </button>

        {/* ================= HOME ================= */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab Home</h2>
            <Field label="Nama Lengkap">
              <input type="text" value={formData.home.name} onChange={(e) => setHome('name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Role / Jabatan Singkat">
              <input type="text" value={formData.home.role} onChange={(e) => setHome('role', e.target.value)} className={inputCls} />
            </Field>
            <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/70 dark:bg-blue-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">Dynamic Statement</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">Kalimat besar di kanan identitas Home. Setiap baris merupakan pasangan kata yang akan diganti seperti proses edit di Word.</p>
                </div>
                <button type="button" onClick={() => setDynamicStatement('enabled', !formData.home.dynamicStatement.enabled)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${formData.home.dynamicStatement.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} aria-label="Aktifkan atau nonaktifkan dynamic statement">
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${formData.home.dynamicStatement.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Pembuka"><input type="text" value={formData.home.dynamicStatement.prefix || ''} onChange={(e) => setDynamicStatement('prefix', e.target.value)} className={inputCls} placeholder="Gue" /></Field>
                <Field label="Kata highlight kuning"><input type="text" value={formData.home.dynamicStatement.highlightedWord || ''} onChange={(e) => setDynamicStatement('highlightedWord', e.target.value)} className={inputCls} placeholder="mengubah" /></Field>
                <Field label="Kata penghubung"><input type="text" value={formData.home.dynamicStatement.connector || ''} onChange={(e) => setDynamicStatement('connector', e.target.value)} className={inputCls} placeholder="menjadi" /></Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Ukuran kalimat">
                  <select value={formData.home.dynamicStatement.size || 'large'} onChange={(e) => setDynamicStatement('size', e.target.value)} className={inputCls}>
                    <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                  </select>
                </Field>
                <Field label="Kecepatan mengetik">
                  <select value={formData.home.dynamicStatement.speed || 'normal'} onChange={(e) => setDynamicStatement('speed', e.target.value)} className={inputCls}>
                    <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
                  </select>
                </Field>
                <Field label="Jeda setelah kalimat selesai">
                  <select value={Number(formData.home.dynamicStatement.pauseDuration) || 2700} onChange={(e) => setDynamicStatement('pauseDuration', Number(e.target.value))} className={inputCls}>
                    <option value={2000}>2 detik</option><option value={2700}>2,7 detik</option><option value={3500}>3,5 detik</option><option value={5000}>5 detik</option>
                  </select>
                </Field>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Pasangan kata ({formData.home.dynamicStatement.pairs.length}/8)</p>
                  {formData.home.dynamicStatement.pairs.length < 8 && <button type="button" onClick={addDynamicPair} className="rounded-md border border-dashed border-blue-400 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-950/40">+ Tambah Pasangan</button>}
                </div>
                {formData.home.dynamicStatement.pairs.map((pair, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900/60">
                    <input type="text" value={pair.source || ''} onChange={(e) => setDynamicPair(index, 'source', e.target.value)} className={inputCls} placeholder="pengamatan" aria-label={`Kata awal pasangan ${index + 1}`} />
                    <span className="font-mono text-xs text-gray-400">→</span>
                    <input type="text" value={pair.result || ''} onChange={(e) => setDynamicPair(index, 'result', e.target.value)} className={inputCls} placeholder="cerita" aria-label={`Kata hasil pasangan ${index + 1}`} />
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveDynamicPair(index, -1)} disabled={index === 0} className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-30 dark:border-gray-700" title="Naik">↑</button>
                      <button type="button" onClick={() => moveDynamicPair(index, 1)} disabled={index === formData.home.dynamicStatement.pairs.length - 1} className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-30 dark:border-gray-700" title="Turun">↓</button>
                      <button type="button" onClick={() => removeDynamicPair(index)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/30" title="Hapus">×</button>
                    </div>
                  </div>
                ))}
                {!formData.home.dynamicStatement.pairs.length && <p className="rounded-lg border border-dashed border-gray-300 p-3 text-center text-xs text-gray-400 dark:border-gray-700">Belum ada pasangan kata. Tambahkan minimal satu.</p>}
              </div>
            </section>
          </div>
        )}

        {/* ================= FEATURED WORKS / CAROUSEL ================= */}
        {activeTab === 'featuredWorks' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Featured Works / Carousel</h2>
            <p className="text-xs text-gray-500 italic">Pilih maksimal lima karya. Judul dan gambar otomatis mengikuti data asli di Book atau Projects.</p>
            <Field label="Heading Carousel">
              <input type="text" value={formData.home.featuredWorksHeading || ''} onChange={(e) => setHome('featuredWorksHeading', e.target.value)} className={inputCls} placeholder="Pilihan Karya" />
            </Field>
            <div className="space-y-3">
              {(formData.home.featuredWorks || []).map((work, index) => {
                const selectedValue = `${work.type || ''}|${work.sectionId || ''}|${work.itemId || ''}`;
                return <ContentCard key={`${work.type}-${work.itemId}-${index}`} cardKey={`featured-${index}`} listKey="featuredWorks" idx={index} count={formData.home.featuredWorks.length} title={`Karya #${index + 1}`} subtitle={featuredWorkOptions.find((option) => option.value === selectedValue)?.label || 'Belum memilih karya'} onRemove={() => removeFeaturedWork(index)}>
                  <select value={selectedValue} onChange={(e) => { const [type, sectionId, itemId] = e.target.value.split('|'); setFeaturedWork(index, { type, sectionId, itemId }); }} className={inputCls}>
                    <option value="||">Pilih karya…</option>
                    {featuredWorkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <textarea rows={2} value={work.teaser || ''} onChange={(e) => setFeaturedWork(index, { teaser: e.target.value })} className={`${inputCls} resize-y`} placeholder="Kalimat pendek untuk menjelaskan output" />
                </ContentCard>;
              })}
            </div>
            {(formData.home.featuredWorks || []).length < 5 && <button type="button" onClick={addFeaturedWork} className="rounded-md border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">+ Tambah Karya</button>}
          </div>
        )}

        {/* ================= ABOUT ================= */}
        {activeTab === 'about' && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab About</h2>
            <p className="text-xs text-gray-500 italic">Bio utama tampil sebagai Author’s Note. Catatan aktif tampil di sisi kanan desktop dan di bawah bio pada HP.</p>
            <Field label="Headline"><input value={formData.about.headline || ''} onChange={(e) => setAboutField('headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Bio (1–2 kalimat)"><textarea rows={5} value={formData.about.bio || ''} onChange={(e) => setAboutField('bio', e.target.value)} className={`${inputCls} resize-y`} /></Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Tanda tangan"><input value={formData.about.signature || ''} onChange={(e) => setAboutField('signature', e.target.value)} className={inputCls} /></Field>
              <Field label="Lokasi / closing"><input value={formData.about.locationLine || ''} onChange={(e) => setAboutField('locationLine', e.target.value)} className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
              <Field label="Tampilkan catatan di halaman About">
                <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={formData.about.notesVisible !== false} onChange={(e) => setAboutField('notesVisible', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />
                  <span>{formData.about.notesVisible !== false ? 'Ditampilkan' : 'Disembunyikan'}</span>
                </label>
              </Field>
              <Field label="Maksimal catatan yang tampil">
                <select value={formData.about.notesLimit || 3} onChange={(e) => setAboutField('notesLimit', Number(e.target.value))} className={inputCls} disabled={formData.about.notesVisible === false}>
                  <option value={1}>1 catatan</option>
                  <option value={2}>2 catatan</option>
                  <option value={3}>3 catatan</option>
                </select>
              </Field>
            </div>
            {[1, 2, 3].map((number) => <div key={number} className="grid grid-cols-1 md:grid-cols-[0.35fr_1fr] gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <Field label={`Label catatan ${number}`}><input value={formData.about[`note${number}Label`] || ''} onChange={(e) => setAboutField(`note${number}Label`, e.target.value)} className={inputCls} /></Field>
              <Field label={`Isi catatan ${number}`}><textarea rows={2} value={formData.about[`note${number}`] || ''} onChange={(e) => setAboutField(`note${number}`, e.target.value)} className={`${inputCls} resize-y`} /></Field>
            </div>)}

            <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/70 dark:bg-blue-950/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">Listening Footnote · Last.fm</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Muncul di area abu-abu kiri luar A4 pada halaman About. API key dibaca dari file .env, bukan disimpan di CMS.</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={formData.about.listeningFootnote.enabled !== false} onChange={(e) => setListeningFootnote('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />
                  {formData.about.listeningFootnote.enabled !== false ? 'Ditampilkan' : 'Disembunyikan'}
                </label>
              </div>
              <Field label="Username Last.fm">
                <input value={formData.about.listeningFootnote.username || ''} onChange={(e) => setListeningFootnote('username', e.target.value.trim())} className={inputCls} placeholder="contoh: haikalhafidz" />
              </Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Label saat sedang memutar"><input value={formData.about.listeningFootnote.nowPlayingLabel || ''} onChange={(e) => setListeningFootnote('nowPlayingLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Label lagu terakhir"><input value={formData.about.listeningFootnote.lastPlayedLabel || ''} onChange={(e) => setListeningFootnote('lastPlayedLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Label fallback"><input value={formData.about.listeningFootnote.fallbackLabel || ''} onChange={(e) => setListeningFootnote('fallbackLabel', e.target.value)} className={inputCls} /></Field>
              </div>
              <div className="border-t border-blue-200 pt-4 dark:border-blue-900/70">
                <p className="mb-3 text-[11px] text-gray-500">Fallback hanya dipakai saat Last.fm belum dikonfigurasi atau sedang gagal. Isi ini supaya kolom kiri tidak mendadak kosong.</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Judul lagu fallback"><input value={formData.about.listeningFootnote.fallbackTitle || ''} onChange={(e) => setListeningFootnote('fallbackTitle', e.target.value)} className={inputCls} /></Field>
                  <Field label="Artis fallback"><input value={formData.about.listeningFootnote.fallbackArtist || ''} onChange={(e) => setListeningFootnote('fallbackArtist', e.target.value)} className={inputCls} /></Field>
                  <Field label="URL cover fallback"><input value={formData.about.listeningFootnote.fallbackImage || ''} onChange={(e) => setListeningFootnote('fallbackImage', e.target.value)} className={inputCls} placeholder="https://..." /></Field>
                  <Field label="URL lagu fallback"><input value={formData.about.listeningFootnote.fallbackUrl || ''} onChange={(e) => setListeningFootnote('fallbackUrl', e.target.value)} className={inputCls} placeholder="https://..." /></Field>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-[#282828]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">Author Properties</h3>
                  <p className="mt-1 text-xs text-gray-500">Panel informasi tambahan yang dibuka dari halaman About.</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={formData.about.authorProperties.enabled !== false} onChange={(e) => setAuthorPropertiesField('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />
                  {formData.about.authorProperties.enabled !== false ? 'Ditampilkan' : 'Disembunyikan'}
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Tulisan tombol"><input value={formData.about.authorProperties.buttonLabel || ''} onChange={(e) => setAuthorPropertiesField('buttonLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Judul panel"><input value={formData.about.authorProperties.panelTitle || ''} onChange={(e) => setAuthorPropertiesField('panelTitle', e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Terakhir direvisi"><input value={formData.about.authorProperties.lastRevised || ''} onChange={(e) => setAuthorPropertiesField('lastRevised', e.target.value)} className={inputCls} placeholder="21 September 2026" /></Field>

              <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                {formData.about.authorProperties.items.map((item, index) => (
                  <ContentCard key={item.id || index} cardKey={`author-property-${item.id || index}`} listKey="authorProperties" idx={index} count={formData.about.authorProperties.items.length} title={item.label || `Property #${index + 1}`} subtitle={item.value || 'Belum diisi'} onRemove={() => removeAuthorProperty(index)}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Field label="Label"><input value={item.label || ''} onChange={(e) => updateAuthorProperty(index, { label: e.target.value })} className={inputCls} placeholder="Currently writing" /></Field>
                      <Field label="Isi"><input value={item.value || ''} onChange={(e) => updateAuthorProperty(index, { value: e.target.value })} className={inputCls} /></Field>
                    </div>
                    <div className="mt-3"><Field label="Link opsional"><input value={item.url || ''} onChange={(e) => updateAuthorProperty(index, { url: e.target.value })} className={inputCls} placeholder="https://open.spotify.com/…" /></Field></div>
                  </ContentCard>
                ))}
              </div>
              <button type="button" onClick={addAuthorProperty} className="rounded-md border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">+ Tambah Property</button>
            </div>
          </div>
        )}

        {/* ================= CAREER ================= */}
        {activeTab === 'career' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab Career</h2>
            <p className="text-xs text-gray-500 italic">
              Kategori di bawah bebas ditambah, dihapus, atau diganti namanya — cocok buat
              riwayat kerja/pendidikan, tapi juga bisa dipakai buat Achievements, Certificates,
              atau slot lain yang lo butuhin.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Judul Halaman (mis. Career & Education)">
                <input type="text" value={formData.career.heading} onChange={(e) => setCareerHeading('heading', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Sub-judul / Keterangan Singkat">
                <input type="text" value={formData.career.subheading} onChange={(e) => setCareerHeading('subheading', e.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
              <p className="text-xs font-bold text-blue-600 dark:text-blue-300">Career Archive Cover</p>
              <Field label="Judul besar sampul"><textarea rows={2} value={formData.career.archiveTitle || ''} onChange={(e) => setCareerHeading('archiveTitle', e.target.value)} className={`${inputCls} resize-y`} placeholder="A record of work, study..." /></Field>
              <Field label="Pengantar sampul"><textarea rows={2} value={formData.career.archiveIntro || ''} onChange={(e) => setCareerHeading('archiveIntro', e.target.value)} className={`${inputCls} resize-y`} /></Field>
              <Field label="Tulisan tombol buka arsip"><input type="text" value={formData.career.archiveButtonLabel || ''} onChange={(e) => setCareerHeading('archiveButtonLabel', e.target.value)} className={inputCls} placeholder="Open career archive" /></Field>
              <Field label="Tulisan tombol credentials"><input type="text" value={formData.career.credentialsButtonLabel || ''} onChange={(e) => setCareerHeading('credentialsButtonLabel', e.target.value)} className={inputCls} placeholder="View credentials" /></Field>
            </div>

            {formData.career.categories.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">Belum ada kategori. Tambah salah satu tipe di bawah buat mulai.</p>
            )}

            {/* Pola tab pill: cuma 1 kategori yang keliatan isinya dalam satu waktu (Professional
                ATAU College ATAU dst), sisanya ngumpet di balik pill-nya — sama kayak sub-tab
                Articles/Poster di tab Projects. Ini yang bikin CMS gak numpuk-panjang kalau
                kategorinya banyak. */}
            {formData.career.categories.length > 0 && (() => {
              const foundIdx = formData.career.categories.findIndex((c) => c.id === activeCareerCategory);
              const catIdx = foundIdx === -1 ? 0 : foundIdx;
              const category = formData.career.categories[catIdx];
              const bgKey = category.id || catIdx;
              const isCredential = category.type === 'credential';
              const listKey = `career:${catIdx}`;

              return (
                <>
                  <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-3 flex-wrap items-center">
                    {formData.career.categories.map((cat, idx) => (
                      <button
                        key={cat.id || idx}
                        type="button"
                        onClick={() => setActiveCareerCategory(cat.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                          catIdx === idx
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838]'
                        }`}
                      >
                        {cat.name || `Kategori #${idx + 1}`} ({cat.items.length})
                      </button>
                    ))}
                    <button type="button" onClick={() => addCareerCategory('career')} className="rounded border border-dashed border-blue-400 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30">+ Tambah Tab</button>
                  </div>

                  <div key={category.id || catIdx} className="space-y-3 p-4 rounded-lg border-2 border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <input
                        type="text"
                        value={category.name}
                        onChange={(e) => setCareerCategoryName(catIdx, e.target.value)}
                        placeholder="Nama Kategori (mis. Professional, Achievements, dst)"
                        className={`${inputClsSm} font-semibold flex-1`}
                      />
                      <select
                        value={category.type}
                        onChange={(e) => setCareerCategoryType(catIdx, e.target.value)}
                        className={`${inputClsSm} sm:w-56 shrink-0`}
                      >
                        <option value="career">{CAREER_TYPE_LABEL.career}</option>
                        <option value="credential">{CAREER_TYPE_LABEL.credential}</option>
                      </select>
                      <RemoveBtn onClick={() => removeCareerCategory(catIdx)} label="Hapus Kategori" />
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        {category.items.length} item — seret ⠿ atau pakai ▲▼ buat urutin
                      </h3>
                      <AddBtn onClick={() => addCareerItem(catIdx)} label="Tambah Item" />
                    </div>

                    {/* Gambar latar kartu menu kategori ini di halaman publik */}
                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded border border-dashed border-blue-200 dark:border-blue-900 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                        Gambar Latar Kartu Menu "{category.name || 'Tanpa Nama'}"
                      </span>
                      <div className="flex items-center gap-3">
                        {category.bgImage && (
                          <img src={category.bgImage} alt={category.name} className="w-16 h-12 rounded object-cover border border-gray-300 dark:border-gray-600 shrink-0" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingCareerBg === bgKey}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setUploadingCareerBg(bgKey);
                            const url = await uploadImageToStorage(file);
                            setUploadingCareerBg(null);
                            if (url) setCareerBgImage(catIdx, url);
                            e.target.value = '';
                          }}
                          className="flex-1 text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                        />
                        {category.bgImage && (
                          <button type="button" onClick={() => setCareerBgImage(catIdx, '')} className="text-[10px] text-red-500 hover:text-red-600 font-semibold shrink-0">
                            Hapus
                          </button>
                        )}
                      </div>
                      {uploadingCareerBg === bgKey && (
                        <p className="text-[10px] text-blue-500 animate-pulse">Mengupload gambar...</p>
                      )}
                      <input
                        type="text"
                        value={category.bgImage}
                        onChange={(e) => setCareerBgImage(catIdx, e.target.value)}
                        placeholder="Atau tempel URL gambar langsung di sini"
                        className={inputClsSm}
                      />
                      <p className="text-[10px] text-gray-400">Kosongkan aja kalau belum ada — nanti otomatis pakai warna gradasi default.</p>
                    </div>

                    {category.items.length === 0 && (
                      <p className="text-[11px] text-gray-400 italic">Belum ada item.</p>
                    )}

                    {/* -------- Item TIPE 'career': Posisi @ Instansi + pop-up detail instansi -------- */}
                    {/* Collapsed by default (cuma judul + tombol Edit) — sama pola kayak Articles di
                        tab Projects, biar kategori yang isinya banyak item (Professional, College, dst)
                        gak numpuk-panjang sekaligus di layar. Klik "Edit" buat buka form lengkapnya.
                        ReorderHandle (⠿ / ▲ / ▼) dipasang di kedua mode (collapsed & expanded) buat
                        geser urutan item — misal item yang baru diupdate mau ditaruh paling atas. */}
                    {!isCredential && category.items.map((item, idx) => {
                      const itemKey = `${catIdx}-${idx}`;
                      const isOpen = expandedCareerKey === itemKey;

                      if (!isOpen) {
                        return (
                          <div
                            key={item.id || idx}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop(listKey, idx)}
                            className={`flex items-center gap-2 p-3 bg-gray-50 dark:bg-[#2d2d2d] rounded border border-gray-200 dark:border-gray-700 transition-opacity ${
                              draggingKey === `${listKey}-${idx}` ? 'opacity-40' : ''
                            }`}
                          >
                            <ReorderHandle listKey={listKey} idx={idx} count={category.items.length} />
                            <button
                              type="button"
                              onClick={() => setExpandedCareerKey(itemKey)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                {item.role || <span className="italic text-gray-400 font-normal">Item #{idx + 1} — belum ada judul</span>}
                              </span>
                              {(item.company || item.period) && (
                                <span className="block text-[10px] font-mono text-gray-400 mt-0.5 truncate">
                                  {[item.company, item.period].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedCareerKey(itemKey)}
                              className="text-[10px] px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 shrink-0"
                            >
                              Edit
                            </button>
                            <RemoveBtn onClick={() => removeCareerItem(catIdx, idx)} />
                          </div>
                        );
                      }

                      return (
                      <div
                        key={item.id || idx}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop(listKey, idx)}
                        className={`p-4 bg-gray-50 dark:bg-[#2d2d2d] rounded border border-blue-300 dark:border-blue-700 space-y-3 transition-opacity ${
                          draggingKey === `${listKey}-${idx}` ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ReorderHandle listKey={listKey} idx={idx} count={category.items.length} />
                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">Item #{idx + 1}</h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={item.hintEnabled !== false}
                                onChange={(e) => setCareerItemField(catIdx, idx, 'hintEnabled', e.target.checked)}
                                className="accent-blue-600"
                              />
                              Blink pas mode Hint
                            </label>
                            <button
                              type="button"
                              onClick={() => setExpandedCareerKey(null)}
                              className="text-[10px] px-2.5 py-1 bg-gray-200 dark:bg-[#3a3a3a] text-gray-600 dark:text-gray-300 rounded font-semibold hover:bg-gray-300 dark:hover:bg-[#454545]"
                            >
                              Tutup
                            </button>
                            <RemoveBtn onClick={() => removeCareerItem(catIdx, idx)} label="Hapus Item" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input type="text" value={item.role} onChange={(e) => setCareerItemField(catIdx, idx, 'role', e.target.value)} placeholder="Posisi / Peran" className={inputClsSm} />
                          <input type="text" value={item.company} onChange={(e) => setCareerItemField(catIdx, idx, 'company', e.target.value)} placeholder="Nama Instansi / Perusahaan" className={inputClsSm} />
                          <input type="text" value={item.location} onChange={(e) => setCareerItemField(catIdx, idx, 'location', e.target.value)} placeholder="Lokasi" className={inputClsSm} />
                          <input type="text" value={item.period} onChange={(e) => setCareerItemField(catIdx, idx, 'period', e.target.value)} placeholder="Periode (mis. 2024 – Present)" className={inputClsSm} />
                        </div>
                        <textarea rows={2} value={item.description} onChange={(e) => setCareerItemField(catIdx, idx, 'description', e.target.value)} placeholder="Deskripsi singkat" className={`${inputClsSm} resize-none`} />

                        <div className="space-y-2 rounded border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">Version History</span>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <input type="number" value={item.timelineOrder ?? ''} onChange={(e) => setCareerItemField(catIdx, idx, 'timelineOrder', e.target.value)} placeholder="Urutan timeline (1, 2, 3...)" className={inputClsSm} />
                            <input type="text" value={item.revisionTitle || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'revisionTitle', e.target.value)} placeholder="Judul refleksi (mis. Ideas became visible.)" className={inputClsSm} />
                          </div>
                          <textarea rows={2} value={item.shortSummary || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'shortSummary', e.target.value)} placeholder="Ringkasan pendek yang tampil di A4" className={`${inputClsSm} resize-y`} />
                          <textarea rows={2} value={item.whatChanged || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'whatChanged', e.target.value)} placeholder="What changed — pelajaran/perubahan dari fase ini" className={`${inputClsSm} resize-y`} />
                          <input type="text" value={item.coverImage || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'coverImage', e.target.value)} placeholder="URL gambar dokumentasi opsional (kosong = pakai foto instansi)" className={inputClsSm} />
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <input type="text" value={item.relatedLabel || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'relatedLabel', e.target.value)} placeholder="Label related work" className={inputClsSm} />
                            <input type="text" value={item.relatedUrl || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'relatedUrl', e.target.value)} placeholder="URL related work" className={inputClsSm} />
                          </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-[#1e1e1e] rounded border border-dashed border-gray-300 dark:border-gray-600 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Pop-up Detail Instansi</span>
                          <input type="text" value={item.companyInfo.name} onChange={(e) => setCareerCompanyInfoField(catIdx, idx, 'name', e.target.value)} placeholder="Nama Lengkap Instansi" className={inputClsSm} />
                          <input type="text" value={item.companyInfo.address} onChange={(e) => setCareerCompanyInfoField(catIdx, idx, 'address', e.target.value)} placeholder="Alamat Instansi" className={inputClsSm} />

                          <div className="flex items-center gap-2">
                            {item.companyInfo.photo && (
                              <img src={item.companyInfo.photo} alt={item.companyInfo.name} className="w-10 h-10 rounded object-cover border border-gray-300 dark:border-gray-600 shrink-0" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingCompanyPhoto === `${catIdx}-${idx}`}
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const key = `${catIdx}-${idx}`;
                                setUploadingCompanyPhoto(key);
                                const url = await uploadImageToStorage(file);
                                setUploadingCompanyPhoto(null);
                                if (url) setCareerCompanyInfoField(catIdx, idx, 'photo', url);
                                e.target.value = '';
                              }}
                              className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                            />
                          </div>
                          <input type="text" value={item.companyInfo.photo} onChange={(e) => setCareerCompanyInfoField(catIdx, idx, 'photo', e.target.value)} placeholder="Atau tempel URL Foto Instansi" className={inputClsSm} />

                          <textarea rows={2} value={item.companyInfo.about} onChange={(e) => setCareerCompanyInfoField(catIdx, idx, 'about', e.target.value)} placeholder="Deskripsi Singkat Instansi" className={`${inputClsSm} resize-none`} />
                        </div>
                      </div>
                      );
                    })}

                    {/* -------- Item TIPE 'credential': nama pencapaian/sertifikat, penyelenggara, tanggal, bukti -------- */}
                    {/* Sama pola collapsed/expand + reorder kayak tipe 'career' di atas. */}
                    {isCredential && category.items.map((item, idx) => {
                      const itemKey = `${catIdx}-${idx}`;
                      const isOpen = expandedCareerKey === itemKey;

                      if (!isOpen) {
                        return (
                          <div
                            key={item.id || idx}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop(listKey, idx)}
                            className={`flex items-center gap-2 p-3 bg-gray-50 dark:bg-[#2d2d2d] rounded border border-gray-200 dark:border-gray-700 transition-opacity ${
                              draggingKey === `${listKey}-${idx}` ? 'opacity-40' : ''
                            }`}
                          >
                            <ReorderHandle listKey={listKey} idx={idx} count={category.items.length} />
                            <button
                              type="button"
                              onClick={() => setExpandedCareerKey(itemKey)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                {item.title || <span className="italic text-gray-400 font-normal">Item #{idx + 1} — belum ada judul</span>}
                              </span>
                              {(item.issuer || item.date) && (
                                <span className="block text-[10px] font-mono text-gray-400 mt-0.5 truncate">
                                  {[item.issuer, item.date].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedCareerKey(itemKey)}
                              className="text-[10px] px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 shrink-0"
                            >
                              Edit
                            </button>
                            <RemoveBtn onClick={() => removeCareerItem(catIdx, idx)} />
                          </div>
                        );
                      }

                      return (
                      <div
                        key={item.id || idx}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop(listKey, idx)}
                        className={`p-4 bg-gray-50 dark:bg-[#2d2d2d] rounded border border-blue-300 dark:border-blue-700 space-y-3 transition-opacity ${
                          draggingKey === `${listKey}-${idx}` ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ReorderHandle listKey={listKey} idx={idx} count={category.items.length} />
                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">Item #{idx + 1}</h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={item.hintEnabled !== false}
                                onChange={(e) => setCareerItemField(catIdx, idx, 'hintEnabled', e.target.checked)}
                                className="accent-blue-600"
                              />
                              Blink pas mode Hint
                            </label>
                            <button
                              type="button"
                              onClick={() => setExpandedCareerKey(null)}
                              className="text-[10px] px-2.5 py-1 bg-gray-200 dark:bg-[#3a3a3a] text-gray-600 dark:text-gray-300 rounded font-semibold hover:bg-gray-300 dark:hover:bg-[#454545]"
                            >
                              Tutup
                            </button>
                            <RemoveBtn onClick={() => removeCareerItem(catIdx, idx)} label="Hapus Item" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input type="text" value={item.title} onChange={(e) => setCareerItemField(catIdx, idx, 'title', e.target.value)} placeholder="Nama Pencapaian / Sertifikat" className={inputClsSm} />
                          <input type="text" value={item.issuer} onChange={(e) => setCareerItemField(catIdx, idx, 'issuer', e.target.value)} placeholder="Penyelenggara / Penerbit" className={inputClsSm} />
                          <input type="text" value={item.date} onChange={(e) => setCareerItemField(catIdx, idx, 'date', e.target.value)} placeholder="Tanggal (mis. Mei 2026)" className={inputClsSm} />
                          <input type="text" value={item.verifyUrl} onChange={(e) => setCareerItemField(catIdx, idx, 'verifyUrl', e.target.value)} placeholder="Link Verifikasi / Bukti (opsional)" className={inputClsSm} />
                        </div>
                        <textarea rows={2} value={item.description} onChange={(e) => setCareerItemField(catIdx, idx, 'description', e.target.value)} placeholder="Deskripsi singkat (opsional)" className={`${inputClsSm} resize-none`} />

                        <div className="space-y-2 rounded border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                            <input type="checkbox" checked={item.showOnTimeline === true} onChange={(e) => setCareerItemField(catIdx, idx, 'showOnTimeline', e.target.checked)} className="accent-blue-600" />
                            Jadikan credential ini milestone utama di Version History
                          </label>
                          {item.showOnTimeline === true && <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            <input type="number" value={item.timelineOrder ?? ''} onChange={(e) => setCareerItemField(catIdx, idx, 'timelineOrder', e.target.value)} placeholder="Urutan timeline" className={inputClsSm} />
                            <input type="text" value={item.revisionTitle || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'revisionTitle', e.target.value)} placeholder="Judul refleksi" className={inputClsSm} />
                            <textarea rows={2} value={item.whatChanged || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'whatChanged', e.target.value)} placeholder="What changed" className={`${inputClsSm} resize-y md:col-span-2`} />
                          </div>}
                        </div>

                        <div className="p-3 bg-white dark:bg-[#1e1e1e] rounded border border-dashed border-gray-300 dark:border-gray-600 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Gambar Bukti (sertifikat/foto pencapaian)</span>
                          <div className="flex items-center gap-2">
                            {item.image && (
                              <img src={item.image} alt={item.title} className="w-14 h-14 rounded object-cover border border-gray-300 dark:border-gray-600 shrink-0" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingCompanyPhoto === `${catIdx}-${idx}`}
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const key = `${catIdx}-${idx}`;
                                setUploadingCompanyPhoto(key);
                                const url = await uploadImageToStorage(file);
                                setUploadingCompanyPhoto(null);
                                if (url) setCareerItemField(catIdx, idx, 'image', url);
                                e.target.value = '';
                              }}
                              className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                            />
                          </div>
                          <input type="text" value={item.image} onChange={(e) => setCareerItemField(catIdx, idx, 'image', e.target.value)} placeholder="Atau tempel URL Gambar" className={inputClsSm} />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

          </div>
        )}

        {/* ================= BOOK ================= */}
        {activeTab === 'book' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-bold text-blue-600 dark:text-blue-400">Tab Book</h2>
              <AddBtn onClick={addBook} label="Tambah Buku/Karya" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Judul Halaman (mis. Books, Writings & Open Source)">
                <input type="text" value={formData.books.heading} onChange={(e) => setBooksHeading('heading', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Sub-judul / Keterangan Singkat">
                <input type="text" value={formData.books.subheading} onChange={(e) => setBooksHeading('subheading', e.target.value)} className={inputCls} />
              </Field>
            </div>

            {formData.books.items.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">Belum ada karya.</p>
            )}

            {formData.books.items.map((book, idx) => (
              <ContentCard key={book.id || idx} cardKey={`book-${book.id || idx}`} listKey="books" idx={idx} count={formData.books.items.length} title={book.title || `Buku/Karya #${idx + 1}`} subtitle={[book.category, book.pageCount ? `${book.pageCount} halaman` : ''].filter(Boolean).join(' · ')} onRemove={() => removeBook(idx)}>
                  <div className="flex flex-wrap justify-end gap-4">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={book.featured === true} onChange={(e) => setExclusiveBookFlag(idx, 'featured', e.target.checked)} className="accent-blue-600" />
                      Current Manuscript
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={book.startHere === true} onChange={(e) => setExclusiveBookFlag(idx, 'startHere', e.target.checked)} className="accent-blue-600" />
                      Start Here
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={book.hintEnabled !== false}
                        onChange={(e) => setBookField(idx, 'hintEnabled', e.target.checked)}
                        className="accent-blue-600"
                      />
                      Blink pas mode Hint
                    </label>
                  </div>
                <input type="text" value={book.title} onChange={(e) => setBookField(idx, 'title', e.target.value)} placeholder="Judul Buku / Karya" className={inputClsSm} />
                <Field label="Peran / Kontribusi Saya">
                  <input type="text" value={book.myRoles || ''} onChange={(e) => setBookField(idx, 'myRoles', e.target.value)} placeholder="Penulis, Editor, Desainer Buku (pisahkan dengan koma)" className={inputClsSm} />
                  <p className="mt-1 text-[10px] leading-relaxed text-gray-400">Boleh satu atau beberapa peran. Urutan yang ditulis di sini menjadi urutan chip pada Book Autopsy.</p>
                </Field>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input type="text" value={book.author || ''} onChange={(e) => setBookField(idx, 'author', e.target.value)} placeholder="Nama penulis" className={inputClsSm} />
                  <input type="text" value={book.publisher || ''} onChange={(e) => setBookField(idx, 'publisher', e.target.value)} placeholder="Penerbit / imprint" className={inputClsSm} />
                  <input type="text" value={book.publicationDate || ''} onChange={(e) => setBookField(idx, 'publicationDate', e.target.value)} placeholder="Tanggal terbit (mis. September 2026)" className={inputClsSm} />
                  <input type="text" value={book.isbn || ''} onChange={(e) => setBookField(idx, 'isbn', e.target.value)} placeholder="ISBN (opsional)" className={inputClsSm} />
                  <input type="text" value={book.edition || ''} onChange={(e) => setBookField(idx, 'edition', e.target.value)} placeholder="Edisi (opsional)" className={inputClsSm} />
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input type="text" value={book.category} onChange={(e) => setBookField(idx, 'category', e.target.value)} placeholder="Kategori (mis. Fiksi / Esai)" className={inputClsSm} />
                  <select value={book.status || 'published'} onChange={(e) => setBookField(idx, 'status', e.target.value)} className={inputClsSm}>
                    <option value="published">Published</option><option value="writing">In Progress</option><option value="draft">Draft</option><option value="archived">Archived</option>
                  </select>
                  <input type="text" value={book.year || ''} onChange={(e) => setBookField(idx, 'year', e.target.value)} placeholder="Tahun (mis. 2026)" className={inputClsSm} />
                  <input type="text" value={book.language || ''} onChange={(e) => setBookField(idx, 'language', e.target.value)} placeholder="Bahasa" className={inputClsSm} />
                  <input type="text" value={book.format || ''} onChange={(e) => setBookField(idx, 'format', e.target.value)} placeholder="Format (Novel, E-Book, Booklet...)" className={inputClsSm} />
                  <input type="number" min="0" max="100" value={book.progress || ''} onChange={(e) => setBookField(idx, 'progress', e.target.value)} placeholder="Progress naskah (%)" className={inputClsSm} />
                </div>
                <textarea rows={2} value={book.pitch || ''} onChange={(e) => setBookField(idx, 'pitch', e.target.value)} placeholder="One-line pitch — satu kalimat yang menjual gagasan karya" className={`${inputClsSm} resize-none`} />
                <textarea rows={2} value={book.summary} onChange={(e) => setBookField(idx, 'summary', e.target.value)} placeholder="Ringkasan singkat" className={`${inputClsSm} resize-none`} />
                <textarea rows={3} value={book.fullDescription} onChange={(e) => setBookField(idx, 'fullDescription', e.target.value)} placeholder="Deskripsi lengkap" className={`${inputClsSm} resize-none`} />
                <textarea rows={3} value={book.whyWritten || ''} onChange={(e) => setBookField(idx, 'whyWritten', e.target.value)} placeholder="Why I wrote this — alasan personal/kreatif menulis karya ini" className={`${inputClsSm} resize-none`} />

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                  <div className="mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Book Autopsy</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">Empat catatan pendek yang mengelilingi cover di halaman Book. Kosongkan field yang tidak ingin ditampilkan.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <textarea rows={2} value={book.origin || ''} onChange={(e) => setBookField(idx, 'origin', e.target.value)} placeholder="Origin — dari mana gagasan buku ini lahir?" className={`${inputClsSm} resize-none`} />
                    <textarea rows={2} value={book.coreQuestion || ''} onChange={(e) => setBookField(idx, 'coreQuestion', e.target.value)} placeholder="Core Question — pertanyaan utama buku" className={`${inputClsSm} resize-none`} />
                    <textarea rows={2} value={book.writtenDuring || ''} onChange={(e) => setBookField(idx, 'writtenDuring', e.target.value)} placeholder="Written During — periode atau keadaan saat ditulis" className={`${inputClsSm} resize-none`} />
                    <textarea rows={2} value={book.almostDeleted || ''} onChange={(e) => setBookField(idx, 'almostDeleted', e.target.value)} placeholder="Almost Deleted — bagian yang nyaris dibuang" className={`${inputClsSm} resize-none`} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {book.coverImage && (
                    <img src={book.coverImage} alt={book.title} className="w-10 h-14 rounded object-cover border border-gray-300 dark:border-gray-600 shrink-0" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingBookCover === idx}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setUploadingBookCover(idx);
                      const url = await uploadImageToStorage(file);
                      setUploadingBookCover(null);
                      if (url) setBookField(idx, 'coverImage', url);
                      e.target.value = '';
                    }}
                    className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                  />
                </div>
                <input type="text" value={book.coverImage} onChange={(e) => setBookField(idx, 'coverImage', e.target.value)} placeholder="Atau tempel URL Cover Buku" className={inputClsSm} />

                <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] text-gray-400 mb-1.5 mt-2">
                    Foto overview — muncul di halaman kiri pas sampul buku diklik/dibuka di halaman publik (opsional)
                  </p>
                  <div className="flex items-center gap-2">
                    {book.overviewImage && (
                      <img src={book.overviewImage} alt="" className="w-14 h-10 rounded object-cover border border-gray-300 dark:border-gray-600 shrink-0" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingBookOverview === idx}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setUploadingBookOverview(idx);
                        const url = await uploadImageToStorage(file);
                        setUploadingBookOverview(null);
                        if (url) setBookField(idx, 'overviewImage', url);
                        e.target.value = '';
                      }}
                      className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                    />
                  </div>
                  <input type="text" value={book.overviewImage || ''} onChange={(e) => setBookField(idx, 'overviewImage', e.target.value)} placeholder="Atau tempel URL Foto Overview" className={`${inputClsSm} mt-2`} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input type="text" value={book.pageCount || ''} onChange={(e) => setBookField(idx, 'pageCount', e.target.value)} placeholder="Jumlah Halaman (mis. 184)" className={inputClsSm} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input type="text" value={book.actionText} onChange={(e) => setBookField(idx, 'actionText', e.target.value)} placeholder="Teks Tombol (mis. Beli Buku Ini)" className={inputClsSm} />
                  <input type="text" value={book.actionUrl} onChange={(e) => setBookField(idx, 'actionUrl', e.target.value)} placeholder="Link Tombol" className={inputClsSm} />
                  <input type="text" value={book.secondaryText || ''} onChange={(e) => setBookField(idx, 'secondaryText', e.target.value)} placeholder="Teks tombol kedua (opsional)" className={inputClsSm} />
                  <input type="text" value={book.secondaryUrl || ''} onChange={(e) => setBookField(idx, 'secondaryUrl', e.target.value)} placeholder="Link tombol kedua" className={inputClsSm} />
                </div>
              </ContentCard>
            ))}
          </div>
        )}

        {/* ================= PROJECTS ================= */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab Projects</h2>

            <Field label="Heading Halaman">
              <input type="text" value={formData.projects.heading} onChange={(e) => setProjectsField('heading', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Subheading Halaman">
              <textarea rows={2} value={formData.projects.subheading} onChange={(e) => setProjectsField('subheading', e.target.value)} className={`${inputCls} resize-none`} />
            </Field>

            {/* Sub-tab: Articles / Poster / tiap Tab Tambahan dapet pill nama sendiri —
                sama kayak Articles & Poster, mirroring nav di halaman publiknya sendiri.
                "+ Tambah Tab" nempel di ujung, klik langsung bikin tab baru & pindah ke situ. */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-3 flex-wrap items-center">
              {[
                { key: 'articles', label: `Articles (${formData.projects.articles.length})` },
                { key: 'directing', label: `Directing (${formData.projects.directing.items.length})` },
                { key: 'poster', label: `Poster (${formData.projects.poster.items.length})` },
                ...formData.projects.customSections.map((cs, idx) => ({
                  key: `custom:${cs.id}`,
                  label: cs.label || `Tab Baru #${idx + 1}`,
                })),
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveProjectsSubTab(t.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                    activeProjectsSubTab === t.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={addCustomSection}
                title="Tambah tab baru di luar Articles & Poster"
                className="px-3 py-1.5 text-xs font-semibold rounded border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                + Tambah Tab
              </button>
            </div>

            {/* ARTICLES — gaya portal berita, artikel pertama otomatis jadi unggulan */}
            {activeProjectsSubTab === 'articles' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Articles</h3>
                <AddBtn onClick={addArticle} label="Tambah Artikel" />
              </div>
              <Field label='Nama Tab (tampil di navigasi, kosongkan buat pakai "Articles")'>
                <input
                  type="text"
                  value={formData.projects.articlesLabel}
                  onChange={(e) => setProjectsField('articlesLabel', e.target.value)}
                  placeholder="Articles"
                  className={inputClsSm}
                />
              </Field>
              <p className="text-[10px] text-gray-400 -mt-1">
                Artikel #1 di daftar bakal tampil besar sebagai artikel unggulan di halaman publik, sisanya jadi daftar kecil di sampingnya. Urutan bisa diatur dengan menyusun ulang artikel di sini.
              </p>
              {formData.projects.articles.map((art, idx) => {
                const isOpen = expandedArticleIdx === idx;
                if (!isOpen) {
                  // ---------- BARIS COLLAPSED: judul + tanggal + tombol Edit doang ----------
                  return (
                    <div
                      key={art.id || idx}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop('articles', idx)}
                      className={`flex items-center gap-2 p-3 bg-gray-50 dark:bg-[#2d2d2d] rounded border border-gray-200 dark:border-gray-700 transition-opacity ${
                        draggingKey === `articles-${idx}` ? 'opacity-40' : ''
                      }`}
                    >
                      <ReorderHandle listKey="articles" idx={idx} count={formData.projects.articles.length} />
                      <button
                        type="button"
                        onClick={() => setExpandedArticleIdx(idx)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {idx === 0 && <span className="text-blue-500 mr-1">(Unggulan)</span>}
                          {art.title || <span className="italic text-gray-400 font-normal">Artikel #{idx + 1} — belum ada judul</span>}
                        </span>
                        {art.date && (
                          <span className="block text-[10px] font-mono text-gray-400 mt-0.5">{art.date}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedArticleIdx(idx)}
                        className="text-[10px] px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 shrink-0"
                      >
                        Edit
                      </button>
                      <RemoveBtn onClick={() => removeArticle(idx)} />
                    </div>
                  );
                }

                // ---------- BARIS EXPANDED: form lengkap 1 artikel ----------
                return (
                <div
                  key={art.id || idx}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop('articles', idx)}
                  className={`p-4 bg-gray-50 dark:bg-[#2d2d2d] rounded border border-blue-300 dark:border-blue-700 space-y-2 transition-opacity ${
                    draggingKey === `articles-${idx}` ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ReorderHandle listKey="articles" idx={idx} count={formData.projects.articles.length} />
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        Artikel #{idx + 1} {idx === 0 && <span className="text-blue-500">(Unggulan)</span>}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={art.hintEnabled !== false}
                          onChange={(e) => setArticleField(idx, 'hintEnabled', e.target.checked)}
                          className="accent-blue-600"
                        />
                        Blink pas mode Hint
                      </label>
                      <button
                        type="button"
                        onClick={() => setExpandedArticleIdx(null)}
                        className="text-[10px] px-2.5 py-1 bg-gray-200 dark:bg-[#3a3a3a] text-gray-600 dark:text-gray-300 rounded font-semibold hover:bg-gray-300 dark:hover:bg-[#454545]"
                      >
                        Tutup
                      </button>
                      <RemoveBtn onClick={() => removeArticle(idx)} />
                    </div>
                  </div>
                  <input type="text" value={art.title} onChange={(e) => setArticleField(idx, 'title', e.target.value)} placeholder="Judul Artikel" className={inputClsSm} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input type="text" value={art.date} onChange={(e) => setArticleField(idx, 'date', e.target.value)} placeholder="Tanggal (mis. 12 Mei 2026)" className={inputClsSm} />
                    <input type="text" value={art.category} onChange={(e) => setArticleField(idx, 'category', e.target.value)} placeholder="Kategori (mis. ESAI)" className={inputClsSm} />
                    <input type="text" value={art.author} onChange={(e) => setArticleField(idx, 'author', e.target.value)} placeholder="Penulis (opsional)" className={inputClsSm} />
                  </div>

                  <div className="flex items-center gap-2">
                    {art.image && (
                      <img src={art.image} alt={art.title} className="w-16 h-12 rounded object-cover border border-gray-300 dark:border-gray-600 shrink-0" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingArticleImage === idx}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (!validateProjectCover(file, 'writing')) { e.target.value = ''; return; }
                        setUploadingArticleImage(idx);
                        const url = await uploadImageToStorage(file);
                        setUploadingArticleImage(null);
                        if (url) setArticleField(idx, 'image', url);
                        e.target.value = '';
                      }}
                      className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                    />
                  </div>
                  <ProjectCoverHint contentType="writing" />
                  <input type="text" value={art.image} onChange={(e) => setArticleField(idx, 'image', e.target.value)} placeholder="Atau tempel URL Gambar Artikel (dari galeri/hosting lain)" className={inputClsSm} />

                  <textarea rows={2} value={art.snippet} onChange={(e) => setArticleField(idx, 'snippet', e.target.value)} placeholder="Cuplikan singkat" className={`${inputClsSm} resize-none`} />

                  <div>
                    <label className="block text-[10px] font-medium mb-1 text-gray-500">Isi Lengkap Artikel (bisa Bold/Italic/Underline/List/Link)</label>
                    <RichTextEditor
                      key={art.id || idx}
                      initialValue={art.content}
                      onChange={(html) => setArticleField(idx, 'content', html)}
                      placeholder="Tulis isi artikel lengkap di sini..."
                    />
                  </div>
                </div>
                );
              })}
            </div>
            )}

            {activeProjectsSubTab === 'directing' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Directing / Film Works</h3><AddBtn onClick={addDirectingItem} label="Tambah Video Work" /></div>
                <Field label='Nama Tab'><input type="text" value={formData.projects.directingLabel || ''} onChange={(e) => setProjectsField('directingLabel', e.target.value)} placeholder="Directing" className={inputClsSm} /></Field>
                <p className="text-[10px] text-gray-400">YouTube/Vimeo akan diputar di dalam portfolio. Google Drive dan external link memakai tombol fallback jika pemilik file melarang embed.</p>
                {formData.projects.directing.items.map((item, idx) => (
                  <ContentCard key={item.id || idx} cardKey={`directing-${item.id || idx}`} listKey="directing" idx={idx} count={formData.projects.directing.items.length} title={item.title || `Video Work #${idx + 1}`} subtitle={[item.role, item.year, item.runtime].filter(Boolean).join(' · ')} onRemove={() => removeDirectingItem(idx)}>
                    <div className="flex justify-end"><label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500"><input type="checkbox" checked={item.hintEnabled !== false} onChange={(e) => setDirectingItemField(idx, 'hintEnabled', e.target.checked)} className="accent-blue-600" /> Blink pas mode Help</label></div>
                    <input value={item.title || ''} onChange={(e) => setDirectingItemField(idx, 'title', e.target.value)} placeholder="Judul karya" className={inputClsSm} />
                    <textarea rows={2} value={item.premise || ''} onChange={(e) => setDirectingItemField(idx, 'premise', e.target.value)} placeholder="One-line premise / ringkasan singkat" className={`${inputClsSm} resize-y`} />
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3"><input value={item.role || ''} onChange={(e) => setDirectingItemField(idx, 'role', e.target.value)} placeholder="Role: Director & Writer" className={inputClsSm} /><input value={item.year || ''} onChange={(e) => setDirectingItemField(idx, 'year', e.target.value)} placeholder="Tahun" className={inputClsSm} /><input value={item.runtime || ''} onChange={(e) => setDirectingItemField(idx, 'runtime', e.target.value)} placeholder="Durasi: 08:42" className={inputClsSm} /></div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.35fr_1fr]"><select value={item.mediaType || 'youtube'} onChange={(e) => setDirectingItemField(idx, 'mediaType', e.target.value)} className={inputClsSm}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="drive">Google Drive</option><option value="video">Direct MP4/WebM</option><option value="external">External Link</option></select><input value={item.mediaUrl || ''} onChange={(e) => setDirectingItemField(idx, 'mediaUrl', e.target.value)} placeholder="URL video/media" className={inputClsSm} /></div>
                    <div className="flex items-center gap-2">{item.posterImage && <img src={item.posterImage} alt="" className="h-12 w-20 rounded object-cover" />}<input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files[0]; if (!file) return; if (!validateProjectCover(file, 'video')) { e.target.value = ''; return; } const key = `directing-${idx}`; setUploadingGalleryImage(key); const url = await uploadImageToStorage(file); setUploadingGalleryImage(null); if (url) setDirectingItemField(idx, 'posterImage', url); e.target.value = ''; }} className="flex-1 text-[10px]" /></div>
                    <ProjectCoverHint contentType="video" />
                    <input value={item.posterImage || ''} onChange={(e) => setDirectingItemField(idx, 'posterImage', e.target.value)} placeholder="Atau tempel URL poster/thumbnail" className={inputClsSm} />
                    <Field label="Kontribusi / What I did"><RichTextEditor key={`contribution-${item.id || idx}`} initialValue={item.contribution || ''} onChange={(html) => setDirectingItemField(idx, 'contribution', html)} placeholder="Jelaskan keputusan kreatif dan kontribusi konkret..." /></Field>
                    <Field label="Credits"><RichTextEditor key={`credits-${item.id || idx}`} initialValue={item.credits || ''} onChange={(html) => setDirectingItemField(idx, 'credits', html)} placeholder="Cast, crew, collaborator..." /></Field>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2"><input value={item.externalLabel || ''} onChange={(e) => setDirectingItemField(idx, 'externalLabel', e.target.value)} placeholder="Label tombol tambahan" className={inputClsSm} /><input value={item.externalUrl || ''} onChange={(e) => setDirectingItemField(idx, 'externalUrl', e.target.value)} placeholder="URL tombol tambahan" className={inputClsSm} /></div>
                  </ContentCard>
                ))}
              </div>
            )}

            {/* POSTER — daftar file langsung, klik "Tambah Poster" langsung nambah item baru */}
            {activeProjectsSubTab === 'poster' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Poster</h3>
                <AddBtn onClick={addPosterItem} label="Tambah Poster" />
              </div>
              <Field label='Nama Tab (tampil di navigasi, kosongkan buat pakai "Poster")'>
                <input
                  type="text"
                  value={formData.projects.posterLabel}
                  onChange={(e) => setProjectsField('posterLabel', e.target.value)}
                  placeholder="Poster"
                  className={inputClsSm}
                />
              </Field>
              {formData.projects.poster.items.length === 0 && (
                <p className="text-[10px] text-gray-400 italic">Belum ada poster. Klik "+ Tambah Poster" buat mulai.</p>
              )}
              {formData.projects.poster.items.map((it, idx) =>
                renderPosterItem(it, idx, formData.projects.poster.items)
              )}
            </div>
            )}

            {/* TAB TAMBAHAN — tiap custom section udah dapet pill nav sendiri di atas
                (sejajar Articles/Poster), jadi di sini cuma render section yang lagi
                aktif aja (dicari lewat activeProjectsSubTab = "custom:<id>"). */}
            {activeProjectsSubTab.startsWith('custom:') && (() => {
              const sectionIdx = formData.projects.customSections.findIndex(
                (cs) => `custom:${cs.id}` === activeProjectsSubTab
              );
              if (sectionIdx === -1) return null;
              return (
                <div className="space-y-3">
                  {renderCustomSectionBlock(formData.projects.customSections[sectionIdx], sectionIdx)}
                </div>
              );
            })()}
          </div>
        )}

        {/* ================= CONTACT ================= */}
        {activeTab === 'contact' && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Contact — New Collaboration Document</h2>
            <Field label="Eyebrow"><input type="text" value={formData.contact.eyebrow} onChange={(e) => setContactField('eyebrow', e.target.value)} className={inputCls} /></Field>
            <Field label="Heading Utama"><textarea rows={2} value={formData.contact.heading} onChange={(e) => setContactField('heading', e.target.value)} className={`${inputCls} resize-none`} /></Field>
            <Field label="Subheading"><textarea rows={2} value={formData.contact.subheading} onChange={(e) => setContactField('subheading', e.target.value)} className={`${inputCls} resize-none`} /></Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Email Tujuan"><input type="email" value={formData.contact.email} onChange={(e) => setContactField('email', e.target.value)} className={inputCls} /></Field>
              <Field label="Lokasi Fallback"><input type="text" value={formData.contact.location} onChange={(e) => setContactField('location', e.target.value)} className={inputCls} /></Field>
              <Field label="Label Tombol Draft"><input type="text" value={formData.contact.draftButtonLabel} onChange={(e) => setContactField('draftButtonLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Notifikasi Setelah Klik"><input type="text" value={formData.contact.responseNote} onChange={(e) => setContactField('responseNote', e.target.value)} className={inputCls} /></Field>
            </div>

            <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold">Jalur Inquiry</label><AddBtn onClick={() => addContactListItem('inquiryPaths', { id: `path-${Date.now()}`, kind: 'hello', label: '', subject: '', enabled: true })} label="Tambah Jalur" /></div><div className="space-y-2">{formData.contact.inquiryPaths.map((item, idx) => <ContentCard key={item.id || idx} cardKey={`inquiry-${idx}`} listKey="inquiryPaths" idx={idx} count={formData.contact.inquiryPaths.length} title={item.label || `Jalur #${idx + 1}`} subtitle={item.subject || 'Subject belum diisi'} onRemove={() => removeContactListItem('inquiryPaths', idx)}><div className="grid grid-cols-1 gap-2 md:grid-cols-[0.8fr_1fr_1fr_auto]"><select value={item.kind || item.id} onChange={(e) => setContactListItem('inquiryPaths', idx, { kind: e.target.value })} className={inputClsSm}><option value="project">Proyek</option><option value="opportunity">Peluang Kerja</option><option value="hello">Pesan Bebas</option></select><input value={item.label} onChange={(e) => setContactListItem('inquiryPaths', idx, { label: e.target.value })} placeholder="Label" className={inputClsSm} /><input value={item.subject} onChange={(e) => setContactListItem('inquiryPaths', idx, { subject: e.target.value })} placeholder="Subject email" className={inputClsSm} /><label className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={item.enabled !== false} onChange={(e) => setContactListItem('inquiryPaths', idx, { enabled: e.target.checked })} /> Tampil</label></div></ContentCard>)}</div></div>

            {[['serviceOptions', 'Pilihan Layanan'], ['stageOptions', 'Tahap Proyek'], ['timelineOptions', 'Pilihan Timeline']].map(([key, label]) => <div key={key}><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold">{label}</label><AddBtn onClick={() => addContactListItem(key, '')} label="Tambah Opsi" /></div><div className="space-y-2">{formData.contact[key].map((item, idx) => <ContentCard key={`${key}-${idx}`} cardKey={`${key}-${idx}`} listKey={key} idx={idx} count={formData.contact[key].length} title={item || `Opsi #${idx + 1}`} subtitle="Drag untuk mengubah urutan" onRemove={() => removeContactListItem(key, idx)}><input value={item} onChange={(e) => setStringListItem(key, idx, e.target.value)} className={inputClsSm} /></ContentCard>)}</div></div>)}

            <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold">Document Properties</label><AddBtn onClick={() => addContactListItem('properties', { id: `property-${Date.now()}`, label: '', value: '', enabled: true })} label="Tambah Property" /></div><div className="space-y-2">{formData.contact.properties.map((item, idx) => <ContentCard key={item.id || idx} cardKey={`property-${idx}`} listKey="properties" idx={idx} count={formData.contact.properties.length} title={item.label || `Property #${idx + 1}`} subtitle={item.value || 'Belum diisi'} onRemove={() => removeContactListItem('properties', idx)}><div className="grid grid-cols-1 gap-2 md:grid-cols-[0.7fr_1.3fr_auto]"><input value={item.label} onChange={(e) => setContactListItem('properties', idx, { label: e.target.value })} placeholder="Label" className={inputClsSm} /><input value={item.value} onChange={(e) => setContactListItem('properties', idx, { value: e.target.value })} placeholder="Isi" className={inputClsSm} /><label className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={item.enabled !== false} onChange={(e) => setContactListItem('properties', idx, { enabled: e.target.checked })} /> Tampil</label></div></ContentCard>)}</div></div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium">Sosial Media</label>
                <AddBtn onClick={addSocial} label="Tambah Sosmed" />
              </div>
              <div className="space-y-2">
                {formData.contact.socials.map((s, idx) => (
                  <ContentCard key={idx} cardKey={`social-${idx}`} listKey="socials" idx={idx} count={formData.contact.socials.length} title={s.name || `Sosial Media #${idx + 1}`} subtitle={s.label || s.url || 'Belum diisi'} onRemove={() => removeSocial(idx)}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                    <input type="text" value={s.name} onChange={(e) => setSocialField(idx, 'name', e.target.value)} placeholder="Nama (mis. LinkedIn)" className={inputClsSm} />
                    <input type="text" value={s.url} onChange={(e) => setSocialField(idx, 'url', e.target.value)} placeholder="URL" className={inputClsSm} />
                    <input type="text" value={s.label} onChange={(e) => setSocialField(idx, 'label', e.target.value)} placeholder="Label (mis. Connect on LinkedIn)" className={inputClsSm} />
                  </div>
                  </ContentCard>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium">Link Tambahan (mis. Download Résumé)</label>
                <AddBtn onClick={addActionButton} label="Tambah Tombol" />
              </div>
              <p className="text-[10px] text-gray-400 mb-2">
                Buat tombol "Download Resume": isi Label-nya, terus di kolom Link tinggal upload file
                PDF-nya langsung dari perangkat lo — link publiknya otomatis keisi sendiri.
              </p>
              <div className="space-y-2">
                {formData.contact.actionButtons.map((btn, idx) => (
                  <ContentCard key={idx} cardKey={`action-${idx}`} listKey="actionButtons" idx={idx} count={formData.contact.actionButtons.length} title={btn.label || `Tombol Aksi #${idx + 1}`} subtitle={btn.url || 'Belum ada link'} onRemove={() => removeActionButton(idx)}>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input type="text" value={btn.label} onChange={(e) => setActionButtonField(idx, 'label', e.target.value)} placeholder="Label Tombol" className={inputClsSm} />
                      <input type="text" value={btn.url} onChange={(e) => setActionButtonField(idx, 'url', e.target.value)} placeholder="Link (atau upload file di bawah)" className={inputClsSm} />
                      <span className="text-[10px] text-gray-400">Footer link</span>
                    </div>
                    <div className="flex items-center gap-2 pl-0.5">
                      <input
                        type="file"
                        accept=".pdf,application/pdf,image/*"
                        disabled={uploadingActionButton === idx}
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setUploadingActionButton(idx);
                          const url = await uploadImageToStorage(file);
                          setUploadingActionButton(null);
                          if (url) setActionButtonField(idx, 'url', url);
                          e.target.value = '';
                        }}
                        className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                      />
                      {uploadingActionButton === idx && (
                        <span className="text-[10px] text-blue-500 animate-pulse shrink-0">Mengupload...</span>
                      )}
                      {btn.url && !uploadingActionButton && (
                        <a href={btn.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-400 hover:text-blue-600 underline shrink-0">
                          Lihat file saat ini
                        </a>
                      )}
                    </div>
                  </ContentCard>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= VISITOR INTRODUCTION ================= */}
        {activeTab === 'visitorIntroduction' && (
          <div className="space-y-5">
            <div>
              <h2 className="border-b border-gray-100 pb-2 text-sm font-bold text-blue-600 dark:border-gray-800 dark:text-blue-400">Visitor Introduction / Printed Takeover</h2>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">Printer muncul di area abu-abu kiri Home. Saat ditekan, kertas berkembang memenuhi layar dan menjelaskan isi portofolio.</p>
            </div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.home.visitorIntroduction.enabled !== false} onChange={(e) => setVisitorIntroduction('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Aktifkan Visitor’s Copy</label>

            <ContentCard cardKey="visitor-trigger" listKey="visitor-introduction" idx={0} count={1} title="Printer di margin kiri" subtitle={formData.home.visitorIntroduction.triggerTitle || 'New to this document?'}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Label kecil"><input value={formData.home.visitorIntroduction.triggerEyebrow || ''} onChange={(e) => setVisitorIntroduction('triggerEyebrow', e.target.value)} className={inputCls} /></Field>
                <Field label="Judul printer"><input value={formData.home.visitorIntroduction.triggerTitle || ''} onChange={(e) => setVisitorIntroduction('triggerTitle', e.target.value)} className={inputCls} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Ajakan sebelum dicetak"><input value={formData.home.visitorIntroduction.triggerAction || ''} onChange={(e) => setVisitorIntroduction('triggerAction', e.target.value)} className={inputCls} /></Field>
                <Field label="Label setelah pernah dibuka"><input value={formData.home.visitorIntroduction.printedLabel || ''} onChange={(e) => setVisitorIntroduction('printedLabel', e.target.value)} className={inputCls} /></Field>
              </div>
            </ContentCard>

            <ContentCard cardKey="visitor-sheet" listKey="visitor-introduction" idx={0} count={1} title="Isi lembar fullscreen" subtitle={formData.home.visitorIntroduction.documentCode || 'Visitor’s Copy'}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Kode dokumen"><input value={formData.home.visitorIntroduction.documentCode || ''} onChange={(e) => setVisitorIntroduction('documentCode', e.target.value)} className={inputCls} /></Field>
                <Field label="Dicetak untuk"><input value={formData.home.visitorIntroduction.recipient || ''} onChange={(e) => setVisitorIntroduction('recipient', e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Label pembuka"><input value={formData.home.visitorIntroduction.kicker || ''} onChange={(e) => setVisitorIntroduction('kicker', e.target.value)} className={inputCls} /></Field>
              <Field label="Judul besar"><textarea rows={3} value={formData.home.visitorIntroduction.title || ''} onChange={(e) => setVisitorIntroduction('title', e.target.value)} className={`${inputCls} resize-y font-serif`} /></Field>
              <Field label="Penjelasan portofolio"><textarea rows={5} value={formData.home.visitorIntroduction.body || ''} onChange={(e) => setVisitorIntroduction('body', e.target.value)} className={`${inputCls} resize-y`} /></Field>
              <Field label="Kalimat penutup"><textarea rows={3} value={formData.home.visitorIntroduction.closing || ''} onChange={(e) => setVisitorIntroduction('closing', e.target.value)} className={`${inputCls} resize-y`} /></Field>
              <Field label="Tulisan tombol Close"><input value={formData.home.visitorIntroduction.closeLabel || ''} onChange={(e) => setVisitorIntroduction('closeLabel', e.target.value)} className={inputCls} /></Field>
            </ContentCard>
          </div>
        )}

        {/* ================= ZINE ================= */}
        {activeTab === 'zine' && (
          <div className="space-y-5">
            <h2 className="border-b border-gray-100 pb-2 text-sm font-bold text-blue-600 dark:border-gray-800 dark:text-blue-400">Wassup? / Writing Exchange</h2>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.zine.enabled !== false} onChange={(e) => setZine('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Tampilkan pilihan Wassup?</label>
            <div className="grid gap-3 md:grid-cols-3"><Field label="Nama pada tombol pilihan"><input value={formData.zine.menuLabel || ''} onChange={(e) => setZine('menuLabel', e.target.value)} className={inputCls} placeholder="Wassup?" /></Field><Field label="Judul pengalaman"><input value={formData.zine.title || ''} onChange={(e) => setZine('title', e.target.value)} className={inputCls} /></Field><Field label="Batas karakter"><input type="number" min="100" max="5000" value={formData.zine.maxLength || 1200} onChange={(e) => setZine('maxLength', Number(e.target.value))} className={inputCls} /></Field></div>
            <Field label="Prompt menulis"><input value={formData.zine.writePrompt || ''} onChange={(e) => setZine('writePrompt', e.target.value)} className={inputCls} /></Field>
            <Field label="Pesan setelah Send"><input value={formData.zine.submitSuccess || ''} onChange={(e) => setZine('submitSuccess', e.target.value)} className={inputCls} /></Field>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Inbox kiriman pembaca</h3>
                  <p className="mt-1 text-[11px] text-gray-500">Edit bila perlu, lalu Approve agar bisa diterima pengunjung lain atau Reject untuk menyembunyikannya.</p>
                </div>
                <button type="button" onClick={loadZineInbox} disabled={zineInboxLoading} className="rounded border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:bg-[#252525] dark:text-blue-300">{zineInboxLoading ? 'Memuat…' : 'Refresh Inbox'}</button>
              </div>
              {zineInboxError && <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{zineInboxError}</p>}
              {!zineInboxLoading && !zineInbox.length && !zineInboxError && <p className="text-xs text-gray-500">Belum ada kiriman pembaca.</p>}
              <div className="space-y-3">
                {zineInbox.map((entry) => (
                  <ContentCard key={`inbox-${entry.id}`} cardKey={`zine-inbox-${entry.id}`} listKey="zine-inbox" idx={0} count={1} title={`Submission #${entry.id}`} subtitle={`${entry.status.toUpperCase()} · ${new Date(entry.created_at).toLocaleString('id-ID')}`}>
                    <Field label="Isi kiriman"><textarea rows={7} maxLength={5000} value={entry.body || ''} onChange={(event) => editInboxZine(entry.id, event.target.value)} className={`${inputCls} resize-y font-serif`} /></Field>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`mr-auto rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${entry.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : entry.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>{entry.status}</span>
                      <button type="button" disabled={moderatingZineId === entry.id} onClick={() => moderateInboxZine(entry, 'pending')} className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-600">Pending</button>
                      <button type="button" disabled={moderatingZineId === entry.id} onClick={() => moderateInboxZine(entry, 'rejected')} className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50 dark:border-red-800 dark:text-red-300">Reject</button>
                      <button type="button" disabled={moderatingZineId === entry.id} onClick={() => moderateInboxZine(entry, 'approved')} className="rounded bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{moderatingZineId === entry.id ? 'Menyimpan…' : 'Approve'}</button>
                    </div>
                  </ContentCard>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Zine yang dapat diterima pengunjung</h3><button type="button" onClick={addZineEntry} className="rounded border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600">+ Tambah Zine</button></div>
            <div className="space-y-3">{formData.zine.entries.map((entry, index) => <ContentCard key={entry.id || index} cardKey={`zine-${index}`} listKey="zines" idx={index} count={formData.zine.entries.length} title={entry.title || `Zine #${index + 1}`} subtitle={entry.author || 'Anonymous'} onRemove={() => removeZineEntry(index)}>
              <div className="grid gap-3 md:grid-cols-2"><Field label="Judul"><input value={entry.title || ''} onChange={(e) => updateZineEntry(index, { title: e.target.value })} className={inputCls} /></Field><Field label="Penulis"><input value={entry.author || ''} onChange={(e) => updateZineEntry(index, { author: e.target.value })} className={inputCls} /></Field></div>
              <Field label="Label kecil"><input value={entry.label || ''} onChange={(e) => updateZineEntry(index, { label: e.target.value })} className={inputCls} /></Field>
              <Field label="Isi zine"><textarea rows={8} value={entry.body || ''} onChange={(e) => updateZineEntry(index, { body: e.target.value })} className={`${inputCls} resize-y font-serif`} /></Field>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={entry.published !== false} onChange={(e) => updateZineEntry(index, { published: e.target.checked })} className="h-4 w-4 accent-[#2B579A]" />Boleh diterima pengunjung</label>
            </ContentCard>)}</div>
          </div>
        )}

        {/* ================= MINI GAME ================= */}
        {activeTab === 'miniGame' && (
          <div className="space-y-5">
            {activeMiniGameEditor === null ? <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800"><h2 className="text-sm font-bold text-blue-600 dark:text-blue-400">Mini Game Archive</h2><button type="button" onClick={addMiniGameSlot} className="rounded border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600">+ Tambah Slot Game</button></div><p className="text-xs leading-relaxed text-gray-500">Setiap slot punya formulir lengkap seperti The Red Pen. Klik slot untuk mengisi aturan, skor, gelar, hasil, dan draft-nya.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setActiveMiniGameEditor('redPen')} className="rounded-md border border-blue-500 bg-blue-50 px-4 py-3 text-left transition-all hover:shadow-md dark:bg-blue-950/30"><span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-blue-600">01 / Aktif</span><strong className="mt-1 block text-sm">{formData.miniGame.gameName || 'The Red Pen'}</strong></button>{(formData.miniGame.gameSlots || []).map((slot, index) => <div key={slot.id || index} className="flex min-w-52 items-stretch rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-[#2d2d2d]"><button type="button" onClick={() => setActiveMiniGameEditor(`slot-${index}`)} className="min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/20"><span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-gray-400">{String(index + 2).padStart(2, '0')} / {slot.gameName?.trim() ? 'Aktif' : 'Kosong'}</span><strong className="mt-1 block truncate text-sm">{slot.gameName || `Game ${index + 2}`}</strong></button><button type="button" onClick={() => removeMiniGameSlot(index)} className="px-3 text-xs font-semibold text-red-500" aria-label={`Hapus slot ${slot.gameName || index + 2}`}>×</button></div>)}</div></> : <><button type="button" onClick={() => setActiveMiniGameEditor(null)} className="font-mono text-xs text-gray-500 hover:text-blue-600">← Daftar Mini Game</button><h2 className="border-b border-gray-100 pb-2 text-sm font-bold text-blue-600 dark:border-gray-800 dark:text-blue-400">Mini Game Archive / {editingMiniGame.gameName || 'Game baru'}</h2>
            {activeMiniGameEditor === 'redPen' && <><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editingMiniGame.enabled !== false} onChange={(e) => setMiniGame('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Tampilkan tombol Mini Game di Home</label><div className="grid gap-3 md:grid-cols-2"><Field label="Label menu di Home"><input value={editingMiniGame.menuLabel || ''} onChange={(e) => setMiniGame('menuLabel', e.target.value)} className={inputCls} /></Field><Field label="Judul halaman pilihan game"><input value={editingMiniGame.libraryTitle || ''} onChange={(e) => setMiniGame('libraryTitle', e.target.value)} className={inputCls} /></Field></div><Field label="Deskripsi halaman pilihan game"><textarea rows={2} value={editingMiniGame.libraryDescription || ''} onChange={(e) => setMiniGame('libraryDescription', e.target.value)} className={`${inputCls} resize-y`} /></Field></>}
            <label className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/20"><input type="checkbox" checked={editingMiniGame.showInLibrary === true} onChange={(e) => setMiniGame('showInLibrary', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Tampilkan game ini di halaman Mini Game</label>
            <div className="grid gap-3 md:grid-cols-2"><Field label="Nama mini game"><input value={editingMiniGame.gameName || ''} onChange={(e) => setMiniGame('gameName', e.target.value)} className={inputCls} /></Field><Field label="Kategori mini game"><input value={editingMiniGame.gameCategory || ''} onChange={(e) => setMiniGame('gameCategory', e.target.value)} className={inputCls} /></Field></div>
            <Field label="Deskripsi kartu mini game"><textarea rows={2} value={editingMiniGame.gameCardDescription || ''} onChange={(e) => setMiniGame('gameCardDescription', e.target.value)} className={`${inputCls} resize-y`} /></Field>
            <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"><h3 className="font-mono text-xs font-bold uppercase tracking-wide text-blue-600">Ilustrasi kartu game</h3>{editingMiniGame.illustration && <img src={editingMiniGame.illustration} alt="Preview ilustrasi game" className="h-36 w-full rounded border border-gray-200 object-cover dark:border-gray-700" />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { dispatchCmsNotice('Ilustrasi game maksimal 2 MB. Pakai JPG/WebP sekitar 1200 × 900 px.'); e.target.value = ''; return; } const url = await uploadImageToStorage(file); if (url) setMiniGame('illustration', url); e.target.value = ''; }} className="block w-full text-xs" /><Field label="Atau tempel URL ilustrasi"><input value={editingMiniGame.illustration || ''} onChange={(e) => setMiniGame('illustration', e.target.value)} placeholder="https://..." className={inputCls} /></Field><p className="text-[11px] text-gray-500">Rekomendasi: WebP/JPG 1200 × 900 px (rasio 4:3), maksimal 500 KB agar rak game tetap ringan.</p></section>
            <Field label="Judul halaman permainan"><input value={editingMiniGame.title || ''} onChange={(e) => setMiniGame('title', e.target.value)} className={inputCls} /></Field>
            <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"><h3 className="font-mono text-xs font-bold uppercase tracking-wide text-blue-600">Tampilan peraturan</h3><Field label="Tujuan permainan"><textarea rows={3} value={editingMiniGame.objective || ''} onChange={(e) => setMiniGame('objective', e.target.value)} className={`${inputCls} resize-y`} /></Field><div className="grid gap-3 md:grid-cols-2"><Field label="Aturan 01 — tindakan pemain"><textarea rows={2} value={editingMiniGame.rules.click || ''} onChange={(e) => setMiniGameRule('click', e.target.value)} className={`${inputCls} resize-y`} /></Field><Field label="Aturan 02 — waktu"><textarea rows={2} value={editingMiniGame.rules.timer || ''} onChange={(e) => setMiniGameRule('timer', e.target.value)} className={`${inputCls} resize-y`} /></Field><Field label="Aturan 03 — jawaban salah"><textarea rows={2} value={editingMiniGame.rules.wrong || ''} onChange={(e) => setMiniGameRule('wrong', e.target.value)} className={`${inputCls} resize-y`} /></Field><Field label="Aturan 04 — bantuan"><textarea rows={2} value={editingMiniGame.rules.hint || ''} onChange={(e) => setMiniGameRule('hint', e.target.value)} className={`${inputCls} resize-y`} /></Field></div><Field label="Aturan 05 — review editorial"><textarea rows={2} value={editingMiniGame.rules.review || ''} onChange={(e) => setMiniGameRule('review', e.target.value)} className={`${inputCls} resize-y`} /></Field><Field label="Teks tombol mulai"><input value={editingMiniGame.startButtonLabel || ''} onChange={(e) => setMiniGame('startButtonLabel', e.target.value)} className={inputCls} /></Field></section>
            <div className="grid gap-3 md:grid-cols-2"><Field label="Waktu per draft (detik)"><input type="number" min="15" max="120" value={editingMiniGame.secondsPerDraft || 60} onChange={(e) => setMiniGame('secondsPerDraft', Math.min(120, Math.max(15, Number(e.target.value) || 60)))} className={inputCls} /></Field><Field label="Jumlah draft per permainan (maks. 5)"><input type="number" min="1" max="5" value={editingMiniGame.draftsPerSession || 5} onChange={(e) => setMiniGame('draftsPerSession', Math.min(5, Math.max(1, Number(e.target.value) || 5)))} className={inputCls} /></Field></div>
            <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"><h3 className="font-mono text-xs font-bold uppercase tracking-wide text-blue-600">Sistem skor dan gelar</h3><div className="grid gap-3 md:grid-cols-3"><Field label="Temuan benar (+)"><input type="number" min="0" value={editingMiniGame.scoreSettings.correctPoints} onChange={(e) => setMiniGameScore('correctPoints', e.target.value)} className={inputCls} /></Field><Field label="Klik salah (−)"><input type="number" min="0" value={editingMiniGame.scoreSettings.wrongPenalty} onChange={(e) => setMiniGameScore('wrongPenalty', e.target.value)} className={inputCls} /></Field><Field label="Draft selesai (+)"><input type="number" min="0" value={editingMiniGame.scoreSettings.completionBonus} onChange={(e) => setMiniGameScore('completionBonus', e.target.value)} className={inputCls} /></Field><Field label="Maks. bonus waktu (+)"><input type="number" min="0" value={editingMiniGame.scoreSettings.maxTimeBonus} onChange={(e) => setMiniGameScore('maxTimeBonus', e.target.value)} className={inputCls} /></Field><Field label="Pakai hint (−)"><input type="number" min="0" value={editingMiniGame.scoreSettings.hintPenalty} onChange={(e) => setMiniGameScore('hintPenalty', e.target.value)} className={inputCls} /></Field></div><div className="grid gap-3 md:grid-cols-2">{editingMiniGame.gradeTitles.map((item, index) => <div key={index} className="grid grid-cols-[5rem_1fr] gap-2"><Field label="Nilai min."><input type="number" min="0" max="100" value={item.min} onChange={(e) => updateGradeTitle(index, { min: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className={inputCls} /></Field><Field label={`Nama gelar ${index + 1}`}><input value={item.label || ''} onChange={(e) => updateGradeTitle(index, { label: e.target.value })} className={inputCls} /></Field></div>)}</div></section>
            <section className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"><h3 className="font-mono text-xs font-bold uppercase tracking-wide text-blue-600">Tampilan hasil</h3><div className="grid gap-3 md:grid-cols-2"><Field label="Label laporan hasil"><input value={editingMiniGame.resultEyebrow || ''} onChange={(e) => setMiniGame('resultEyebrow', e.target.value)} className={inputCls} /></Field><Field label="Tombol main ulang"><input value={editingMiniGame.replayLabel || ''} onChange={(e) => setMiniGame('replayLabel', e.target.value)} className={inputCls} /></Field><Field label="Tombol menuju Projects"><input value={editingMiniGame.projectsCtaLabel || ''} onChange={(e) => setMiniGame('projectsCtaLabel', e.target.value)} className={inputCls} /></Field><Field label="Tombol menuju Contact"><input value={editingMiniGame.contactCtaLabel || ''} onChange={(e) => setMiniGame('contactCtaLabel', e.target.value)} className={inputCls} /></Field></div></section>
            <div className="rounded border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><strong>Aturan isi:</strong> frasa bermasalah harus disalin persis dari paragraf dan hanya boleh muncul satu kali. CMS akan menolak Save kalau frasa kosong, tidak ditemukan, atau muncul berulang.</div>
            <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Draft {editingMiniGame.gameName || 'Game baru'}</h3><button type="button" onClick={addGameDraft} className="rounded border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600">+ Tambah Draft</button></div>
            <div className="space-y-3">{editingMiniGame.drafts.map((draft, index) => {
              const errors = redPenDraftErrors(draft);
              return <ContentCard key={draft.id || index} cardKey={`game-${index}`} listKey="gameDrafts" idx={index} count={editingMiniGame.drafts.length} title={`${String(index + 1).padStart(2, '0')} / ${draft.label || 'Tanpa label'}`} subtitle={`${(draft.issues || []).length} koreksi${errors.length ? ` · ${errors.length} perlu diperbaiki` : ' · siap dimainkan'}`} onRemove={() => removeGameDraft(index)}>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]"><Field label="Label tingkat/draft"><input value={draft.label || ''} onChange={(e) => updateGameDraft(index, { label: e.target.value })} className={inputCls} /></Field><label className="flex items-end gap-2 pb-3 text-xs"><input type="checkbox" checked={draft.enabled !== false} onChange={(e) => updateGameDraft(index, { enabled: e.target.checked })} className="h-4 w-4 accent-[#2B579A]" />Aktif</label></div>
                <Field label="Paragraf yang harus diedit"><textarea rows={7} value={draft.passage || ''} onChange={(e) => updateGameDraft(index, { passage: e.target.value })} className={`${inputCls} resize-y font-serif`} /></Field>
                <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700"><h4 className="text-xs font-bold uppercase tracking-wide">Koreksi editorial</h4><button type="button" onClick={() => addGameIssue(index)} className="rounded bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">+ Tambah Koreksi</button></div>
                <div className="space-y-3">{(draft.issues || []).map((issue, issueIndex) => {
                  const phrase = String(issue.phrase || '').trim();
                  const occurrenceCount = phraseOccurrences(draft.passage || '', phrase);
                  const invalid = !phrase || occurrenceCount !== 1 || !String(issue.replacement || '').trim();
                  return <div key={issue.id || issueIndex} className={`rounded border p-3 ${invalid ? 'border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-[#282828]'}`}><div className="mb-2 flex items-center justify-between"><strong className="text-xs">Koreksi #{issueIndex + 1}</strong><button type="button" onClick={() => removeGameIssue(index, issueIndex)} className="text-[10px] font-semibold text-red-500">Hapus</button></div><div className="grid gap-3 md:grid-cols-2"><Field label="Frasa bermasalah (salin persis)"><input value={issue.phrase || ''} onChange={(e) => updateGameIssue(index, issueIndex, { phrase: e.target.value })} className={inputCls} /></Field><Field label="Pengganti (atau tulis: hapus)"><input value={issue.replacement || ''} onChange={(e) => updateGameIssue(index, issueIndex, { replacement: e.target.value })} className={inputCls} /></Field></div><Field label="Alasan editorial"><textarea rows={2} value={issue.explanation || ''} onChange={(e) => updateGameIssue(index, issueIndex, { explanation: e.target.value })} className={`${inputCls} resize-y`} /></Field>{phrase && occurrenceCount !== 1 && <p className="mt-2 text-[11px] font-semibold text-red-600">{occurrenceCount === 0 ? 'Frasa ini belum ditemukan persis di paragraf.' : `Frasa ini muncul ${occurrenceCount} kali; buat lebih spesifik.`}</p>}</div>;
                })}</div>
                {errors.length > 0 && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300"><strong>Belum bisa disimpan:</strong><ul className="mt-1 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
              </ContentCard>;
            })}</div></>}
          </div>
        )}

        {activeTab === 'interactiveWords' && (
          <InteractiveLinksEditor
            value={formData.interactiveWords}
            onChange={(interactiveWords) => setFormData((p) => ({ ...p, interactiveWords }))}
            inputClassName={inputCls}
          />
        )}

        {/* ================= GENERAL ================= */}
        {activeTab === 'general' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab General</h2>
            <p className="text-xs text-gray-500 italic">
              Pengaturan situs secara keseluruhan — bukan punya satu halaman tertentu, jadi
              kepisah dari 6 tab konten di atas.
            </p>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center justify-between gap-4">
              <div><h3 className="text-xs font-bold text-gray-800 dark:text-gray-100">Mechanical Interaction Sound</h3><p className="text-[11px] text-gray-400 mt-0.5">Suara klik mekanis setelah pengunjung berinteraksi pertama kali. Pengunjung tetap bisa mematikannya dari Title Bar.</p></div>
              <button type="button" onClick={() => setFormData((previous) => ({ ...previous, general: { ...previous.general, soundEffects: !previous.general.soundEffects } }))} className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${formData.general.soundEffects ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.general.soundEffects ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-800 dark:text-gray-100">Info Update Patch</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Tulis pengumuman perubahan website secara manual. Patch muncul di desktop
                    dan HP sampai pengunjung menutupnya. Ganti kode versi setiap kali ada
                    update baru agar patch muncul lagi untuk pengunjung lama.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWelcomeNotification('enabled', !formData.general.welcomeNotification.enabled)}
                  className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
                    formData.general.welcomeNotification.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  title={formData.general.welcomeNotification.enabled ? 'Aktif — klik buat matiin' : 'Mati — klik buat nyalain'}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      formData.general.welcomeNotification.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <Field label="Kode versi patch">
                <input
                  type="text"
                  value={formData.general.welcomeNotification.version || ''}
                  onChange={(e) => setWelcomeNotification('version', e.target.value)}
                  placeholder="Contoh: 1.1.0 atau 23-09-2026"
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  Wajib dibedakan dari patch sebelumnya supaya notifikasi muncul lagi.
                </p>
              </Field>

              <Field label="Judul update">
                <input
                  type="text"
                  value={formData.general.welcomeNotification.title}
                  onChange={(e) => setWelcomeNotification('title', e.target.value)}
                  placeholder="Update terbaru"
                  className={inputCls}
                />
              </Field>

              <Field label="Isi patch">
                <textarea
                  rows={3}
                  value={formData.general.welcomeNotification.message}
                  onChange={(e) => setWelcomeNotification('message', e.target.value)}
                  placeholder="Contoh: Mini Game baru tersedia dan tampilan Projects sudah diperbarui."
                  className={`${inputCls} resize-y`}
                />
              </Field>

              <Field label="Muncul setelah (detik)">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={formData.general.welcomeNotification.delaySeconds}
                  onChange={(e) => setWelcomeNotification('delaySeconds', Math.max(0, Number(e.target.value) || 0))}
                  className={`${inputCls} max-w-[120px]`}
                />
              </Field>
            </div>

          </div>
        )}
      </>
      )}

      </form>
    </div>
    </CmsCardContext.Provider>
  );
}
