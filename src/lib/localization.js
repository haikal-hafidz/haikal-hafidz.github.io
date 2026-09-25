// src/lib/localization.js
// Native bilingual layer for portfolio content.
// Indonesian remains the source of truth. English lives in data.translations.en as
// a flat path -> string map, so the existing CMS/page data structure stays untouched.

const TECHNICAL_KEYS = new Set([
  'id', 'type', 'url', 'href', 'src', 'image', 'imageUrl', 'coverImage', 'posterImage',
  'thumbnail', 'fileUrl', 'mediaUrl', 'illustration', 'itemId', 'sectionId', 'categoryId',
  'target', 'tab', 'status', 'kind', 'layout', 'mediaType', 'coverPosition',
  'imagePosition', 'objectPosition', 'color', 'fontFamily'
]);

const looksLikeAsset = (value = '') =>
  /^(?:https?:\/\/|data:|blob:|\/|#)/i.test(String(value).trim()) ||
  /\.(?:png|jpe?g|webp|gif|svg|pdf|mp3|wav|mp4|webm)(?:\?|$)/i.test(String(value).trim());

const segmentForItem = (item, index) => {
  if (item && typeof item === 'object' && item.id != null && String(item.id).trim()) {
    return `@${encodeURIComponent(String(item.id).trim())}`;
  }
  return `#${index}`;
};

export function normalizeTranslations(raw) {
  const en = raw?.en && typeof raw.en === 'object' && !Array.isArray(raw.en) ? raw.en : {};
  return { en };
}

export function localizedPortfolioData(data, language = 'id') {
  if (!data || language !== 'en') return data;
  const map = normalizeTranslations(data.translations).en;

  const visit = (value, path = '') => {
    if (typeof value === 'string') {
      const translated = map[path];
      return typeof translated === 'string' && translated.trim() ? translated : value;
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => visit(item, path ? `${path}.${segmentForItem(item, index)}` : segmentForItem(item, index)));
    }
    if (value && typeof value === 'object') {
      const result = {};
      for (const [key, child] of Object.entries(value)) {
        if (key === 'translations') {
          result[key] = child;
          continue;
        }
        const nextPath = path ? `${path}.${key}` : key;
        result[key] = visit(child, nextPath);
      }
      return result;
    }
    return value;
  };

  return visit(data);
}

export function collectTranslatableStrings(value, rootPath = '', allowedPaths = null) {
  const rows = [];
  const allowlist = Array.isArray(allowedPaths) && allowedPaths.length ? allowedPaths : null;
  const pathAllowed = (path) => {
    if (!allowlist) return true;
    return allowlist.some((allowed) =>
      path === allowed ||
      path.startsWith(`${allowed}.`) ||
      allowed.startsWith(`${path}.`)
    );
  };

  const visit = (current, path, keyName = '') => {
    if (path && !pathAllowed(path)) return;
    if (typeof current === 'string') {
      if (!current.trim() || TECHNICAL_KEYS.has(keyName) || looksLikeAsset(current)) return;
      rows.push({ path, source: current, keyName });
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        const segment = segmentForItem(item, index);
        visit(item, path ? `${path}.${segment}` : segment, '');
      });
      return;
    }
    if (current && typeof current === 'object') {
      Object.entries(current).forEach(([key, child]) => {
        if (key === 'translations' || TECHNICAL_KEYS.has(key)) return;
        visit(child, path ? `${path}.${key}` : key, key);
      });
    }
  };

  visit(value, rootPath);
  return rows;
}

export function translationValue(translations, path) {
  const value = normalizeTranslations(translations).en[path];
  return typeof value === 'string' ? value : '';
}

export function withEnglishTranslation(translations, path, value) {
  const normalized = normalizeTranslations(translations);
  const en = { ...normalized.en };
  const next = String(value ?? '');
  if (next.trim()) en[path] = next;
  else delete en[path];
  return { ...normalized, en };
}
