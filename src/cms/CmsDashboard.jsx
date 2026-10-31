import React, { useState, useRef, useEffect } from 'react';
import { supabase, IMAGES_BUCKET } from '../lib/supabaseClient';
import InteractiveLinksEditor from './InteractiveLinksEditor';
import { normalizeVisitorIntroduction } from '../lib/visitorIntroductionData';
import { collectTranslatableStrings, normalizeTranslations, translationValue, withEnglishTranslation, localizedPortfolioData } from '../lib/localization';
import { getZineModerationQueue, moderateZineSubmission, archiveZineSubmissions, getMiniGameLeaderboardAdmin, deleteMiniGameLeaderboardEntry } from '../lib/homeExperienceApi';

import WassupEditor from './wassup/WassupEditor';
import MiniGameEditor from './miniGames/MiniGameEditor';
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
      <span draggable onDragStart={handleDragStart(listKey, idx)} onDragEnd={handleDragEnd} title="Drag to reorder" className="cursor-grab active:cursor-grabbing select-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1 text-sm leading-none">⠿</span>
      <button type="button" onClick={() => reorderList(listKey, idx, idx - 1)} disabled={idx === 0} title="Move up" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed text-[10px] leading-none px-1 py-0.5">▲</button>
      <button type="button" onClick={() => reorderList(listKey, idx, idx + 1)} disabled={idx === count - 1} title="Move down" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-20 disabled:cursor-not-allowed text-[10px] leading-none px-1 py-0.5">▼</button>
    </div>
  );
}

function RemoveBtn({ onClick, label = 'Remove' }) {
  return <button type="button" onClick={onClick} className="text-[10px] text-red-500 hover:text-red-600 font-semibold">{label}</button>;
}

function AddBtn({ onClick, label }) {
  return <button type="button" onClick={onClick} className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40">+ {label}</button>;
}

function CollapsibleSection({ sectionKey, title, subtitle, children, className = '' }) {
  const context = React.useContext(CmsCardContext);
  const isOpen = context?.openSectionKeys?.has(sectionKey) || false;
  const toggle = () => context?.toggleSection?.(sectionKey);

  return (
    <section className={`overflow-hidden rounded-lg border border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-[#282828] ${className}`}>
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-gray-100/70 dark:hover:bg-white/[0.03]" aria-expanded={isOpen}>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">{title}</span>
          {subtitle && <span className="mt-1 block text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{subtitle}</span>}
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded text-gray-400">{isOpen ? '⌃' : '⌄'}</span>
      </button>
      {isOpen && <div className="space-y-4 border-t border-gray-200 p-4 dark:border-gray-700">{children}</div>}
    </section>
  );
}

function ContentCard({ cardKey, listKey, idx, count, title, subtitle, onRemove, children }) {
  const context = React.useContext(CmsCardContext);
  if (!context) return null;
  const { expandedContentKey, toggleContentCard } = context;
  const isOpen = expandedContentKey === cardKey;
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#282828]">
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={() => toggleContentCard(cardKey)} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-xs font-bold text-gray-700 dark:text-gray-200">{title}</span>
          {subtitle && <span className="mt-0.5 block truncate font-[Arial] text-[10px] text-gray-400">{subtitle}</span>}
        </button>
        <button type="button" onClick={() => toggleContentCard(cardKey)} className="grid h-7 w-7 place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-white/5" aria-label={isOpen ? 'Close editor' : 'Open editor'}>{isOpen ? '⌃' : '⌄'}</button>
        {onRemove && <RemoveBtn onClick={onRemove} />}
      </div>
      {isOpen && <div className="space-y-3 border-t border-gray-200 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-[#242424]">{children}</div>}
    </div>
  );
}

// Tiga kelompok CMS: halaman pokok, pengaturan sampingan, lalu pengalaman interaktif.
const MAIN_TABS = ['home', 'about', 'projects', 'career', 'book', 'contact'];
const SIDE_TABS = ['featuredWorks', 'visitorIntroduction', 'navigationLabels', 'interactiveWords', 'general'];
const EXTRA_TABS = ['zine', 'miniGame', 'leaderboardSystems'];

// Metadata buat kartu menu utama CMS — cukup diedit di sini kalau mau ganti label/ikon/deskripsi
const TAB_META = {
  home: { label: 'Home', desc: 'Name, role & kalimat dinamis' },
  featuredWorks: { label: 'Featured Works', desc: 'Heading and selected work for the Home carousel' },
  visitorIntroduction: { label: 'Visitor Introduction', desc: 'Left-side Home printer and fullscreen introduction sheet' },
  about: { label: 'About', desc: 'Author’s Note and margin notes' },
  career: { label: 'Career', desc: 'Work history, education, achievements & certificates' },
  book: { label: 'Book', desc: 'Books, writing & open-source work' },
  projects: { label: 'Projects', desc: 'Articles, posters & custom tabs' },
  contact: { label: 'Contact', desc: 'Info kontak, sosmed & tombol aksi' },
  zine: { label: 'Wassup?', desc: 'Settings menulis, menerima & moderasi kiriman' },
  miniGame: { label: 'Mini Game', desc: 'Game shelf, draft The Red Pen & koreksi editorial' },
  leaderboardSystems: { label: 'Leaderboard Systems', desc: 'Cross-game Mini Game leaderboards, player rankings & name moderation' },
  navigationLabels: { label: 'Navigation & Labels', desc: 'Top navbar text and Quick Views inside the A4 page' },
  interactiveWords: { label: 'Interactive Words', desc: 'Frasa klik, tujuan, warna & spellcheck underline' },
  general: { label: 'Update Patch', desc: 'Patch updates, sounds & site update settings' },
  websikee: { label: 'Website Sharing Preview', desc: 'Title, description, canonical URL, favicon & social preview image' },
};

const DEV_NOTES_STORAGE_KEY = 'portfolio_cms_dev_notes';

const readLocalDevNotes = () => {
  try { return localStorage.getItem(DEV_NOTES_STORAGE_KEY) || ''; }
  catch { return ''; }
};

const writeLocalDevNotes = (value) => {
  try { localStorage.setItem(DEV_NOTES_STORAGE_KEY, value || ''); }
  catch { /* local notes are optional */ }
};

const DEFAULT_WEBSITE = {
  title: 'Haikal A. Hafidz — Content Writer & Editor',
  description: 'Portfolio Haikal A. Hafidz — writing, editing, creative work, and selected projects.',
  url: 'https://haikal-hafidz.github.io/',
  favicon: '',
  shareTitle: '',
  shareDescription: '',
  shareImage: '',
  seoTitle: '',
  seoDescription: '',
  canonicalUrl: '',
  allowIndexing: true,
  devNotes: '',
};

const normalizeWebsite = (raw) => ({
  ...DEFAULT_WEBSITE,
  ...(raw || {}),
  url: raw?.url || DEFAULT_WEBSITE.url,
  shareTitle: raw?.shareTitle ?? '',
  shareDescription: raw?.shareDescription ?? '',
  shareImage: raw?.shareImage ?? '',
  seoTitle: raw?.seoTitle ?? '',
  seoDescription: raw?.seoDescription ?? '',
  canonicalUrl: raw?.canonicalUrl || raw?.url || DEFAULT_WEBSITE.url,
  allowIndexing: raw?.allowIndexing !== false,
});

const DEFAULT_GENERAL = {
  soundEffects: true,
  welcomeNotification: {
    enabled: true,
    version: '1.0.0',
    title: 'Update terbaru',
    message: 'Notes perubahan terbaru portofolio akan muncul di sini.',
    items: [],
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
      { id: 'rp-5-1', phrase: 'dibuat dengan tujuan untuk membantu', replacement: 'membantu', explanation: 'Prefix nominal ini dapat diganti verba langsung.' },
      { id: 'rp-5-2', phrase: 'para pengguna-pengguna', replacement: 'pengguna', explanation: 'Jamak ganda: “para” dan pengulangan kata tidak dipakai bersamaan.' },
      { id: 'rp-5-3', phrase: 'dalam melakukan pengelolaan', replacement: 'mengelola', explanation: 'Nominalisasi membuat kalimat lebih panjang daripada verba aktif.' },
      { id: 'rp-5-4', phrase: 'dan juga', replacement: 'dan', explanation: '“Juga” tidak diperlukan dalam deret setara ini.' },
    ],
  },
];
const DEFAULT_MINI_GAME = {
  enabled: true, menuLabel: 'Mini Game', libraryTitle: 'Choose a desk.',
  libraryDescription: 'Select satu meja kerja. Setiap permainan menguji bagian berbeda dari proses mengubah gagasan mentah menjadi naskah.',
  gameName: 'The Red Pen', gameCategory: 'Editorial', gameCardDescription: 'Temukan bagian yang janggal, ambigu, dan tidak efektif sebelum draft dikirim.',
  title: 'Inspect the unfinished draft.', objective: 'Lima draft belum selesai menunggu meja editor. Temukan bagian yang janggal, bertele-tele, ambigu, atau tidak efektif sebelum waktunya habis.',
  rules: { click: 'Klik atau tap kata/frasa bermasalah.', timer: 'Tiap draft punya waktu 60 detik.', wrong: 'Selectan salah menurunkan akurasi dan skor.', hint: 'Satu hint tersedia untuk seluruh sesi.', review: 'Seusai tiap draft, baca alasan editorialnya—waktu berhenti saat review.' },
  startButtonLabel: 'Mulai Mengedit', secondsPerDraft: 60, draftsPerSession: 5,
  scoreSettings: { correctPoints: 100, wrongPenalty: 25, completionBonus: 100, maxTimeBonus: 100, hintPenalty: 75 },
  gradeTitles: [{ min: 90, label: 'Senior Red Pen', remark: 'Naskah sulit lolos dari mata Anda.' }, { min: 75, label: 'Sharp-eyed Editor', remark: 'Mata editorialnya tajam; tinggal menjaga konsistensi.' }, { min: 55, label: 'Promising Proofreader', remark: 'Insting editornya sudah ada, tetapi beberapa masalah masih lolos.' }, { min: 0, label: 'Draft Survivor', remark: 'Draft-nya selamat. Reputasi editornya menyusul.' }],
  resultEyebrow: 'Final editorial report', replayLabel: 'Main lagi', projectsCtaLabel: 'Lihat tulisan Haikal', contactCtaLabel: 'Hubungi Haikal', gameSlots: [], drafts: DEFAULT_RED_PEN_DRAFTS,
  showInLibrary: true, illustration: '',
};

const HANGMAN_PRESET = {
  gameType: 'hangman', enabled: true, showInLibrary: true, gameName: 'The Hangman', gameCategory: 'Kosakata',
  gameCardDescription: 'Tebak kata dari petunjuk yang tersedia sebelum Hangman selesai digambar.', title: 'Jaga kata tetap hidup.',
  objective: 'Lima belas kata menunggu untuk ditebak. Gunakan petunjuk yang tersedia dan temukan setiap kata sebelum waktu habis—atau Hangman selesai digambar.',
  rules: { click: 'Select huruf A–Z untuk menebak kata berdasarkan petunjuk singkat.', timer: 'Setiap kata memberi enam kesempatan salah: kepala, badan, tangan kanan, tangan kiri, kaki kanan, lalu kaki kiri.', wrong: 'Tebakan benar membuka semua kemunculan huruf yang sama. Huruf yang sudah dipilih tidak dapat digunakan kembali.', hint: 'Berhasil menebak kata akan mengosongkan Hangman dan membawa Anda ke kata berikutnya. Selesaikan 15 kata dalam 10 menit.', review: 'Kesalahan keenam atau waktu 00:00 mengakhiri permainan.' },
  startButtonLabel: 'Mulai Menggantung', secondsPerDraft: 600, draftsPerSession: 15,
  gradeTitles: [{ min: 15, label: 'Master Wordsmith', remark: 'Lima belas kata masuk. Tidak satu pun berhasil menggantung Anda.' }, { min: 10, label: 'Seasoned Linguist', remark: 'Kosakata Anda cukup tajam untuk membuat tali kehilangan pekerjaan.' }, { min: 5, label: 'Vocabulary Scout', remark: 'Sudah menemukan jalurnya. Beberapa kata masih bersembunyi.' }, { min: 0, label: 'Word Rookie', remark: 'Untuk sekarang, alfabet masih memegang kendali.' }],
  resultEyebrow: 'Laporan akhir',
  replayLabel: 'Main Lagi',
  hangmanLeaderboardLabel: 'Lihat Klasemen',
  hangmanDeathMessage: 'Siapa Yang Bilang Kata-kata Ngga Bisa Membunuh?',
  hangmanTimeoutMessage: 'Waktu habis. Kata-kata menang kali ini.',
  hangmanPodiumFirst: 'Selamat. Kosa Kata Anda Menyelamatkan Nyawa.',
  hangmanPodiumSecond: 'Runner Up. Banyak Kata, Kurang Tahta.',
  hangmanPodiumThird: 'Peringkat Tiga. Setidaknya Openn yang Digantung.',
  hangmanRankPrefix: 'Anda berada di peringkat',
  hangmanRankPlayersSuffix: 'pemain',
  hangmanSolvedLabel: 'Terjawab',
  hangmanAccuracyLabel: 'Akurasi',
  hangmanWrongLettersLabel: 'Huruf salah',
  hangmanNamePrompt: 'Masukkan nama / alias untuk masuk klasemen',
  hangmanNamePlaceholder: 'Name / alias',
  hangmanSaveScoreLabel: 'Simpan Skor',
  hangmanSavingLabel: 'Menyimpan…',
  hangmanYourRankLabel: 'Peringkatmu',
  hangmanBestScoreLabel: 'Skor terbaik tersimpan',
  hangmanLeaderboardTitle: 'Klasemen',
  hangmanLeaderboardCloseLabel: 'Close ×',
  hangmanLeaderboardEmptyLabel: 'None yet penghuni klasemen.',
  hangmanYouLabel: 'Kamu',
  hangmanClueLabel: 'Instructions',
  hangmanChooseLetterLabel: 'Select satu huruf',
  hangmanRemainingLabel: 'Kesempatan tersisa',
  hangmanWordCompleteLabel: 'Kata selesai',
  hangmanDeathRevealLabel: 'Enam kesalahan · jawaban dibuka',
  hangmanSafeMessage: 'Selamat, lehernya aman.',
  hangmanAnswerPrefix: 'Kata yang dicari:',
  hangmanNextWordLabel: 'Kata berikutnya →',
  hangmanSeeResultLabel: 'Lihat hasil →',
  drafts: [
    { id: 'hangman-01', label: 'AMBIGUITAS', enabled: true, passage: 'Makna yang tidak pasti.', issues: [] },
    { id: 'hangman-02', label: 'GAGASAN', enabled: true, passage: 'Ide yang dipikirkan.', issues: [] },
    { id: 'hangman-03', label: 'JANGGAL', enabled: true, passage: 'Terasa tidak semestinya.', issues: [] },
    { id: 'hangman-04', label: 'LUGAS', enabled: true, passage: 'Jelas dan langsung.', issues: [] },
    { id: 'hangman-05', label: 'TAFSIR', enabled: true, passage: 'Pemaknaan terhadap sesuatu.', issues: [] },
    { id: 'hangman-06', label: 'KHALAYAK', enabled: true, passage: 'Kelompok penerima pesan.', issues: [] },
    { id: 'hangman-07', label: 'SANGGAH', enabled: true, passage: 'Membantah suatu pendapat.', issues: [] },
    { id: 'hangman-08', label: 'NALURI', enabled: true, passage: 'Dorongan alami.', issues: [] },
    { id: 'hangman-09', label: 'WACANA', enabled: true, passage: 'Gagasan dalam pembahasan.', issues: [] },
    { id: 'hangman-10', label: 'SAMAR', enabled: true, passage: 'Tidak terlihat jelas.', issues: [] },
    { id: 'hangman-11', label: 'NUANSA', enabled: true, passage: 'Perbedaan yang sangat halus.', issues: [] },
    { id: 'hangman-12', label: 'SATIR', enabled: true, passage: 'Sindiran lewat humor.', issues: [] },
    { id: 'hangman-13', label: 'DISTOPIA', enabled: true, passage: 'Masyarakat yang buruk.', issues: [] },
    { id: 'hangman-14', label: 'PARADOKS', enabled: true, passage: 'Pernyataan tampak bertentangan.', issues: [] },
    { id: 'hangman-15', label: 'METAFORA', enabled: true, passage: 'Perbandingan secara kiasan.', issues: [] },
    { id: 'hangman-16', label: 'NARASI', enabled: true, passage: 'Rangkaian sebuah cerita.', issues: [] },
    { id: 'hangman-17', label: 'RETORIKA', enabled: true, passage: 'Seni menggunakan bahasa.', issues: [] },
    { id: 'hangman-18', label: 'SUBTEKS', enabled: true, passage: 'Makna yang tidak diucapkan.', issues: [] },
    { id: 'hangman-19', label: 'IRONI', enabled: true, passage: 'Berlawanan dengan harapan.', issues: [] },
    { id: 'hangman-20', label: 'BIAS', enabled: true, passage: 'Kecenderungan yang memengaruhi penilaian.', issues: [] },
    { id: 'hangman-21', label: 'EMPATI', enabled: true, passage: 'Memahami perasaan orang lain.', issues: [] },
    { id: 'hangman-22', label: 'WAWASAN', enabled: true, passage: 'Pemahaman yang lebih luas.', issues: [] },
    { id: 'hangman-23', label: 'PERSEPSI', enabled: true, passage: 'Cara menangkap sesuatu.', issues: [] },
    { id: 'hangman-24', label: 'ARKETIPE', enabled: true, passage: 'Pola yang terus berulang.', issues: [] },
    { id: 'hangman-25', label: 'PROSA', enabled: true, passage: 'Tulisan tanpa pola sajak.', issues: [] },
    { id: 'hangman-26', label: 'LEKSIKON', enabled: true, passage: 'Kumpulan kosakata.', issues: [] },
    { id: 'hangman-27', label: 'SINTAKSIS', enabled: true, passage: 'Susunan kata dalam kalimat.', issues: [] },
    { id: 'hangman-28', label: 'SEMANTIK', enabled: true, passage: 'Kajian tentang makna.', issues: [] },
    { id: 'hangman-29', label: 'KATARSIS', enabled: true, passage: 'Pelepasan emosi.', issues: [] },
    { id: 'hangman-30', label: 'ANEKDOT', enabled: true, passage: 'Cerita singkat menarik.', issues: [] }
  ],
};

const PLAGIARISM_POLICE_PRESET = {
  "gameType": "plagiarismPolice",
  "enabled": true,
  "showInLibrary": true,
  "gameName": "Plagiarism Police",
  "gameCategory": "Source Integrity",
  "gameCardDescription": "Periksa sumber, bandingkan tulisan, dan putuskan apakah kemiripannya masih dapat dipertanggungjawabkan.",
  "title": "Kemiripan belum tentu kejahatan.",
  "objective": "Periksa 12 kasus penggunaan sumber. Tentukan putusan yang tepat, lalu buktikan alasan di balik keputusan Anda.",
  "rules": {
    "click": "Bandingkan Sumber Asli dengan Teks Author pada setiap kasus.",
    "timer": "Tentukan satu putusan: Orisinal, Parafrase Etis, Parafrase Terlalu Dekat, atau Plagiarisme.",
    "wrong": "Buktikan putusan dengan memilih alasan yang relevan dan menandai bagian teks jika diperlukan.",
    "hint": "Setiap sesi terdiri dari 12 kasus. Ketepatan putusan dan pembuktian dinilai secara terpisah.",
    "review": "Tidak ada batas waktu atau eliminasi. Teliti sebelum menuduh—kemiripan belum tentu plagiarisme."
  },
  "startButtonLabel": "Mulai Investigasi",
  "casesPerSession": 12,
  "verdictPoints": 600,
  "evidencePoints": 400,
  "perfectBonus": 100,
  "gradeTitles": [
    {
      "min": 11,
      "label": "Chief Plagiarism Officer",
      "remark": "Sulit menyembunyikan jejak sumber dari Anda."
    },
    {
      "min": 8,
      "label": "Integrity Detective",
      "remark": "Jejaknya terlihat. Tinggal mempertajam cara membuktikannya."
    },
    {
      "min": 4,
      "label": "Source Inspector",
      "remark": "Anda tahu apa yang perlu dicurigai, tetapi belum semua kecurigaan layak menjadi putusan."
    },
    {
      "min": 0,
      "label": "Citation Rookie",
      "remark": "Untuk sekarang, jangan dulu sita laptop penulisnya."
    }
  ],
  "resultEyebrow": "Laporan Investigasi Akhir",
  "replayLabel": "Main Lagi",
  "verdictLabels": {
    "original": "Orisinal",
    "ethical": "Parafrase Etis",
    "close": "Parafrase Terlalu Dekat",
    "plagiarism": "Plagiarisme"
  },
  "evidenceLabels": {
    "wording": "Selectan Kata",
    "structure": "Struktur",
    "idea": "Gagasan",
    "attribution": "Atribusi"
  },
  "copy": {
    "caseLabel": "Kasus",
    "sourceLabel": "Sumber Asli",
    "writerLabel": "Teks Author",
    "verdictPrompt": "Jatuhkan Putusan",
    "temporaryVerdict": "Putusan Sementara",
    "changeVerdict": "Ubah Putusan",
    "evidenceTypeLabel": "Type Bukti",
    "submitEvidence": "Ajukan Bukti",
    "nextCase": "Kasus Berikutnya →",
    "seeResult": "Lihat Laporan Akhir →",
    "perfectCaseTitle": "Kasus Sempurna",
    "correctVerdictTitle": "Putusan Tepat · Bukti Kurang Tepat",
    "reviewTitle": "Kasus Perlu Ditinjau",
    "riskyTitle": "Putusan Berisiko",
    "perfectRun": "Berkas bersih. Tidak ada kasus yang lolos dari pemeriksaan.",
    "correctLabel": "Putusan Tepat",
    "verdictAccuracyLabel": "Ketepatan Putusan",
    "evidenceAccuracyLabel": "Ketepatan Bukti",
    "perfectLabel": "Kasus Sempurna",
    "streakLabel": "Rangkaian Sempurna",
    "riskyLabel": "Putusan Berisiko",
    "timeLabel": "Waktu Investigasi",
    "scoreLabel": "Skor Akhir",
    "namePrompt": "Catat Identitas Investigator",
    "namePlaceholder": "Name / alias",
    "saveLabel": "Simpan Hasil",
    "savingLabel": "Menyimpan…",
    "rankLabel": "Peringkat Anda",
    "leaderboardLabel": "Lihat Klasemen",
    "leaderboardTitle": "Klasemen",
    "closeLabel": "Close ×",
    "leaderboardError": "Klasemen belum dapat dimuat.",
    "saveError": "Skor belum dapat disimpan.",
    "nameError": "Name / alias minimal 2 karakter."
  },
  "podium": {
    "first": "Selamat. Bahkan sumbernya mengakui Anda.",
    "second": "Runner Up. Nyaris orisinal, sayangnya masih nomor dua.",
    "third": "Peringkat tiga. Setidaknya posisi ini bukan hasil salin-tempel."
  },
  "cases": [
    {
      "id": "pp-01",
      "label": "Tidur dan Ingatan",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Tidur yang cukup membantu proses konsolidasi ingatan setelah seseorang mempelajari informasi baru.",
      "writerText": "Tidur yang cukup membantu proses konsolidasi ingatan setelah seseorang mempelajari informasi baru.",
      "correctVerdict": "plagiarism",
      "correctEvidenceTypes": [
        "wording",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c1-1",
          "text": "Tidur yang cukup"
        },
        {
          "id": "c1-2",
          "text": "membantu proses konsolidasi"
        },
        {
          "id": "c1-3",
          "text": "ingatan setelah seseorang"
        },
        {
          "id": "c1-4",
          "text": "mempelajari informasi baru."
        }
      ],
      "correctChunkIds": [
        "c1-1",
        "c1-2"
      ],
      "reasonOptions": [
        {
          "id": "r1-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r1-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r1-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Kalimat sumber digunakan secara utuh tanpa kutipan atau atribusi."
    },
    {
      "id": "pp-02",
      "label": "Belajar Pagi",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Tidur yang memadai membantu otak mempertahankan informasi yang baru dipelajari.",
      "writerText": "Belajar pada pagi hari terasa lebih nyaman karena lingkungan masih tenang dan gangguan belum banyak.",
      "correctVerdict": "original",
      "correctEvidenceTypes": [
        "idea"
      ],
      "chunks": [
        {
          "id": "c2-1",
          "text": "Belajar pada pagi"
        },
        {
          "id": "c2-2",
          "text": "hari terasa lebih"
        },
        {
          "id": "c2-3",
          "text": "nyaman karena lingkungan"
        },
        {
          "id": "c2-4",
          "text": "masih tenang dan gangguan belum banyak."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r2-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r2-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r2-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r2-1",
        "r2-3"
      ],
      "report": "Topiknya berdekatan, tetapi teks penulis mengembangkan gagasan yang berbeda secara independen."
    },
    {
      "id": "pp-03",
      "label": "Media Sosial",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Penggunaan media sosial yang berlebihan pada malam hari berkaitan dengan penurunan kualitas tidur.",
      "writerText": "Menurut penelitian Pratama, kebiasaan menggunakan media sosial menjelang tidur dapat membuat kualitas istirahat menurun.",
      "correctVerdict": "ethical",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c3-1",
          "text": "Menurut penelitian Pratama,"
        },
        {
          "id": "c3-2",
          "text": "kebiasaan menggunakan media"
        },
        {
          "id": "c3-3",
          "text": "sosial menjelang tidur"
        },
        {
          "id": "c3-4",
          "text": "dapat membuat kualitas istirahat menurun."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r3-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r3-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r3-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r3-1",
        "r3-2"
      ],
      "report": "Gagasan sumber dipakai dengan konstruksi baru dan atribusi yang jelas."
    },
    {
      "id": "pp-04",
      "label": "Kebiasaan Membaca",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Membaca secara rutin dapat memperluas kosakata dan membantu seseorang mengenali berbagai pola penggunaan bahasa.",
      "writerText": "Membaca secara teratur dapat memperluas perbendaharaan kata dan membantu seseorang memahami berbagai pola penggunaan bahasa.",
      "correctVerdict": "close",
      "correctEvidenceTypes": [
        "wording",
        "structure"
      ],
      "chunks": [
        {
          "id": "c4-1",
          "text": "Membaca secara teratur"
        },
        {
          "id": "c4-2",
          "text": "dapat memperluas perbendaharaan"
        },
        {
          "id": "c4-3",
          "text": "kata dan membantu"
        },
        {
          "id": "c4-4",
          "text": "seseorang memahami berbagai pola penggunaan bahasa."
        }
      ],
      "correctChunkIds": [
        "c4-1",
        "c4-2"
      ],
      "reasonOptions": [
        {
          "id": "r4-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r4-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r4-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Sebagian kata diganti sinonim, tetapi susunan dan alur kalimat masih mengikuti sumber dengan sangat dekat."
    },
    {
      "id": "pp-05",
      "label": "Kerja dari Rumah",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Kerja jarak jauh dapat mengurangi waktu yang biasanya digunakan untuk perjalanan menuju kantor.",
      "writerText": "Bekerja dari rumah membuat sebagian orang perlu menciptakan batas yang lebih tegas antara ruang pribadi dan ruang kerja.",
      "correctVerdict": "original",
      "correctEvidenceTypes": [
        "idea"
      ],
      "chunks": [
        {
          "id": "c5-1",
          "text": "Bekerja dari rumah membuat"
        },
        {
          "id": "c5-2",
          "text": "sebagian orang perlu menciptakan"
        },
        {
          "id": "c5-3",
          "text": "batas yang lebih tegas"
        },
        {
          "id": "c5-4",
          "text": "antara ruang pribadi dan ruang kerja."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r5-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r5-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r5-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r5-1",
        "r5-3"
      ],
      "report": "Kedua teks membahas kerja jarak jauh, tetapi klaim yang dikembangkan berbeda."
    },
    {
      "id": "pp-06",
      "label": "Keputusan Konsumen",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Konsumen sering menggunakan ulasan sebagai petunjuk ketika menghadapi ketidakpastian sebelum membeli. Information sosial dapat mengurangi persepsi risiko.",
      "writerText": "Konsumen sering menggunakan ulasan sebagai petunjuk ketika menghadapi ketidakpastian sebelum membeli. Information sosial dapat mengurangi persepsi risiko. Karena itu ulasan penting bagi toko daring.",
      "correctVerdict": "plagiarism",
      "correctEvidenceTypes": [
        "wording",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c6-1",
          "text": "Konsumen sering menggunakan ulasan sebagai petunjuk"
        },
        {
          "id": "c6-2",
          "text": "ketika menghadapi ketidakpastian sebelum membeli. Information"
        },
        {
          "id": "c6-3",
          "text": "sosial dapat mengurangi persepsi risiko. Karena"
        },
        {
          "id": "c6-4",
          "text": "itu ulasan penting bagi toko daring."
        }
      ],
      "correctChunkIds": [
        "c6-1",
        "c6-2"
      ],
      "reasonOptions": [
        {
          "id": "r6-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r6-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r6-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Menambahkan satu kalimat sendiri tidak menghapus penyalinan dua kalimat sumber tanpa atribusi."
    },
    {
      "id": "pp-07",
      "label": "Musik dan Emosi",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Musik dapat memicu ingatan autobiografis dan memengaruhi emosi yang menyertai ingatan tersebut.",
      "writerText": "Menurut Sari, hubungan musik dengan emosi antara lain muncul karena sebuah lagu dapat membawa pendengar kembali pada pengalaman personal tertentu.",
      "correctVerdict": "ethical",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c7-1",
          "text": "Menurut Sari, hubungan musik dengan"
        },
        {
          "id": "c7-2",
          "text": "emosi antara lain muncul karena"
        },
        {
          "id": "c7-3",
          "text": "sebuah lagu dapat membawa pendengar"
        },
        {
          "id": "c7-4",
          "text": "kembali pada pengalaman personal tertentu."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r7-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r7-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r7-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r7-1",
        "r7-2"
      ],
      "report": "Information sumber direstrukturisasi dan sumber disebut dengan jelas."
    },
    {
      "id": "pp-08",
      "label": "Ruang Hijau",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Akses terhadap ruang hijau dapat membantu menurunkan stres dan memberi kesempatan untuk memulihkan perhatian.",
      "writerText": "Ketersediaan area hijau dapat membantu mengurangi tekanan dan memberikan peluang untuk memulihkan konsentrasi.",
      "correctVerdict": "close",
      "correctEvidenceTypes": [
        "wording",
        "structure"
      ],
      "chunks": [
        {
          "id": "c8-1",
          "text": "Ketersediaan area hijau"
        },
        {
          "id": "c8-2",
          "text": "dapat membantu mengurangi"
        },
        {
          "id": "c8-3",
          "text": "tekanan dan memberikan"
        },
        {
          "id": "c8-4",
          "text": "peluang untuk memulihkan konsentrasi."
        }
      ],
      "correctChunkIds": [
        "c8-1",
        "c8-2"
      ],
      "reasonOptions": [
        {
          "id": "r8-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r8-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r8-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Penggantian sinonim tidak mengubah kerangka kalimat yang masih sangat dekat dengan sumber."
    },
    {
      "id": "pp-09",
      "label": "Kopi",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Kafein dapat meningkatkan kewaspadaan untuk sementara pada sebagian orang.",
      "writerText": "Bagi saya, menyiapkan kopi lebih berfungsi sebagai ritual yang menandai bahwa waktu bekerja sudah dimulai.",
      "correctVerdict": "original",
      "correctEvidenceTypes": [
        "idea"
      ],
      "chunks": [
        {
          "id": "c9-1",
          "text": "Bagi saya, menyiapkan"
        },
        {
          "id": "c9-2",
          "text": "kopi lebih berfungsi"
        },
        {
          "id": "c9-3",
          "text": "sebagai ritual yang"
        },
        {
          "id": "c9-4",
          "text": "menandai bahwa waktu bekerja sudah dimulai."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r9-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r9-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r9-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r9-1",
        "r9-3"
      ],
      "report": "Istilah kopi dan kerja hadir pada kedua teks, tetapi teks penulis tidak mengambil klaim sumber."
    },
    {
      "id": "pp-10",
      "label": "Belanja Daring",
      "enabled": true,
      "difficulty": "Dasar",
      "source": "Konsumen dapat menilai risiko pembelian daring melalui reputasi penjual dan pengalaman pembeli sebelumnya.",
      "writerText": "Reputasi toko menjadi salah satu sinyal yang membantu pembeli menilai risiko transaksi daring, sebagaimana dijelaskan oleh Wijaya.",
      "correctVerdict": "ethical",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c10-1",
          "text": "Reputasi toko menjadi salah"
        },
        {
          "id": "c10-2",
          "text": "satu sinyal yang membantu"
        },
        {
          "id": "c10-3",
          "text": "pembeli menilai risiko transaksi"
        },
        {
          "id": "c10-4",
          "text": "daring, sebagaimana dijelaskan oleh Wijaya."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r10-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r10-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r10-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r10-1",
        "r10-2"
      ],
      "report": "Gagasan spesifik digunakan secara ringkas dengan atribusi dan susunan baru."
    },
    {
      "id": "pp-11",
      "label": "Ketidakpastian",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Ketidakpastian membuat manusia cenderung mencari informasi tambahan sebelum mengambil keputusan.",
      "writerText": "Kondisi yang tidak pasti membuat seseorang cenderung mencari informasi lebih banyak sebelum menentukan pilihan.",
      "correctVerdict": "close",
      "correctEvidenceTypes": [
        "wording",
        "structure"
      ],
      "chunks": [
        {
          "id": "c11-1",
          "text": "Kondisi yang tidak"
        },
        {
          "id": "c11-2",
          "text": "pasti membuat seseorang"
        },
        {
          "id": "c11-3",
          "text": "cenderung mencari informasi"
        },
        {
          "id": "c11-4",
          "text": "lebih banyak sebelum menentukan pilihan."
        }
      ],
      "correctChunkIds": [
        "c11-1",
        "c11-2"
      ],
      "reasonOptions": [
        {
          "id": "r11-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r11-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r11-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Perubahan kata tidak cukup karena hubungan dan urutan unsur kalimat tetap mengikuti sumber."
    },
    {
      "id": "pp-12",
      "label": "Efek Halo",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Efek halo membuat penilaian positif pada satu karakteristik memengaruhi penilaian terhadap karakteristik lain.",
      "writerText": "Menurut Putri, efek halo memengaruhi penilaian. Efek halo membuat penilaian positif pada satu karakteristik memengaruhi penilaian terhadap karakteristik lain.",
      "correctVerdict": "plagiarism",
      "correctEvidenceTypes": [
        "wording"
      ],
      "chunks": [
        {
          "id": "c12-1",
          "text": "Menurut Putri, efek halo"
        },
        {
          "id": "c12-2",
          "text": "memengaruhi penilaian. Efek halo"
        },
        {
          "id": "c12-3",
          "text": "membuat penilaian positif pada"
        },
        {
          "id": "c12-4",
          "text": "satu karakteristik memengaruhi penilaian terhadap karakteristik lain."
        }
      ],
      "correctChunkIds": [
        "c12-1",
        "c12-2"
      ],
      "reasonOptions": [
        {
          "id": "r12-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r12-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r12-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Atribusi pada kalimat pertama tidak menjadikan penyalinan verbatim berikutnya sebagai parafrase."
    },
    {
      "id": "pp-13",
      "label": "Kesepian",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Kualitas interaksi sosial berperan dalam pengalaman kesepian seseorang.",
      "writerText": "Kesepian tidak selalu berarti tidak memiliki hubungan; seseorang dapat dikelilingi banyak orang tetapi tetap merasa tidak dipahami.",
      "correctVerdict": "original",
      "correctEvidenceTypes": [
        "idea"
      ],
      "chunks": [
        {
          "id": "c13-1",
          "text": "Kesepian tidak selalu berarti"
        },
        {
          "id": "c13-2",
          "text": "tidak memiliki hubungan; seseorang"
        },
        {
          "id": "c13-3",
          "text": "dapat dikelilingi banyak orang"
        },
        {
          "id": "c13-4",
          "text": "tetapi tetap merasa tidak dipahami."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r13-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r13-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r13-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r13-1",
        "r13-3"
      ],
      "report": "Istilah yang sama muncul karena topiknya sama, namun argumen penulis berkembang secara independen."
    },
    {
      "id": "pp-14",
      "label": "Selectan Berlebihan",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Terlalu banyak pilihan dapat meningkatkan beban kognitif dan membuat proses memilih terasa lebih sulit.",
      "writerText": "Riset Lestari menunjukkan bahwa bertambahnya alternatif tidak selalu memudahkan konsumen; banyaknya opsi justru dapat menambah beban saat menentukan pilihan.",
      "correctVerdict": "ethical",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c14-1",
          "text": "Riset Lestari menunjukkan bahwa"
        },
        {
          "id": "c14-2",
          "text": "bertambahnya alternatif tidak selalu"
        },
        {
          "id": "c14-3",
          "text": "memudahkan konsumen; banyaknya opsi"
        },
        {
          "id": "c14-4",
          "text": "justru dapat menambah beban saat menentukan pilihan."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r14-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r14-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r14-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r14-1",
        "r14-2"
      ],
      "report": "Gagasan sumber dipertahankan, tetapi struktur dan cara penyampaiannya telah diolah serta diberi atribusi."
    },
    {
      "id": "pp-15",
      "label": "Produktivitas",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Pergantian tugas yang terlalu sering dapat memecah perhatian dan menambah waktu yang dibutuhkan untuk kembali fokus.",
      "writerText": "Sering berpindah tugas dapat memecah perhatian. Akibatnya, seseorang membutuhkan waktu tambahan untuk kembali berkonsentrasi.",
      "correctVerdict": "close",
      "correctEvidenceTypes": [
        "structure",
        "idea"
      ],
      "chunks": [
        {
          "id": "c15-1",
          "text": "Sering berpindah tugas"
        },
        {
          "id": "c15-2",
          "text": "dapat memecah perhatian."
        },
        {
          "id": "c15-3",
          "text": "Akibatnya, seseorang membutuhkan"
        },
        {
          "id": "c15-4",
          "text": "waktu tambahan untuk kembali berkonsentrasi."
        }
      ],
      "correctChunkIds": [
        "c15-1",
        "c15-2"
      ],
      "reasonOptions": [
        {
          "id": "r15-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r15-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r15-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Memecah satu kalimat menjadi dua tidak otomatis mengubah struktur gagasan yang masih mengikuti sumber."
    },
    {
      "id": "pp-16",
      "label": "Nostalgia",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Nostalgia dapat memperkuat rasa keterhubungan sosial ketika seseorang mengingat pengalaman bermakna.",
      "writerText": "Saya menyukai benda lama bukan karena ingin kembali ke masa lalu, melainkan karena benda itu memberi konteks pada siapa saya sekarang.",
      "correctVerdict": "original",
      "correctEvidenceTypes": [
        "idea"
      ],
      "chunks": [
        {
          "id": "c16-1",
          "text": "Saya menyukai benda lama bukan"
        },
        {
          "id": "c16-2",
          "text": "karena ingin kembali ke masa"
        },
        {
          "id": "c16-3",
          "text": "lalu, melainkan karena benda itu"
        },
        {
          "id": "c16-4",
          "text": "memberi konteks pada siapa saya sekarang."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r16-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r16-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r16-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r16-1",
        "r16-3"
      ],
      "report": "Kesimpulan emosional yang berdekatan tidak berarti teks kedua bergantung pada gagasan spesifik sumber."
    },
    {
      "id": "pp-17",
      "label": "Identitas Merek",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Identitas merek terbentuk melalui elemen visual, bahasa, dan pengalaman yang konsisten sehingga publik dapat mengenali karakter merek.",
      "writerText": "Identitas merek terbentuk melalui elemen visual, bahasa, dan pengalaman. Konsistensi membuat publik dapat mengenali karakter merek.",
      "correctVerdict": "plagiarism",
      "correctEvidenceTypes": [
        "wording",
        "structure",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c17-1",
          "text": "Identitas merek terbentuk melalui"
        },
        {
          "id": "c17-2",
          "text": "elemen visual, bahasa, dan"
        },
        {
          "id": "c17-3",
          "text": "pengalaman. Konsistensi membuat publik"
        },
        {
          "id": "c17-4",
          "text": "dapat mengenali karakter merek."
        }
      ],
      "correctChunkIds": [
        "c17-1",
        "c17-2"
      ],
      "reasonOptions": [
        {
          "id": "r17-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r17-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r17-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Section sumber dipotong dan disusun ulang, tetapi wording serta struktur inti tetap diambil tanpa atribusi."
    },
    {
      "id": "pp-18",
      "label": "Pembelian Impulsif",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Dorongan membeli secara impulsif dapat muncul ketika rangsangan situasional bertemu dengan respons emosional konsumen.",
      "writerText": "Menurut Hasan, pembelian spontan tidak hanya dipicu situasi toko; respons emosional pembeli juga ikut menentukan apakah dorongan itu berubah menjadi transaksi.",
      "correctVerdict": "ethical",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c18-1",
          "text": "Menurut Hasan, pembelian spontan tidak"
        },
        {
          "id": "c18-2",
          "text": "hanya dipicu situasi toko; respons"
        },
        {
          "id": "c18-3",
          "text": "emosional pembeli juga ikut menentukan"
        },
        {
          "id": "c18-4",
          "text": "apakah dorongan itu berubah menjadi transaksi."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r18-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r18-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r18-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r18-1",
        "r18-2"
      ],
      "report": "Information sumber disintesis menjadi penjelasan baru dan sumber tetap disebut."
    },
    {
      "id": "pp-19",
      "label": "Empati",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Empati melibatkan kemampuan memahami perspektif orang lain sekaligus merespons keadaan emosionalnya.",
      "writerText": "Menurut Sinta, empati mencakup kemampuan memahami sudut pandang orang lain sekaligus memberi respons terhadap kondisi emosional mereka.",
      "correctVerdict": "close",
      "correctEvidenceTypes": [
        "wording",
        "structure"
      ],
      "chunks": [
        {
          "id": "c19-1",
          "text": "Menurut Sinta, empati mencakup"
        },
        {
          "id": "c19-2",
          "text": "kemampuan memahami sudut pandang"
        },
        {
          "id": "c19-3",
          "text": "orang lain sekaligus memberi"
        },
        {
          "id": "c19-4",
          "text": "respons terhadap kondisi emosional mereka."
        }
      ],
      "correctChunkIds": [
        "c19-1",
        "c19-2"
      ],
      "reasonOptions": [
        {
          "id": "r19-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r19-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r19-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Atribusi tersedia, tetapi parafrase masih terlalu menempel pada susunan dan pilihan kata sumber."
    },
    {
      "id": "pp-20",
      "label": "Kreativitas",
      "enabled": true,
      "difficulty": "Menengah",
      "source": "Divergent thinking sering digunakan untuk menggambarkan kemampuan menghasilkan banyak kemungkinan jawaban.",
      "writerText": "Dalam proses kreatif saya, ide biasanya muncul setelah beberapa percobaan buruk memberi petunjuk tentang arah yang tidak ingin saya ambil.",
      "correctVerdict": "original",
      "correctEvidenceTypes": [
        "idea"
      ],
      "chunks": [
        {
          "id": "c20-1",
          "text": "Dalam proses kreatif saya, ide"
        },
        {
          "id": "c20-2",
          "text": "biasanya muncul setelah beberapa percobaan"
        },
        {
          "id": "c20-3",
          "text": "buruk memberi petunjuk tentang arah"
        },
        {
          "id": "c20-4",
          "text": "yang tidak ingin saya ambil."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r20-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r20-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r20-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r20-1",
        "r20-3"
      ],
      "report": "Istilah teknis yang sama tidak cukup untuk menunjukkan ketergantungan pada sumber."
    },
    {
      "id": "pp-21",
      "label": "Kelelahan Keputusan",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Semakin banyak keputusan yang harus dibuat, semakin besar beban kognitif; beban tersebut dapat menurunkan kualitas keputusan berikutnya.",
      "writerText": "Ketika seseorang terus dihadapkan pada pilihan, tuntutan mentalnya bertambah dan keputusan yang dibuat setelahnya dapat menjadi kurang baik.",
      "correctVerdict": "close",
      "correctEvidenceTypes": [
        "structure",
        "idea"
      ],
      "chunks": [
        {
          "id": "c21-1",
          "text": "Ketika seseorang terus dihadapkan"
        },
        {
          "id": "c21-2",
          "text": "pada pilihan, tuntutan mentalnya"
        },
        {
          "id": "c21-3",
          "text": "bertambah dan keputusan yang"
        },
        {
          "id": "c21-4",
          "text": "dibuat setelahnya dapat menjadi kurang baik."
        }
      ],
      "correctChunkIds": [
        "c21-1",
        "c21-2"
      ],
      "reasonOptions": [
        {
          "id": "r21-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r21-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r21-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Wording berubah cukup jauh, tetapi rantai sebab-akibat dan urutan argumen masih mengikuti sumber."
    },
    {
      "id": "pp-22",
      "label": "Memori Kolektif",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Memori kolektif dibentuk melalui cara kelompok memilih, menceritakan, dan mempertahankan representasi masa lalu.",
      "writerText": "Halbwachs menempatkan ingatan sebagai sesuatu yang juga dibentuk secara sosial. Dalam konteks komunitas, masa lalu bertahan bukan hanya karena diingat individu, tetapi karena terus dipilih dan diceritakan bersama.",
      "correctVerdict": "ethical",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c22-1",
          "text": "Halbwachs menempatkan ingatan sebagai sesuatu yang juga"
        },
        {
          "id": "c22-2",
          "text": "dibentuk secara sosial. Dalam konteks komunitas, masa"
        },
        {
          "id": "c22-3",
          "text": "lalu bertahan bukan hanya karena diingat individu,"
        },
        {
          "id": "c22-4",
          "text": "tetapi karena terus dipilih dan diceritakan bersama."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r22-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r22-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r22-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r22-1",
        "r22-2"
      ],
      "report": "Sumber digunakan sebagai fondasi, lalu dikembangkan dengan fokus dan konstruksi baru."
    },
    {
      "id": "pp-23",
      "label": "Dark Pattern",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Salah satu dark pattern menggunakan rasa mendesak palsu, misalnya penghitung waktu yang kembali ke angka awal setelah halaman dimuat ulang.",
      "writerText": "Situs dapat mendorong pembelian dengan penghitung mundur yang seolah akan berakhir, padahal waktunya kembali penuh ketika halaman dibuka lagi.",
      "correctVerdict": "plagiarism",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c23-1",
          "text": "Situs dapat mendorong pembelian"
        },
        {
          "id": "c23-2",
          "text": "dengan penghitung mundur yang"
        },
        {
          "id": "c23-3",
          "text": "seolah akan berakhir, padahal"
        },
        {
          "id": "c23-4",
          "text": "waktunya kembali penuh ketika halaman dibuka lagi."
        }
      ],
      "correctChunkIds": [
        "c23-1",
        "c23-2"
      ],
      "reasonOptions": [
        {
          "id": "r23-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r23-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r23-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Contoh yang sangat spesifik dari sumber diambil dan ditulis ulang tanpa atribusi; perubahan wording tidak menghapus kebutuhan menyebut sumber."
    },
    {
      "id": "pp-24",
      "label": "Algoritma",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Sistem rekomendasi dapat memperkuat paparan terhadap konten serupa berdasarkan perilaku pengguna sebelumnya.",
      "writerText": "Echo chamber tidak hanya lahir dari algoritma; pilihan pengguna untuk mengikuti, memblokir, dan mengabaikan akun tertentu juga membentuk lingkungan informasinya.",
      "correctVerdict": "original",
      "correctEvidenceTypes": [
        "idea"
      ],
      "chunks": [
        {
          "id": "c24-1",
          "text": "Echo chamber tidak hanya lahir"
        },
        {
          "id": "c24-2",
          "text": "dari algoritma; pilihan pengguna untuk"
        },
        {
          "id": "c24-3",
          "text": "mengikuti, memblokir, dan mengabaikan akun"
        },
        {
          "id": "c24-4",
          "text": "tertentu juga membentuk lingkungan informasinya."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r24-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r24-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r24-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r24-1",
        "r24-3"
      ],
      "report": "Istilah teknis sama, tetapi fokus, klaim, dan jalur argumentasi penulis berbeda."
    },
    {
      "id": "pp-25",
      "label": "Burnout",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Burnout berkembang ketika tuntutan pekerjaan berlangsung lama tanpa sumber daya pemulihan yang memadai, sehingga kelelahan menjadi kronis.",
      "writerText": "Kelelahan dapat menjadi menetap saat tuntutan kerja terus berlangsung sementara kesempatan untuk pulih tidak mencukupi. Kondisi inilah yang mendorong burnout.",
      "correctVerdict": "close",
      "correctEvidenceTypes": [
        "structure",
        "idea"
      ],
      "chunks": [
        {
          "id": "c25-1",
          "text": "Kelelahan dapat menjadi menetap saat"
        },
        {
          "id": "c25-2",
          "text": "tuntutan kerja terus berlangsung sementara"
        },
        {
          "id": "c25-3",
          "text": "kesempatan untuk pulih tidak mencukupi."
        },
        {
          "id": "c25-4",
          "text": "Kondisi inilah yang mendorong burnout."
        }
      ],
      "correctChunkIds": [
        "c25-1",
        "c25-2"
      ],
      "reasonOptions": [
        {
          "id": "r25-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r25-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r25-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Kalimat dibalik dan kosakata diubah, tetapi kerangka hubungan tuntutan, pemulihan, dan kelelahan tetap mengikuti sumber."
    },
    {
      "id": "pp-26",
      "label": "Arsitektur Selectan",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Arsitektur pilihan mengacu pada cara penyajian opsi yang dapat memengaruhi keputusan tanpa menghapus kebebasan memilih.",
      "writerText": "Thaler dan Sunstein menjelaskan bahwa cara opsi ditata dapat mengarahkan keputusan tanpa meniadakan pilihan. Contohnya, formulir dapat menempatkan opsi paling aman sebagai pilihan bawaan.",
      "correctVerdict": "ethical",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c26-1",
          "text": "Thaler dan Sunstein menjelaskan bahwa cara"
        },
        {
          "id": "c26-2",
          "text": "opsi ditata dapat mengarahkan keputusan tanpa"
        },
        {
          "id": "c26-3",
          "text": "meniadakan pilihan. Contohnya, formulir dapat menempatkan"
        },
        {
          "id": "c26-4",
          "text": "opsi paling aman sebagai pilihan bawaan."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r26-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r26-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r26-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r26-1",
        "r26-2"
      ],
      "report": "Konsep sumber dijelaskan dengan konstruksi baru, diberi atribusi, dan dikembangkan dengan contoh tambahan."
    },
    {
      "id": "pp-27",
      "label": "Language Internet",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Komunikasi daring melahirkan bentuk bahasa yang menyesuaikan keterbatasan dan kebiasaan medium digital.",
      "writerText": "Pengulangan huruf dalam percakapan daring sering bekerja seperti intonasi: bentuk “iyaaa” dapat membawa nuansa yang tidak muncul dari “iya”.",
      "correctVerdict": "original",
      "correctEvidenceTypes": [
        "idea"
      ],
      "chunks": [
        {
          "id": "c27-1",
          "text": "Pengulangan huruf dalam percakapan"
        },
        {
          "id": "c27-2",
          "text": "daring sering bekerja seperti"
        },
        {
          "id": "c27-3",
          "text": "intonasi: bentuk “iyaaa” dapat"
        },
        {
          "id": "c27-4",
          "text": "membawa nuansa yang tidak muncul dari “iya”."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r27-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r27-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r27-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r27-1",
        "r27-3"
      ],
      "report": "Kedua teks membahas bahasa internet, tetapi observasi spesifik dan argumentasinya independen."
    },
    {
      "id": "pp-28",
      "label": "Parasocial Relationship",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Hubungan parasosial dapat terasa intim meskipun interaksi berjalan satu arah. Paparan berulang membuat figur media terasa familier dan kedekatan semu dapat berkembang.",
      "writerText": "Figur media dapat terasa seperti orang yang dikenal karena terus muncul dalam keseharian audiens. Kedekatan itu bisa berkembang walaupun hubungan sebenarnya hanya berjalan satu arah.",
      "correctVerdict": "plagiarism",
      "correctEvidenceTypes": [
        "idea",
        "structure",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c28-1",
          "text": "Figur media dapat terasa seperti orang"
        },
        {
          "id": "c28-2",
          "text": "yang dikenal karena terus muncul dalam"
        },
        {
          "id": "c28-3",
          "text": "keseharian audiens. Kedekatan itu bisa berkembang"
        },
        {
          "id": "c28-4",
          "text": "walaupun hubungan sebenarnya hanya berjalan satu arah."
        }
      ],
      "correctChunkIds": [
        "c28-1",
        "c28-2"
      ],
      "reasonOptions": [
        {
          "id": "r28-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r28-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r28-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Beberapa bagian gagasan sumber digabung dan diurutkan ulang tanpa atribusi; tidak perlu ada salinan verbatim agar penggunaan sumber tetap bermasalah."
    },
    {
      "id": "pp-29",
      "label": "Kepercayaan Konsumen",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Transparansi informasi dapat membantu konsumen mengevaluasi kredibilitas penjual dan mengurangi ketidakpastian transaksi.",
      "writerText": "Menurut Nugroho, transparansi membantu pembeli menilai kredibilitas penjual. Namun kepercayaan tidak berhenti pada informasi; pengalaman setelah pembelian juga menentukan apakah konsumen akan kembali.",
      "correctVerdict": "ethical",
      "correctEvidenceTypes": [
        "idea",
        "attribution"
      ],
      "chunks": [
        {
          "id": "c29-1",
          "text": "Menurut Nugroho, transparansi membantu pembeli"
        },
        {
          "id": "c29-2",
          "text": "menilai kredibilitas penjual. Namun kepercayaan"
        },
        {
          "id": "c29-3",
          "text": "tidak berhenti pada informasi; pengalaman"
        },
        {
          "id": "c29-4",
          "text": "setelah pembelian juga menentukan apakah konsumen akan kembali."
        }
      ],
      "correctChunkIds": [],
      "reasonOptions": [
        {
          "id": "r29-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r29-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r29-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [
        "r29-1",
        "r29-2"
      ],
      "report": "Sumber mendukung satu bagian argumen, sementara analisis berikutnya dikembangkan secara independen dan batasnya jelas."
    },
    {
      "id": "pp-30",
      "label": "Apati",
      "enabled": true,
      "difficulty": "Lanjut",
      "source": "Apati dapat muncul bukan karena seseorang tidak memiliki kepedulian, tetapi karena pengalaman berulang bahwa tindakannya tidak menghasilkan perubahan.",
      "writerText": "Menurut Rahma, seseorang bisa terlihat tidak peduli setelah berkali-kali merasa bahwa apa pun yang dilakukan tidak mengubah keadaan. Sikap pasif kemudian menjadi respons terhadap pengalaman tersebut.",
      "correctVerdict": "close",
      "correctEvidenceTypes": [
        "structure",
        "idea"
      ],
      "chunks": [
        {
          "id": "c30-1",
          "text": "Menurut Rahma, seseorang bisa terlihat tidak"
        },
        {
          "id": "c30-2",
          "text": "peduli setelah berkali-kali merasa bahwa apa"
        },
        {
          "id": "c30-3",
          "text": "pun yang dilakukan tidak mengubah keadaan."
        },
        {
          "id": "c30-4",
          "text": "Sikap pasif kemudian menjadi respons terhadap pengalaman tersebut."
        }
      ],
      "correctChunkIds": [
        "c30-1",
        "c30-2"
      ],
      "reasonOptions": [
        {
          "id": "r30-1",
          "text": "Struktur penyampaian telah diolah secara independen."
        },
        {
          "id": "r30-2",
          "text": "Penggunaan sumber memiliki atribusi yang memadai."
        },
        {
          "id": "r30-3",
          "text": "Kemiripan istilah tidak menunjukkan penyalinan struktur atau gagasan."
        }
      ],
      "correctReasonIds": [],
      "report": "Atribusi ada dan vocabulary berubah, tetapi urutan klaim serta hubungan sebab-akibat masih sangat dekat dengan sumber."
    }
  ],
  "drafts": []
};
const HEADLINE_HOOK_CMS_PRESET = {
  "id": "headline-hook",
  "gameType": "headlineHook",
  "enabled": true,
  "showInLibrary": true,
  "gameName": "Headline Hook",
  "gameCategory": "Copywriting",
  "gameCardDescription": "Pilih headline yang menarik tanpa mengorbankan kejelasan, relevansi, atau kejujuran.",
  "title": "Tarik perhatian. Jangan tarik kebohongan.",
  "objective": "Hadapi 10 brief. Pilih headline yang paling kuat untuk audiens dan tujuan yang diberikan. Setiap pilihan dinilai dari kejelasan, relevansi, dan daya tarik.",
  "rules": [
    "Baca brief: jenis konten, target pembaca, dan tujuan tulisan.",
    "Pilih satu dari empat headline. Tidak semua headline yang paling heboh adalah yang paling kuat.",
    "Nilai dibagi menjadi Kejelasan 35, Relevansi 35, dan Daya Tarik 30.",
    "Headline yang menyesatkan, terlalu mutlak, atau menjanjikan terlalu banyak dapat kehilangan kualitas meski terdengar menarik.",
    "Selesaikan 10 brief. Setelah setiap pilihan, baca Headline Report sebelum lanjut."
  ],
  "startButtonLabel": "Mulai Mengait",
  "casesPerSession": 10,
  "scoreMaxPerCase": 100,
  "briefLabel": "BRIEF",
  "contentTypeLabel": "JENIS KONTEN",
  "audienceLabel": "TARGET PEMBACA",
  "goalLabel": "TUJUAN",
  "chooseLabel": "PILIH HEADLINE",
  "submitLabel": "Kunci Headline",
  "reportLabel": "HEADLINE REPORT",
  "clarityLabel": "Kejelasan",
  "relevanceLabel": "Relevansi",
  "hookLabel": "Daya Tarik",
  "riskLabel": "Catatan Risiko",
  "cleanRiskLabel": "Tidak ada risiko editorial utama.",
  "nextLabel": "Brief Berikutnya",
  "resultEyebrow": "LAPORAN HEADLINE AKHIR",
  "replayLabel": "Main Lagi",
  "gradeTitles": [
    {
      "min": 900,
      "label": "Hook Architect",
      "remark": "Anda tahu kapan harus menarik perhatian—dan kapan harus menahan diri."
    },
    {
      "min": 750,
      "label": "Headline Editor",
      "remark": "Headline Anda sudah punya arah, ritme, dan alasan untuk diklik."
    },
    {
      "min": 550,
      "label": "Copy Scout",
      "remark": "Instingnya ada. Sekarang tinggal membedakan hook yang tajam dari hook yang berisik."
    },
    {
      "min": 0,
      "label": "First Draft",
      "remark": "Belum semua headline perlu diterbitkan. Untungnya, ini masih draft."
    }
  ],
  "scoreLabel": "Skor Akhir",
  "averageLabel": "Rata-rata",
  "bestDimensionLabel": "Dimensi Terkuat",
  "cases": [
    {
      "id": "headline-01",
      "label": "Tidur dan Produktivitas",
      "contentType": "Artikel populer",
      "audience": "Pekerja muda",
      "goal": "Mendorong pembaca membuka artikel tanpa menjanjikan hasil berlebihan",
      "options": [
        {
          "id": "h1",
          "text": "Kurang Tidur Bisa Mengacaukan Fokus Kerja Anda",
          "clarity": 31,
          "relevance": 32,
          "hook": 25,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Rahasia Produktivitas yang Tidak Ingin Diketahui Bos Anda",
          "clarity": 18,
          "relevance": 16,
          "hook": 30,
          "risks": [
            "Sensational"
          ]
        },
        {
          "id": "h3",
          "text": "Tidur Lebih Lama, Karier Langsung Melejit",
          "clarity": 12,
          "relevance": 10,
          "hook": 28,
          "risks": [
            "Overpromise"
          ]
        },
        {
          "id": "h4",
          "text": "Mengapa Fokus Kerja Sering Memburuk Setelah Kurang Tidur",
          "clarity": 35,
          "relevance": 35,
          "hook": 24,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-02",
      "label": "Belanja Impulsif",
      "contentType": "Artikel consumer behavior",
      "audience": "Pembeli daring",
      "goal": "Menjelaskan pemicu keputusan impulsif",
      "options": [
        {
          "id": "h1",
          "text": "Kenapa Tombol Beli Sekarang Sulit Diabaikan?",
          "clarity": 32,
          "relevance": 33,
          "hook": 29,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Anda Selama Ini Ditipu Toko Online",
          "clarity": 16,
          "relevance": 15,
          "hook": 28,
          "risks": [
            "Misleading"
          ]
        },
        {
          "id": "h3",
          "text": "Satu Trik yang Membuat Semua Orang Boros",
          "clarity": 15,
          "relevance": 18,
          "hook": 30,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h4",
          "text": "Bagaimana Desain Toko Daring Mendorong Belanja Impulsif",
          "clarity": 35,
          "relevance": 35,
          "hook": 23,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-03",
      "label": "Ruang Hijau",
      "contentType": "Artikel gaya hidup",
      "audience": "Warga kota",
      "goal": "Mengundang pembaca memahami hubungan ruang hijau dan kesejahteraan",
      "options": [
        {
          "id": "h1",
          "text": "Apa yang Berubah Saat Kota Punya Lebih Banyak Ruang Hijau?",
          "clarity": 34,
          "relevance": 34,
          "hook": 28,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Taman Kota Menyembuhkan Semua Masalah Mental",
          "clarity": 12,
          "relevance": 12,
          "hook": 29,
          "risks": [
            "Overclaim"
          ]
        },
        {
          "id": "h3",
          "text": "Kota Tanpa Pohon Adalah Kota Gagal",
          "clarity": 18,
          "relevance": 18,
          "hook": 25,
          "risks": [
            "Loaded"
          ]
        },
        {
          "id": "h4",
          "text": "Ruang Hijau dan Kesejahteraan: Hubungan yang Perlu Dipahami",
          "clarity": 35,
          "relevance": 35,
          "hook": 20,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-04",
      "label": "AI dan Menulis",
      "contentType": "Esai teknologi",
      "audience": "Penulis pemula",
      "goal": "Membahas AI sebagai alat tanpa menghapus peran penulis",
      "options": [
        {
          "id": "h1",
          "text": "AI Bisa Menulis. Lalu Penulis Ngapain?",
          "clarity": 33,
          "relevance": 34,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Penulis Akan Punah Karena AI",
          "clarity": 15,
          "relevance": 14,
          "hook": 30,
          "risks": [
            "Overclaim"
          ]
        },
        {
          "id": "h3",
          "text": "Cara AI Menggantikan Kreativitas Manusia",
          "clarity": 17,
          "relevance": 18,
          "hook": 24,
          "risks": [
            "Misleading"
          ]
        },
        {
          "id": "h4",
          "text": "Ketika AI Masuk ke Meja Kerja Penulis",
          "clarity": 35,
          "relevance": 34,
          "hook": 25,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-05",
      "label": "Kesepian",
      "contentType": "Artikel psikologi populer",
      "audience": "Mahasiswa",
      "goal": "Membuka pembahasan bahwa kesepian tidak selalu terlihat",
      "options": [
        {
          "id": "h1",
          "text": "Kesepian Tidak Selalu Datang Saat Kita Sendiri",
          "clarity": 35,
          "relevance": 35,
          "hook": 28,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Tanda Rahasia Semua Orang Kesepian",
          "clarity": 20,
          "relevance": 18,
          "hook": 27,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h3",
          "text": "Kalau Punya Teman, Mustahil Kesepian",
          "clarity": 8,
          "relevance": 8,
          "hook": 18,
          "risks": [
            "False"
          ]
        },
        {
          "id": "h4",
          "text": "Mengapa Kesepian Bisa Muncul di Tengah Keramaian",
          "clarity": 34,
          "relevance": 35,
          "hook": 27,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-06",
      "label": "Nostalgia",
      "contentType": "Feature budaya",
      "audience": "Pembaca umum",
      "goal": "Menjelaskan kenapa benda lama terasa emosional",
      "options": [
        {
          "id": "h1",
          "text": "Kenapa Lagu Lama Bisa Membawa Kita Pulang?",
          "clarity": 34,
          "relevance": 34,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Nostalgia Adalah Bukti Anda Tidak Bisa Move On",
          "clarity": 16,
          "relevance": 14,
          "hook": 28,
          "risks": [
            "Loaded"
          ]
        },
        {
          "id": "h3",
          "text": "Semua Kenangan Lama Lebih Indah",
          "clarity": 14,
          "relevance": 15,
          "hook": 24,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h4",
          "text": "Mengapa Benda dan Lagu Lama Terasa Begitu Personal",
          "clarity": 35,
          "relevance": 35,
          "hook": 24,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-07",
      "label": "Dark Pattern",
      "contentType": "Artikel edukasi digital",
      "audience": "Pengguna aplikasi",
      "goal": "Membantu pembaca mengenali desain manipulatif",
      "options": [
        {
          "id": "h1",
          "text": "Saat Tombol di Layar Diam-diam Mengarahkan Pilihan Anda",
          "clarity": 34,
          "relevance": 35,
          "hook": 29,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Aplikasi Anda Sedang Mengendalikan Pikiran",
          "clarity": 15,
          "relevance": 17,
          "hook": 30,
          "risks": [
            "Overclaim"
          ]
        },
        {
          "id": "h3",
          "text": "Semua Desainer Aplikasi Memanipulasi Pengguna",
          "clarity": 10,
          "relevance": 10,
          "hook": 25,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h4",
          "text": "Dark Pattern: Ketika Desain Mendorong Pilihan yang Tidak Anda Inginkan",
          "clarity": 35,
          "relevance": 35,
          "hook": 23,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-08",
      "label": "Burnout",
      "contentType": "Artikel kerja",
      "audience": "Pekerja awal karier",
      "goal": "Membedakan lelah biasa dan burnout tanpa diagnosis",
      "options": [
        {
          "id": "h1",
          "text": "Lelah atau Burnout? Kenali Perbedaannya Tanpa Mendiagnosis Diri",
          "clarity": 35,
          "relevance": 35,
          "hook": 27,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Kalau Malas Kerja, Anda Pasti Burnout",
          "clarity": 8,
          "relevance": 10,
          "hook": 20,
          "risks": [
            "False"
          ]
        },
        {
          "id": "h3",
          "text": "Tes 30 Detik untuk Membuktikan Anda Burnout",
          "clarity": 14,
          "relevance": 13,
          "hook": 30,
          "risks": [
            "Medical overclaim"
          ]
        },
        {
          "id": "h4",
          "text": "Burnout Bukan Sekadar Lelah Setelah Hari yang Panjang",
          "clarity": 34,
          "relevance": 35,
          "hook": 27,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-09",
      "label": "Algoritma",
      "contentType": "Artikel media",
      "audience": "Pengguna media sosial",
      "goal": "Menjelaskan pengaruh rekomendasi terhadap apa yang dilihat",
      "options": [
        {
          "id": "h1",
          "text": "Siapa yang Memilih Isi Feed Anda?",
          "clarity": 33,
          "relevance": 34,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Algoritma Tahu Segalanya Tentang Anda",
          "clarity": 18,
          "relevance": 16,
          "hook": 29,
          "risks": [
            "Overclaim"
          ]
        },
        {
          "id": "h3",
          "text": "Media Sosial Mengontrol Semua yang Anda Pikirkan",
          "clarity": 10,
          "relevance": 10,
          "hook": 28,
          "risks": [
            "Overclaim"
          ]
        },
        {
          "id": "h4",
          "text": "Bagaimana Sistem Rekomendasi Membentuk Apa yang Muncul di Feed",
          "clarity": 35,
          "relevance": 35,
          "hook": 23,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-10",
      "label": "Kopi",
      "contentType": "Feature ringan",
      "audience": "Pekerja kreatif",
      "goal": "Membahas ritual kopi sebagai kebiasaan, bukan klaim kesehatan",
      "options": [
        {
          "id": "h1",
          "text": "Kenapa Secangkir Kopi Bisa Terasa Seperti Tombol Mulai?",
          "clarity": 34,
          "relevance": 34,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Kopi Terbukti Membuat Semua Orang Lebih Kreatif",
          "clarity": 12,
          "relevance": 13,
          "hook": 28,
          "risks": [
            "Overclaim"
          ]
        },
        {
          "id": "h3",
          "text": "Minum Kopi dan Ide Akan Datang Sendiri",
          "clarity": 10,
          "relevance": 12,
          "hook": 27,
          "risks": [
            "Overpromise"
          ]
        },
        {
          "id": "h4",
          "text": "Ritual Kopi dan Cara Kita Memulai Hari Kerja",
          "clarity": 35,
          "relevance": 35,
          "hook": 22,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-11",
      "label": "Pilihan Berlebihan",
      "contentType": "Artikel consumer behavior",
      "audience": "Pembeli digital",
      "goal": "Menjelaskan choice overload",
      "options": [
        {
          "id": "h1",
          "text": "Terlalu Banyak Pilihan Bisa Membuat Kita Tidak Memilih Apa-apa",
          "clarity": 35,
          "relevance": 35,
          "hook": 27,
          "risks": []
        },
        {
          "id": "h2",
          "text": "100 Pilihan Akan Menghancurkan Otak Anda",
          "clarity": 11,
          "relevance": 12,
          "hook": 29,
          "risks": [
            "Sensational"
          ]
        },
        {
          "id": "h3",
          "text": "Semakin Banyak Produk, Semakin Buruk Tokonya",
          "clarity": 15,
          "relevance": 15,
          "hook": 22,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h4",
          "text": "Ketika Banyak Pilihan Justru Membuat Keputusan Lebih Sulit",
          "clarity": 35,
          "relevance": 35,
          "hook": 24,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-12",
      "label": "Empati",
      "contentType": "Artikel komunikasi",
      "audience": "Tim kerja",
      "goal": "Membedakan mendengar dan langsung memberi solusi",
      "options": [
        {
          "id": "h1",
          "text": "Kadang Orang Tidak Butuh Solusi. Mereka Butuh Didengar.",
          "clarity": 34,
          "relevance": 35,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Satu Kalimat Ini Akan Membuat Semua Orang Menyukai Anda",
          "clarity": 13,
          "relevance": 12,
          "hook": 30,
          "risks": [
            "Overpromise"
          ]
        },
        {
          "id": "h3",
          "text": "Berhenti Memberi Nasihat Selamanya",
          "clarity": 17,
          "relevance": 18,
          "hook": 25,
          "risks": [
            "Absolute"
          ]
        },
        {
          "id": "h4",
          "text": "Mendengar Sebelum Menjawab: Bagian Kecil dari Empati",
          "clarity": 35,
          "relevance": 34,
          "hook": 22,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-13",
      "label": "Bahasa Internet",
      "contentType": "Feature budaya",
      "audience": "Pengguna internet",
      "goal": "Membahas perubahan bahasa secara netral",
      "options": [
        {
          "id": "h1",
          "text": "Bahasa Internet Tidak Rusak. Ia Sedang Bergerak.",
          "clarity": 33,
          "relevance": 34,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Gen Z Menghancurkan Bahasa Indonesia",
          "clarity": 10,
          "relevance": 12,
          "hook": 29,
          "risks": [
            "Loaded"
          ]
        },
        {
          "id": "h3",
          "text": "Singkatan Online Membuat Kita Makin Bodoh",
          "clarity": 12,
          "relevance": 13,
          "hook": 26,
          "risks": [
            "Unsupported"
          ]
        },
        {
          "id": "h4",
          "text": "Dari WKWK ke Istilah Baru: Bagaimana Internet Mengubah Bahasa",
          "clarity": 35,
          "relevance": 35,
          "hook": 25,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-14",
      "label": "Kerja Remote",
      "contentType": "Artikel kerja",
      "audience": "Pekerja hybrid",
      "goal": "Membahas trade-off fokus dan isolasi",
      "options": [
        {
          "id": "h1",
          "text": "Kerja dari Rumah Memberi Fokus—dan Tantangan yang Berbeda",
          "clarity": 34,
          "relevance": 35,
          "hook": 25,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Remote Work Adalah Cara Kerja Paling Sempurna",
          "clarity": 12,
          "relevance": 15,
          "hook": 26,
          "risks": [
            "Absolute"
          ]
        },
        {
          "id": "h3",
          "text": "Kantor Sudah Tidak Berguna",
          "clarity": 11,
          "relevance": 12,
          "hook": 25,
          "risks": [
            "Loaded"
          ]
        },
        {
          "id": "h4",
          "text": "Apa yang Kita Dapat dan Kehilangan Saat Bekerja dari Rumah",
          "clarity": 35,
          "relevance": 35,
          "hook": 29,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-15",
      "label": "Musik dan Emosi",
      "contentType": "Artikel budaya",
      "audience": "Pendengar musik",
      "goal": "Mengundang pembaca mengeksplorasi hubungan musik dan memori",
      "options": [
        {
          "id": "h1",
          "text": "Kenapa Satu Lagu Bisa Mengubah Suasana dalam Hitungan Detik?",
          "clarity": 34,
          "relevance": 34,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Lagu Sedih Selalu Membuat Depresi",
          "clarity": 8,
          "relevance": 9,
          "hook": 23,
          "risks": [
            "False"
          ]
        },
        {
          "id": "h3",
          "text": "Musik Bisa Menyembuhkan Semua Luka",
          "clarity": 10,
          "relevance": 10,
          "hook": 28,
          "risks": [
            "Overclaim"
          ]
        },
        {
          "id": "h4",
          "text": "Musik, Memori, dan Emosi yang Datang Bersamaan",
          "clarity": 35,
          "relevance": 35,
          "hook": 23,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-16",
      "label": "Efek Halo",
      "contentType": "Artikel psikologi populer",
      "audience": "Pembaca umum",
      "goal": "Memperkenalkan bias penilaian",
      "options": [
        {
          "id": "h1",
          "text": "Saat Satu Kesan Baik Mewarnai Semua Penilaian Kita",
          "clarity": 34,
          "relevance": 35,
          "hook": 28,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Orang Menarik Selalu Dipercaya",
          "clarity": 12,
          "relevance": 15,
          "hook": 24,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h3",
          "text": "Otak Anda Tidak Pernah Menilai dengan Benar",
          "clarity": 14,
          "relevance": 13,
          "hook": 29,
          "risks": [
            "Absolute"
          ]
        },
        {
          "id": "h4",
          "text": "Efek Halo: Mengapa Satu Kesan Bisa Memengaruhi Penilaian Lain",
          "clarity": 35,
          "relevance": 35,
          "hook": 22,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-17",
      "label": "Apathy",
      "contentType": "Esai reflektif",
      "audience": "Pembaca muda",
      "goal": "Membahas ketidakpedulian tanpa menghakimi",
      "options": [
        {
          "id": "h1",
          "text": "Ketika Tidak Peduli Terasa Lebih Mudah daripada Memilih",
          "clarity": 34,
          "relevance": 34,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Orang Apatis Adalah Masalah Masyarakat",
          "clarity": 18,
          "relevance": 18,
          "hook": 25,
          "risks": [
            "Loaded"
          ]
        },
        {
          "id": "h3",
          "text": "Kalau Diam, Berarti Anda Tidak Punya Empati",
          "clarity": 10,
          "relevance": 11,
          "hook": 22,
          "risks": [
            "False"
          ]
        },
        {
          "id": "h4",
          "text": "Apathy dan Jarak yang Kita Buat dari Masalah",
          "clarity": 35,
          "relevance": 34,
          "hook": 21,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-18",
      "label": "Kepercayaan Konsumen",
      "contentType": "Artikel brand",
      "audience": "Pemilik bisnis kecil",
      "goal": "Menjelaskan trust tanpa formula instan",
      "options": [
        {
          "id": "h1",
          "text": "Kepercayaan Pelanggan Dibangun Sebelum Tombol Beli Ditekan",
          "clarity": 35,
          "relevance": 35,
          "hook": 27,
          "risks": []
        },
        {
          "id": "h2",
          "text": "3 Trik yang Dijamin Membuat Pelanggan Percaya",
          "clarity": 15,
          "relevance": 16,
          "hook": 30,
          "risks": [
            "Guarantee"
          ]
        },
        {
          "id": "h3",
          "text": "Brand Besar Selalu Lebih Dipercaya",
          "clarity": 13,
          "relevance": 14,
          "hook": 20,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h4",
          "text": "Apa yang Membuat Konsumen Merasa Aman Memilih Sebuah Brand",
          "clarity": 34,
          "relevance": 35,
          "hook": 27,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-19",
      "label": "Parasocial",
      "contentType": "Artikel media",
      "audience": "Penggemar kreator",
      "goal": "Menjelaskan kedekatan satu arah tanpa menghakimi",
      "options": [
        {
          "id": "h1",
          "text": "Merasa Dekat dengan Kreator yang Tidak Mengenal Kita",
          "clarity": 35,
          "relevance": 35,
          "hook": 27,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Fans Parasocial Pasti Kesepian",
          "clarity": 12,
          "relevance": 13,
          "hook": 23,
          "risks": [
            "Stigma"
          ]
        },
        {
          "id": "h3",
          "text": "Influencer Memanipulasi Semua Pengikutnya",
          "clarity": 11,
          "relevance": 12,
          "hook": 27,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h4",
          "text": "Hubungan Parasosial: Kedekatan yang Berjalan Satu Arah",
          "clarity": 35,
          "relevance": 35,
          "hook": 22,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-20",
      "label": "Kreativitas",
      "contentType": "Artikel kerja kreatif",
      "audience": "Kreator pemula",
      "goal": "Membongkar mitos inspirasi instan",
      "options": [
        {
          "id": "h1",
          "text": "Kreativitas Tidak Selalu Datang Saat Kita Menunggunya",
          "clarity": 34,
          "relevance": 35,
          "hook": 27,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Rahasia Menjadi Kreatif dalam Lima Menit",
          "clarity": 14,
          "relevance": 15,
          "hook": 30,
          "risks": [
            "Overpromise"
          ]
        },
        {
          "id": "h3",
          "text": "Orang Kreatif Terlahir Berbeda",
          "clarity": 10,
          "relevance": 12,
          "hook": 22,
          "risks": [
            "False"
          ]
        },
        {
          "id": "h4",
          "text": "Ide Bagus Sering Dimulai dari Draft yang Biasa Saja",
          "clarity": 35,
          "relevance": 35,
          "hook": 28,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-21",
      "label": "Memori Kolektif",
      "contentType": "Feature sejarah budaya",
      "audience": "Pembaca umum",
      "goal": "Menjelaskan bagaimana kelompok mengingat peristiwa",
      "options": [
        {
          "id": "h1",
          "text": "Siapa yang Menentukan Apa yang Kita Ingat Bersama?",
          "clarity": 33,
          "relevance": 34,
          "hook": 30,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Sejarah yang Anda Tahu Semuanya Salah",
          "clarity": 13,
          "relevance": 12,
          "hook": 29,
          "risks": [
            "Sensational"
          ]
        },
        {
          "id": "h3",
          "text": "Masyarakat Selalu Mengingat Masa Lalu dengan Keliru",
          "clarity": 12,
          "relevance": 13,
          "hook": 22,
          "risks": [
            "Absolute"
          ]
        },
        {
          "id": "h4",
          "text": "Memori Kolektif dan Cara Sebuah Kelompok Mengingat Masa Lalu",
          "clarity": 35,
          "relevance": 35,
          "hook": 22,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-22",
      "label": "Arsitektur Pilihan",
      "contentType": "Artikel UX",
      "audience": "Desainer junior",
      "goal": "Menjelaskan bahwa urutan pilihan memengaruhi keputusan",
      "options": [
        {
          "id": "h1",
          "text": "Urutan Pilihan Bisa Mengubah Apa yang Kita Pilih",
          "clarity": 35,
          "relevance": 35,
          "hook": 26,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Desainer Bisa Mengendalikan Keputusan Siapa Pun",
          "clarity": 13,
          "relevance": 14,
          "hook": 28,
          "risks": [
            "Overclaim"
          ]
        },
        {
          "id": "h3",
          "text": "UX Adalah Manipulasi",
          "clarity": 12,
          "relevance": 12,
          "hook": 24,
          "risks": [
            "Loaded"
          ]
        },
        {
          "id": "h4",
          "text": "Arsitektur Pilihan: Saat Susunan Opsi Ikut Membentuk Keputusan",
          "clarity": 35,
          "relevance": 35,
          "hook": 23,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-23",
      "label": "Subteks",
      "contentType": "Artikel menulis",
      "audience": "Penulis pemula",
      "goal": "Menjelaskan makna implisit dalam dialog",
      "options": [
        {
          "id": "h1",
          "text": "Yang Tidak Diucapkan Kadang Justru Menggerakkan Dialog",
          "clarity": 35,
          "relevance": 35,
          "hook": 28,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Dialog Bagus Tidak Pernah Mengatakan Maksudnya",
          "clarity": 17,
          "relevance": 18,
          "hook": 24,
          "risks": [
            "Absolute"
          ]
        },
        {
          "id": "h3",
          "text": "Satu Teknik Ini Membuat Dialog Anda Sempurna",
          "clarity": 12,
          "relevance": 14,
          "hook": 30,
          "risks": [
            "Overpromise"
          ]
        },
        {
          "id": "h4",
          "text": "Subteks: Makna yang Hidup di Bawah Kalimat",
          "clarity": 35,
          "relevance": 34,
          "hook": 24,
          "risks": []
        }
      ]
    },
    {
      "id": "headline-24",
      "label": "Satir",
      "contentType": "Artikel budaya",
      "audience": "Pembaca umum",
      "goal": "Menjelaskan satir tanpa menyamakannya dengan semua humor",
      "options": [
        {
          "id": "h1",
          "text": "Saat Lelucon Dipakai untuk Menyenggol Sesuatu yang Serius",
          "clarity": 34,
          "relevance": 35,
          "hook": 29,
          "risks": []
        },
        {
          "id": "h2",
          "text": "Semua Humor Politik Adalah Satir",
          "clarity": 14,
          "relevance": 16,
          "hook": 21,
          "risks": [
            "Overgeneral"
          ]
        },
        {
          "id": "h3",
          "text": "Satir Selalu Lebih Cerdas dari Komedi Biasa",
          "clarity": 12,
          "relevance": 13,
          "hook": 24,
          "risks": [
            "Loaded"
          ]
        },
        {
          "id": "h4",
          "text": "Satir: Ketika Humor Membawa Kritik di Dalamnya",
          "clarity": 35,
          "relevance": 35,
          "hook": 23,
          "risks": []
        }
      ]
    }
  ]
};

const TONE_SWITCHER_CMS_PRESET = {
  "id": "tone-switcher",
  "gameType": "toneSwitcher",
  "enabled": true,
  "showInLibrary": true,
  "gameName": "Tone Switcher",
  "gameCategory": "Style & Audience",
  "gameCardDescription": "Sesuaikan satu pesan untuk audiens, kanal, dan nada yang berbeda tanpa mengubah maksudnya.",
  "title": "Pesannya sama. Cara mengatakannya belum tentu.",
  "objective": "Hadapi 10 situasi komunikasi. Baca pesan dasar, audiens, kanal, dan nada yang diminta, lalu pilih versi yang paling tepat tanpa mengubah maksud utama.",
  "rules": [
    "Baca konteks: pesan dasar, kanal, target pembaca, dan nada yang diminta.",
    "Pilih satu dari empat versi. Fokus pada cara menyampaikan, bukan mengganti fakta atau maksud.",
    "Setiap pilihan dinilai dari Kesesuaian Nada 40, Kesesuaian Audiens 35, dan Kejelasan 25.",
    "Versi yang terdengar menarik tetap dapat kehilangan nilai jika terlalu formal, terlalu santai, terlalu agresif, atau mengubah makna.",
    "Selesaikan 10 situasi. Setelah memilih, baca Tone Report sebelum melanjutkan."
  ],
  "startButtonLabel": "Mulai Mengganti Nada",
  "casesPerSession": 10,
  "contextLabel": "KONTEKS",
  "channelLabel": "KANAL",
  "audienceLabel": "TARGET PEMBACA",
  "toneLabel": "NADA",
  "sourceLabel": "PESAN DASAR",
  "chooseLabel": "PILIH VERSI",
  "submitLabel": "Kunci Nada",
  "reportLabel": "TONE REPORT",
  "toneFitLabel": "Kesesuaian Nada",
  "audienceFitLabel": "Kesesuaian Audiens",
  "clarityLabel": "Kejelasan",
  "nextLabel": "Situasi Berikutnya",
  "resultEyebrow": "LAPORAN TONE AKHIR",
  "scoreLabel": "Skor Akhir",
  "bestDimensionLabel": "Dimensi Terkuat",
  "replayLabel": "Main Lagi",
  "gradeTitles": [
    {
      "min": 900,
      "label": "Voice Director",
      "remark": "Anda bisa mengubah suara tanpa membuat pesannya kehilangan identitas."
    },
    {
      "min": 750,
      "label": "Tone Editor",
      "remark": "Anda tahu kapan sebuah pesan perlu dilunakkan, ditegaskan, atau dibuat lebih dekat."
    },
    {
      "min": 550,
      "label": "Style Scout",
      "remark": "Arah nadanya mulai terbaca. Beberapa pesan masih memakai baju yang salah."
    },
    {
      "min": 0,
      "label": "Wrong Room",
      "remark": "Pesannya sampai. Hanya saja, kadang seperti dikirim ke ruangan yang berbeda."
    }
  ],
  "cases": [
    {
      "id": "tone-01",
      "label": "Permintaan revisi",
      "channel": "Email kerja",
      "audience": "Atasan",
      "targetTone": "Profesional",
      "source": "Tolong revisi bagian pembuka ini sebelum pukul tiga.",
      "options": [
        {
          "id": "t1",
          "text": "Bagian pembukanya perlu disesuaikan. Mohon revisinya sebelum pukul tiga.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Bro, pembukanya aneh. Benerin sebelum jam tiga ya.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Dengan hormat, saya memohon kesediaan Anda untuk melakukan revisi terhadap bagian pembuka sebelum pukul tiga.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Pembukanya salah. Revisi sekarang.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-02",
      "label": "Promo produk",
      "channel": "Instagram",
      "audience": "Calon pelanggan",
      "targetTone": "Persuasif",
      "source": "Produk ini dibuat untuk meja kerja kecil dan mudah disimpan.",
      "options": [
        {
          "id": "t1",
          "text": "Meja sempit? Produk ini tetap punya tempat—ringkas, praktis, dan mudah disimpan.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Produk ini memiliki dimensi yang relatif ringkas untuk kebutuhan penyimpanan.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "WOI MEJA KECIL WAJIB BELI INI SEKARANG!!!",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Produk ini cocok. Beli.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-03",
      "label": "Gangguan layanan",
      "channel": "Notifikasi aplikasi",
      "audience": "Pengguna aktif",
      "targetTone": "Empatik",
      "source": "Layanan sedang mengalami gangguan dan tim sedang memperbaikinya.",
      "options": [
        {
          "id": "t1",
          "text": "Kami tahu ini mengganggu. Tim kami sedang memperbaiki layanan dan akan memberi kabar begitu kembali normal.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Terjadi gangguan layanan. Mohon menunggu proses perbaikan.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Santai aja, servernya lagi ngambek dikit.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Layanan gagal. Tunggu.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-04",
      "label": "Pengingat tugas",
      "channel": "Chat tim",
      "audience": "Rekan kerja",
      "targetTone": "Santai",
      "source": "Batas pengumpulan materi adalah sore ini.",
      "options": [
        {
          "id": "t1",
          "text": "Heads up, materi kita ditunggu sore ini ya. Kalau ada yang nyangkut, kabarin.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Dengan ini kami mengingatkan bahwa batas pengumpulan materi adalah sore hari ini.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "CEPET KIRIM MATERINYA, SORE INI DEADLINE!",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Deadline sore ini.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-05",
      "label": "Kebijakan privasi",
      "channel": "Pusat bantuan",
      "audience": "Pengguna umum",
      "targetTone": "Informatif",
      "source": "Aplikasi menyimpan preferensi bahasa agar pilihan pengguna tetap sama pada kunjungan berikutnya.",
      "options": [
        {
          "id": "t1",
          "text": "Kami menyimpan preferensi bahasa Anda agar pilihan yang sama tetap digunakan saat Anda kembali.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Tenang, kami cuma inget bahasa favoritmu biar besok nggak mulai dari nol.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Aplikasi ini mengingat semuanya tentang Anda.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Preferensi disimpan.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-06",
      "label": "Penolakan kandidat",
      "channel": "Email rekrutmen",
      "audience": "Pelamar",
      "targetTone": "Empatik",
      "source": "Pelamar tidak dilanjutkan ke tahap berikutnya.",
      "options": [
        {
          "id": "t1",
          "text": "Terima kasih sudah meluangkan waktu untuk mengikuti proses kami. Untuk posisi ini, kami belum melanjutkan aplikasi Anda ke tahap berikutnya.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Anda tidak lolos. Semoga sukses.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Sayangnya, dengan segala hormat dan pertimbangan mendalam, kami harus menyampaikan keputusan yang tidak mudah ini.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Yah, belum rezeki. Coba lagi nanti.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-07",
      "label": "Peluncuran fitur",
      "channel": "Product update",
      "audience": "Pengguna lama",
      "targetTone": "Antusias",
      "source": "Fitur pencarian kini mendukung filter berdasarkan tanggal.",
      "options": [
        {
          "id": "t1",
          "text": "Sekarang pencarian bisa dipersempit berdasarkan tanggal—lebih cepat menemukan yang benar-benar Anda cari.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Telah ditambahkan dukungan filter tanggal pada fungsi pencarian.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "GILA! FILTER TANGGAL AKHIRNYA TURUN!!!",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Ada filter tanggal.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-08",
      "label": "Instruksi reset password",
      "channel": "Help center",
      "audience": "Pengguna bermasalah",
      "targetTone": "Instruktif",
      "source": "Pengguna perlu membuka email reset lalu membuat kata sandi baru.",
      "options": [
        {
          "id": "t1",
          "text": "Buka email reset yang kami kirim, pilih tautannya, lalu buat kata sandi baru.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Kami menyarankan agar pengguna terlebih dahulu mengakses korespondensi elektronik terkait pengaturan ulang.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Cek email, pencet link, beresin password. Gampang.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Reset password melalui email.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-09",
      "label": "Permintaan maaf",
      "channel": "Email pelanggan",
      "audience": "Pelanggan kecewa",
      "targetTone": "Empatik",
      "source": "Pesanan tiba dua hari terlambat.",
      "options": [
        {
          "id": "t1",
          "text": "Maaf pesanan Anda tiba dua hari lebih lambat dari jadwal. Kami memahami keterlambatan ini merepotkan.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Pesanan terlambat dua hari karena kendala operasional.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Ya ampun, telat dua hari doang kok.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Pesanan terlambat. Maaf.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-10",
      "label": "CTA newsletter",
      "channel": "Landing page",
      "audience": "Pembaca artikel",
      "targetTone": "Persuasif",
      "source": "Newsletter berisi satu rangkuman ide setiap Jumat.",
      "options": [
        {
          "id": "t1",
          "text": "Satu ide penting setiap Jumat, langsung ke inbox Anda. Bergabunglah dengan newsletter.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Newsletter dikirim pada hari Jumat dan berisi rangkuman ide.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "DAFTAR SEKARANG ATAU KETINGGALAN SELAMANYA!",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Daftar newsletter.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-11",
      "label": "Feedback desain",
      "channel": "Komentar kerja",
      "audience": "Desainer",
      "targetTone": "Konstruktif",
      "source": "Kontras tombol utama terlalu rendah.",
      "options": [
        {
          "id": "t1",
          "text": "Arah visualnya sudah jelas. Untuk tombol utama, coba naikkan kontrasnya agar tindakan utama lebih mudah ditemukan.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Kontras tombol tidak memenuhi kebutuhan. Perbaiki.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Tombolnya nyaris nggak kelihatan, bro.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Desainnya jelek karena tombolnya redup.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-12",
      "label": "Pengumuman kantor",
      "channel": "Slack",
      "audience": "Tim internal",
      "targetTone": "Santai",
      "source": "Rapat mingguan dipindahkan dari Senin ke Selasa.",
      "options": [
        {
          "id": "t1",
          "text": "Rapat mingguan geser ke Selasa ya, jamnya tetap sama. Sampai ketemu!",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Dengan ini diberitahukan bahwa rapat mingguan dipindahkan ke hari Selasa.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "BREAKING NEWS: Senin kita bebas rapat!!!",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Rapat Selasa.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-13",
      "label": "Hasil survei",
      "channel": "Laporan",
      "audience": "Manajemen",
      "targetTone": "Analitis",
      "source": "68% responden menyebut kecepatan sebagai alasan utama memilih layanan.",
      "options": [
        {
          "id": "t1",
          "text": "Sebanyak 68% responden menempatkan kecepatan sebagai alasan utama memilih layanan, menjadikannya faktor yang paling sering disebut.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Mayoritas banget orang suka karena cepat.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Kecepatan jelas membuktikan layanan ini paling unggul.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "68% bilang cepat.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-14",
      "label": "Bio kreator",
      "channel": "Portfolio",
      "audience": "Calon klien",
      "targetTone": "Profesional",
      "source": "Penulis berfokus pada konten, editing, dan strategi kreatif.",
      "options": [
        {
          "id": "t1",
          "text": "Saya menulis dan menyunting konten, lalu membantu mengubah gagasan menjadi arah komunikasi yang lebih jelas.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Saya adalah individu profesional yang memiliki kompetensi dalam berbagai aspek penulisan.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Gue bisa nulis apa aja, gas aja.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Penulis. Editor. Strategi.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-15",
      "label": "FAQ refund",
      "channel": "Help center",
      "audience": "Pelanggan",
      "targetTone": "Informatif",
      "source": "Refund diproses 5–7 hari kerja setelah disetujui.",
      "options": [
        {
          "id": "t1",
          "text": "Setelah disetujui, refund biasanya diproses dalam 5–7 hari kerja.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Duit balik sekitar semingguan, santai.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Refund akan segera diterima.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Refund: 5–7 hari.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-16",
      "label": "Ajakan donasi",
      "channel": "Campaign page",
      "audience": "Donatur potensial",
      "targetTone": "Persuasif",
      "source": "Donasi mendukung penyediaan buku untuk perpustakaan komunitas.",
      "options": [
        {
          "id": "t1",
          "text": "Satu kontribusi membantu menambah buku yang bisa dibaca bersama di perpustakaan komunitas.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Donasi akan dialokasikan untuk pengadaan koleksi literatur.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Kalau peduli pendidikan, masa nggak donasi?",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Donasi buku sekarang.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-17",
      "label": "Peringatan keamanan",
      "channel": "Email keamanan",
      "audience": "Pemilik akun",
      "targetTone": "Tegas",
      "source": "Terdeteksi login baru dari perangkat yang tidak dikenal.",
      "options": [
        {
          "id": "t1",
          "text": "Kami mendeteksi login dari perangkat baru. Jika ini bukan Anda, amankan akun sekarang.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Kayaknya ada yang masuk akunmu. Cek deh.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Dengan hormat kami informasikan adanya aktivitas autentikasi baru.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "LOGIN ASING!!! PANIK SEKARANG!!!",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-18",
      "label": "Caption acara",
      "channel": "Instagram",
      "audience": "Mahasiswa",
      "targetTone": "Antusias",
      "source": "Workshop menulis dibuka Sabtu pukul 10.",
      "options": [
        {
          "id": "t1",
          "text": "Sabtu, jam 10: meja kosong, ide berantakan, dan kita mulai menulis. Sampai ketemu di workshop!",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Workshop penulisan akan diselenggarakan Sabtu pukul 10.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Workshop Sabtu. Datang.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "ACARA PALING GILA TAHUN INI!!!",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-19",
      "label": "Penjelasan error",
      "channel": "Aplikasi",
      "audience": "Pengguna umum",
      "targetTone": "Instruktif",
      "source": "Unggahan gagal karena ukuran file melebihi 10 MB.",
      "options": [
        {
          "id": "t1",
          "text": "File belum bisa diunggah karena ukurannya lebih dari 10 MB. Pilih file yang lebih kecil lalu coba lagi.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Upload error: payload exceeds maximum size.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Waduh kegedean filenya. Kecilin dong.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Gagal.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-20",
      "label": "Undangan wawancara",
      "channel": "Email rekrutmen",
      "audience": "Kandidat",
      "targetTone": "Profesional",
      "source": "Kandidat diundang wawancara daring Kamis pukul 14.00.",
      "options": [
        {
          "id": "t1",
          "text": "Kami ingin mengundang Anda ke wawancara daring pada Kamis pukul 14.00. Silakan konfirmasi apakah waktunya sesuai.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Hei, Kamis jam dua bisa ngobrol bentar nggak?",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Dengan segala hormat, kami bermaksud mengajukan permohonan kehadiran Anda.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Interview Kamis 14.00.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-21",
      "label": "Update proyek",
      "channel": "Email klien",
      "audience": "Klien",
      "targetTone": "Transparan",
      "source": "Proyek mundur satu hari karena revisi data.",
      "options": [
        {
          "id": "t1",
          "text": "Jadwal proyek bergeser satu hari karena kami perlu merevisi data sebelum melanjutkan. Target terbaru kami adalah Jumat.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Ada sedikit delay, tapi aman kok.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Proyek terlambat karena data bermasalah.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Mohon dimaklumi bahwa terdapat penyesuaian temporal.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-22",
      "label": "Onboarding",
      "channel": "Aplikasi",
      "audience": "Pengguna baru",
      "targetTone": "Ramah",
      "source": "Pengguna perlu memilih tiga topik agar rekomendasi awal lebih relevan.",
      "options": [
        {
          "id": "t1",
          "text": "Pilih tiga topik yang Anda suka. Kami akan memakainya untuk menyiapkan rekomendasi awal.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Silakan melakukan seleksi terhadap tiga kategori preferensi.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Pilih tiga aja, nanti aplikasinya ngerti sendiri.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "PILIH TOPIK SEKARANG!",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-23",
      "label": "Kritik artikel",
      "channel": "Editorial note",
      "audience": "Penulis",
      "targetTone": "Konstruktif",
      "source": "Paragraf kedua mengulang gagasan dari pembuka.",
      "options": [
        {
          "id": "t1",
          "text": "Gagasan di paragraf kedua sudah muncul di pembuka. Coba gunakan ruang ini untuk membawa pembaca satu langkah lebih jauh.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Paragraf dua repetitif dan tidak efisien.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Ini ngulang banget. Hapus aja.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Paragraf kedua salah.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    },
    {
      "id": "tone-24",
      "label": "Pesan komunitas",
      "channel": "Forum",
      "audience": "Anggota baru",
      "targetTone": "Ramah",
      "source": "Anggota baru diminta membaca aturan sebelum memposting.",
      "options": [
        {
          "id": "t1",
          "text": "Selamat datang! Sebelum ikut ngobrol, luangkan sebentar untuk membaca aturan komunitas supaya ruang ini tetap nyaman buat semua.",
          "toneFit": 38,
          "audienceFit": 34,
          "clarity": 28
        },
        {
          "id": "t2",
          "text": "Pengguna diwajibkan mempelajari ketentuan sebelum melakukan publikasi.",
          "toneFit": 27,
          "audienceFit": 24,
          "clarity": 22
        },
        {
          "id": "t3",
          "text": "Baca aturan dulu, jangan bikin rusuh.",
          "toneFit": 18,
          "audienceFit": 18,
          "clarity": 18
        },
        {
          "id": "t4",
          "text": "Aturan ada. Baca.",
          "toneFit": 12,
          "audienceFit": 16,
          "clarity": 14
        }
      ]
    }
  ]
};

const LOGICAL_LEAP_CMS_PRESET = {
  "id": "logical-leap",
  "gameType": "logicalLeap",
  "enabled": true,
  "showInLibrary": true,
  "gameName": "The Logical Leap",
  "gameCategory": "Critical Thinking",
  "gameCardDescription": "Temukan lompatan logika, asumsi tersembunyi, dan kesimpulan yang bergerak lebih jauh daripada buktinya.",
  "title": "Jangan biarkan kesimpulan melompat sendirian.",
  "objective": "Hadapi 10 argumen. Pilih respons yang paling tepat untuk menguji apakah kesimpulan benar-benar didukung oleh alasan dan bukti yang diberikan.",
  "rules": [
    "Baca argumen sampai selesai. Cari hubungan antara bukti, asumsi, dan kesimpulannya.",
    "Pilih satu dari empat respons. Tugas Anda bukan setuju atau tidak setuju, tetapi menilai cara kesimpulan dibangun.",
    "Setiap pilihan dinilai dari Logika 40, Penggunaan Bukti 35, dan Presisi 25.",
    "Waspadai korelasi yang dianggap sebab, generalisasi, pilihan palsu, serangan pribadi, bukti yang dipilih sebagian, dan lompatan lain.",
    "Selesaikan 10 argumen. Setelah setiap jawaban, baca Logic Report sebelum melanjutkan."
  ],
  "startButtonLabel": "Mulai Menguji",
  "casesPerSession": 10,
  "caseLabel": "ARGUMEN",
  "statementLabel": "PERNYYATAAN",
  "chooseLabel": "PILIH ANALISIS",
  "submitLabel": "Kunci Analisis",
  "reportLabel": "LOGIC REPORT",
  "logicLabel": "Logika",
  "evidenceLabel": "Penggunaan Bukti",
  "precisionLabel": "Presisi",
  "conceptLabel": "Pola yang Diuji",
  "nextLabel": "Argumen Berikutnya",
  "resultEyebrow": "LAPORAN LOGIKA AKHIR",
  "scoreLabel": "Skor Akhir",
  "bestDimensionLabel": "Dimensi Terkuat",
  "replayLabel": "Main Lagi",
  "gradeTitles": [
    {
      "min": 900,
      "label": "Reasoning Architect",
      "remark": "Anda tidak hanya melihat kesimpulan—Anda memeriksa jembatan yang dipakai untuk sampai ke sana."
    },
    {
      "min": 750,
      "label": "Logic Editor",
      "remark": "Sebagian besar lompatan logika tertangkap sebelum sempat menyamar sebagai kesimpulan."
    },
    {
      "min": 550,
      "label": "Assumption Hunter",
      "remark": "Anda mulai melihat asumsi yang bersembunyi di antara bukti dan kesimpulan."
    },
    {
      "min": 0,
      "label": "Leap Survivor",
      "remark": "Beberapa kesimpulan masih berhasil melompat melewati pagar. Setidaknya sekarang pagarnya terlihat."
    }
  ],
  "cases": [
    {
      "id": "logic-01",
      "label": "Korelasi Bukan Sebab",
      "statement": "Survei menunjukkan orang yang rutin membawa payung lebih sering melihat hujan.",
      "options": [
        {
          "id": "a",
          "text": "Karena membawa payung membuat hujan turun.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Ada hubungan, tetapi data ini tidak menunjukkan bahwa payung menyebabkan hujan.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Orang yang melihat hujan pasti selalu membawa payung.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Survei membuktikan payung memengaruhi cuaca.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "correlation"
    },
    {
      "id": "logic-02",
      "label": "Sampel Terlalu Sempit",
      "statement": "Sebuah kafe bertanya kepada 20 pelanggan tetap dan 19 orang menyukai menu barunya.",
      "options": [
        {
          "id": "a",
          "text": "Menu baru pasti disukai seluruh kota.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Hasil ini menggambarkan pelanggan tetap yang ditanya, bukan otomatis seluruh kota.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Karena 19 orang suka, riset tambahan tidak diperlukan.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Satu orang yang tidak suka dapat diabaikan.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "sample"
    },
    {
      "id": "logic-03",
      "label": "Dikotomi Palsu",
      "statement": "Jika tim tidak bekerja dari kantor setiap hari, berarti mereka tidak serius bekerja.",
      "options": [
        {
          "id": "a",
          "text": "Hanya ada dua pilihan: kantor penuh atau tidak serius.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Keseriusan kerja tidak hanya ditentukan oleh lokasi; ada kemungkinan lain di antara dua pilihan itu.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Kerja remote selalu lebih baik.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Semua kantor membuat orang produktif.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "false_dilemma"
    },
    {
      "id": "logic-04",
      "label": "Generalisasi Terburu-buru",
      "statement": "Dua aplikasi buatan startup lokal yang saya coba sering crash. Startup lokal memang tidak bisa membuat aplikasi bagus.",
      "options": [
        {
          "id": "a",
          "text": "Kesimpulannya terlalu luas dari dua contoh.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Dua pengalaman tidak cukup untuk menyimpulkan kualitas seluruh startup lokal.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Aplikasi lokal seharusnya dilarang.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Crash membuktikan perusahaan tidak kompeten.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "generalization"
    },
    {
      "id": "logic-05",
      "label": "Serangan Pribadi",
      "statement": "Usulan Rina tentang jadwal fleksibel tidak perlu dipertimbangkan karena dia sendiri sering terlambat.",
      "options": [
        {
          "id": "a",
          "text": "Riwayat Rina otomatis membatalkan argumennya.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Kebiasaan Rina dapat dibahas terpisah, tetapi tidak membuktikan usulannya salah.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Jadwal fleksibel pasti benar.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Orang terlambat tidak boleh memberi usulan.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "ad_hominem"
    },
    {
      "id": "logic-06",
      "label": "Bandwagon",
      "statement": "Semua orang di timeline saya membeli produk itu, jadi produknya pasti berkualitas tinggi.",
      "options": [
        {
          "id": "a",
          "text": "Popularitas adalah bukti kualitas.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Banyak orang membeli tidak otomatis membuktikan kualitas; perlu bukti tentang produknya.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Timeline selalu mewakili seluruh konsumen.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Produk populer tidak pernah buruk.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "bandwagon"
    },
    {
      "id": "logic-07",
      "label": "Post Hoc",
      "statement": "Setelah kantor mengganti logo, penjualan naik. Logo baru jelas menyebabkan kenaikan penjualan.",
      "options": [
        {
          "id": "a",
          "text": "Urutan waktu saja cukup membuktikan sebab.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Kenaikan terjadi setelah pergantian logo, tetapi faktor lain perlu diperiksa sebelum menyimpulkan sebab.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Logo tidak pernah memengaruhi penjualan.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Penjualan naik berarti desainnya bagus.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "post_hoc"
    },
    {
      "id": "logic-08",
      "label": "Cherry Picking",
      "statement": "Brand menampilkan tiga ulasan bintang lima dan menyimpulkan semua pelanggan puas, tanpa menyebut ratusan ulasan lain.",
      "options": [
        {
          "id": "a",
          "text": "Tiga ulasan terbaik cukup mewakili semuanya.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Kesimpulan mengabaikan data lain yang relevan; keseluruhan distribusi ulasan perlu dilihat.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Ulasan positif selalu palsu.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Semua pelanggan sebenarnya tidak puas.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "cherry_pick"
    },
    {
      "id": "logic-09",
      "label": "Appeal to Authority",
      "statement": "Seorang aktor terkenal mengatakan suplemen X meningkatkan fokus, jadi klaim itu pasti benar.",
      "options": [
        {
          "id": "a",
          "text": "Ketenaran membuat klaim menjadi bukti.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Pendapat figur terkenal bukan pengganti bukti yang relevan, terutama di luar keahliannya.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Aktor selalu salah tentang kesehatan.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Suplemen pasti tidak bekerja.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "authority"
    },
    {
      "id": "logic-10",
      "label": "Slippery Slope",
      "statement": "Kalau sekali saja mengizinkan kerja dari rumah, sebentar lagi kantor akan kosong dan perusahaan pasti runtuh.",
      "options": [
        {
          "id": "a",
          "text": "Satu perubahan pasti berakhir pada hasil ekstrem.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Rangkaian akibat itu perlu bukti; satu kebijakan tidak otomatis menghasilkan seluruh konsekuensi tersebut.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Kerja dari rumah tidak punya risiko.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Perusahaan yang punya kantor pasti aman.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "slippery"
    },
    {
      "id": "logic-11",
      "label": "Survivorship Bias",
      "statement": "Kita hanya perlu meniru pengusaha sukses yang putus kuliah. Mereka membuktikan kuliah tidak penting.",
      "options": [
        {
          "id": "a",
          "text": "Kasus sukses yang terlihat mewakili semua orang yang mengambil jalan sama.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Kesimpulan mengabaikan orang dengan pilihan serupa yang tidak mencapai hasil yang sama.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Kuliah selalu menjamin sukses.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Semua pengusaha sukses putus kuliah.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "survivorship"
    },
    {
      "id": "logic-12",
      "label": "Anekdot",
      "statement": "Teman saya tidur empat jam tiap malam dan tetap produktif, berarti empat jam tidur cukup untuk semua orang.",
      "options": [
        {
          "id": "a",
          "text": "Pengalaman satu orang berlaku universal.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Satu pengalaman pribadi tidak cukup untuk menetapkan kebutuhan tidur semua orang.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Teman itu pasti berbohong.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Tidur tidak berhubungan dengan produktivitas.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "anecdote"
    },
    {
      "id": "logic-13",
      "label": "Circular Reasoning",
      "statement": "Artikel ini dapat dipercaya karena ditulis oleh sumber terpercaya. Kita tahu sumbernya terpercaya karena artikelnya dapat dipercaya.",
      "options": [
        {
          "id": "a",
          "text": "Kesimpulan dipakai untuk membuktikan premisnya sendiri.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Alasannya berputar; dibutuhkan dasar independen untuk menilai kredibilitas sumber.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Artikel pasti salah.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Semua sumber harus dipercaya.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "circular"
    },
    {
      "id": "logic-14",
      "label": "Straw Man",
      "statement": "Dani mengusulkan mengurangi rapat mingguan. Responsnya: 'Dani ingin tim berhenti berkomunikasi.'",
      "options": [
        {
          "id": "a",
          "text": "Usulan Dani telah diringkas secara akurat.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Respons mengubah usulan mengurangi rapat menjadi menghentikan komunikasi, lalu menyerang versi yang lebih ekstrem itu.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Semua rapat tidak berguna.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Komunikasi hanya bisa dilakukan lewat rapat.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "strawman"
    },
    {
      "id": "logic-15",
      "label": "Base Rate",
      "statement": "Tes mendeteksi kondisi langka dengan akurasi tinggi. Seseorang positif lalu langsung menyimpulkan peluang ia memiliki kondisi itu hampir 100%.",
      "options": [
        {
          "id": "a",
          "text": "Akurasi tes sama dengan probabilitas setelah hasil positif.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Untuk kondisi langka, tingkat kejadian dasar juga perlu dipertimbangkan sebelum menafsirkan hasil positif.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Tes akurat tidak berguna.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Hasil positif selalu salah.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "base_rate"
    },
    {
      "id": "logic-16",
      "label": "Confounding",
      "statement": "Kota dengan lebih banyak toko es krim juga mencatat lebih banyak kasus sengatan matahari. Jadi toko es krim menyebabkan sengatan matahari.",
      "options": [
        {
          "id": "a",
          "text": "Dua variabel bergerak bersama berarti salah satunya penyebab.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Faktor ketiga seperti cuaca panas dapat meningkatkan pembelian es krim sekaligus paparan matahari.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Es krim mencegah sengatan.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Toko harus ditutup.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "confound"
    },
    {
      "id": "logic-17",
      "label": "Loaded Question",
      "statement": "Apakah Anda sudah berhenti mengabaikan pelanggan yang komplain?",
      "options": [
        {
          "id": "a",
          "text": "Pertanyaan netral karena hanya meminta jawaban ya atau tidak.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Pertanyaan sudah mengasumsikan bahwa orang tersebut sebelumnya mengabaikan pelanggan.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Semua pertanyaan ya/tidak manipulatif.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Pelanggan pasti diabaikan.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "loaded"
    },
    {
      "id": "logic-18",
      "label": "Appeal to Emotion",
      "statement": "Iklan berkata, 'Kalau Anda benar-benar menyayangi keluarga, Anda pasti membeli produk ini.'",
      "options": [
        {
          "id": "a",
          "text": "Rasa sayang membuktikan kualitas produk.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Pesan menekan emosi sebagai alasan membeli tanpa menunjukkan bahwa produk memang memenuhi klaimnya.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Produk keluarga selalu buruk.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Emosi tidak boleh dipakai dalam komunikasi.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "emotion"
    },
    {
      "id": "logic-19",
      "label": "False Equivalence",
      "statement": "Dua artikel sama-sama memiliki satu typo, jadi keduanya sama buruk meskipun salah satunya juga memuat data palsu.",
      "options": [
        {
          "id": "a",
          "text": "Setiap kesalahan punya bobot yang sama.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Kesalahan kecil dan pemalsuan data berbeda tingkat serta dampaknya; menyamakannya menghapus perbedaan penting.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Typo tidak pernah penting.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Data palsu sama dengan typo.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "equivalence"
    },
    {
      "id": "logic-20",
      "label": "Moving Goalposts",
      "statement": "Setelah bukti A diberikan, seseorang meminta bukti B. Setelah B diberikan, ia berkata baru akan percaya jika ada C, tanpa alasan mengapa standar berubah.",
      "options": [
        {
          "id": "a",
          "text": "Standar bukti boleh berubah tanpa penjelasan.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Kriteria penerimaan terus dipindahkan setelah syarat sebelumnya terpenuhi.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Semua permintaan bukti tambahan salah.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Bukti pertama selalu cukup.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "goalposts"
    },
    {
      "id": "logic-21",
      "label": "Selection Bias",
      "statement": "Survei kepuasan hanya dikirim kepada pengguna yang baru memberi rating lima bintang.",
      "options": [
        {
          "id": "a",
          "text": "Sampel dipilih dengan cara yang cenderung menghasilkan jawaban positif.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Hasil survei berisiko bias karena kesempatan ikut tidak diberikan secara seimbang kepada populasi pengguna.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Pengguna bintang lima tidak boleh disurvei.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Semua survei kepuasan bias.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "selection"
    },
    {
      "id": "logic-22",
      "label": "Appeal to Tradition",
      "statement": "Kita harus mempertahankan proses ini karena sudah dilakukan dengan cara yang sama selama dua puluh tahun.",
      "options": [
        {
          "id": "a",
          "text": "Lama digunakan berarti paling efektif.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Usia sebuah praktik tidak membuktikan efektivitasnya; hasil dan alternatif tetap perlu dievaluasi.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Tradisi selalu buruk.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Semua proses lama harus diganti.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "tradition"
    },
    {
      "id": "logic-23",
      "label": "No True Scotsman",
      "statement": "Tidak ada penulis sungguhan yang memakai AI. Kalau ada penulis yang memakai AI, berarti dia bukan penulis sungguhan.",
      "options": [
        {
          "id": "a",
          "text": "Definisi kelompok diubah untuk mengeluarkan contoh yang menentang klaim.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Klaim melindungi dirinya sendiri dengan mendefinisikan ulang siapa yang boleh disebut penulis.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "AI selalu membuat tulisan buruk.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Penulis sungguhan harus menulis tangan.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "scotsman"
    },
    {
      "id": "logic-24",
      "label": "Hasty Causation",
      "statement": "Engagement turun pada minggu ketika tim mengubah warna tombol. Berarti warna tombol adalah penyebabnya.",
      "options": [
        {
          "id": "a",
          "text": "Satu perubahan bersamaan cukup menetapkan penyebab.",
          "logic": 18,
          "evidence": 16,
          "precision": 16
        },
        {
          "id": "b",
          "text": "Perubahan warna mungkin relevan, tetapi data lain dan eksperimen diperlukan sebelum menetapkan sebab.",
          "logic": 40,
          "evidence": 35,
          "precision": 25
        },
        {
          "id": "c",
          "text": "Warna tidak pernah memengaruhi engagement.",
          "logic": 14,
          "evidence": 15,
          "precision": 15
        },
        {
          "id": "d",
          "text": "Engagement hanya dipengaruhi desain.",
          "logic": 12,
          "evidence": 13,
          "precision": 15
        }
      ],
      "concept": "causation"
    }
  ]
};

const emptyMiniGameSlot = (position = 2, existing = {}) => ({
  ...existing,
  id: existing.id || `game-slot-${Date.now()}-${position}`,
  enabled: existing.enabled ?? true,
  showInLibrary: existing.showInLibrary ?? false,
  illustration: existing.illustration || '',
  menuLabel: existing.menuLabel || '',
  libraryTitle: existing.libraryTitle || '',
  libraryDescription: existing.libraryDescription || '',
  gameType: existing.gameType || (String(existing.gameName || existing.name || '').trim().toLowerCase() === 'the hangman' ? 'hangman' : String(existing.gameName || existing.name || '').trim().toLowerCase() === 'plagiarism police' ? 'plagiarismPolice' : 'generic'),
  gameName: existing.gameName || existing.name || `Game ${position}`,
  gameCategory: existing.gameCategory || '',
  gameCardDescription: existing.gameCardDescription || '',
  title: existing.title || '',
  objective: existing.objective || '',
  rules: Array.isArray(existing.rules) ? [...existing.rules] : { click: '', timer: '', wrong: '', hint: '', review: '', ...(existing.rules || {}) },
  startButtonLabel: existing.startButtonLabel || '',
  secondsPerDraft: Number(existing.secondsPerDraft) || 60,
  draftsPerSession: Number(existing.draftsPerSession) || 5,
  scoreSettings: { correctPoints: 0, wrongPenalty: 0, completionBonus: 0, maxTimeBonus: 0, hintPenalty: 0, ...(existing.scoreSettings || {}) },
  gradeTitles: Array.isArray(existing.gradeTitles) && existing.gradeTitles.length
    ? existing.gradeTitles
    : [{ min: 90, label: '' }, { min: 75, label: '' }, { min: 55, label: '' }, { min: 0, label: '' }],
  resultEyebrow: existing.resultEyebrow || '',
  replayLabel: existing.replayLabel || '',
  hangmanLeaderboardLabel: existing.hangmanLeaderboardLabel || '',
  hangmanDeathMessage: existing.hangmanDeathMessage || '',
  hangmanTimeoutMessage: existing.hangmanTimeoutMessage || '',
  hangmanPodiumFirst: existing.hangmanPodiumFirst || '',
  hangmanPodiumSecond: existing.hangmanPodiumSecond || '',
  hangmanPodiumThird: existing.hangmanPodiumThird || '',
  hangmanRankPrefix: existing.hangmanRankPrefix || '',
  hangmanRankPlayersSuffix: existing.hangmanRankPlayersSuffix || '',
  hangmanSolvedLabel: existing.hangmanSolvedLabel || '',
  hangmanAccuracyLabel: existing.hangmanAccuracyLabel || '',
  hangmanWrongLettersLabel: existing.hangmanWrongLettersLabel || '',
  hangmanNamePrompt: existing.hangmanNamePrompt || '',
  hangmanNamePlaceholder: existing.hangmanNamePlaceholder || '',
  hangmanSaveScoreLabel: existing.hangmanSaveScoreLabel || '',
  hangmanSavingLabel: existing.hangmanSavingLabel || '',
  hangmanYourRankLabel: existing.hangmanYourRankLabel || '',
  hangmanBestScoreLabel: existing.hangmanBestScoreLabel || '',
  hangmanLeaderboardTitle: existing.hangmanLeaderboardTitle || '',
  hangmanLeaderboardCloseLabel: existing.hangmanLeaderboardCloseLabel || '',
  hangmanLeaderboardEmptyLabel: existing.hangmanLeaderboardEmptyLabel || '',
  hangmanYouLabel: existing.hangmanYouLabel || '',
  hangmanClueLabel: existing.hangmanClueLabel || '',
  hangmanChooseLetterLabel: existing.hangmanChooseLetterLabel || '',
  hangmanRemainingLabel: existing.hangmanRemainingLabel || '',
  hangmanWordCompleteLabel: existing.hangmanWordCompleteLabel || '',
  hangmanDeathRevealLabel: existing.hangmanDeathRevealLabel || '',
  hangmanSafeMessage: existing.hangmanSafeMessage || '',
  hangmanAnswerPrefix: existing.hangmanAnswerPrefix || '',
  hangmanNextWordLabel: existing.hangmanNextWordLabel || '',
  hangmanSeeResultLabel: existing.hangmanSeeResultLabel || '',
  projectsCtaLabel: existing.projectsCtaLabel || '',
  contactCtaLabel: existing.contactCtaLabel || '',
  drafts: Array.isArray(existing.drafts) ? existing.drafts.map((draft) => ({ ...draft, issues: Array.isArray(draft?.issues) ? draft.issues : [] })) : [],
  cases: Array.isArray(existing.cases) ? [...existing.cases] : [],
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
  gameSlots: (() => {
    const slots = Array.isArray(raw?.gameSlots) ? raw.gameSlots.map((slot, index) => {
      const type = slot?.gameType || '';
      const name = String(slot?.gameName || '').trim().toLowerCase();
      const base =
        type === 'hangman' || name === 'the hangman' ? HANGMAN_PRESET :
        type === 'plagiarismPolice' || name === 'plagiarism police' ? PLAGIARISM_POLICE_PRESET :
        type === 'headlineHook' || name === 'headline hook' ? HEADLINE_HOOK_CMS_PRESET :
        type === 'toneSwitcher' || name === 'tone switcher' ? TONE_SWITCHER_CMS_PRESET :
        type === 'logicalLeap' || name === 'the logical leap' ? LOGICAL_LEAP_CMS_PRESET :
        {};
      return emptyMiniGameSlot(index + 2, { ...base, ...slot, id: slot.id, illustration: slot.illustration || '' });
    }) : [];
    const ensureSlot = (preset) => {
      if (!slots.some((slot) => slot.gameType === preset.gameType)) {
        slots.push(emptyMiniGameSlot(slots.length + 2, preset));
      }
    };
    ensureSlot({ ...PLAGIARISM_POLICE_PRESET, id: 'plagiarism-police' });
    ensureSlot(HEADLINE_HOOK_CMS_PRESET);
    ensureSlot(TONE_SWITCHER_CMS_PRESET);
    ensureSlot(LOGICAL_LEAP_CMS_PRESET);
    return slots;
  })(),
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

const isBlankMiniGameIssue = (issue) =>
  !String(issue?.phrase || '').trim() &&
  !String(issue?.replacement || '').trim() &&
  !String(issue?.explanation || '').trim();

const redPenDraftErrors = (draft) => {
  const issues = Array.isArray(draft?.issues) ? draft.issues : [];
  const meaningfulIssues = issues.filter((issue) => !isBlankMiniGameIssue(issue));

  return meaningfulIssues.flatMap((issue, issueIndex) => {
    const phrase = String(issue?.phrase || '').trim();
    if (!phrase) return [`Koreksi ${issueIndex + 1}: frasa bermasalah masih kosong.`];
    const count = phraseOccurrences(draft?.passage || '', phrase);
    if (count === 0) return [`Koreksi ${issueIndex + 1}: frasa “${phrase}” tidak ditemukan persis di paragraf.`];
    if (count > 1) return [`Koreksi ${issueIndex + 1}: frasa “${phrase}” muncul ${count} kali. Buat frasanya lebih spesifik.`];
    if (!String(issue?.replacement || '').trim()) return [`Koreksi ${issueIndex + 1}: pengganti/kata “hapus” belum diisi.`];
    return [];
  }).concat(
    !String(draft?.passage || '').trim() ? ['Paragraf masih kosong.'] : [],
    !meaningfulIssues.length && String(draft?.passage || '').trim() ? [] : []
  );
};

const hangmanWordErrors = (draft) => {
  const errors = [];
  if (!String(draft?.label || '').trim()) errors.push('Kata masih kosong.');
  if (!String(draft?.passage || '').trim()) errors.push('Instructions masih kosong.');
  return errors;
};

const plagiarismPoliceCaseErrors = (c) => {
  const errors = [];
  if (!String(c?.label || '').trim()) errors.push('Label kasus masih kosong.');
  if (!String(c?.source || '').trim()) errors.push('Sumber asli masih kosong.');
  if (!String(c?.writerText || '').trim()) errors.push('Teks penulis masih kosong.');
  const allowed = new Set(['original', 'ethical', 'close', 'plagiarism']);
  if (!c?.correctVerdict || !allowed.has(c.correctVerdict)) errors.push('Putusan yang benar belum dipilih.');
  if (!String(c?.report || '').trim()) errors.push('Laporan investigasi / analisis masih kosong.');
  return errors;
};

const miniGameContentErrors = (game, draft) => {
  const isHangman = game?.gameType === 'hangman' || String(game?.gameName || '').trim().toLowerCase() === 'the hangman';
  if (isHangman) return hangmanWordErrors(draft);
  if (game?.gameType === 'plagiarismPolice') return [];
  return redPenDraftErrors(draft);
};

const DEFAULT_BITS_AND_PIECES = {
  title: 'Bits & Pieces',
  intro: '',
  items: [],
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
  bitsAndPieces: {
    ...DEFAULT_BITS_AND_PIECES,
    ...(raw?.bitsAndPieces || {}),
    items: Array.isArray(raw?.bitsAndPieces?.items) ? raw.bitsAndPieces.items : DEFAULT_BITS_AND_PIECES.items,
  },
  listeningFootnote: {
    ...DEFAULT_LISTENING_FOOTNOTE,
    ...(raw?.listeningFootnote || {}),
  },
});

const DEFAULT_CONTACT = {
  heading: 'Every collaboration begins with an unfinished sentence.',
  subheading: "Tell me what you're trying to make. We can revise the rest together.",
  formTitle: 'Untitled Collaboration',
  propertiesTitle: 'Document Properties',
  email: '', location: 'Batam, Indonesia',
  draftButtonLabel: 'Create Email Draft',
  responseNote: 'Draft created — review before sending.',
  nameLabel: 'My name is',
  emailLabel: 'Reply to',
  messagePromptLabel: 'Here is what you should know',
  attachmentNote: 'Drive, Dropbox, portfolio, atau referensi lain.',
  otherChannelLabel: 'Prefer another channel?',
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

// Category Career SEKARANG bebas ditambah/dihapus/diubah namanya lewat CMS (gak lagi
// di-hardcode Professional/School/College). Tiap kategori punya `type`:
//  - 'career': format lama — Position @ Instansi, periode, pop-up detail instansi.
//  - 'credential': format baru — nama pencapaian/sertifikat, penyelenggara, tanggal,
//    gambar bukti, link verifikasi (buat Achievements/Certificates/dll).
const CAREER_TYPE_LABEL = {
  career: 'Riwayat (Position @ Instansi)',
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
      heading: careerData.heading ?? '',
      subheading: careerData.subheading ?? '',
      archiveTitle: careerData.archiveTitle || '',
      archiveIntro: careerData.archiveIntro || '',
      archiveButtonLabel: careerData.archiveButtonLabel || '',
      credentialsButtonLabel: careerData.credentialsButtonLabel || '',
      entriesLabel: careerData.entriesLabel ?? '',
      periodLabel: careerData.periodLabel ?? '',
      attachmentsLabel: careerData.attachmentsLabel ?? '',
      credentialsHeading: careerData.credentialsHeading ?? '',
      credentialsSubheading: careerData.credentialsSubheading ?? '',
      credentialsBackLabel: careerData.credentialsBackLabel ?? '',
      backLabel: careerData.backLabel ?? '',
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
    heading: careerData.heading ?? '',
    subheading: careerData.subheading ?? '',
    archiveTitle: careerData.archiveTitle || '',
    archiveIntro: careerData.archiveIntro || '',
    archiveButtonLabel: careerData.archiveButtonLabel || '',
    credentialsButtonLabel: careerData.credentialsButtonLabel || '',
    entriesLabel: careerData.entriesLabel ?? '',
    periodLabel: careerData.periodLabel ?? '',
    attachmentsLabel: careerData.attachmentsLabel ?? '',
    credentialsHeading: careerData.credentialsHeading ?? '',
    credentialsSubheading: careerData.credentialsSubheading ?? '',
    credentialsBackLabel: careerData.credentialsBackLabel ?? '',
    backLabel: careerData.backLabel ?? '',
    categories: professionalFirst([
      legacyToCategory(careerData.professional, 'professional', 'Professional'),
      legacyToCategory(careerData.college, 'college', 'College'),
    ]),
  };
}

// Sama kayak career: jaga-jaga data books di Supabase masih array polos yang lama,
// padahal format baru butuh { heading, subheading, items }.
function normalizeBooksData(raw) {
  if (Array.isArray(raw)) return { heading: '', subheading: '', worksTabLabel: 'My Books', readingTabLabel: 'Books I Read', backLabel: 'Back', items: raw, readingItems: [] };
  if (raw && typeof raw === 'object') {
    return {
      heading: raw.heading ?? '',
      subheading: raw.subheading ?? '',
      worksTabLabel: raw.worksTabLabel === undefined ? 'My Books' : raw.worksTabLabel,
      readingTabLabel: raw.readingTabLabel === undefined ? 'Books I Read' : raw.readingTabLabel,
      backLabel: raw.backLabel === undefined ? 'Back' : raw.backLabel,
      items: Array.isArray(raw.items) ? raw.items : [],
      readingItems: Array.isArray(raw.readingItems) ? raw.readingItems : [],
    };
  }
  return { heading: '', subheading: '', worksTabLabel: 'My Books', readingTabLabel: 'Books I Read', backLabel: 'Back', items: [], readingItems: [] };
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


const emptyReadingBook = () => ({ ...emptyBook(), id: `reading-${Date.now()}`, author: '' });

const emptyArticle = () => ({
  id: `art-${Date.now()}`,
  title: '',
  date: '',
  category: '',
  author: '',
  snippet: '',
  content: '',
  image: '',
  coverImage: '',
  hintEnabled: true,
});

const emptyPosterItem = () => ({
  id: `poster-item-${Date.now()}`,
  title: '',
  category: '',
  dimensions: '',
  imageUrl: '',
  coverImage: '',
  description: '',
  hintEnabled: true,
});

const emptyDirectingItem = () => ({
  id: `film-${Date.now()}`,
  title: '', premise: '', role: 'Director', year: '', runtime: '',
  mediaType: 'youtube', mediaUrl: '', posterImage: '', coverImage: '', videoRatio: 'auto', videoSnippets: [],
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
  coverImage: '',
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
  description: '',
  contentType: 'writing',
  // 'gallery' = grid foto (perilaku lama/default, buat poster/dokumentasi visual).
  // 'articles' = tampilan gaya portal berita kayak tab Articles (kartu unggulan besar +
  // daftar kecil), buat tab tambahan yang konteksnya tulisan (esai, cerpen, dll).
  layout: 'gallery',
  items: [],
});

// Jaga-jaga: data projects di Supabase bisa aja masih format lama:
//  - projects.posters: array polos (format paling lama)
//  - projects.gallery: { poster: [...], photo: [...] } (format senone yet Sub Bab)
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
    heading: projects.heading ?? '',
    subheading: projects.subheading ?? '',
    indexHeading: projects.indexHeading ?? '',
    indexDescription: projects.indexDescription ?? '',
    searchLabel: projects.searchLabel ?? '',
    backLabel: projects.backLabel ?? '',
    openDrawerLabel: projects.openDrawerLabel ?? '',
    articlesDescription: projects.articlesDescription ?? '',
    directingDescription: projects.directingDescription ?? '',
    posterDescription: projects.posterDescription ?? '',
    // Label tab navigasi buat Articles & Poster — kosong berarti pakai default
    // ('Articles'/'Poster') di halaman publik.
    articlesLabel: projects.articlesLabel || '',
    directingLabel: projects.directingLabel || '',
    posterLabel: projects.posterLabel || '',
    articlesDeleted: projects.articlesDeleted === true,
    directingDeleted: projects.directingDeleted === true,
    posterDeleted: projects.posterDeleted === true,
    articles: articles.map((art) => ({ ...emptyArticle(), ...art })),
    directing: {
      items: Array.isArray(projects.directing?.items)
        ? projects.directing.items.map((it) => ({ ...emptyDirectingItem(), ...it }))
        : [],
    },
    poster: {
      items: items.map((it) => ({ ...emptyPosterItem(), ...it })),
    },
    // Tab tambahan bebas (di luar Articles & Poster) — kalau data lama belum punya
    // field ini sama sekali, defaultnya array kosong (bukan ilang pas disave ulang).
    customSections: Array.isArray(projects.customSections)
      ? projects.customSections.map((s) => ({
          id: s.id || emptyCustomSection().id,
          label: s.label || '',
          description: s.description ?? '',
          contentType: ['writing', 'video', 'image', 'document', 'link', 'audio'].includes(s.contentType)
            ? s.contentType
            : (s.layout === 'articles' ? 'writing' : 'image'),
          layout: s.layout === 'articles' ? 'articles' : 'gallery',
          items: Array.isArray(s.items)
            ? s.items.map((it) => ({ ...emptyCustomItem(), ...it }))
            : [],
        }))
      : [],
  };
}

/* Input & textarea kecil biar gak nulis className berulang-ulang */
function Field({ label, children, sourceValue, cmsLanguage = 'id', translatable = true }) {
  const sourceText = typeof sourceValue === 'string' ? sourceValue : '';
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {cmsLanguage === 'en' && translatable && sourceText.trim() && (
        <div
          data-id-source-reference="true"
          className="mb-1 rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-1 font-[Arial] text-[10px] leading-relaxed text-gray-500 dark:border-gray-700 dark:bg-[#252525] dark:text-gray-400"
        >
          ID · {sourceText}
        </div>
      )}
      {children}
    </div>
  );
}
const inputCls = "w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded";
const inputClsSm = "w-full px-3 py-1.5 text-xs bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded";

function ImageUploadNote({ profile = 'default' }) {
  const notes = {
    default: 'automatic WebP · max. side 1600 px · target ≤ 700 KB',
    article: 'Article image · automatic WebP · max. side 1600 px · target ≤ 500 KB',
    poster: 'Poster/karya visual · automatic WebP · maks. sisi 2000 px · target ≤ 700 KB',
    video: 'Thumbnail video · automatic WebP · max. side 1600 px · target ≤ 500 KB',
    book: 'Cover/gambar buku · automatic WebP · max. side 1600 px · target ≤ 500 KB',
    profile: 'Foto profil · automatic WebP · maks. sisi 1200 px · target ≤ 300 KB',
  };
  return (
    <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 font-[Arial] text-[10px] leading-relaxed text-gray-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-gray-400">
      <span className="font-bold text-blue-700 dark:text-blue-300">IMAGE GUARD · </span>
      {notes[profile] || notes.default}
      <span className="block mt-0.5">Large files will be resized and compressed before upload to keep the website lightweight.</span>
    </div>
  );
}

function ImageDropzone({
  value = '',
  onChange,
  profile = 'default',
  disabled = false,
  label = 'Drop image here or click to browse',
}) {
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef(null);

  const handleFile = async (file) => {
    if (!file || disabled || uploading) return;
    if (!file.type?.startsWith('image/')) {
      dispatchCmsNotice('The file must be an image.');
      return;
    }
    setUploading(true);
    const url = await uploadImageToStorage(file, profile);
    setUploading(false);
    if (url) onChange?.(url);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          await handleFile(file);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          await handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`w-full min-h-[86px] rounded-lg border border-dashed px-4 py-3 text-left transition ${
          dragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-gray-300 bg-gray-50/60 hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-[#1e1e1e] dark:hover:border-blue-700'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <div className="flex items-center gap-3">
          {value ? (
            <img src={value} alt="" className="h-14 w-20 shrink-0 rounded-md border border-gray-200 object-cover dark:border-gray-700" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-lg dark:border-gray-700 dark:bg-[#242424]">
              ▧
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
              {uploading ? 'Uploading & optimizing…' : value ? 'Drop foto baru atau klik untuk replace' : label}
            </p>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              JPG, PNG, WebP · drag & drop or browse
            </p>
          </div>
        </div>
      </button>

      {value && (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[10px] text-gray-400">{value}</p>
          <button
            type="button"
            onClick={() => onChange?.('')}
            className="shrink-0 text-[10px] font-semibold text-red-500 hover:underline"
          >
            Remove
          </button>
        </div>
      )}

      <ImageUploadNote profile={profile} />
    </div>
  );
}

function GalleryDropzone({ items = [], onChange, profile = 'poster', disabled = false }) {
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef(null);
  const safeItems = Array.isArray(items) ? items : [];

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file?.type?.startsWith('image/'));
    if (!files.length || disabled || uploading) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const url = await uploadImageToStorage(file, profile);
        if (url) uploaded.push(url);
      }
      if (uploaded.length) onChange?.([...safeItems, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const moveItem = (from, to) => {
    if (to < 0 || to >= safeItems.length) return;
    const next = [...safeItems];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    onChange?.(next);
  };

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" disabled={disabled || uploading}
        onChange={async (e) => { await handleFiles(e.target.files); e.target.value = ''; }} />
      <button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={async (e) => { e.preventDefault(); setDragging(false); await handleFiles(e.dataTransfer.files); }}
        className={`w-full min-h-[110px] rounded-xl border-2 border-dashed px-5 py-4 text-center transition ${dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-300 bg-gray-50/60 hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-700 dark:bg-[#1e1e1e]'} disabled:cursor-not-allowed disabled:opacity-60`}>
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-sm text-blue-600 dark:border-gray-700 dark:bg-[#242424]">▦</div>
        <p className="font-[Arial] text-[10px] font-bold uppercase tracking-[0.12em] text-gray-700 dark:text-gray-200">{uploading ? 'Uploading & optimizing…' : 'Drop images here or click to browse'}</p>
        <p className="mt-1 text-[9px] text-gray-400">Select multiple JPG, PNG, or WebP files · drag & drop or browse</p>
      </button>
      {!!safeItems.length && <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {safeItems.map((url, imageIdx) => <div key={`${url}-${imageIdx}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#242424]">
          <img src={url} alt="" className="h-28 w-full object-cover" />
          <div className="flex items-center justify-between gap-1 p-2">
            <div className="flex gap-1">
              <button type="button" disabled={imageIdx === 0} onClick={() => moveItem(imageIdx, imageIdx - 1)} className="rounded border px-2 py-1 text-[9px] disabled:opacity-30">←</button>
              <button type="button" disabled={imageIdx === safeItems.length - 1} onClick={() => moveItem(imageIdx, imageIdx + 1)} className="rounded border px-2 py-1 text-[9px] disabled:opacity-30">→</button>
            </div>
            <button type="button" onClick={() => onChange?.(safeItems.filter((_, i) => i !== imageIdx))} className="text-[9px] font-semibold text-red-500">Remove</button>
          </div>
        </div>)}
      </div>}
      <ImageUploadNote profile={profile} />
    </div>
  );
}

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
function RichTextEditor({ initialValue, onChange, placeholder, compact = false, fieldMode = false }) {
  const ref = useRef(null);
  const savedSelection = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const [linkUrl, setLinkUrl] = useState('');
  const [editorFont, setEditorFont] = useState('Georgia, serif');
  const [editorFontSize, setEditorFontSize] = useState('12pt');
  const [editorLineHeight, setEditorLineHeight] = useState('1.5');
  const [activeFormat, setActiveFormat] = useState({
    block: 'p', bold: false, italic: false, underline: false, strike: false,
  });

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialValue || '';
      ref.current.style.fontFamily = 'Georgia, serif';
      ref.current.style.fontSize = '12pt';
      ref.current.style.lineHeight = '1.5';
      historyRef.current = [ref.current.innerHTML];
      historyIndexRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncActiveFormat = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !ref.current?.contains(selection.anchorNode)) return;

    let node = selection.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node?.closest?.('p,h1,h2,h3,blockquote');
    const blockTag = block && ref.current.contains(block) ? block.tagName.toLowerCase() : 'p';

    setActiveFormat({
      block: ['p', 'h1', 'h2', 'h3', 'blockquote'].includes(blockTag) ? blockTag : 'p',
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
    });

    // Keep Font + Size honest: read the actual computed style at the caret.
    // This fixes the ribbon saying 12 pt while the selected text is visibly larger.
    const styleNode = node && ref.current.contains(node) ? node : ref.current;
    if (styleNode) {
      const computed = window.getComputedStyle(styleNode);
      const family = (computed.fontFamily || '').toLowerCase();
      if (family.includes('courier')) setEditorFont("'Courier New', Courier, monospace");
      else if (family.includes('garamond')) setEditorFont("Garamond, 'Times New Roman', serif");
      else if (family.includes('arial')) setEditorFont('Arial, sans-serif');
      else if (family.includes('times new roman')) setEditorFont("'Times New Roman', serif");
      else if (family.includes('georgia')) setEditorFont('Georgia, serif');
      else if (family.includes('monospace')) setEditorFont('monospace');

      const px = parseFloat(computed.fontSize || '');
      if (Number.isFinite(px)) {
        const pt = Math.round(px * 72 / 96);
        if (pt >= 8 && pt <= 20) setEditorFontSize(`${pt}pt`);
      }
    }
  };

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && ref.current?.contains(selection.anchorNode)) {
      savedSelection.current = selection.getRangeAt(0).cloneRange();
      syncActiveFormat();
    }
  };

  const restoreSelection = () => {
    if (!savedSelection.current) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(savedSelection.current);
  };

  const pushHistory = (html = ref.current?.innerHTML || '') => {
    const current = historyRef.current[historyIndexRef.current];
    if (current === html) return;
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(html);
    if (historyRef.current.length > 100) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
  };

  const restoreHistory = (direction) => {
    const next = historyIndexRef.current + direction;
    if (next < 0 || next >= historyRef.current.length || !ref.current) return;
    historyIndexRef.current = next;
    ref.current.innerHTML = historyRef.current[next];
    onChange(ref.current.innerHTML);
    ref.current.focus();
    savedSelection.current = null;
    syncActiveFormat();
  };

  const exec = (command, arg = null) => {
    restoreSelection();
    document.execCommand(command, false, arg);
    ref.current?.focus();
    rememberSelection();
    onChange(ref.current.innerHTML);
    pushHistory();
  };

  const applyBlockFormat = (tagName) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount || !ref.current?.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    const normalizedTag = String(tagName || 'p').toLowerCase();
    const allowedTags = new Set(['p', 'h1', 'h2', 'h3', 'blockquote']);
    const nextTag = allowedTags.has(normalizedTag) ? normalizedTag : 'p';

    // Native formatBlock is inconsistent across browsers when a selection spans
    // multiple paragraphs. Apply the requested block tag to every touched block
    // so the CMS never silently formats only the first/last line.
    const walker = document.createTreeWalker(
      ref.current,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (!['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE'].includes(node.tagName)) {
            return NodeFilter.FILTER_SKIP;
          }
          try {
            return range.intersectsNode(node)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          } catch {
            return NodeFilter.FILTER_REJECT;
          }
        },
      }
    );

    const touched = [];
    let node = walker.nextNode();
    while (node) {
      // Ignore a parent block when one of its direct/indirect block children is
      // also selected; this prevents nested replacements.
      if (!touched.some((existing) => existing.contains(node))) touched.push(node);
      node = walker.nextNode();
    }

    const deepest = touched.filter(
      (candidate) => !touched.some((other) => other !== candidate && candidate.contains(other))
    );

    if (deepest.length <= 1) {
      document.execCommand('formatBlock', false, nextTag);
    } else {
      deepest.forEach((block) => {
        if (block.tagName.toLowerCase() === nextTag) return;
        const replacement = document.createElement(nextTag);
        Array.from(block.attributes || []).forEach((attr) => {
          if (attr.name !== 'id') replacement.setAttribute(attr.name, attr.value);
        });
        while (block.firstChild) replacement.appendChild(block.firstChild);
        block.replaceWith(replacement);
      });
    }

    ref.current?.focus();
    rememberSelection();
    onChange(ref.current.innerHTML);
    pushHistory();
  };

  const handleListToggle = (listTag) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount || !ref.current) return;

    const range = selection.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;

    const wantedTag = listTag === 'ol' ? 'OL' : 'UL';
    let anchor = selection.anchorNode;
    if (anchor?.nodeType === Node.TEXT_NODE) anchor = anchor.parentElement;
    const currentList = anchor?.closest?.('ul,ol');

    // If the caret/selection is already inside the same list type, toggling the
    // button must return the touched list items to ordinary paragraphs. Doing
    // this ourselves avoids the browser leaving nested DIV/LI fragments behind.
    if (currentList && ref.current.contains(currentList) && currentList.tagName === wantedTag) {
      const fragment = document.createDocumentFragment();
      Array.from(currentList.children).forEach((child) => {
        if (child.tagName !== 'LI') return;
        const p = document.createElement('p');
        while (child.firstChild) p.appendChild(child.firstChild);
        fragment.appendChild(p);
      });
      currentList.replaceWith(fragment);
    } else if (currentList && ref.current.contains(currentList)) {
      // Switching bullet <-> numbered list keeps the exact LI contents and only
      // changes the list container.
      const replacement = document.createElement(listTag);
      Array.from(currentList.attributes || []).forEach((attr) => replacement.setAttribute(attr.name, attr.value));
      while (currentList.firstChild) replacement.appendChild(currentList.firstChild);
      currentList.replaceWith(replacement);
    } else {
      // Native insertion is reliable for creating a list from normal paragraphs;
      // normalization below removes browser-specific wrapper junk afterwards.
      document.execCommand(listTag === 'ol' ? 'insertOrderedList' : 'insertUnorderedList', false);
    }

    // Normalize only direct editor children. This prevents empty DIV/BR wrappers
    // produced by contentEditable from accumulating every time a list is toggled.
    Array.from(ref.current.children).forEach((child) => {
      if (child.tagName === 'DIV' && !child.querySelector('ul,ol')) {
        const p = document.createElement('p');
        while (child.firstChild) p.appendChild(child.firstChild);
        child.replaceWith(p);
      }
      if ((child.tagName === 'UL' || child.tagName === 'OL') && child.children.length === 0) {
        child.remove();
      }
    });

    ref.current.focus();
    savedSelection.current = null;
    onChange(ref.current.innerHTML);
    pushHistory();
    syncActiveFormat();
  };

  const handleLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    exec('createLink', url);
    setLinkUrl('');
  };

  const applyInlineStyle = (styleName, value) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !ref.current) return;
    const range = selection.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;

    // Browser editing commands handle selections that cross several inline nodes
    // much more safely than surroundContents/extractContents. styleWithCSS keeps
    // the result as inline CSS spans, which our public renderer already preserves.
    ref.current.focus();
    document.execCommand('styleWithCSS', false, true);
    if (styleName === 'fontFamily') {
      document.execCommand('fontName', false, value.split(',')[0].replace(/["']/g, '').trim());
    } else if (styleName === 'fontSize') {
      // Never wrap the whole Range in one span. A selection can cross paragraphs,
      // existing spans, italics, etc.; an outer span also loses against an old
      // inner font-size. Instead, style every selected TEXT slice directly.
      const selectedRange = range.cloneRange();
      const walker = document.createTreeWalker(
        ref.current,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(textNode) {
            if (!textNode.nodeValue) return NodeFilter.FILTER_REJECT;
            try {
              return selectedRange.intersectsNode(textNode)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
            } catch {
              return NodeFilter.FILTER_REJECT;
            }
          },
        }
      );

      const textNodes = [];
      let textNode = walker.nextNode();
      while (textNode) {
        textNodes.push(textNode);
        textNode = walker.nextNode();
      }

      textNodes.forEach((originalNode) => {
        if (!originalNode.parentNode) return;

        const start = originalNode === selectedRange.startContainer
          ? selectedRange.startOffset
          : 0;
        const end = originalNode === selectedRange.endContainer
          ? selectedRange.endOffset
          : originalNode.nodeValue.length;

        if (start >= end) return;

        // Split from the end first so offsets stay valid.
        let chosen = originalNode;
        if (end < chosen.nodeValue.length) chosen.splitText(end);
        if (start > 0) chosen = chosen.splitText(start);

        const span = document.createElement('span');
        span.style.fontSize = value;
        chosen.parentNode.insertBefore(span, chosen);
        span.appendChild(chosen);
      });

      // Important: old V15.9/V15.10 experiments may have left nested legacy
      // <font size="7"> or inline font-size wrappers. The new innermost spans
      // above intentionally override those artifacts without touching text
      // outside the user's selection.
      savedSelection.current = null;
      selection.removeAllRanges();
      ref.current.focus();
    }

    if (styleName !== 'fontSize') savedSelection.current = null;
    onChange(ref.current.innerHTML);
    pushHistory();
    syncActiveFormat();
  };

  const applyBlockStyle = (styleName, value) => {
    restoreSelection();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    let node = selection.anchorNode;
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const block = node?.closest?.('p,h1,h2,h3,blockquote,li,div');
    if (!block || !ref.current?.contains(block)) return;
    block.style[styleName] = value;
    ref.current?.focus();
    rememberSelection();
    onChange(ref.current.innerHTML);
    pushHistory();
  };

  // Document-level typography controls. These are intentionally different from
  // Bold/Italic/etc: Font, body size, and line spacing are writing-workspace
  // defaults, so changing them updates the whole Text block and keeps the
  // chosen values visible in the ribbon instead of snapping back to placeholders.
  const applyTypography = (styleName, value) => {
    restoreSelection();
    const selection = window.getSelection();
    const hasRange = selection?.rangeCount && !selection.isCollapsed && ref.current?.contains(selection.getRangeAt(0).commonAncestorContainer);

    if (hasRange) {
      applyInlineStyle(styleName, value);
      return;
    }

    // No text selection: set the typing style at the caret. Do NOT resize/re-font
    // the entire editor, because that is what made unrelated paragraphs change.
    if (!ref.current) return;
    ref.current.focus();
    document.execCommand('styleWithCSS', false, true);
    if (styleName === 'fontFamily') {
      document.execCommand('fontName', false, value.split(',')[0].replace(/["']/g, '').trim());
    } else if (styleName === 'fontSize') {
      // Font size is selection-based. With only a caret, do not mutate the
      // document or inject hidden browser font-size state.
      setEditorFontSize(value);
    }
    rememberSelection();
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-[#1e1e1e] overflow-visible">
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-0.5 rounded-t border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2d2d2d] px-1 py-1 shadow-sm">
        <select
          onMouseDown={(e) => { rememberSelection(); e.stopPropagation(); }}
          onChange={(e) => applyBlockFormat(e.target.value)}
          value={activeFormat.block}
          title="Text style — applies to every selected paragraph"
          className="mr-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]"
        >
          <option value="p">Normal</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option>
        </select>
        <span className={activeFormat.bold ? 'rounded bg-[#2B579A]/15 ring-1 ring-[#2B579A]/30 dark:bg-[#6FA8DC]/15' : ''}><ToolbarBtn onClick={() => exec('bold')} title="Bold"><span className="font-bold">B</span></ToolbarBtn></span>
        <span className={activeFormat.italic ? 'rounded bg-[#2B579A]/15 ring-1 ring-[#2B579A]/30 dark:bg-[#6FA8DC]/15' : ''}><ToolbarBtn onClick={() => exec('italic')} title="Italic"><span className="italic">I</span></ToolbarBtn></span>
        <span className={activeFormat.underline ? 'rounded bg-[#2B579A]/15 ring-1 ring-[#2B579A]/30 dark:bg-[#6FA8DC]/15' : ''}><ToolbarBtn onClick={() => exec('underline')} title="Underline"><span className="underline">U</span></ToolbarBtn></span>
        <span className={activeFormat.strike ? 'rounded bg-[#2B579A]/15 ring-1 ring-[#2B579A]/30 dark:bg-[#6FA8DC]/15' : ''}><ToolbarBtn onClick={() => exec('strikeThrough')} title="Strikethrough"><span className="line-through">S</span></ToolbarBtn></span>
        <select onMouseDown={(e) => { rememberSelection(); e.stopPropagation(); }} onChange={(e) => { const value = e.target.value; setEditorFont(value); applyTypography('fontFamily', value); }} value={editorFont} title="Font family — selected text / typing position" className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]">
          <option value="Georgia, serif">Georgia</option><option value="Garamond, 'Times New Roman', serif">Garamond</option><option value="Arial, sans-serif">Arial</option><option value="'Times New Roman', serif">Times New Roman</option><option value="'Courier New', Courier, monospace">Courier New</option><option value="monospace">Monospace</option>
        </select>
        <select onMouseDown={(e) => { rememberSelection(); e.stopPropagation(); }} onChange={(e) => { const value = e.target.value; setEditorFontSize(value); applyTypography('fontSize', value); }} value={editorFontSize} title="Font size — selected text / typing position (8–20 pt)" className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]">
          {Array.from({ length: 13 }, (_, index) => index + 8).map((size) => (
            <option key={size} value={`${size}pt`}>{size} pt</option>
          ))}
        </select>
        <select onMouseDown={(e) => { rememberSelection(); e.stopPropagation(); }} onChange={(e) => { const value = e.target.value; setEditorLineHeight(value); applyBlockStyle('lineHeight', value); }} value={editorLineHeight} title="Line spacing — whole Text block" className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]">
          <option value="1">1.0</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="2">2.0</option>
        </select>
        <select onMouseDown={(e) => { rememberSelection(); e.stopPropagation(); }} onChange={(e) => { if (e.target.value) applyBlockStyle('marginBottom', e.target.value); e.target.value = ''; }} defaultValue="" title="Spacing after paragraph" className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]">
          <option value="" disabled>Space</option><option value="0">0</option><option value="0.5em">S</option><option value="1em">M</option><option value="1.5em">L</option>
        </select>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarBtn onClick={() => handleListToggle('ul')} title="Bullet List">• List</ToolbarBtn>
        <ToolbarBtn onClick={() => handleListToggle('ol')} title="Numbered List">1. List</ToolbarBtn>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarBtn onClick={() => exec('justifyLeft')} title="Rata kiri">≡←</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyCenter')} title="Rata tengah">≡</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyRight')} title="Rata kanan">→≡</ToolbarBtn>
        <ToolbarBtn onClick={() => exec('justifyFull')} title="Justify">☰</ToolbarBtn>
        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
        <ToolbarBtn onClick={() => restoreHistory(-1)} title="Undo">↶</ToolbarBtn>
        <ToolbarBtn onClick={() => restoreHistory(1)} title="Redo">↷</ToolbarBtn>
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
        onFocus={syncActiveFormat}
        onInput={(e) => { onChange(e.currentTarget.innerHTML); pushHistory(e.currentTarget.innerHTML); syncActiveFormat(); }}
        data-placeholder={placeholder}
        className={`${fieldMode ? 'min-h-[96px] max-h-[320px] overflow-y-auto' : compact ? 'min-h-[260px] sm:min-h-[340px] max-h-[70vh] overflow-y-auto' : 'min-h-[260px] sm:min-h-[340px]'} overflow-x-auto px-4 py-4 text-[12pt] leading-[1.5] [font-family:Georgia,serif] focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 [&_h1]:my-4 [&_h1]:text-[16pt] [&_h1]:font-bold [&_h1]:leading-tight [&_h2]:my-3 [&_h2]:text-[14pt] [&_h2]:font-bold [&_h2]:leading-tight [&_h3]:my-2 [&_h3]:text-[12pt] [&_h3]:font-bold [&_h3]:leading-snug [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600 dark:[&_blockquote]:border-gray-600 dark:[&_blockquote]:text-gray-300`}
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
  writing: { text: '1600 × 1000 px (16:10) · WebP/JPG · ideal ≤ 350 KB · maksimal 700 KB', maxBytes: 700 * 1024, width: 1600, height: 1000 },
  video: { text: '1600 × 900 px (16:9) · WebP/JPG · ideal ≤ 350 KB · maksimal 700 KB', maxBytes: 700 * 1024, width: 1600, height: 900 },
  image: { text: 'Sisi panjang 1600 px, rasio asli · WebP/JPG · ideal ≤ 500 KB · maksimal 1 MB', maxBytes: 1024 * 1024 },
  document: { text: '1600 × 1000 px (16:10) · WebP/JPG · ideal ≤ 350 KB · maksimal 700 KB', maxBytes: 700 * 1024, width: 1600, height: 1000 },
  link: { text: '1600 × 1000 px (16:10) · WebP/JPG · ideal ≤ 350 KB · maksimal 700 KB', maxBytes: 700 * 1024, width: 1600, height: 1000 },
};

const getProjectCoverGuide = (contentType = 'writing') => PROJECT_COVER_GUIDES[contentType] || PROJECT_COVER_GUIDES.writing;

async function validateProjectCover(file, contentType = 'writing') {
  const guide = getProjectCoverGuide(contentType);
  if (!file || !['image/jpeg', 'image/webp'].includes(file.type)) {
    dispatchCmsNotice('Cover rejected. Projects accepts WebP or JPG only.');
    return false;
  }
  if (file.size > guide.maxBytes) {
    dispatchCmsNotice(`Cover ditolak karena terlalu berat. Patokan: ${guide.text}`);
    return false;
  }

  if (guide.width && guide.height) {
    const dimensions = await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      image.src = url;
    });
    if (!dimensions || dimensions.width !== guide.width || dimensions.height !== guide.height) {
      dispatchCmsNotice(`Cover rejected because its pixel dimensions do not match the guide. Reference: ${guide.text}`);
      return false;
    }
  }
  return true;
}

function ProjectCoverHint({ contentType = 'writing' }) {
  return <p className="mt-1 text-[10px] leading-relaxed text-gray-400">Cover: {getProjectCoverGuide(contentType).text}</p>;
}

function ProjectCoverControl({ item = {}, onChangeField, profile = 'article', contentType = 'writing' }) {
  const coverUrl = item.coverImage || '';
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">
          Carousel Cover Image (Optional)
        </p>
        {coverUrl && (
          <button
            type="button"
            onClick={() => onChangeField('coverImage', '')}
            className="rounded border border-red-200 px-2.5 py-1 font-[Arial] text-[10px] font-semibold text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
          >
            Clear Cover Image
          </button>
        )}
      </div>
      <p className="font-[Arial] text-[10px] leading-relaxed text-gray-400">
        Dedicated cover image used only as thumbnail/cover in carousels or work listings. Independent from written content and Reading Mode.
      </p>
      {coverUrl && (
        <div className="relative max-w-xs overflow-hidden rounded border border-gray-200 dark:border-gray-700">
          <img src={coverUrl} alt="Cover Preview" className="max-h-40 w-full object-cover" />
        </div>
      )}
      <ImageDropzone
        value={coverUrl}
        onChange={(url) => onChangeField('coverImage', url)}
        profile={profile}
        label="Drop carousel cover image here or click to browse"
      />
      <input
        value={coverUrl}
        onChange={(e) => onChangeField('coverImage', e.target.value)}
        placeholder="Or paste an explicit Cover Image URL"
        className={inputCls}
      />
    </div>
  );
}

const CMS_IMAGE_PROFILES = {
  default: { maxEdge: 1600, quality: 0.82, maxBytes: 700 * 1024 },
  article: { maxEdge: 1600, quality: 0.82, maxBytes: 500 * 1024 },
  poster: { maxEdge: 2000, quality: 0.90, maxBytes: 700 * 1024 },
  video: { maxEdge: 1600, quality: 0.82, maxBytes: 500 * 1024 },
  book: { maxEdge: 1600, quality: 0.86, maxBytes: 500 * 1024 },
  profile: { maxEdge: 1200, quality: 0.84, maxBytes: 300 * 1024 },
};

async function optimizeCmsImage(file, profileName = 'default') {
  if (!file?.type?.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

  const profile = CMS_IMAGE_PROFILES[profileName] || CMS_IMAGE_PROFILES.default;

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longestEdge > profile.maxEdge ? profile.maxEdge / longestEdge : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      bitmap.close?.();
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    let quality = profile.quality;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    while (blob && blob.size > profile.maxBytes && quality > 0.64) {
      quality = Math.max(0.64, quality - 0.06);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    }

    if (!blob) return file;
    if (blob.size > profile.maxBytes) {
      dispatchCmsNotice(`Image is still too large after optimization (${Math.round(blob.size / 1024)} KB). Crop or resize the source first.`);
      return null;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'image';
    return new File([blob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('Optimasi gambar dilewati; file asli tetap dipakai:', error);
    return file;
  }
}

async function uploadImageToStorage(file, profileName = 'default') {
  if (!file) return null;

  // Hanya display image yang dioptimalkan. PDF/DOC/DOCX/PPT dan file non-image
  // tetap lewat tanpa konversi; SVG/GIF dipertahankan agar vector/animasi tidak rusak.
  const uploadFile = await optimizeCmsImage(file, profileName);
  if (!uploadFile) return null;
  const fileExt = uploadFile.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(fileName, uploadFile, {
      contentType: uploadFile.type || undefined,
      cacheControl: '31536000',
    });

  if (error) {
    console.error('Gagal upload gambar:', error);
    dispatchCmsNotice('Image upload failed. Check your connection and try again.');
    return null;
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

async function uploadAudioToStorage(file) {
  if (!file) return null;

  const AUDIO_BUCKET = 'Audio';
  const maxBytes = 20 * 1024 * 1024;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const allowedExt = ['mp3', 'm4a', 'wav', 'ogg', 'aac'];

  if (!allowedExt.includes(ext)) {
    dispatchCmsNotice('Unsupported audio format. Use MP3, M4A, WAV, OGG, or AAC.');
    return null;
  }

  if (file.size > maxBytes) {
    dispatchCmsNotice('Audio terlalu besar. Maksimal 20 MB.');
    return null;
  }

  const fileName = `audio-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(fileName, file, {
      contentType: file.type || (ext === 'mp3' ? 'audio/mpeg' : undefined),
      cacheControl: '31536000',
    });

  if (error) {
    console.error('Gagal upload audio:', error);
    dispatchCmsNotice('Audio upload failed. Check your connection or try another file.');
    return null;
  }

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// Khusus Websikee!: pakai SATU path permanen supaya index.html GitHub Pages
// tidak perlu berubah setiap kali admin mengganti gambar share.
async function uploadWebsiteSharePreview(file) {
  if (!file) return null;

  const fixedPath = 'website/share-preview.jpg';

  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(fixedPath, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
      cacheControl: '60',
    });

  if (error) {
    console.error('Gagal memperbarui share preview:', error);
    dispatchCmsNotice('Share Preview could not be updated. The previous upload is still safe; check Supabase bucket UPDATE/UPSERT permissions.');
    return null;
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(fixedPath);
  return data.publicUrl;
}

async function uploadWebsiteFavicon(file) {
  if (!file) return null;

  const fixedPath = 'website/favicon.png';

  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(fixedPath, file, {
      upsert: true,
      contentType: file.type || 'image/png',
      cacheControl: '60',
    });

  if (error) {
    console.error('Gagal memperbarui favicon:', error);
    dispatchCmsNotice('Favicon could not be updated. The previous favicon is still safe; check Supabase bucket UPDATE/UPSERT permissions.');
    return null;
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(fixedPath);
  return data.publicUrl;
}

// Convert file .docx (Word) yang di-upload admin jadi HTML, dipakai buat isi cerpen/tulisan
// panjang di Tab Addan Projects. Jalan di browser (client-side), gak lewat server —
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
    dispatchCmsNotice('Could not read this Word file. Make sure it is .docx (not legacy .doc) and try again.');
    return null;
  }
}


function EnglishTranslationEditor({ source, rootPath, allowedPaths, translations, onChange }) {
  const rows = React.useMemo(() => collectTranslatableStrings(source, rootPath, allowedPaths), [source, rootPath, allowedPaths]);
  const completed = rows.filter((row) => translationValue(translations, row.path).trim()).length;

  const humanize = (path) => {
    const last = String(path).split('.').pop() || path;
    if (last.startsWith('@') || last.startsWith('#')) return last;
    return decodeURIComponent(last)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-gray-300 p-5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">This section has no text copy that needs translation.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-blue-700 dark:text-blue-300">English copy</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">Only the English copy is edited in this mode. Empty fields automatically fall back to the Indonesian version; structure, images, order, toggles, and technical data remain shared.</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 font-[Arial] text-[10px] font-bold text-blue-700 shadow-sm dark:bg-[#252525] dark:text-blue-300">{completed}/{rows.length} translated</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const value = translationValue(translations, row.path);
          const longText = row.source.length > 110 || row.source.includes('\n') || /body|content|description|objective|explanation|note|bio|summary|passage/i.test(row.keyName);
          return (
            <div key={row.path} className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-[#282828]">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-200">{humanize(row.path)}</label>
                <span className="max-w-full truncate font-[Arial] text-[9px] text-gray-400" title={row.path}>{row.path}</span>
              </div>
              <p className="mb-2 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><span className="font-semibold">ID:</span> {row.source}</p>
              {longText ? (
                <RichTextEditor
                  fieldMode
                  initialValue={value}
                  onChange={(html) => onChange(row.path, html)}
                  placeholder="Write the English version here…"
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(event) => onChange(row.path, event.target.value)}
                  placeholder="Write the English version here…"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-[#1e1e1e] dark:text-gray-100"
                />
              )}
              {!value.trim() && <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">Not translated yet — the public EN version is still using the Indonesian copy.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}


const CmsMenuIllustration = ({ type }) => {
  const common = {
    width: 52,
    height: 52,
    viewBox: '0 0 52 52',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
  };
  const stroke = 'currentColor';
  const icons = {
    main: <><rect x="9" y="11" width="34" height="30" rx="3" stroke={stroke} strokeWidth="1.7"/><path d="M15 18h22M15 24h15M15 30h19M15 36h11" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/></>,
    side: <><rect x="10" y="9" width="32" height="34" rx="3" stroke={stroke} strokeWidth="1.7"/><path d="M18 9v34M23 17h12M23 23h9M23 31h12M23 37h7" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/></>,
    extra: <><path d="M18 19h16a8 8 0 0 1 7.7 5.8l2.1 7.5a5 5 0 0 1-8.2 5l-4.1-3.6h-11l-4.1 3.6a5 5 0 0 1-8.2-5l2.1-7.5A8 8 0 0 1 18 19Z" stroke={stroke} strokeWidth="1.7"/><path d="M17 26v7M13.5 29.5h7M34 27.5h.01M38 31.5h.01" stroke={stroke} strokeWidth="2" strokeLinecap="round"/></>,
    websikee: <><rect x="7" y="10" width="38" height="32" rx="4" stroke={stroke} strokeWidth="1.7"/><path d="M7 18h38" stroke={stroke} strokeWidth="1.7"/><circle cx="12" cy="14" r="1" fill="currentColor"/><circle cx="16" cy="14" r="1" fill="currentColor"/><path d="M19 32c3.5-7 10.5-7 14 0M26 23v14" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/></>,
    home: <><path d="m9 25 17-14 17 14" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 23v19h26V23M22 42V31h8v11" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round"/></>,
    about: <><circle cx="26" cy="19" r="8" stroke={stroke} strokeWidth="1.7"/><path d="M12 42c1.5-8 7-12 14-12s12.5 4 14 12" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/></>,
    projects: <><rect x="9" y="14" width="27" height="30" rx="3" stroke={stroke} strokeWidth="1.7"/><path d="M16 9h27v30" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/><path d="M15 22h15M15 28h15M15 34h10" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/></>,
    career: <><rect x="8" y="17" width="36" height="25" rx="3" stroke={stroke} strokeWidth="1.7"/><path d="M20 17v-5h12v5M8 27h36M22 27v4h8v-4" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round"/></>,
    book: <><path d="M7 13c8-2 14 0 19 4v28c-5-4-11-6-19-4V13ZM45 13c-8-2-14 0-19 4v28c5-4 11-6 19-4V13Z" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round"/></>,
    contact: <><rect x="7" y="13" width="38" height="27" rx="3" stroke={stroke} strokeWidth="1.7"/><path d="m9 16 17 13 17-13" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round"/></>,
    featuredWorks: <><rect x="8" y="10" width="36" height="32" rx="3" stroke={stroke} strokeWidth="1.7"/><path d="m13 36 9-9 6 6 5-5 6 8" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round"/><circle cx="33" cy="19" r="4" stroke={stroke} strokeWidth="1.7"/></>,
    visitorIntroduction: <><path d="M14 8h24v12H14zM10 20h32v18H10zM15 38h22v7H15z" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round"/><path d="M16 26h20M16 31h13" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/></>,
    navigationLabels: <><path d="M8 15h36M8 26h36M8 37h36" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/><circle cx="16" cy="15" r="3" fill="currentColor"/><circle cx="34" cy="26" r="3" fill="currentColor"/><circle cx="23" cy="37" r="3" fill="currentColor"/></>,
    interactiveWords: <><path d="M9 14h34M9 25h23M9 36h29" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/><path d="M13 18c2 2 4-2 6 0s4-2 6 0M13 40c2 2 4-2 6 0s4-2 6 0" stroke={stroke} strokeWidth="1.5" strokeLinecap="round"/></>,
    general: <><path d="M26 7v8M26 37v8M7 26h8M37 26h8M12.6 12.6l5.7 5.7M33.7 33.7l5.7 5.7M39.4 12.6l-5.7 5.7M18.3 33.7l-5.7 5.7" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/><circle cx="26" cy="26" r="8" stroke={stroke} strokeWidth="1.7"/></>,
    zine: <><path d="M10 12h32v28H10z" stroke={stroke} strokeWidth="1.7"/><path d="M15 18h22M15 24h14M15 30h19M15 36h10" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/></>,
    miniGame: <><path d="M18 19h16a8 8 0 0 1 7.7 5.8l2.1 7.5a5 5 0 0 1-8.2 5l-4.1-3.6h-11l-4.1 3.6a5 5 0 0 1-8.2-5l2.1-7.5A8 8 0 0 1 18 19Z" stroke={stroke} strokeWidth="1.7"/><path d="M17 26v7M13.5 29.5h7M34 27.5h.01M38 31.5h.01" stroke={stroke} strokeWidth="2" strokeLinecap="round"/></>,
    leaderboardSystems: <><path d="M10 43V28h8v15M22 43V18h8v25M34 43V10h8v33" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round"/><path d="M7 43h38" stroke={stroke} strokeWidth="1.7" strokeLinecap="round"/></>,
  };
  return <svg {...common}>{icons[type] || icons.projects}</svg>;
};

export default function CmsDashboard({ data, onSave, onExitAdmin }) {
  const [showAdminWelcome, setShowAdminWelcome] = useState(true);
  const [recordQuality, setRecordQuality] = useState('1080');
  const requestWebsiteRecording = () => {
    window.dispatchEvent(new CustomEvent('portfolio:start-recording', { detail: { quality: recordQuality } }));
  };
  // Salinan lokal yang bisa diedit bebas — baru dikirim ke portfolioData asli pas Save ditekan.
  const [sourceFormData, setSourceFormData] = useState(() => {
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
      website: {
        ...normalizeWebsite(cloned.website),
        devNotes: readLocalDevNotes(),
      },
      translations: normalizeTranslations(cloned.translations),
    };
  });
  const [cmsLanguage, setCmsLanguage] = useState('id');
  const [cmsDomRevision, setCmsDomRevision] = useState(0);
  const bumpCmsDomRevision = React.useCallback(() => {
    setCmsDomRevision((value) => value + 1);
  }, []);
  const englishFormData = React.useMemo(() => {
    const translated = localizedPortfolioData(sourceFormData, 'en');
    const translationMap = normalizeTranslations(sourceFormData.translations).en;

    // EN editor law: every untranslated human-readable string is rendered empty.
    // The Indonesian source stays intact in sourceFormData and is shown above the field
    // by the existing ID-source decorator.
    const blankUntranslated = (source, localized, path = '') => {
      if (typeof source === 'string') {
        return typeof translationMap[path] === 'string' ? localized : '';
      }

      if (Array.isArray(source)) {
        return source.map((item, index) => {
          const stable = item && typeof item === 'object' && item.id != null && String(item.id).trim()
            ? `@${encodeURIComponent(String(item.id).trim())}`
            : `#${index}`;
          return blankUntranslated(
            item,
            Array.isArray(localized) ? localized[index] : undefined,
            path ? `${path}.${stable}` : stable
          );
        });
      }

      if (source && typeof source === 'object') {
        const result = { ...(localized && typeof localized === 'object' ? localized : {}) };
        Object.keys(source).forEach((key) => {
          if (key === 'translations') return;
          const childPath = path ? `${path}.${key}` : key;
          result[key] = blankUntranslated(source[key], localized?.[key], childPath);
        });
        return result;
      }

      return localized;
    };

    return blankUntranslated(sourceFormData, translated);
  }, [sourceFormData]);
  const formData = cmsLanguage === 'en' ? englishFormData : sourceFormData;
  const cmsCopy = React.useCallback((idText, enText) => (cmsLanguage === 'en' ? enText : idText), [cmsLanguage]);

  // Source-language notes are rendered declaratively by <Field>.
  // No querySelector/insertBefore DOM mutation: this keeps the CMS layout and React tree stable.

  const setFormData = React.useCallback((nextOrUpdater) => {
    if (cmsLanguage !== 'en') {
      setSourceFormData(nextOrUpdater);
      return;
    }

    setSourceFormData((currentSource) => {
      // Use the same EN editor shape that is currently rendered. This avoids reintroducing
      // Indonesian fallback strings during an edit/click in newer CMS sections.
      const translated = localizedPortfolioData(currentSource, 'en');
      const translationMap = normalizeTranslations(currentSource.translations).en;
      const blankUntranslatedForEdit = (source, localized, path = '') => {
        if (typeof source === 'string') return typeof translationMap[path] === 'string' ? localized : '';
        if (Array.isArray(source)) {
          return source.map((item, index) => {
            const stable = item && typeof item === 'object' && item.id != null && String(item.id).trim()
              ? `@${encodeURIComponent(String(item.id).trim())}`
              : `#${index}`;
            return blankUntranslatedForEdit(item, Array.isArray(localized) ? localized[index] : undefined, path ? `${path}.${stable}` : stable);
          });
        }
        if (source && typeof source === 'object') {
          const result = { ...(localized && typeof localized === 'object' ? localized : {}) };
          Object.keys(source).forEach((key) => {
            if (key === 'translations') return;
            const childPath = path ? `${path}.${key}` : key;
            result[key] = blankUntranslatedForEdit(source[key], localized?.[key], childPath);
          });
          return result;
        }
        return localized;
      };
      const currentView = blankUntranslatedForEdit(currentSource, translated);
      const nextView = typeof nextOrUpdater === 'function' ? nextOrUpdater(currentView) : nextOrUpdater;
      if (!nextView || typeof nextView !== 'object') return currentSource;

      const nextTranslations = { ...(currentSource.translations || {}), en: { ...(currentSource.translations?.en || {}) } };
      const technicalKeys = new Set(['id','type','url','href','src','image','imageUrl','coverImage','posterImage','thumbnail','fileUrl','mediaUrl','illustration','target','tab','status','kind','layout','mediaType','position','order','enabled','color','fontFamily']);

      const walk = (before, after, path = '') => {
        if (typeof after === 'string') {
          if (path) {
            const sourceValue = path.split('.').reduce((value, segment) => {
              if (value == null) return undefined;
              if (segment.startsWith('@')) {
                const wantedId = decodeURIComponent(segment.slice(1));
                return Array.isArray(value) ? value.find((item) => String(item?.id ?? '') === wantedId) : undefined;
              }
              if (segment.startsWith('#')) {
                const index = Number(segment.slice(1));
                return Array.isArray(value) ? value[index] : undefined;
              }
              return value?.[segment];
            }, currentSource);
            if (after !== sourceValue) nextTranslations.en[path] = after;
            else delete nextTranslations.en[path];
          }
          return;
        }
        if (!after || typeof after !== 'object') return;
        if (Array.isArray(after)) {
          after.forEach((item, index) => {
            const stable = item && typeof item === 'object' && item.id ? `@${item.id}` : `#${index}`;
            walk(Array.isArray(before) ? before[index] : undefined, item, path ? `${path}.${stable}` : stable);
          });
          return;
        }
        Object.keys(after).forEach((key) => {
          if (key === 'translations' || technicalKeys.has(key)) return;
          const childPath = path ? `${path}.${key}` : key;
          walk(before?.[key], after[key], childPath);
        });
      };

      walk(currentView, nextView);
      return { ...currentSource, translations: nextTranslations };
    });
  }, [cmsLanguage, sourceFormData]);

  // null = layar menu utama (pilih salah satu dari 6 tab dulu sebelum masuk ke isinya)
  const [activeTab, setActiveTab] = useState(null);
  const [cmsSection, setCmsSection] = useState(null);
  const [openSectionKeys, setOpenSectionKeys] = useState(() => new Set());
  const toggleSection = (sectionKey) => {
    setOpenSectionKeys((previous) => {
      const next = new Set(previous);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
    setCmsDomRevision((value) => value + 1);
  };
  const [activeMiniGameEditor, setActiveMiniGameEditor] = useState(null);
  const [miniGameAutofillText, setMiniGameAutofillText] = useState('');
  const [miniGameAutofillNotice, setMiniGameAutofillNotice] = useState('');
  useEffect(() => {
    setOpenSectionKeys(new Set());
    setCmsLanguage('id');
  }, [activeTab]);
  // Sub-tab DI DALAM panel "Projects": 'articles' | 'poster' | 'custom'. Dipisah biar
  // admin gak harus scroll ngelewatin Articles+Poster+Tab Addan sekaligus dalam 1
  // halaman panjang — cuma 1 section yang di-render/kelihatan dalam satu waktu, mirip
  // nav Articles/Poster di halaman publiknya sendiri.
  const [activeProjectsSubTab, setActiveProjectsSubTab] = useState('menu');
  const [activeProjectItem, setActiveProjectItem] = useState(null);
  const [expandedUniversalBlockIds, setExpandedUniversalBlockIds] = useState(() => new Set());
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
  const toggleContentCard = (key) => {
    setExpandedContentKey((current) => current === key ? null : key);
    // ContentCard dipakai lintas CMS (Projects, Contact, Book, About, Zine, Mini Game, dll).
    // Saat editor drag/drop dibuka atau ditutup dalam mode EN, sinkronkan ulang referensi ID
    // pada commit yang sama supaya field yang baru mount tidak kehilangan catatan Indonesia.
    bumpCmsDomRevision();
  };
  // Category Career mana yang lagi ditampilin (id kategori) — sama konsepnya kayak
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
  const [uploadingWebsitePreview, setUploadingWebsitePreview] = useState(false);
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
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');
  const [leaderboardGameFilter, setLeaderboardGameFilter] = useState('all');
  const [deletingLeaderboardId, setDeletingLeaderboardId] = useState(null);
  const [leaderboardDeleteTarget, setLeaderboardDeleteTarget] = useState(null);
  const loadLeaderboardSystems = async () => {
    setLeaderboardLoading(true);
    setLeaderboardError('');
    try {
      setLeaderboardRows(await getMiniGameLeaderboardAdmin(500));
    } catch (error) {
      console.error('Gagal memuat Leaderboard Systems:', error);
      setLeaderboardError('Leaderboard belum bisa dibaca. Pastikan tabel mini_game_scores dan policy Supabase sudah aktif.');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const requestRemoveLeaderboardEntry = (entry) => {
    if (!entry || deletingLeaderboardId) return;
    setLeaderboardError('');
    setLeaderboardDeleteTarget(entry);
  };

  const confirmRemoveLeaderboardEntry = async () => {
    const entry = leaderboardDeleteTarget;
    if (!entry) return;
    setDeletingLeaderboardId(entry.id);
    setLeaderboardError('');
    try {
      await deleteMiniGameLeaderboardEntry(entry.id);
      setLeaderboardRows((current) => current.filter((row) => row.id !== entry.id));
      setLeaderboardDeleteTarget(null);
    } catch (error) {
      console.error('Gagal menghapus leaderboard:', error);
      setLeaderboardError('Pemain belum bisa dihapus. Coba lagi.');
    } finally {
      setDeletingLeaderboardId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'leaderboardSystems') loadLeaderboardSystems();
  }, [activeTab]);

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

  const archiveInboxZine = async (entry) => {
    if (!entry || entry.status === 'pending') return;
    if (!window.confirm(`Remove Submission #${entry.id} dari history CMS? Kiriman Approved tetap tersedia di fitur Menerima.`)) return;
    setModeratingZineId(entry.id);
    setZineInboxError('');
    try {
      await archiveZineSubmissions(entry.id);
      setZineInbox((current) => current.filter((item) => item.id !== entry.id));
    } catch (error) {
      console.error('Gagal menghapus history Zine:', error);
      setZineInboxError('History belum bisa dihapus. Pastikan kolom/policy cms_archived di Supabase sudah aktif.');
    } finally {
      setModeratingZineId(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Mini Game validation only belongs to the Mini Game editor.
    // Saving Navigation, Home, About, etc. must never be blocked by an unfinished
    // Mini Game draft that the admin is not currently editing.
    if (activeTab === 'miniGame') {
      const miniGamesToValidate = [formData.miniGame, ...(formData.miniGame?.gameSlots || [])];
      const invalidDrafts = miniGamesToValidate.flatMap((game) => {
        if (game?.gameType === 'plagiarismPolice') {
          return (game?.cases || []).flatMap((c, index) => {
            if (c.enabled === false) return [];
            return plagiarismPoliceCaseErrors(c).map((error) => `${game.gameName || 'Plagiarism Police'} · Kasus ${index + 1}: ${error}`);
          });
        }
        return (game?.drafts || []).flatMap((draft, index) => {
          if (draft.enabled === false) return [];
          const isHangman = game?.gameType === 'hangman' || String(game?.gameName || '').trim().toLowerCase() === 'the hangman';
          const itemLabel = isHangman ? `Kata ${index + 1}` : `Draft ${index + 1}`;
          return miniGameContentErrors(game, draft).map((error) => `${game.gameName || 'Game baru'} · ${itemLabel}: ${error}`);
        });
      });
      if (invalidDrafts.length) {
        setNotice(`Mini Game belum bisa disimpan. ${invalidDrafts[0]}`);
        return;
      }
    }
    setIsSaving(true);
    const cleanMiniGameIssues = (game) => ({
      ...game,
      drafts: Array.isArray(game?.drafts)
        ? game.drafts.map((draft) => ({
            ...draft,
            issues: Array.isArray(draft?.issues)
              ? draft.issues.filter((issue) => !isBlankMiniGameIssue(issue))
              : [],
          }))
        : [],
    });
    const cleanData = {
      ...sourceFormData,
      miniGame: {
        ...cleanMiniGameIssues(sourceFormData.miniGame || {}),
        gameSlots: Array.isArray(sourceFormData.miniGame?.gameSlots)
          ? sourceFormData.miniGame.gameSlots.map(cleanMiniGameIssues)
          : [],
      },
      website: { ...normalizeWebsite(sourceFormData.website) },
    };
    // Notes Website adalah admin-local note: jangan pernah kirim ke row portfolio
    // yang memang dibaca publik oleh website.
    delete cleanData.website.devNotes;
    delete cleanData.odds;
    delete cleanData.quotes;
    try {
      const success = await onSave(cleanData);
      if (success === false) {
        setNotice('Gagal simpan perubahan. Cek koneksi internet lo dan coba lagi.');
        return;
      }
      // Berhasil disimpan — balik ke menu pilih tab, TETEP di dalem admin mode.
      // Keluar dari admin mode sepenuhnya cuma lewat tombol "Exit Admin" di TitleBar.
      if (activeTab === 'websikee') setCmsSection(null);
      setActiveTab(null);
    } catch (error) {
      console.error('CMS save failed:', error);
      setNotice('Gagal simpan perubahan. Cek koneksi internet lo dan coba lagi.');
    } finally {
      setIsSaving(false);
    }
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
      translations: normalizeTranslations(cloned.translations),
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
  const applyMiniGameAutofill = () => {
    setMiniGameAutofillNotice('');
    let payload;
    try {
      payload = JSON.parse(miniGameAutofillText);
    } catch {
      setMiniGameAutofillNotice(cmsCopy('The JSON is not valid yet. Check commas, quotation marks, and brackets.', 'The JSON is not valid yet. Check commas, quotation marks, and brackets.'));
      return;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      setMiniGameAutofillNotice(cmsCopy('Autofill must contain one JSON object.', 'Autofill must contain one JSON object.'));
      return;
    }

    const allowed = new Set(['gameName','gameCategory','gameCardDescription','title','objective','rules','startButtonLabel','secondsPerDraft','draftsPerSession','gradeTitles','resultEyebrow','replayLabel','projectsCtaLabel','contactCtaLabel','drafts','cases','casesPerSession','verdictPoints','evidencePoints','perfectBonus','verdictLabels','evidenceLabels','copy','podium','audienceFitLabel','audienceLabel','averageLabel','bestDimensionLabel','briefLabel','caseLabel','channelLabel','chooseLabel','clarityLabel','cleanRiskLabel','conceptLabel','contentTypeLabel','contextLabel','enabled','evidenceLabel','goalLabel','hookLabel','logicLabel','nextLabel','precisionLabel','relevanceLabel','reportLabel','riskLabel','scoreLabel','scoreMaxPerCase','showInLibrary','sourceLabel','statementLabel','submitLabel','toneFitLabel','toneLabel']);
    updateEditingMiniGame((game) => {
      const next = { ...game };
      Object.entries(payload).forEach(([key, value]) => {
        if (!allowed.has(key)) return;
        if (key === 'rules' && Array.isArray(value)) {
          next.rules = [...value];
        } else if (key === 'rules' && value && typeof value === 'object') {
          next.rules = { ...(Array.isArray(game.rules) ? {} : game.rules), ...value };
        } else if (key === 'gradeTitles' && Array.isArray(value)) {
          next.gradeTitles = value.map((item) => ({ min: Math.max(0, Number(item?.min) || 0), label: String(item?.label || ''), remark: String(item?.remark || '') }));
        } else if (key === 'drafts' && Array.isArray(value)) {
          next.drafts = value.map((item, index) => ({
            id: item?.id || `game-draft-${Date.now()}-${index}`,
            label: String(item?.label || item?.word || ''),
            enabled: item?.enabled !== false,
            passage: String(item?.passage || item?.clue || ''),
            issues: Array.isArray(item?.issues) ? item.issues : [],
          }));
        } else {
          next[key] = value;
        }
      });
      return next;
    });
    setMiniGameAutofillNotice(cmsCopy('Autofill has been applied to the form. Review it, then Save.', 'Autofill has been applied to the form. Review it, then Save.'));
    bumpCmsDomRevision();
  };
  const addMiniGameSlot = () => setFormData((previous) => {
    const slots = previous.miniGame.gameSlots || [];
    const presets = [
      HANGMAN_PRESET,
      PLAGIARISM_POLICE_PRESET,
      HEADLINE_HOOK_CMS_PRESET,
      TONE_SWITCHER_CMS_PRESET,
      LOGICAL_LEAP_CMS_PRESET,
    ];
    const nextPreset = presets.find((preset) => !slots.some((slot) =>
      slot.gameType === preset.gameType ||
      String(slot.gameName || '').trim().toLowerCase() === String(preset.gameName || '').trim().toLowerCase()
    ));
    const next = nextPreset
      ? emptyMiniGameSlot(slots.length + 2, nextPreset)
      : emptyMiniGameSlot(slots.length + 2);
    return { ...previous, miniGame: { ...previous.miniGame, gameSlots: [...slots, next] } };
  });
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

  const setWelcomePatchItem = (index, field, value) =>
    setFormData((p) => {
      const current = p.general?.welcomeNotification || {};
      const items = [...(current.items || [])];
      items[index] = { ...(items[index] || {}), [field]: value };
      return {
        ...p,
        general: {
          ...p.general,
          welcomeNotification: { ...current, items },
        },
      };
    });

  const addWelcomePatchItem = () =>
    setFormData((p) => {
      const current = p.general?.welcomeNotification || {};
      return {
        ...p,
        general: {
          ...p.general,
          welcomeNotification: {
            ...current,
            items: [...(current.items || []), { title: '', description: '' }],
          },
        },
      };
    });

  const removeWelcomePatchItem = (index) =>
    setFormData((p) => {
      const current = p.general?.welcomeNotification || {};
      return {
        ...p,
        general: {
          ...p.general,
          welcomeNotification: {
            ...current,
            items: (current.items || []).filter((_, itemIndex) => itemIndex !== index),
          },
        },
      };
    });

  const moveWelcomePatchItem = (index, direction) =>
    setFormData((p) => {
      const current = p.general?.welcomeNotification || {};
      const items = [...(current.items || [])];
      const target = index + direction;
      if (target < 0 || target >= items.length) return p;
      [items[index], items[target]] = [items[target], items[index]];
      return {
        ...p,
        general: {
          ...p.general,
          welcomeNotification: { ...current, items },
        },
      };
    });

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

  const updateBitsAndPiecesItem = (index, patch) => setFormData((p) => {
    const items = [...(p.about.bitsAndPieces?.items || [])];
    items[index] = { ...items[index], ...patch };
    return { ...p, about: { ...p.about, bitsAndPieces: { ...p.about.bitsAndPieces, items } } };
  });

  const addBitsAndPiecesItem = () => setFormData((p) => ({
    ...p,
    about: {
      ...p.about,
      bitsAndPieces: {
        ...p.about.bitsAndPieces,
        items: [...(p.about.bitsAndPieces?.items || []), { id: `about-bit-${Date.now()}`, label: '', value: '' }],
      },
    },
  }));

  const removeBitsAndPiecesItem = (index) => setFormData((p) => ({
    ...p,
    about: {
      ...p.about,
      bitsAndPieces: {
        ...p.about.bitsAndPieces,
        items: (p.about.bitsAndPieces?.items || []).filter((_, itemIndex) => itemIndex !== index),
      },
    },
  }));

  /* ============ CAREER ============ */
  // Title & sub-judul di layar menu utama halaman Career
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
    bumpCmsDomRevision();
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

  // Name kategori yang tampil di kartu menu (bebas diganti, mis. "Professional" -> "Kerja")
  const setCareerCategoryName = (catIdx, value) =>
    updateCareerCategory(catIdx, (cat) => ({ ...cat, name: value }));

  // Tipe kartu kategori: 'career' (Position @ Instansi) atau 'credential' (Pencapaian/Sertifikat).
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
  // Title & sub-judul di halaman Book (di atas rak buku)
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
  const addReadingBook = () => setFormData((p) => ({ ...p, books: { ...p.books, readingItems: [...(p.books.readingItems || []), emptyReadingBook()] } }));
  const removeReadingBook = (idx) => setFormData((p) => ({ ...p, books: { ...p.books, readingItems: (p.books.readingItems || []).filter((_, i) => i !== idx) } }));
  const setReadingBookField = (idx, field, value) => setFormData((p) => { const readingItems = [...(p.books.readingItems || [])]; readingItems[idx] = { ...readingItems[idx], [field]: value }; return { ...p, books: { ...p.books, readingItems } }; });

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
  const setExclusiveReadingBookFlag = (idx, field, checked) =>
    setFormData((p) => ({
      ...p,
      books: {
        ...p.books,
        readingItems: (p.books.readingItems || []).map((item, itemIdx) => ({
          ...item,
          [field]: checked ? itemIdx === idx : (itemIdx === idx ? false : item[field]),
        })),
      },
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
  // Tab Name-nya sendiri bebas ditentuin (mis. "Dummy Projects", "Eksperimen", dll).
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
    bumpCmsDomRevision();
  };
  const removeCustomSection = (sectionIdx) => {
    const removedId = formData.projects.customSections[sectionIdx]?.id;
    if (removedId && activeProjectsSubTab === `custom:${removedId}`) {
      setActiveProjectsSubTab('menu');
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
  const setCustomSectionDescription = (sectionIdx, description) =>
    setFormData((p) => {
      const customSections = [...p.projects.customSections];
      customSections[sectionIdx] = { ...customSections[sectionIdx], description };
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

  const openProjectItem = (kind, idx, sectionIdx = null) => {
    setActiveProjectItem({ kind, idx, sectionIdx });
    bumpCmsDomRevision();
  };
  const closeProjectItem = () => {
    setActiveProjectItem(null);
    bumpCmsDomRevision();
  };
  const projectSectionLabel = () => {
    if (activeProjectsSubTab === 'articles') return formData.projects.articlesLabel || 'Articles';
    if (activeProjectsSubTab === 'directing') return formData.projects.directingLabel || 'Directing';
    if (activeProjectsSubTab === 'poster') return formData.projects.posterLabel || 'Poster';
    if (activeProjectsSubTab.startsWith('custom:')) return formData.projects.customSections.find((s) => `custom:${s.id}` === activeProjectsSubTab)?.label || 'Project Tab';
    return 'Projects';
  };


  /* ============ PHASE 3: UNIVERSAL PROJECT CONTENT BLOCKS ============ */
  const UNIVERSAL_BLOCK_TYPES = [
    { type: 'text', label: 'Text', icon: 'Aa' },
    { type: 'image', label: 'Image', icon: '▧' },
    { type: 'gallery', label: 'Gallery', icon: '▦' },
    { type: 'video', label: 'Video', icon: '▶' },
    { type: 'audio', label: 'Audio', icon: '♪' },
    { type: 'link', label: 'Link', icon: '↗' },
    { type: 'file', label: 'File', icon: 'PDF' },
    { type: 'word', label: 'Import Doc', icon: 'W' },
    { type: 'embed', label: 'Embed', icon: '</>' },
    { type: 'divider', label: 'Divider', icon: '—' },
  ];

  const emptyUniversalBlock = (type) => ({
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: '',
    url: '',
    label: '',
    caption: '',
    items: [],
  });

  const updateProjectItemBlocks = (kind, idx, sectionIdx, updater) => {
    setFormData((prev) => {
      const projects = { ...prev.projects };

      if (kind === 'article') {
        const articles = [...projects.articles];
        const item = { ...articles[idx] };
        item.cmsBlocks = updater(Array.isArray(item.cmsBlocks) ? item.cmsBlocks : []);
        articles[idx] = item;
        projects.articles = articles;
      } else if (kind === 'directing') {
        const directing = { ...projects.directing, items: [...projects.directing.items] };
        const item = { ...directing.items[idx] };
        item.cmsBlocks = updater(Array.isArray(item.cmsBlocks) ? item.cmsBlocks : []);
        directing.items[idx] = item;
        projects.directing = directing;
      } else if (kind === 'poster') {
        const poster = { ...projects.poster, items: [...projects.poster.items] };
        const item = { ...poster.items[idx] };
        item.cmsBlocks = updater(Array.isArray(item.cmsBlocks) ? item.cmsBlocks : []);
        poster.items[idx] = item;
        projects.poster = poster;
      } else if (kind === 'custom') {
        const customSections = [...projects.customSections];
        const section = { ...customSections[sectionIdx], items: [...customSections[sectionIdx].items] };
        const item = { ...section.items[idx] };
        item.cmsBlocks = updater(Array.isArray(item.cmsBlocks) ? item.cmsBlocks : []);
        section.items[idx] = item;
        customSections[sectionIdx] = section;
        projects.customSections = customSections;
      }

      return { ...prev, projects };
    });
  };

  const addUniversalBlock = (kind, idx, sectionIdx, type) => {
    const nextBlock = emptyUniversalBlock(type);
    updateProjectItemBlocks(kind, idx, sectionIdx, (blocks) => [...blocks, nextBlock]);
    setExpandedUniversalBlockIds((current) => new Set([...current, nextBlock.id]));
  };

  const setUniversalBlockField = (kind, idx, sectionIdx, blockIdx, field, value) =>
    updateProjectItemBlocks(kind, idx, sectionIdx, (blocks) =>
      blocks.map((block, i) => (i === blockIdx ? { ...block, [field]: value } : block))
    );

  const removeUniversalBlock = (kind, idx, sectionIdx, blockIdx) =>
    updateProjectItemBlocks(kind, idx, sectionIdx, (blocks) => blocks.filter((_, i) => i !== blockIdx));

  const moveUniversalBlock = (kind, idx, sectionIdx, blockIdx, direction) =>
    updateProjectItemBlocks(kind, idx, sectionIdx, (blocks) => {
      const next = [...blocks];
      const target = blockIdx + direction;
      if (target < 0 || target >= next.length) return next;
      [next[blockIdx], next[target]] = [next[target], next[blockIdx]];
      return next;
    });


  const PROJECT_LAYOUT_PRESETS = [
    { id: 'default', label: 'Default', icon: '□', hint: 'Use the current Projects presentation.' },
    { id: 'editorial', label: 'Editorial', icon: 'Aa', hint: 'Keep writing at the center.' },
    { id: 'visual', label: 'Visual', icon: '▧', hint: 'Image dan visual work gets more emphasis.' },
    { id: 'case-study', label: 'Case Study', icon: 'Aa▧', hint: 'Problem, process, outcome, and reasoning.' },
    { id: 'media', label: 'Media', icon: '▶', hint: 'Make audio/video the primary hero.' },
    { id: 'minimal', label: 'Minimal', icon: '—', hint: 'Use the quietest, simplest presentation.' },
  ];

  const PROJECT_DESIGN_RECIPES = [
    { id: 'default', label: 'Default', layout: 'default', coverStyle: 'split', contentWidth: 'normal', alignment: 'left' },
    { id: 'editorial-story', label: 'Editorial Story', layout: 'editorial', coverStyle: 'small', contentWidth: 'narrow', alignment: 'left' },
    { id: 'visual-showcase', label: 'Visual Showcase', layout: 'visual', coverStyle: 'full', contentWidth: 'wide', alignment: 'center' },
    { id: 'case-study', label: 'Case Study', layout: 'case-study', coverStyle: 'split', contentWidth: 'normal', alignment: 'left' },
    { id: 'long-read', label: 'Long Read', layout: 'editorial', coverStyle: 'none', contentWidth: 'narrow', alignment: 'left' },
    { id: 'media-piece', label: 'Media Piece', layout: 'media', coverStyle: 'full', contentWidth: 'normal', alignment: 'center' },

    { id: 'literary', label: 'Literary / Short Story', layout: 'editorial', coverStyle: 'small', contentWidth: 'narrow', alignment: 'left' },
    { id: 'screenplay', label: 'Screenplay', layout: 'minimal', coverStyle: 'none', contentWidth: 'normal', alignment: 'left' },
    { id: 'audio-piece', label: 'Audio Piece', layout: 'media', coverStyle: 'full', contentWidth: 'normal', alignment: 'center' },
    { id: 'poster-piece', label: 'Poster', layout: 'visual', coverStyle: 'full', contentWidth: 'wide', alignment: 'center' },
    { id: 'technical-documentation', label: 'Technical Documentation', layout: 'editorial', coverStyle: 'none', contentWidth: 'normal', alignment: 'left' },
    { id: 'ux-writing-case-study', label: 'UX Writing Case Study', layout: 'case-study', coverStyle: 'split', contentWidth: 'normal', alignment: 'left' },
    { id: 'copywriting-campaign', label: 'Copywriting Campaign', layout: 'visual', coverStyle: 'full', contentWidth: 'wide', alignment: 'left' },
    { id: 'seo-content-case-study', label: 'SEO Content Case Study', layout: 'case-study', coverStyle: 'small', contentWidth: 'normal', alignment: 'left' },
    { id: 'content-strategy', label: 'Content Strategy', layout: 'case-study', coverStyle: 'none', contentWidth: 'wide', alignment: 'left' },
    { id: 'editing-case-study', label: 'Editing Case Study', layout: 'case-study', coverStyle: 'none', contentWidth: 'normal', alignment: 'left' },
  ];

  const getProjectPresentation = (item) => ({
    mode: item?.cmsPresentation?.mode || 'legacy',
    recipe: item?.cmsPresentation?.recipe || 'default',
    layout: item?.cmsPresentation?.layout || 'default',
    coverStyle: item?.cmsPresentation?.coverStyle || 'split',
    contentWidth: item?.cmsPresentation?.contentWidth || 'normal',
    alignment: item?.cmsPresentation?.alignment || 'left',
  });

  const updateProjectItemPresentation = (kind, idx, sectionIdx, patch) => {
    setFormData((prev) => {
      const projects = { ...prev.projects };
      const patchItem = (raw) => ({ ...raw, cmsPresentation: { ...getProjectPresentation(raw), ...patch } });

      if (kind === 'article') {
        const articles = [...projects.articles];
        articles[idx] = patchItem(articles[idx]);
        projects.articles = articles;
      } else if (kind === 'directing') {
        const directing = { ...projects.directing, items: [...projects.directing.items] };
        directing.items[idx] = patchItem(directing.items[idx]);
        projects.directing = directing;
      } else if (kind === 'poster') {
        const poster = { ...projects.poster, items: [...projects.poster.items] };
        poster.items[idx] = patchItem(poster.items[idx]);
        projects.poster = poster;
      } else if (kind === 'custom') {
        const customSections = [...projects.customSections];
        const section = { ...customSections[sectionIdx], items: [...customSections[sectionIdx].items] };
        section.items[idx] = patchItem(section.items[idx]);
        customSections[sectionIdx] = section;
        projects.customSections = customSections;
      }
      return { ...prev, projects };
    });
  };

  const applyProjectRecipe = (kind, idx, sectionIdx, recipeId) => {
    const recipe = PROJECT_DESIGN_RECIPES.find((entry) => entry.id === recipeId) || PROJECT_DESIGN_RECIPES[0];
    updateProjectItemPresentation(kind, idx, sectionIdx, {
      recipe: recipe.id,
      layout: recipe.layout,
      coverStyle: recipe.coverStyle,
      contentWidth: recipe.contentWidth,
      alignment: recipe.alignment,
    });
  };

  const setUniversalBlockDisplay = (kind, idx, sectionIdx, blockIdx, patch) =>
    updateProjectItemBlocks(kind, idx, sectionIdx, (blocks) =>
      blocks.map((block, i) => i === blockIdx
        ? { ...block, display: { ...(block.display || {}), ...patch } }
        : block
      )
    );

  const renderBlockDisplayControls = (kind, idx, sectionIdx, block, blockIdx) => {
    const display = block.display || {};
    const select = (label, field, value, options) => (
      <label className="space-y-1">
        <span className="font-[Arial] text-[8px] font-bold uppercase tracking-[0.12em] text-gray-400">{label}</span>
        <select value={value} onChange={(e) => setUniversalBlockDisplay(kind, idx, sectionIdx, blockIdx, { [field]: e.target.value })} className={inputCls}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    );

    if (block.type === 'image') return <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700"><p className="text-[9px] leading-relaxed text-gray-400">Auto follows the Design Recipe. Override it only when this work needs special treatment.</p><div className="grid grid-cols-1 gap-2 md:grid-cols-2">{select('Display','size',display.size||'auto',[['auto','Auto (Recipe)'],['contained','Contained'],['normal','Normal'],['wide','Wide'],['full','Full'],['left','Left Feature'],['right','Right Feature']])}{select('Caption Align','align',display.align||'auto',[['auto','Auto'],['left','Left'],['center','Center'],['right','Right']])}</div></div>;
    if (block.type === 'gallery') return <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700"><p className="text-[9px] leading-relaxed text-gray-400">Auto chooses the arrangement based on the recipe and number of images.</p><div className="grid grid-cols-1 gap-2 md:grid-cols-2">{select('Layout','layout',display.layout||'auto',[['auto','Auto (Recipe)'],['duo','Duo'],['grid','Grid'],['carousel','Carousel'],['filmstrip','Filmstrip']])}{select('Columns','columns',String(display.columns||3),[['2','2'],['3','3'],['4','4']])}</div></div>;
    if (block.type === 'text' || block.type === 'word') return <div className="mt-4 grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 dark:border-gray-700 md:grid-cols-2">{select('Style','style',display.style||'body',[['body','Body'],['intro','Intro'],['quote','Quote'],['callout','Callout']])}{select('Width','width',display.width||'normal',[['narrow','Narrow'],['normal','Normal'],['wide','Wide']])}</div>;
    if (block.type === 'audio') return <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">{select('Player','style',display.style||'player',[['player','Player'],['hero','Hero Player'],['compact','Compact']])}</div>;
    if (block.type === 'video') return <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">{select('Display','style',display.style||'inline',[['inline','Inline'],['wide','Wide'],['cinema','Cinema']])}</div>;
    return null;
  };

  const renderProjectPresentationStudio = (kind, idx, sectionIdx, item) => {
    const presentation = getProjectPresentation(item);
    return (
      <div className="space-y-5">
        <div>
          <p className="font-[Arial] text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Website Presentation</p>
          <p className="mt-1 text-[11px] text-gray-400">Choose how this work is presented without touching VS Code. Default keeps the existing Projects presentation baseline.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#242424]">
          <div className="mb-2">
            <span className="font-[Arial] text-[9px] font-bold uppercase tracking-[0.14em] text-gray-500">Public Mode</span>
            <p className="mt-1 text-[9px] leading-relaxed text-gray-400">Legacy keeps the previous renderer. Studio makes Universal Blocks the public content source, with legacy content used only as a safe fallback when no Studio text exists.</p>
            {kind === 'custom' && <p className="mt-1 text-[9px] leading-relaxed text-blue-500 dark:text-blue-300">Writing tabs such as Scriptwriting and Short Story always prefer the newest Universal writing blocks when they contain text, so edits from the CMS writing toolbox cannot be hidden behind stale legacy content.</p>}
            <div className={`mt-2 rounded-md border px-2.5 py-2 font-[Arial] text-[9px] font-bold uppercase tracking-[0.1em] ${presentation.mode === 'studio' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300'}`}>
              Public source: {presentation.mode === 'studio' ? 'Universal Blocks / Studio' : 'Legacy Content'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => updateProjectItemPresentation(kind, idx, sectionIdx, { mode: 'legacy' })} className={`rounded-lg border px-3 py-2 text-left transition ${presentation.mode === 'legacy' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-200 hover:border-blue-300 dark:border-gray-700'}`}>
              <strong className="block font-[Arial] text-[9px] uppercase tracking-[0.12em]">Legacy</strong>
              <span className="mt-1 block text-[8px] text-gray-400">Previous presentation</span>
            </button>
            <button type="button" onClick={() => updateProjectItemPresentation(kind, idx, sectionIdx, { mode: 'studio' })} className={`rounded-lg border px-3 py-2 text-left transition ${presentation.mode === 'studio' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-200 hover:border-blue-300 dark:border-gray-700'}`}>
              <strong className="block font-[Arial] text-[9px] uppercase tracking-[0.12em]">Studio</strong>
              <span className="mt-1 block text-[8px] text-gray-400">Presentation Studio</span>
            </button>
          </div>
        </div>

        <label className="block space-y-2">
          <span className="font-[Arial] text-[9px] font-bold uppercase tracking-[0.14em] text-gray-500">Design Recipe</span>
          <select value={presentation.recipe} onChange={(e) => { if (e.target.value !== 'custom') applyProjectRecipe(kind, idx, sectionIdx, e.target.value); }} className={inputCls}>
            <option value="custom">Custom / Manual</option>
            {PROJECT_DESIGN_RECIPES.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.label}</option>)}
          </select>
        </label>

        <div>
          <p className="mb-2 font-[Arial] text-[9px] font-bold uppercase tracking-[0.14em] text-gray-500">Layout</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {PROJECT_LAYOUT_PRESETS.map((preset) => (
              <button key={preset.id} type="button" onClick={() => updateProjectItemPresentation(kind, idx, sectionIdx, { recipe: 'custom', layout: preset.id })} className={`min-h-[94px] rounded-xl border p-3 text-left transition ${presentation.layout === preset.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-200 bg-white hover:border-blue-300 dark:border-gray-700 dark:bg-[#242424]'}`}>
                <span className="font-[Arial] text-lg font-bold text-blue-600">{preset.icon}</span>
                <strong className="mt-2 block font-[Arial] text-[9px] uppercase tracking-[0.1em]">{preset.label}</strong>
                <span className="mt-1 block text-[9px] leading-snug text-gray-400">{preset.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1"><span className="font-[Arial] text-[8px] font-bold uppercase tracking-[0.12em] text-gray-400">Cover Style</span><select value={presentation.coverStyle} onChange={(e)=>updateProjectItemPresentation(kind,idx,sectionIdx,{recipe:'custom',coverStyle:e.target.value})} className={inputCls}><option value="full">Full Width</option><option value="split">Split</option><option value="small">Small</option><option value="none">None</option></select></label>
          <label className="space-y-1"><span className="font-[Arial] text-[8px] font-bold uppercase tracking-[0.12em] text-gray-400">Content Width</span><select value={presentation.contentWidth} onChange={(e)=>updateProjectItemPresentation(kind,idx,sectionIdx,{recipe:'custom',contentWidth:e.target.value})} className={inputCls}><option value="narrow">Narrow</option><option value="normal">Normal</option><option value="wide">Wide</option></select></label>
          <label className="space-y-1"><span className="font-[Arial] text-[8px] font-bold uppercase tracking-[0.12em] text-gray-400">Alignment</span><select value={presentation.alignment} onChange={(e)=>updateProjectItemPresentation(kind,idx,sectionIdx,{recipe:'custom',alignment:e.target.value})} className={inputCls}><option value="left">Left</option><option value="center">Center</option></select></label>
        </div>

        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-[#1f1f1f]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><strong className="font-[Arial] text-[9px] uppercase tracking-[0.12em]">Project Preview</strong><p className="mt-1 text-[9px] text-gray-400">The controls are ready. The preview/public renderer will be connected in Phase 4B so the live website remains untouched until the component is verified.</p></div>
            <button type="button" disabled className="rounded-lg border border-gray-200 px-3 py-2 font-[Arial] text-[9px] font-bold text-gray-400 opacity-60 dark:border-gray-700">PREVIEW — PHASE 4B</button>
          </div>
        </div>
      </div>
    );
  };

  const toggleUniversalBlock = (blockId) => {
    setExpandedUniversalBlockIds((current) => {
      const next = new Set(current);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const setAllUniversalBlocksExpanded = (blocks, expanded) => {
    setExpandedUniversalBlockIds((current) => {
      const next = new Set(current);
      (blocks || []).forEach((block) => {
        if (!block?.id) return;
        if (expanded) next.add(block.id);
        else next.delete(block.id);
      });
      return next;
    });
  };

  const renderUniversalProjectEditor = (kind, idx, sectionIdx, item) => {
    const blocks = Array.isArray(item?.cmsBlocks) ? item.cmsBlocks : [];

    const blockBody = (block, blockIdx) => {
      if (block.type === 'text') {
        return <RichTextEditor key={`universal-text-${block.id}`} initialValue={block.text || ''} onChange={(html) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'text', html)} placeholder="Write content here..." compact />;
      }
      if (block.type === 'image') {
        return <div className="space-y-3"><ImageDropzone value={block.url || ''} onChange={(url) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'url', url)} profile="poster"/><details className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 dark:border-gray-700 dark:bg-[#1f1f1f]"><summary className="cursor-pointer font-[Arial] text-[9px] font-bold uppercase tracking-[0.12em] text-gray-500">Or use image URL</summary><input value={block.url || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'url', e.target.value)} placeholder="https://..." className={`${inputCls} mt-2`}/></details><input value={block.caption || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'caption', e.target.value)} placeholder="Caption (optional)" className={inputCls}/></div>;
      }
      if (block.type === 'gallery') {
        return <div className="space-y-3"><GalleryDropzone items={block.items || []} onChange={(items) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'items', items)} profile="poster"/><details className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 dark:border-gray-700 dark:bg-[#1f1f1f]"><summary className="cursor-pointer font-[Arial] text-[9px] font-bold uppercase tracking-[0.12em] text-gray-500">Or add image URLs</summary><textarea rows={4} value={(block.items || []).join('\n')} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'items', e.target.value.split('\n').map(v => v.trim()).filter(Boolean))} placeholder={"One image URL per line\nhttps://...\nhttps://..."} className={`${inputCls} mt-2 resize-y`}/></details><input value={block.caption || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'caption', e.target.value)} placeholder="Gallery caption (optional)" className={inputCls}/></div>;
      }
      if (block.type === 'video') {
        return <div className="space-y-3"><input value={block.url || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'url', e.target.value)} placeholder="URL video / embed" className={inputCls}/><input value={block.caption || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'caption', e.target.value)} placeholder="Description (optional)" className={inputCls}/></div>;
      }
      if (block.type === 'audio') {
        const uploadKey = `universal-audio-${kind}-${sectionIdx ?? 'root'}-${idx}-${blockIdx}`;
        const isUploading = uploadingCustomImage === uploadKey;
        const importAudio = async (file) => {
          if (!file) return;
          setUploadingCustomImage(uploadKey);
          try {
            const url = await uploadAudioToStorage(file);
            if (url) {
              setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'url', url);
              setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'label', file.name);
              dispatchCmsNotice(`${file.name} uploaded successfully.`);
            }
          } finally {
            setUploadingCustomImage(null);
          }
        };

        return (
          <div className="space-y-3">
            <div
              className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/70 p-5 text-center transition hover:border-blue-400 dark:border-gray-700 dark:bg-[#1f1f1f]"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={async (e) => {
                e.preventDefault();
                await importAudio(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-sm text-blue-600 dark:border-gray-700 dark:bg-[#242424]">▶</div>
              <p className="font-[Arial] text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600 dark:text-gray-300">Drop Audio / Voice Note</p>
              <p className="mt-1 text-[9px] text-gray-400">MP3 disarankan · M4A · WAV · OGG · AAC — max 20 MB</p>
              <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 font-[Arial] text-[9px] font-bold uppercase tracking-wide text-gray-600 transition hover:border-blue-500 hover:text-blue-600 dark:border-gray-700 dark:bg-[#242424] dark:text-gray-300">
                {isUploading ? 'Uploading…' : 'Choose Audio'}
                <input
                  type="file"
                  accept=".mp3,.m4a,.wav,.ogg,.aac,audio/*"
                  disabled={isUploading}
                  onChange={async (e) => {
                    await importAudio(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
              {block.label && <p className="mt-3 text-[10px] text-green-700 dark:text-green-400">✓ {block.label}</p>}
            </div>

            {block.url && (
              <audio src={block.url} controls preload="metadata" className="w-full" />
            )}

            <div>
              <p className="mb-1 font-[Arial] text-[8px] font-bold uppercase tracking-[0.12em] text-gray-400">Or use a direct audio URL</p>
              <input
                value={block.url || ''}
                onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'url', e.target.value)}
                placeholder="https://.../audio.mp3"
                className={inputCls}
              />
              <p className="mt-1 text-[9px] text-gray-400">A Google Drive /view page is not a direct audio URL. For voice notes, uploading the file directly above is the safest option.</p>
            </div>

            <input value={block.caption || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'caption', e.target.value)} placeholder="Description / caption (optional)" className={inputCls}/>
          </div>
        );
      }
      if (block.type === 'link' || block.type === 'file') {
        return <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><input value={block.label || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'label', e.target.value)} placeholder={block.type === 'file' ? 'File / button name' : 'Link label'} className={inputCls}/><input value={block.url || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'url', e.target.value)} placeholder={block.type === 'file' ? 'URL file / PDF' : 'https://...'} className={inputCls}/></div>;
      }
      if (block.type === 'word') {
        const convertingKey = `universal-word-${kind}-${sectionIdx ?? 'root'}-${idx}-${blockIdx}`;
        const importDocument = async (file) => {
          if (!file) return;
          const maxBytes = 10 * 1024 * 1024;
          if (file.size > maxBytes) {
            dispatchCmsNotice('Dokumen terlalu besar. Maksimal 10 MB.');
            return;
          }

          const ext = (file.name.split('.').pop() || '').toLowerCase();
          if (!['docx', 'txt', 'md', 'markdown'].includes(ext)) {
            dispatchCmsNotice('Unsupported format. Use DOCX, TXT, or MD.');
            return;
          }

          setConvertingCustomWord(convertingKey);
          try {
            let html = '';
            if (ext === 'docx') {
              html = await convertWordFileToHtml(file);
            } else {
              const raw = await file.text();
              const escapeHtml = (value) => String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

              if (ext === 'md' || ext === 'markdown') {
                // Lightweight Markdown import: keeps the CMS/public bundle lean.
                // It intentionally handles common writing syntax only; the result remains editable.
                const inline = (value) => escapeHtml(value)
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/__(.+?)__/g, '<strong>$1</strong>')
                  .replace(/\*(.+?)\*/g, '<em>$1</em>')
                  .replace(/_(.+?)_/g, '<em>$1</em>')
                  .replace(/`(.+?)`/g, '<code>$1</code>')
                  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

                const rows = raw.replace(/\r\n?/g, '\n').split('\n');
                const parts = [];
                let list = [];
                const flushList = () => {
                  if (!list.length) return;
                  parts.push(`<ul>${list.map((entry) => `<li>${inline(entry)}</li>`).join('')}</ul>`);
                  list = [];
                };

                rows.forEach((row) => {
                  const trimmed = row.trim();
                  const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
                  const bullet = trimmed.match(/^[-*]\s+(.+)$/);
                  if (bullet) {
                    list.push(bullet[1]);
                    return;
                  }
                  flushList();
                  if (!trimmed) parts.push('<p><br></p>');
                  else if (heading) parts.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
                  else if (/^>\s?/.test(trimmed)) parts.push(`<blockquote>${inline(trimmed.replace(/^>\s?/, ''))}</blockquote>`);
                  else parts.push(`<p>${inline(row)}</p>`);
                });
                flushList();
                html = parts.join('');
              } else {
                html = raw
                  .replace(/\r\n?/g, '\n')
                  .split(/\n{2,}/)
                  .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
                  .join('');
              }
            }

            if (html != null) {
              setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'text', html);
              setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'label', file.name);
              dispatchCmsNotice(`${file.name} imported successfully. Review the result before Save Changes.`);
            }
          } catch (error) {
            console.error('Document import failed:', error);
            dispatchCmsNotice('Document import failed. Try another file or paste it manually.');
          } finally {
            setConvertingCustomWord(null);
          }
        };

        return (
          <div className="space-y-4">
            <div
              className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/70 p-5 text-center transition hover:border-blue-400 dark:border-gray-700 dark:bg-[#1f1f1f]"
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={async (e) => {
                e.preventDefault();
                await importDocument(e.dataTransfer.files?.[0]);
              }}
            >
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white font-[Arial] text-sm font-bold text-blue-600 dark:border-gray-700 dark:bg-[#242424]">W</div>
              <label className="block font-[Arial] text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600 dark:text-gray-300">
                Drop dokumen di sini
              </label>
              <p className="mt-1 text-[9px] text-gray-400">DOCX · TXT · MD — maksimal 10 MB</p>
              <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 font-[Arial] text-[9px] font-bold uppercase tracking-wide text-gray-600 transition hover:border-blue-500 hover:text-blue-600 dark:border-gray-700 dark:bg-[#242424] dark:text-gray-300">
                {convertingCustomWord === convertingKey ? 'Memproses…' : 'Select Dokumen'}
                <input
                  type="file"
                  accept=".docx,.txt,.md,.markdown,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={convertingCustomWord === convertingKey}
                  onChange={async (e) => {
                    await importDocument(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
              {convertingCustomWord === convertingKey && <p className="mt-3 text-[10px] font-semibold text-blue-600">Lagi membaca dokumen…</p>}
              {block.label && <p className="mt-3 text-[10px] text-green-700 dark:text-green-400">✓ Imported from {block.label}</p>}
              <p className="mx-auto mt-3 max-w-xl text-[9px] leading-relaxed text-gray-400">Documents are only used during CMS import. The imported content is stored with the work, so visitors do not need to load the DOCX/TXT/MD file.</p>
            </div>
            <RichTextEditor
              key={`universal-word-editor-${block.id}-${block.label || 'manual'}`}
              initialValue={block.text || ''}
              onChange={(html) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'text', html)}
              placeholder="Imported content appears here and can still be edited like regular content..."
              compact
            />
          </div>
        );
      }
      if (block.type === 'embed') {
        return <textarea rows={4} value={block.text || ''} onChange={(e) => setUniversalBlockField(kind, idx, sectionIdx, blockIdx, 'text', e.target.value)} placeholder="Paste a URL or embed code..." className={`${inputCls} resize-y font-[Arial] text-[11px]`}/>;
      }
      return <p className="font-[Arial] text-[10px] text-gray-400">Divider does not require content.</p>;
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-[Arial] text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Work Content</p>
            <p className="mt-1 text-[11px] text-gray-400">Studio uses these blocks as the main content. Add, reorder, and mix only what this work needs.</p>
          </div>
          {!!blocks.length && <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setAllUniversalBlocksExpanded(blocks, true)} className="rounded border border-gray-200 px-2 py-1 font-[Arial] text-[8px] font-bold uppercase tracking-wide hover:border-blue-400 hover:text-blue-600 dark:border-gray-700">Expand All</button>
            <button type="button" onClick={() => setAllUniversalBlocksExpanded(blocks, false)} className="rounded border border-gray-200 px-2 py-1 font-[Arial] text-[8px] font-bold uppercase tracking-wide hover:border-blue-400 hover:text-blue-600 dark:border-gray-700">Collapse All</button>
          </div>}
        </div>

        {blocks.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-200 px-5 py-8 text-center dark:border-gray-700">
            <p className="font-[Arial] text-xs font-bold text-gray-500 dark:text-gray-400">No universal content blocks yet.</p>
            <p className="mt-1 text-[10px] text-gray-400">Add Text, Image, Gallery, Video, Audio/VN, Link, File/PDF, Import Doc, Embed, or Divider as needed.</p>
          </div>
        )}

        {blocks.map((block, blockIdx) => {
          const isExpanded = expandedUniversalBlockIds.has(block.id);
          const rawPreview = block.type === 'text' || block.type === 'word'
            ? String(block.text || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
            : block.caption || block.label || (block.type === 'gallery' ? `${block.items?.length || 0} images` : block.url || '');
          const preview = rawPreview.length > 58 ? `${rawPreview.slice(0, 58).trimEnd()}…` : rawPreview;
          return (
          <div key={block.id || blockIdx} className={`rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#242424] ${isExpanded ? 'p-4 md:p-5' : 'px-3 py-2.5'}`}>
            <div className={`${isExpanded ? 'mb-4' : ''} flex items-center justify-between gap-3`}>
              <button type="button" onClick={() => toggleUniversalBlock(block.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" title={isExpanded ? 'Collapse block' : 'Expand block'}>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-md border border-gray-200 px-1.5 font-[Arial] text-[10px] font-bold text-blue-600 dark:border-gray-700">{UNIVERSAL_BLOCK_TYPES.find((entry) => entry.type === block.type)?.icon || '•'}</span>
                <span className="min-w-0">
                  <strong className="block font-[Arial] text-[10px] uppercase tracking-[0.14em] text-gray-700 dark:text-gray-200">{UNIVERSAL_BLOCK_TYPES.find((entry) => entry.type === block.type)?.label || block.type}</strong>
                  {!isExpanded && <span className="mt-0.5 block truncate text-[9px] text-gray-400">{preview || 'Empty block'}</span>}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" disabled={blockIdx === 0} onClick={() => moveUniversalBlock(kind, idx, sectionIdx, blockIdx, -1)} title="Move up" className="rounded border border-gray-200 px-2 py-1 text-[10px] disabled:opacity-25 dark:border-gray-700">↑</button>
                <button type="button" disabled={blockIdx === blocks.length - 1} onClick={() => moveUniversalBlock(kind, idx, sectionIdx, blockIdx, 1)} title="Move down" className="rounded border border-gray-200 px-2 py-1 text-[10px] disabled:opacity-25 dark:border-gray-700">↓</button>
                <button type="button" onClick={() => toggleUniversalBlock(block.id)} title={isExpanded ? 'Collapse' : 'Expand'} className="rounded border border-gray-200 px-2 py-1 text-[10px] dark:border-gray-700">{isExpanded ? '▴' : '▾'}</button>
                <button type="button" onClick={() => removeUniversalBlock(kind, idx, sectionIdx, blockIdx)} title="Delete block" className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-600 dark:border-red-900/50">×</button>
              </div>
            </div>
            {isExpanded && <>
              {blockBody(block, blockIdx)}
              {renderBlockDisplayControls(kind, idx, sectionIdx, block, blockIdx)}
            </>}
          </div>
          );
        })}

        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-[#1f1f1f]">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-[Arial] text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400">+ Add Content</p>
              <p className="mt-1 text-[9px] text-gray-400">Use the available blocks. Import Doc converts a document into editable content instead of placing the raw document on the public page.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 md:grid-cols-10">
            {UNIVERSAL_BLOCK_TYPES.map((entry) => (
              <button
                key={entry.type}
                type="button"
                onClick={() => addUniversalBlock(kind, idx, sectionIdx, entry.type)}
                title={
                  entry.type === 'word' ? 'Drop/import DOCX, TXT, or MD, then edit the result' :
                  entry.type === 'text' ? 'Rich text editor' :
                  entry.type === 'image' ? 'Single image' :
                  entry.type === 'gallery' ? 'Multiple images' :
                  entry.type === 'video' ? 'Video or embed' :
                  entry.type === 'audio' ? 'Audio / voice note' :
                  entry.type === 'link' ? 'External link' :
                  entry.type === 'file' ? 'File/PDF' :
                  entry.type === 'embed' ? 'URL or embed' :
                  'Content divider'
                }
                className={`flex min-h-[68px] flex-col items-center justify-center rounded-lg border bg-white px-2 py-2 text-center transition dark:bg-[#242424] ${entry.type === 'word' ? 'border-blue-300 text-blue-600 hover:border-blue-600 dark:border-blue-800' : 'border-gray-200 hover:border-blue-500 hover:text-blue-600 dark:border-gray-700'}`}
              >
                <span className="font-[Arial] text-sm font-bold">{entry.icon}</span>
                <span className="mt-1 font-[Arial] text-[8px] font-bold uppercase tracking-wide">{entry.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

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
    } else if (listKey === 'bitsAndPieces') {
      setFormData((p) => {
        const items = [...(p.about.bitsAndPieces?.items || [])];
        if (toIdx >= items.length) return p;
        const [moved] = items.splice(fromIdx, 1);
        items.splice(toIdx, 0, moved);
        return { ...p, about: { ...p.about, bitsAndPieces: { ...p.about.bitsAndPieces, items } } };
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

  // Blok form 1 item Poster — file langsung tanpa Sub Bab, tinggal "Add Poster"
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
        <input type="text" value={it.title} onChange={(e) => setPosterItemField(idx, 'title', e.target.value)} placeholder="Title" className={inputClsSm} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input type="text" value={it.category} onChange={(e) => setPosterItemField(idx, 'category', e.target.value)} placeholder="Category" className={inputClsSm} />
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
              if (!(await validateProjectCover(file, 'image'))) { e.target.value = ''; return; }
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
        <ImageUploadNote profile="poster" />
        <input type="text" value={it.imageUrl} onChange={(e) => setPosterItemField(idx, 'imageUrl', e.target.value)} placeholder="Or paste an image URL (from another gallery/host)" className={inputClsSm} />

        <RichTextEditor fieldMode initialValue={it.description} onChange={(html) => setPosterItemField(idx, 'description', html)} placeholder="Short description (work context)" />
      </ContentCard>
    );
  };

  // Blok form 1 Tab Addan (Custom Section) — label tab (bisa diedit/dihapus) + daftar
  // kartu sederhana di dalamnya (judul, kategori, gambar, deskripsi, link opsional).
  // Sama kayak renderPosterItem: fungsi biasa yang nge-return JSX, BUKAN komponen
  // JSX tag, biar input gak kehilangan fokus tiap ngetik (lihat catatan di
  // renderPosterItem soal kenapa ini penting).
  //
  // Beda dari renderPosterItem: gak ada collapse/expand di sini, soalnya
  // masing-masing custom section UDAH dapet pill nav sendiri di atas (sejajar
  // Articles/Poster) — jadi "buka" section ini ya klik pill-nya langsung, gak perlu
  // tombol Edit/Close terpisah lagi kayak dulu waktu semua numpuk di 1 wrapper tab.
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
            placeholder="Tab Name (e.g. Dummy Projects, Experiments) — shown in the pill navigation"
            className={`${inputClsSm} font-semibold flex-1`}
          />
          <RemoveBtn onClick={() => removeCustomSection(sectionIdx)} label="Remove Tab Ini" />
        </div>

        <Field label="Tab Card Description (leave blank to remove)">
          <input value={section.description || ''} onChange={(e) => setCustomSectionDescription(sectionIdx, e.target.value)} className={inputClsSm} />
        </Field>

        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Tab Content Type</label>
          <select value={contentType} onChange={(e) => setCustomSectionContentType(sectionIdx, e.target.value)} className={inputClsSm}>
            <option value="writing">Writing — Cerpen, puisi, esai, script</option>
            <option value="video">Video — Film, directing, reel</option>
            <option value="image">Image — Poster, foto, visual</option>
            <option value="document">Document — PDF, Word, laporan</option>
            <option value="link">External Link — Work hosted on another website</option>
            <option value="audio">Audio — Voice note / MP3</option>
          </select>
          <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">The item form below automatically follows this type. Changing the type does not delete existing data; irrelevant fields are only hidden.</p>
        </div>

        <div className="space-y-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Item ({items.length})
            </h4>
            <AddBtn onClick={() => addCustomItem(sectionIdx)} label="Add Item" />
          </div>

          {items.length === 0 && (
            <p className="text-[10px] text-gray-400 italic">No items yet.</p>
          )}

          {items.map((it, idx) => (
            <ContentCard
              key={it.id || idx}
              cardKey={`custom-${sectionIdx}-${it.id || idx}`}
              listKey={`custom:${sectionIdx}`}
              idx={idx}
              count={items.length}
              title={it.title || `Item #${idx + 1}`}
              subtitle={it.category || 'No category'}
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
              <input type="text" value={it.title} onChange={(e) => setCustomItemField(sectionIdx, idx, 'title', e.target.value)} placeholder="Title" className={inputClsSm} />
              <input type="text" value={it.category} onChange={(e) => setCustomItemField(sectionIdx, idx, 'category', e.target.value)} placeholder="Category (optional)" className={inputClsSm} />

              {['writing', 'video', 'image', 'document', 'link'].includes(contentType) && (
                <>
                  <div className="flex items-center gap-2">
                    {it.imageUrl && <img src={it.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded object-cover border border-gray-300 dark:border-gray-600" />}
                    <input type="file" accept="image/*" disabled={uploadingCustomImage === `${sectionIdx}-${idx}`} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; if (!(await validateProjectCover(file, contentType))) { e.target.value = ''; return; } setUploadingCustomImage(`${sectionIdx}-${idx}`); const url = await uploadImageToStorage(file); setUploadingCustomImage(null); if (url) setCustomItemField(sectionIdx, idx, 'imageUrl', url); e.target.value = ''; }} className="flex-1 text-[10px]" />
                  </div>
                  <ProjectCoverHint contentType={contentType} />
                  <ImageUploadNote profile={contentType === 'video' ? 'video' : contentType === 'image' ? 'poster' : 'default'} />
                  <input type="text" value={it.imageUrl || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'imageUrl', e.target.value)} placeholder={contentType === 'video' ? 'URL thumbnail/poster' : 'Or paste an image / cover URL'} className={inputClsSm} />
                </>
              )}

              <RichTextEditor fieldMode initialValue={it.description || ''} onChange={(html) => setCustomItemField(sectionIdx, idx, 'description', html)} placeholder={contentType === 'video' ? 'Premise / video summary' : 'Short description'} />

              {contentType === 'writing' && (
                <div className="space-y-3 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
                  <RichTextEditor key={`${it.id || idx}-${it.wordFileName || 'manual'}`} initialValue={it.wordContent || ''} onChange={(html) => setCustomItemField(sectionIdx, idx, 'wordContent', html)} placeholder="Write a short story, poem, essay, or script here..." />
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Or import from Word (.docx)</label>
                    <input type="file" accept=".docx" disabled={convertingCustomWord === `${sectionIdx}-${idx}`} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; setConvertingCustomWord(`${sectionIdx}-${idx}`); const html = await convertWordFileToHtml(file); setConvertingCustomWord(null); if (html != null) { setCustomItemField(sectionIdx, idx, 'wordContent', html); setCustomItemField(sectionIdx, idx, 'wordFileName', file.name); } e.target.value = ''; }} className="w-full text-[10px]" />
                    {convertingCustomWord === `${sectionIdx}-${idx}` && <p className="mt-1 text-[10px] font-semibold text-blue-600">Lagi mengonversi Word...</p>}
                    {it.wordFileName && <p className="mt-1 text-[10px] text-green-700 dark:text-green-400">✓ Imported from {it.wordFileName}</p>}
                  </div>
                </div>
              )}

              {contentType === 'video' && (
                <div className="space-y-2 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3"><input value={it.role || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'role', e.target.value)} placeholder="Role" className={inputClsSm} /><input value={it.year || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'year', e.target.value)} placeholder="Tahun" className={inputClsSm} /><input value={it.runtime || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'runtime', e.target.value)} placeholder="Durasi" className={inputClsSm} /></div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.35fr_1fr]"><select value={it.mediaType || 'youtube'} onChange={(e) => setCustomItemField(sectionIdx, idx, 'mediaType', e.target.value)} className={inputClsSm}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="drive">Google Drive</option><option value="video">MP4/WebM</option><option value="external">External</option></select><input value={it.mediaUrl || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'mediaUrl', e.target.value)} placeholder="URL video" className={inputClsSm} /></div>
                  <Field label="Credits / Production Notes"><RichTextEditor key={`custom-video-${it.id || idx}`} initialValue={it.credits || ''} onChange={(html) => setCustomItemField(sectionIdx, idx, 'credits', html)} placeholder="Cast, crew, contribution, and production notes..." /></Field>
                </div>
              )}

              {contentType === 'image' && <input value={it.dimensions || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'dimensions', e.target.value)} placeholder="Dimensions / medium / year (optional)" className={inputClsSm} />}

              {contentType === 'document' && (
                <div className="space-y-2 border-t border-dashed border-gray-200 pt-3 dark:border-gray-700">
                  <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" disabled={uploadingCustomImage === `file-${sectionIdx}-${idx}`} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; setUploadingCustomImage(`file-${sectionIdx}-${idx}`); const url = await uploadImageToStorage(file); setUploadingCustomImage(null); if (url) { setCustomItemField(sectionIdx, idx, 'fileUrl', url); setCustomItemField(sectionIdx, idx, 'fileName', file.name); } e.target.value = ''; }} className="w-full text-[10px]" />
                  {it.fileName && <p className="text-[10px] text-green-700 dark:text-green-400">✓ {it.fileName}</p>}
                </div>
              )}

              {['document', 'link', 'writing', 'video'].includes(contentType) && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2"><input value={it.buttonLabel || ''} onChange={(e) => setCustomItemField(sectionIdx, idx, 'buttonLabel', e.target.value)} placeholder="Button label (optional)" className={inputClsSm} /><input value={contentType === 'document' ? (it.fileUrl || '') : (it.url || '')} onChange={(e) => setCustomItemField(sectionIdx, idx, contentType === 'document' ? 'fileUrl' : 'url', e.target.value)} placeholder="Destination URL (optional)" className={inputClsSm} /></div>
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

  const translationSourceForTab = () => {
    switch (activeTab) {
      case 'home': return {
        source: formData.home, rootPath: 'home',
        allowedPaths: ['home.name', 'home.role', 'home.dynamicStatement.prefix', 'home.dynamicStatement.connector', 'home.dynamicStatement.highlightedWord', 'home.dynamicStatement.pairs'],
      };
      case 'featuredWorks': return {
        source: { featuredWorksHeading: formData.home?.featuredWorksHeading || '', featuredWorks: formData.home?.featuredWorks || [] },
        rootPath: 'home',
        allowedPaths: ['home.featuredWorksHeading', 'home.featuredWorks'],
      };
      case 'about': return {
        source: formData.about, rootPath: 'about',
        allowedPaths: ['about.heading', 'about.subheading', 'about.headline', 'about.locationLine', 'about.bio', 'about.signature', 'about.authorNoteTabLabel', 'about.bitsTabLabel', 'about.bitsAndPieces.items', 'about.listeningFootnote.nowPlayingLabel', 'about.listeningFootnote.lastPlayedLabel', 'about.listeningFootnote.fallbackLabel', 'about.listeningFootnote.fallbackTitle', 'about.listeningFootnote.fallbackArtist', 'about.listeningFootnote.accentColor'],
      };
      case 'career': return {
        source: formData.career, rootPath: 'career',
        allowedPaths: ['career.heading', 'career.subheading', 'career.archiveTitle', 'career.archiveIntro', 'career.archiveButtonLabel', 'career.credentialsButtonLabel', 'career.credentialsHeading', 'career.credentialsSubheading', 'career.credentialsBackLabel', 'career.backLabel', 'career.categories'],
      };
      case 'book': return {
        source: formData.books, rootPath: 'books',
        allowedPaths: ['books.heading', 'books.subheading', 'books.worksTabLabel', 'books.readingTabLabel', 'books.backLabel', 'books.items', 'books.readingItems'],
      };
      case 'projects': return {
        source: formData.projects, rootPath: 'projects',
        allowedPaths: ['projects.heading', 'projects.subheading', 'projects.indexHeading', 'projects.indexDescription', 'projects.searchLabel', 'projects.openDrawerLabel', 'projects.backLabel', 'projects.articlesLabel', 'projects.articlesDescription', 'projects.posterLabel', 'projects.posterDescription', 'projects.directingLabel', 'projects.directingDescription', 'projects.articlesDeleted', 'projects.directingDeleted', 'projects.posterDeleted', 'projects.articles', 'projects.poster', 'projects.directing', 'projects.customSections'],
      };
      case 'contact': return {
        source: formData.contact, rootPath: 'contact',
        allowedPaths: ['contact.heading', 'contact.subheading', 'contact.email', 'contact.location', 'contact.formTitle', 'contact.responseNote', 'contact.draftButtonLabel', 'contact.propertiesTitle', 'contact.nameLabel', 'contact.emailLabel', 'contact.messagePromptLabel', 'contact.attachmentNote', 'contact.otherChannelLabel', 'contact.properties', 'contact.inquiryPaths', 'contact.actionButtons', 'contact.socials'],
      };
      case 'visitorIntroduction': return {
        source: formData.home?.visitorIntroduction || {}, rootPath: 'home.visitorIntroduction',
        allowedPaths: ['home.visitorIntroduction.kicker', 'home.visitorIntroduction.title', 'home.visitorIntroduction.recipient', 'home.visitorIntroduction.body', 'home.visitorIntroduction.closing', 'home.visitorIntroduction.documentCode', 'home.visitorIntroduction.documentIndexLabel', 'home.visitorIntroduction.printedLabel', 'home.visitorIntroduction.quickViewLabel', 'home.visitorIntroduction.experienceLabel', 'home.visitorIntroduction.selectedWorksLabel', 'home.visitorIntroduction.contactLabel', 'home.visitorIntroduction.closeLabel', 'home.visitorIntroduction.triggerEyebrow', 'home.visitorIntroduction.triggerTitle', 'home.visitorIntroduction.triggerAction'],
      };
      case 'zine': return {
        source: formData.zine, rootPath: 'zine',
        allowedPaths: ['zine.menuLabel', 'zine.title', 'zine.writePrompt', 'zine.submitSuccess', 'zine.entries'],
      };
      case 'miniGame': return {
        source: formData.miniGame, rootPath: 'miniGame',
        allowedPaths: ['miniGame.menuLabel', 'miniGame.libraryTitle', 'miniGame.libraryDescription', 'miniGame.gameName', 'miniGame.gameCategory', 'miniGame.gameCardDescription', 'miniGame.title', 'miniGame.objective', 'miniGame.rules', 'miniGame.startButtonLabel', 'miniGame.gradeTitles', 'miniGame.resultEyebrow', 'miniGame.replayLabel', 'miniGame.projectsCtaLabel', 'miniGame.contactCtaLabel', 'miniGame.drafts', 'miniGame.gameSlots'],
      };
      case 'interactiveWords': return {
        source: formData.interactiveWords, rootPath: 'interactiveWords',
        allowedPaths: ['interactiveWords'],
      };
      case 'leaderboardSystems': return { source: {}, rootPath: '', allowedPaths: [] };
      case 'general': return {
        source: formData.general, rootPath: 'general',
        allowedPaths: ['general.welcomeNotification.title', 'general.welcomeNotification.message', 'general.welcomeNotification.items', 'general.welcomeNotification.version', 'general.welcomeNotification.accentColor', 'general.soundEffects'],
      };
      case 'websikee': return { source: {}, rootPath: '', allowedPaths: [] };
      default: return { source: {}, rootPath: '', allowedPaths: [] };
    }
  };
  const currentTranslationSource = translationSourceForTab();
  const setEnglishTranslation = (path, value) => setFormData((previous) => ({
    ...previous,
    translations: withEnglishTranslation(previous.translations, path, value),
  }));

  return (
    <CmsCardContext.Provider value={{ expandedContentKey, draggingKey, toggleContentCard, reorderList, handleDragStart, handleDragEnd, handleDragOver, handleDrop, openSectionKeys, toggleSection }}>
    <div data-cms-language-root="true" className="fixed inset-0 z-[140] flex h-dvh w-screen flex-col overflow-hidden bg-[#f3f3f3] p-4 font-[Arial] text-gray-900 dark:bg-[#161616] dark:text-gray-100 md:p-6">

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/55 px-4" role="dialog" aria-modal="true" aria-labelledby="cancel-cms-title">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202020] shadow-2xl">
            <div className="bg-[#2B579A] px-5 py-3 text-white">
              <h2 id="cancel-cms-title" className="font-[Arial] text-sm font-bold tracking-wider">SAYA SATPAM!</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 dark:text-gray-200">Discard all unsaved changes?</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCancelConfirm(false)} className="rounded-md bg-gray-200 dark:bg-gray-700 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600">Lanjut Edit</button>
                <button type="button" onClick={discardChanges} className="rounded-md bg-[#2B579A] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a84]">Ya, Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/55 px-4" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202020] shadow-2xl">
            <div className="bg-[#2B579A] px-5 py-3 text-white"><h2 className="font-[Arial] text-sm font-bold tracking-wider">SAYA SATPAM!</h2></div>
            <div className="p-5"><p className="text-sm text-gray-700 dark:text-gray-200">{notice}</p><div className="mt-5 flex justify-end"><button type="button" onClick={() => setNotice('')} className="rounded-md bg-[#2B579A] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a84]">Oke</button></div></div>
          </div>
        </div>
      )}

      {/* HEADER & TOMBOL GLOBAL SAVE / NOPE */}
      <div className="mx-auto flex w-full max-w-[1600px] shrink-0 flex-col items-start justify-between gap-4 border-b border-gray-300 pb-4 dark:border-gray-700 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold font-[Arial]">CMS ADMIN CONTROL PANEL</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Edit all website content and features here — changes go live on the public site after you press Save Changes.
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
          <div className="flex items-center overflow-hidden rounded border border-red-300 bg-red-600 shadow-sm">
            <button
              type="button"
              onClick={requestWebsiteRecording}
              className="inline-flex h-8 items-center gap-1.5 px-3 text-xs font-bold text-white transition hover:bg-red-500"
              title="Record Website"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />
              Record Website
            </button>
            <select
              value={recordQuality}
              onChange={(event) => setRecordQuality(event.target.value)}
              className="h-8 border-l border-red-300 bg-red-700 px-2 text-[10px] font-bold text-white outline-none"
              title="Recording quality"
              aria-label="Recording quality"
            >
              <option value="720" className="bg-white text-black">720p</option>
              <option value="1080" className="bg-white text-black">1080p</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => onExitAdmin?.()}
            disabled={!onExitAdmin}
            title="Exit CMS Admin"
            aria-label="Exit CMS Admin"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-orange-300 bg-orange-500 text-black shadow-sm transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-orange-400 dark:bg-orange-500 dark:text-black dark:hover:bg-orange-400"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.8 19c.7-3.2 3-5 6.2-5s5.5 1.8 6.2 5" />
            </svg>
          </button>
        </div>
      </div>

      {showAdminWelcome && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="cms-welcome-title">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-[#202020]">
            <div className="bg-[#2B579A] px-5 py-3 text-white">
              <h2 id="cms-welcome-title" className="font-[Arial] text-sm font-bold tracking-wider">SAYA SATPAM!</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 dark:text-gray-200">what do you want to work on here?</p>
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={() => setShowAdminWelcome(false)} className="rounded-md bg-[#2B579A] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a84]">
                  Siap, Pak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form id="cms-admin-form" onSubmit={handleSave} className={`mx-auto mt-4 min-h-0 w-full max-w-[1600px] flex-1 overflow-y-auto overscroll-contain ${activeTab === null ? 'bg-transparent' : 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#1e1e1e] md:p-7'}`}>

      {activeTab === null ? (
        <div className="flex min-h-full w-full items-center justify-center py-8 md:py-12">
          {cmsSection === null ? (
            <div className="w-full max-w-3xl">
              <div className="mb-7 text-center">
                <h2 className="font-[Arial] text-2xl font-bold text-gray-900 dark:text-white">Yip Yap, Ale!</h2>
                <p className="mt-2 font-[Arial] text-xs font-semibold text-blue-600 dark:text-blue-400">what do you want to manage today?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {[
                  { key: 'main', title: 'MAIN' },
                  { key: 'side', title: 'SIDE' },
                  { key: 'extra', title: 'INTERACTIVE' },
                  { key: 'websikee', title: 'WEBSIKEE!' },
                ].map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => {
                      if (group.key === 'websikee') { setCmsSection('websikee'); setActiveTab('websikee'); }
                      else setCmsSection(group.key);
                    }}
                    className="group flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#242424] md:min-h-[170px] md:p-5"
                  >
                    <span className="text-gray-400 transition-colors group-hover:text-blue-600 dark:text-gray-500 dark:group-hover:text-blue-400"><CmsMenuIllustration type={group.key} /></span>
                    <strong className="mt-4 block font-[Arial] text-sm font-bold uppercase tracking-[0.12em] text-gray-900 dark:text-white md:text-base">{group.title}</strong>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-5xl">
              <div className="mb-6 border-b border-gray-300 pb-4 dark:border-gray-700">
                <button type="button" onClick={() => setCmsSection(null)} className="mb-3 inline-flex items-center gap-1.5 font-[Arial] text-xs text-gray-500 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">← Back</button>
                <h2 className="font-[Arial] text-2xl font-bold text-gray-900 dark:text-white">{cmsSection === 'main' ? 'MAIN' : cmsSection === 'side' ? 'SIDE' : 'INTERACTIVE'}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                {(cmsSection === 'main' ? MAIN_TABS : cmsSection === 'side' ? SIDE_TABS : EXTRA_TABS).map((tab) => {
                  const meta = TAB_META[tab];
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className="group flex min-h-[142px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#242424] md:min-h-[156px] md:p-5"
                    >
                      <span className="text-gray-400 transition-colors group-hover:text-blue-600 dark:text-gray-500 dark:group-hover:text-blue-400"><CmsMenuIllustration type={tab} /></span>
                      <strong className="mt-4 block font-[Arial] text-xs font-bold uppercase tracking-[0.1em] text-gray-900 dark:text-white md:text-sm">{meta.label}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
      <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
          <button
            type="button"
            onClick={() => { setActiveTab(null); setActiveMiniGameEditor(null); if (cmsSection === 'websikee') setCmsSection(null); }}
            className="inline-flex items-center gap-1.5 font-[Arial] text-xs text-gray-500 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            <span>←</span> Back
          </button>
          <div className="text-right">
            <p className="font-[Arial] text-[9px] font-bold uppercase tracking-[0.18em] text-blue-600">{cmsSection === 'main' ? 'MAIN' : cmsSection === 'side' ? 'SIDE' : cmsSection === 'websikee' ? 'WEBSIKEE!' : 'INTERACTIVE'}</p>
            <p className="font-[Arial] text-sm font-bold uppercase text-gray-800 dark:text-gray-100">{TAB_META[activeTab]?.label || activeTab}</p>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-[#282828]">
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Content Language</p>
            <p className="text-[10px] text-gray-400">Edit in the same tab. ID is the source; EN is your official English version.</p>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-md border border-gray-300 bg-white font-[Arial] text-[10px] font-bold dark:border-gray-600 dark:bg-[#1e1e1e]">
            <button type="button" onClick={() => setCmsLanguage('id')} className={`px-3 py-1.5 ${cmsLanguage === 'id' ? 'bg-[#2B579A] text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}`}>ID</button>
            <button type="button" onClick={() => setCmsLanguage('en')} className={`border-l border-gray-300 px-3 py-1.5 dark:border-gray-600 ${cmsLanguage === 'en' ? 'bg-[#2B579A] text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}`}>EN</button>
          </div>
        </div>

        {/* ================= WEBSITE SHARING PREVIEW & SEO ================= */}
        {activeTab === 'websikee' && (
          <section className="space-y-6">
            <div>
              <p className="font-[Arial] text-[9px] font-bold uppercase tracking-[0.18em] text-blue-600">CMS SETTINGS</p>
              <h2 className="font-[Arial] text-xl font-bold text-gray-900 dark:text-white">Website Settings, Social Sharing &amp; Google SEO</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                Manage global website metadata, custom social link sharing previews, and Google SEO search configuration.
              </p>
            </div>

            {/* SECTION 1: GENERAL WEBSITE IDENTITY */}
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#242424]">
              <h3 className="font-[Arial] text-xs font-bold uppercase tracking-[0.14em] text-gray-700 dark:text-gray-200">
                1. General Website Identity
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Website Default Title" sourceValue={sourceFormData.website?.title || ''} cmsLanguage={cmsLanguage}>
                  <input
                    type="text"
                    value={formData.website?.title || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), title: val } }));
                      setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), title: val } }));
                    }}
                    className={inputCls}
                    placeholder="Haikal A. Hafidz — Content Writer & Editor"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Default title used across site tabs when specific SEO title is empty.</p>
                </Field>

                <Field label="Website Default URL" sourceValue={sourceFormData.website?.url || 'https://haikal-hafidz.github.io/'} cmsLanguage={cmsLanguage}>
                  <input
                    type="url"
                    value={formData.website?.url || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), url: val } }));
                      setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), url: val } }));
                    }}
                    className={inputCls}
                    placeholder="https://haikal-hafidz.github.io/"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Primary deployed website URL.</p>
                </Field>
              </div>

              <Field label="Website Default Description" sourceValue={sourceFormData.website?.description || ''} cmsLanguage={cmsLanguage}>
                <RichTextEditor
                  fieldMode
                  initialValue={formData.website?.description || ''}
                  onChange={(html) => {
                    setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), description: html } }));
                    setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), description: html } }));
                  }}
                  placeholder="Portfolio Haikal A. Hafidz — writing, editing, creative work, and selected projects."
                />
                <p className="mt-1 text-[10px] text-gray-400">Default fallback description for site metadata.</p>
              </Field>

              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Favicon / Browser Tab Icon</p>
                <p className="text-[10px] leading-relaxed text-gray-400">Icon shown in browser tabs beside the Website Title. Overwrites <code className="text-blue-600">website/favicon.png</code> in Supabase storage.</p>
                {sourceFormData.website?.favicon && (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-[#282828]">
                    <img src={sourceFormData.website.favicon} alt="Favicon website" className="h-10 w-10 rounded border border-gray-300 object-cover dark:border-gray-600" />
                    <p className="min-w-0 break-all font-[Arial] text-[9px] text-gray-400">{sourceFormData.website.favicon}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploadingWebsitePreview}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingWebsitePreview(true);
                      const url = await uploadWebsiteFavicon(file);
                      setUploadingWebsitePreview(false);
                      if (url) {
                        setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), favicon: url } }));
                        setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), favicon: url } }));
                      }
                      e.target.value = '';
                    }}
                    className="w-full text-[10px]"
                  />
                  <input
                    type="text"
                    value={formData.website?.favicon || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), favicon: val } }));
                      setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), favicon: val } }));
                    }}
                    className={inputCls}
                    placeholder="Or paste a custom favicon URL"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: SOCIAL SHARING & LINK PREVIEW */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#242424]">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                  <h3 className="font-[Arial] text-xs font-bold uppercase tracking-[0.14em] text-gray-700 dark:text-gray-200">
                    2. Social Sharing / Link Preview
                  </h3>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                    Open Graph Settings
                  </span>
                </div>

                <Field label="Share Title (og:title)" sourceValue={sourceFormData.website?.shareTitle || ''} cmsLanguage={cmsLanguage}>
                  <input
                    type="text"
                    value={formData.website?.shareTitle || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareTitle: val } }));
                      setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareTitle: val } }));
                    }}
                    className={inputCls}
                    placeholder={formData.website?.title || 'Haikal A. Hafidz — Content Writer & Editor'}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Title displayed in link preview cards on WhatsApp, Twitter/X, LinkedIn, and messaging apps. Falls back to Website Title if empty.</p>
                </Field>

                <Field label="Share Description (og:description)" sourceValue={sourceFormData.website?.shareDescription || ''} cmsLanguage={cmsLanguage}>
                  <RichTextEditor
                    fieldMode
                    initialValue={formData.website?.shareDescription || ''}
                    onChange={(html) => {
                      setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareDescription: html } }));
                      setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareDescription: html } }));
                    }}
                    placeholder={formData.website?.description || 'Portfolio Haikal A. Hafidz — writing, editing, creative work, and selected projects.'}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Description displayed beneath the title in link previews. Falls back to Website Description if empty.</p>
                </Field>

                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Share Image (og:image)</p>
                  <p className="text-[10px] leading-relaxed text-gray-400">Uploading an image replaces <code className="text-blue-600">website/share-preview.jpg</code> in Supabase storage, ensuring static crawlers like WhatsApp retrieve the updated asset without changing static HTML paths.</p>
                  {(sourceFormData.website?.shareImage || formData.website?.shareImage) && (
                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-[#282828]">
                      <img src={formData.website?.shareImage || sourceFormData.website?.shareImage} alt="Preview link website" className="h-20 w-32 rounded border border-gray-300 object-cover dark:border-gray-600" />
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: '' } }));
                          setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: '' } }));
                        }}
                        className="text-xs font-semibold text-red-500 hover:text-red-600"
                      >
                        Remove share image
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingWebsitePreview}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingWebsitePreview(true);
                      const url = await uploadWebsiteSharePreview(file);
                      setUploadingWebsitePreview(false);
                      if (url) {
                        setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: url } }));
                        setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: url } }));
                      }
                      e.target.value = '';
                    }}
                    className="w-full text-[10px]"
                  />
                  {uploadingWebsitePreview && <p className="text-[10px] text-blue-500 animate-pulse">Uploading share preview image…</p>}
                  <input
                    type="text"
                    value={formData.website?.shareImage || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: val } }));
                      setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: val } }));
                    }}
                    className={inputCls}
                    placeholder="Or paste an external image URL"
                  />
                </div>
              </div>

              {/* LIVE SOCIAL PREVIEW CARD */}
              <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#242424]">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                  <h3 className="font-[Arial] text-xs font-bold uppercase tracking-[0.14em] text-gray-700 dark:text-gray-200">
                    Social Sharing Visual Preview
                  </h3>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Live Link Card
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  Visual approximation of how your link preview will appear on WhatsApp, Twitter/X, LinkedIn, Discord, and Telegram.
                </p>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-md dark:border-gray-700 dark:bg-[#1c1c1c]">
                  <div className="relative aspect-[1200/630] w-full bg-gray-200 dark:bg-[#2a2a2a] overflow-hidden flex items-center justify-center">
                    {(formData.website?.shareImage || sourceFormData.website?.shareImage) ? (
                      <img
                        src={formData.website?.shareImage || sourceFormData.website?.shareImage}
                        alt="Sharing Preview"
                        className="h-full w-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="p-4 text-center text-xs text-gray-400 italic">
                        No Share Image configured
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-1.5 bg-white dark:bg-[#242424]">
                    <p className="font-[Arial] text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">
                      {(() => {
                        try {
                          const parsed = new URL(formData.website?.canonicalUrl || formData.website?.url || 'https://haikal-hafidz.github.io/');
                          return parsed.hostname;
                        } catch {
                          return 'haikal-hafidz.github.io';
                        }
                      })()}
                    </p>
                    <h4 className="font-[Arial] text-sm font-bold text-gray-900 dark:text-white line-clamp-2">
                      {formData.website?.shareTitle || formData.website?.title || 'Haikal A. Hafidz — Content Writer & Editor'}
                    </h4>
                    <div
                      className="font-[Arial] text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: formData.website?.shareDescription || formData.website?.description || 'Portfolio Haikal A. Hafidz — writing, editing, creative work, and selected projects.'
                      }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/50 text-[11px] text-gray-600 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-gray-300 space-y-1">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">WhatsApp &amp; Crawler Caching Notice:</p>
                  <p>
                    WhatsApp and social platforms cache previously generated link previews. When updating titles or images, WhatsApp may take time or require clearing preview cache before reflecting new preview data. Uploading a preview image writes directly to <code className="text-blue-600">website/share-preview.jpg</code> in Supabase storage so raw static crawlers receive the updated media file.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 3: GOOGLE SEO SETTINGS */}
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#242424]">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                <h3 className="font-[Arial] text-xs font-bold uppercase tracking-[0.14em] text-gray-700 dark:text-gray-200">
                  3. Google SEO Settings
                </h3>
                <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                  Search Engine Metadata
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                Configure search result titles, snippet descriptions, canonical URL directives, and indexing permissions specifically for search engine crawlers (Google, Bing, DuckDuckGo).
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="SEO Title" sourceValue={sourceFormData.website?.seoTitle || ''} cmsLanguage={cmsLanguage}>
                  <input
                    type="text"
                    value={formData.website?.seoTitle || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), seoTitle: val } }));
                      setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), seoTitle: val } }));
                    }}
                    className={inputCls}
                    placeholder={formData.website?.title || 'Haikal A. Hafidz — Content Writer & Editor'}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Preferred title for Google search results. Falls back to Website Title if left empty.</p>
                </Field>

                <Field label="Canonical URL" sourceValue={sourceFormData.website?.canonicalUrl || sourceFormData.website?.url || 'https://haikal-hafidz.github.io/'} cmsLanguage={cmsLanguage}>
                  <input
                    type="url"
                    value={formData.website?.canonicalUrl || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), canonicalUrl: val } }));
                      setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), canonicalUrl: val } }));
                    }}
                    className={inputCls}
                    placeholder={formData.website?.url || 'https://haikal-hafidz.github.io/'}
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Preferred canonical URL to prevent duplicate content penalties across search engines.</p>
                </Field>
              </div>

              <Field label="Meta Description" sourceValue={sourceFormData.website?.seoDescription || ''} cmsLanguage={cmsLanguage}>
                <RichTextEditor
                  fieldMode
                  initialValue={formData.website?.seoDescription || ''}
                  onChange={(html) => {
                    setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), seoDescription: html } }));
                    setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), seoDescription: html } }));
                  }}
                  placeholder={formData.website?.description || 'Portfolio Haikal A. Hafidz — writing, editing, creative work, and selected projects.'}
                />
                <p className="mt-1 text-[10px] text-gray-400">Preferred description snippet for search result listings. Note: Google may dynamically generate its own snippets depending on user query.</p>
              </Field>

              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Search Engine Indexing Directives</p>
                <div className="flex items-center gap-6 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-gray-700 dark:text-gray-200">
                    <input
                      type="radio"
                      name="allowIndexing"
                      checked={formData.website?.allowIndexing !== false}
                      onChange={() => {
                        setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), allowIndexing: true } }));
                        setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), allowIndexing: true } }));
                      }}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold">Allow Search Indexing</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">(index, follow)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-gray-700 dark:text-gray-200">
                    <input
                      type="radio"
                      name="allowIndexing"
                      checked={formData.website?.allowIndexing === false}
                      onChange={() => {
                        setFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), allowIndexing: false } }));
                        setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), allowIndexing: false } }));
                      }}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span className="font-semibold text-red-600 dark:text-red-400">Block Search Indexing</span>
                    <span className="text-[10px] text-red-500 font-mono">(noindex, nofollow)</span>
                  </label>
                </div>
                <p className="text-[10px] leading-relaxed text-gray-400">
                  Keep set to &quot;Allow Search Indexing&quot; for production site so search engines can discover and index your portfolio pages.
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-gray-200 pt-5 dark:border-gray-700">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Notes Website</p>
                <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                  Notes pribadi admin untuk command Git, rumus push/deploy, checklist, atau pesan lain. Disimpan lokal di browser ini dan tidak dikirim ke data portfolio publik.
                </p>
              </div>
              <RichTextEditor fieldMode initialValue={sourceFormData.website?.devNotes || ''} onChange={(html) => {
                  const value = html;
                  writeLocalDevNotes(value);
                  setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), devNotes: value } }));
                }} placeholder={'PUSH & DEPLOY\n\ngit status\ngit add .\ngit commit -m "..."\ngit push\n\nNOTES:\n- check localhost\n- check mobile\n- check CMS save\n- then push'} />
            </div>
          </section>
        )}

        {/* ================= HOME ================= */}
        {activeTab === 'home' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab Home</h2>
            <Field label="Full Name" sourceValue={sourceFormData.home.name} cmsLanguage={cmsLanguage}>
              <input type="text" value={formData.home.name} onChange={(e) => setHome('name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Role / Jabatan Singkat" sourceValue={sourceFormData.home.role} cmsLanguage={cmsLanguage}>
              <input type="text" value={formData.home.role} onChange={(e) => setHome('role', e.target.value)} className={inputCls} />
            </Field>
            <CollapsibleSection sectionKey="home-dynamic-statement" title="Dynamic Statement" subtitle="Large statement to the right of the Home identity.">

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300">Dynamic Statement</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">Large statement to the right of the Home identity. Each row is a word pair that swaps like an edit in Word.</p>
                </div>
                <button type="button" onClick={() => setDynamicStatement('enabled', !formData.home.dynamicStatement.enabled)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${formData.home.dynamicStatement.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} aria-label="Enable or disable dynamic statement">
                  <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${formData.home.dynamicStatement.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Prefix" sourceValue={sourceFormData.home.dynamicStatement.prefix || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.home.dynamicStatement.prefix || ''} onChange={(e) => setDynamicStatement('prefix', e.target.value)} className={inputCls} placeholder="Gue" /></Field>
                <Field label="Kata highlight kuning" sourceValue={sourceFormData.home.dynamicStatement.highlightedWord || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.home.dynamicStatement.highlightedWord || ''} onChange={(e) => setDynamicStatement('highlightedWord', e.target.value)} className={inputCls} placeholder="mengubah" /></Field>
                <Field label="Connector" sourceValue={sourceFormData.home.dynamicStatement.connector || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.home.dynamicStatement.connector || ''} onChange={(e) => setDynamicStatement('connector', e.target.value)} className={inputCls} placeholder="menjadi" /></Field>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Statement Size">
                  <select value={formData.home.dynamicStatement.size || 'large'} onChange={(e) => setDynamicStatement('size', e.target.value)} className={inputCls}>
                    <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                  </select>
                </Field>
                <Field label="Kecepatan mengetik">
                  <select value={formData.home.dynamicStatement.speed || 'normal'} onChange={(e) => setDynamicStatement('speed', e.target.value)} className={inputCls}>
                    <option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option>
                  </select>
                </Field>
                <Field label="Pause after statement completes">
                  <select value={Number(formData.home.dynamicStatement.pauseDuration) || 2700} onChange={(e) => setDynamicStatement('pauseDuration', Number(e.target.value))} className={inputCls}>
                    <option value={2000}>2 detik</option><option value={2700}>2,7 detik</option><option value={3500}>3,5 detik</option><option value={5000}>5 detik</option>
                  </select>
                </Field>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Pasangan kata ({formData.home.dynamicStatement.pairs.length}/8)</p>
                  {formData.home.dynamicStatement.pairs.length < 8 && <button type="button" onClick={addDynamicPair} className="rounded-md border border-dashed border-blue-400 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-950/40">+ Add Pair</button>}
                </div>
                {formData.home.dynamicStatement.pairs.map((pair, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900/60">
                    <input type="text" value={pair.source || ''} onChange={(e) => setDynamicPair(index, 'source', e.target.value)} className={inputCls} placeholder="pengamatan" aria-label={`Kata awal pasangan ${index + 1}`} />
                    <span className="font-[Arial] text-xs text-gray-400">→</span>
                    <input type="text" value={pair.result || ''} onChange={(e) => setDynamicPair(index, 'result', e.target.value)} className={inputCls} placeholder="cerita" aria-label={`Kata hasil pasangan ${index + 1}`} />
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveDynamicPair(index, -1)} disabled={index === 0} className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-30 dark:border-gray-700" title="Naik">↑</button>
                      <button type="button" onClick={() => moveDynamicPair(index, 1)} disabled={index === formData.home.dynamicStatement.pairs.length - 1} className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-30 dark:border-gray-700" title="Turun">↓</button>
                      <button type="button" onClick={() => removeDynamicPair(index)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/30" title="Remove">×</button>
                    </div>
                  </div>
                ))}
                {!formData.home.dynamicStatement.pairs.length && <p className="rounded-lg border border-dashed border-gray-300 p-3 text-center text-xs text-gray-400 dark:border-gray-700">No word pairs yet. Add at least one.</p>}
              </div>
            
            </CollapsibleSection>
          </div>
        )}

        {/* ================= FEATURED WORKS / CAROUSEL ================= */}
        {activeTab === 'featuredWorks' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Featured Works / Carousel</h2>
            <p className="text-xs text-gray-500 italic">Select up to five works. Titles and images automatically follow the source data in Books or Projects.</p>
            <Field label="Heading Carousel" sourceValue={sourceFormData.home.featuredWorksHeading || ''} cmsLanguage={cmsLanguage}>
              <input type="text" value={formData.home.featuredWorksHeading || ''} onChange={(e) => setHome('featuredWorksHeading', e.target.value)} className={inputCls} placeholder="Selected Works" />
            </Field>
            <div className="space-y-3">
              {(formData.home.featuredWorks || []).map((work, index) => {
                const selectedValue = `${work.type || ''}|${work.sectionId || ''}|${work.itemId || ''}`;
                return <ContentCard key={`${work.type}-${work.itemId}-${index}`} cardKey={`featured-${index}`} listKey="featuredWorks" idx={index} count={formData.home.featuredWorks.length} title={`Work #${index + 1}`} subtitle={featuredWorkOptions.find((option) => option.value === selectedValue)?.label || 'No work selected'} onRemove={() => removeFeaturedWork(index)}>
                  <select value={selectedValue} onChange={(e) => { const [type, sectionId, itemId] = e.target.value.split('|'); setFeaturedWork(index, { type, sectionId, itemId }); }} className={inputCls}>
                    <option value="||">Select work…</option>
                    {featuredWorkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <RichTextEditor fieldMode initialValue={work.teaser || ''} onChange={(html) => setFeaturedWork(index, { teaser: html })} placeholder="Short sentence describing the output" />
                </ContentCard>;
              })}
            </div>
            {(formData.home.featuredWorks || []).length < 5 && <button type="button" onClick={addFeaturedWork} className="rounded-md border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">+ Add Work</button>}
          </div>
        )}

        {/* ================= ABOUT ================= */}
        {activeTab === 'about' && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab About</h2>
            <p className="text-xs text-gray-500 italic">The Author and Bits & Pieces appear as two tabs that switch the A4 page content.</p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Page Title" sourceValue={sourceFormData.about.heading || ''} cmsLanguage={cmsLanguage}><input value={formData.about.heading || ''} onChange={(e) => setAboutField('heading', e.target.value)} className={inputCls} /></Field>
              <Field label="Page Subheading" sourceValue={sourceFormData.about.subheading || ''} cmsLanguage={cmsLanguage}><input value={formData.about.subheading || ''} onChange={(e) => setAboutField('subheading', e.target.value)} className={inputCls} /></Field>
              <Field label="Bio Tab Name" sourceValue={sourceFormData.about.authorNoteTabLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.about.authorNoteTabLabel || ''} onChange={(e) => setAboutField('authorNoteTabLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Bits & Pieces Tab Name" sourceValue={sourceFormData.about.bitsTabLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.about.bitsTabLabel || ''} onChange={(e) => setAboutField('bitsTabLabel', e.target.value)} className={inputCls} /></Field>
            </div>

            <CollapsibleSection sectionKey="about-author" title="The Author">

              <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">The Author</h3>
              <Field label="Headline" sourceValue={sourceFormData.about.headline || ''} cmsLanguage={cmsLanguage}><input value={formData.about.headline || ''} onChange={(e) => setAboutField('headline', e.target.value)} className={inputCls} /></Field>
              <Field label="Bio" sourceValue={sourceFormData.about.bio || ''} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.about.bio || ''} onChange={(html) => setAboutField('bio', html)} /></Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Tanda tangan" sourceValue={sourceFormData.about.signature || ''} cmsLanguage={cmsLanguage}><input value={formData.about.signature || ''} onChange={(e) => setAboutField('signature', e.target.value)} className={inputCls} /></Field>
                <Field label="Lokasi / closing" sourceValue={sourceFormData.about.locationLine || ''} cmsLanguage={cmsLanguage}><input value={formData.about.locationLine || ''} onChange={(e) => setAboutField('locationLine', e.target.value)} className={inputCls} /></Field>
              </div>
            
            </CollapsibleSection>

            <CollapsibleSection sectionKey="about-bits" title="Bits & Pieces">

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">Bits & Pieces</h3>
                  <p className="mt-1 text-xs text-gray-500">Create tabs such as Status, Currently Writing, Currently Reading, and others. Their order can be changed by drag and drop.</p>
                </div>
                <button type="button" onClick={addBitsAndPiecesItem} className="rounded bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40">+ Add Tab</button>
              </div>
              <div className="space-y-3">
                {(formData.about.bitsAndPieces?.items || []).map((item, index) => (
                  <ContentCard
                    key={item.id || index}
                    cardKey={`bits-and-pieces-${item.id || index}`}
                    listKey="bitsAndPieces"
                    idx={index}
                    count={(formData.about.bitsAndPieces?.items || []).length}
                    title={item.label || 'Untitled Tab'}
                    subtitle={item.value || 'Not filled in yet'}
                    onRemove={() => removeBitsAndPiecesItem(index)}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.35fr_1fr]">
                      <Field label="Tab Name">
                        <input value={item.label || ''} onChange={(e) => updateBitsAndPiecesItem(index, { label: e.target.value })} className={inputCls} placeholder="Status / Currently Writing / Currently Reading" />
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase text-gray-400">Accent HEX:</span>
                          <input
                            type="color"
                            value={/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(item.color || '') ? item.color : '#888888'}
                            onChange={(e) => updateBitsAndPiecesItem(index, { color: e.target.value })}
                            className="h-6 w-8 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent p-0.5"
                          />
                          <input
                            type="text"
                            value={item.color || ''}
                            onChange={(e) => updateBitsAndPiecesItem(index, { color: e.target.value })}
                            placeholder="#888888"
                            className={`${inputClsSm} max-w-[100px] font-mono`}
                          />
                        </div>
                      </Field>
                      <Field label="Isi"><RichTextEditor fieldMode initialValue={item.value || ''} onChange={(html) => updateBitsAndPiecesItem(index, { value: html })} placeholder="Isi tab" /></Field>
                    </div>
                  </ContentCard>
                ))}
              </div>
            
            </CollapsibleSection>


            <CollapsibleSection sectionKey="about-lastfm" title="Last.fm / Listening Footnote">

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">Last.fm / Listening Footnote</h3>
                  <p className="mt-1 text-xs text-gray-500">Shows the currently or most recently played song in the gray area on the left side of the About page.</p>
                
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={formData.about.listeningFootnote.enabled !== false} onChange={(e) => setListeningFootnote('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />
                  {formData.about.listeningFootnote.enabled !== false ? 'Ditampilkan' : 'Disembunyikan'}
                </label>
              </div>
              <Field label="Username Last.fm" sourceValue={sourceFormData.about.listeningFootnote.username || ''} cmsLanguage={cmsLanguage}><input value={formData.about.listeningFootnote.username || ''} onChange={(e) => setListeningFootnote('username', e.target.value)} className={inputCls} placeholder="Username Last.fm" /></Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Label sedang diputar" sourceValue={sourceFormData.about.listeningFootnote.nowPlayingLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.about.listeningFootnote.nowPlayingLabel || ''} onChange={(e) => setListeningFootnote('nowPlayingLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Label terakhir diputar" sourceValue={sourceFormData.about.listeningFootnote.lastPlayedLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.about.listeningFootnote.lastPlayedLabel || ''} onChange={(e) => setListeningFootnote('lastPlayedLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Label fallback" sourceValue={sourceFormData.about.listeningFootnote.fallbackLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.about.listeningFootnote.fallbackLabel || ''} onChange={(e) => setListeningFootnote('fallbackLabel', e.target.value)} className={inputCls} /></Field>
              </div>
              <p className="text-xs text-gray-500">Fallback is used when live Last.fm data is unavailable.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Fallback Song Title" sourceValue={sourceFormData.about.listeningFootnote.fallbackTitle || ''} cmsLanguage={cmsLanguage}><input value={formData.about.listeningFootnote.fallbackTitle || ''} onChange={(e) => setListeningFootnote('fallbackTitle', e.target.value)} className={inputCls} /></Field>
                <Field label="Artis fallback" sourceValue={sourceFormData.about.listeningFootnote.fallbackArtist || ''} cmsLanguage={cmsLanguage}><input value={formData.about.listeningFootnote.fallbackArtist || ''} onChange={(e) => setListeningFootnote('fallbackArtist', e.target.value)} className={inputCls} /></Field>
                <Field label="URL cover fallback" sourceValue={sourceFormData.about.listeningFootnote.fallbackImage || ''} cmsLanguage={cmsLanguage}><input value={formData.about.listeningFootnote.fallbackImage || ''} onChange={(e) => setListeningFootnote('fallbackImage', e.target.value)} className={inputCls} /></Field>
                <Field label="Link lagu fallback" sourceValue={sourceFormData.about.listeningFootnote.fallbackUrl || ''} cmsLanguage={cmsLanguage}><input value={formData.about.listeningFootnote.fallbackUrl || ''} onChange={(e) => setListeningFootnote('fallbackUrl', e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Accent Color (HEX)" sourceValue={sourceFormData.about.listeningFootnote.accentColor || '#2B579A'} cmsLanguage={cmsLanguage}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(formData.about.listeningFootnote.accentColor || '') ? formData.about.listeningFootnote.accentColor : '#2B579A'}
                    onChange={(e) => setListeningFootnote('accentColor', e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.about.listeningFootnote.accentColor || ''}
                    onChange={(e) => setListeningFootnote('accentColor', e.target.value)}
                    placeholder="#2B579A"
                    className={`${inputCls} max-w-[140px] font-mono`}
                  />
                </div>
              </Field>
            </CollapsibleSection>
          </div>
        )}

        {/* ================= CAREER ================= */}
        {activeTab === 'career' && (
          <div className="space-y-6">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab Career</h2>
            <p className="text-xs text-gray-500 italic">
              Category di bawah bebas ditambah, dihapus, atau diganti namanya — cocok buat
              riwayat kerja/pendidikan, tapi juga bisa dipakai buat Achievements, Certificates,
              atau slot lain yang lo butuhin.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Page Title (mis. Career & Education)" sourceValue={sourceFormData.career.heading} cmsLanguage={cmsLanguage}>
                <input type="text" value={formData.career.heading} onChange={(e) => setCareerHeading('heading', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Subtitle / Short Description" sourceValue={sourceFormData.career.subheading} cmsLanguage={cmsLanguage}>
                <input type="text" value={formData.career.subheading} onChange={(e) => setCareerHeading('subheading', e.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CollapsibleSection sectionKey="career-archive-cover" title="Career Archive Cover">
                <Field label="Archive Cover Title" sourceValue={sourceFormData.career.archiveTitle || ''} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.career.archiveTitle || ''} onChange={(html) => setCareerHeading('archiveTitle', html)} placeholder="A record of work, study..." /></Field>
                <Field label="Pengantar sampul" sourceValue={sourceFormData.career.archiveIntro || ''} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.career.archiveIntro || ''} onChange={(html) => setCareerHeading('archiveIntro', html)} /></Field>
                <Field label="Open Archive Button Label" sourceValue={sourceFormData.career.archiveButtonLabel || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.career.archiveButtonLabel || ''} onChange={(e) => setCareerHeading('archiveButtonLabel', e.target.value)} className={inputCls} placeholder="Open career archive" /></Field>
              </CollapsibleSection>

              <CollapsibleSection sectionKey="career-view-credentials" title="View Credentials">
                <Field label="Credentials Button Label" sourceValue={sourceFormData.career.credentialsButtonLabel || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.career.credentialsButtonLabel || ''} onChange={(e) => setCareerHeading('credentialsButtonLabel', e.target.value)} className={inputCls} placeholder="View credentials" /></Field>
                <Field label="Credentials Page Title" sourceValue={sourceFormData.career.credentialsHeading || ''} cmsLanguage={cmsLanguage}><input value={formData.career.credentialsHeading || ''} onChange={(e) => setCareerHeading('credentialsHeading', e.target.value)} className={inputCls} /></Field>
                  <Field label="Credentials Page Subheading" sourceValue={sourceFormData.career.credentialsSubheading || ''} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.career.credentialsSubheading || ''} onChange={(html) => setCareerHeading('credentialsSubheading', html)} /></Field>
                  <Field label="Credentials Back Label" sourceValue={sourceFormData.career.credentialsBackLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.career.credentialsBackLabel || ''} onChange={(e) => setCareerHeading('credentialsBackLabel', e.target.value)} className={inputCls} /></Field>
                </CollapsibleSection>
              </div>
  
            <CollapsibleSection sectionKey="career-content-manager" title="Career Content" subtitle="Categories, career items, credentials & content order">
              {formData.career.categories.length === 0 && (
                <p className="text-[11px] text-gray-400 italic">No categories yet. Add one of the types below to get started.</p>
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
                          onClick={() => { setActiveCareerCategory(cat.id); bumpCmsDomRevision(); }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                            catIdx === idx
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838]'
                          }`}
                        >
                          {cat.name || `Category #${idx + 1}`} ({cat.items.length})
                        </button>
                      ))}
                      <button type="button" onClick={() => addCareerCategory('career')} className="rounded border border-dashed border-blue-400 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30">+ Add Tab</button>
                    </div>
  
                    <div key={category.id || catIdx} className="space-y-3 p-4 rounded-lg border-2 border-gray-100 dark:border-gray-800">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <input
                          type="text"
                          value={category.name}
                          onChange={(e) => setCareerCategoryName(catIdx, e.target.value)}
                          placeholder="Category Name (e.g. Professional, Achievements)"
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
                        <RemoveBtn onClick={() => removeCareerCategory(catIdx)} label="Remove Category" />
                      </div>
  
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {category.items.length} item — seret ⠿ atau pakai ▲▼ buat urutin
                        </h3>
                        <AddBtn onClick={() => addCareerItem(catIdx)} label="Add Item" />
                      </div>
  
                      {/* Image latar kartu menu kategori ini di halaman publik */}
                      <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded border border-dashed border-blue-200 dark:border-blue-900 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                          Image Latar Kartu Menu "{category.name || 'Tanpa Name'}"
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
                              Remove
                            </button>
                          )}
                        </div>
                        {uploadingCareerBg === bgKey && (
                          <p className="text-[10px] text-blue-500 animate-pulse">Uploading image...</p>
                        )}
                        <input
                          type="text"
                          value={category.bgImage}
                          onChange={(e) => setCareerBgImage(catIdx, e.target.value)}
                          placeholder="Or paste an image URL directly here"
                          className={inputClsSm}
                        />
                        <p className="text-[10px] text-gray-400">Leave it blank if unavailable — the default gradient will be used automatically.</p>
                      </div>
  
                      {category.items.length === 0 && (
                        <p className="text-[11px] text-gray-400 italic">No items yet.</p>
                      )}
  
                      {/* -------- Item TIPE 'career': Position @ Instansi + pop-up detail instansi -------- */}
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
                                  {item.role || <span className="italic text-gray-400 font-normal">Item #{idx + 1} — no title yet</span>}
                                </span>
                                {(item.company || item.period) && (
                                  <span className="block text-[10px] font-[Arial] text-gray-400 mt-0.5 truncate">
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
                                Close
                              </button>
                              <RemoveBtn onClick={() => removeCareerItem(catIdx, idx)} label="Remove Item" />
                            </div>
                          </div>
  
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input type="text" value={item.role} onChange={(e) => setCareerItemField(catIdx, idx, 'role', e.target.value)} placeholder="Position / Role" className={inputClsSm} />
                            <input type="text" value={item.company} onChange={(e) => setCareerItemField(catIdx, idx, 'company', e.target.value)} placeholder="Organization / Company Name" className={inputClsSm} />
                            <input type="text" value={item.location} onChange={(e) => setCareerItemField(catIdx, idx, 'location', e.target.value)} placeholder="Lokasi" className={inputClsSm} />
                            <input type="text" value={item.period} onChange={(e) => setCareerItemField(catIdx, idx, 'period', e.target.value)} placeholder="Periode (mis. 2024 – Present)" className={inputClsSm} />
                          </div>
                          <RichTextEditor fieldMode initialValue={item.description} onChange={(html) => setCareerItemField(catIdx, idx, 'description', html)} placeholder="Short description" />
  
                          <div className="space-y-2 rounded border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">Version History</span>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <input type="number" value={item.timelineOrder ?? ''} onChange={(e) => setCareerItemField(catIdx, idx, 'timelineOrder', e.target.value)} placeholder="Order timeline (1, 2, 3...)" className={inputClsSm} />
                              <input type="text" value={item.revisionTitle || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'revisionTitle', e.target.value)} placeholder="Reflection Title (e.g. Ideas became visible.)" className={inputClsSm} />
                            </div>
                            <RichTextEditor fieldMode initialValue={item.shortSummary || ''} onChange={(html) => setCareerItemField(catIdx, idx, 'shortSummary', html)} placeholder="Short summary shown on the A4 page" />
                            <RichTextEditor fieldMode initialValue={item.whatChanged || ''} onChange={(html) => setCareerItemField(catIdx, idx, 'whatChanged', html)} placeholder="What changed — lesson or change from this phase" />
                            <input type="text" value={item.coverImage || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'coverImage', e.target.value)} placeholder="Documentation image URL (optional; blank = use organization photo)" className={inputClsSm} />
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <input type="text" value={item.relatedLabel || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'relatedLabel', e.target.value)} placeholder="Label related work" className={inputClsSm} />
                              <input type="text" value={item.relatedUrl || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'relatedUrl', e.target.value)} placeholder="URL related work" className={inputClsSm} />
                            </div>
                          </div>
  
                          <div className="p-3 bg-white dark:bg-[#1e1e1e] rounded border border-dashed border-gray-300 dark:border-gray-600 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Pop-up Detail Instansi</span>
                            <input type="text" value={item.companyInfo.name} onChange={(e) => setCareerCompanyInfoField(catIdx, idx, 'name', e.target.value)} placeholder="Full Name Instansi" className={inputClsSm} />
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
                            <input type="text" value={item.companyInfo.photo} onChange={(e) => setCareerCompanyInfoField(catIdx, idx, 'photo', e.target.value)} placeholder="Or paste an organization photo URL" className={inputClsSm} />
  
                            <RichTextEditor fieldMode initialValue={item.companyInfo.about} onChange={(html) => setCareerCompanyInfoField(catIdx, idx, 'about', html)} placeholder="Short Organization Description" />
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
                                  {item.title || <span className="italic text-gray-400 font-normal">Item #{idx + 1} — no title yet</span>}
                                </span>
                                {(item.issuer || item.date) && (
                                  <span className="block text-[10px] font-[Arial] text-gray-400 mt-0.5 truncate">
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
                                Close
                              </button>
                              <RemoveBtn onClick={() => removeCareerItem(catIdx, idx)} label="Remove Item" />
                            </div>
                          </div>
  
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input type="text" value={item.title} onChange={(e) => setCareerItemField(catIdx, idx, 'title', e.target.value)} placeholder="Achievement / Certificate Name" className={inputClsSm} />
                            <input type="text" value={item.issuer} onChange={(e) => setCareerItemField(catIdx, idx, 'issuer', e.target.value)} placeholder="Penyelenggara / Penerbit" className={inputClsSm} />
                            <input type="text" value={item.date} onChange={(e) => setCareerItemField(catIdx, idx, 'date', e.target.value)} placeholder="Date (mis. Mei 2026)" className={inputClsSm} />
                            <input type="text" value={item.verifyUrl} onChange={(e) => setCareerItemField(catIdx, idx, 'verifyUrl', e.target.value)} placeholder="Link Verifikasi / Bukti (opsional)" className={inputClsSm} />
                          </div>
                          <RichTextEditor fieldMode initialValue={item.description} onChange={(html) => setCareerItemField(catIdx, idx, 'description', html)} placeholder="Short description (opsional)" />
  
                          <div className="space-y-2 rounded border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                              <input type="checkbox" checked={item.showOnTimeline === true} onChange={(e) => setCareerItemField(catIdx, idx, 'showOnTimeline', e.target.checked)} className="accent-blue-600" />
                              Make this credential a main milestone in Version History
                            </label>
                            {item.showOnTimeline === true && <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                              <input type="number" value={item.timelineOrder ?? ''} onChange={(e) => setCareerItemField(catIdx, idx, 'timelineOrder', e.target.value)} placeholder="Order timeline" className={inputClsSm} />
                              <input type="text" value={item.revisionTitle || ''} onChange={(e) => setCareerItemField(catIdx, idx, 'revisionTitle', e.target.value)} placeholder="Reflection Title" className={inputClsSm} />
                              <RichTextEditor fieldMode initialValue={item.whatChanged || ''} onChange={(html) => setCareerItemField(catIdx, idx, 'whatChanged', html)} placeholder="What changed" />
                            </div>}
                          </div>
  
                          <div className="p-3 bg-white dark:bg-[#1e1e1e] rounded border border-dashed border-gray-300 dark:border-gray-600 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Evidence Image (certificate/achievement photo)</span>
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
                            <input type="text" value={item.image} onChange={(e) => setCareerItemField(catIdx, idx, 'image', e.target.value)} placeholder="Or paste an image URL" className={inputClsSm} />
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </CollapsibleSection>

          </div>
        )}

        {/* ================= BOOK ================= */}
        {activeTab === 'book' && (
          <div className="space-y-4">
            <div className="border-b pb-2 border-gray-100 dark:border-gray-800"><h2 className="text-sm font-bold text-blue-600 dark:text-blue-400">Tab Book</h2></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="My Work Tab Name" sourceValue={sourceFormData.books.worksTabLabel || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.books.worksTabLabel || ''} onChange={(e) => setBooksHeading('worksTabLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Reading Tab Name" sourceValue={sourceFormData.books.readingTabLabel || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.books.readingTabLabel || ''} onChange={(e) => setBooksHeading('readingTabLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Page Title (mis. Books, Writings & Open Source)" sourceValue={sourceFormData.books.heading} cmsLanguage={cmsLanguage}>
                <input type="text" value={formData.books.heading} onChange={(e) => setBooksHeading('heading', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Subtitle / Short Description" sourceValue={sourceFormData.books.subheading} cmsLanguage={cmsLanguage}>
                <input type="text" value={formData.books.subheading} onChange={(e) => setBooksHeading('subheading', e.target.value)} className={inputCls} />
              </Field>
            </div>

            <CollapsibleSection sectionKey="book-content-manager" title="Book Content" subtitle="My Books and Books I Read">
              <section className="mt-6 space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700"><div className="flex items-center justify-between"><div><h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">My Books</h3><p className="mt-1 text-[10px] text-gray-400">My work / book settings.</p></div><AddBtn onClick={addBook} label="Add Book / Work" /></div>
              {formData.books.items.map((book, idx) => (
                <ContentCard key={book.id || idx} cardKey={`book-${book.id || idx}`} listKey="books" idx={idx} count={formData.books.items.length} title={book.title || `Book / Work #${idx + 1}`} subtitle={[book.category, book.pageCount ? `${book.pageCount} pages` : ''].filter(Boolean).join(' · ')} onRemove={() => removeBook(idx)}>
                  <div className="flex flex-wrap justify-end gap-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={book.featured === true} onChange={(e) => setExclusiveBookFlag(idx, 'featured', e.target.checked)} className="accent-blue-600" />
                      Current Manuscript
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={book.startHere === true} onChange={(e) => setExclusiveBookFlag(idx, 'startHere', e.target.checked)} className="accent-blue-600" />
                      Start Here
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={book.hintEnabled !== false} onChange={(e) => setBookField(idx, 'hintEnabled', e.target.checked)} className="accent-blue-600" />
                      Blink pas mode Hint
                    </label>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-700/80 dark:bg-[#202020]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Basic Information</span>
                    <input type="text" value={book.title} onChange={(e) => setBookField(idx, 'title', e.target.value)} placeholder="Book / Work Title" className={inputClsSm} />
                    <Field label="Role / Kontribusi Saya">
                      <input type="text" value={book.myRoles || ''} onChange={(e) => setBookField(idx, 'myRoles', e.target.value)} placeholder="Writer, Editor, Book Designer (separate with commas)" className={inputClsSm} />
                    </Field>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <input type="text" value={book.author || ''} onChange={(e) => setBookField(idx, 'author', e.target.value)} placeholder="Author name" className={inputClsSm} />
                      <input type="text" value={book.publisher || ''} onChange={(e) => setBookField(idx, 'publisher', e.target.value)} placeholder="Penerbit / imprint" className={inputClsSm} />
                      <input type="text" value={book.publicationDate || ''} onChange={(e) => setBookField(idx, 'publicationDate', e.target.value)} placeholder="Date terbit (mis. September 2026)" className={inputClsSm} />
                      <input type="text" value={book.isbn || ''} onChange={(e) => setBookField(idx, 'isbn', e.target.value)} placeholder="ISBN (opsional)" className={inputClsSm} />
                      <input type="text" value={book.edition || ''} onChange={(e) => setBookField(idx, 'edition', e.target.value)} placeholder="Edisi (opsional)" className={inputClsSm} />
                      <input type="text" value={book.category} onChange={(e) => setBookField(idx, 'category', e.target.value)} placeholder="Category (e.g. Fiction / Essay)" className={inputClsSm} />
                      <select value={book.status || 'published'} onChange={(e) => setBookField(idx, 'status', e.target.value)} className={inputClsSm}>
                        <option value="published">Published</option><option value="writing">In Progress</option><option value="draft">Draft</option><option value="archived">Archived</option>
                      </select>
                      <input type="text" value={book.year || ''} onChange={(e) => setBookField(idx, 'year', e.target.value)} placeholder="Tahun (mis. 2026)" className={inputClsSm} />
                      <input type="text" value={book.language || ''} onChange={(e) => setBookField(idx, 'language', e.target.value)} placeholder="Language" className={inputClsSm} />
                      <input type="text" value={book.format || ''} onChange={(e) => setBookField(idx, 'format', e.target.value)} placeholder="Format (Novel, E-Book, Booklet...)" className={inputClsSm} />
                      <input type="number" min="0" max="100" value={book.progress || ''} onChange={(e) => setBookField(idx, 'progress', e.target.value)} placeholder="Progress naskah (%)" className={inputClsSm} />
                      <input type="text" value={book.pageCount || ''} onChange={(e) => setBookField(idx, 'pageCount', e.target.value)} placeholder="Page Count (e.g. 184)" className={inputClsSm} />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-700/80 dark:bg-[#202020]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Content & Descriptions</span>
                    <RichTextEditor fieldMode initialValue={book.pitch || ''} onChange={(html) => setBookField(idx, 'pitch', html)} placeholder="One-line pitch — one sentence that sells the idea of the work" />
                    <RichTextEditor fieldMode initialValue={book.summary} onChange={(html) => setBookField(idx, 'summary', html)} placeholder="Ringkasan singkat" />
                    <RichTextEditor fieldMode initialValue={book.fullDescription} onChange={(html) => setBookField(idx, 'fullDescription', html)} placeholder="Full description" />
                    <RichTextEditor fieldMode initialValue={book.whyWritten || ''} onChange={(html) => setBookField(idx, 'whyWritten', html)} placeholder="Why I wrote this — personal / creative reason for writing this work" />
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Book Autopsy</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">Four short notes surrounding the cover on the Book page. Leave any field blank if you do not want it displayed.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <RichTextEditor fieldMode initialValue={book.origin || ''} onChange={(html) => setBookField(idx, 'origin', html)} placeholder="Origin — where did the idea for this book come from?" />
                      <RichTextEditor fieldMode initialValue={book.coreQuestion || ''} onChange={(html) => setBookField(idx, 'coreQuestion', html)} placeholder="Core Question — the book’s central question" />
                      <RichTextEditor fieldMode initialValue={book.writtenDuring || ''} onChange={(html) => setBookField(idx, 'writtenDuring', html)} placeholder="Written During — period or context when it was written" />
                      <RichTextEditor fieldMode initialValue={book.almostDeleted || ''} onChange={(html) => setBookField(idx, 'almostDeleted', html)} placeholder="Almost Deleted — the part that was nearly removed" />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-700/80 dark:bg-[#202020]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Covers & Media</span>
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
                    <input type="text" value={book.coverImage} onChange={(e) => setBookField(idx, 'coverImage', e.target.value)} placeholder="Or paste a Book Cover URL" className={inputClsSm} />

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-[10px] text-gray-400 mb-1.5">Overview image — optional preview page</p>
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
                      <input type="text" value={book.overviewImage || ''} onChange={(e) => setBookField(idx, 'overviewImage', e.target.value)} placeholder="Or paste an overview image URL" className={`${inputClsSm} mt-2`} />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-700/80 dark:bg-[#202020]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Action Links & Buttons</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input type="text" value={book.actionText} onChange={(e) => setBookField(idx, 'actionText', e.target.value)} placeholder="Primary Button Text (e.g. Buy This Book)" className={inputClsSm} />
                      <input type="text" value={book.actionUrl} onChange={(e) => setBookField(idx, 'actionUrl', e.target.value)} placeholder="Primary Button Link" className={inputClsSm} />
                      <input type="text" value={book.secondaryText || ''} onChange={(e) => setBookField(idx, 'secondaryText', e.target.value)} placeholder="Secondary Button Text (optional)" className={inputClsSm} />
                      <input type="text" value={book.secondaryUrl || ''} onChange={(e) => setBookField(idx, 'secondaryUrl', e.target.value)} placeholder="Secondary Button Link" className={inputClsSm} />
                    </div>
                  </div>
                </ContentCard>
              ))}
  
              </section>
  
              <section className="mt-8 space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Books I Read</h3>
                    <p className="mt-1 text-[10px] text-gray-400">Reading-book settings — features and treatment match My Books.</p>
                  </div>
                  <AddBtn onClick={addReadingBook} label="Add Reading Book" />
                </div>
              {(formData.books.readingItems || []).map((book, idx) => (
                <ContentCard key={book.id || idx} cardKey={`reading-book-${book.id || idx}`} listKey="readingBooks" idx={idx} count={(formData.books.readingItems || []).length} title={book.title || `Book / Work #${idx + 1}`} subtitle={[book.category, book.pageCount ? `${book.pageCount} pages` : ''].filter(Boolean).join(' · ')} onRemove={() => removeReadingBook(idx)}>
                  <div className="flex flex-wrap justify-end gap-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={book.featured === true} onChange={(e) => setExclusiveReadingBookFlag(idx, 'featured', e.target.checked)} className="accent-blue-600" />
                      Current Manuscript
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={book.startHere === true} onChange={(e) => setExclusiveReadingBookFlag(idx, 'startHere', e.target.checked)} className="accent-blue-600" />
                      Start Here
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                      <input type="checkbox" checked={book.hintEnabled !== false} onChange={(e) => setReadingBookField(idx, 'hintEnabled', e.target.checked)} className="accent-blue-600" />
                      Blink pas mode Hint
                    </label>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-700/80 dark:bg-[#202020]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Basic Information</span>
                    <input type="text" value={book.title} onChange={(e) => setReadingBookField(idx, 'title', e.target.value)} placeholder="Book / Work Title" className={inputClsSm} />
                    <Field label="Role / Kontribusi Saya">
                      <input type="text" value={book.myRoles || ''} onChange={(e) => setReadingBookField(idx, 'myRoles', e.target.value)} placeholder="Writer, Editor, Book Designer (separate with commas)" className={inputClsSm} />
                    </Field>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <input type="text" value={book.author || ''} onChange={(e) => setReadingBookField(idx, 'author', e.target.value)} placeholder="Author name" className={inputClsSm} />
                      <input type="text" value={book.publisher || ''} onChange={(e) => setReadingBookField(idx, 'publisher', e.target.value)} placeholder="Penerbit / imprint" className={inputClsSm} />
                      <input type="text" value={book.publicationDate || ''} onChange={(e) => setReadingBookField(idx, 'publicationDate', e.target.value)} placeholder="Date terbit (mis. September 2026)" className={inputClsSm} />
                      <input type="text" value={book.isbn || ''} onChange={(e) => setReadingBookField(idx, 'isbn', e.target.value)} placeholder="ISBN (opsional)" className={inputClsSm} />
                      <input type="text" value={book.edition || ''} onChange={(e) => setReadingBookField(idx, 'edition', e.target.value)} placeholder="Edisi (opsional)" className={inputClsSm} />
                      <input type="text" value={book.category} onChange={(e) => setReadingBookField(idx, 'category', e.target.value)} placeholder="Category (e.g. Fiction / Essay)" className={inputClsSm} />
                      <select value={book.status || 'published'} onChange={(e) => setReadingBookField(idx, 'status', e.target.value)} className={inputClsSm}>
                        <option value="published">Published</option><option value="writing">In Progress</option><option value="draft">Draft</option><option value="archived">Archived</option>
                      </select>
                      <input type="text" value={book.year || ''} onChange={(e) => setReadingBookField(idx, 'year', e.target.value)} placeholder="Tahun (mis. 2026)" className={inputClsSm} />
                      <input type="text" value={book.language || ''} onChange={(e) => setReadingBookField(idx, 'language', e.target.value)} placeholder="Language" className={inputClsSm} />
                      <input type="text" value={book.format || ''} onChange={(e) => setReadingBookField(idx, 'format', e.target.value)} placeholder="Format (Novel, E-Book, Booklet...)" className={inputClsSm} />
                      <input type="number" min="0" max="100" value={book.progress || ''} onChange={(e) => setReadingBookField(idx, 'progress', e.target.value)} placeholder="Progress naskah (%)" className={inputClsSm} />
                      <input type="text" value={book.pageCount || ''} onChange={(e) => setReadingBookField(idx, 'pageCount', e.target.value)} placeholder="Page Count (e.g. 184)" className={inputClsSm} />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-700/80 dark:bg-[#202020]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Content & Descriptions</span>
                    <RichTextEditor fieldMode initialValue={book.pitch || ''} onChange={(html) => setReadingBookField(idx, 'pitch', html)} placeholder="One-line pitch — one sentence that sells the idea of the work" />
                    <RichTextEditor fieldMode initialValue={book.summary} onChange={(html) => setReadingBookField(idx, 'summary', html)} placeholder="Ringkasan singkat" />
                    <RichTextEditor fieldMode initialValue={book.fullDescription} onChange={(html) => setReadingBookField(idx, 'fullDescription', html)} placeholder="Full description" />
                    <RichTextEditor fieldMode initialValue={book.whyWritten || ''} onChange={(html) => setReadingBookField(idx, 'whyWritten', html)} placeholder="Why I wrote this — personal / creative reason for writing this work" />
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Book Autopsy</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">Four short notes surrounding the cover on the Book page. Leave any field blank if you do not want it displayed.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <RichTextEditor fieldMode initialValue={book.origin || ''} onChange={(html) => setReadingBookField(idx, 'origin', html)} placeholder="Origin — where did the idea for this book come from?" />
                      <RichTextEditor fieldMode initialValue={book.coreQuestion || ''} onChange={(html) => setReadingBookField(idx, 'coreQuestion', html)} placeholder="Core Question — the book’s central question" />
                      <RichTextEditor fieldMode initialValue={book.writtenDuring || ''} onChange={(html) => setReadingBookField(idx, 'writtenDuring', html)} placeholder="Written During — period or context when it was written" />
                      <RichTextEditor fieldMode initialValue={book.almostDeleted || ''} onChange={(html) => setReadingBookField(idx, 'almostDeleted', html)} placeholder="Almost Deleted — the part that was nearly removed" />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-700/80 dark:bg-[#202020]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Covers & Media</span>
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
                          if (url) setReadingBookField(idx, 'coverImage', url);
                          e.target.value = '';
                        }}
                        className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                      />
                    </div>
                    <input type="text" value={book.coverImage} onChange={(e) => setReadingBookField(idx, 'coverImage', e.target.value)} placeholder="Or paste a Book Cover URL" className={inputClsSm} />

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-[10px] text-gray-400 mb-1.5">Overview image — optional preview page</p>
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
                            if (url) setReadingBookField(idx, 'overviewImage', url);
                            e.target.value = '';
                          }}
                          className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                        />
                      </div>
                      <input type="text" value={book.overviewImage || ''} onChange={(e) => setReadingBookField(idx, 'overviewImage', e.target.value)} placeholder="Or paste an overview image URL" className={`${inputClsSm} mt-2`} />
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-gray-200/80 bg-white p-3 dark:border-gray-700/80 dark:bg-[#202020]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Action Links & Buttons</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input type="text" value={book.actionText} onChange={(e) => setReadingBookField(idx, 'actionText', e.target.value)} placeholder="Primary Button Text (e.g. Buy This Book)" className={inputClsSm} />
                      <input type="text" value={book.actionUrl} onChange={(e) => setReadingBookField(idx, 'actionUrl', e.target.value)} placeholder="Primary Button Link" className={inputClsSm} />
                      <input type="text" value={book.secondaryText || ''} onChange={(e) => setReadingBookField(idx, 'secondaryText', e.target.value)} placeholder="Secondary Button Text (optional)" className={inputClsSm} />
                      <input type="text" value={book.secondaryUrl || ''} onChange={(e) => setReadingBookField(idx, 'secondaryUrl', e.target.value)} placeholder="Secondary Button Link" className={inputClsSm} />
                    </div>
                  </div>
                </ContentCard>
              ))}
  
              </section>
            </CollapsibleSection>
          </div>
        )}

        {/* ================= PROJECTS ================= */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            {activeProjectsSubTab === 'menu' && (
              <div className="space-y-7">
                <div>
                  <h2 className="font-[Arial] text-2xl font-bold text-gray-900 dark:text-white">PROJECTS</h2>
                  <p className="mt-1 font-[Arial] text-xs font-semibold text-blue-600 dark:text-blue-400">which showcase do you want to manage?</p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                  {[
                    { key: 'settings', label: 'Settings Projects', icon: 'general' },
                    ...(!formData.projects.articlesDeleted ? [{ key: 'articles', label: formData.projects.articlesLabel || 'Articles', icon: 'book' }] : []),
                    ...(!formData.projects.directingDeleted ? [{ key: 'directing', label: formData.projects.directingLabel || 'Directing', icon: 'projects' }] : []),
                    ...(!formData.projects.posterDeleted ? [{ key: 'poster', label: formData.projects.posterLabel || 'Poster', icon: 'featuredWorks' }] : []),
                    ...formData.projects.customSections.map((section, idx) => ({ key: `custom:${section.id}`, label: section.label || `Tab Baru #${idx + 1}`, icon: 'projects' })),
                  ].map((entry) => (
                    <button key={entry.key} type="button" onClick={() => { setActiveProjectItem(null); setActiveProjectsSubTab(entry.key); bumpCmsDomRevision(); }} className="group flex min-h-[142px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#242424] md:min-h-[156px] md:p-5">
                      <span className="text-gray-400 transition-colors group-hover:text-blue-600 dark:text-gray-500 dark:group-hover:text-blue-400"><CmsMenuIllustration type={entry.icon} /></span>
                      <strong className="mt-4 font-[Arial] text-xs font-bold uppercase tracking-[0.1em] text-gray-900 dark:text-white md:text-sm">{entry.label}</strong>
                    </button>
                  ))}
                  <button type="button" onClick={addCustomSection} className="group flex min-h-[142px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-4 text-center hover:border-blue-500 dark:border-gray-600 md:min-h-[156px]">
                    <span className="font-[Arial] text-4xl font-light text-gray-300 group-hover:text-blue-600 dark:text-gray-600">+</span>
                    <strong className="mt-2 font-[Arial] text-xs font-bold uppercase tracking-[0.1em] text-gray-500 group-hover:text-blue-600">{cmsCopy('Add Tab', 'Add Tab')}</strong>
                  </button>
                </div>
              </div>
            )}

            {activeProjectsSubTab === 'settings' && (
              <div className="space-y-6">
                <button type="button" onClick={() => setActiveProjectsSubTab('menu')} className="font-[Arial] text-xs text-gray-500 hover:text-blue-600">← Back to Projects</button>
                <div><p className="font-[Arial] text-[9px] font-bold uppercase tracking-[0.18em] text-blue-600">Projects</p><h2 className="mt-1 font-[Arial] text-2xl font-bold">PROJECTS SETTINGS</h2></div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#242424] md:p-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Page Heading" sourceValue={sourceFormData.projects.heading} cmsLanguage={cmsLanguage}><input value={formData.projects.heading} onChange={(e)=>setProjectsField('heading',e.target.value)} className={inputCls}/></Field>
                    <Field label="Page Subheading" sourceValue={sourceFormData.projects.subheading} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.projects.subheading} onChange={(html) =>setProjectsField('subheading',html)} /></Field>
                    <Field label="Project Index Title" sourceValue={sourceFormData.projects.indexHeading||''} cmsLanguage={cmsLanguage}><input value={formData.projects.indexHeading||''} onChange={(e)=>setProjectsField('indexHeading',e.target.value)} className={inputCls}/></Field>
                    <Field label="Project Index Description" sourceValue={sourceFormData.projects.indexDescription||''} cmsLanguage={cmsLanguage}><input value={formData.projects.indexDescription||''} onChange={(e)=>setProjectsField('indexDescription',e.target.value)} className={inputCls}/></Field>
                    <Field label="Label pencarian" sourceValue={sourceFormData.projects.searchLabel||''} cmsLanguage={cmsLanguage}><input value={formData.projects.searchLabel||''} onChange={(e)=>setProjectsField('searchLabel',e.target.value)} className={inputCls}/></Field>
                    <Field label="Back to Index Label" sourceValue={sourceFormData.projects.backLabel||''} cmsLanguage={cmsLanguage}><input value={formData.projects.backLabel||''} onChange={(e)=>setProjectsField('backLabel',e.target.value)} className={inputCls}/></Field>
                    <Field label="Open Drawer Label" sourceValue={sourceFormData.projects.openDrawerLabel||''} cmsLanguage={cmsLanguage}><input value={formData.projects.openDrawerLabel||''} onChange={(e)=>setProjectsField('openDrawerLabel',e.target.value)} className={inputCls}/></Field>
                  </div>
                </div>
              </div>
            )}

            {!['menu','settings'].includes(activeProjectsSubTab) && activeProjectItem === null && (
              <div className="space-y-6">
                <button type="button" onClick={()=>setActiveProjectsSubTab('menu')} className="font-[Arial] text-xs text-gray-500 hover:text-blue-600">← Back to Projects</button>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
                  <div><p className="font-[Arial] text-[9px] font-bold uppercase tracking-[0.18em] text-blue-600">Projects</p><h2 className="mt-1 font-[Arial] text-2xl font-bold uppercase">{projectSectionLabel()}</h2></div>
                  {activeProjectsSubTab==='articles'&&<AddBtn onClick={addArticle} label={cmsCopy('Add Article','Add Article')}/>}
                  {activeProjectsSubTab==='directing'&&<AddBtn onClick={addDirectingItem} label="Add Video Work"/>}
                  {activeProjectsSubTab==='poster'&&<AddBtn onClick={addPosterItem} label="Add Poster"/>}
                  {activeProjectsSubTab.startsWith('custom:')&&(()=>{const si=formData.projects.customSections.findIndex(s=>`custom:${s.id}`===activeProjectsSubTab);return si<0?null:<AddBtn onClick={()=>addCustomItem(si)} label="Add Item"/>;})()}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-[#242424] md:p-6">
                  <p className="mb-4 font-[Arial] text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">Tab Setup</p>
                  {activeProjectsSubTab==='articles'&&<div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] items-end"><Field label={cmsCopy('Tab Name','Tab Name')} sourceValue={sourceFormData.projects.articlesLabel} cmsLanguage={cmsLanguage}><input value={formData.projects.articlesLabel||''} onChange={(e)=>setProjectsField('articlesLabel',e.target.value)} className={inputCls}/></Field><Field label={cmsCopy('Description Tab','Tab Description')} sourceValue={sourceFormData.projects.articlesDescription||''} cmsLanguage={cmsLanguage}><input value={formData.projects.articlesDescription||''} onChange={(e)=>setProjectsField('articlesDescription',e.target.value)} className={inputCls}/></Field><div className="flex items-end pb-1"><RemoveBtn onClick={()=>{setProjectsField('articlesDeleted', true);setActiveProjectsSubTab('menu')}} label="Delete This Tab"/></div></div>}
                  {activeProjectsSubTab==='directing'&&<div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] items-end"><Field label={cmsCopy('Tab Name','Tab Name')} sourceValue={sourceFormData.projects.directingLabel||''} cmsLanguage={cmsLanguage}><input value={formData.projects.directingLabel||''} onChange={(e)=>setProjectsField('directingLabel',e.target.value)} className={inputCls}/></Field><Field label={cmsCopy('Description Tab','Tab Description')} sourceValue={sourceFormData.projects.directingDescription||''} cmsLanguage={cmsLanguage}><input value={formData.projects.directingDescription||''} onChange={(e)=>setProjectsField('directingDescription',e.target.value)} className={inputCls}/></Field><div className="flex items-end pb-1"><RemoveBtn onClick={()=>{setProjectsField('directingDeleted', true);setActiveProjectsSubTab('menu')}} label="Delete This Tab"/></div></div>}
                  {activeProjectsSubTab==='poster'&&<div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] items-end"><Field label={cmsCopy('Tab Name','Tab Name')} sourceValue={sourceFormData.projects.posterLabel||''} cmsLanguage={cmsLanguage}><input value={formData.projects.posterLabel||''} onChange={(e)=>setProjectsField('posterLabel',e.target.value)} className={inputCls}/></Field><Field label={cmsCopy('Description Tab','Tab Description')} sourceValue={sourceFormData.projects.posterDescription||''} cmsLanguage={cmsLanguage}><input value={formData.projects.posterDescription||''} onChange={(e)=>setProjectsField('posterDescription',e.target.value)} className={inputCls}/></Field><div className="flex items-end pb-1"><RemoveBtn onClick={()=>{setProjectsField('posterDeleted', true);setActiveProjectsSubTab('menu')}} label="Delete This Tab"/></div></div>}
                  {activeProjectsSubTab.startsWith('custom:')&&(()=>{const si=formData.projects.customSections.findIndex(s=>`custom:${s.id}`===activeProjectsSubTab);if(si<0)return null;const s=formData.projects.customSections[si];const ct=s.contentType||(s.layout==='articles'?'writing':'image');return <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label={cmsCopy('Tab Name','Tab Name')}><input value={s.label||''} onChange={(e)=>setCustomSectionLabel(si,e.target.value)} className={inputCls}/></Field><Field label={cmsCopy('Description Tab','Tab Description')}><input value={s.description||''} onChange={(e)=>setCustomSectionDescription(si,e.target.value)} className={inputCls}/></Field><Field label={cmsCopy('Type Content','Content Type')}><select value={ct} onChange={(e)=>setCustomSectionContentType(si,e.target.value)} className={inputCls}><option value="writing">Writing</option><option value="video">Video</option><option value="image">Image</option><option value="document">Document</option><option value="link">External Link</option><option value="audio">Audio</option></select></Field><div className="flex items-end"><RemoveBtn onClick={()=>{removeCustomSection(si);setActiveProjectsSubTab('menu')}} label="Remove Tab Ini"/></div></div>;})()}
                </div>

                <div className="space-y-3">
                  <h3 className="font-[Arial] text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Isi {projectSectionLabel()}</h3>
                  {activeProjectsSubTab==='articles'&&formData.projects.articles.map((it,idx)=><div key={it.id||idx} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-[#242424]"><ReorderHandle listKey="articles" idx={idx} count={formData.projects.articles.length}/><button type="button" onClick={()=>openProjectItem('article',idx)} className="min-w-0 flex-1 text-left"><b className="block truncate text-xs">{idx===0&&<span className="mr-1 text-blue-600">★</span>}{it.title||`Article #${idx+1}`}</b><span className="mt-1 block font-[Arial] text-[10px] text-gray-400">{it.date||''}</span></button><button type="button" onClick={()=>openProjectItem('article',idx)} className="rounded bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-600">Edit</button><RemoveBtn onClick={()=>removeArticle(idx)}/></div>)}
                  {activeProjectsSubTab==='directing'&&formData.projects.directing.items.map((it,idx)=><div key={it.id||idx} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-[#242424]"><ReorderHandle listKey="directing" idx={idx} count={formData.projects.directing.items.length}/><button type="button" onClick={()=>openProjectItem('directing',idx)} className="min-w-0 flex-1 text-left"><b className="block truncate text-xs">{it.title||`Video Work #${idx+1}`}</b><span className="mt-1 block text-[10px] text-gray-400">{[it.role,it.year,it.runtime].filter(Boolean).join(' · ')}</span></button><button type="button" onClick={()=>openProjectItem('directing',idx)} className="rounded bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-600">Edit</button><RemoveBtn onClick={()=>removeDirectingItem(idx)}/></div>)}
                  {activeProjectsSubTab==='poster'&&formData.projects.poster.items.map((it,idx)=><div key={it.id||idx} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-[#242424]"><ReorderHandle listKey="poster" idx={idx} count={formData.projects.poster.items.length}/>{it.imageUrl&&<img src={it.imageUrl} alt="" className="h-10 w-10 rounded object-cover"/>}<button type="button" onClick={()=>openProjectItem('poster',idx)} className="min-w-0 flex-1 text-left"><b className="block truncate text-xs">{it.title||`Poster #${idx+1}`}</b><span className="mt-1 block text-[10px] text-gray-400">{[it.category,it.dimensions].filter(Boolean).join(' · ')}</span></button><button type="button" onClick={()=>openProjectItem('poster',idx)} className="rounded bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-600">Edit</button><RemoveBtn onClick={()=>removePosterItem(idx)}/></div>)}
                  {activeProjectsSubTab.startsWith('custom:')&&(()=>{const si=formData.projects.customSections.findIndex(s=>`custom:${s.id}`===activeProjectsSubTab);if(si<0)return null;return formData.projects.customSections[si].items.map((it,idx)=><div key={it.id||idx} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-[#242424]"><ReorderHandle listKey={`custom:${si}`} idx={idx} count={formData.projects.customSections[si].items.length}/><button type="button" onClick={()=>openProjectItem('custom',idx,si)} className="min-w-0 flex-1 text-left"><b className="block truncate text-xs">{it.title||`Item #${idx+1}`}</b><span className="mt-1 block text-[10px] text-gray-400">{it.category||''}</span></button><button type="button" onClick={()=>openProjectItem('custom',idx,si)} className="rounded bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-600">Edit</button><RemoveBtn onClick={()=>removeCustomItem(si,idx)}/></div>);})()}
                </div>
              </div>
            )}

            {activeProjectItem!==null&&(()=>{const {kind,idx,sectionIdx}=activeProjectItem;
              if(kind==='article'){const it=formData.projects.articles[idx];if(!it)return null;return <div className="space-y-6"><button type="button" onClick={closeProjectItem} className="font-[Arial] text-xs text-gray-500 hover:text-blue-600">← Back to {projectSectionLabel()}</button><div><p className="font-[Arial] text-[9px] font-bold uppercase tracking-[.18em] text-blue-600">{projectSectionLabel()}</p><h2 className="mt-1 font-[Arial] text-xl font-bold">{it.title||`Article #${idx+1}`}</h2></div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] space-y-4"><p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Information</p><div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_.4fr]"><input value={it.title||''} onChange={(e)=>setArticleField(idx,'title',e.target.value)} placeholder="Title Artikel" className={inputCls}/><select value={it.displayMode||'reading'} onChange={(e)=>setArticleField(idx,'displayMode',e.target.value)} className={inputCls} title="Detail Display Mode"><option value="reading">Reading Mode</option><option value="existing">Existing Display</option></select></div><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><input value={it.date||''} onChange={(e)=>setArticleField(idx,'date',e.target.value)} placeholder="Date" className={inputCls}/><input value={it.category||''} onChange={(e)=>setArticleField(idx,'category',e.target.value)} placeholder="Category" className={inputCls}/><input value={it.author||''} onChange={(e)=>setArticleField(idx,'author',e.target.value)} placeholder="Author" className={inputCls}/></div><RichTextEditor fieldMode initialValue={it.snippet||''} onChange={(html) =>setArticleField(idx,'snippet',html)} placeholder="Cuplikan singkat" /></div><ProjectCoverControl item={it} onChangeField={(f, v) => setArticleField(idx, f, v)} profile="article" contentType="writing" /><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] space-y-4"><p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Media</p>{it.image&&<img src={it.image} alt="" className="h-28 w-44 rounded object-cover"/>}<ImageDropzone value={it.image||''} onChange={(url)=>setArticleField(idx,'image',url)} profile="article" disabled={uploadingArticleImage===idx}/><input value={it.image||''} onChange={(e)=>setArticleField(idx,'image',e.target.value)} placeholder="Or paste an image URL" className={inputCls}/></div>{getProjectPresentation(it).mode !== 'studio' && <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424]"><p className="mb-4 font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Content</p><RichTextEditor key={it.id||idx} initialValue={it.content||''} onChange={(html)=>setArticleField(idx,'content',html)}/></div>}<div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] md:p-6">{renderProjectPresentationStudio('article',idx,null,it)}</div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] md:p-6">{renderUniversalProjectEditor('article',idx,null,it)}</div></div>}
              if(kind==='directing'){const it=formData.projects.directing.items[idx];if(!it)return null;return <div className="space-y-6"><button type="button" onClick={closeProjectItem} className="font-[Arial] text-xs text-gray-500 hover:text-blue-600">← Back to {projectSectionLabel()}</button><div><p className="font-[Arial] text-[9px] font-bold uppercase tracking-[.18em] text-blue-600">{projectSectionLabel()}</p><h2 className="mt-1 font-[Arial] text-xl font-bold">{it.title||`Video Work #${idx+1}`}</h2></div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] space-y-4"><p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Information</p><div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_.4fr]"><input value={it.title||''} onChange={(e)=>setDirectingItemField(idx,'title',e.target.value)} placeholder="Title karya" className={inputCls}/><select value={it.displayMode||'existing'} onChange={(e)=>setDirectingItemField(idx,'displayMode',e.target.value)} className={inputCls} title="Detail Display Mode"><option value="existing">Existing Display</option><option value="reading">Reading Mode</option></select></div><RichTextEditor fieldMode initialValue={it.premise||''} onChange={(html) =>setDirectingItemField(idx,'premise',html)} placeholder="Premise" /><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><input value={it.role||''} onChange={(e)=>setDirectingItemField(idx,'role',e.target.value)} placeholder="Role" className={inputCls}/><input value={it.year||''} onChange={(e)=>setDirectingItemField(idx,'year',e.target.value)} placeholder="Tahun" className={inputCls}/><input value={it.runtime||''} onChange={(e)=>setDirectingItemField(idx,'runtime',e.target.value)} placeholder="Durasi" className={inputCls}/></div></div><ProjectCoverControl item={it} onChangeField={(f, v) => setDirectingItemField(idx, f, v)} profile="video" contentType="video" /><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] space-y-4"><p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Media</p><div className="grid grid-cols-1 gap-3 md:grid-cols-[.28fr_1fr_.28fr]"><select value={it.mediaType||'youtube'} onChange={(e)=>setDirectingItemField(idx,'mediaType',e.target.value)} className={inputCls}><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="drive">Google Drive</option><option value="video">Direct MP4/WebM</option><option value="external">External Link</option></select><input value={it.mediaUrl||''} onChange={(e)=>setDirectingItemField(idx,'mediaUrl',e.target.value)} placeholder="URL media" className={inputCls}/><select value={it.videoRatio||'auto'} onChange={(e)=>setDirectingItemField(idx,'videoRatio',e.target.value)} className={inputCls} title="Video ratio"><option value="auto">Ratio: Auto</option><option value="16:9">16:9</option><option value="4:3">4:3</option><option value="9:16">9:16</option><option value="1:1">1:1</option></select></div><input value={it.posterImage||''} onChange={(e)=>setDirectingItemField(idx,'posterImage',e.target.value)} placeholder="Poster/thumbnail URL" className={inputCls}/><div className="rounded-lg border border-dashed border-gray-200 p-4 dark:border-gray-700"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.14em] text-gray-500">Video Snippets</p><p className="mt-1 text-[10px] text-gray-400">Optional frame previews shown directly under the video player.</p></div><button type="button" onClick={()=>setDirectingItemField(idx,'videoSnippets',[...(Array.isArray(it.videoSnippets)?it.videoSnippets:[]),{id:`snippet-${Date.now()}`,imageUrl:'',caption:'',timestamp:''}])} className="rounded bg-blue-50 px-3 py-1.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950/30 dark:text-blue-300">+ Add Frame</button></div><div className="space-y-3">{(Array.isArray(it.videoSnippets)?it.videoSnippets:[]).map((frame,frameIdx)=>{const frames=Array.isArray(it.videoSnippets)?it.videoSnippets:[];const updateFrame=(patch)=>setDirectingItemField(idx,'videoSnippets',frames.map((f,i)=>i===frameIdx?{...f,...patch}:f));const moveFrame=(dir)=>{const next=[...frames];const to=frameIdx+dir;if(to<0||to>=next.length)return;[next[frameIdx],next[to]]=[next[to],next[frameIdx]];setDirectingItemField(idx,'videoSnippets',next)};return <div key={frame.id||frameIdx} className="grid grid-cols-1 gap-2 rounded-lg bg-gray-50 p-3 dark:bg-[#1e1e1e] md:grid-cols-[88px_1fr_auto]"><div>{frame.imageUrl?<img src={frame.imageUrl} alt="" className="aspect-video w-full rounded object-cover"/>:<div className="flex aspect-video items-center justify-center rounded border border-dashed border-gray-300 text-[9px] text-gray-400 dark:border-gray-600">Frame</div>}</div><div className="space-y-2"><input value={frame.imageUrl||''} onChange={(e)=>updateFrame({imageUrl:e.target.value})} placeholder="Image URL" className={inputClsSm}/><div className="grid grid-cols-1 gap-2 sm:grid-cols-[.3fr_1fr]"><input value={frame.timestamp||''} onChange={(e)=>updateFrame({timestamp:e.target.value})} placeholder="00:42" className={inputClsSm}/><input value={frame.caption||''} onChange={(e)=>updateFrame({caption:e.target.value})} placeholder="Caption (optional)" className={inputClsSm}/></div><input type="file" accept="image/*" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;const key=`directing-snippet-${idx}-${frameIdx}`;setUploadingGalleryImage(key);const url=await uploadImageToStorage(file);setUploadingGalleryImage(null);if(url)updateFrame({imageUrl:url});e.target.value='';}} className="w-full text-[10px]"/></div><div className="flex gap-1 md:flex-col"><button type="button" disabled={frameIdx===0} onClick={()=>moveFrame(-1)} className="rounded border px-2 py-1 text-[10px] disabled:opacity-30">↑</button><button type="button" disabled={frameIdx===frames.length-1} onClick={()=>moveFrame(1)} className="rounded border px-2 py-1 text-[10px] disabled:opacity-30">↓</button><button type="button" onClick={()=>setDirectingItemField(idx,'videoSnippets',frames.filter((_,i)=>i!==frameIdx))} className="rounded border border-red-200 px-2 py-1 text-[10px] text-red-500">×</button></div></div>})}</div></div></div>{getProjectPresentation(it).mode !== 'studio' && <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424]"><Field label="Contribution / What I did"><RichTextEditor key={`contribution-${it.id||idx}`} initialValue={it.contribution||''} onChange={(html)=>setDirectingItemField(idx,'contribution',html)}/></Field></div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424]"><Field label="Credits"><RichTextEditor key={`credits-${it.id||idx}`} initialValue={it.credits||''} onChange={(html)=>setDirectingItemField(idx,'credits',html)}/></Field></div></div>}<div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] md:p-6">{renderProjectPresentationStudio('directing',idx,null,it)}</div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] md:p-6">{renderUniversalProjectEditor('directing',idx,null,it)}</div></div>}
              if(kind==='poster'){const it=formData.projects.poster.items[idx];if(!it)return null;return <div className="space-y-6"><button type="button" onClick={closeProjectItem} className="font-[Arial] text-xs text-gray-500 hover:text-blue-600">← Back to {projectSectionLabel()}</button><div><p className="font-[Arial] text-[9px] font-bold uppercase tracking-[.18em] text-blue-600">{projectSectionLabel()}</p><h2 className="mt-1 font-[Arial] text-xl font-bold">{it.title||`Poster #${idx+1}`}</h2></div><div className="grid grid-cols-1 gap-4 md:grid-cols-[.8fr_1.2fr]"><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424]">{it.imageUrl?<img src={it.imageUrl} alt="" className="mx-auto max-h-[520px] rounded object-contain"/>:<div className="flex min-h-[260px] items-center justify-center rounded border-2 border-dashed border-gray-200 text-xs text-gray-400">None yet gambar</div>}</div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] space-y-4"><p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Information</p><input value={it.title||''} onChange={(e)=>setPosterItemField(idx,'title',e.target.value)} placeholder="Title" className={inputCls}/><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><input value={it.category||''} onChange={(e)=>setPosterItemField(idx,'category',e.target.value)} placeholder="Category" className={inputCls}/><input value={it.dimensions||''} onChange={(e)=>setPosterItemField(idx,'dimensions',e.target.value)} placeholder="Dimensi" className={inputCls}/></div><input value={it.imageUrl||''} onChange={(e)=>setPosterItemField(idx,'imageUrl',e.target.value)} placeholder="Image URL" className={inputCls}/><RichTextEditor fieldMode initialValue={it.description||''} onChange={(html) =>setPosterItemField(idx,'description',html)} placeholder="Description" /></div></div><ProjectCoverControl item={it} onChangeField={(f, v) => setPosterItemField(idx, f, v)} profile="poster" contentType="image" /><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] md:p-6">{renderProjectPresentationStudio('poster',idx,null,it)}</div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] md:p-6">{renderUniversalProjectEditor('poster',idx,null,it)}</div></div>}
              if(kind==='custom'){const s=formData.projects.customSections[sectionIdx];const it=s?.items?.[idx];if(!s||!it)return null;const ct=s.contentType||(s.layout==='articles'?'writing':'image');return <div className="space-y-6"><button type="button" onClick={closeProjectItem} className="font-[Arial] text-xs text-gray-500 hover:text-blue-600">← Back to {s.label||'Project Tab'}</button><div><p className="font-[Arial] text-[9px] font-bold uppercase tracking-[.18em] text-blue-600">{s.label||'Project Tab'}</p><h2 className="mt-1 font-[Arial] text-xl font-bold">{it.title||`Item #${idx+1}`}</h2></div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] space-y-4"><p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Information</p><div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_.4fr]"><input value={it.title||''} onChange={(e)=>setCustomItemField(sectionIdx,idx,'title',e.target.value)} placeholder="Title" className={inputCls}/><select value={it.displayMode||(ct==='writing'?'reading':'existing')} onChange={(e)=>setCustomItemField(sectionIdx,idx,'displayMode',e.target.value)} className={inputCls} title="Detail Display Mode"><option value="reading">Reading Mode</option><option value="existing">Existing Display</option></select></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><input value={it.category||''} onChange={(e)=>setCustomItemField(sectionIdx,idx,'category',e.target.value)} placeholder="Category" className={inputCls}/><input value={it.date||it.year||''} onChange={(e)=>setCustomItemField(sectionIdx,idx,'date',e.target.value)} placeholder="Date / Year" className={inputCls}/></div><RichTextEditor fieldMode initialValue={it.description||''} onChange={(html) =>setCustomItemField(sectionIdx,idx,'description',html)} placeholder="Description" /></div><ProjectCoverControl item={it} onChangeField={(f, v) => setCustomItemField(sectionIdx, idx, f, v)} profile="default" contentType={ct} />{getProjectPresentation(it).mode !== 'studio' && <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] space-y-4"><p className="font-[Arial] text-[10px] font-bold uppercase tracking-[.18em] text-blue-600">Content / Media</p>{ct==='writing'&&<RichTextEditor key={`custom-${it.id||idx}`} initialValue={it.content||''} onChange={(html)=>setCustomItemField(sectionIdx,idx,'content',html)}/>}<input value={it.imageUrl||''} onChange={(e)=>setCustomItemField(sectionIdx,idx,'imageUrl',e.target.value)} placeholder="Image / cover URL" className={inputCls}/><input value={it.url||''} onChange={(e)=>setCustomItemField(sectionIdx,idx,'url',e.target.value)} placeholder="Work Link / URL" className={inputCls}/></div>}<div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] md:p-6">{renderProjectPresentationStudio('custom',idx,sectionIdx,it)}</div><div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-[#242424] md:p-6">{renderUniversalProjectEditor('custom',idx,sectionIdx,it)}</div></div>}
              return null;
            })()}
          </div>
        )}

        {/* ================= CONTACT ================= */}
        {activeTab === 'contact' && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Contact — New Collaboration Document</h2>
            <Field label="Main Heading" sourceValue={sourceFormData.contact.heading} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.contact.heading} onChange={(html) => setContactField('heading', html)} /></Field>
            <Field label="Subheading" sourceValue={sourceFormData.contact.subheading} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.contact.subheading} onChange={(html) => setContactField('subheading', html)} /></Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Form Title" sourceValue={sourceFormData.contact.formTitle || ''} cmsLanguage={cmsLanguage}><input value={formData.contact.formTitle || ''} onChange={(e) => setContactField('formTitle', e.target.value)} className={inputCls} /></Field>
              <Field label="Properties Title" sourceValue={sourceFormData.contact.propertiesTitle || ''} cmsLanguage={cmsLanguage}><input value={formData.contact.propertiesTitle || ''} onChange={(e) => setContactField('propertiesTitle', e.target.value)} className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Email Tujuan" sourceValue={sourceFormData.contact.email} cmsLanguage={cmsLanguage}><input type="email" value={formData.contact.email} onChange={(e) => setContactField('email', e.target.value)} className={inputCls} /></Field>
              <Field label="Lokasi Fallback" sourceValue={sourceFormData.contact.location} cmsLanguage={cmsLanguage}><input type="text" value={formData.contact.location} onChange={(e) => setContactField('location', e.target.value)} className={inputCls} /></Field>
              <Field label="Label Tombol Draft" sourceValue={sourceFormData.contact.draftButtonLabel} cmsLanguage={cmsLanguage}><input type="text" value={formData.contact.draftButtonLabel} onChange={(e) => setContactField('draftButtonLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Post-click Notification" sourceValue={sourceFormData.contact.responseNote} cmsLanguage={cmsLanguage}><input type="text" value={formData.contact.responseNote} onChange={(e) => setContactField('responseNote', e.target.value)} className={inputCls} /></Field>
              <Field label="Label Prompt Nama" sourceValue={sourceFormData.contact.nameLabel || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.contact.nameLabel || ''} onChange={(e) => setContactField('nameLabel', e.target.value)} className={inputCls} placeholder="My name is" /></Field>
              <Field label="Label Prompt Email" sourceValue={sourceFormData.contact.emailLabel || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.contact.emailLabel || ''} onChange={(e) => setContactField('emailLabel', e.target.value)} className={inputCls} placeholder="Reply to" /></Field>
              <Field label="Label Prompt Pesan" sourceValue={sourceFormData.contact.messagePromptLabel || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.contact.messagePromptLabel || ''} onChange={(e) => setContactField('messagePromptLabel', e.target.value)} className={inputCls} placeholder="Here is what you should know" /></Field>
              <Field label="Catatan Lampiran" sourceValue={sourceFormData.contact.attachmentNote || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.contact.attachmentNote || ''} onChange={(e) => setContactField('attachmentNote', e.target.value)} className={inputCls} placeholder="Drive, Dropbox, portfolio, atau referensi lain." /></Field>
              <Field label="Label Opsi Kontak Lain" sourceValue={sourceFormData.contact.otherChannelLabel || ''} cmsLanguage={cmsLanguage}><input type="text" value={formData.contact.otherChannelLabel || ''} onChange={(e) => setContactField('otherChannelLabel', e.target.value)} className={inputCls} placeholder="Prefer another channel?" /></Field>
            </div>

            <CollapsibleSection sectionKey="contact-content-manager" title="Contact Content" subtitle="Inquiry paths, options, properties, social media, and additional links">
              <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold">Inquiry Paths</label><AddBtn onClick={() => addContactListItem('inquiryPaths', { id: `path-${Date.now()}`, kind: 'hello', label: '', subject: '', enabled: true })} label="Add Path" /></div><div className="space-y-2">{formData.contact.inquiryPaths.map((item, idx) => <ContentCard key={item.id || idx} cardKey={`inquiry-${idx}`} listKey="inquiryPaths" idx={idx} count={formData.contact.inquiryPaths.length} title={item.label || `Jalur #${idx + 1}`} subtitle={item.subject || 'Subject belum diisi'} onRemove={() => removeContactListItem('inquiryPaths', idx)}><div className="grid grid-cols-1 gap-2 md:grid-cols-[0.8fr_1fr_1fr_auto]"><select value={item.kind || item.id} onChange={(e) => setContactListItem('inquiryPaths', idx, { kind: e.target.value })} className={inputClsSm}><option value="project">Proyek</option><option value="opportunity">Peluang Kerja</option><option value="hello">Pesan Bebas</option></select><input value={item.label} onChange={(e) => setContactListItem('inquiryPaths', idx, { label: e.target.value })} placeholder="Label" className={inputClsSm} /><input value={item.subject} onChange={(e) => setContactListItem('inquiryPaths', idx, { subject: e.target.value })} placeholder="Subject email" className={inputClsSm} /><label className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={item.enabled !== false} onChange={(e) => setContactListItem('inquiryPaths', idx, { enabled: e.target.checked })} /> Tampil</label></div></ContentCard>)}</div></div>
  
              {[['serviceOptions', 'Service Options'], ['stageOptions', 'Project Stage'], ['timelineOptions', 'Timeline Options']].map(([key, label]) => <div key={key}><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold">{label}</label><AddBtn onClick={() => addContactListItem(key, '')} label="Add Option" /></div><div className="space-y-2">{formData.contact[key].map((item, idx) => <ContentCard key={`${key}-${idx}`} cardKey={`${key}-${idx}`} listKey={key} idx={idx} count={formData.contact[key].length} title={item || `Opsi #${idx + 1}`} subtitle="Drag untuk mengubah urutan" onRemove={() => removeContactListItem(key, idx)}><input value={item} onChange={(e) => setStringListItem(key, idx, e.target.value)} className={inputClsSm} /></ContentCard>)}</div></div>)}
  
              <div><div className="mb-2 flex items-center justify-between"><label className="text-xs font-bold">Document Properties</label><AddBtn onClick={() => addContactListItem('properties', { id: `property-${Date.now()}`, label: '', value: '', enabled: true })} label="Add Property" /></div><div className="space-y-2">{formData.contact.properties.map((item, idx) => <ContentCard key={item.id || idx} cardKey={`property-${idx}`} listKey="properties" idx={idx} count={formData.contact.properties.length} title={item.label || `Property #${idx + 1}`} subtitle={item.value || 'Not filled in yet'} onRemove={() => removeContactListItem('properties', idx)}><div className="grid grid-cols-1 gap-2 md:grid-cols-[0.7fr_1.3fr_auto]"><input value={item.label} onChange={(e) => setContactListItem('properties', idx, { label: e.target.value })} placeholder="Label" className={inputClsSm} /><input value={item.value} onChange={(e) => setContactListItem('properties', idx, { value: e.target.value })} placeholder="Isi" className={inputClsSm} /><label className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={item.enabled !== false} onChange={(e) => setContactListItem('properties', idx, { enabled: e.target.checked })} /> Tampil</label></div></ContentCard>)}</div></div>
  
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium">Sosial Media</label>
                  <AddBtn onClick={addSocial} label="Add Sosmed" />
                </div>
                <div className="space-y-2">
                  {formData.contact.socials.map((s, idx) => (
                    <ContentCard key={idx} cardKey={`social-${idx}`} listKey="socials" idx={idx} count={formData.contact.socials.length} title={s.name || `Sosial Media #${idx + 1}`} subtitle={s.label || s.url || 'Not filled in yet'} onRemove={() => removeSocial(idx)}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                      <input type="text" value={s.name} onChange={(e) => setSocialField(idx, 'name', e.target.value)} placeholder="Name (e.g. LinkedIn)" className={inputClsSm} />
                      <input type="text" value={s.url} onChange={(e) => setSocialField(idx, 'url', e.target.value)} placeholder="URL" className={inputClsSm} />
                      <input type="text" value={s.label} onChange={(e) => setSocialField(idx, 'label', e.target.value)} placeholder="Label (mis. Connect on LinkedIn)" className={inputClsSm} />
                    </div>
                    </ContentCard>
                  ))}
                </div>
              </div>
  
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium">Link Addan (mis. Download Résumé)</label>
                  <AddBtn onClick={addActionButton} label="Add Tombol" />
                </div>
                <p className="text-[10px] text-gray-400 mb-2">
                  Buat tombol "Download Resume": isi Label-nya, terus di kolom Link tinggal upload file
                  PDF-nya langsung dari perangkat lo — link publiknya otomatis keisi sendiri.
                </p>
                <div className="space-y-2">
                  {formData.contact.actionButtons.map((btn, idx) => (
                    <ContentCard key={idx} cardKey={`action-${idx}`} listKey="actionButtons" idx={idx} count={formData.contact.actionButtons.length} title={btn.label || `Action Button #${idx + 1}`} subtitle={btn.url || 'No link yet'} onRemove={() => removeActionButton(idx)}>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <input type="text" value={btn.label} onChange={(e) => setActionButtonField(idx, 'label', e.target.value)} placeholder="Label Tombol" className={inputClsSm} />
                        <input type="text" value={btn.url} onChange={(e) => setActionButtonField(idx, 'url', e.target.value)} placeholder="Link (or upload a file below)" className={inputClsSm} />
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
            </CollapsibleSection>
          </div>
        )}

        {/* ================= VISITOR INTRODUCTION ================= */}
        {activeTab === 'visitorIntroduction' && (
          <div className="space-y-5">
            <div>
              <h2 className="border-b border-gray-100 pb-2 text-sm font-bold text-blue-600 dark:border-gray-800 dark:text-blue-400">Visitor Introduction / Printed Takeover</h2>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">The printer appears in the gray area on the left side of Home. When pressed, the paper expands to fill the screen and introduces the portfolio.</p>
            </div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.home.visitorIntroduction.enabled !== false} onChange={(e) => setVisitorIntroduction('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Aktifkan Visitor’s Copy</label>

            <ContentCard cardKey="visitor-trigger" listKey="visitor-introduction" idx={0} count={1} title="Printer in the left margin" subtitle={formData.home.visitorIntroduction.triggerTitle || 'New to this document?'}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Label kecil" sourceValue={sourceFormData.home.visitorIntroduction.triggerEyebrow || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.triggerEyebrow || ''} onChange={(e) => setVisitorIntroduction('triggerEyebrow', e.target.value)} className={inputCls} /></Field>
                <Field label="Printer Title" sourceValue={sourceFormData.home.visitorIntroduction.triggerTitle || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.triggerTitle || ''} onChange={(e) => setVisitorIntroduction('triggerTitle', e.target.value)} className={inputCls} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Pre-print Prompt" sourceValue={sourceFormData.home.visitorIntroduction.triggerAction || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.triggerAction || ''} onChange={(e) => setVisitorIntroduction('triggerAction', e.target.value)} className={inputCls} /></Field>
                <Field label="Label After First Open" sourceValue={sourceFormData.home.visitorIntroduction.printedLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.printedLabel || ''} onChange={(e) => setVisitorIntroduction('printedLabel', e.target.value)} className={inputCls} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Quick View Title" sourceValue={sourceFormData.home.visitorIntroduction.quickViewLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.quickViewLabel || ''} onChange={(e) => setVisitorIntroduction('quickViewLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Document Index Title" sourceValue={sourceFormData.home.visitorIntroduction.documentIndexLabel ?? 'Document index'} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.documentIndexLabel ?? 'Document index'} onChange={(e) => setVisitorIntroduction('documentIndexLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Tombol Projects" sourceValue={sourceFormData.home.visitorIntroduction.selectedWorksLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.selectedWorksLabel || ''} onChange={(e) => setVisitorIntroduction('selectedWorksLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Tombol Careers" sourceValue={sourceFormData.home.visitorIntroduction.experienceLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.experienceLabel || ''} onChange={(e) => setVisitorIntroduction('experienceLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Tombol Contact" sourceValue={sourceFormData.home.visitorIntroduction.contactLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.contactLabel || ''} onChange={(e) => setVisitorIntroduction('contactLabel', e.target.value)} className={inputCls} /></Field>
              </div>
            </ContentCard>

            <ContentCard cardKey="visitor-sheet" listKey="visitor-introduction" idx={0} count={1} title="Isi lembar fullscreen" subtitle={formData.home.visitorIntroduction.documentCode || 'Visitor’s Copy'}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Kode dokumen" sourceValue={sourceFormData.home.visitorIntroduction.documentCode || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.documentCode || ''} onChange={(e) => setVisitorIntroduction('documentCode', e.target.value)} className={inputCls} /></Field>
                <Field label="Printed For" sourceValue={sourceFormData.home.visitorIntroduction.recipient || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.recipient || ''} onChange={(e) => setVisitorIntroduction('recipient', e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Opening Label" sourceValue={sourceFormData.home.visitorIntroduction.kicker || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.kicker || ''} onChange={(e) => setVisitorIntroduction('kicker', e.target.value)} className={inputCls} /></Field>
              <Field label="Main Title" sourceValue={sourceFormData.home.visitorIntroduction.title || ''} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.home.visitorIntroduction.title || ''} onChange={(html) => setVisitorIntroduction('title', html)} /></Field>
              <Field label="Penjelasan portofolio" sourceValue={sourceFormData.home.visitorIntroduction.body || ''} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.home.visitorIntroduction.body || ''} onChange={(html) => setVisitorIntroduction('body', html)} /></Field>
              <Field label="Kalimat penutup" sourceValue={sourceFormData.home.visitorIntroduction.closing || ''} cmsLanguage={cmsLanguage}><RichTextEditor fieldMode initialValue={formData.home.visitorIntroduction.closing || ''} onChange={(html) => setVisitorIntroduction('closing', html)} /></Field>
              <Field label="Close Button Label" sourceValue={sourceFormData.home.visitorIntroduction.closeLabel || ''} cmsLanguage={cmsLanguage}><input value={formData.home.visitorIntroduction.closeLabel || ''} onChange={(e) => setVisitorIntroduction('closeLabel', e.target.value)} className={inputCls} /></Field>
            </ContentCard>
          </div>
        )}

        {/* ================= ZINE ================= */}
        {activeTab === 'zine' && <WassupEditor ctx={{ formData, setZine, inputCls, Field, CollapsibleSection, zineInbox, zineInboxLoading, zineInboxError, loadZineInbox, editInboxZine, moderateInboxZine, archiveInboxZine, moderatingZineId, ContentCard, addZineEntry, removeZineEntry, updateZineEntry }} />}
        {/* ================= MINI GAME ================= */}
        {activeTab === 'miniGame' && <MiniGameEditor ctx={{ activeMiniGameEditor, setActiveMiniGameEditor, bumpCmsDomRevision, addMiniGameSlot, removeMiniGameSlot, formData, editingMiniGame, setMiniGame, inputCls, Field, CollapsibleSection, cmsCopy, miniGameAutofillText, setMiniGameAutofillText, miniGameAutofillNotice, setMiniGameAutofillNotice, applyMiniGameAutofill, dispatchCmsNotice, uploadImageToStorage, setMiniGameRule, updateGradeTitle, setMiniGameScore, addGameDraft, miniGameContentErrors, ContentCard, removeGameDraft, updateGameDraft, addGameIssue, phraseOccurrences, removeGameIssue, updateGameIssue }} />}

        {/* ================= LEADERBOARD SYSTEMS ================= */}
        {activeTab === 'leaderboardSystems' && (() => {
          const gameIds = [...new Set(leaderboardRows.map((row) => row.gameId || 'red-pen'))];
          const visibleRows = leaderboardRows.filter((row) => leaderboardGameFilter === 'all' || (row.gameId || 'red-pen') === leaderboardGameFilter);
          const rankedRows = visibleRows.map((row, index) => ({ ...row, rank: index + 1 }));
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
                <div>
                  <h2 className="text-sm font-bold text-blue-600 dark:text-blue-400">Leaderboard Systems</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">One leaderboard hub for all Mini Games. Each game keeps its own ranking; use this panel to review players, personal bests, attempts, and name moderation.</p>
                </div>
                <button type="button" onClick={loadLeaderboardSystems} disabled={leaderboardLoading} className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">{leaderboardLoading ? 'Memuat…' : 'Refresh'}</button>
              </div>

              {leaderboardError && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{leaderboardError}</div>}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setLeaderboardGameFilter('all')} className={`rounded-full border px-3 py-1.5 font-[Arial] text-[10px] font-bold uppercase tracking-wider ${leaderboardGameFilter === 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500 dark:border-gray-600'}`}>Semua Game · {leaderboardRows.length}</button>
                {gameIds.map((gameId) => <button key={gameId} type="button" onClick={() => setLeaderboardGameFilter(gameId)} className={`rounded-full border px-3 py-1.5 font-[Arial] text-[10px] font-bold uppercase tracking-wider ${leaderboardGameFilter === gameId ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500 dark:border-gray-600'}`}>{gameId.replace(/-/g, ' ')} · {leaderboardRows.filter((row) => (row.gameId || 'red-pen') === gameId).length}</button>)}
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                  <thead className="bg-gray-50 font-[Arial] text-[10px] uppercase tracking-wider text-gray-500 dark:bg-[#282828]">
                    <tr><th className="px-3 py-3">Rank</th><th className="px-3 py-3">Player</th><th className="px-3 py-3">Game</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Accuracy</th><th className="px-3 py-3">Attempts</th><th className="px-3 py-3">Active Time</th><th className="px-3 py-3 text-right">Moderation</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rankedRows.map((row) => <tr key={row.id} className="bg-white dark:bg-[#242424]">
                      <td className="px-3 py-3 font-[Arial] font-bold">#{row.rank}</td>
                      <td className="px-3 py-3"><strong className="block max-w-48 truncate">{row.playerName || 'Anonymous'}</strong><span className="mt-0.5 block max-w-48 truncate font-[Arial] text-[9px] text-gray-400">{row.playerId || 'legacy'}</span></td>
                      <td className="px-3 py-3 font-[Arial] uppercase">{(row.gameId || 'red-pen').replace(/-/g, ' ')}</td>
                      <td className="px-3 py-3 font-[Arial] font-bold">{row.score}</td>
                      <td className="px-3 py-3">{row.accuracy}%</td>
                      <td className="px-3 py-3">{row.attempts}</td>
                      <td className="px-3 py-3 font-[Arial]">{Math.floor((row.activeSeconds || 0) / 60)}:{String((row.activeSeconds || 0) % 60).padStart(2, '0')}</td>
                      <td className="px-3 py-3 text-right"><button type="button" disabled={deletingLeaderboardId === row.id} onClick={() => requestRemoveLeaderboardEntry(row)} className="rounded border border-red-200 px-2.5 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/20">{deletingLeaderboardId === row.id ? 'Removing…' : 'Remove'}</button></td>
                    </tr>)}
                    {!leaderboardLoading && !rankedRows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No players on this leaderboard yet.</td></tr>}
                    {leaderboardLoading && !rankedRows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Loading leaderboard…</td></tr>}
                  </tbody>
                </table>
              </div>
              {leaderboardDeleteTarget && <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingLeaderboardId) setLeaderboardDeleteTarget(null); }}>
                <div role="dialog" aria-modal="true" aria-labelledby="leaderboard-delete-title" className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-[#242424]">
                  <p className="font-[Arial] text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Leaderboard Systems</p>
                  <h3 id="leaderboard-delete-title" className="mt-2 text-base font-bold text-gray-900 dark:text-white">Remove {leaderboardDeleteTarget.playerName || 'this player'} from leaderboard {(leaderboardDeleteTarget.gameId || 'Mini Game').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}?</h3>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">This player entry for the selected game will be removed from the leaderboard.</p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" disabled={Boolean(deletingLeaderboardId)} onClick={() => setLeaderboardDeleteTarget(null)} className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">Batal</button>
                    <button type="button" disabled={Boolean(deletingLeaderboardId)} onClick={confirmRemoveLeaderboardEntry} className="rounded border border-red-600 bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">{deletingLeaderboardId ? 'Removing…' : 'Remove Player'}</button>
                  </div>
                </div>
              </div>}
              <p className="text-[10px] leading-relaxed text-gray-400">Ranking follows the same order as the game: highest score, highest accuracy, fastest active time, then earlier records. Remove deletes only that player’s leaderboard entry for the selected game.</p>
            </div>
          );
        })()}


        {/* ================= NAVIGATION & LABELS ================= */}
        {activeTab === 'navigationLabels' && (() => {
          const localizedLabels = formData.home?.navigationLabels;
          const labels = localizedLabels && typeof localizedLabels === 'object' && !Array.isArray(localizedLabels)
            ? localizedLabels
            : {};
          const top = labels.top && typeof labels.top === 'object' && !Array.isArray(labels.top) ? labels.top : {};
          const quick = labels.quickViews && typeof labels.quickViews === 'object' && !Array.isArray(labels.quickViews) ? labels.quickViews : {};

          const updateNavigationLabel = (group, key, value) => {
            // Navigation is a fixed object (not a dynamic content array), so write its
            // English copy straight to the canonical translation path. This avoids the
            // generic EN editor diff having to infer navbar paths.
            if (cmsLanguage === 'en') {
              const path = `home.navigationLabels.${group}.${key}`;
              setSourceFormData((previous) => {
                const sourceValue = previous.home?.navigationLabels?.[group]?.[key] ?? '';
                const nextTranslations = {
                  ...(previous.translations || {}),
                  en: { ...(previous.translations?.en || {}) },
                };
                if (String(value).trim() && value !== sourceValue) nextTranslations.en[path] = value;
                else delete nextTranslations.en[path];
                return { ...previous, translations: nextTranslations };
              });
              return;
            }

            setSourceFormData((previous) => ({
              ...previous,
              home: {
                ...previous.home,
                navigationLabels: {
                  ...(previous.home?.navigationLabels && typeof previous.home.navigationLabels === 'object'
                    ? previous.home.navigationLabels
                    : {}),
                  [group]: {
                    ...(previous.home?.navigationLabels?.[group] && typeof previous.home.navigationLabels[group] === 'object'
                      ? previous.home.navigationLabels[group]
                      : {}),
                    [key]: value,
                  },
                },
              },
            }));
          };

          const updateContextualLabel = (root, key, value) => {
            const path = `${root}.${key}`;
            if (cmsLanguage === 'en') {
              setSourceFormData((previous) => {
                const sourceValue = previous?.[root]?.[key] ?? '';
                const nextTranslations = {
                  ...(previous.translations || {}),
                  en: { ...(previous.translations?.en || {}) },
                };
                if (String(value).trim() && value !== sourceValue) nextTranslations.en[path] = value;
                else delete nextTranslations.en[path];
                return { ...previous, translations: nextTranslations };
              });
              return;
            }
            setSourceFormData((previous) => ({
              ...previous,
              [root]: { ...(previous?.[root] || {}), [key]: value },
            }));
          };

          const contextualField = (label, root, key, fallback) => {
            const localizedRoot = root === 'books' ? formData.books : formData[root];
            const sourceRoot = root === 'books' ? sourceFormData.books : sourceFormData[root];
            const localizedValue = localizedRoot?.[key];
            const sourceValue = sourceRoot?.[key] ?? fallback;
            return (
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">{label}</span>
                <input
                  type="text"
                  value={cmsLanguage === 'en' ? (localizedValue || '') : (localizedValue ?? fallback)}
                  data-id-source={sourceValue}
                  onChange={(event) => updateContextualLabel(root, key, event.target.value)}
                  placeholder={cmsLanguage === 'en' ? 'Write the English version here…' : ''}
                  className={inputCls}
                />
              </label>
            );
          };

          const field = (label, group, key, fallback) => {
            const localizedValue = group === 'top' ? top[key] : quick[key];
            const sourceGroup = sourceFormData.home?.navigationLabels?.[group] || {};
            const sourceValue = sourceGroup[key] ?? fallback;

            return (
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-gray-600 dark:text-gray-300">{label}</span>
                <input
                  type="text"
                  value={cmsLanguage === 'en' ? (localizedValue || '') : (localizedValue ?? fallback)}
                  data-id-source={sourceValue}
                  onChange={(event) => updateNavigationLabel(group, key, event.target.value)}
                  placeholder={cmsLanguage === 'en' ? 'Write the English version here…' : ''}
                  className={inputCls}
                />
              </label>
            );
          };

          return (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-blue-600 dark:text-blue-400">Navigation & Labels</h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Hanya mengubah tulisan yang terlihat. Route, fungsi tombol, urutan navbar,
                  urutan Quick Views, dan garis pembatas setelah Contact tetap dikunci.
                  Perubahan berlaku di HP, laptop, dan desktop.
                </p>
              </div>

              <CollapsibleSection sectionKey="navigation-labels-top" title="Top Navigation">
                <div className="grid gap-3 sm:grid-cols-2">
                  {field('Home', 'top', 'home', 'Home')}
                  {field('About', 'top', 'about', 'About')}
                  {field('Projects', 'top', 'projects', 'Projects')}
                  {field('Career', 'top', 'career', 'Careers')}
                  {field('Book', 'top', 'book', 'Books')}
                  {field('Contact', 'top', 'contact', 'Contact')}
                </div>
              </CollapsibleSection>

              <CollapsibleSection sectionKey="navigation-labels-contextual" title="Contextual Back Labels">
                <p className="mb-3 text-[10px] leading-relaxed text-gray-400">One place for public Back labels that used to be scattered across page editors. This changes text only; navigation behavior stays locked.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {contextualField('Projects — Back to Index', 'projects', 'backLabel', 'Back')}
                  {contextualField('Career — Back', 'career', 'backLabel', 'Back')}
                  {contextualField('Career — Credentials Back', 'career', 'credentialsBackLabel', 'Back')}
                  {contextualField('Books — Back', 'books', 'backLabel', 'Back')}
                </div>
              </CollapsibleSection>

              <CollapsibleSection sectionKey="navigation-labels-quick-views" title="Quick Views / A4 Navigation">
                <div className="mb-3 rounded border border-gray-200 bg-white px-3 py-2 font-[Arial] text-[10px] leading-relaxed text-gray-400 dark:border-gray-700 dark:bg-[#202020]">
                  FIXED ORDER: Selected Works → Experience → Contact → divider → Wassup? → Mini Games
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field('Selected Works', 'quickViews', 'selectedWorks', 'Selected Works')}
                  {field('Experience', 'quickViews', 'experience', 'Experience')}
                  {field('Contact', 'quickViews', 'contact', 'Contact')}
                  {field('Wassup?', 'quickViews', 'wassup', 'Wassup?')}
                  {field('Mini Games', 'quickViews', 'miniGames', 'Mini Games')}
                </div>
              </CollapsibleSection>
            </div>
          );
        })()}

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
              Settings situs secara keseluruhan — bukan punya satu halaman tertentu, jadi
              kepisah dari 6 tab konten di atas.
            </p>

            <CollapsibleSection sectionKey="general-mechanical-sound" title="Mechanical Interaction Sound">

              <div><h3 className="text-xs font-bold text-gray-800 dark:text-gray-100">Mechanical Interaction Sound</h3><p className="text-[11px] text-gray-400 mt-0.5">Mechanical click sound after the visitor’s first interaction. Visitors can still turn it off from the Title Bar.</p></div>
              <button type="button" onClick={() => setFormData((previous) => ({ ...previous, general: { ...previous.general, soundEffects: !previous.general.soundEffects } }))} className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${formData.general.soundEffects ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.general.soundEffects ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            
            </CollapsibleSection>

            <CollapsibleSection sectionKey="general-update-patch" title="Info Update Patch">

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
                  title={formData.general.welcomeNotification.enabled ? 'Active — click to turn off' : 'Off — click to turn on'}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      formData.general.welcomeNotification.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <Field label="Patch Version Code" sourceValue={sourceFormData.general.welcomeNotification.version || ''} cmsLanguage={cmsLanguage}>
                <input
                  type="text"
                  value={formData.general.welcomeNotification.version || ''}
                  onChange={(e) => setWelcomeNotification('version', e.target.value)}
                  placeholder="Example: 1.1.0 or 23-09-2026"
                  className={inputCls}
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  Wajib dibedakan dari patch sebelumnya supaya notifikasi muncul lagi.
                </p>
              </Field>

              <Field label="Update Title" sourceValue={sourceFormData.general.welcomeNotification.title} cmsLanguage={cmsLanguage}>
                <input
                  type="text"
                  value={formData.general.welcomeNotification.title}
                  onChange={(e) => setWelcomeNotification('title', e.target.value)}
                  placeholder="Update terbaru"
                  className={inputCls}
                />
              </Field>

              <Field label="Accent Color (HEX)" sourceValue={sourceFormData.general.welcomeNotification.accentColor || '#2B579A'} cmsLanguage={cmsLanguage}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(formData.general.welcomeNotification.accentColor || '') ? formData.general.welcomeNotification.accentColor : '#2B579A'}
                    onChange={(e) => setWelcomeNotification('accentColor', e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={formData.general.welcomeNotification.accentColor || ''}
                    onChange={(e) => setWelcomeNotification('accentColor', e.target.value)}
                    placeholder="#2B579A"
                    className={`${inputCls} max-w-[140px] font-mono`}
                  />
                </div>
              </Field>

              <Field label="Update List">
                <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2">
                  {(formData.general.welcomeNotification.items || []).map((item, index) => (
                    <div key={`patch-item-${index}`} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#242424]">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Update {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => moveWelcomePatchItem(index, -1)} disabled={index === 0} className="px-1 text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-20 dark:hover:text-gray-200">▲</button>
                          <button type="button" onClick={() => moveWelcomePatchItem(index, 1)} disabled={index === (formData.general.welcomeNotification.items || []).length - 1} className="px-1 text-[10px] text-gray-400 hover:text-gray-700 disabled:opacity-20 dark:hover:text-gray-200">▼</button>
                          <button type="button" onClick={() => removeWelcomePatchItem(index)} className="ml-1 text-[10px] font-semibold text-red-500 hover:text-red-600">Remove</button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={item?.title || ''}
                        onChange={(e) => setWelcomePatchItem(index, 'title', e.target.value)}
                        placeholder="Update Title"
                        className={inputCls}
                      />
                      <RichTextEditor fieldMode initialValue={item?.description || ''} onChange={(html) => setWelcomePatchItem(index, 'description', html)} placeholder="What changed?" />
                    </div>
                  ))}
                </div>
                {(formData.general.welcomeNotification.items || []).length === 0 && (
                  <p className="mb-2 text-[10px] text-gray-400">
                    None yet daftar update. Selama kosong, notifikasi publik tetap memakai Isi Patch lama agar data lama tidak hilang.
                  </p>
                )}
                <button
                  type="button"
                  onClick={addWelcomePatchItem}
                  className="mt-2 text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40"
                >
                  + Add Update
                </button>
              </Field>

              <Field label="Isi patch lama (fallback)" sourceValue={sourceFormData.general.welcomeNotification.message} cmsLanguage={cmsLanguage}>
                <RichTextEditor fieldMode initialValue={formData.general.welcomeNotification.message} onChange={(html) => setWelcomeNotification('message', html)} placeholder="Used only when the Update List is still empty." />
                <p className="mt-1 text-[10px] text-gray-400">
                  Disimpan untuk kompatibilitas data lama. Kalau Daftar Update sudah berisi item, tampilan publik memakai daftar di atas.
                </p>
              </Field>

              <Field label="Appear after (seconds)" sourceValue={sourceFormData.general.welcomeNotification.delaySeconds} cmsLanguage={cmsLanguage}>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={formData.general.welcomeNotification.delaySeconds}
                  onChange={(e) => setWelcomeNotification('delaySeconds', Math.max(0, Number(e.target.value) || 0))}
                  className={`${inputCls} max-w-[120px]`}
                />
              </Field>
            
            </CollapsibleSection>

          </div>
        )}
      </>
      )}

      </form>
    </div>
    </CmsCardContext.Provider>
  );
}
