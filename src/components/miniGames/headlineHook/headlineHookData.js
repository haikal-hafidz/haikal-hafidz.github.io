const DEFAULT_HEADLINE_HOOK = {
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

export default DEFAULT_HEADLINE_HOOK;
