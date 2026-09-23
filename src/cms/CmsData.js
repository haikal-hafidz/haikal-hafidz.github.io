// src/data/cmsData.js

export const initialPortfolioData = {
  // 1. HOME DATA
  home: {
    name: "Haikal A. Hafidz",
    role: "Writer & Editor",
    bio: "Saya mengubah pengamatan, keruwetan, dan gagasan mentah menjadi cerita yang dapat dibaca, dilihat, dan dirasakan.",
    // Foto buat LIGHT mode: B&W, background terang, lighting di muka udah
    // baked-in di file fotonya (bukan hasil filter CSS).
    photoUrl: "",
    // Foto buat DARK mode: warna asli, background gelap, lighting di muka
    // juga udah baked-in. Kalau dikosongin, otomatis fallback pakai
    // `photoUrl` yang sama (lihat Home.jsx).
    photoUrlDark: "",
    dynamicStatement: {
      enabled: true,
      prefix: "Gue",
      highlightedWord: "mengubah",
      connector: "menjadi",
      size: "large",
      speed: "normal",
      pauseDuration: 2700,
      pairs: [
        { source: "pengamatan", result: "cerita" },
        { source: "keruwetan", result: "esai" },
        { source: "gagasan mentah", result: "naskah" },
        { source: "momen biasa", result: "cerita visual" }
      ]
    },
    experience: {
      enabled: true,
      cursorHint: 'Click to interrupt',
      choicePrompt: 'Mau main atau membawa pulang sesuatu?',
      signatureRole: 'Writer & Editor',
      dialogue: [
        { prompt: 'Eh—lo sadar gue ada di sini?', yes: 'Sadar.', no: 'Baru sadar.' },
        { prompt: 'Bagus. Gue menyimpan dua jalan kecil di dokumen ini.', yes: 'Tunjukin.', no: 'Tetap tunjukin.' }
      ]
    },
    visitorIntroduction: {
      enabled: true,
      triggerEyebrow: 'First time here?',
      triggerTitle: 'New to this document?',
      triggerAction: 'Print the introduction',
      documentCode: 'VISITOR’S COPY / DOCUMENT 00',
      recipient: 'PRINTED FOR: SOMEONE NEW',
      kicker: 'A note before wandering',
      title: 'Before you read the document, here’s what kind of document this is.',
      body: 'Portofolio ini disusun seperti dokumen kerja karena sebagian besar pekerjaan saya dimulai dengan halaman kosong—kemudian berubah menjadi tulisan, gambar, film, buku, atau sesuatu yang belum memiliki nama.',
      closing: 'Tidak ada urutan baca yang benar. Mulailah dari tab mana pun, atau biarkan dokumen memilihkannya.',
      closeLabel: 'Close introduction',
      printedLabel: 'Visitor’s copy printed',
      sections: [
        { tab: 'Home', label: 'Home', description: 'Pernyataan yang terus ditulis ulang.' },
        { tab: 'About', label: 'About', description: 'Catatan dan sifat-sifat penulisnya.' },
        { tab: 'Projects', label: 'Projects', description: 'Laci untuk tulisan, gambar, dan film.' },
        { tab: 'Career', label: 'Career', description: 'Riwayat versi, bukan sekadar daftar pencapaian.' },
        { tab: 'Book', label: 'Book', description: 'Autopsi karya yang pernah menjadi buku.' },
        { tab: 'Contact', label: 'Contact', description: 'Tempat memulai dokumen berikutnya bersama-sama.' }
      ]
    }
  },

  // HOME SECRET: COMMUNITY ZINE
  zine: {
    enabled: true,
    menuLabel: 'Wassup?',
    title: 'Write one. Receive one.',
    writePrompt: 'Tulis sesuatu yang layak ditemukan orang lain…',
    submitSuccess: 'Tulisan tersimpan. Publikasi dilakukan setelah melewati kurasi.',
    maxLength: 1200,
    entries: [
      { id: 'zine-1', label: 'Zine for a stranger', title: 'Tentang berhenti sebentar', author: 'Haikal A. Hafidz', body: 'Tidak semua jeda adalah kemunduran. Kadang kita sedang memberi bentuk kepada sesuatu yang belum punya nama.', published: true }
    ]
  },

  // HOME SECRET: UNFINISHED BOOK MINI GAME
  miniGame: {
    enabled: true,
    menuLabel: 'Mini Game',
    libraryTitle: 'Choose a desk.',
    libraryDescription: 'Pilih satu meja kerja. Setiap permainan menguji bagian berbeda dari proses mengubah gagasan mentah menjadi naskah.',
    gameName: 'The Red Pen',
    gameCategory: 'Editorial',
    gameCardDescription: 'Temukan bagian yang janggal, ambigu, dan tidak efektif sebelum draft dikirim.',
    showInLibrary: true,
    illustration: '',
    gameSlots: [],
    title: 'Inspect the unfinished draft.',
    objective: 'Lima draft belum selesai menunggu meja editor. Temukan bagian yang janggal, bertele-tele, ambigu, atau tidak efektif sebelum waktunya habis.',
    rules: {
      click: 'Klik atau tap kata/frasa bermasalah.',
      timer: 'Tiap draft punya waktu 60 detik.',
      wrong: 'Pilihan salah menurunkan akurasi dan skor.',
      hint: 'Satu hint tersedia untuk seluruh sesi.',
      review: 'Seusai tiap draft, baca alasan editorialnya—waktu berhenti saat review.'
    },
    startButtonLabel: 'Mulai Mengedit',
    secondsPerDraft: 60,
    draftsPerSession: 5,
    scoreSettings: { correctPoints: 100, wrongPenalty: 25, completionBonus: 100, maxTimeBonus: 100, hintPenalty: 75 },
    gradeTitles: [
      { min: 90, label: 'Senior Red Pen' },
      { min: 75, label: 'Sharp-eyed Editor' },
      { min: 55, label: 'Promising Proofreader' },
      { min: 0, label: 'Draft Survivor' }
    ],
    resultEyebrow: 'Final editorial report',
    replayLabel: 'Main lagi',
    projectsCtaLabel: 'Lihat tulisan Haikal',
    contactCtaLabel: 'Hubungi Haikal',
    drafts: [
      {
        id: 'red-pen-1', label: 'Pemanasan', enabled: true,
        passage: 'Tim kami berkolaborasi bersama untuk menyusun panduan penggunaan aplikasi yang mudah dipahami oleh pengguna baru.',
        issues: [
          { id: 'rp-1-1', phrase: 'berkolaborasi bersama', replacement: 'berkolaborasi', explanation: 'Kata “berkolaborasi” sudah mengandung makna bekerja bersama; “bersama” menjadi redundan.' },
          { id: 'rp-1-2', phrase: 'oleh pengguna baru', replacement: 'pengguna baru', explanation: 'Bentuk aktif lebih langsung: “yang mudah dipahami pengguna baru”.' }
        ]
      },
      {
        id: 'red-pen-2', label: 'Instruksi', enabled: true,
        passage: 'Untuk dapat memulai proses instalasi, pengguna terlebih dahulu harus melakukan klik pada tombol Unduh yang terdapat di bagian atas halaman.',
        issues: [
          { id: 'rp-2-1', phrase: 'Untuk dapat memulai proses instalasi', replacement: 'Untuk memulai instalasi', explanation: '“Dapat” dan “proses” tidak menambah informasi pada instruksi ini.' },
          { id: 'rp-2-2', phrase: 'terlebih dahulu harus melakukan klik pada', replacement: 'klik', explanation: 'Instruksi teknis sebaiknya memakai verba langsung dan ringkas.' },
          { id: 'rp-2-3', phrase: 'yang terdapat di bagian atas halaman', replacement: 'di bagian atas halaman', explanation: 'Frasa “yang terdapat” dapat dipangkas tanpa mengubah makna.' }
        ]
      },
      {
        id: 'red-pen-3', label: 'Antarmuka', enabled: true,
        passage: 'Apabila pengguna lupa kata sandi miliknya sendiri, mereka bisa menekan tautan Lupa Kata Sandi agar supaya sistem dapat mengirimkan email pemulihan.',
        issues: [
          { id: 'rp-3-1', phrase: 'miliknya sendiri', replacement: 'hapus', explanation: 'Kepemilikan sudah jelas dari konteks; frasa ini berlebihan.' },
          { id: 'rp-3-2', phrase: 'bisa menekan', replacement: 'pilih', explanation: 'Gunakan istilah tindakan antarmuka yang konsisten dan langsung.' },
          { id: 'rp-3-3', phrase: 'agar supaya', replacement: 'agar', explanation: '“Agar” dan “supaya” memiliki fungsi sama; gunakan salah satu.' }
        ]
      },
      {
        id: 'red-pen-4', label: 'Prosedur', enabled: true,
        passage: 'Setelah file berhasil selesai diunggah, kemudian sistem nantinya akan secara otomatis menampilkan sebuah notifikasi pemberitahuan kepada pengguna.',
        issues: [
          { id: 'rp-4-1', phrase: 'berhasil selesai diunggah', replacement: 'selesai diunggah', explanation: '“Berhasil” dan “selesai” bertumpuk dalam konteks hasil unggahan.' },
          { id: 'rp-4-2', phrase: 'kemudian', replacement: 'hapus', explanation: 'Kata “setelah” sudah menandai urutan; “kemudian” tidak diperlukan.' },
          { id: 'rp-4-3', phrase: 'nantinya akan secara otomatis', replacement: 'akan otomatis', explanation: 'Pangkas penanda waktu dan cara yang bertumpuk.' },
          { id: 'rp-4-4', phrase: 'sebuah notifikasi pemberitahuan', replacement: 'notifikasi', explanation: 'Notifikasi sudah berarti pemberitahuan.' }
        ]
      },
      {
        id: 'red-pen-5', label: 'Final Draft', enabled: true,
        passage: 'Fitur ini dibuat dengan tujuan untuk membantu para pengguna-pengguna dalam melakukan pengelolaan data secara lebih mudah, cepat, dan juga efisien dalam waktu yang bersamaan.',
        issues: [
          { id: 'rp-5-1', phrase: 'dibuat dengan tujuan untuk membantu', replacement: 'membantu', explanation: 'Pembuka nominal ini dapat diganti verba langsung.' },
          { id: 'rp-5-2', phrase: 'para pengguna-pengguna', replacement: 'pengguna', explanation: 'Jamak ganda: “para” dan pengulangan kata tidak dipakai bersamaan.' },
          { id: 'rp-5-3', phrase: 'dalam melakukan pengelolaan', replacement: 'mengelola', explanation: 'Nominalisasi membuat kalimat lebih panjang daripada verba aktif.' },
          { id: 'rp-5-4', phrase: 'dan juga', replacement: 'dan', explanation: '“Juga” tidak diperlukan dalam deret setara ini.' }
        ]
      }
    ]
  },

  // 2. ABOUT DATA
  about: {
    listeningFootnote: {
      enabled: true,
      username: "",
      nowPlayingLabel: "Playing while editing",
      lastPlayedLabel: "Last heard",
      fallbackLabel: "On repeat lately",
      fallbackTitle: "",
      fallbackArtist: "",
      fallbackImage: "",
      fallbackUrl: ""
    },
    headline: "Ideas rarely arrive finished. I work on what they can become.",
    bio: "Saya menulis dan menyunting cerita, esai, naskah, serta materi kreatif. Latar psikologi membantu saya membaca perilaku dan audiens; proses editorial membantu saya memberi bentuk pada hasil pengamatan itu.",
    signature: "Haikal A. Hafidz",
    locationLine: "Batam, Indonesia · Open to selected collaborations",
    notesVisible: true,
    notesLimit: 3,
    note1Label: "",
    note1: "",
    note2Label: "",
    note2: "",
    note3Label: "",
    note3: "",
    authorProperties: {
      enabled: true,
      buttonLabel: "View author properties…",
      panelTitle: "Author Properties",
      lastRevised: "",
      items: [
        { id: "author-status", label: "Status", value: "Mid-river / Still becoming", url: "" },
        { id: "author-based-in", label: "Based in", value: "Batam, Indonesia", url: "" },
        { id: "author-writing", label: "Currently writing", value: "", url: "" },
        { id: "author-reading", label: "Currently reading", value: "", url: "" },
        { id: "author-soundtrack", label: "Current soundtrack", value: "", url: "" },
        { id: "author-fixation", label: "Current fixation", value: "", url: "" },
        { id: "author-conditions", label: "Works best when", value: "", url: "" }
      ]
    }
  },

  // 3. CAREER DATA (kategori sekarang bebas ditambah/dihapus/diubah namanya lewat CMS,
  // gak lagi di-hardcode cuma School/College/Professional).
  // `categories` = array kategori, tiap kategori punya:
  //  - id: identifier unik (dipakai sebagai key React & referensi item, gak perlu diedit manual)
  //  - name: nama kategori yang tampil di kartu menu (bebas diganti lewat CMS)
  //  - type: 'career' (format lama: Posisi @ Instansi, periode, pop-up detail instansi — dipakai
  //    buat Professional/College/Organisasi/dll) ATAU 'credential' (format baru: nama pencapaian/
  //    sertifikat, penyelenggara, tanggal, gambar bukti, link verifikasi — dipakai buat
  //    Achievements/Certificates/dll). Dipilih sekali pas bikin kategori baru dari CMS.
  //  - bgImage: gambar latar buat kartu menu ala game-menu (kosongkan biar pakai gradasi
  //    warna default, isi lewat CMS/upload galeri kalau mau custom)
  //  - items: daftar entri di kategori itu (bisa berapa aja, tambah/hapus lewat CMS), bentuk
  //    field-nya nyesuaiin `type` di atas (lihat contoh di bawah)
  //    - hintEnabled (boolean, opsional): kontrol apakah nama instansi/judul di item ini ikut
  //      nge-blink pas mode Hint (tombol pojok kiri atas) diaktifin visitor. Defaultnya true
  //      kalau field ini gak ada.
  //
  // CATATAN MIGRASI: kategori "School" udah sengaja DIHAPUS dari default (dianggap gak relevan
  // lagi buat ditampilin). Data lama di Supabase yang masih format lama (school/college/
  // professional sebagai key tetap) otomatis dikonversi ke bentuk `categories` ini pas dibuka
  // lewat CMS/halaman publik — School-nya didrop, Professional & College-nya dipertahankan.
  career: {
    // Judul & sub-judul di layar menu utama halaman Career (bisa diedit lewat CMS)
    heading: 'Career & Education',
    subheading: 'Pilih salah satu buat lihat perjalanannya.',
    archiveTitle: 'A record of work, study, and things that became experience.',
    archiveIntro: 'An unfinished archive of where I learned, worked, led, and changed direction.',
    archiveButtonLabel: 'Open career archive',
    credentialsButtonLabel: 'View credentials',
    categories: [
      {
        id: 'creative-experience',
        name: 'Creative Experience',
        type: 'career',
        bgImage: '',
        items: [
          {
            id: 'creative-media-lead',
            hintEnabled: true,
            role: 'Head of Creative Media',
            company: 'Faculty of Psychology Student Organization',
            location: 'Indonesia',
            period: '',
            description: 'Memimpin pengembangan lebih dari sepuluh produksi digital dan membantu meningkatkan engagement kanal organisasi.',
            companyInfo: {
              name: 'Faculty of Psychology Student Organization',
              address: '',
              photo: '',
              about: 'Pengalaman memimpin proses kreatif, menyusun konsep, dan mengubah gagasan organisasi menjadi keluaran visual serta editorial.'
            }
          }
        ]
      },
      {
        id: 'education',
        name: 'Education',
        type: 'career',
        bgImage: '',
        items: [
          {
            id: 'psychology-degree',
            hintEnabled: true,
            role: 'Bachelor of Psychology',
            company: 'Psychology',
            location: 'Indonesia',
            period: '',
            description: 'Berfokus pada psikologi industri dan organisasi serta perilaku konsumen—fondasi riset yang kini dipakai untuk membaca audiens dan menyusun komunikasi.',
            companyInfo: {
              name: 'Psychology',
              address: '',
              photo: '',
              about: 'Studi mengenai manusia, organisasi, dan perilaku konsumen yang membentuk pendekatan riset serta editorial saya.'
            }
          }
        ]
      },
      {
        id: 'achievements',
        name: 'Achievements',
        type: 'credential',
        bgImage: '',
        items: []
      },
      {
        id: 'certificates',
        name: 'Certificates',
        type: 'credential',
        bgImage: '',
        items: []
      }
    ]
  },

  // 4. BOOKS / KARYA TULIS DATA
  // heading & subheading = judul + keterangan singkat di halaman Book (bisa diedit lewat CMS)
  // items = daftar karya yang tampil di tumpukan buku. overviewImage = foto "halaman kiri"
  // yang muncul pas sampul dibuka (opsional), pageCount = jumlah halaman yang tampil di detail.
  books: {
    heading: 'Books Corner',
    subheading: 'Buku, naskah, dan proses kreatif yang membentuknya.',
    items: [
      {
        id: 'book-1',
        hintEnabled: true,
        title: 'Senin Bertemu Senin dan Itu-itu Lagi',
        myRoles: 'Penulis, Editor',
        author: 'Haikal A. Hafidz',
        publisher: '',
        publicationDate: '2026',
        isbn: '',
        edition: '',
        category: 'Puisi',
        status: 'published',
        year: '2026',
        language: 'Indonesia',
        format: 'E-Book',
        pitch: 'Kumpulan puisi tentang kelelahan yang berulang—Senin yang terus bertemu Senin lagi, dan luka yang datang itu-itu lagi.',
        whyWritten: 'Untuk memberi bahasa pada rutinitas, kegagalan, kesepian, dan cara-cara kecil manusia bertahan.',
        origin: 'Berangkat dari rutinitas yang terasa mengulang dirinya sendiri.',
        coreQuestion: 'Apa yang tersisa ketika hari-hari terus mengulang luka yang sama?',
        writtenDuring: 'Ditulis dari fragmen keseharian dan jeda-jeda yang terasa terlalu panjang.',
        almostDeleted: '',
        progress: '100',
        featured: true,
        startHere: true,
        summary: 'Kumpulan puisi tentang kelelahan yang berulang, rutinitas, dan luka yang datang dengan wajah serupa.',
        fullDescription: 'Buku ini tidak menawarkan jalan keluar yang cepat. Ia mengajak pembaca tinggal sebentar di antara hari Senin, kehilangan, dan pertanyaan yang belum selesai.',
        coverImage: '',
        overviewImage: '',
        pageCount: '38',
        actionText: '',
        actionUrl: ''
      }
    ]
  },


  // 5. PROJECTS & WORKS DATA (Articles gaya portal berita + Poster)
  // heading & subheading = judul + keterangan singkat di halaman Projects (bisa diedit lewat CMS)
  // articles[0] otomatis jadi artikel unggulan (tampil besar), sisanya jadi daftar kecil di sampingnya
  // poster.items = daftar poster langsung (tanpa pengelompokan Sub Bab) yang bisa
  // ditambah/dihapus bebas lewat CMS (tombol "+ Tambah Poster").
  projects: {
    heading: 'Projects, Articles & Visuals',
    subheading: 'Tulisan, film, dan eksperimen visual pilihan.',
    articlesLabel: 'Articles',
    directingLabel: 'Directing',
    posterLabel: 'Poster',
    articles: [],
    // Video/directing work sengaja kosong secara default supaya website tidak
    // menampilkan karya contoh palsu. Tambahkan YouTube, Vimeo, Drive, MP4, atau
    // external screening link dari CMS > Projects > Directing.
    directing: {
      items: []
    },
    poster: { items: [] }
  },

  // 6. CONTACT DATA
  contact: {
    eyebrow: 'NEW DOCUMENT / CONTACT',
    heading: 'Every collaboration begins with an unfinished sentence.',
    subheading: "Tell me what you're trying to make. We can revise the rest together.",
    email: 'haikalhafidz365@gmail.com',
    location: 'Batam, Indonesia',
    draftButtonLabel: 'Create Email Draft',
    responseNote: 'Draft created — review before sending.',
    inquiryPaths: [
      { id: 'project', kind: 'project', label: 'Start a project', subject: 'Project Inquiry', enabled: true },
      { id: 'opportunity', kind: 'opportunity', label: 'Offer an opportunity', subject: 'Opportunity', enabled: true },
      { id: 'hello', kind: 'hello', label: 'Just say hello', subject: 'Hello', enabled: true }
    ],
    serviceOptions: ['Writing', 'Editing', 'Directing', 'Creative Development'],
    stageOptions: ['Just an idea', 'In progress', 'Ready to begin'],
    timelineOptions: ['Flexible', 'This month', 'Specific date'],
    properties: [
      { id: 'status', label: 'Status', value: 'Open for selected projects', enabled: true },
      { id: 'based', label: 'Based in', value: 'Batam, Indonesia', enabled: true },
      { id: 'mode', label: 'Working mode', value: 'Remote / Batam-based', enabled: true },
      { id: 'response', label: 'Response', value: 'Usually within 1–3 days', enabled: true },
      { id: 'fit', label: 'Best fit', value: 'Writing, editing, directing, creative development', enabled: true }
    ],
    socials: [
      { name: 'LinkedIn', url: 'https://linkedin.com', label: 'Connect on LinkedIn' },
      { name: 'GitHub', url: 'https://github.com', label: 'Explore Repositories' },
      { name: 'Instagram', url: 'https://instagram.com', label: 'Behind the Scenes' },
      { name: 'X / Twitter', url: 'https://twitter.com', label: 'Random Thoughts' }
    ],
    actionButtons: [{ label: 'Download Résumé', url: '#', primary: false, body: '' }]
  },

  // 7. INTERACTIVE WORDS — aturan frasa klik yang dikelola dari CMS.
  interactiveWords: [],

  // 9. GENERAL — pengaturan situs secara keseluruhan (bukan punya satu halaman tertentu).
  // Info update patch ditulis manual dari CMS dan muncul kembali saat kode versi berubah.
  general: {
    soundEffects: true,
    welcomeNotification: {
      enabled: true,
      version: '1.0.0',
      title: 'Update terbaru',
      message: 'Catatan perubahan terbaru portofolio akan muncul di sini.',
      delaySeconds: 2,
    },
  }
};
