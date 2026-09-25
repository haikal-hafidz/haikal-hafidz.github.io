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

const SITE_URL = 'https://haikal-hafidz.github.io/';
let siteName = 'Haikal A. Hafidz — Content Writer & Editor';
let browserTitle = siteName;
let defaultShareImage = '';
let defaultDescription = '';

export function setSiteIdentity({ name, role, title, description, shareImage } = {}) {
  const cleanName = String(name || '').trim();
  const cleanRole = String(role || '').trim();
  siteName = [cleanName, cleanRole].filter(Boolean).join(' — ') || siteName;
  browserTitle = String(title || '').trim() || siteName;
  defaultDescription = String(description || '').trim();
  defaultShareImage = String(shareImage || '').trim();
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
  const resolvedDescription = String(description || defaultDescription || '').trim();
  document.title = fullTitle;

  upsertMeta('name', 'description', resolvedDescription);
  upsertMeta('property', 'og:site_name', browserTitle);
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', resolvedDescription);
  upsertMeta('property', 'og:image', resolvedImage);
  upsertMeta('property', 'og:url', url || SITE_URL);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('name', 'twitter:card', title && resolvedImage ? 'summary_large_image' : 'summary');
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', resolvedDescription);
  upsertMeta('name', 'twitter:image', resolvedImage);
}
