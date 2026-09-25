export const DEFAULT_PLAGIARISM_POLICE = {
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

export default DEFAULT_PLAGIARISM_POLICE;
