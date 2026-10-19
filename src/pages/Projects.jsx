import { useState, useEffect, useMemo, useRef } from 'react';
import { setPageMeta } from '../lib/pageMeta';
import InteractiveText from '../components/InteractiveText';
import RichContent from '../components/RichContent';

// TEMPLATE BAKU buat semua bentuk tulisan panjang di halaman Projects (artikel biasa,
// tulisan panjang dari Word di Tab Tambahan, dan APAPUN jenis konten tulisan yang
// nanti ditambah lagi ke halaman ini). SATU sumber kebenaran, dipakai bareng-bareng —
// jangan bikin className justify/rata manual sendiri-sendiri per section, tinggal
// pasang constant ini biar otomatis seragam & gak perlu inget-inget lagi kalau nambah
// bentuk baru. Isinya: ukuran font & warna teks badan tulisan, line-height nyaman baca,
// rata kiri-kanan (justify) buat paragraf (termasuk paragraf hasil dangerouslySetInnerHTML
// dari editor CMS / convert Word), plus styling dasar buat heading/list/link di dalamnya.
const PROJECT_DETAIL_TITLE_CLASS = 'font-serif text-[1.5em] sm:text-[1.875em] font-extrabold leading-snug tracking-normal normal-case text-left text-gray-900 dark:text-white';
const ARTICLE_TEXT_CLASS =
  'text-[0.875em] sm:text-[1em] text-gray-700 dark:text-gray-300 leading-relaxed [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_h1]:my-5 [&_h1]:text-[1.5em] [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:text-gray-900 dark:[&_h1]:text-white [&_h2]:my-4 [&_h2]:text-[1.25em] [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:text-gray-900 dark:[&_h2]:text-white [&_h3]:my-3 [&_h3]:font-bold [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[#2B579A] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_a]:text-[#2B579A] dark:[&_a]:text-[#6FA8DC] [&_a]:underline [&_a]:font-medium';

// TEMPLATE BAKU buat lebar & posisi kontainer tulisan panjang — biar semua konten
// tulisan di halaman Projects ke-center kayak halaman A4 (gak nempel ke kiri), bukan cuma
// artikel biasa doang. Dipakai bareng ARTICLE_TEXT_CLASS di atas.
const ARTICLE_CONTAINER_CLASS = 'max-w-2xl mx-auto';

// Supabase bisa mengirim versi thumbnail tanpa mengunduh gambar asli yang besar.
// URL selain Supabase dibiarkan apa adanya supaya tetap kompatibel.
function projectThumbnail(url, width = 720) {
  if (!url || !url.includes('/storage/v1/object/public/')) return url;
  const resized = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const separator = resized.includes('?') ? '&' : '?';
  return `${resized}${separator}width=${width}&quality=72&resize=cover`;
}

// Satu pintu untuk seluruh cover Projects. Data lama dan data dari beberapa
// editor CMS pernah menyimpan cover dengan nama field yang berbeda.
function getProjectCover(item = {}) {
  const explicitCover = item.posterImage || item.imageUrl || item.image || item.coverImage || item.thumbnail || '';
  if (explicitCover) return explicitCover;

  const mediaUrl = String(item.mediaUrl || item.url || '').trim();
  const youtubeMatch = mediaUrl.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&#/]+)/i);
  if (youtubeMatch?.[1]) return `https://i.ytimg.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;

  return '';
}

// Admin boleh menentukan titik fokus lewat coverPosition/imagePosition
// (contoh: "center 25%"). Tanpa nilai khusus, fokus sedikit dinaikkan supaya
// wajah, judul poster, dan landmark tidak mudah terpotong.
function getCoverPosition(item = {}) {
  return item.coverPosition || item.imagePosition || item.objectPosition || 'center center';
}

function richTextToPlainText(value = '') {
  const html = String(value || '');
  if (!html) return '';
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
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
  const node = document.createElement('div');
  node.innerHTML = html;
  return (node.textContent || node.innerText || '').replace(/\s+/g, ' ').trim();
}

// TEMPLATE BAKU buat tampilan MENU/listing gaya portal berita (kartu unggulan besar +
// daftar kecil di sampingnya) — dipakai bareng oleh tab Articles bawaan DAN tab tambahan
// mana pun yang di-set admin ke layout "Tulisan (seperti Articles)" lewat CMS. SATU
// komponen render, dipakai di kedua tempat — biar "seragam tanpa terkecuali" itu
// struktural (ganti tampilannya di sini, otomatis kebawa ke semua tab yang makai), bukan
// hasil disalin-tempel manual yang gampang nyimpang seiring waktu.
// `getImage`/`getSnippet`/`getMeta` nyesuaiin field yang beda antara data artikel biasa
// (`image`/`snippet`/`date`+`author`) sama item tab tambahan (`imageUrl`/`description`,
// belum ada field tanggal/penulis) — kalau getter-nya balikin falsy, bagian itu simply
// gak dirender (sama kayak perilaku field opsional di tempat lain di file ini).
function ThreeColumnIndexListing({
  items,
  onOpen,
  hintPrefix,
  getMeta = (item) => item.date || item.year || item.created_at || item.publishedDate || item.published_at || (item.year ? String(item.year) : '2026'),
  getGenre = (item) => item.category || item.genre || item.type || 'General',
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="w-full space-y-1 py-2">
      {items.map((item) => {
        const title = item.title || item.name || 'Untitled';
        const genre = getGenre(item) || '';
        const date = getMeta(item) || '';

        return (
          <article
            key={item.id || title}
            onClick={() => onOpen(item)}
            {...(item.hintEnabled !== false ? { 'data-hint-id': `${hintPrefix}-${item.id || title}` } : {})}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(item);
              }
            }}
            className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-2.5 sm:gap-4 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC]"
          >
            <div className="min-w-0 pr-2">
              <h2 className="text-[0.9375em] sm:text-[1.0em] font-normal text-gray-900 dark:text-gray-100 transition group-hover:text-[#2B579A] dark:group-hover:text-[#6FA8DC] truncate">
                {title}
              </h2>
            </div>

            <div className="text-right">
              <span className="text-[0.8125em] text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                {genre}
              </span>
            </div>

            <div className="text-right min-w-[4rem] sm:min-w-[5.5rem]">
              <span className="text-[0.8125em] text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">
                {date}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ArticleStyleListing(props) {
  return <ThreeColumnIndexListing {...props} />;
}

function ProjectPager({ page, totalPages, onPageChange }) {
  if (!totalPages) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-3 border-t border-gray-200 pt-5 dark:border-gray-700" aria-label="Navigasi halaman karya">
      <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="min-h-9 min-w-9 rounded-md px-2 font-mono text-[0.75em] font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-default disabled:opacity-30 dark:text-gray-300 dark:hover:bg-[#2d2d2d]" aria-label="Halaman sebelumnya">←</button>
      <span className="font-mono text-[0.75em] font-bold text-gray-700 dark:text-gray-200">{page}</span>
      <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="min-h-9 min-w-9 rounded-md px-2 font-mono text-[0.75em] font-bold text-gray-600 transition hover:bg-gray-100 disabled:cursor-default disabled:opacity-30 dark:text-gray-300 dark:hover:bg-[#2d2d2d]" aria-label="Halaman berikutnya">→</button>
    </nav>
  );
}

function getMediaEmbed(mediaType, rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) return null;
  if (mediaType === 'video') return { kind: 'video', src: url };
  if (mediaType === 'external') return { kind: 'external', src: url };

  if (mediaType === 'youtube') {
    const match = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&#/]+)/i);
    return match ? { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${match[1]}` } : null;
  }
  if (mediaType === 'vimeo') {
    const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    return match ? { kind: 'iframe', src: `https://player.vimeo.com/video/${match[1]}` } : null;
  }
  if (mediaType === 'drive') {
    const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    return match ? { kind: 'iframe', src: `https://drive.google.com/file/d/${match[1]}/preview` } : null;
  }
  return null;
}


function hasStudioPresentation(item = {}) {
  return item?.cmsPresentation?.mode === 'studio';
}

// One source-of-truth helper for custom writing families.
// Studio mode must read Universal Blocks first; Legacy keeps the historical
// Word/content fields. This prevents CMS edits from saving successfully while
// the public Scriptwriting view keeps rendering stale legacy content.
function getCmsWritingBlocksHtml(item = {}) {
  if (!Array.isArray(item.cmsBlocks)) return '';
  return item.cmsBlocks
    .filter((block) => block?.type === 'text' || block?.type === 'word')
    .map((block) => block?.text || block?.html || block?.content || '')
    .filter(Boolean)
    .join('');
}

function getCustomWritingHtml(item = {}) {
  const blocksHtml = getCmsWritingBlocksHtml(item);
  // Custom writing families (Scriptwriting/Short Story) expose Universal Blocks as
  // their CMS writing toolbox. If those blocks contain writing, they are the newest
  // authored content and must win regardless of the presentation skin. Legacy
  // fields remain a non-destructive fallback for older entries that have no blocks.
  return blocksHtml || item.wordContent || item.content || '';
}

function ProjectStudioRenderer({ item = {}, type = 'project' }) {
  const [drivePlayerLoaded, setDrivePlayerLoaded] = useState(false);
  const blocks = Array.isArray(item.cmsBlocks) ? item.cmsBlocks.filter(Boolean) : [];
  const presentation = {
    recipe: item.cmsPresentation?.recipe || 'default',
    layout: item.cmsPresentation?.layout || 'default',
    coverStyle: item.cmsPresentation?.coverStyle || 'split',
    contentWidth: item.cmsPresentation?.contentWidth || 'normal',
    alignment: item.cmsPresentation?.alignment || 'left',
  };

  const cover = getProjectCover(item);
  const widthClass =
    presentation.contentWidth === 'narrow' ? 'max-w-2xl' :
    presentation.contentWidth === 'wide' ? 'max-w-6xl' : 'max-w-4xl';
  const alignClass = presentation.alignment === 'center' ? 'text-center' : 'text-left';

  // Phase 4 final design families.
  // IMPORTANT: these are visual treatments for the Layout + Design Recipe that ALREADY
  // exist in CMS. No new CMS field/category/content type is introduced here.
  const recipeId = presentation.recipe || 'default';
  const isPosterRecipe = recipeId === 'poster-piece';
  const isEditorial = presentation.layout === 'editorial';
  const isVisual = presentation.layout === 'visual' || isPosterRecipe;
  const isCaseStudy = presentation.layout === 'case-study';
  const isMedia = presentation.layout === 'media';
  const isMinimal = presentation.layout === 'minimal';

  // Recipe semantics sit ON TOP of the existing layout engine.
  // This keeps one Presentation Studio while allowing future portfolio formats
  // to auto-format differently without tying presentation to a tab name.
  const isEditorialStoryRecipe = recipeId === 'editorial-story';
  const isLongReadRecipe = recipeId === 'long-read';
  const isContentEditorialRecipe = isEditorialStoryRecipe || isLongReadRecipe;
  const isLiteraryRecipe = recipeId === 'literary';
  const isScreenplayRecipe = recipeId === 'screenplay';
  const isTechnicalRecipe = recipeId === 'technical-documentation';
  const isUxWritingRecipe = recipeId === 'ux-writing-case-study';
  const isCopywritingRecipe = recipeId === 'copywriting-campaign';
  const isSeoRecipe = recipeId === 'seo-content-case-study';
  const isStrategyRecipe = recipeId === 'content-strategy';
  const isEditingRecipe = recipeId === 'editing-case-study';
  const isAudioRecipe = recipeId === 'audio-piece';

  const layoutClass =
    isScreenplayRecipe
      ? 'font-mono tracking-[0.005em]'
      : isTechnicalRecipe
        ? 'tracking-[0.002em]'
        : (isContentEditorialRecipe || isLiteraryRecipe || isEditorial)
          ? 'font-serif'
          : isMinimal
            ? 'tracking-[0.005em]'
            : '';

  const renderBlock = (block, index) => {
    const display = block.display || {};
    const key = block.id || `${block.type || 'block'}-${index}`;
    const textWidth =
      display.width === 'narrow' ? 'max-w-2xl' :
      display.width === 'wide' ? 'max-w-5xl' :
      isScreenplayRecipe ? 'max-w-[42rem]' :
      isTechnicalRecipe ? 'max-w-4xl' :
      isCopywritingRecipe ? 'max-w-5xl' :
      (isUxWritingRecipe || isSeoRecipe || isEditingRecipe || isStrategyRecipe) ? 'max-w-4xl' :
      isCaseStudy ? 'max-w-4xl' :
      isContentEditorialRecipe ? 'max-w-[44rem]' :
      (isLiteraryRecipe || isEditorial) ? 'max-w-2xl' : 'max-w-3xl';

    if (block.type === 'text' || block.type === 'word') {
      const style =
        display.style === 'intro'
          ? `${isEditorial ? 'text-[1.08em] sm:text-[1.18em]' : 'text-[1.05em] sm:text-[1.15em]'} leading-relaxed`
          : display.style === 'quote'
            ? 'border-l-4 border-[#2B579A] pl-5 italic text-[1.05em]'
            : display.style === 'callout'
              ? 'rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-[#242424]'
              : '';
      return (
        <div
          key={key}
          className={`${textWidth} ${ARTICLE_TEXT_CLASS} ${style} mx-auto min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all ${
            isCopywritingRecipe
              ? '[&_h2]:text-[1.65em] [&_h2]:leading-tight [&_h2]:tracking-[-0.025em] [&_h3]:text-[1.18em] [&_h3]:leading-snug [&_h3]:tracking-[-0.015em] [&_blockquote]:text-[1.35em] [&_blockquote]:leading-snug'
              : isContentEditorialRecipe
                ? '[&_p]:leading-[1.85] [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-[1.55em] [&_h2]:leading-tight [&_h2]:tracking-[-0.02em] [&_h3]:mt-7 [&_h3]:mb-3 [&_h3]:text-[1.08em] [&_h3]:font-bold [&_blockquote]:my-8 [&_blockquote]:border-y [&_blockquote]:border-gray-200 [&_blockquote]:py-6 [&_blockquote]:text-[1.35em] [&_blockquote]:leading-relaxed [&_blockquote]:not-italic dark:[&_blockquote]:border-gray-700'
                : ''
          }`}
          dangerouslySetInnerHTML={{ __html: block.text || '' }}
        />
      );
    }

    if (block.type === 'image' && block.url) {
      const requestedSize = display.size || 'auto';
      const requestedAlign = display.align || 'auto';
      const autoSize =
        isCopywritingRecipe ? 'wide' :
        isContentEditorialRecipe ? 'normal' :
        isUxWritingRecipe ? 'normal' :
        isSeoRecipe ? 'normal' :
        isTechnicalRecipe ? 'contained' :
        isStrategyRecipe ? 'wide' :
        isEditingRecipe ? 'normal' :
        isVisual ? 'wide' : 'normal';
      const resolvedSize = requestedSize === 'auto' ? autoSize : requestedSize;
      const resolvedAlign = requestedAlign === 'auto' ? 'center' : requestedAlign;
      const size =
        resolvedSize === 'full' ? 'w-full' :
        resolvedSize === 'wide' ? 'mx-auto w-full max-w-6xl' :
        resolvedSize === 'contained' ? 'mx-auto w-full max-w-2xl' :
        resolvedSize === 'left' ? 'mr-auto w-full max-w-xl' :
        resolvedSize === 'right' ? 'ml-auto w-full max-w-xl' :
        isCopywritingRecipe ? 'mx-auto w-full max-w-5xl' :
        isContentEditorialRecipe ? 'mx-auto w-full max-w-4xl' :
        isSeoRecipe ? 'mx-auto w-full max-w-5xl' :
        'mx-auto w-full max-w-3xl';
      const objectAlign =
        resolvedSize === 'left' || resolvedAlign === 'left' ? 'mr-auto' :
        resolvedSize === 'right' || resolvedAlign === 'right' ? 'ml-auto' : 'mx-auto';
      const frameClass =
        isTechnicalRecipe ? 'rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-[#202020]' :
        isUxWritingRecipe ? 'rounded-xl border border-gray-200 bg-gray-50 p-2 shadow-sm dark:border-gray-700 dark:bg-[#202020]' :
        isSeoRecipe ? 'rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-[#202020]' :
        isContentEditorialRecipe ? 'rounded-md' :
        isCopywritingRecipe ? 'rounded-2xl shadow-sm' :
        'rounded-md';
      return (
        <figure key={key} className={`${size} ${objectAlign}`}>
          <img
            src={block.url}
            alt={block.caption || item.title || ''}
            loading="lazy"
            decoding="async"
            className={`h-auto w-full object-contain ${frameClass} ${isCopywritingRecipe || isVisual ? 'max-h-[86vh]' : ''}`}
          />
          {block.caption && (
            <figcaption className={`${resolvedAlign === 'left' ? 'text-left' : resolvedAlign === 'right' ? 'text-right' : 'text-center'} mt-2 font-mono text-[0.6875em] leading-relaxed text-gray-400`}>
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    if (block.type === 'gallery' && Array.isArray(block.items) && block.items.length) {
      const requestedLayout = display.layout || 'auto';
      const autoLayout =
        isCopywritingRecipe ? (block.items.length === 2 ? 'duo' : 'grid') :
        isContentEditorialRecipe ? (block.items.length > 2 ? 'filmstrip' : 'duo') :
        isUxWritingRecipe ? (block.items.length === 2 ? 'duo' : 'grid') :
        isTechnicalRecipe ? 'grid' :
        isSeoRecipe ? 'grid' :
        isVisual ? 'filmstrip' : 'grid';
      const resolvedLayout = requestedLayout === 'auto' ? autoLayout : requestedLayout;
      const autoColumns = resolvedLayout === 'duo' ? 2 : (isCopywritingRecipe ? 3 : isVisual ? 4 : 3);
      const columns = Math.min(4, Math.max(2, Number(display.columns) || autoColumns));
      const gridCols =
        resolvedLayout === 'duo' || columns === 2 ? 'sm:grid-cols-2' :
        columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' :
        'sm:grid-cols-2 lg:grid-cols-3';

      if (resolvedLayout === 'filmstrip' || resolvedLayout === 'carousel') {
        return (
          <figure key={key} className={(isVisual || isCopywritingRecipe || isStrategyRecipe) ? 'mx-auto w-full max-w-6xl' : 'mx-auto w-full max-w-4xl'}>
            <div className="flex snap-x gap-3 overflow-x-auto pb-2">
              {block.items.map((url, i) => (
                <img
                  key={`${key}-${i}`}
                  src={url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={`${isVisual ? 'h-64 sm:h-80' : 'h-56 sm:h-72'} w-auto max-w-[85vw] shrink-0 snap-center rounded-md object-cover`}
                />
              ))}
            </div>
            {block.caption && (
              <figcaption className="mt-2 text-center font-mono text-[0.6875em] text-gray-400">
                {block.caption}
              </figcaption>
            )}
          </figure>
        );
      }

      return (
        <figure key={key} className={(isVisual || isCopywritingRecipe || isStrategyRecipe) ? 'mx-auto w-full max-w-6xl' : 'mx-auto w-full max-w-4xl'}>
          <div className={`grid grid-cols-1 ${gridCols} gap-3`}>
            {block.items.map((url, i) => (
              <img
                key={`${key}-${i}`}
                src={url}
                alt=""
                loading="lazy"
                decoding="async"
                className={`h-full w-full rounded-md ${
                  (isVisual || isCopywritingRecipe)
                    ? 'max-h-[38rem] object-contain bg-gray-50 dark:bg-[#202020]'
                    : 'max-h-[32rem] object-cover'
                }`}
              />
            ))}
          </div>
          {block.caption && (
            <figcaption className="mt-2 text-center font-mono text-[0.6875em] text-gray-400">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    if (block.type === 'audio' && block.url) {
      const shell =
        display.style === 'hero' || isMedia
          ? 'mx-auto w-full max-w-4xl rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-7 dark:border-gray-700 dark:bg-[#242424]'
          : display.style === 'compact'
            ? 'mx-auto max-w-xl'
            : 'mx-auto max-w-3xl';
      return (
        <div key={key} className={shell}>
          {block.label && (
            <p className="mb-3 font-mono text-[0.6875em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#6FA8DC]">
              {block.label}
            </p>
          )}
          <audio src={block.url} controls preload="metadata" className="w-full" />
          {block.caption && <p className="mt-3 text-[0.75em] leading-relaxed text-gray-500 dark:text-gray-400">{block.caption}</p>}
        </div>
      );
    }

    if (block.type === 'video' && block.url) {
      const media =
        getMediaEmbed(block.mediaType || 'youtube', block.url) ||
        getMediaEmbed('youtube', block.url) ||
        getMediaEmbed('vimeo', block.url) ||
        getMediaEmbed('drive', block.url) ||
        { kind: 'video', src: block.url };
      const shell =
        display.style === 'cinema' || isMedia
          ? 'mx-auto w-full max-w-6xl bg-black p-2 sm:p-4'
          : display.style === 'wide'
            ? 'mx-auto max-w-6xl'
            : 'mx-auto max-w-4xl';
      return (
        <figure key={key} className={shell}>
          <div className="aspect-video overflow-hidden rounded-md bg-black">
            {media.kind === 'iframe' ? (
              <iframe
                src={media.src}
                title={block.caption || item.title || 'Video'}
                className="h-full w-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video src={media.src} controls playsInline preload="metadata" className="h-full w-full" />
            )}
          </div>
          {block.caption && (
            <figcaption className={`${isMedia ? 'text-gray-300' : 'text-gray-400'} mt-2 text-center font-mono text-[0.6875em]`}>
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }

    if ((block.type === 'link' || block.type === 'file') && block.url) {
      return (
        <div key={key} className="text-center">
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded bg-[#2B579A] px-4 py-2 text-[0.75em] font-bold text-white hover:bg-[#234a84]"
          >
            {block.label || (block.type === 'file' ? 'Buka File' : 'Buka Tautan')} <span>↗</span>
          </a>
        </div>
      );
    }

    if (block.type === 'embed' && block.text) {
      const raw = String(block.text).trim();
      if (/^https?:\/\//i.test(raw)) {
        return (
          <div key={key} className="mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
            <iframe src={raw} title={block.label || item.title || 'Embed'} className="h-full w-full" loading="lazy" />
          </div>
        );
      }
      return (
        <pre key={key} className="mx-auto max-w-4xl overflow-x-auto rounded-md bg-gray-100 p-4 text-[0.75em] dark:bg-[#242424]">
          <code>{raw}</code>
        </pre>
      );
    }

    if (block.type === 'divider') {
      return <hr key={key} className="mx-auto w-full max-w-5xl border-gray-200 dark:border-gray-700" />;
    }

    return null;
  };

  const primaryMedia = type === 'Directing' && item.mediaUrl
    ? getMediaEmbed(item.mediaType || 'youtube', item.mediaUrl)
    : null;

  const primaryMediaNode = primaryMedia ? (
    <figure className={isMedia ? 'mx-auto w-full max-w-6xl' : 'mx-auto w-full max-w-4xl'}>
      {primaryMedia.kind === 'iframe' ? (
        <div className="aspect-video overflow-hidden rounded-md bg-black shadow-sm">
          <iframe
            src={primaryMedia.src}
            title={item.title || 'Directing video'}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : primaryMedia.kind === 'video' ? (
        <video
          src={primaryMedia.src}
          poster={item.posterImage || undefined}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-md bg-black object-contain shadow-sm"
        />
      ) : (
        <a
          href={primaryMedia.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded bg-[#2B579A] px-4 py-2 text-[0.75em] font-bold text-white"
        >
          Buka media ↗
        </a>
      )}
    </figure>
  ) : null;

  const directingStudioHero = type === 'Directing' ? (() => {
    const media = item.mediaUrl ? getMediaEmbed(item.mediaType || 'youtube', item.mediaUrl) : null;
    const ratio = item.videoRatio || 'auto';
    const ratioClass =
      ratio === '9:16' ? 'aspect-[9/16] max-h-[68vh] max-w-[18rem] mx-auto' :
      ratio === '4:3' ? 'aspect-[4/3]' :
      ratio === '1:1' ? 'aspect-square' :
      'aspect-video';
    const meta = [
      ['TYPE', item.type || item.category || 'Film / Video'],
      ['ROLE', item.role],
      ['YEAR', item.year],
      ['DURATION', item.runtime],
      ['TOOLS', item.tools],
    ].filter(([, value]) => value);
    const snippets = Array.isArray(item.videoSnippets)
      ? item.videoSnippets.filter((frame) => frame?.imageUrl)
      : [];

    return (
      <div className="mx-auto w-full max-w-[54rem]">
        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] md:justify-center md:gap-8">
          <div className="min-w-0 md:max-w-[25rem]">
            <div className={`${ratioClass} w-full overflow-hidden rounded-md border border-gray-200 bg-black dark:border-gray-700`}>
              {media?.kind === 'iframe' && (
                item.mediaType === 'drive' && !drivePlayerLoaded ? (
                  <button
                    type="button"
                    onClick={() => setDrivePlayerLoaded(true)}
                    className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
                    aria-label={`Play ${item.title || 'Directing video'}`}
                  >
                    {cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-contain opacity-80" />}
                    <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-black/50 text-lg text-white">▶</span>
                  </button>
                ) : (
                  <iframe
                    src={media.src}
                    title={item.title || 'Directing video'}
                    className="block h-full w-full border-0"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                )
              )}
              {media?.kind === 'video' && (
                <video
                  src={media.src}
                  poster={cover || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-contain"
                />
              )}
              {(!media || media.kind === 'external') && (
                cover
                  ? <img src={cover} alt={item.title || ''} className="h-full w-full object-contain" style={{ objectPosition: getCoverPosition(item) }} />
                  : <div className="flex h-full items-center justify-center font-mono text-xs text-gray-400">PREVIEW NOT AVAILABLE</div>
              )}
            </div>

            {snippets.length > 0 && (
              <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2">
                {snippets.map((frame, frameIndex) => (
                  <figure key={frame.id || `${frame.imageUrl}-${frameIndex}`} className="w-[31%] min-w-[7rem] shrink-0 snap-start">
                    <img src={frame.imageUrl} alt={frame.caption || `Video frame ${frameIndex + 1}`} loading="lazy" decoding="async" className="aspect-video w-full rounded object-cover" />
                    {(frame.timestamp || frame.caption) && (
                      <figcaption className="mt-1 truncate text-[0.625em] text-gray-400">
                        {[frame.timestamp, frame.caption].filter(Boolean).join(' · ')}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}
          </div>

          <aside className="min-w-0 border-t border-gray-200 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0 dark:border-gray-700">
            {item.premise && <div className="project-rich-text text-[0.9em] leading-relaxed text-gray-600 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: item.premise }} />}
            {Array.isArray(item.tags) && item.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-[0.65em] text-gray-600 dark:bg-[#2d2d2d] dark:text-gray-300">{tag}</span>)}
              </div>
            )}
            <div className="mt-5 space-y-4 border-t border-gray-200 pt-5 dark:border-gray-700">
              {meta.map(([label, value]) => (
                <div key={label}>
                  <p className="font-mono text-[0.5625em] uppercase tracking-[0.16em] text-gray-400">{label}</p>
                  <p className="mt-1 text-[0.8125em] font-semibold text-gray-800 dark:text-gray-200">{value}</p>
                </div>
              ))}
              {(item.externalUrl || media?.kind === 'external') && (
                <a href={item.externalUrl || media.src} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-between rounded bg-[#2B579A] px-3 py-2 text-[0.6875em] font-bold uppercase tracking-wide text-white">
                  {item.externalLabel || 'Open full work'} <span>↗</span>
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  })() : null;

  const coverNode = type !== 'Directing' && cover && presentation.coverStyle !== 'none' ? (
    <div
      className={
        presentation.coverStyle === 'small'
          ? 'mx-auto w-full max-w-2xl'
          : presentation.coverStyle === 'full'
            ? `${isVisual ? 'mx-auto max-w-6xl' : 'w-full'}`
            : 'w-full'
      }
    >
      <img
        src={projectThumbnail(cover, presentation.coverStyle === 'full' ? 1500 : 1000)}
        alt={item.title || ''}
        className={`w-full rounded-md ${
          isVisual
            ? 'max-h-[82vh] bg-gray-50 object-contain dark:bg-[#202020]'
            : isCaseStudy
              ? 'aspect-[4/3] object-cover'
              : 'aspect-[16/9] object-cover'
        }`}
        style={{ objectPosition: getCoverPosition(item) }}
      />
    </div>
  ) : null;

  const technicalDocument = (() => {
    if (!isTechnicalRecipe || type !== 'Article' || !item.content) {
      return { html: item.content || '', headings: [] };
    }

    const headings = [];
    let headingIndex = 0;
    const html = String(item.content).replace(
      /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
      (match, tag, attrs, inner) => {
        const label = inner
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim();

        if (!label) return match;

        const id = `doc-section-${headingIndex++}`;
        headings.push({ id, label, level: tag.toLowerCase() === 'h3' ? 3 : 2 });
        const cleanAttrs = String(attrs || '').replace(/\s+id=(?:"[^"]*"|'[^']*')/gi, '');
        return `<${tag}${cleanAttrs} id="${id}">${inner}</${tag}>`;
      }
    );

    return { html, headings };
  })();

  const uxCaseStudyDocument = (() => {
    if (!isUxWritingRecipe || type !== 'Article' || !item.content) {
      return { html: item.content || '', sections: [] };
    }

    const sections = [];
    let sectionIndex = 0;
    const html = String(item.content).replace(
      /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
      (match, tag, attrs, inner) => {
        const label = inner
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim();

        if (!label) return match;

        const id = `ux-section-${sectionIndex++}`;
        sections.push({ id, label, level: tag.toLowerCase() === 'h3' ? 3 : 2 });
        const cleanAttrs = String(attrs || '').replace(/\s+id=(?:"[^"]*"|'[^']*')/gi, '');
        return `<${tag}${cleanAttrs} id="${id}">${inner}</${tag}>`;
      }
    );

    return { html, sections };
  })();

  const copywritingCampaignDocument = (() => {
    if (!isCopywritingRecipe || type !== 'Article' || !item.content) {
      return { html: item.content || '', sections: [] };
    }

    const sections = [];
    let sectionIndex = 0;
    const html = String(item.content).replace(
      /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
      (match, tag, attrs, inner) => {
        const label = inner
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim();
        if (!label) return match;

        const id = `copy-section-${sectionIndex++}`;
        sections.push({ id, label, level: tag.toLowerCase() === 'h3' ? 3 : 2 });
        const cleanAttrs = String(attrs || '').replace(/\s+id=(?:"[^"]*"|'[^']*')/gi, '');
        return `<${tag}${cleanAttrs} id="${id}">${inner}</${tag}>`;
      }
    );

    return { html, sections };
  })();

  const seoCaseStudyDocument = (() => {
    if (!isSeoRecipe || type !== 'Article' || !item.content) {
      return { html: item.content || '', sections: [] };
    }

    const sections = [];
    let sectionIndex = 0;
    const html = String(item.content).replace(
      /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
      (match, tag, attrs, inner) => {
        const label = inner
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/\s+/g, ' ')
          .trim();
        if (!label) return match;
        const id = `seo-section-${sectionIndex++}`;
        sections.push({ id, label, level: tag.toLowerCase() === 'h3' ? 3 : 2 });
        const cleanAttrs = String(attrs || '').replace(/\s+id=(?:"[^"]*"|'[^']*')/gi, '');
        return `<${tag}${cleanAttrs} id="${id}">${inner}</${tag}>`;
      }
    );
    return { html, sections };
  })();

  // Shared Studio detail header — satu sumber untuk metadata project sekarang + tab baru.
  // Field yang kosong tidak bikin placeholder: category/type, author/writer, date/year tampil hanya kalau ada.
  const studioHeader = (
    <header className={`${widthClass} ${alignClass} mx-auto`}>
      {item.category && (
        <span className="mb-4 inline-block bg-green-600 px-3 py-1.5 text-[0.625em] font-bold uppercase tracking-wide text-white">
          {item.category}
        </span>
      )}

      <h1 className={PROJECT_DETAIL_TITLE_CLASS}>
        {item.title}
      </h1>

      {(item.author || item.writer || item.date || item.year) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.75em] text-gray-400">
          {(item.author || item.writer) && (
            <span>
              OLEH{' '}
              <span className="font-semibold text-green-700 dark:text-green-400">
                {(item.author || item.writer).toUpperCase()}
              </span>
            </span>
          )}
          {(item.author || item.writer) && (item.date || item.year) && <span>·</span>}
          {(item.date || item.year) && <span>{item.date || item.year}</span>}
        </div>
      )}
    </header>
  );

  const articleContent = type === 'Article' && item.content ? (
    isTechnicalRecipe ? (
      <div className={`${widthClass} mx-auto grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10`}>
        <aside className="hidden lg:block">
          <div className="sticky top-24 border-l border-gray-200 pl-4 dark:border-gray-700">
            <p className="mb-3 font-mono text-[0.625em] font-bold uppercase tracking-[0.18em] text-gray-400">
              On this page
            </p>
            {technicalDocument.headings.length ? (
              <nav aria-label="Technical document sections" className="space-y-2">
                {technicalDocument.headings.map((heading) => {
                  const compactLabel = heading.label.length > 72
                    ? `${heading.label.slice(0, 69).trimEnd()}…`
                    : heading.label;

                  return (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      title={heading.label}
                      aria-label={`Jump to ${heading.label}`}
                      className={`block overflow-hidden text-ellipsis text-[0.72em] leading-snug text-gray-500 transition hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] focus-visible:ring-offset-2 dark:text-gray-400 dark:hover:text-[#6FA8DC] dark:focus-visible:ring-[#6FA8DC] dark:focus-visible:ring-offset-[#161616] ${
                        heading.level === 3 ? 'pl-3' : ''
                      }`}
                    >
                      {compactLabel}
                    </a>
                  );
                })}
              </nav>
            ) : (
              <p className="text-[0.7em] leading-relaxed text-gray-400">
                Tambahkan Heading 2 / Heading 3 di editor untuk membuat navigasi dokumentasi otomatis.
              </p>
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-7 border-b border-gray-200 pb-4 dark:border-gray-700">
            <p className="font-mono text-[0.625em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#6FA8DC]">
              Technical Documentation
            </p>
            <p className="mt-2 max-w-2xl text-[0.78em] leading-relaxed text-gray-500 dark:text-gray-400">
              Structured for procedures, explanations, examples, notes, and troubleshooting.
            </p>
          </div>

          <div
            className={`${ARTICLE_TEXT_CLASS} technical-document-body min-w-0 max-w-none space-y-4 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all [&_h2]:scroll-mt-28 [&_h2]:border-t [&_h2]:border-gray-200 [&_h2]:pt-7 [&_h2]:text-[1.35em] [&_h2]:font-bold [&_h2]:tracking-[-0.01em] dark:[&_h2]:border-gray-700 [&_h3]:scroll-mt-28 [&_h3]:pt-3 [&_h3]:text-[1.08em] [&_h3]:font-bold [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[0.82em] dark:[&_pre]:bg-[#242424] [&_code]:font-mono`}
            dangerouslySetInnerHTML={{ __html: technicalDocument.html }}
          />
        </div>
      </div>
    ) : isUxWritingRecipe ? (
      <div className={`${widthClass} mx-auto min-w-0 space-y-8`}>
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-5 dark:border-gray-700 dark:bg-[#202020]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="font-mono text-[0.625em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#6FA8DC]">
                UX Writing / Content Design
              </p>
              <p className="mt-2 text-[0.8em] leading-relaxed text-gray-500 dark:text-gray-400">
                A writing case study organized around user context, interface copy, decisions, states, and flow.
              </p>
            </div>
            <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1 font-mono text-[0.625em] uppercase tracking-[0.12em] text-gray-500 dark:border-gray-600 dark:bg-[#181818] dark:text-gray-400">
              Case Study
            </span>
          </div>

          {uxCaseStudyDocument.sections.length > 0 && (
            <nav aria-label="UX case study sections" className="mt-5 flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
              {uxCaseStudyDocument.sections
                .filter((section) => section.level === 2)
                .map((section) => {
                  const compactLabel = section.label.length > 42
                    ? `${section.label.slice(0, 39).trimEnd()}…`
                    : section.label;
                  return (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      title={section.label}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[0.7em] leading-none text-gray-600 transition hover:border-[#2B579A] hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:border-gray-600 dark:bg-[#181818] dark:text-gray-300 dark:hover:border-[#6FA8DC] dark:hover:text-[#6FA8DC]"
                    >
                      {compactLabel}
                    </a>
                  );
                })}
            </nav>
          )}
        </div>

        <div
          className={`${ARTICLE_TEXT_CLASS} ux-writing-case-study min-w-0 max-w-none space-y-5 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all [&_h2]:scroll-mt-28 [&_h2]:mt-8 [&_h2]:border-t [&_h2]:border-gray-200 [&_h2]:pt-6 [&_h2]:mb-3 [&_h2]:text-[1.45em] [&_h2]:font-bold [&_h2]:tracking-[-0.015em] dark:[&_h2]:border-gray-700 [&_h3]:scroll-mt-28 [&_h3]:mt-7 [&_h3]:text-[0.78em] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-[0.12em] [&_h3]:text-[#2B579A] dark:[&_h3]:text-[#6FA8DC] [&_blockquote]:my-6 [&_blockquote]:rounded-xl [&_blockquote]:border [&_blockquote]:border-gray-200 [&_blockquote]:bg-gray-50 [&_blockquote]:px-5 [&_blockquote]:py-5 [&_blockquote]:not-italic [&_blockquote]:shadow-sm dark:[&_blockquote]:border-gray-700 dark:[&_blockquote]:bg-[#202020] [&_blockquote_p]:text-[1.05em] [&_blockquote_p]:font-medium [&_blockquote_p]:leading-relaxed [&_img]:my-7 [&_img]:rounded-xl [&_img]:border [&_img]:border-gray-200 [&_img]:bg-gray-50 [&_img]:p-2 dark:[&_img]:border-gray-700 dark:[&_img]:bg-[#202020]`}
          dangerouslySetInnerHTML={{ __html: uxCaseStudyDocument.html }}
        />
      </div>
    ) : isCopywritingRecipe ? (
      <div className="mx-auto min-w-0 max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-[#111827] text-white shadow-sm dark:border-gray-700">
          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="px-6 py-7 sm:px-8 sm:py-9">
              <p className="font-mono text-[0.625em] font-bold uppercase tracking-[0.2em] text-[#93C5FD]">
                Copywriting Campaign
              </p>
              <p className="mt-3 max-w-2xl text-[1.05em] font-semibold leading-snug sm:text-[1.2em]">
                Creative work presented as a campaign system — brief, insight, idea, copy executions, rationale, and learning.
              </p>
              <p className="mt-4 max-w-2xl text-[0.78em] leading-relaxed text-gray-300">
                Built to show the thinking behind the words, not just a wall of finished copy.
              </p>
            </div>
            <div className="border-t border-white/10 bg-white/5 px-6 py-7 lg:border-l lg:border-t-0 sm:px-8">
              <p className="font-mono text-[0.6em] font-bold uppercase tracking-[0.16em] text-gray-400">Campaign Map</p>
              {copywritingCampaignDocument.sections.length > 0 ? (
                <nav aria-label="Copywriting campaign sections" className="mt-4 flex flex-wrap gap-2">
                  {copywritingCampaignDocument.sections
                    .filter((section) => section.level === 2)
                    .map((section) => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        title={section.label}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[0.64em] leading-none text-gray-200 transition hover:border-white/40 hover:bg-white/10"
                      >
                        {section.label.length > 34 ? `${section.label.slice(0, 31).trimEnd()}…` : section.label}
                      </a>
                    ))}
                </nav>
              ) : (
                <p className="mt-3 text-[0.72em] leading-relaxed text-gray-400">
                  Add Heading 2 sections in RichEditor to build the campaign map automatically.
                </p>
              )}
            </div>
          </div>
        </section>

        <div
          className={`${ARTICLE_TEXT_CLASS} copywriting-campaign min-w-0 max-w-none space-y-5 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all [&_h2]:scroll-mt-28 [&_h2]:mt-10 [&_h2]:border-t [&_h2]:border-gray-200 [&_h2]:pt-7 [&_h2]:text-[1.5em] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] dark:[&_h2]:border-gray-700 [&_h3]:scroll-mt-28 [&_h3]:mt-7 [&_h3]:font-mono [&_h3]:text-[0.72em] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-[0.14em] [&_h3]:text-[#2B579A] dark:[&_h3]:text-[#6FA8DC] [&_blockquote]:my-7 [&_blockquote]:rounded-2xl [&_blockquote]:border-0 [&_blockquote]:bg-[#111827] [&_blockquote]:px-6 [&_blockquote]:py-7 [&_blockquote]:not-italic [&_blockquote]:text-white [&_blockquote]:shadow-sm dark:[&_blockquote]:bg-[#0f172a] [&_blockquote]:before:mb-3 [&_blockquote]:before:block [&_blockquote]:before:font-mono [&_blockquote]:before:text-[0.6em] [&_blockquote]:before:font-bold [&_blockquote]:before:uppercase [&_blockquote]:before:tracking-[0.18em] [&_blockquote]:before:text-[#93C5FD] [&_blockquote]:before:content-['Copy_specimen'] [&_blockquote_p]:text-[1.18em] [&_blockquote_p]:font-semibold [&_blockquote_p]:leading-snug [&_img]:my-8 [&_img]:rounded-2xl [&_img]:border [&_img]:border-gray-200 [&_img]:bg-gray-50 [&_img]:p-2 [&_img]:shadow-sm dark:[&_img]:border-gray-700 dark:[&_img]:bg-[#202020]`}
          dangerouslySetInnerHTML={{ __html: copywritingCampaignDocument.html }}
        />
      </div>
    ) : isSeoRecipe ? (
      <div className={`${widthClass} mx-auto min-w-0 space-y-8`}>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#1c1c1c]">
          <div className="border-b border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-gray-700 dark:bg-[#202020]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[0.625em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#6FA8DC]">SEO Content Case Study</p>
                <p className="mt-2 max-w-2xl text-[0.8em] leading-relaxed text-gray-500 dark:text-gray-400">
                  Search intent, audience, content decisions, optimization, and evidence — without requiring invented performance metrics.
                </p>
              </div>
              <span className="w-fit rounded-full border border-gray-200 bg-white px-3 py-1 font-mono text-[0.625em] uppercase tracking-[0.12em] text-gray-500 dark:border-gray-600 dark:bg-[#181818] dark:text-gray-400">Search / Content</span>
            </div>
          </div>
          {seoCaseStudyDocument.sections.length > 0 && (
            <nav aria-label="SEO case study sections" className="flex flex-wrap gap-2 px-5 py-4">
              {seoCaseStudyDocument.sections.filter((section) => section.level === 2).map((section) => (
                <a key={section.id} href={`#${section.id}`} title={section.label}
                  className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-[0.66em] leading-none text-gray-600 transition hover:border-[#2B579A] hover:text-[#2B579A] dark:border-gray-600 dark:bg-[#242424] dark:text-gray-300 dark:hover:border-[#6FA8DC] dark:hover:text-[#6FA8DC]">
                  {section.label.length > 42 ? `${section.label.slice(0, 39).trimEnd()}…` : section.label}
                </a>
              ))}
            </nav>
          )}
        </div>
        <div
          className={`${ARTICLE_TEXT_CLASS} seo-content-case-study min-w-0 max-w-none space-y-5 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all [&_h2]:scroll-mt-28 [&_h2]:mt-8 [&_h2]:border-t [&_h2]:border-gray-200 [&_h2]:pt-6 [&_h2]:mb-3 [&_h2]:text-[1.4em] [&_h2]:font-bold dark:[&_h2]:border-gray-700 [&_h3]:scroll-mt-28 [&_h3]:mt-7 [&_h3]:font-mono [&_h3]:text-[0.76em] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-[0.1em] [&_h3]:text-[#2B579A] dark:[&_h3]:text-[#6FA8DC] [&_blockquote]:my-7 [&_blockquote]:rounded-xl [&_blockquote]:border [&_blockquote]:border-gray-200 [&_blockquote]:bg-white [&_blockquote]:px-5 [&_blockquote]:py-5 [&_blockquote]:not-italic [&_blockquote]:shadow-sm dark:[&_blockquote]:border-gray-700 dark:[&_blockquote]:bg-[#202020] [&_blockquote]:before:mb-2 [&_blockquote]:before:block [&_blockquote]:before:font-mono [&_blockquote]:before:text-[0.62em] [&_blockquote]:before:font-bold [&_blockquote]:before:uppercase [&_blockquote]:before:tracking-[0.14em] [&_blockquote]:before:text-gray-400 [&_blockquote]:before:content-['Search_specimen'] [&_img]:my-7 [&_img]:rounded-xl [&_img]:border [&_img]:border-gray-200 [&_img]:bg-gray-50 [&_img]:p-2 dark:[&_img]:border-gray-700 dark:[&_img]:bg-[#202020]`}
          dangerouslySetInnerHTML={{ __html: seoCaseStudyDocument.html }}
        />
      </div>
    ) : (
      <div
        className={`${widthClass} ${ARTICLE_TEXT_CLASS} mx-auto min-w-0 max-w-full space-y-4 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all`}
        dangerouslySetInnerHTML={{ __html: item.content }}
      />
    )
  ) : null;

  // CASE STUDY / DEFAULT SPLIT:
  // cover on one side, the first manually-created block on the other.
  const splitHero = presentation.coverStyle === 'split' && coverNode ? (
    <div
      className={`${widthClass} mx-auto grid grid-cols-1 items-start gap-6 ${
        isCaseStudy ? 'md:grid-cols-[1.15fr_0.85fr] md:gap-10' : 'md:grid-cols-2 md:gap-9'
      }`}
    >
      {coverNode}
      <div className={`${ARTICLE_TEXT_CLASS} min-w-0 space-y-4`}>
        {blocks.slice(0, 1).map(renderBlock)}
      </div>
    </div>
  ) : null;

  const remainingBlocks = splitHero ? blocks.slice(1) : blocks;

  // Recipe-aware Text + Image pairing — ORDER-SAFE.
  // CMS order is law. The renderer may style adjacent TEXT -> IMAGE blocks together,
  // but it must never reverse them, pull an image backward, or pair IMAGE -> TEXT.
  const canAutoPairTextImage = (textBlock, imageBlock) => {
    if (!textBlock || !imageBlock) return false;
    if (!(textBlock.type === 'text' || textBlock.type === 'word')) return false;
    if (imageBlock.type !== 'image' || !imageBlock.url) return false;
    const textDisplay = textBlock.display || {};
    const imageDisplay = imageBlock.display || {};
    const textStyle = textDisplay.style || 'body';
    const imageSize = imageDisplay.size || 'auto';
    return ['body', 'intro'].includes(textStyle) && imageSize === 'auto';
  };

  const supportsAutoPairing =
    isUxWritingRecipe || isTechnicalRecipe ||
    isStrategyRecipe || isEditingRecipe;

  // Copywriting is intentionally NOT auto-paired. Campaign copy and creative visuals
  // need independent hierarchy: copy reads first, then the visual gets full showcase width.
  // Editorial Story / Long Read are also intentionally NOT auto-paired. Reading rhythm
  // stays primary; images interrupt the article vertically instead of becoming side columns.

  const renderPairedBlocks = (list = []) => {
    if (!supportsAutoPairing) return list.map(renderBlock);

    const nodes = [];
    for (let i = 0; i < list.length; i += 1) {
      const current = list[i];
      const next = list[i + 1];

      // Pair ONLY when CMS explicitly has TEXT immediately followed by IMAGE.
      // This preserves the exact sequence the editor created.
      if (!canAutoPairTextImage(current, next)) {
        nodes.push(renderBlock(current, i));
        continue;
      }

      const textBlock = current;
      const imageBlock = next;
      const pairKey = `pair-${textBlock.id || i}-${imageBlock.id || i + 1}`;
      const imageDominant = isCopywritingRecipe || isStrategyRecipe;
      const technicalPair = isTechnicalRecipe;
      const gridTemplate = imageDominant
        ? 'md:grid-cols-[0.82fr_1.18fr]'
        : technicalPair
          ? 'md:grid-cols-[0.95fr_1.05fr]'
          : 'md:grid-cols-2';

      nodes.push(
        <section
          key={pairKey}
          className={`mx-auto grid w-full items-center gap-6 md:gap-9 ${gridTemplate} ${
            isCopywritingRecipe || isStrategyRecipe ? 'max-w-6xl' : 'max-w-4xl'
          }`}
          data-studio-pair="text-image"
          data-studio-order="preserved"
        >
          <div className="md:order-1">
            {renderBlock(textBlock, i)}
          </div>
          <div className="md:order-2">
            {renderBlock(imageBlock, i + 1)}
          </div>
        </section>
      );
      i += 1;
    }
    return nodes;
  };

  return (
    <article
      className={`project-studio-public ${layoutClass} ${
        isScreenplayRecipe
          ? 'space-y-7'
          : isTechnicalRecipe
            ? 'space-y-7'
            : (isCopywritingRecipe || isVisual)
              ? 'space-y-7'
              : isMinimal
                ? 'space-y-6'
                : 'space-y-8'
      }`}
      data-project-layout={presentation.layout}
      data-project-recipe={presentation.recipe}
      data-poster-recipe={isPosterRecipe ? 'true' : undefined}
    >
      {studioHeader}

      {/* Directing Studio keeps the Studio content system, but uses the compact
          video-left / information-right hero agreed for Directing. */}
      {type === 'Directing' ? directingStudioHero : primaryMediaNode}

      {/* EDITORIAL STORY / VISUAL SHOWCASE: cover treatment comes from the existing recipe. */}
      {type !== 'Directing' && !splitHero && coverNode}

      {/* DEFAULT / CASE STUDY: split hero. */}
      {type !== 'Directing' && splitHero}

      {/* In Studio, Universal Blocks become the ordered source of truth.
          Legacy article content is only used as a fallback when no Studio blocks exist. */}
      {blocks.length === 0 ? articleContent : null}

      {/* Universal Blocks render in the exact CMS order. */}
      <div
        className={`${(isVisual || isCopywritingRecipe) ? 'max-w-6xl' : widthClass} mx-auto ${
          isScreenplayRecipe
            ? 'space-y-7'
            : (isUxWritingRecipe || isSeoRecipe || isStrategyRecipe || isEditingRecipe || isCaseStudy)
              ? 'space-y-10'
              : isMinimal
                ? 'space-y-6'
                : 'space-y-8'
        }`}
      >
        {renderPairedBlocks(remainingBlocks)}
      </div>
    </article>
  );
}

export default function Projects({ data, initialArticleId, initialWorkTarget, navigationRequestKey, interactiveWords = [], onNavigate, readingWorkId, onSetReadingWorkId }) {
  const projectsData = data || {};
  const heading = projectsData.heading ?? '';
  const subheading = projectsData.subheading ?? '';
  const articles = useMemo(() => projectsData.articles || [], [projectsData.articles]);
  const directingItems = useMemo(() => projectsData.directing?.items || [], [projectsData.directing?.items]);
  const posterItems = useMemo(() => projectsData.poster?.items || [], [projectsData.poster?.items]);
  // Tab tambahan bebas (di luar Articles & Poster) — dibikin dari CMS, bisa berapa
  // aja jumlahnya, tiap tab punya nama + daftar kartu sendiri (judul, gambar,
  // kategori, deskripsi, link opsional).
  const customSections = useMemo(() => projectsData.customSections || [], [projectsData.customSections]);
  // Label tab navigasi buat Articles & Poster — bisa diganti bebas lewat CMS, kosong
  // berarti pakai nama bawaan.
  const articlesLabel = projectsData.articlesLabel?.trim() || 'Articles';
  const directingLabel = projectsData.directingLabel?.trim() || 'Directing';
  const posterLabel = projectsData.posterLabel?.trim() || 'Poster';
  const backButtonLabel = projectsData.backLabel?.trim() || 'Back';

  // Semua tab navigasi jadi 1 daftar: Articles & Poster bawaan, diikuti tab tambahan
  // apa pun yang ditambah lewat CMS (jumlahnya bebas, gak dibatasin cuma 2).
  const navTabs = useMemo(() => [
    { key: 'articles', label: articlesLabel, count: articles.length },
    { key: 'directing', label: directingLabel, count: directingItems.length },
    { key: 'poster', label: posterLabel, count: posterItems.length },
    ...customSections.filter((cs) => cs.label?.trim()).map((cs) => ({
      key: `custom:${cs.id}`,
      label: cs.label.trim(),
      count: Array.isArray(cs.items) ? cs.items.length : 0,
    })),
  ], [articlesLabel, directingLabel, posterLabel, customSections, articles.length, directingItems.length, posterItems.length]);

  // Halaman selalu masuk lewat Project Index dulu. Visitor memilih rak/kategori,
  // baru melihat karya di dalamnya—supaya halaman tidak terasa seperti CMS penuh tab.
  const [activeCategory, setActiveCategory] = useState('overview');
  const [projectQuery, setProjectQuery] = useState('');
  const activeCustomSection =
    activeCategory.startsWith('custom:')
      ? customSections.find((cs) => `custom:${cs.id}` === activeCategory)
      : null;
  const activeCustomItems = activeCustomSection?.items || [];
  const activeCustomType = activeCustomSection?.contentType || (activeCustomSection?.layout === 'articles' ? 'writing' : 'image');
  const activeCustomLabel = (activeCustomSection?.label || '').trim().toLowerCase();
  const activeCustomFamily =
    activeCustomType === 'audio' ? 'audio' :
    /audio|voice|vn|sound|podcast/.test(activeCustomLabel) ? 'audio' :
    /script|screenplay|naskah/.test(activeCustomLabel) ? 'script' :
    /short story|cerpen|story|fiction|fiksi/.test(activeCustomLabel) ? 'story' :
    activeCustomType === 'video' ? 'video' :
    activeCustomType === 'image' ? 'visual' :
    activeCustomType === 'writing' ? 'writing' :
    'generic';

  const getItemAudio = (item = {}) => {
    const audioBlock = Array.isArray(item.cmsBlocks) ? item.cmsBlocks.find((block) => block?.type === 'audio' && block?.url) : null;
    return audioBlock?.url || item.audioUrl || item.fileUrl || (/\.(mp3|m4a|wav|ogg|aac)(\?|$)/i.test(item.url || '') ? item.url : '');
  };

  // Artikel yang lagi dibaca penuh (null = masih di daftar/mode Mojok)
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedDirectingIndex, setSelectedDirectingIndex] = useState(null);
  // Kontrol modal Share (nyimpen artikel yang lagi mau di-share, null = modal ketutup)
  const [shareArticle, setShareArticle] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const shareModalRef = useRef(null);
  const shareCloseRef = useRef(null);

  // Item poster yang lagi dibuka detailnya (null = masih di tampilan grid)
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(null);
  const [posterSpotlightIndex, setPosterSpotlightIndex] = useState(0);
  const posterThumbRailRef = useRef(null);
  // Item tab tambahan (custom section) yang lagi dibuka detailnya (null = masih di grid)
  const [selectedCustomIndex, setSelectedCustomIndex] = useState(null);
  // Ukuran grid masonry poster: kecil, medium, atau besar.
  const [gridDensity, setGridDensity] = useState('medium');
  const [listPage, setListPage] = useState(1);
  const itemsPerPage = activeCategory === 'poster' ? 24 : 6;

  const goToProjectIndex = () => {
    setSelectedArticle(null);
    setSelectedDirectingIndex(null);
    setSelectedGalleryIndex(null);
    setPosterSpotlightIndex(0);
    setSelectedCustomIndex(null);
    setListPage(1);
    setActiveCategory('overview');
  };

  // Artikel pertama di data = artikel unggulan (gaya headline Mojok), sisanya jadi
  // daftar kecil di sampingnya — logic ini sekarang ada di dalem ArticleStyleListing
  // (dipakai bareng buat tab Articles & tab tambahan ber-layout "articles"), jadi gak
  // perlu dihitung ulang manual di sini.

  const activeGalleryItems = posterItems;
  const selectedGalleryItem =
    selectedGalleryIndex !== null ? activeGalleryItems[selectedGalleryIndex] : null;
  const selectedDirectingItem = selectedDirectingIndex !== null ? directingItems[selectedDirectingIndex] : null;

  useEffect(() => {
    if (activeCategory !== 'poster') return;
    const activeThumb = posterThumbRailRef.current?.querySelector('[data-poster-thumb-active="true"]');
    activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [posterSpotlightIndex, listPage, activeCategory]);


  // Slot navigasi paling kiri bersifat kontekstual:
  // daftar tab = "← Projects", detail/postingan = label Back dari CMS ke daftar tab aktif.
  const isProjectPostOpen =
    selectedArticle !== null ||
    selectedDirectingIndex !== null ||
    selectedGalleryIndex !== null ||
    selectedCustomIndex !== null;

  const projectSections = useMemo(() => [
    { key: 'articles', label: articlesLabel, type: 'writing', count: articles.length, image: getProjectCover(articles[0]), imagePosition: getCoverPosition(articles[0]), description: projectsData.articlesDescription ?? '' },
    { key: 'directing', label: directingLabel, type: 'video', count: directingItems.length, image: getProjectCover(directingItems.find((item) => item?.posterImage) || directingItems.find((item) => getProjectCover(item)) || directingItems[0]), imagePosition: getCoverPosition(directingItems.find((item) => item?.posterImage) || directingItems.find((item) => getProjectCover(item)) || directingItems[0]), description: projectsData.directingDescription ?? '' },
    { key: 'poster', label: posterLabel, type: 'image', count: posterItems.length, image: getProjectCover(posterItems[0]), imagePosition: getCoverPosition(posterItems[0]), description: projectsData.posterDescription ?? '' },
    ...customSections.filter((section) => section.label?.trim()).map((section) => ({
      key: `custom:${section.id}`,
      label: section.label.trim(),
      type: section.contentType || (section.layout === 'articles' ? 'writing' : 'image'),
      count: section.items?.length || 0,
      image: getProjectCover(section.items?.[0]),
      imagePosition: getCoverPosition(section.items?.[0]),
      description: section.description ?? '',
    })),
  ], [articles, articlesLabel, directingItems, directingLabel, posterItems, posterLabel, customSections, projectsData.articlesDescription, projectsData.directingDescription, projectsData.posterDescription]);
  const visibleProjectSections = useMemo(
    () => projectSections.filter((section) => section.label?.trim()),
    [projectSections]
  );

  const searchableWorks = useMemo(() => [
    ...articles.map((item, index) => ({ item, index, sectionKey: 'articles', sectionLabel: articlesLabel, type: 'writing', image: getProjectCover(item) })),
    ...directingItems.map((item, index) => ({ item, index, sectionKey: 'directing', sectionLabel: directingLabel, type: 'video', image: getProjectCover(item) })),
    ...posterItems.map((item, index) => ({ item, index, sectionKey: 'poster', sectionLabel: posterLabel, type: 'image', image: getProjectCover(item) })),
    ...customSections.filter((section) => section.label?.trim()).flatMap((section) => (section.items || []).map((item, index) => ({ item, index, sectionKey: `custom:${section.id}`, sectionLabel: section.label.trim(), type: section.contentType || (section.layout === 'articles' ? 'writing' : 'image'), image: getProjectCover(item) }))),
  ], [articles, articlesLabel, directingItems, directingLabel, posterItems, posterLabel, customSections]);
  const normalizedQuery = projectQuery.trim().toLocaleLowerCase('id');
  const searchResults = normalizedQuery ? searchableWorks.filter(({ item, sectionLabel }) => `${item.title || ''} ${item.category || ''} ${item.description || ''} ${item.snippet || ''} ${sectionLabel}`.toLocaleLowerCase('id').includes(normalizedQuery)).slice(0, 12) : [];

  const openSearchResult = (result) => {
    setActiveCategory(result.sectionKey);
    if (result.sectionKey === 'articles') openArticle(result.item);
    else if (result.sectionKey === 'directing') setSelectedDirectingIndex(result.index);
    else if (result.sectionKey === 'poster') setSelectedGalleryIndex(result.index);
    else setSelectedCustomIndex(result.index);
    setProjectQuery('');
  };

  useEffect(() => {
    if (!initialWorkTarget || !navigationRequestKey) return;

    if (initialWorkTarget.type === 'article') {
      const item = articles.find((entry) => entry.id === initialWorkTarget.itemId);
      if (item) {
        setActiveCategory('articles');
        openArticle(item);
      }
      return;
    }

    if (initialWorkTarget.type === 'directing') {
      const index = directingItems.findIndex((item) => item.id === initialWorkTarget.itemId);
      if (index >= 0) {
        setActiveCategory('directing');
        setSelectedDirectingIndex(index);
      }
      return;
    }

    if (initialWorkTarget.type === 'poster') {
      const index = posterItems.findIndex((item) => item.id === initialWorkTarget.itemId);
      if (index >= 0) {
        setActiveCategory('poster');
        setSelectedGalleryIndex(index);
        setPosterSpotlightIndex(index);
      }
      return;
    }

    if (initialWorkTarget.type === 'custom') {
      const sectionIndex = customSections.findIndex((section) => section.id === initialWorkTarget.sectionId);
      if (sectionIndex < 0) return;
      const itemIndex = (customSections[sectionIndex].items || []).findIndex((item) => item.id === initialWorkTarget.itemId);
      if (itemIndex >= 0) {
        setActiveCategory(`custom:${customSections[sectionIndex].id}`);
        setSelectedCustomIndex(itemIndex);
      }
    }
  }, [navigationRequestKey, initialWorkTarget, articles, directingItems, posterItems, customSections]);

  const readingWork = useMemo(() => {
    if (!readingWorkId) return null;
    let found = articles.find((a) => a.id === readingWorkId);
    if (found) return found;
    found = directingItems.find((d) => d.id === readingWorkId);
    if (found) return found;
    found = posterItems.find((p) => p.id === readingWorkId);
    if (found) return found;
    for (const section of customSections) {
      found = (section.items || []).find((item) => item.id === readingWorkId);
      if (found) return found;
    }
    return null;
  }, [readingWorkId, articles, directingItems, posterItems, customSections]);

  // Deep-link: kalau app dibuka lewat link hasil Share (?tab=Projects&article=ID),
  // otomatis langsung buka artikel yang dimaksud begitu data artikel-nya kebaca.
  useEffect(() => {
    if (!initialArticleId || articles.length === 0) return;
    const match = articles.find((a) => a.id === initialArticleId);
    if (match) {
      setActiveCategory('articles');
      setSelectedArticle(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialArticleId, articles.length]);

  const openWork = (item) => {
    if (!item) return;

    // Explicit displayMode handling if configured in CMS:
    if (item.displayMode === 'reading' && onSetReadingWorkId && item.id) {
      onSetReadingWorkId(item.id);
      const url = new URL(window.location.href);
      url.searchParams.set('work', item.id);
      window.history.pushState(null, '', url);
      return;
    }
    if (item.displayMode === 'existing') {
      if (activeCategory === 'articles') {
        openArticle(item);
        return;
      }
      if (activeCategory === 'directing') {
        const idx = directingItems.indexOf(item);
        if (idx >= 0) setSelectedDirectingIndex(idx);
        return;
      }
      if (activeCategory.startsWith('custom:')) {
        const idx = activeCustomItems.indexOf(item);
        if (idx >= 0) setSelectedCustomIndex(idx);
        return;
      }
    }

    // Default fallback if displayMode is not explicitly set:
    if (activeCategory === 'directing') {
      const idx = directingItems.indexOf(item);
      if (idx >= 0) setSelectedDirectingIndex(idx);
      return;
    }
    if (activeCategory.startsWith('custom:') && (activeCustomType === 'video' || activeCustomType === 'image' || activeCustomFamily === 'audio')) {
      const idx = activeCustomItems.indexOf(item);
      if (idx >= 0) setSelectedCustomIndex(idx);
      return;
    }
    if (onSetReadingWorkId && item.id) {
      onSetReadingWorkId(item.id);
      const url = new URL(window.location.href);
      url.searchParams.set('work', item.id);
      window.history.pushState(null, '', url);
      return;
    }
    openArticle(item);
  };

  // Sinkronin URL browser tiap kali buka/tutup artikel — INI yang bikin link Share
  // beneran ngarah ke artikel yang tepat (bukan cuma mendarat di halaman awal).
  const openArticle = (art) => {
    setSelectedArticle(art);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'Projects');
    url.searchParams.set('article', art.id);
    window.history.pushState(null, '', url);
  };
  const closeArticle = () => {
    setSelectedArticle(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('article');
    window.history.pushState(null, '', url);
  };

  const buildShareUrl = (art) => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('tab', 'Projects');
    url.searchParams.set('article', art.id);
    return url.toString();
  };

  const handleNativeShare = async (art) => {
    const shareUrl = buildShareUrl(art);
    if (navigator.share) {
      try {
        await navigator.share({ title: art.title, text: richTextToPlainText(art.snippet), url: shareUrl });
        return;
      } catch (err) {
        // Kalau dibatalin (AbortError) ya udah, gak perlu munculin modal fallback
        if (err?.name === 'AbortError') return;
      }
    }
    setShareArticle(art);
    setLinkCopied(false);
  };

  const handleCopyLink = async (art) => {
    const shareUrl = buildShareUrl(art);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  useEffect(() => {
    if (!shareArticle) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    shareCloseRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShareArticle(null);
        return;
      }
      if (event.key !== 'Tab' || !shareModalRef.current) return;
      const controls = [...shareModalRef.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [shareArticle]);

  // Esc balik ke grid pas lagi buka detail item di tab tambahan
  useEffect(() => {
    if (selectedCustomIndex === null) return;
    const handler = (e) => {
      if (e.key === 'Escape') setSelectedCustomIndex(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedCustomIndex]);

  const nextGalleryItem = () =>
    setSelectedGalleryIndex((prev) => (prev + 1) % activeGalleryItems.length);
  const prevGalleryItem = () =>
    setSelectedGalleryIndex((prev) => (prev - 1 + activeGalleryItems.length) % activeGalleryItems.length);

  // Esc balik ke daftar artikel pas lagi baca satu artikel penuh
  useEffect(() => {
    if (!selectedArticle) return;
    const handler = (e) => {
      if (e.key === 'Escape') setSelectedArticle(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedArticle]);

  // Pas satu artikel dibuka, timpa <title> & meta/OG/Twitter tags jadi spesifik punya
  // artikel itu (judul, snippet jadi description, gambar artikel, URL share-nya) — biar
  // preview link Share (WhatsApp/X/FB/LinkedIn) nunjukkin artikel yang bener, bukan
  // generic "Projects" doang. Pas artikel ditutup/komponen unmount, balikin lagi ke meta
  // default tab Projects (heading/subheading), bukan dibiarin nyangkut ke meta artikel
  // terakhir yang dibuka.
  useEffect(() => {
    if (!selectedArticle) return;
    setPageMeta({
      title: selectedArticle.title,
      description: selectedArticle.snippet,
      image: selectedArticle.image,
      url: buildShareUrl(selectedArticle),
    });
    return () => {
      setPageMeta({ title: heading, description: subheading });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArticle]);

  // Navigasi keyboard pas lagi di mode detail gallery: Esc balik ke grid,
  // panah kiri/kanan gonta-ganti item
  useEffect(() => {
    if (selectedGalleryIndex === null) return;
    const handler = (e) => {
      if (e.key === 'Escape') setSelectedGalleryIndex(null);
      if (e.key === 'ArrowLeft' && activeGalleryItems.length > 1) {
        setSelectedGalleryIndex((current) => (current - 1 + activeGalleryItems.length) % activeGalleryItems.length);
      }
      if (e.key === 'ArrowRight' && activeGalleryItems.length > 1) {
        setSelectedGalleryIndex((current) => (current + 1) % activeGalleryItems.length);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedGalleryIndex, activeGalleryItems.length]);

  if (readingWork) {
    const workTitle = readingWork.title || readingWork.name || 'Untitled';
    const rawBody = readingWork.content || readingWork.wordContent || readingWork.description || readingWork.snippet || readingWork.premise || '';

    const handleBackFromReading = () => {
      if (onSetReadingWorkId) {
        onSetReadingWorkId(null);
      }
      if (window.history.length > 1) {
        window.history.back();
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete('work');
        url.searchParams.set('tab', 'Projects');
        window.history.replaceState(null, '', url);
      }
    };

    const handleShareReadingWork = async () => {
      const shareUrl = window.location.href;
      if (navigator.share) {
        try {
          await navigator.share({ title: workTitle, url: shareUrl });
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(shareUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch {
        // fallback copy
      }
    };

    return (
      <div className="min-h-screen w-full bg-white dark:bg-[#181818] py-10 px-4 sm:px-8 flex justify-center select-text">
        <article className="max-w-2xl w-full space-y-8">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleBackFromReading}
              className="font-mono text-[0.8125em] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleShareReadingWork}
              className="font-mono text-[0.8125em] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {linkCopied ? 'Link copied!' : 'Share'}
            </button>
          </div>

          <header className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <h1 className="text-[1.85em] sm:text-[2.2em] font-serif font-extrabold text-gray-900 dark:text-white leading-tight">
              {workTitle}
            </h1>
          </header>

          <div
            className={`${ARTICLE_TEXT_CLASS} space-y-4 min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all`}
            dangerouslySetInnerHTML={{ __html: rawBody }}
          />
        </article>
      </div>
    );
  }

  return (
    <div className="w-full text-gray-900 dark:text-gray-100 select-text py-4">

      {(heading || subheading) && <header className="mb-6 border-b border-gray-200 pb-5 dark:border-gray-700">
        {heading && <h1 className="text-[1.75em] font-semibold tracking-tight sm:text-[2.2em]"><InteractiveText text={heading} rules={interactiveWords} page="Projects" onNavigate={onNavigate} /></h1>}
        {subheading && <RichContent value={subheading} className="mt-2 max-w-2xl text-[0.8125em] leading-relaxed text-gray-500 dark:text-gray-400 [&_p]:my-0" />}
      </header>}

      {/* Navigasi kategori hanya muncul setelah masuk rak. Halaman awal memakai Project Index. */}
      {activeCategory !== 'overview' && <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
        <button
          type="button"
          onClick={() => {
            if (selectedArticle) closeArticle();
            else if (selectedDirectingIndex !== null) setSelectedDirectingIndex(null);
            else if (selectedGalleryIndex !== null) setSelectedGalleryIndex(null);
            else if (selectedCustomIndex !== null) setSelectedCustomIndex(null);
            else goToProjectIndex();
          }}
          className="mr-1 rounded-md bg-gray-100 px-3 py-2 font-mono text-[0.6875em] font-bold uppercase tracking-wide text-gray-600 transition hover:text-[#2B579A] dark:bg-[#2d2d2d] dark:text-gray-300"
        >
          {isProjectPostOpen ? `← ${backButtonLabel}` : '← Projects'}
        </button>
        {navTabs.map((tab) => (
          <button
            key={tab.key}
            data-hint-id={`projects-nav-${tab.key}`}
            onClick={() => {
              setActiveCategory(tab.key);
              setSelectedArticle(null);
              setSelectedDirectingIndex(null);
              setSelectedGalleryIndex(null);
              setPosterSpotlightIndex(0);
              setSelectedCustomIndex(null);
              setListPage(1);
            }}
            className={`px-4 py-2 text-[0.75em] font-semibold rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616] ${
              activeCategory === tab.key
                ? 'bg-[#2B579A] dark:bg-[#6FA8DC] text-white dark:text-[#1a1a1a] shadow-sm'
                : 'bg-gray-100 dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838]'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>}

      {activeCategory === 'overview' && (
        <section className="view-reveal py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {visibleProjectSections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveCategory(section.key)}
                className="flex items-center justify-center p-6 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#222222] hover:border-gray-400 dark:hover:border-gray-500 transition-colors rounded-none text-center cursor-pointer min-h-[5rem]"
              >
                <span className="text-[1.125em] font-semibold text-gray-900 dark:text-gray-100">
                  {section.label}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ======================= MENU: ARTICLES (gaya portal berita / Mojok) ======================= */}
      {activeCategory === 'articles' && (
        <div>
          {!selectedArticle ? (
            articles.length === 0 ? (
              <p className="text-[0.875em] text-gray-400 italic py-10 text-center">
                Belum ada artikel yang ditambahkan.
              </p>
            ) : (
              <>
                <ArticleStyleListing
                  items={articles.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage)}
                  onOpen={openWork}
                  hintPrefix="projects-article"
                />
                <ProjectPager page={listPage} totalPages={Math.max(1, Math.ceil(articles.length / itemsPerPage))} onPageChange={setListPage} />
              </>
            )
          ) : (
            /* Tampilan Baca Artikel Penuh (Detail View) */
            <div className="space-y-6 view-reveal">
              <div className="flex items-center justify-end flex-wrap gap-2">
                <button
                  onClick={() => handleNativeShare(selectedArticle)}
                  className="flex items-center gap-1.5 text-[0.75em] font-semibold text-white bg-[#2B579A] dark:bg-[#6FA8DC] dark:text-[#1a1a1a] px-3.5 py-1.5 rounded shadow-sm hover:bg-[#1e3f73] dark:hover:bg-[#5a95c9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /></svg>
                  Share
                </button>
              </div>

              {hasStudioPresentation(selectedArticle) && <ProjectStudioRenderer item={selectedArticle} type="Article" onBack={goToProjectIndex} />}
              <div className={`${hasStudioPresentation(selectedArticle) ? 'hidden' : ''} ${ARTICLE_CONTAINER_CLASS} space-y-4`}>
                {selectedArticle.category && (
                  <span className="inline-block bg-green-600 text-white text-[0.625em] font-bold uppercase tracking-wide px-3 py-1.5">
                    {selectedArticle.category}
                  </span>
                )}

                <h1 className={PROJECT_DETAIL_TITLE_CLASS}>
                  {selectedArticle.title}
                </h1>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75em] text-gray-400 font-mono">
                  {selectedArticle.author && (
                    <>
                      <span>
                        OLEH{' '}
                        <span className="text-green-700 dark:text-green-400 font-semibold">
                          {selectedArticle.author.toUpperCase()}
                        </span>
                      </span>
                      <span>·</span>
                    </>
                  )}
                  <span>{selectedArticle.date}</span>
                </div>

                {selectedArticle.image && (
                  <div className="w-full aspect-[16/9] overflow-hidden rounded-sm bg-gray-100 dark:bg-black/40">
                    <img
                      src={selectedArticle.image}
                      alt={selectedArticle.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      style={{ objectPosition: getCoverPosition(selectedArticle) }}
                    />
                  </div>
                )}

                <div className={`${ARTICLE_TEXT_CLASS} space-y-4 pt-1`}>
                  <RichContent value={selectedArticle.snippet} className="font-medium text-[1em] text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-[#252526] p-4 rounded border-l-4 border-green-600 [&_p]:my-0" />
                  {/* Isi artikel disimpan sebagai HTML (dari editor Bold/Italic/Underline/List/Link
                      di CMS), jadi dirender pakai dangerouslySetInnerHTML biar formatnya kebawa —
                      bukan cuma teks polos kayak sebelumnya. Cuma admin (password-protected) yang
                      bisa nulis ke field ini lewat CMS, jadi aman dari XSS pihak luar. Gak perlu
                      className justify/list/link manual lagi di sini — udah ikut ARTICLE_TEXT_CLASS
                      di parent-nya (text-align inherit ke bawah). */}
                  <div
                    className="min-w-0 max-w-full space-y-4 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_a]:break-all"
                    dangerouslySetInnerHTML={{ __html: selectedArticle.content }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================= MENU: DIRECTING / VIDEO WORKS ======================= */}
      {activeCategory === 'directing' && (
        <div className="space-y-6">
          {directingItems.length === 0 ? (
            <p className="text-[0.875em] text-gray-400 italic py-10 text-center">Belum ada video work yang ditambahkan.</p>
          ) : !selectedDirectingItem ? (
            <div>
              <ThreeColumnIndexListing
                items={directingItems.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage)}
                onOpen={(item) => openWork(item)}
                hintPrefix="projects-directing"
                getMeta={(item) => item.year || item.date}
                getGenre={(item) => item.type || item.category || 'Directing'}
              />
              <ProjectPager page={listPage} totalPages={Math.max(1, Math.ceil(directingItems.length / itemsPerPage))} onPageChange={setListPage} />
            </div>
          ) : (
            <article className="view-reveal space-y-6">
              {hasStudioPresentation(selectedDirectingItem) ? (
                <ProjectStudioRenderer item={selectedDirectingItem} type="Directing" onBack={goToProjectIndex} />
              ) : (() => {
                const media = getMediaEmbed(selectedDirectingItem.mediaType, selectedDirectingItem.mediaUrl);
                const directingMeta = [
                  ['TYPE', selectedDirectingItem.type || selectedDirectingItem.category || 'Film / Video'],
                  ['ROLE', selectedDirectingItem.role],
                  ['YEAR', selectedDirectingItem.year],
                  ['DURATION', selectedDirectingItem.runtime],
                  ['TOOLS', selectedDirectingItem.tools],
                ].filter(([, value]) => value);
                return (
                  <div className="space-y-7">
                    <div className="flex items-start justify-between gap-5">
                      <h1 className={`max-w-4xl ${PROJECT_DETAIL_TITLE_CLASS}`}>
                        {selectedDirectingItem.title}
                      </h1>
                      <button type="button" onClick={() => handleNativeShare(selectedDirectingItem)} className="hidden shrink-0 rounded bg-[#2B579A] px-3 py-2 font-mono text-[0.6875em] font-bold text-white sm:inline-flex">Share</button>
                    </div>

                    <div className="grid grid-cols-1 items-start gap-7 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.92fr)] md:gap-10">
                      <div className="min-w-0">
                        {(() => {
                          const ratio = selectedDirectingItem.videoRatio || 'auto';
                          const ratioClass = ratio === '9:16' ? 'aspect-[9/16] max-h-[68vh] max-w-[18rem] mx-auto' : ratio === '4:3' ? 'aspect-[4/3]' : ratio === '1:1' ? 'aspect-square' : 'aspect-video';
                          return <div className={`${ratioClass} w-full overflow-hidden rounded-md border border-gray-200 bg-black dark:border-gray-700`}>
                            {media?.kind === 'iframe' && <iframe src={media.src} title={selectedDirectingItem.title} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}
                            {media?.kind === 'video' && <video src={media.src} poster={getProjectCover(selectedDirectingItem) || undefined} controls preload="metadata" className="h-full w-full object-contain" />}
                            {(!media || media.kind === 'external') && (getProjectCover(selectedDirectingItem) ? <img src={getProjectCover(selectedDirectingItem)} alt={selectedDirectingItem.title} className="h-full w-full object-contain" style={{ objectPosition: getCoverPosition(selectedDirectingItem) }} /> : <div className="flex h-full items-center justify-center font-mono text-xs text-gray-400">PREVIEW NOT AVAILABLE</div>)}
                          </div>;
                        })()}

                        {Array.isArray(selectedDirectingItem.videoSnippets) && selectedDirectingItem.videoSnippets.some((frame) => frame?.imageUrl) && (
                          <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-2">
                            {selectedDirectingItem.videoSnippets.filter((frame) => frame?.imageUrl).map((frame, frameIndex) => (
                              <figure key={frame.id || `${frame.imageUrl}-${frameIndex}`} className="w-[31%] min-w-[7rem] shrink-0 snap-start">
                                <img src={frame.imageUrl} alt={frame.caption || `Video frame ${frameIndex + 1}`} loading="lazy" decoding="async" className="aspect-video w-full rounded object-cover" />
                                {(frame.timestamp || frame.caption) && <figcaption className="mt-1 truncate text-[0.625em] text-gray-400">{[frame.timestamp, frame.caption].filter(Boolean).join(' · ')}</figcaption>}
                              </figure>
                            ))}
                          </div>
                        )}
                      </div>

                      <aside className="min-w-0 border-t border-gray-200 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0 dark:border-gray-700">
                        {selectedDirectingItem.premise && <div className="project-rich-text text-[0.9em] leading-relaxed text-gray-600 dark:text-gray-300" dangerouslySetInnerHTML={{ __html: selectedDirectingItem.premise }} />}
                        {Array.isArray(selectedDirectingItem.tags) && selectedDirectingItem.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{selectedDirectingItem.tags.map((tag) => <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-[0.65em] text-gray-600 dark:bg-[#2d2d2d] dark:text-gray-300">{tag}</span>)}</div>}
                        <div className="mt-5 space-y-4 border-t border-gray-200 pt-5 dark:border-gray-700">
                          {directingMeta.map(([label, value]) => <div key={label}><p className="font-mono text-[0.5625em] uppercase tracking-[0.16em] text-gray-400">{label}</p><p className="mt-1 text-[0.8125em] font-semibold text-gray-800 dark:text-gray-200">{value}</p></div>)}
                          {(selectedDirectingItem.externalUrl || media?.kind === 'external') && <a href={selectedDirectingItem.externalUrl || media.src} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-between rounded bg-[#2B579A] px-3 py-2 text-[0.6875em] font-bold uppercase tracking-wide text-white">{selectedDirectingItem.externalLabel || 'Open full work'} <span>↗</span></a>}
                        </div>
                      </aside>
                    </div>

                    {(selectedDirectingItem.contribution || selectedDirectingItem.credits) && <div className="grid grid-cols-1 gap-7 border-t border-gray-200 pt-6 md:grid-cols-2 md:gap-10 dark:border-gray-700">
                      {selectedDirectingItem.contribution && <div><h2 className="text-[1.05em] font-bold text-gray-900 dark:text-white">About the Project</h2><div className={`${ARTICLE_TEXT_CLASS} mt-3`} dangerouslySetInnerHTML={{ __html: selectedDirectingItem.contribution }} /></div>}
                      {selectedDirectingItem.credits && <div><h3 className="font-mono text-[0.6875em] font-bold uppercase tracking-[0.18em]">Credits</h3><div className={`${ARTICLE_TEXT_CLASS} mt-3`} dangerouslySetInnerHTML={{ __html: selectedDirectingItem.credits }} /></div>}
                    </div>}
                  </div>
                );
              })()}
            </article>
          )}
        </div>
      )}

      {/* ======================= MENU: POSTER / VISUAL WORKS ======================= */}
      {activeCategory === 'poster' && (
        <div className="space-y-6">
          {activeGalleryItems.length === 0 ? (
            <p className="py-10 text-center text-[0.875em] italic text-gray-400">Belum ada poster yang ditambahkan.</p>
          ) : !selectedGalleryItem ? (
            <>
              {(() => {
                const pageItems = activeGalleryItems.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage);
                const baseIndex = (listPage - 1) * itemsPerPage;
                const localSpotlight = Math.min(Math.max(posterSpotlightIndex - baseIndex, 0), Math.max(pageItems.length - 1, 0));
                const featured = pageItems[localSpotlight] || pageItems[0];
                const featuredIndex = baseIndex + localSpotlight;
                if (!featured) return null;

                const moveSpotlight = (direction) => {
                  const nextIndex = (featuredIndex + direction + activeGalleryItems.length) % activeGalleryItems.length;
                  const nextPage = Math.floor(nextIndex / itemsPerPage) + 1;
                  if (nextPage !== listPage) setListPage(nextPage);
                  setPosterSpotlightIndex(nextIndex);
                };

                return (
                  <section className="mx-auto max-w-[58rem]">
                    <div className="grid items-center gap-8 md:grid-cols-[minmax(0,0.88fr)_minmax(19rem,1.12fr)] md:gap-12">
                      <div className="min-w-0 md:pr-3">
                        <div className="mb-5 h-px w-8 bg-gray-500/70 dark:bg-gray-400/70" />
                        {featured.title && <h2 className="text-[1.65em] font-bold leading-tight tracking-[-0.025em] text-gray-900 dark:text-white sm:text-[2em]">{featured.title}</h2>}
                        {featured.description && <p className="mt-4 max-w-[31rem] text-[0.875em] leading-[1.7] text-gray-600 dark:text-gray-300">{richTextToPlainText(featured.description)}</p>}

                        {activeGalleryItems.length > 1 && (
                          <div ref={posterThumbRailRef} className="mt-6 flex max-w-full gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {activeGalleryItems.map((item, idx) => {
                              const isActive = idx === featuredIndex;
                              return (
                                <button
                                  key={item.id || idx}
                                  type="button"
                                  onClick={() => {
                                    const nextPage = Math.floor(idx / itemsPerPage) + 1;
                                    if (nextPage !== listPage) setListPage(nextPage);
                                    setPosterSpotlightIndex(idx);
                                  }}
                                  data-poster-thumb-active={isActive ? 'true' : 'false'}
                                  aria-label={`Sorot ${item.title || `poster ${idx + 1}`}`}
                                  className={`group shrink-0 overflow-hidden rounded-[8px] border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] ${isActive ? 'border-[#2B579A] shadow-sm dark:border-[#6FA8DC]' : 'border-gray-200 dark:border-gray-700'}`}
                                >
                                  <img src={projectThumbnail(item.imageUrl, 360)} alt="" aria-hidden="true" loading="lazy" decoding="async" className={`block h-28 w-auto max-w-none rounded-[7px] object-contain transition ${isActive ? 'opacity-100' : 'opacity-65 group-hover:opacity-100'}`} style={{ objectPosition: item.coverPosition || item.imagePosition || item.objectPosition || '50% 50%' }} />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="relative flex min-w-0 items-center justify-center px-12">
                        <button type="button" onClick={() => moveSpotlight(-1)} aria-label="Poster sebelumnya" className="absolute left-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-[1.45em] text-gray-700 shadow-sm transition hover:-translate-x-0.5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:border-gray-700 dark:bg-[#202020]/90 dark:text-gray-200 dark:hover:bg-[#202020] dark:focus-visible:ring-[#6FA8DC]">‹</button>
                        <button type="button" onClick={() => setSelectedGalleryIndex(featuredIndex)} className="group flex w-full items-center justify-center rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC]" aria-label={`Buka ${featured.title || `poster ${featuredIndex + 1}`}`}>
                          <img src={projectThumbnail(featured.imageUrl, 1200)} alt={featured.title} loading="lazy" decoding="async" className="block max-h-[35rem] w-auto max-w-full rounded-[10px] object-contain shadow-sm transition duration-300 group-hover:scale-[1.008]" style={{ objectPosition: featured.coverPosition || featured.imagePosition || featured.objectPosition || '50% 50%' }} />
                        </button>
                        <button type="button" onClick={() => moveSpotlight(1)} aria-label="Poster berikutnya" className="absolute right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-[1.45em] text-gray-700 shadow-sm transition hover:translate-x-0.5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:border-gray-700 dark:bg-[#202020]/90 dark:text-gray-200 dark:hover:bg-[#202020] dark:focus-visible:ring-[#6FA8DC]">›</button>
                      </div>
                    </div>
                  </section>
                );
              })()}

            </>
          ) : (
            <div className="space-y-6 view-reveal">
              {hasStudioPresentation(selectedGalleryItem) ? (
                <ProjectStudioRenderer item={selectedGalleryItem} type="Poster" onBack={goToProjectIndex} />
              ) : (
                <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[1.3fr_1fr] md:gap-10">
                  <div className="flex w-full items-start justify-center overflow-hidden">
                    <img src={selectedGalleryItem.imageUrl} alt={selectedGalleryItem.title} loading="lazy" decoding="async" className="h-auto max-h-[78vh] max-w-full object-contain" />
                  </div>
                  <div className="space-y-3">
                    <h2 className={PROJECT_DETAIL_TITLE_CLASS}>{selectedGalleryItem.title}</h2>
                    {selectedGalleryItem.description && <RichContent value={selectedGalleryItem.description} className="text-[0.875em] leading-relaxed text-gray-600 dark:text-gray-300" />}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================= MENU: TAB TAMBAHAN (Custom Section) ======================= */}
      {activeCustomSection && (
        <div className="space-y-6">
          {activeCustomItems.length === 0 ? (
            <p className="text-[0.875em] text-gray-400 italic py-10 text-center">
              Belum ada item di tab ini.
            </p>
          ) : selectedCustomIndex === null ? (
            <>
              <ThreeColumnIndexListing
                items={activeCustomItems.slice((listPage - 1) * itemsPerPage, listPage * itemsPerPage)}
                onOpen={(item) => openWork(item)}
                hintPrefix="projects-custom"
                getMeta={(item) => item.date || item.year || ''}
                getGenre={(item) => item.category || activeCustomSection?.label || 'Project'}
              />
              <ProjectPager page={listPage} totalPages={Math.max(1, Math.ceil(activeCustomItems.length / itemsPerPage))} onPageChange={setListPage} />
            </>
          ) : (
            /* Detail item — dibuka pas salah satu kartu di grid diklik */
            <div className="space-y-6 view-reveal">
              {activeCustomFamily === 'audio' ? (() => {
                const item = activeCustomItems[selectedCustomIndex];
                const audioUrl = getItemAudio(item);
                return (
                  <div className="mx-auto w-full max-w-3xl border-y border-gray-200 py-8 dark:border-gray-700">
                    <p className="font-mono text-[0.625em] uppercase tracking-[0.18em] text-gray-400">Voice note</p>
                    <h2 className={`mt-3 ${PROJECT_DETAIL_TITLE_CLASS}`}>{item.title}</h2>
                    {(item.runtime || item.duration || item.date || item.year) && <p className="mt-2 font-mono text-[0.6875em] text-gray-400">{[item.runtime || item.duration, item.date || item.year].filter(Boolean).join(' · ')}</p>}
                    <div className="mt-7 rounded-xl border border-gray-200 bg-[#faf9f6] p-4 sm:p-5 dark:border-gray-700 dark:bg-[#242424]">
                      {audioUrl ? <audio src={audioUrl} controls preload="metadata" className="w-full" /> : <p className="font-mono text-[0.6875em] text-gray-400">File voice note belum tersedia.</p>}
                    </div>
                    {item.description && <RichContent value={item.description} className="mt-6 text-[0.875em] leading-relaxed text-gray-600 dark:text-gray-300" />}
                    {Array.isArray(item.cmsBlocks) && item.cmsBlocks
                      .filter((block) => block?.type === 'text' || block?.type === 'word')
                      .map((block, i) => (
                        <div
                          key={block.id || i}
                          className={`${ARTICLE_TEXT_CLASS} mt-5 min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_*]:max-w-full`}
                          dangerouslySetInnerHTML={{ __html: block.text || block.html || block.content || '' }}
                        />
                      ))}
                  </div>
                );
              })() : activeCustomFamily === 'script' ? (() => {
                const item = activeCustomItems[selectedCustomIndex];
                const scriptHtml = getCustomWritingHtml(item);

                return (
                  <article className="mx-auto w-full max-w-[46rem]">
                    <header className="mb-8 border-b border-gray-200 pb-6 text-center dark:border-gray-700">
                      {item.category && (
                        <p className="mb-3 font-mono text-[0.625em] uppercase tracking-[0.18em] text-gray-400">
                          {item.category}
                        </p>
                      )}
                      <h2 className={PROJECT_DETAIL_TITLE_CLASS}>
                        {item.title}
                      </h2>
                      {(item.author || item.writer || item.year) && (
                        <p className="mt-3 font-mono text-[0.6875em] text-gray-400">
                          {[item.author || item.writer, item.year].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </header>

                    <div className="mx-auto w-full min-w-0 max-w-[42rem] overflow-hidden px-1 py-2 sm:-translate-x-8 sm:px-4 sm:py-4 lg:-translate-x-14">
                      <style>{`
                        @media (max-width: 767px) {
                          .screenplay-public {
                            width: 100% !important;
                            max-width: 100% !important;
                            min-width: 0 !important;
                            overflow: hidden !important;
                            overflow-wrap: anywhere !important;
                            word-break: normal !important;
                            font-size: 10.5pt !important;
                            line-height: 1.55 !important;
                          }
                          .screenplay-public * {
                            box-sizing: border-box !important;
                            max-width: 100% !important;
                          }
                          .screenplay-public p,
                          .screenplay-public div,
                          .screenplay-public blockquote,
                          .screenplay-public h1,
                          .screenplay-public h2,
                          .screenplay-public h3 {
                            width: auto !important;
                            min-width: 0 !important;
                            margin-left: 0 !important;
                            margin-right: 0 !important;
                            padding-left: 0 !important;
                            padding-right: 0 !important;
                            text-indent: 0 !important;
                            white-space: normal !important;
                          }
                          .screenplay-public span {
                            max-width: 100% !important;
                            white-space: normal !important;
                          }
                        }
                      `}</style>
                      {scriptHtml ? (
                        <div
                          className="screenplay-public min-w-0 max-w-full break-words text-[12pt] leading-[1.5] text-[#222] [font-family:Georgia,serif] [overflow-wrap:anywhere] dark:text-[#ece8df] [&_p]:mb-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-7 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-7 [&_li]:mb-1 [&_h1]:mb-7 [&_h1]:text-center [&_h1]:text-[16pt] [&_h1]:font-bold [&_h2]:mb-4 [&_h2]:mt-7 [&_h2]:text-[14pt] [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[12pt] [&_h3]:font-bold [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic"
                          dangerouslySetInnerHTML={{ __html: scriptHtml }}
                        />
                      ) : (
                        <div className="font-mono text-[0.78em] leading-[1.75] text-[#222] dark:text-[#ece8df]">
                          <p className="font-bold uppercase">FADE IN:</p>
                          <p className="mt-6 font-bold uppercase">INT. SCENE — DAY</p>
                          <p className="mt-4">{richTextToPlainText(item.description) || 'Script content belum tersedia.'}</p>
                        </div>
                      )}
                    </div>

                    {item.description && scriptHtml && (
                      <RichContent value={item.description} className="mx-auto mt-6 max-w-[42rem] text-[0.75em] leading-relaxed text-gray-500 dark:text-gray-400" />
                    )}
                  </article>
                );
              })() : activeCustomFamily === 'story' ? (() => {
                const item = activeCustomItems[selectedCustomIndex];
                const cover = getProjectCover(item);
                const richBlocks = Array.isArray(item.cmsBlocks)
                  ? item.cmsBlocks.filter((block) => block?.type === 'text' || block?.type === 'word')
                  : [];
                const hasRichBlocks = richBlocks.some((block) => (block?.text || block?.html || block?.content || '').trim());
                const hasWordContent = Boolean((item.wordContent || '').trim());

                return (
                  <article className="mx-auto w-full max-w-[54rem]">
                    <div className="flow-root">
                      {cover && (
                        <figure className="mb-5 w-full sm:float-left sm:mb-4 sm:mr-8 sm:w-[42%] md:mr-10 md:w-[40%]">
                          <div className="aspect-[4/5] overflow-hidden rounded-md border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-black/40">
                            <img
                              src={projectThumbnail(cover, 960)}
                              alt={item.title}
                              loading="eager"
                              decoding="async"
                              className="h-full w-full object-cover"
                              style={{ objectPosition: getCoverPosition(item) }}
                            />
                          </div>
                        </figure>
                      )}

                      <header className={cover ? "pt-0 sm:pt-1" : ""}>
                        {item.category && (
                          <span className="mb-4 block font-mono text-[0.625em] uppercase tracking-widest text-gray-400">
                            {item.category}
                          </span>
                        )}
                        <h2 className={`mb-6 ${PROJECT_DETAIL_TITLE_CLASS}`}>
                          {item.title}
                        </h2>
                      </header>

                      <div className="min-w-0">
                        {hasRichBlocks ? (
                          richBlocks.map((block, i) => (
                            <div
                              key={block.id || i}
                              className={`${ARTICLE_TEXT_CLASS} mb-4 min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_*]:max-w-full`}
                              dangerouslySetInnerHTML={{ __html: block.text || block.html || block.content || '' }}
                            />
                          ))
                        ) : hasWordContent ? (
                          <div
                            className={`${ARTICLE_TEXT_CLASS} min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_*]:max-w-full`}
                            dangerouslySetInnerHTML={{ __html: item.wordContent }}
                          />
                        ) : item.description ? (
                          <RichContent value={item.description} className="text-[0.875em] leading-relaxed text-gray-600 dark:text-gray-300" />
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })() : (
              <div className={`grid grid-cols-1 gap-6 md:gap-10 items-start ${activeCustomType === 'writing' ? 'md:grid-cols-[minmax(15rem,0.82fr)_minmax(0,1.18fr)]' : 'md:grid-cols-[1.1fr_1fr]'}`}>
                {activeCustomType === 'video' && (() => {
                  const item = activeCustomItems[selectedCustomIndex];
                  const media = getMediaEmbed(item.mediaType, item.mediaUrl);
                  return <div className="aspect-video w-full overflow-hidden rounded-md border border-gray-200 bg-black dark:border-gray-700">{media?.kind === 'iframe' ? <iframe src={media.src} title={item.title} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : media?.kind === 'video' ? <video src={media.src} poster={getProjectCover(item) || undefined} controls preload="metadata" className="h-full w-full" /> : getProjectCover(item) ? <img src={getProjectCover(item)} alt={item.title} className="h-full w-full object-cover" style={{ objectPosition: getCoverPosition(item) }} /> : <div className="flex h-full items-center justify-center font-mono text-xs text-gray-400">VIDEO PREVIEW</div>}</div>;
                })()}
                {activeCustomType !== 'video' && getProjectCover(activeCustomItems[selectedCustomIndex]) && (
                  <div className={`w-full overflow-hidden rounded-md border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-black/40 ${activeCustomType === 'writing' ? 'aspect-[4/5] max-h-[36rem]' : 'aspect-[4/3] max-h-[70vh]'}`}>
                    <img
                      src={projectThumbnail(getProjectCover(activeCustomItems[selectedCustomIndex]), 960)}
                      alt={activeCustomItems[selectedCustomIndex].title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                      style={{ objectPosition: getCoverPosition(activeCustomItems[selectedCustomIndex]) }}
                    />
                  </div>
                )}

                <div className="space-y-3">
                  {activeCustomItems[selectedCustomIndex].category && (
                    <span className="text-[0.625em] font-mono uppercase text-gray-400 tracking-widest block">
                      {activeCustomItems[selectedCustomIndex].category}
                    </span>
                  )}
                  <h2 className={PROJECT_DETAIL_TITLE_CLASS}>
                    {activeCustomItems[selectedCustomIndex].title}
                  </h2>

                  {activeCustomType === 'video' && (activeCustomItems[selectedCustomIndex].role || activeCustomItems[selectedCustomIndex].year || activeCustomItems[selectedCustomIndex].runtime) && <p className="font-mono text-[0.6875em] text-gray-400">{[activeCustomItems[selectedCustomIndex].role, activeCustomItems[selectedCustomIndex].year, activeCustomItems[selectedCustomIndex].runtime].filter(Boolean).join(' · ')}</p>}

                  {/* Deskripsi singkat cuma ditampilin kalau item ini GAK punya tulisan
                      panjang dari Word (wordContent) — kalau ada, tulisan panjangnya yang
                      jadi konten utama (dirender full-width di bawah, lihat blok setelah
                      grid ini), biar gak dobel sama deskripsi singkat. */}
                  {(activeCustomType !== 'writing' || !activeCustomItems[selectedCustomIndex].wordContent) && (
                    <RichContent value={activeCustomItems[selectedCustomIndex].description} className="text-[0.875em] text-gray-600 dark:text-gray-300 leading-relaxed" />
                  )}

                  {(activeCustomType === 'document' ? activeCustomItems[selectedCustomIndex].fileUrl : activeCustomItems[selectedCustomIndex].url) && (
                    <a
                      href={activeCustomType === 'document' ? activeCustomItems[selectedCustomIndex].fileUrl : activeCustomItems[selectedCustomIndex].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-2 text-[0.75em] font-bold uppercase tracking-wide text-white bg-[#2B579A] dark:bg-[#6FA8DC] dark:text-[#1a1a1a] px-4 py-2 rounded-sm hover:bg-[#1e3f73] dark:hover:bg-[#5a95c9] transition-colors"
                    >
                      {activeCustomItems[selectedCustomIndex].buttonLabel || (activeCustomType === 'document' ? 'Buka Dokumen' : activeCustomType === 'video' ? 'Buka Video' : 'Lihat')} &rarr;
                    </a>
                  )}

                </div>
              </div>

              )}
              {activeCustomType === 'video' && activeCustomItems[selectedCustomIndex].credits && <div className={`${ARTICLE_CONTAINER_CLASS} ${ARTICLE_TEXT_CLASS} border-t border-gray-100 pt-5 dark:border-gray-800`} dangerouslySetInnerHTML={{ __html: activeCustomItems[selectedCustomIndex].credits }} />}

              {/* Tulisan panjang (mis. cerpen) hasil convert dari file Word yang di-upload
                  admin lewat CMS — disimpen sebagai HTML (`wordContent`), full-width di
                  bawah grid foto/judul di atas (biar keleluasaan bacanya, gak keimpit
                  kolom sempit). Cuma admin (password-protected) yang bisa nulis ke field
                  ini lewat CMS, jadi aman dari XSS pihak luar — sama kayak pola
                  dangerouslySetInnerHTML buat isi artikel di atas. */}
              {activeCustomFamily !== 'story' && activeCustomType === 'writing' && getCustomWritingHtml(activeCustomItems[selectedCustomIndex]) && (
                <div
                  className={`${ARTICLE_CONTAINER_CLASS} ${ARTICLE_TEXT_CLASS} space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800 [&_p]:mb-3`}
                  dangerouslySetInnerHTML={{ __html: getCustomWritingHtml(activeCustomItems[selectedCustomIndex]) }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================= MODAL SHARE ARTIKEL ======================= */}
      {shareArticle && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShareArticle(null)}
          role="presentation"
        >
          <div
            ref={shareModalRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#1e1e1e] rounded-xl shadow-2xl overflow-hidden view-reveal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
          >
            {/* Preview card artikel yang mau di-share */}
            <div className="relative">
              {shareArticle.image ? (
                <div className="w-full aspect-[16/9] bg-gray-100 dark:bg-black/40">
                  <img src={shareArticle.image} alt={shareArticle.title} loading="lazy" decoding="async" className="w-full h-full object-cover" style={{ objectPosition: getCoverPosition(shareArticle) }} />
                </div>
              ) : (
                <div className="w-full aspect-[16/9] bg-gradient-to-br from-[#2B579A] to-[#6FA8DC] flex items-center justify-center">
                  <svg className="w-10 h-10 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>
                </div>
              )}
              <button
                ref={shareCloseRef}
                type="button"
                onClick={() => setShareArticle(null)}
                className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                title="Tutup"
                aria-label="Tutup dialog berbagi"
              >
                ✕
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                {shareArticle.category && (
                  <span className="inline-block bg-green-600 text-white text-[0.5625em] font-bold uppercase tracking-wide px-2 py-1 mb-1.5">
                    {shareArticle.category}
                  </span>
                )}
                <h3 id="share-dialog-title" className="text-white text-[0.875em] font-bold leading-snug line-clamp-2">
                  {shareArticle.title}
                </h3>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-[0.75em] text-gray-500 dark:text-gray-400 line-clamp-2">{richTextToPlainText(shareArticle.snippet)}</p>

              {/* Tombol platform share */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  {
                    name: 'WhatsApp',
                    href: `https://wa.me/?text=${encodeURIComponent(`${shareArticle.title} — ${buildShareUrl(shareArticle)}`)}`,
                    bg: 'bg-[#25D366]',
                    icon: <path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95-.27-.1-.46-.15-.66.15-.2.3-.76.94-.93 1.14-.17.2-.34.22-.63.08-.3-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.3-.02-.46.13-.6.13-.13.3-.34.44-.5.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.9-2.19-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.48 1.7.62.71.22 1.36.19 1.87.12.57-.09 1.7-.7 1.94-1.37.24-.68.24-1.26.17-1.38-.07-.12-.27-.2-.57-.34z" />,
                  },
                  {
                    name: 'X',
                    href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareArticle.title)}&url=${encodeURIComponent(buildShareUrl(shareArticle))}`,
                    bg: 'bg-black',
                    icon: <path d="M4 4l16 16M20 4L4 20" strokeLinecap="round" />,
                  },
                  {
                    name: 'Facebook',
                    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(buildShareUrl(shareArticle))}`,
                    bg: 'bg-[#1877F2]',
                    icon: <path d="M15 4h-2a4 4 0 00-4 4v2H7v3h2v7h3v-7h2.5l.5-3H12V8a1 1 0 011-1h2z" strokeLinejoin="round" />,
                  },
                  {
                    name: 'LinkedIn',
                    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(buildShareUrl(shareArticle))}`,
                    bg: 'bg-[#0A66C2]',
                    icon: <><rect x="3" y="9" width="4" height="12" /><circle cx="5" cy="4" r="2" /><path d="M11 9v12M11 13c0-2 2-4 4-4s4 2 4 4v8" /></>,
                  },
                ].map((p) => (
                  <a
                    key={p.name}
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Share ke ${p.name}`}
                    className={`flex flex-col items-center gap-1 group`}
                  >
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform ${p.bg}`}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{p.icon}</svg>
                    </span>
                    <span className="text-[0.5625em] text-gray-500 dark:text-gray-400">{p.name}</span>
                  </a>
                ))}
              </div>

              {/* Copy link */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={buildShareUrl(shareArticle)}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 text-[0.625em] font-mono px-2.5 py-2 bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded text-gray-500 dark:text-gray-400 truncate"
                />
                <button
                  onClick={() => handleCopyLink(shareArticle)}
                  className="shrink-0 text-[0.6875em] font-semibold px-3 py-2 rounded bg-gray-800 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 transition-opacity"
                >
                  {linkCopied ? 'Disalin!' : 'Salin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Projects harus terasa seperti pindah tab dokumen, bukan halaman baru.
           Tidak ada reveal animation: tab sekarang dan tab CMS yang akan datang
           muncul langsung tanpa delay 400ms / transform repaint. */
        .view-reveal {
          animation: none;
        }
      `}</style>
    </div>
  );
}
