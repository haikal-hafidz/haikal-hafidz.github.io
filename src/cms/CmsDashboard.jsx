import React, { useState, useRef, useEffect, useInsertionEffect } from 'react';
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
          {subtitle && <span className="mt-0.5 block truncate font-mono text-[10px] text-gray-400">{subtitle}</span>}
        </button>
        <button type="button" onClick={() => toggleContentCard(cardKey)} className="grid h-7 w-7 place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-white/5" aria-label={isOpen ? 'Tutup editor' : 'Buka editor'}>{isOpen ? '⌃' : '⌄'}</button>
        {onRemove && <RemoveBtn onClick={onRemove} />}
      </div>
      {isOpen && <div className="space-y-3 border-t border-gray-200 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-[#242424]">{children}</div>}
    </div>
  );
}

// Tiga kelompok CMS: halaman pokok, pengaturan sampingan, lalu pengalaman interaktif.
const MAIN_TABS = ['home', 'about', 'projects', 'career', 'book', 'contact'];
const SIDE_TABS = ['featuredWorks', 'visitorIntroduction', 'interactiveWords', 'general'];
const EXTRA_TABS = ['zine', 'miniGame', 'leaderboardSystems'];

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
  leaderboardSystems: { label: 'Leaderboard Systems', desc: 'Klasemen lintas Mini Game, ranking pemain & moderasi nama' },
  interactiveWords: { label: 'Interactive Words', desc: 'Frasa klik, tujuan, warna & spellcheck underline' },
  general: { label: 'Update Patch', desc: 'Info update patch, suara, dan pengaturan terkait pembaruan situs' },
  websikee: { label: 'Websikee!', desc: 'Judul website dan gambar preview saat link dibagikan' },
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
  favicon: '',
  shareImage: '',
  devNotes: '',
};

const normalizeWebsite = (raw) => ({
  ...DEFAULT_WEBSITE,
  ...(raw || {}),
});

const DEFAULT_GENERAL = {
  soundEffects: true,
  welcomeNotification: {
    enabled: true,
    version: '1.0.0',
    title: 'Update terbaru',
    message: 'Catatan perubahan terbaru portofolio akan muncul di sini.',
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
  gradeTitles: [{ min: 90, label: 'Senior Red Pen', remark: 'Naskah sulit lolos dari mata Anda.' }, { min: 75, label: 'Sharp-eyed Editor', remark: 'Mata editorialnya tajam; tinggal menjaga konsistensi.' }, { min: 55, label: 'Promising Proofreader', remark: 'Insting editornya sudah ada, tetapi beberapa masalah masih lolos.' }, { min: 0, label: 'Draft Survivor', remark: 'Draft-nya selamat. Reputasi editornya menyusul.' }],
  resultEyebrow: 'Final editorial report', replayLabel: 'Main lagi', projectsCtaLabel: 'Lihat tulisan Haikal', contactCtaLabel: 'Hubungi Haikal', gameSlots: [], drafts: DEFAULT_RED_PEN_DRAFTS,
  showInLibrary: true, illustration: '',
};

const HANGMAN_PRESET = {
  gameType: 'hangman', enabled: true, showInLibrary: true, gameName: 'The Hangman', gameCategory: 'Kosakata',
  gameCardDescription: 'Tebak kata dari petunjuk yang tersedia sebelum Hangman selesai digambar.', title: 'Jaga kata tetap hidup.',
  objective: 'Lima belas kata menunggu untuk ditebak. Gunakan petunjuk yang tersedia dan temukan setiap kata sebelum waktu habis—atau Hangman selesai digambar.',
  rules: { click: 'Pilih huruf A–Z untuk menebak kata berdasarkan petunjuk singkat.', timer: 'Setiap kata memberi enam kesempatan salah: kepala, badan, tangan kanan, tangan kiri, kaki kanan, lalu kaki kiri.', wrong: 'Tebakan benar membuka semua kemunculan huruf yang sama. Huruf yang sudah dipilih tidak dapat digunakan kembali.', hint: 'Berhasil menebak kata akan mengosongkan Hangman dan membawa Anda ke kata berikutnya. Selesaikan 15 kata dalam 10 menit.', review: 'Kesalahan keenam atau waktu 00:00 mengakhiri permainan.' },
  startButtonLabel: 'Mulai Menggantung', secondsPerDraft: 600, draftsPerSession: 15,
  gradeTitles: [{ min: 15, label: 'Master Wordsmith', remark: 'Lima belas kata masuk. Tidak satu pun berhasil menggantung Anda.' }, { min: 10, label: 'Seasoned Linguist', remark: 'Kosakata Anda cukup tajam untuk membuat tali kehilangan pekerjaan.' }, { min: 5, label: 'Vocabulary Scout', remark: 'Sudah menemukan jalurnya. Beberapa kata masih bersembunyi.' }, { min: 0, label: 'Word Rookie', remark: 'Untuk sekarang, alfabet masih memegang kendali.' }],
  resultEyebrow: 'Laporan akhir',
  replayLabel: 'Main Lagi',
  hangmanLeaderboardLabel: 'Lihat Klasemen',
  hangmanDeathMessage: 'Siapa Yang Bilang Kata-kata Ngga Bisa Membunuh?',
  hangmanTimeoutMessage: 'Waktu habis. Kata-kata menang kali ini.',
  hangmanPodiumFirst: 'Selamat. Kosa Kata Anda Menyelamatkan Nyawa.',
  hangmanPodiumSecond: 'Runner Up. Banyak Kata, Kurang Tahta.',
  hangmanPodiumThird: 'Peringkat Tiga. Setidaknya Bukan yang Digantung.',
  hangmanRankPrefix: 'Anda berada di peringkat',
  hangmanRankPlayersSuffix: 'pemain',
  hangmanSolvedLabel: 'Terjawab',
  hangmanAccuracyLabel: 'Akurasi',
  hangmanWrongLettersLabel: 'Huruf salah',
  hangmanNamePrompt: 'Masukkan nama / alias untuk masuk klasemen',
  hangmanNamePlaceholder: 'Nama / alias',
  hangmanSaveScoreLabel: 'Simpan Skor',
  hangmanSavingLabel: 'Menyimpan…',
  hangmanYourRankLabel: 'Peringkatmu',
  hangmanBestScoreLabel: 'Skor terbaik tersimpan',
  hangmanLeaderboardTitle: 'Klasemen',
  hangmanLeaderboardCloseLabel: 'Tutup ×',
  hangmanLeaderboardEmptyLabel: 'Belum ada penghuni klasemen.',
  hangmanYouLabel: 'Kamu',
  hangmanClueLabel: 'Petunjuk',
  hangmanChooseLetterLabel: 'Pilih satu huruf',
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
    "click": "Bandingkan Sumber Asli dengan Teks Penulis pada setiap kasus.",
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
    "wording": "Pilihan Kata",
    "structure": "Struktur",
    "idea": "Gagasan",
    "attribution": "Atribusi"
  },
  "copy": {
    "caseLabel": "Kasus",
    "sourceLabel": "Sumber Asli",
    "writerLabel": "Teks Penulis",
    "verdictPrompt": "Jatuhkan Putusan",
    "temporaryVerdict": "Putusan Sementara",
    "changeVerdict": "Ubah Putusan",
    "evidenceTypeLabel": "Jenis Bukti",
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
    "namePlaceholder": "Nama / alias",
    "saveLabel": "Simpan Hasil",
    "savingLabel": "Menyimpan…",
    "rankLabel": "Peringkat Anda",
    "leaderboardLabel": "Lihat Klasemen",
    "leaderboardTitle": "Klasemen",
    "closeLabel": "Tutup ×",
    "leaderboardError": "Klasemen belum dapat dimuat.",
    "saveError": "Skor belum dapat disimpan.",
    "nameError": "Nama / alias minimal 2 karakter."
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
      "source": "Konsumen sering menggunakan ulasan sebagai petunjuk ketika menghadapi ketidakpastian sebelum membeli. Informasi sosial dapat mengurangi persepsi risiko.",
      "writerText": "Konsumen sering menggunakan ulasan sebagai petunjuk ketika menghadapi ketidakpastian sebelum membeli. Informasi sosial dapat mengurangi persepsi risiko. Karena itu ulasan penting bagi toko daring.",
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
          "text": "ketika menghadapi ketidakpastian sebelum membeli. Informasi"
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
      "report": "Informasi sumber direstrukturisasi dan sumber disebut dengan jelas."
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
      "label": "Pilihan Berlebihan",
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
      "report": "Bagian sumber dipotong dan disusun ulang, tetapi wording serta struktur inti tetap diambil tanpa atribusi."
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
      "report": "Informasi sumber disintesis menjadi penjelasan baru dan sumber tetap disebut."
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
      "label": "Arsitektur Pilihan",
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
      "label": "Bahasa Internet",
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
    const slots = Array.isArray(raw?.gameSlots) ? raw.gameSlots.map((slot, index) => { const isHangman = slot?.gameType === 'hangman' || String(slot?.gameName || '').trim().toLowerCase() === 'the hangman'; const isPlagiarism = slot?.gameType === 'plagiarismPolice' || String(slot?.gameName || '').trim().toLowerCase() === 'plagiarism police'; const base = isHangman ? HANGMAN_PRESET : isPlagiarism ? PLAGIARISM_POLICE_PRESET : {}; return emptyMiniGameSlot(index + 2, { ...base, ...slot, id: slot.id, illustration: slot.illustration || '' }); }) : [];
    if (!slots.some((slot) => slot.gameType === 'plagiarismPolice' || String(slot.gameName || '').trim().toLowerCase() === 'plagiarism police')) slots.push(emptyMiniGameSlot(slots.length + 2, { ...PLAGIARISM_POLICE_PRESET, id: 'plagiarism-police' }));
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

const redPenDraftErrors = (draft) => (draft?.issues || []).flatMap((issue, issueIndex) => {
  const phrase = String(issue?.phrase || '').trim();
  if (!phrase) return [`Koreksi ${issueIndex + 1}: frasa bermasalah masih kosong.`];
  const count = phraseOccurrences(draft?.passage || '', phrase);
  if (count === 0) return [`Koreksi ${issueIndex + 1}: frasa “${phrase}” tidak ditemukan persis di paragraf.`];
  if (count > 1) return [`Koreksi ${issueIndex + 1}: frasa “${phrase}” muncul ${count} kali. Buat frasanya lebih spesifik.`];
  if (!String(issue?.replacement || '').trim()) return [`Koreksi ${issueIndex + 1}: pengganti/kata “hapus” belum diisi.`];
  return [];
}).concat(!String(draft?.passage || '').trim() ? ['Paragraf masih kosong.'] : [], !(draft?.issues || []).length ? ['Tambahkan minimal satu koreksi editorial.'] : []);

const hangmanWordErrors = (draft) => {
  const errors = [];
  if (!String(draft?.label || '').trim()) errors.push('Kata masih kosong.');
  if (!String(draft?.passage || '').trim()) errors.push('Petunjuk masih kosong.');
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
    categories: professionalFirst([
      legacyToCategory(careerData.professional, 'professional', 'Professional'),
      legacyToCategory(careerData.college, 'college', 'College'),
    ]),
  };
}

// Sama kayak career: jaga-jaga data books di Supabase masih array polos yang lama,
// padahal format baru butuh { heading, subheading, items }.
function normalizeBooksData(raw) {
  if (Array.isArray(raw)) return { heading: '', subheading: '', worksTabLabel: 'My Books', readingTabLabel: 'Books I Read', items: raw, readingItems: [] };
  if (raw && typeof raw === 'object') {
    return {
      heading: raw.heading ?? '',
      subheading: raw.subheading ?? '',
      worksTabLabel: raw.worksTabLabel === undefined ? 'My Books' : raw.worksTabLabel,
      readingTabLabel: raw.readingTabLabel === undefined ? 'Books I Read' : raw.readingTabLabel,
      items: Array.isArray(raw.items) ? raw.items : [],
      readingItems: Array.isArray(raw.readingItems) ? raw.readingItems : [],
    };
  }
  return { heading: '', subheading: '', worksTabLabel: 'My Books', readingTabLabel: 'Books I Read', items: [], readingItems: [] };
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
    articles,
    directing: { items: Array.isArray(projects.directing?.items) ? projects.directing.items : [] },
    poster: { items },
    // Tab tambahan bebas (di luar Articles & Poster) — kalau data lama belum punya
    // field ini sama sekali, defaultnya array kosong (bukan ilang pas disave ulang).
    customSections: Array.isArray(projects.customSections)
      ? projects.customSections.map((s) => ({
          id: s.id || emptyCustomSection().id,
          label: s.label || '',
          description: s.description ?? '',
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
    dispatchCmsNotice('Cover ditolak. Format Projects hanya WebP atau JPG.');
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
      dispatchCmsNotice(`Cover ditolak karena ukuran pixel tidak sesuai. Patokan: ${guide.text}`);
      return false;
    }
  }
  return true;
}

function ProjectCoverHint({ contentType = 'writing' }) {
  return <p className="mt-1 text-[10px] leading-relaxed text-gray-400">Cover: {getProjectCoverGuide(contentType).text}</p>;
}

const CMS_IMAGE_MAX_EDGE = 2048;
const CMS_IMAGE_WEBP_QUALITY = 0.84;

async function optimizeCmsImage(file) {
  if (!file?.type?.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = longestEdge > CMS_IMAGE_MAX_EDGE
      ? CMS_IMAGE_MAX_EDGE / longestEdge
      : 1;

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

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/webp', CMS_IMAGE_WEBP_QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;

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

async function uploadImageToStorage(file) {
  if (!file) return null;

  // Hanya display image yang dioptimalkan. PDF/DOC/DOCX/PPT dan file non-image
  // melewati fungsi ini tanpa perubahan. SVG/GIF juga dipertahankan agar sifat
  // vector/animasi tidak rusak.
  const uploadFile = await optimizeCmsImage(file);
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
    dispatchCmsNotice('Upload gambar gagal, mang. Cek koneksi internet atau coba lagi.');
    return null;
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(fileName);
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
    dispatchCmsNotice('Share Preview gagal diperbarui. Upload lama tetap aman; cek izin UPDATE/UPSERT bucket Supabase.');
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
    dispatchCmsNotice('Favicon gagal diperbarui. Favicon lama tetap aman; cek izin UPDATE/UPSERT bucket Supabase.');
    return null;
  }

  const { data } = supabase.storage.from(IMAGES_BUCKET).getPublicUrl(fixedPath);
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
    return <div className="rounded-lg border border-dashed border-gray-300 p-5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">Bagian ini tidak punya copy teks yang perlu diterjemahkan.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-blue-700 dark:text-blue-300">English copy</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">Hanya copy English yang diedit di mode ini. Field kosong otomatis fallback ke versi Indonesia; struktur, gambar, urutan, toggle, dan data teknis tetap satu sumber.</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-blue-700 shadow-sm dark:bg-[#252525] dark:text-blue-300">{completed}/{rows.length} translated</span>
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
                <span className="max-w-full truncate font-mono text-[9px] text-gray-400" title={row.path}>{row.path}</span>
              </div>
              <p className="mb-2 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-500 dark:text-gray-400"><span className="font-semibold">ID:</span> {row.source}</p>
              {longText ? (
                <textarea
                  value={value}
                  onChange={(event) => onChange(row.path, event.target.value)}
                  rows={Math.min(8, Math.max(3, Math.ceil((value || row.source).length / 90)))}
                  placeholder="Tulis versi English di sini…"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-[#1e1e1e] dark:text-gray-100"
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(event) => onChange(row.path, event.target.value)}
                  placeholder="Tulis versi English di sini…"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-[#1e1e1e] dark:text-gray-100"
                />
              )}
              {!value.trim() && <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">Belum diterjemahkan — public EN masih memakai copy Indonesia.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CmsDashboard({ data, onSave }) {
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
  const englishFormData = React.useMemo(
    () => localizedPortfolioData(sourceFormData, 'en'),
    [sourceFormData]
  );
  const formData = cmsLanguage === 'en' ? englishFormData : sourceFormData;
  const cmsCopy = React.useCallback((idText, enText) => (cmsLanguage === 'en' ? enText : idText), [cmsLanguage]);

  useInsertionEffect(() => {
    const root = document.querySelector('[data-cms-language-root]');
    if (!root) return undefined;

    // Remove stale ID references in the same React commit when leaving EN.
    root.querySelectorAll('[data-id-source-reference]').forEach((node) => node.remove());
    if (cmsLanguage !== 'en') return undefined;

    const pairs = new Map();
    const ambiguous = new Set();

    const collectPairs = (source, translated) => {
      if (typeof source === 'string' && typeof translated === 'string') {
        if (pairs.has(translated) && pairs.get(translated) !== source) ambiguous.add(translated);
        else pairs.set(translated, source);
        return;
      }
      if (!source || !translated || typeof source !== 'object' || typeof translated !== 'object') return;
      if (Array.isArray(translated)) {
        translated.forEach((item, index) => collectPairs(Array.isArray(source) ? source[index] : undefined, item));
        return;
      }
      Object.keys(translated).forEach((key) => {
        if (key === 'translations') return;
        collectPairs(source?.[key], translated[key]);
      });
    };

    collectPairs(sourceFormData, englishFormData);
    ambiguous.forEach((value) => pairs.delete(value));

    const decorate = () => {
      root.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach((field) => {
        const englishValue = field.value;
        const indonesianValue = pairs.get(englishValue);
        if (!indonesianValue) return;

        const note = document.createElement('div');
        note.dataset.idSourceReference = 'true';
        note.className = 'mb-1 rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[10px] leading-relaxed text-gray-500 dark:border-gray-700 dark:bg-[#252525] dark:text-gray-400';
        note.textContent = `ID · ${indonesianValue}`;
        field.parentNode?.insertBefore(note, field);

        // In EN mode, an untranslated field must look empty. Keep the Indonesian
        // fallback in React state only long enough to identify its source reference,
        // then clear the DOM value. As soon as an English translation exists,
        // englishValue differs from the Indonesian source and is shown normally.
        if (englishValue === indonesianValue) {
          field.value = '';
        }
      });
    };

    decorate();
    return undefined;
  }, [cmsLanguage, sourceFormData, englishFormData, cmsDomRevision]);

  const setFormData = React.useCallback((nextOrUpdater) => {
    if (cmsLanguage !== 'en') {
      setSourceFormData(nextOrUpdater);
      return;
    }

    setSourceFormData((currentSource) => {
      const currentView = localizedPortfolioData(currentSource, 'en');
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
  const toggleContentCard = (key) => {
    setExpandedContentKey((current) => current === key ? null : key);
    // ContentCard dipakai lintas CMS (Projects, Contact, Book, About, Zine, Mini Game, dll).
    // Saat editor drag/drop dibuka atau ditutup dalam mode EN, sinkronkan ulang referensi ID
    // pada commit yang sama supaya field yang baru mount tidak kehilangan catatan Indonesia.
    bumpCmsDomRevision();
  };
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
  const [zineArchiveTarget, setZineArchiveTarget] = useState(null);
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
    setZineArchiveTarget(entry);
  };

  const confirmArchiveInboxZine = async () => {
    const entry = zineArchiveTarget;
    if (!entry || entry.status === 'pending') {
      setZineArchiveTarget(null);
      return;
    }
    setModeratingZineId(entry.id);
    setZineInboxError('');
    try {
      await archiveZineSubmissions(entry.id);
      setZineInbox((current) => current.filter((item) => item.id !== entry.id));
      setZineArchiveTarget(null);
    } catch (error) {
      console.error('Gagal menghapus history Zine:', error);
      setZineInboxError('History belum bisa dihapus. Pastikan kolom/policy cms_archived di Supabase sudah aktif.');
    } finally {
      setModeratingZineId(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const miniGamesToValidate = [formData.miniGame, ...(formData.miniGame?.gameSlots || [])];
    const invalidDrafts = miniGamesToValidate.flatMap((game) => (game?.drafts || []).flatMap((draft, index) => {
      if (draft.enabled === false) return [];
      const isHangman = game?.gameType === 'hangman' || String(game?.gameName || '').trim().toLowerCase() === 'the hangman';
      const itemLabel = isHangman ? `Kata ${index + 1}` : `Draft ${index + 1}`;
      return miniGameContentErrors(game, draft).map((error) => `${game.gameName || 'Game baru'} · ${itemLabel}: ${error}`);
    }));
    if (invalidDrafts.length) {
      setActiveTab('miniGame');
      setNotice(`Mini Game belum bisa disimpan. ${invalidDrafts[0]}`);
      return;
    }
    setIsSaving(true);
    const cleanData = {
      ...sourceFormData,
      website: { ...normalizeWebsite(sourceFormData.website) },
    };
    // Catatan Website adalah admin-local note: jangan pernah kirim ke row portfolio
    // yang memang dibaca publik oleh website.
    delete cleanData.website.devNotes;
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
    if (activeTab === 'websikee') setCmsSection(null);
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
      setMiniGameAutofillNotice(cmsCopy('JSON belum valid. Periksa koma, tanda kutip, atau kurungnya.', 'The JSON is not valid yet. Check commas, quotation marks, and brackets.'));
      return;
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      setMiniGameAutofillNotice(cmsCopy('Isi Otomatis harus berupa satu object JSON.', 'Autofill must contain one JSON object.'));
      return;
    }

    const allowed = new Set(['gameName','gameCategory','gameCardDescription','title','objective','rules','startButtonLabel','secondsPerDraft','draftsPerSession','gradeTitles','resultEyebrow','replayLabel','projectsCtaLabel','contactCtaLabel','drafts','cases','casesPerSession','verdictPoints','evidencePoints','perfectBonus','verdictLabels','evidenceLabels','copy','podium']);
    updateEditingMiniGame((game) => {
      const next = { ...game };
      Object.entries(payload).forEach(([key, value]) => {
        if (!allowed.has(key)) return;
        if (key === 'rules' && value && typeof value === 'object' && !Array.isArray(value)) {
          next.rules = { ...game.rules, ...value };
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
    setMiniGameAutofillNotice(cmsCopy('Isi otomatis sudah masuk ke formulir. Periksa dulu, lalu Save.', 'Autofill has been applied to the form. Review it, then Save.'));
    bumpCmsDomRevision();
  };
  const addMiniGameSlot = () => setFormData((previous) => {
    const slots = previous.miniGame.gameSlots || [];
    const hasHangman = slots.some((slot) => slot.gameType === 'hangman' || String(slot.gameName || '').trim().toLowerCase() === 'the hangman');
    const hasPlagiarism = slots.some((slot) => slot.gameType === 'plagiarismPolice' || String(slot.gameName || '').trim().toLowerCase() === 'plagiarism police');
    const next = !hasHangman
      ? emptyMiniGameSlot(slots.length + 2, HANGMAN_PRESET)
      : !hasPlagiarism
        ? emptyMiniGameSlot(slots.length + 2, PLAGIARISM_POLICE_PRESET)
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
    bumpCmsDomRevision();
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

        <Field label="Keterangan kartu tab (kosongkan untuk menghapus)">
          <input value={section.description || ''} onChange={(e) => setCustomSectionDescription(sectionIdx, e.target.value)} className={inputClsSm} />
        </Field>

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
                    <input type="file" accept="image/*" disabled={uploadingCustomImage === `${sectionIdx}-${idx}`} onChange={async (e) => { const file = e.target.files[0]; if (!file) return; if (!(await validateProjectCover(file, contentType))) { e.target.value = ''; return; } setUploadingCustomImage(`${sectionIdx}-${idx}`); const url = await uploadImageToStorage(file); setUploadingCustomImage(null); if (url) setCustomItemField(sectionIdx, idx, 'imageUrl', url); e.target.value = ''; }} className="flex-1 text-[10px]" />
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
        allowedPaths: ['about.heading', 'about.subheading', 'about.headline', 'about.locationLine', 'about.bio', 'about.signature', 'about.authorNoteTabLabel', 'about.bitsTabLabel', 'about.bitsAndPieces.items', 'about.listeningFootnote.nowPlayingLabel', 'about.listeningFootnote.lastPlayedLabel', 'about.listeningFootnote.fallbackLabel', 'about.listeningFootnote.fallbackTitle', 'about.listeningFootnote.fallbackArtist'],
      };
      case 'career': return {
        source: formData.career, rootPath: 'career',
        allowedPaths: ['career.heading', 'career.subheading', 'career.archiveTitle', 'career.archiveIntro', 'career.archiveButtonLabel', 'career.credentialsButtonLabel', 'career.credentialsHeading', 'career.credentialsSubheading', 'career.credentialsBackLabel', 'career.categories'],
      };
      case 'book': return {
        source: formData.books, rootPath: 'books',
        allowedPaths: ['books.heading', 'books.subheading', 'books.worksTabLabel', 'books.readingTabLabel', 'books.items', 'books.readingItems'],
      };
      case 'projects': return {
        source: formData.projects, rootPath: 'projects',
        allowedPaths: ['projects.heading', 'projects.subheading', 'projects.indexHeading', 'projects.indexDescription', 'projects.searchLabel', 'projects.openDrawerLabel', 'projects.backLabel', 'projects.articlesLabel', 'projects.articlesDescription', 'projects.posterLabel', 'projects.posterDescription', 'projects.directingLabel', 'projects.directingDescription', 'projects.articles', 'projects.poster', 'projects.directing', 'projects.customSections'],
      };
      case 'contact': return {
        source: formData.contact, rootPath: 'contact',
        allowedPaths: ['contact.heading', 'contact.subheading', 'contact.email', 'contact.location', 'contact.formTitle', 'contact.responseNote', 'contact.draftButtonLabel', 'contact.propertiesTitle', 'contact.properties', 'contact.inquiryPaths', 'contact.actionButtons', 'contact.socials'],
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
        allowedPaths: ['general.welcomeNotification.title', 'general.welcomeNotification.message', 'general.welcomeNotification.items', 'general.welcomeNotification.version', 'general.soundEffects'],
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
    <div data-cms-language-root="true" className="max-w-4xl mx-auto space-y-6 text-gray-900 dark:text-gray-100 p-4">

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

      {zineArchiveTarget && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/55 px-4" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202020] shadow-2xl">
            <div className="bg-[#2B579A] px-5 py-3 text-white"><h2 className="font-mono text-sm font-bold tracking-wider">SAYA SATPAM!</h2></div>
            <div className="p-5">
              <p className="text-sm text-gray-700 dark:text-gray-200">{`Hapus Submission #${zineArchiveTarget.id} dari history CMS? Kiriman Approved tetap tersedia di fitur Menerima.`}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setZineArchiveTarget(null)} disabled={moderatingZineId === zineArchiveTarget.id} className="rounded-md bg-gray-200 dark:bg-gray-700 px-4 py-2 text-xs font-bold text-gray-700 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">Batal</button>
                <button type="button" onClick={confirmArchiveInboxZine} disabled={moderatingZineId === zineArchiveTarget.id} className="rounded-md bg-[#2B579A] px-4 py-2 text-xs font-bold text-white hover:bg-[#234a84] disabled:opacity-50">{moderatingZineId === zineArchiveTarget.id ? 'Menghapus...' : 'Ya, Hapus'}</button>
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
          {cmsSection === null ? <><h2 className="mb-4 text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-gray-500">Pilih kelompok pengaturan</h2><div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4"><button type="button" onClick={() => setCmsSection('main')} className="min-h-44 rounded-lg border border-gray-200 bg-gray-50 p-5 text-left transition-all hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#2d2d2d]"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">01 / Pokok</span><strong className="mt-4 block font-mono text-xl">UTAMA</strong><span className="mt-2 block text-xs leading-relaxed text-gray-500">Home, About, Projects, Career, Book, dan Contact.</span></button><button type="button" onClick={() => setCmsSection('side')} className="min-h-44 rounded-lg border border-gray-200 bg-gray-50 p-5 text-left transition-all hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#2d2d2d]"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">02 / Sampingan</span><strong className="mt-4 block font-mono text-xl">SAMPINGAN</strong><span className="mt-2 block text-xs leading-relaxed text-gray-500">Featured Works, Visitor Introduction, Interactive Words, dan Update Patch.</span></button><button type="button" onClick={() => setCmsSection('extra')} className="min-h-44 rounded-lg border border-gray-200 bg-gray-50 p-5 text-left transition-all hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#2d2d2d]"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">03 / Interaktif</span><strong className="mt-4 block font-mono text-xl">INTERAKTIF</strong><span className="mt-2 block text-xs leading-relaxed text-gray-500">Wassup? dan Mini Game untuk pengalaman tambahan pengunjung.</span></button><button type="button" onClick={() => { setCmsSection('websikee'); setActiveTab('websikee'); }} className="min-h-44 rounded-lg border border-gray-200 bg-gray-50 p-5 text-left transition-all hover:border-blue-500 hover:shadow-md dark:border-gray-700 dark:bg-[#2d2d2d]"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">04 / Metadata</span><strong className="mt-4 block font-mono text-xl">WEBSIKEE!</strong><span className="mt-2 block text-xs leading-relaxed text-gray-500">Judul website dan foto preview saat link dibagikan.</span></button></div></> : <><div className="mb-4 flex items-center justify-between gap-3"><div><button type="button" onClick={() => setCmsSection(null)} className="mb-2 font-mono text-xs text-gray-500 hover:text-blue-600">← Pilih kelompok lain</button><h2 className="text-xs font-mono uppercase tracking-widest text-gray-400 dark:text-gray-500">{cmsSection === 'main' ? 'Pokok / kebutuhan utama portofolio' : cmsSection === 'side' ? 'Sampingan / fitur pendukung portofolio' : cmsSection === 'websikee' ? 'Websikee! / metadata website' : 'Interaktif / pengalaman tambahan pengunjung'}</h2></div></div><div className="grid max-h-[calc(100vh-17rem)] grid-cols-2 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-3">
            {(cmsSection === 'main' ? MAIN_TABS : cmsSection === 'side' ? SIDE_TABS : EXTRA_TABS).map((tab) => {
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
          onClick={() => { setActiveTab(null); setActiveMiniGameEditor(null); if (cmsSection === 'websikee') setCmsSection(null); }}
          className="flex items-center gap-1.5 text-xs font-mono text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors"
        >
          <span>←</span> Kembali ke {cmsSection === 'main' ? 'Pokok' : cmsSection === 'side' ? 'Sampingan' : cmsSection === 'websikee' ? 'Websikee!' : 'Interaktif'}
        </button>

        {activeTab !== 'websikee' && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-[#282828]">
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Bahasa konten</p>
            <p className="text-[10px] text-gray-400">Edit di tab yang sama. ID adalah sumber; EN adalah versi resmi buatan sendiri.</p>
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-md border border-gray-300 bg-white font-mono text-[10px] font-bold dark:border-gray-600 dark:bg-[#1e1e1e]">
            <button type="button" onClick={() => setCmsLanguage('id')} className={`px-3 py-1.5 ${cmsLanguage === 'id' ? 'bg-[#2B579A] text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}`}>ID</button>
            <button type="button" onClick={() => setCmsLanguage('en')} className={`border-l border-gray-300 px-3 py-1.5 dark:border-gray-600 ${cmsLanguage === 'en' ? 'bg-[#2B579A] text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'}`}>EN</button>
          </div>
        </div>



        )}

        {/* ================= WEBSIKEE! ================= */}
        {activeTab === 'websikee' && (
          <section className="space-y-5">
            <div>
              <h2 className="font-mono text-lg font-bold">Websikee!</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">Metadata website. Website Title tersimpan lewat CMS. Share Preview Image di bawah ini menimpa satu file tetap di Supabase, sehingga GitHub Pages dan crawler share memakai sumber gambar yang sama.</p>
            </div>

            <Field label="Website Title">
              <input
                type="text"
                value={sourceFormData.website?.title || ''}
                onChange={(e) => setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), title: e.target.value } }))}
                className={inputCls}
                placeholder="Haikal A. Hafidz — Content Writer & Editor"
              />
            </Field>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Favicon / Website Icon</p>
              <p className="text-[10px] leading-relaxed text-gray-400">Icon kecil di tab browser, tepat di sebelah Website Title. Gunakan gambar kotak. File ditimpa ke path tetap website/favicon.png di Supabase.</p>
              {sourceFormData.website?.favicon && (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-[#282828]">
                  <img src={sourceFormData.website.favicon} alt="Favicon website" className="h-12 w-12 rounded border border-gray-300 object-cover dark:border-gray-600" />
                  <p className="min-w-0 break-all font-mono text-[9px] text-gray-400">{sourceFormData.website.favicon}</p>
                </div>
              )}
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
                  if (url) setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), favicon: url } }));
                  e.target.value = '';
                }}
                className="w-full text-[10px]"
              />
              {uploadingWebsitePreview && <p className="text-[10px] text-blue-500">Mengupload gambar…</p>}
              <input
                type="text"
                value={sourceFormData.website?.favicon || ''}
                onChange={(e) => setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), favicon: e.target.value } }))}
                className={inputCls}
                placeholder="Atau tempel URL favicon"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Share Preview Image</p>
              <p className="text-[10px] leading-relaxed text-gray-400">Upload gambar baru untuk mengganti preview link. File akan ditimpa ke path tetap website/share-preview.jpg di Supabase; URL-nya tidak berubah. Bentuk kartu akhirnya tetap ditentukan aplikasi tempat link dibagikan.</p>
              {sourceFormData.website?.shareImage && (
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-[#282828]">
                  <img src={sourceFormData.website.shareImage} alt="Preview link website" className="h-20 w-28 rounded border border-gray-300 object-cover dark:border-gray-600" />
                  <button type="button" onClick={() => setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: '' } }))} className="text-xs font-semibold text-red-500 hover:text-red-600">Hapus gambar</button>
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
                  if (url) setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: url } }));
                  e.target.value = '';
                }}
                className="w-full text-[10px]"
              />
              {uploadingWebsitePreview && <p className="text-[10px] text-blue-500">Mengupload gambar…</p>}
              <input
                type="text"
                value={sourceFormData.website?.shareImage || ''}
                onChange={(e) => setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), shareImage: e.target.value } }))}
                className={inputCls}
                placeholder="Atau tempel URL gambar"
              />
            </div>
            <div className="space-y-2 border-t border-gray-200 pt-5 dark:border-gray-700">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Catatan Website</p>
                <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
                  Catatan pribadi admin untuk command Git, rumus push/deploy, checklist, atau pesan lain. Disimpan lokal di browser ini dan tidak dikirim ke data portfolio publik.
                </p>
              </div>
              <textarea
                rows={12}
                value={sourceFormData.website?.devNotes || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  writeLocalDevNotes(value);
                  setSourceFormData((current) => ({ ...current, website: { ...normalizeWebsite(current.website), devNotes: value } }));
                }}
                className={`${inputCls} min-h-[240px] max-h-[480px] resize-y overflow-y-auto font-mono text-[11px] leading-relaxed`}
                placeholder={'PUSH & DEPLOY\n\ngit status\ngit add .\ngit commit -m "..."\ngit push\n\nCATATAN:\n- cek localhost\n- cek mobile\n- cek CMS save\n- baru push'}
                spellCheck={false}
              />
            </div>
          </section>
        )}

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
            <CollapsibleSection sectionKey="home-dynamic-statement" title="Dynamic Statement" subtitle="Kalimat besar di kanan identitas Home.">

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
            
            </CollapsibleSection>
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
            <p className="text-xs text-gray-500 italic">The Author dan Bits & Pieces tampil sebagai dua tab yang mengganti isi halaman A4.</p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Judul Halaman"><input value={formData.about.heading || ''} onChange={(e) => setAboutField('heading', e.target.value)} className={inputCls} /></Field>
              <Field label="Subheading Halaman"><input value={formData.about.subheading || ''} onChange={(e) => setAboutField('subheading', e.target.value)} className={inputCls} /></Field>
              <Field label="Nama tab bio"><input value={formData.about.authorNoteTabLabel || ''} onChange={(e) => setAboutField('authorNoteTabLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Nama tab Bits & Pieces"><input value={formData.about.bitsTabLabel || ''} onChange={(e) => setAboutField('bitsTabLabel', e.target.value)} className={inputCls} /></Field>
            </div>

            <CollapsibleSection sectionKey="about-author" title="The Author">

              <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">The Author</h3>
              <Field label="Headline"><input value={formData.about.headline || ''} onChange={(e) => setAboutField('headline', e.target.value)} className={inputCls} /></Field>
              <Field label="Bio"><textarea rows={5} value={formData.about.bio || ''} onChange={(e) => setAboutField('bio', e.target.value)} className={`${inputCls} resize-y`} /></Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Tanda tangan"><input value={formData.about.signature || ''} onChange={(e) => setAboutField('signature', e.target.value)} className={inputCls} /></Field>
                <Field label="Lokasi / closing"><input value={formData.about.locationLine || ''} onChange={(e) => setAboutField('locationLine', e.target.value)} className={inputCls} /></Field>
              </div>
            
            </CollapsibleSection>

            <CollapsibleSection sectionKey="about-bits" title="Bits & Pieces">

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">Bits & Pieces</h3>
                  <p className="mt-1 text-xs text-gray-500">Buat tab seperti Status, Currently Writing, Currently Reading, dan lainnya. Urutannya bisa di-drag & drop.</p>
                </div>
                <button type="button" onClick={addBitsAndPiecesItem} className="rounded bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-950/40">+ Tambah Tab</button>
              </div>
              <div className="space-y-3">
                {(formData.about.bitsAndPieces?.items || []).map((item, index) => (
                  <ContentCard
                    key={item.id || index}
                    cardKey={`bits-and-pieces-${item.id || index}`}
                    listKey="bitsAndPieces"
                    idx={index}
                    count={(formData.about.bitsAndPieces?.items || []).length}
                    title={item.label || 'Tab tanpa judul'}
                    subtitle={item.value || 'Belum diisi'}
                    onRemove={() => removeBitsAndPiecesItem(index)}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[0.35fr_1fr]">
                      <Field label="Nama tab"><input value={item.label || ''} onChange={(e) => updateBitsAndPiecesItem(index, { label: e.target.value })} className={inputCls} placeholder="Status / Currently Writing / Currently Reading" /></Field>
                      <Field label="Isi"><textarea rows={3} value={item.value || ''} onChange={(e) => updateBitsAndPiecesItem(index, { value: e.target.value })} className={`${inputCls} resize-y`} placeholder="Isi tab" /></Field>
                    </div>
                  </ContentCard>
                ))}
              </div>
            
            </CollapsibleSection>


            <CollapsibleSection sectionKey="about-lastfm" title="Last.fm / Listening Footnote">

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">Last.fm / Listening Footnote</h3>
                  <p className="mt-1 text-xs text-gray-500">Menampilkan lagu yang sedang atau terakhir didengar di area abu-abu kiri halaman About.</p>
                
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={formData.about.listeningFootnote.enabled !== false} onChange={(e) => setListeningFootnote('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />
                  {formData.about.listeningFootnote.enabled !== false ? 'Ditampilkan' : 'Disembunyikan'}
                </label>
              </div>
              <Field label="Username Last.fm"><input value={formData.about.listeningFootnote.username || ''} onChange={(e) => setListeningFootnote('username', e.target.value)} className={inputCls} placeholder="Username Last.fm" /></Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Label sedang diputar"><input value={formData.about.listeningFootnote.nowPlayingLabel || ''} onChange={(e) => setListeningFootnote('nowPlayingLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Label terakhir diputar"><input value={formData.about.listeningFootnote.lastPlayedLabel || ''} onChange={(e) => setListeningFootnote('lastPlayedLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Label fallback"><input value={formData.about.listeningFootnote.fallbackLabel || ''} onChange={(e) => setListeningFootnote('fallbackLabel', e.target.value)} className={inputCls} /></Field>
              </div>
              <p className="text-xs text-gray-500">Fallback dipakai kalau live Last.fm belum tersedia.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Judul lagu fallback"><input value={formData.about.listeningFootnote.fallbackTitle || ''} onChange={(e) => setListeningFootnote('fallbackTitle', e.target.value)} className={inputCls} /></Field>
                <Field label="Artis fallback"><input value={formData.about.listeningFootnote.fallbackArtist || ''} onChange={(e) => setListeningFootnote('fallbackArtist', e.target.value)} className={inputCls} /></Field>
                <Field label="URL cover fallback"><input value={formData.about.listeningFootnote.fallbackImage || ''} onChange={(e) => setListeningFootnote('fallbackImage', e.target.value)} className={inputCls} /></Field>
                <Field label="Link lagu fallback"><input value={formData.about.listeningFootnote.fallbackUrl || ''} onChange={(e) => setListeningFootnote('fallbackUrl', e.target.value)} className={inputCls} /></Field>
              </div>
            </CollapsibleSection>
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

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CollapsibleSection sectionKey="career-archive-cover" title="Career Archive Cover">
                <Field label="Judul besar sampul"><textarea rows={2} value={formData.career.archiveTitle || ''} onChange={(e) => setCareerHeading('archiveTitle', e.target.value)} className={`${inputCls} resize-y`} placeholder="A record of work, study..." /></Field>
                <Field label="Pengantar sampul"><textarea rows={2} value={formData.career.archiveIntro || ''} onChange={(e) => setCareerHeading('archiveIntro', e.target.value)} className={`${inputCls} resize-y`} /></Field>
                <Field label="Tulisan tombol buka arsip"><input type="text" value={formData.career.archiveButtonLabel || ''} onChange={(e) => setCareerHeading('archiveButtonLabel', e.target.value)} className={inputCls} placeholder="Open career archive" /></Field>
              </CollapsibleSection>

              <CollapsibleSection sectionKey="career-view-credentials" title="View Credentials">
                <Field label="Tulisan tombol credentials"><input type="text" value={formData.career.credentialsButtonLabel || ''} onChange={(e) => setCareerHeading('credentialsButtonLabel', e.target.value)} className={inputCls} placeholder="View credentials" /></Field>
                <Field label="Judul halaman Credentials"><input value={formData.career.credentialsHeading || ''} onChange={(e) => setCareerHeading('credentialsHeading', e.target.value)} className={inputCls} /></Field>
                  <Field label="Subheading halaman Credentials"><textarea rows={2} value={formData.career.credentialsSubheading || ''} onChange={(e) => setCareerHeading('credentialsSubheading', e.target.value)} className={`${inputCls} resize-y`} /></Field>
                  <Field label="Tulisan kembali dari Credentials"><input value={formData.career.credentialsBackLabel || ''} onChange={(e) => setCareerHeading('credentialsBackLabel', e.target.value)} className={inputCls} /></Field>
                </CollapsibleSection>
              </div>
  
            <CollapsibleSection sectionKey="career-content-manager" title="Konten Career" subtitle="Kategori, item career, credentials, dan urutan konten">
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
                          onClick={() => { setActiveCareerCategory(cat.id); bumpCmsDomRevision(); }}
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
            </CollapsibleSection>

          </div>
        )}

        {/* ================= BOOK ================= */}
        {activeTab === 'book' && (
          <div className="space-y-4">
            <div className="border-b pb-2 border-gray-100 dark:border-gray-800"><h2 className="text-sm font-bold text-blue-600 dark:text-blue-400">Tab Book</h2></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nama tab karya saya"><input type="text" value={formData.books.worksTabLabel || ''} onChange={(e) => setBooksHeading('worksTabLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Nama tab buku yang dibaca"><input type="text" value={formData.books.readingTabLabel || ''} onChange={(e) => setBooksHeading('readingTabLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Judul Halaman (mis. Books, Writings & Open Source)">
                <input type="text" value={formData.books.heading} onChange={(e) => setBooksHeading('heading', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Sub-judul / Keterangan Singkat">
                <input type="text" value={formData.books.subheading} onChange={(e) => setBooksHeading('subheading', e.target.value)} className={inputCls} />
              </Field>
            </div>

            <CollapsibleSection sectionKey="book-content-manager" title="Konten Book" subtitle="My Books dan Books I Read">
              <section className="mt-6 space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700"><div className="flex items-center justify-between"><div><h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">My Books</h3><p className="mt-1 text-[10px] text-gray-400">Pengaturan karya / buku saya.</p></div><AddBtn onClick={addBook} label="Tambah Buku/Karya" /></div>
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
  
              </section>
  
              <section className="mt-8 space-y-4 border-t border-gray-200 pt-6 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Books I Read</h3>
                    <p className="mt-1 text-[10px] text-gray-400">Pengaturan buku bacaan — fitur dan treatment sama dengan My Books.</p>
                  </div>
                  <AddBtn onClick={addReadingBook} label="Tambah Buku Bacaan" />
                </div>
              {(formData.books.readingItems || []).map((book, idx) => (
                <ContentCard key={book.id || idx} cardKey={`book-${book.id || idx}`} listKey="readingBooks" idx={idx} count={formData.books.items.length} title={book.title || `Buku/Karya #${idx + 1}`} subtitle={[book.category, book.pageCount ? `${book.pageCount} halaman` : ''].filter(Boolean).join(' · ')} onRemove={() => removeReadingBook(idx)}>
                    <div className="flex flex-wrap justify-end gap-4">
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                        <input type="checkbox" checked={book.featured === true} onChange={(e) => setExclusiveReadingBookFlag(idx, 'featured', e.target.checked)} className="accent-blue-600" />
                        Current Manuscript
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                        <input type="checkbox" checked={book.startHere === true} onChange={(e) => setExclusiveReadingBookFlag(idx, 'startHere', e.target.checked)} className="accent-blue-600" />
                        Start Here
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={book.hintEnabled !== false}
                          onChange={(e) => setReadingBookField(idx, 'hintEnabled', e.target.checked)}
                          className="accent-blue-600"
                        />
                        Blink pas mode Hint
                      </label>
                    </div>
                  <input type="text" value={book.title} onChange={(e) => setReadingBookField(idx, 'title', e.target.value)} placeholder="Judul Buku / Karya" className={inputClsSm} />
                  <Field label="Peran / Kontribusi Saya">
                    <input type="text" value={book.myRoles || ''} onChange={(e) => setReadingBookField(idx, 'myRoles', e.target.value)} placeholder="Penulis, Editor, Desainer Buku (pisahkan dengan koma)" className={inputClsSm} />
                    <p className="mt-1 text-[10px] leading-relaxed text-gray-400">Boleh satu atau beberapa peran. Urutan yang ditulis di sini menjadi urutan chip pada Book Autopsy.</p>
                  </Field>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input type="text" value={book.author || ''} onChange={(e) => setReadingBookField(idx, 'author', e.target.value)} placeholder="Nama penulis" className={inputClsSm} />
                    <input type="text" value={book.publisher || ''} onChange={(e) => setReadingBookField(idx, 'publisher', e.target.value)} placeholder="Penerbit / imprint" className={inputClsSm} />
                    <input type="text" value={book.publicationDate || ''} onChange={(e) => setReadingBookField(idx, 'publicationDate', e.target.value)} placeholder="Tanggal terbit (mis. September 2026)" className={inputClsSm} />
                    <input type="text" value={book.isbn || ''} onChange={(e) => setReadingBookField(idx, 'isbn', e.target.value)} placeholder="ISBN (opsional)" className={inputClsSm} />
                    <input type="text" value={book.edition || ''} onChange={(e) => setReadingBookField(idx, 'edition', e.target.value)} placeholder="Edisi (opsional)" className={inputClsSm} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <input type="text" value={book.category} onChange={(e) => setReadingBookField(idx, 'category', e.target.value)} placeholder="Kategori (mis. Fiksi / Esai)" className={inputClsSm} />
                    <select value={book.status || 'published'} onChange={(e) => setReadingBookField(idx, 'status', e.target.value)} className={inputClsSm}>
                      <option value="published">Published</option><option value="writing">In Progress</option><option value="draft">Draft</option><option value="archived">Archived</option>
                    </select>
                    <input type="text" value={book.year || ''} onChange={(e) => setReadingBookField(idx, 'year', e.target.value)} placeholder="Tahun (mis. 2026)" className={inputClsSm} />
                    <input type="text" value={book.language || ''} onChange={(e) => setReadingBookField(idx, 'language', e.target.value)} placeholder="Bahasa" className={inputClsSm} />
                    <input type="text" value={book.format || ''} onChange={(e) => setReadingBookField(idx, 'format', e.target.value)} placeholder="Format (Novel, E-Book, Booklet...)" className={inputClsSm} />
                    <input type="number" min="0" max="100" value={book.progress || ''} onChange={(e) => setReadingBookField(idx, 'progress', e.target.value)} placeholder="Progress naskah (%)" className={inputClsSm} />
                  </div>
                  <textarea rows={2} value={book.pitch || ''} onChange={(e) => setReadingBookField(idx, 'pitch', e.target.value)} placeholder="One-line pitch — satu kalimat yang menjual gagasan karya" className={`${inputClsSm} resize-none`} />
                  <textarea rows={2} value={book.summary} onChange={(e) => setReadingBookField(idx, 'summary', e.target.value)} placeholder="Ringkasan singkat" className={`${inputClsSm} resize-none`} />
                  <textarea rows={3} value={book.fullDescription} onChange={(e) => setReadingBookField(idx, 'fullDescription', e.target.value)} placeholder="Deskripsi lengkap" className={`${inputClsSm} resize-none`} />
                  <textarea rows={3} value={book.whyWritten || ''} onChange={(e) => setReadingBookField(idx, 'whyWritten', e.target.value)} placeholder="Why I wrote this — alasan personal/kreatif menulis karya ini" className={`${inputClsSm} resize-none`} />
  
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Book Autopsy</p>
                      <p className="mt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">Empat catatan pendek yang mengelilingi cover di halaman Book. Kosongkan field yang tidak ingin ditampilkan.</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <textarea rows={2} value={book.origin || ''} onChange={(e) => setReadingBookField(idx, 'origin', e.target.value)} placeholder="Origin — dari mana gagasan buku ini lahir?" className={`${inputClsSm} resize-none`} />
                      <textarea rows={2} value={book.coreQuestion || ''} onChange={(e) => setReadingBookField(idx, 'coreQuestion', e.target.value)} placeholder="Core Question — pertanyaan utama buku" className={`${inputClsSm} resize-none`} />
                      <textarea rows={2} value={book.writtenDuring || ''} onChange={(e) => setReadingBookField(idx, 'writtenDuring', e.target.value)} placeholder="Written During — periode atau keadaan saat ditulis" className={`${inputClsSm} resize-none`} />
                      <textarea rows={2} value={book.almostDeleted || ''} onChange={(e) => setReadingBookField(idx, 'almostDeleted', e.target.value)} placeholder="Almost Deleted — bagian yang nyaris dibuang" className={`${inputClsSm} resize-none`} />
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
                        if (url) setReadingBookField(idx, 'coverImage', url);
                        e.target.value = '';
                      }}
                      className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                    />
                  </div>
                  <input type="text" value={book.coverImage} onChange={(e) => setReadingBookField(idx, 'coverImage', e.target.value)} placeholder="Atau tempel URL Cover Buku" className={inputClsSm} />
  
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
                          if (url) setReadingBookField(idx, 'overviewImage', url);
                          e.target.value = '';
                        }}
                        className="flex-1 text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 disabled:opacity-60"
                      />
                    </div>
                    <input type="text" value={book.overviewImage || ''} onChange={(e) => setReadingBookField(idx, 'overviewImage', e.target.value)} placeholder="Atau tempel URL Foto Overview" className={`${inputClsSm} mt-2`} />
                  </div>
  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="text" value={book.pageCount || ''} onChange={(e) => setReadingBookField(idx, 'pageCount', e.target.value)} placeholder="Jumlah Halaman (mis. 184)" className={inputClsSm} />
                  </div>
  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="text" value={book.actionText} onChange={(e) => setReadingBookField(idx, 'actionText', e.target.value)} placeholder="Teks Tombol (mis. Beli Buku Ini)" className={inputClsSm} />
                    <input type="text" value={book.actionUrl} onChange={(e) => setReadingBookField(idx, 'actionUrl', e.target.value)} placeholder="Link Tombol" className={inputClsSm} />
                    <input type="text" value={book.secondaryText || ''} onChange={(e) => setReadingBookField(idx, 'secondaryText', e.target.value)} placeholder="Teks tombol kedua (opsional)" className={inputClsSm} />
                    <input type="text" value={book.secondaryUrl || ''} onChange={(e) => setReadingBookField(idx, 'secondaryUrl', e.target.value)} placeholder="Link tombol kedua" className={inputClsSm} />
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
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Tab Projects</h2>


            <Field label="Heading Halaman">
              <input type="text" value={formData.projects.heading} onChange={(e) => setProjectsField('heading', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Subheading Halaman">
              <textarea rows={2} value={formData.projects.subheading} onChange={(e) => setProjectsField('subheading', e.target.value)} className={`${inputCls} resize-none`} />
            </Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Judul Project Index"><input value={formData.projects.indexHeading || ''} onChange={(e) => setProjectsField('indexHeading', e.target.value)} className={inputCls} /></Field>
              <Field label="Keterangan Project Index"><input value={formData.projects.indexDescription || ''} onChange={(e) => setProjectsField('indexDescription', e.target.value)} className={inputCls} /></Field>
              <Field label="Label pencarian"><input value={formData.projects.searchLabel || ''} onChange={(e) => setProjectsField('searchLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Tulisan kembali ke index"><input value={formData.projects.backLabel || ''} onChange={(e) => setProjectsField('backLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Tulisan buka drawer"><input value={formData.projects.openDrawerLabel || ''} onChange={(e) => setProjectsField('openDrawerLabel', e.target.value)} className={inputCls} /></Field>
            </div>

            <CollapsibleSection sectionKey="projects-card-descriptions" title="Keterangan kartu setiap tab">

              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Keterangan kartu setiap tab</h3>
                <p className="mt-1 text-xs text-gray-500">Kosongkan kolom untuk menghapus tulisan di bawah nama tab. Tab baru otomatis muncul di bagian ini.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label={formData.projects.articlesLabel || 'Articles'}><input value={formData.projects.articlesDescription || ''} onChange={(e) => setProjectsField('articlesDescription', e.target.value)} className={inputCls} /></Field>
                <Field label={formData.projects.directingLabel || 'Directing'}><input value={formData.projects.directingDescription || ''} onChange={(e) => setProjectsField('directingDescription', e.target.value)} className={inputCls} /></Field>
                <Field label={formData.projects.posterLabel || 'Poster'}><input value={formData.projects.posterDescription || ''} onChange={(e) => setProjectsField('posterDescription', e.target.value)} className={inputCls} /></Field>
                {formData.projects.customSections.map((section, sectionIdx) => (
                  <Field key={section.id || sectionIdx} label={section.label || `Tab Baru #${sectionIdx + 1}`}>
                    <input value={section.description || ''} onChange={(e) => setCustomSectionDescription(sectionIdx, e.target.value)} className={inputCls} />
                  </Field>
                ))}
              </div>
            
            </CollapsibleSection>

            <CollapsibleSection sectionKey="projects-content-manager" title={cmsCopy("Konten Projects", "Projects Content")} subtitle={cmsCopy("Articles, Directing, Poster, dan tab tambahan", "Articles, Directing, Posters, and additional tabs")}>
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
                    label: `${cs.label || `Tab Baru #${idx + 1}`} (${Array.isArray(cs.items) ? cs.items.length : 0})`,
                  })),
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setActiveProjectsSubTab(t.key); bumpCmsDomRevision(); }}
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
                  {cmsCopy("+ Tambah Tab", "+ Add Tab")}
                </button>
              </div>
  
              {/* ARTICLES — gaya portal berita, artikel pertama otomatis jadi unggulan */}
              {activeProjectsSubTab === 'articles' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{cmsCopy("Articles", "Articles")}</h3>
                  <AddBtn onClick={addArticle} label={cmsCopy("Tambah Artikel", "Add Article")} />
                </div>
                <Field label={cmsCopy('Nama Tab (tampil di navigasi, kosongkan buat pakai "Articles")', 'Tab Name (shown in navigation, leave blank to use "Articles")')}>
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
                          if (!(await validateProjectCover(file, 'writing'))) { e.target.value = ''; return; }
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
                      <div className="flex items-center gap-2">{item.posterImage && <img src={item.posterImage} alt="" className="h-12 w-20 rounded object-cover" />}<input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files[0]; if (!file) return; if (!(await validateProjectCover(file, 'video'))) { e.target.value = ''; return; } const key = `directing-${idx}`; setUploadingGalleryImage(key); const url = await uploadImageToStorage(file); setUploadingGalleryImage(null); if (url) setDirectingItemField(idx, 'posterImage', url); e.target.value = ''; }} className="flex-1 text-[10px]" /></div>
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
            </CollapsibleSection>
          </div>
        )}

        {/* ================= CONTACT ================= */}
        {activeTab === 'contact' && (
          <div className="space-y-5">
            <h2 className="text-sm font-bold border-b pb-2 border-gray-100 dark:border-gray-800 text-blue-600 dark:text-blue-400">Contact — New Collaboration Document</h2>
            <Field label="Heading Utama"><textarea rows={2} value={formData.contact.heading} onChange={(e) => setContactField('heading', e.target.value)} className={`${inputCls} resize-none`} /></Field>
            <Field label="Subheading"><textarea rows={2} value={formData.contact.subheading} onChange={(e) => setContactField('subheading', e.target.value)} className={`${inputCls} resize-none`} /></Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Judul formulir"><input value={formData.contact.formTitle || ''} onChange={(e) => setContactField('formTitle', e.target.value)} className={inputCls} /></Field>
              <Field label="Judul properties"><input value={formData.contact.propertiesTitle || ''} onChange={(e) => setContactField('propertiesTitle', e.target.value)} className={inputCls} /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Email Tujuan"><input type="email" value={formData.contact.email} onChange={(e) => setContactField('email', e.target.value)} className={inputCls} /></Field>
              <Field label="Lokasi Fallback"><input type="text" value={formData.contact.location} onChange={(e) => setContactField('location', e.target.value)} className={inputCls} /></Field>
              <Field label="Label Tombol Draft"><input type="text" value={formData.contact.draftButtonLabel} onChange={(e) => setContactField('draftButtonLabel', e.target.value)} className={inputCls} /></Field>
              <Field label="Notifikasi Setelah Klik"><input type="text" value={formData.contact.responseNote} onChange={(e) => setContactField('responseNote', e.target.value)} className={inputCls} /></Field>
            </div>

            <CollapsibleSection sectionKey="contact-content-manager" title="Konten Contact" subtitle="Jalur inquiry, opsi, properties, sosial media, dan link tambahan">
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
            </CollapsibleSection>
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
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Judul Quick View"><input value={formData.home.visitorIntroduction.quickViewLabel || ''} onChange={(e) => setVisitorIntroduction('quickViewLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Judul Document Index"><input value={formData.home.visitorIntroduction.documentIndexLabel ?? 'Document index'} onChange={(e) => setVisitorIntroduction('documentIndexLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Tombol Projects"><input value={formData.home.visitorIntroduction.selectedWorksLabel || ''} onChange={(e) => setVisitorIntroduction('selectedWorksLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Tombol Careers"><input value={formData.home.visitorIntroduction.experienceLabel || ''} onChange={(e) => setVisitorIntroduction('experienceLabel', e.target.value)} className={inputCls} /></Field>
                <Field label="Tombol Contact"><input value={formData.home.visitorIntroduction.contactLabel || ''} onChange={(e) => setVisitorIntroduction('contactLabel', e.target.value)} className={inputCls} /></Field>
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
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-500">Satu pusat klasemen untuk seluruh Mini Game. Setiap game tetap punya ranking sendiri; panel ini dipakai untuk melihat pemain, personal best, attempts, dan moderasi nama.</p>
                </div>
                <button type="button" onClick={loadLeaderboardSystems} disabled={leaderboardLoading} className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">{leaderboardLoading ? 'Memuat…' : 'Refresh'}</button>
              </div>

              {leaderboardError && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{leaderboardError}</div>}

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setLeaderboardGameFilter('all')} className={`rounded-full border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider ${leaderboardGameFilter === 'all' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500 dark:border-gray-600'}`}>Semua Game · {leaderboardRows.length}</button>
                {gameIds.map((gameId) => <button key={gameId} type="button" onClick={() => setLeaderboardGameFilter(gameId)} className={`rounded-full border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider ${leaderboardGameFilter === gameId ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 text-gray-500 dark:border-gray-600'}`}>{gameId.replace(/-/g, ' ')} · {leaderboardRows.filter((row) => (row.gameId || 'red-pen') === gameId).length}</button>)}
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                  <thead className="bg-gray-50 font-mono text-[10px] uppercase tracking-wider text-gray-500 dark:bg-[#282828]">
                    <tr><th className="px-3 py-3">Rank</th><th className="px-3 py-3">Pemain</th><th className="px-3 py-3">Game</th><th className="px-3 py-3">Score</th><th className="px-3 py-3">Accuracy</th><th className="px-3 py-3">Attempts</th><th className="px-3 py-3">Active Time</th><th className="px-3 py-3 text-right">Moderasi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rankedRows.map((row) => <tr key={row.id} className="bg-white dark:bg-[#242424]">
                      <td className="px-3 py-3 font-mono font-bold">#{row.rank}</td>
                      <td className="px-3 py-3"><strong className="block max-w-48 truncate">{row.playerName || 'Anonymous'}</strong><span className="mt-0.5 block max-w-48 truncate font-mono text-[9px] text-gray-400">{row.playerId || 'legacy'}</span></td>
                      <td className="px-3 py-3 font-mono uppercase">{(row.gameId || 'red-pen').replace(/-/g, ' ')}</td>
                      <td className="px-3 py-3 font-mono font-bold">{row.score}</td>
                      <td className="px-3 py-3">{row.accuracy}%</td>
                      <td className="px-3 py-3">{row.attempts}</td>
                      <td className="px-3 py-3 font-mono">{Math.floor((row.activeSeconds || 0) / 60)}:{String((row.activeSeconds || 0) % 60).padStart(2, '0')}</td>
                      <td className="px-3 py-3 text-right"><button type="button" disabled={deletingLeaderboardId === row.id} onClick={() => requestRemoveLeaderboardEntry(row)} className="rounded border border-red-200 px-2.5 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/20">{deletingLeaderboardId === row.id ? 'Menghapus…' : 'Hapus'}</button></td>
                    </tr>)}
                    {!leaderboardLoading && !rankedRows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Belum ada pemain di klasemen ini.</td></tr>}
                    {leaderboardLoading && !rankedRows.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">Memuat klasemen…</td></tr>}
                  </tbody>
                </table>
              </div>
              {leaderboardDeleteTarget && <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingLeaderboardId) setLeaderboardDeleteTarget(null); }}>
                <div role="dialog" aria-modal="true" aria-labelledby="leaderboard-delete-title" className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-[#242424]">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Leaderboard Systems</p>
                  <h3 id="leaderboard-delete-title" className="mt-2 text-base font-bold text-gray-900 dark:text-white">Hapus {leaderboardDeleteTarget.playerName || 'pemain ini'} dari klasemen {(leaderboardDeleteTarget.gameId || 'Mini Game').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}?</h3>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">Entry pemain ini untuk game tersebut akan dihapus dari klasemen.</p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" disabled={Boolean(deletingLeaderboardId)} onClick={() => setLeaderboardDeleteTarget(null)} className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">Batal</button>
                    <button type="button" disabled={Boolean(deletingLeaderboardId)} onClick={confirmRemoveLeaderboardEntry} className="rounded border border-red-600 bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">{deletingLeaderboardId ? 'Menghapus…' : 'Hapus Pemain'}</button>
                  </div>
                </div>
              </div>}
              <p className="text-[10px] leading-relaxed text-gray-400">Ranking mengikuti urutan yang sama dengan game: score tertinggi, accuracy tertinggi, active time tercepat, lalu record lebih awal. Hapus hanya menghapus entry klasemen pemain tersebut untuk game terkait.</p>
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
              Pengaturan situs secara keseluruhan — bukan punya satu halaman tertentu, jadi
              kepisah dari 6 tab konten di atas.
            </p>

            <CollapsibleSection sectionKey="general-mechanical-sound" title="Mechanical Interaction Sound">

              <div><h3 className="text-xs font-bold text-gray-800 dark:text-gray-100">Mechanical Interaction Sound</h3><p className="text-[11px] text-gray-400 mt-0.5">Suara klik mekanis setelah pengunjung berinteraksi pertama kali. Pengunjung tetap bisa mematikannya dari Title Bar.</p></div>
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

              <Field label="Daftar update">
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
                          <button type="button" onClick={() => removeWelcomePatchItem(index)} className="ml-1 text-[10px] font-semibold text-red-500 hover:text-red-600">Hapus</button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={item?.title || ''}
                        onChange={(e) => setWelcomePatchItem(index, 'title', e.target.value)}
                        placeholder="Judul update"
                        className={inputCls}
                      />
                      <textarea
                        rows={2}
                        value={item?.description || ''}
                        onChange={(e) => setWelcomePatchItem(index, 'description', e.target.value)}
                        placeholder="Apa yang berubah?"
                        className={`${inputCls} mt-2 resize-y`}
                      />
                    </div>
                  ))}
                </div>
                {(formData.general.welcomeNotification.items || []).length === 0 && (
                  <p className="mb-2 text-[10px] text-gray-400">
                    Belum ada daftar update. Selama kosong, notifikasi publik tetap memakai Isi Patch lama agar data lama tidak hilang.
                  </p>
                )}
                <button
                  type="button"
                  onClick={addWelcomePatchItem}
                  className="mt-2 text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40"
                >
                  + Tambah Update
                </button>
              </Field>

              <Field label="Isi patch lama (fallback)">
                <textarea
                  rows={2}
                  value={formData.general.welcomeNotification.message}
                  onChange={(e) => setWelcomeNotification('message', e.target.value)}
                  placeholder="Dipakai hanya kalau Daftar Update masih kosong."
                  className={`${inputCls} resize-y`}
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  Disimpan untuk kompatibilitas data lama. Kalau Daftar Update sudah berisi item, tampilan publik memakai daftar di atas.
                </p>
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
