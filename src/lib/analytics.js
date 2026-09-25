// src/lib/analytics.js
//
// GA4 tetap mencatat page view SPA seperti sebelumnya, tetapi script pihak ketiga
// baru diunduh setelah initial render selesai / browser idle. Page view yang terjadi
// sebelum GA siap diantrikan lalu dikirim setelah inisialisasi.

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

let isInitialized = false;
let initScheduled = false;
let pendingPageView = null;

function sendPageView(pageName) {
  window.gtag('event', 'page_view', {
    page_title: pageName,
    page_path: `/${pageName.toLowerCase()}`,
  });
}

function performInit() {
  if (isInitialized || !MEASUREMENT_ID) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
  isInitialized = true;

  if (pendingPageView) {
    sendPageView(pendingPageView);
    pendingPageView = null;
  }
}

export function initAnalytics() {
  if (isInitialized || initScheduled) return;
  if (!MEASUREMENT_ID) {
    console.info('Analytics: VITE_GA_MEASUREMENT_ID belum diisi di .env — GA4 gak diaktifkan.');
    return;
  }

  initScheduled = true;

  const scheduleIdle = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(performInit, { timeout: 4000 });
    } else {
      window.setTimeout(performInit, 2500);
    }
  };

  if (document.readyState === 'complete') {
    scheduleIdle();
  } else {
    window.addEventListener('load', scheduleIdle, { once: true });
  }
}

export function trackPageView(pageName) {
  if (!MEASUREMENT_ID) return;
  if (!isInitialized) {
    pendingPageView = pageName;
    return;
  }
  sendPageView(pageName);
}

export function trackEvent(eventName, params = {}) {
  if (!isInitialized) return;
  window.gtag('event', eventName, params);
}
