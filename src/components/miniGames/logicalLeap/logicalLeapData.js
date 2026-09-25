const DEFAULT_LOGICAL_LEAP = {
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

export default DEFAULT_LOGICAL_LEAP;
