import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { initialPortfolioData } from './src/cms/CmsData.js'

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

function seoAndEnvPlugin() {
  return {
    name: 'vite-plugin-seo-and-env',
    async transformIndexHtml(html, ctx) {
      const mode = ctx?.mode || process.env.NODE_ENV || 'production';
      const env = loadEnv(mode, process.cwd(), '');
      const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

      let website = { ...initialPortfolioData.website };
      let home = { ...initialPortfolioData.home };

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
            }
          }
        } catch {
          // Fall back gracefully to initialPortfolioData
        }
      }

      const siteName = [home.name, home.role].filter(Boolean).join(' — ') || 'Haikal A. Hafidz — Content Writer & Editor';
      const title = website.seoTitle || website.title || siteName;
      const description = stripTags(website.seoDescription || website.description || home.bio || '');
      const shareTitle = website.shareTitle || title;
      const shareDescription = stripTags(website.shareDescription || description);
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

      return transformed;
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
