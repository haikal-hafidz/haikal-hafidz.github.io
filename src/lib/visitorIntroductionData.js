export const DEFAULT_VISITOR_INTRODUCTION = {
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
  quickViewLabel: 'Quick view',
  selectedWorksLabel: 'Selected works',
  experienceLabel: 'Experience',
  contactLabel: 'Contact',
};

export const normalizeVisitorIntroduction = (raw) => ({
  ...DEFAULT_VISITOR_INTRODUCTION,
  ...(raw || {}),
});
