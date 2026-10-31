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
    const raw = sessionStorage.getItem('portfolio_live_session_cache_v1') || localStorage.getItem('portfolio_live_session_cache_v1');
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
 * Resolves social sharing metadata following the strict priority rules:
 * 1. Explicit social sharing image (socialImage / shareImage)
 * 2. Assigned thumbnail / cover image (coverImage / thumbnail)
 * 3. Relevant content image (posterImage / imageUrl / image / mediaUrl / first gallery item)
 * 4. Website default social sharing image
 */
export function resolveSocialMeta(item = {}, options = {}) {
  const globalSiteUrl = options.siteUrl || canonicalSiteUrl;
  const globalDefaultShareImage = options.defaultShareImage || defaultShareImage;
  const globalSiteName = options.siteName || siteName;

  const rawTitle = item.title || item.name || options.title || '';
  const title = String(rawTitle).trim();
  const shareTitle = String(item.shareTitle || title || options.shareTitle || globalSiteName).trim();

  const rawDescription =
    item.shareDescription ||
    item.seoDescription ||
    item.description ||
    item.snippet ||
    item.premise ||
    item.summary ||
    item.bio ||
    options.description ||
    defaultDescription ||
    '';
  const description = metaPlainText(rawDescription);

  // 1. Explicit social sharing image
  let resolvedImage = item.socialImage || item.shareImage || options.socialImage || options.shareImage || '';

  // 2. Assigned thumbnail / cover image
  if (!resolvedImage) {
    resolvedImage = item.coverImage || item.thumbnail || options.coverImage || '';
  }

  // 3. Content image / media image
  if (!resolvedImage) {
    resolvedImage = item.posterImage || item.imageUrl || item.image || '';
    if (!resolvedImage && Array.isArray(item.gallery) && item.gallery[0]) {
      resolvedImage = typeof item.gallery[0] === 'string' ? item.gallery[0] : item.gallery[0]?.url || item.gallery[0]?.imageUrl || '';
    }
    if (!resolvedImage && Array.isArray(item.items) && item.items[0]) {
      resolvedImage = typeof item.items[0] === 'string' ? item.items[0] : item.items[0]?.url || item.items[0]?.imageUrl || '';
    }
    if (!resolvedImage) {
      const mediaUrl = String(item.mediaUrl || item.url || '').trim();
      const youtubeMatch = mediaUrl.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&#/]+)/i);
      if (youtubeMatch?.[1]) {
        resolvedImage = `https://i.ytimg.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;
      }
    }
  }

  // 4. Default website share image fallback
  if (!resolvedImage) {
    resolvedImage = globalDefaultShareImage;
  }

  // Ensure absolute URL if relative path provided
  if (resolvedImage && !resolvedImage.startsWith('http://') && !resolvedImage.startsWith('https://')) {
    const base = globalSiteUrl.replace(/\/$/, '');
    const path = resolvedImage.startsWith('/') ? resolvedImage : `/${resolvedImage}`;
    resolvedImage = `${base}${path}`;
  }

  const canonicalUrl = options.url || item.canonicalUrl || item.url || globalSiteUrl;
  const contentType = item.contentType || options.type || (title ? 'article' : 'website');
  const twitterCard = resolvedImage ? 'summary_large_image' : 'summary';

  return {
    title,
    shareTitle: title && title !== globalSiteName ? `${title} — ${globalSiteName}` : (shareTitle || globalSiteName),
    description,
    image: resolvedImage,
    url: canonicalUrl,
    type: contentType === 'writing' || contentType === 'article' || contentType === 'book' ? 'article' : 'website',
    card: twitterCard,
    siteName: globalSiteName,
  };
}

/**
 * Set judul tab browser + meta tags SEO/OG/Twitter buat halaman/artikel yang lagi aktif.
 * @param {Object} opts
 * @param {string} [opts.title] - Judul spesifik (halaman/artikel). Kosong = pakai browserTitle.
 * @param {string} [opts.description] - Deskripsi singkat (buat meta description & og:description).
 * @param {string} [opts.image] - URL gambar (buat og:image / twitter:image).
 * @param {string} [opts.url] - URL kanonis halaman ini (default: URL saat ini).
 * @param {Object} [opts.item] - Optional content item to resolve via resolveSocialMeta.
 */
export function setPageMeta(opts = {}) {
  const { title, description, image, url, item } = opts;
  const resolved = item ? resolveSocialMeta(item, opts) : null;

  const targetTitle = resolved ? resolved.shareTitle : (title ? `${title} — ${siteName}` : browserTitle);
  const resolvedImage = resolved ? resolved.image : (image || defaultShareImage);
  const resolvedDescription = resolved ? resolved.description : metaPlainText(description || defaultDescription || '');
  const resolvedUrl = resolved ? resolved.url : (url || canonicalSiteUrl);
  const resolvedType = resolved ? resolved.type : 'website';
  const resolvedCard = resolved ? resolved.card : (resolvedImage ? 'summary_large_image' : 'summary');

  // Website Title tetap menjadi title tab browser utama untuk portfolio
  document.title = browserTitle;

  upsertMeta('name', 'description', resolvedDescription);
  upsertMeta('property', 'og:site_name', browserTitle);
  upsertMeta('property', 'og:title', targetTitle);
  upsertMeta('property', 'og:description', resolvedDescription);
  upsertMeta('property', 'og:image', resolvedImage);
  upsertMeta('property', 'og:url', resolvedUrl);
  upsertMeta('property', 'og:type', resolvedType);
  upsertMeta('name', 'twitter:card', resolvedCard);
  upsertMeta('name', 'twitter:title', targetTitle);
  upsertMeta('name', 'twitter:description', resolvedDescription);
  upsertMeta('name', 'twitter:image', resolvedImage);
}
