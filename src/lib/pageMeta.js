// src/lib/pageMeta.js
//
// Util buat update <title> & meta tags (description, Open Graph, Twitter Card) secara
// dinamis dari React, tanpa nambah dependency baru (gak pake react-helmet). Dipanggil dari
// App.jsx (default per-tab) dan Projects.jsx (override per-artikel pas dibuka, biar Share
// button ngasih preview yang sesuai artikelnya, bukan generic).
//
// CATATAN PENTING (biar gak salah ekspektasi): ini nge-update DOM di BROWSER doang
// (client-side, jalan setelah JS-nya React dieksekusi). Ini udah cukup buat:
//  - Judul tab browser & history/bookmark pengunjung
//  - Preview link di tool yang beneran ngerender JS pas fetch (sebagian ada)
// TAPI kebanyakan crawler share (WhatsApp, Facebook, Twitter/X, Telegram, iMessage) itu
// TIDAK menjalankan JavaScript pas generate preview link — mereka cuma baca HTML MENTAH
// dari index.html apa adanya, sebelum React sempat jalan sama sekali. Jadi kalau lo share
// link artikel ke WhatsApp, kemungkinan besar preview yang muncul MASIH pakai meta tag
// statis di index.html (kalau ada) — bukan yang di-set oleh fungsi ini.
//
// Supaya preview per-artikel beneran akurat di semua platform share, butuh salah satu:
//  1. Meta tag default yang solid & statis di index.html (baseline yang sama buat semua
//     link, mendingan daripada kosong/generic banget) — bisa dikerjain sekarang.
//  2. Prerendering / SSR per halaman (Netlify punya fitur prerendering buat bot user-agent
//     tertentu), atau Netlify Edge Function yang deteksi bot & serve HTML dengan meta tag
//     yang udah bener — ini yang bikin preview BENERAN per-artikel akurat di WhatsApp/FB/dst.
// Poin 2 butuh akses ke index.html / netlify.toml yang belum ada di sini — kalau mau
// dikerjain juga, tinggal kirim file-nya.

let canonicalSiteUrl = 'https://haikal-hafidz.github.io/';
let siteName = 'Haikal A. Hafidz — Content Writer & Editor';
let browserTitle = siteName;
let defaultShareTitle = '';
let defaultShareDescription = '';
let defaultSeoTitle = '';
let defaultSeoDescription = '';
let defaultShareImage = '';
let defaultDescription = '';
let allowIndexingState = true;

function getCachedSiteMeta() {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem('portfolio_live_session_cache_v1');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;
    const website = data.website || {};
    const home = data.home || {};
    const name = String(home.name || '').trim();
    const role = String(home.role || '').trim();
    if (name || role) {
      siteName = [name, role].filter(Boolean).join(' — ') || siteName;
    }
    defaultSeoTitle = String(website.seoTitle || '').trim();
    defaultSeoDescription = metaPlainText(website.seoDescription);

    if (defaultSeoTitle) {
      browserTitle = defaultSeoTitle;
    } else if (website.title) {
      browserTitle = String(website.title).trim();
    } else if (siteName) {
      browserTitle = siteName;
    }

    defaultDescription = defaultSeoDescription || metaPlainText(website.description);
    defaultShareTitle = String(website.shareTitle || '').trim() || browserTitle;
    defaultShareDescription = metaPlainText(website.shareDescription) || defaultDescription;

    if (website.shareImage) {
      defaultShareImage = String(website.shareImage).trim();
    }
    const effectiveCanonicalUrl = String(website.canonicalUrl || website.url || '').trim();
    if (effectiveCanonicalUrl) {
      canonicalSiteUrl = effectiveCanonicalUrl;
    }
    allowIndexingState = website.allowIndexing !== false;
  } catch {
    /* ignore session storage parse error */
  }
}
getCachedSiteMeta();

function metaPlainText(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/p\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}


export function setFavicon(faviconUrl) {
  if (!faviconUrl) return;
  let link = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = faviconUrl;
}

function upsertCanonical(href) {
  if (!href) return;
  let link = document.querySelector("link[rel='canonical']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = href;
}

function upsertRobots(allowIndexing) {
  let el = document.querySelector('meta[name="robots"]');
  const content = allowIndexing ? 'index, follow' : 'noindex, nofollow';
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function setSiteIdentity({ name, role, title, description, shareTitle, shareDescription, seoTitle, seoDescription, shareImage, url, canonicalUrl, favicon, allowIndexing } = {}) {
  const cleanName = String(name || '').trim();
  const cleanRole = String(role || '').trim();
  siteName = [cleanName, cleanRole].filter(Boolean).join(' — ') || siteName;

  defaultSeoTitle = String(seoTitle || '').trim();
  defaultSeoDescription = metaPlainText(seoDescription);

  browserTitle = defaultSeoTitle || String(title || '').trim() || siteName;
  defaultDescription = defaultSeoDescription || metaPlainText(description);

  defaultShareTitle = String(shareTitle || '').trim() || browserTitle;
  defaultShareDescription = metaPlainText(shareDescription) || defaultDescription;

  defaultShareImage = String(shareImage || '').trim();

  const effectiveCanonicalUrl = String(canonicalUrl || url || '').trim();
  if (effectiveCanonicalUrl) {
    canonicalSiteUrl = effectiveCanonicalUrl;
  }

  if (favicon) {
    setFavicon(favicon);
  }

  allowIndexingState = allowIndexing !== false;
  upsertCanonical(canonicalSiteUrl);
  upsertRobots(allowIndexingState);
}

function upsertMeta(attr, key, content) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Set judul tab browser + meta tags SEO/OG/Twitter buat halaman/artikel yang lagi aktif.
 * @param {Object} opts
 * @param {string} [opts.title] - Judul spesifik (halaman/artikel). Kosong = pakai SITE_NAME polos.
 * @param {string} [opts.description] - Deskripsi singkat (buat meta description & og:description).
 * @param {string} [opts.image] - URL gambar (buat og:image / twitter:image).
 * @param {string} [opts.url] - URL kanonis halaman ini (default: URL saat ini).
 */
export function setPageMeta({ title, description, image, url } = {}) {
  // Website Title dari CMS adalah judul tab final untuk seluruh halaman.
  // `title` tetap dipakai oleh metadata/description callers, tetapi tidak lagi
  // ditempelkan ke document.title saat pengunjung berpindah tab portfolio.
  const fullTitle = browserTitle;
  const resolvedImage = image || defaultShareImage;
  const resolvedDescription = metaPlainText(description || defaultDescription || '');
  document.title = fullTitle;

  upsertMeta('name', 'description', resolvedDescription);
  upsertMeta('property', 'og:site_name', browserTitle);
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', resolvedDescription);
  upsertMeta('property', 'og:image', resolvedImage);
  upsertMeta('property', 'og:url', url || canonicalSiteUrl);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('name', 'twitter:card', title && resolvedImage ? 'summary_large_image' : 'summary');
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', resolvedDescription);
  upsertMeta('name', 'twitter:image', resolvedImage);
}
