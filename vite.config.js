import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { initialPortfolioData } from './src/cms/CmsData.js'
import { resolveSocialMeta } from './src/lib/pageMeta.js'

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripTags(str = '') {
  return String(str || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/p\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function injectWorkMetadata(baseHtml, meta, siteCanonicalUrl) {
  let transformed = baseHtml;
  const safeTitle = escapeHtml(meta.shareTitle || meta.title);
  const safeDesc = escapeHtml(meta.description || '');
  const safeUrl = escapeHtml(meta.url || siteCanonicalUrl);
  const safeImage = escapeHtml(meta.image || '');

  transformed = transformed
    .replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${safeDesc}" />`)
    .replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${safeUrl}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${safeTitle}" />`)
    .replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${safeDesc}" />`)
    .replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${safeUrl}" />`)
    .replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${safeImage}" />`)
    .replace(/<meta property="og:type" content=".*?" \/>/i, `<meta property="og:type" content="${escapeHtml(meta.type || 'website')}" />`)
    .replace(/<meta name="twitter:card" content=".*?" \/>/i, `<meta name="twitter:card" content="${escapeHtml(meta.card || 'summary')}" />`)
    .replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${safeTitle}" />`)
    .replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${safeDesc}" />`)
    .replace(/<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${safeImage}" />`);

  return transformed;
}

function seoAndEnvPlugin() {
  let latestTransformedIndexHtml = '';
  let buildContextData = {
    website: { ...initialPortfolioData.website },
    home: { ...initialPortfolioData.home },
    projects: { ...initialPortfolioData.projects },
    books: { ...initialPortfolioData.books },
    cleanSupabaseUrl: '',
    canonicalUrl: 'https://haikal-hafidz.github.io/',
    shareImage: '',
    siteName: 'Haikal A. Hafidz — Content Writer & Editor',
  };

  return {
    name: 'vite-plugin-seo-and-env',
    async transformIndexHtml(html, ctx) {
      const mode = ctx?.mode || process.env.NODE_ENV || 'production';
      const env = loadEnv(mode, process.cwd(), '');
      const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

      let website = { ...initialPortfolioData.website };
      let home = { ...initialPortfolioData.home };
      let projects = { ...initialPortfolioData.projects };
      let books = { ...initialPortfolioData.books };

      if (supabaseUrl && supabaseAnonKey) {
        try {
          const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/portfolio?id=eq.1&select=data`, {
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
          });
          if (res.ok) {
            const rows = await res.json();
            if (rows?.[0]?.data) {
              const liveData = rows[0].data;
              if (liveData.website) website = { ...website, ...liveData.website };
              if (liveData.home) home = { ...home, ...liveData.home };
              if (liveData.projects) projects = { ...projects, ...liveData.projects };
              if (liveData.books) books = { ...books, ...liveData.books };
            }
          }
        } catch {
          // Fall back gracefully to initialPortfolioData
        }
      }

      const siteName = [home.name, home.role].filter(Boolean).join(' — ') || 'Haikal A. Hafidz — Content Writer & Editor';
      const title = (website.seoTitle || '').trim() || (website.title || '').trim() || siteName;
      const description = stripTags(website.seoDescription) || stripTags(website.description) || stripTags(home.bio) || '';
      const shareTitle = (website.shareTitle || '').trim() || title;
      const shareDescription = stripTags(website.shareDescription) || description;
      const canonicalUrl = website.canonicalUrl || website.url || 'https://haikal-hafidz.github.io/';
      const allowIndexing = website.allowIndexing !== false;
      const robots = allowIndexing ? 'index, follow' : 'noindex, nofollow';

      const cleanSupabaseUrl = supabaseUrl ? supabaseUrl.replace(/\/$/, '') : '';
      let shareImage = website.shareImage || (cleanSupabaseUrl ? `${cleanSupabaseUrl}/storage/v1/object/public/portofolio-images/website/share-preview.jpg` : '');
      let favicon = website.favicon || (cleanSupabaseUrl ? `${cleanSupabaseUrl}/storage/v1/object/public/portofolio-images/website/favicon.png` : '');

      let transformed = html.replace(/%VITE_SUPABASE_URL%/g, cleanSupabaseUrl);
      shareImage = shareImage.replace(/%VITE_SUPABASE_URL%/g, cleanSupabaseUrl);
      favicon = favicon.replace(/%VITE_SUPABASE_URL%/g, cleanSupabaseUrl);

      transformed = transformed
        .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
        .replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
        .replace(/<link rel="canonical" href=".*?" \/>/i, `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`)
        .replace(/<meta name="robots" content=".*?" \/>/i, `<meta name="robots" content="${escapeHtml(robots)}" />`)
        .replace(/<meta property="og:title" content=".*?" \/>/i, `<meta property="og:title" content="${escapeHtml(shareTitle)}" />`)
        .replace(/<meta property="og:description" content=".*?" \/>/i, `<meta property="og:description" content="${escapeHtml(shareDescription)}" />`)
        .replace(/<meta property="og:url" content=".*?" \/>/i, `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`)
        .replace(/<meta property="og:image" content=".*?" \/>/i, `<meta property="og:image" content="${escapeHtml(shareImage)}" />`)
        .replace(/<meta name="twitter:title" content=".*?" \/>/i, `<meta name="twitter:title" content="${escapeHtml(shareTitle)}" />`)
        .replace(/<meta name="twitter:description" content=".*?" \/>/i, `<meta name="twitter:description" content="${escapeHtml(shareDescription)}" />`)
        .replace(/<meta name="twitter:image" content=".*?" \/>/i, `<meta name="twitter:image" content="${escapeHtml(shareImage)}" />`);

      if (favicon) {
        transformed = transformed.replace(/<link rel="icon" type="image\/png" href=".*?" \/>/i, `<link rel="icon" type="image/png" href="${escapeHtml(favicon)}" />`);
      }

      latestTransformedIndexHtml = transformed;
      buildContextData = {
        website,
        home,
        projects,
        books,
        cleanSupabaseUrl,
        canonicalUrl,
        shareImage,
        siteName,
      };

      return transformed;
    },

    closeBundle() {
      // Build-time static generation for GitHub Pages:
      // Generate 404.html (for GitHub Pages SPA fallback & deep linking)
      // and pre-rendered HTML files for individual shareable works (articles, books, directing, custom sections).
      const outDir = path.resolve(process.cwd(), 'dist');
      if (!fs.existsSync(outDir) || !latestTransformedIndexHtml) return;

      const { canonicalUrl, shareImage, siteName, projects, books } = buildContextData;
      const baseSiteUrl = canonicalUrl.replace(/\/$/, '');

      // 1. Ensure 404.html exists for GitHub Pages direct navigation & refresh
      const fourZeroFourPath = path.join(outDir, '404.html');
      fs.writeFileSync(fourZeroFourPath, latestTransformedIndexHtml, 'utf8');

      // 2. Collect all shareable works
      const shareableWorks = [];

      // Articles
      const articles = Array.isArray(projects.articles) ? projects.articles : [];
      articles.forEach((art) => {
        if (!art || !art.id) return;
        const workUrl = `${baseSiteUrl}/?tab=Projects&category=articles&work=${encodeURIComponent(art.id)}&article=${encodeURIComponent(art.id)}`;
        const meta = resolveSocialMeta(art, {
          siteUrl: baseSiteUrl,
          defaultShareImage: shareImage,
          siteName,
          url: workUrl,
          type: 'article',
        });
        shareableWorks.push({
          id: art.id,
          category: 'articles',
          targetDir: path.join(outDir, 'projects', 'articles', art.id),
          meta,
        });
        // Also support clean /projects/work-id path
        shareableWorks.push({
          id: art.id,
          category: 'projects',
          targetDir: path.join(outDir, 'projects', art.id),
          meta,
        });
      });

      // Directing / Video Works
      const directingItems = Array.isArray(projects.directing?.items) ? projects.directing.items : [];
      directingItems.forEach((item) => {
        if (!item || !item.id) return;
        const workUrl = `${baseSiteUrl}/?tab=Projects&category=directing&work=${encodeURIComponent(item.id)}`;
        const meta = resolveSocialMeta(item, {
          siteUrl: baseSiteUrl,
          defaultShareImage: shareImage,
          siteName,
          url: workUrl,
          type: 'video',
        });
        shareableWorks.push({
          id: item.id,
          category: 'directing',
          targetDir: path.join(outDir, 'projects', 'directing', item.id),
          meta,
        });
        shareableWorks.push({
          id: item.id,
          category: 'projects',
          targetDir: path.join(outDir, 'projects', item.id),
          meta,
        });
      });

      // Poster Works
      const posterItems = Array.isArray(projects.poster?.items) ? projects.poster.items : [];
      posterItems.forEach((item) => {
        if (!item || !item.id) return;
        const workUrl = `${baseSiteUrl}/?tab=Projects&category=poster&work=${encodeURIComponent(item.id)}`;
        const meta = resolveSocialMeta(item, {
          siteUrl: baseSiteUrl,
          defaultShareImage: shareImage,
          siteName,
          url: workUrl,
          type: 'image',
        });
        shareableWorks.push({
          id: item.id,
          category: 'poster',
          targetDir: path.join(outDir, 'projects', 'poster', item.id),
          meta,
        });
        shareableWorks.push({
          id: item.id,
          category: 'projects',
          targetDir: path.join(outDir, 'projects', item.id),
          meta,
        });
      });

      // Custom Sections
      const customSections = Array.isArray(projects.customSections) ? projects.customSections : [];
      customSections.forEach((section) => {
        const secItems = Array.isArray(section.items) ? section.items : [];
        secItems.forEach((item) => {
          if (!item || !item.id) return;
          const workUrl = `${baseSiteUrl}/?tab=Projects&category=${encodeURIComponent(`custom:${section.id}`)}&work=${encodeURIComponent(item.id)}`;
          const meta = resolveSocialMeta(item, {
            siteUrl: baseSiteUrl,
            defaultShareImage: shareImage,
            siteName,
            url: workUrl,
            type: section.contentType || 'website',
          });
          shareableWorks.push({
            id: item.id,
            category: `custom-${section.id}`,
            targetDir: path.join(outDir, 'projects', item.id),
            meta,
          });
        });
      });

      // Books
      const bookItems = [
        ...(Array.isArray(books.items) ? books.items : []),
        ...(Array.isArray(books.readingItems) ? books.readingItems : []),
      ];
      bookItems.forEach((book) => {
        if (!book || !book.id) return;
        const workUrl = `${baseSiteUrl}/?tab=Book&work=${encodeURIComponent(book.id)}`;
        const meta = resolveSocialMeta(book, {
          siteUrl: baseSiteUrl,
          defaultShareImage: shareImage,
          siteName,
          url: workUrl,
          type: 'book',
        });
        shareableWorks.push({
          id: book.id,
          category: 'book',
          targetDir: path.join(outDir, 'books', book.id),
          meta,
        });
      });

      // 3. Write pre-rendered HTML for each work
      for (const work of shareableWorks) {
        try {
          fs.mkdirSync(work.targetDir, { recursive: true });
          const workHtml = injectWorkMetadata(latestTransformedIndexHtml, work.meta, canonicalUrl);
          fs.writeFileSync(path.join(work.targetDir, 'index.html'), workHtml, 'utf8');
        } catch (err) {
          console.warn(`Failed to generate static metadata page for ${work.id}:`, err);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoAndEnvPlugin()],
  // Root user site: https://haikal-hafidz.github.io/
  base: '/',
  build: {
    rolldownOptions: {
      output: {
        // Pisahkan library besar dan area aplikasi yang jarang berubah. Selain
        // menghilangkan chunk tunggal >500 kB, browser bisa menyimpan vendor,
        // data, halaman, dan CMS di cache secara terpisah.
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 50,
            },
            {
              name: 'supabase-vendor',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 40,
            },
            {
              name: 'document-vendor',
              test: /node_modules[\\/](mammoth|jszip|fflate|sax|xmlbuilder)[\\/]/,
              priority: 40,
            },
            {
              name: 'portfolio-data',
              test: /src[\\/]cms[\\/]CmsData\.js$/,
              priority: 30,
            },
            {
              name: (id) => {
                const match = id.match(/src[\\/]pages[\\/]([^\\/]+)\.jsx$/)
                return match ? `page-${match[1].toLowerCase()}` : null
              },
              test: /src[\\/]pages[\\/].+\.jsx$/,
              priority: 20,
            },
            {
              name: 'public-components',
              test: /src[\\/]components[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
