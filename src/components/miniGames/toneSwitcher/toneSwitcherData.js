const DEFAULT_TONE_SWITCHER = {
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

export default DEFAULT_TONE_SWITCHER;
