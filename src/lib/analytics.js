// src/lib/analytics.js
//
// Wrapper tipis buat Google Analytics 4. Sengaja dipisah dari komponen manapun
// biar App.jsx cuma perlu panggil 2 fungsi: initAnalytics() sekali pas app kebuka,
// dan trackPageView() tiap kali visitor pindah tab (Home/About/Career/dst).
//
// GA4 di sini SENGAJA gak nge-track otomatis (send_page_view: false) — karena situs
// ini satu halaman doang (SPA, gak ganti URL beneran pas pindah tab), jadi page view
// dikirim manual tiap activeTab berubah, biar tiap tab kehitung sebagai "halaman"
// sendiri di laporan Analytics (bukan cuma 1x pas web pertama dibuka).

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let isInitialized = false;

// Panggil SEKALI aja pas App.jsx pertama kali mount. Kalau .env belum diisi
// VITE_GA_MEASUREMENT_ID, fungsi ini gak ngapa-ngapain (aman buat development lokal
// atau kalau lo belum sempat setup GA4 sama sekali).
export function initAnalytics() {
  if (isInitialized) return;
  if (!MEASUREMENT_ID) {
    console.info('Analytics: VITE_GA_MEASUREMENT_ID belum diisi di .env — GA4 gak diaktifkan.');
    return;
  }

  // Suntik script gtag.js dari Google secara dinamis — cuma kejalan kalau ID-nya ada,
  // jadi visitor yang buka versi development gak ikut nge-load script pihak ketiga ini.
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });

  isInitialized = true;
}

// Panggil tiap kali tab aktif berubah (Home → About → Career, dst). Kalau GA4 belum
// diaktifkan (ID kosong), ini juga gak ngapa-ngapain.
export function trackPageView(pageName) {
  if (!isInitialized) return;
  window.gtag('event', 'page_view', {
    page_title: pageName,
    page_path: `/${pageName.toLowerCase()}`,
  });
}

// Buat event kustom lain di masa depan kalau perlu (mis. klik tombol "Hire Me",
// submit form kontak, dsb) — dipanggil trackEvent('nama_event', { detail: '...' }).
export function trackEvent(eventName, params = {}) {
  if (!isInitialized) return;
  window.gtag('event', eventName, params);
}