import { useState, useEffect, useMemo, useRef } from 'react';
import { setPageMeta } from '../lib/pageMeta';
import InteractiveText from '../components/InteractiveText';

// TEMPLATE BAKU buat semua bentuk tulisan panjang di halaman Projects (artikel biasa,
// tulisan panjang dari Word di Tab Tambahan, dan APAPUN jenis konten tulisan yang
// nanti ditambah lagi ke halaman ini). SATU sumber kebenaran, dipakai bareng-bareng —
// jangan bikin className justify/rata manual sendiri-sendiri per section, tinggal
// pasang constant ini biar otomatis seragam & gak perlu inget-inget lagi kalau nambah
// bentuk baru. Isinya: ukuran font & warna teks badan tulisan, line-height nyaman baca,
// rata kiri-kanan (justify) buat paragraf (termasuk paragraf hasil dangerouslySetInnerHTML
// dari editor CMS / convert Word), plus styling dasar buat heading/list/link di dalamnya.
const ARTICLE_TEXT_CLASS =
  'text-[0.875em] sm:text-[1em] text-gray-700 dark:text-gray-300 leading-relaxed text-justify [&_p]:text-justify [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_h1]:text-[1.25em] [&_h1]:font-bold [&_h1]:text-gray-900 dark:[&_h1]:text-white [&_h2]:text-[1.1em] [&_h2]:font-bold [&_h2]:text-gray-900 dark:[&_h2]:text-white [&_h3]:font-bold [&_blockquote]:border-l-4 [&_blockquote]:border-[#2B579A] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_a]:text-[#2B579A] dark:[&_a]:text-[#6FA8DC] [&_a]:underline [&_a]:font-medium';

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
function ArticleStyleListing({
  items,
  onOpen,
  hintPrefix,
  getImage = (item) => item.image,
  getSnippet = (item) => item.snippet,
  getMeta = (item) => item.date,
}) {
  if (!items || items.length === 0) return null;
  const featured = items[0];
  const rest = items.slice(1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-10">
      {/* Item unggulan — tampil besar di kiri */}
      <div
        onClick={() => onOpen(featured)}
        {...(featured.hintEnabled !== false ? { 'data-hint-id': `${hintPrefix}-${featured.id}` } : {})}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(featured);
          }
        }}
        className="cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616] rounded-sm"
      >
        {featured.category && (
          <span className="inline-block bg-green-600 text-white text-[0.625em] sm:text-[0.75em] font-bold uppercase tracking-wide px-3 py-1.5 mb-3">
            {featured.category}
          </span>
        )}
        {getImage(featured) && (
          <div className="w-full aspect-[16/10] overflow-hidden rounded-sm mb-4 bg-gray-100 dark:bg-black/40">
            <img
              src={projectThumbnail(getImage(featured), 1100)}
              alt={featured.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          </div>
        )}
        <h2 className="text-[1.25em] sm:text-[1.5em] lg:text-[1.875em] font-extrabold leading-snug text-gray-900 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
          {featured.title}
        </h2>
        {(featured.author || getMeta(featured)) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75em] text-gray-400 mt-3 font-mono">
            {featured.author && (
              <>
                <span>
                  OLEH{' '}
                  <span className="text-green-700 dark:text-green-400 font-semibold">
                    {featured.author.toUpperCase()}
                  </span>
                </span>
                {getMeta(featured) && <span>&middot;</span>}
              </>
            )}
            {getMeta(featured) && <span>{getMeta(featured)}</span>}
          </div>
        )}
        {getSnippet(featured) && (
          <p className="text-[0.875em] sm:text-[1em] text-gray-600 dark:text-gray-400 leading-relaxed mt-4">
            {getSnippet(featured)}
          </p>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(featured);
          }}
          className="mt-5 inline-flex items-center gap-2 text-[0.6875em] sm:text-[0.75em] font-bold uppercase tracking-wide border border-gray-300 dark:border-gray-600 px-4 py-2 rounded-sm hover:border-green-600 hover:text-green-700 dark:hover:text-green-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
        >
          Baca Selengkapnya
        </button>
      </div>

      {/* Daftar item lainnya — kecil di kanan */}
      {rest.length > 0 && (
        <div className="space-y-5 lg:border-l lg:pl-8 border-gray-100 dark:border-gray-800">
          {rest.map((item) => (
            <div
              key={item.id}
              onClick={() => onOpen(item)}
              {...(item.hintEnabled !== false ? { 'data-hint-id': `${hintPrefix}-${item.id}` } : {})}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen(item);
                }
              }}
              className="flex gap-3 cursor-pointer group items-start rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
            >
              {getImage(item) && (
                <div className="w-20 h-16 sm:w-24 sm:h-20 shrink-0 overflow-hidden rounded-sm bg-gray-100 dark:bg-black/40">
                  <img
                    src={projectThumbnail(getImage(item), 280)}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-[0.875em] font-bold leading-snug text-gray-900 dark:text-white group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors line-clamp-3">
                  {item.title}
                </h3>
                {getMeta(item) && (
                  <span className="text-[0.625em] font-mono text-gray-400 mt-1.5 inline-block">
                    {getMeta(item)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

export default function Projects({ data, initialArticleId, initialWorkTarget, navigationRequestKey, interactiveWords = [], onNavigate }) {
  const projectsData = data || {};
  const heading = projectsData.heading || 'Projects, Articles & Visuals';
  const subheading =
    projectsData.subheading ||
    'Kumpulan karya tulis artikel bergaya portal berita dan galeri poster pilihan.';
  const articles = useMemo(() => projectsData.articles || [], [projectsData.articles]);
  const directingItems = useMemo(() => projectsData.directing?.items || [], [projectsData.directing?.items]);
  const posterItems = useMemo(() => projectsData.poster?.items || [], [projectsData.poster?.items]);
  // Tab tambahan bebas (di luar Articles & Poster) — dibikin dari CMS, bisa berapa
  // aja jumlahnya, tiap tab punya nama + daftar kartu sendiri (judul, gambar,
  // kategori, deskripsi, link opsional).
  const customSections = useMemo(() => projectsData.customSections || [], [projectsData.customSections]);
  // Label tab navigasi buat Articles & Poster — bisa diganti bebas lewat CMS, kosong
  // berarti pakai nama bawaan.
  const articlesLabel = projectsData.articlesLabel || 'Articles';
  const directingLabel = projectsData.directingLabel || 'Directing';
  const posterLabel = projectsData.posterLabel || 'Poster';

  // Semua tab navigasi jadi 1 daftar: Articles & Poster bawaan, diikuti tab tambahan
  // apa pun yang ditambah lewat CMS (jumlahnya bebas, gak dibatasin cuma 2).
  const navTabs = [
    { key: 'articles', label: articlesLabel },
    { key: 'directing', label: directingLabel },
    { key: 'poster', label: posterLabel },
    ...customSections.filter((cs) => cs.label?.trim()).map((cs) => ({ key: `custom:${cs.id}`, label: cs.label.trim() })),
  ];

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
  // Item tab tambahan (custom section) yang lagi dibuka detailnya (null = masih di grid)
  const [selectedCustomIndex, setSelectedCustomIndex] = useState(null);
  // Ukuran grid masonry poster: kecil, medium, atau besar.
  const [gridDensity, setGridDensity] = useState('medium');

  // Artikel pertama di data = artikel unggulan (gaya headline Mojok), sisanya jadi
  // daftar kecil di sampingnya — logic ini sekarang ada di dalem ArticleStyleListing
  // (dipakai bareng buat tab Articles & tab tambahan ber-layout "articles"), jadi gak
  // perlu dihitung ulang manual di sini.

  const activeGalleryItems = posterItems;
  const selectedGalleryItem =
    selectedGalleryIndex !== null ? activeGalleryItems[selectedGalleryIndex] : null;
  const selectedDirectingItem = selectedDirectingIndex !== null ? directingItems[selectedDirectingIndex] : null;

  const projectSections = useMemo(() => [
    { key: 'articles', label: articlesLabel, type: 'writing', count: articles.length, image: articles[0]?.image, description: 'Articles, essays, dan tulisan panjang.' },
    { key: 'directing', label: directingLabel, type: 'video', count: directingItems.length, image: directingItems[0]?.posterImage, description: 'Film, directing work, dan moving images.' },
    { key: 'poster', label: posterLabel, type: 'image', count: posterItems.length, image: posterItems[0]?.imageUrl, description: 'Poster dan eksperimen visual.' },
    ...customSections.filter((section) => section.label?.trim()).map((section) => ({
      key: `custom:${section.id}`,
      label: section.label.trim(),
      type: section.contentType || (section.layout === 'articles' ? 'writing' : 'image'),
      count: section.items?.length || 0,
      image: section.items?.[0]?.imageUrl,
      description: section.contentType === 'video' ? 'Video collection.' : section.contentType === 'document' ? 'Documents and downloadable files.' : section.contentType === 'link' ? 'External work and selected links.' : section.contentType === 'image' ? 'Visual collection.' : 'Long-form writing collection.',
    })),
  ], [articles, articlesLabel, directingItems, directingLabel, posterItems, posterLabel, customSections]);
  const visibleProjectSections = useMemo(
    () => projectSections.filter((section) => section.count > 0),
    [projectSections]
  );

  const searchableWorks = useMemo(() => [
    ...articles.map((item, index) => ({ item, index, sectionKey: 'articles', sectionLabel: articlesLabel, type: 'writing', image: item.image })),
    ...directingItems.map((item, index) => ({ item, index, sectionKey: 'directing', sectionLabel: directingLabel, type: 'video', image: item.posterImage })),
    ...posterItems.map((item, index) => ({ item, index, sectionKey: 'poster', sectionLabel: posterLabel, type: 'image', image: item.imageUrl })),
    ...customSections.filter((section) => section.label?.trim()).flatMap((section) => (section.items || []).map((item, index) => ({ item, index, sectionKey: `custom:${section.id}`, sectionLabel: section.label.trim(), type: section.contentType || (section.layout === 'articles' ? 'writing' : 'image'), image: item.imageUrl }))),
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
    if (initialWorkTarget.type === 'directing') {
      const index = directingItems.findIndex((item) => item.id === initialWorkTarget.itemId);
      if (index >= 0) {
        setActiveCategory('directing');
        setSelectedDirectingIndex(index);
      }
    }
  }, [navigationRequestKey, initialWorkTarget, directingItems]);

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
        await navigator.share({ title: art.title, text: art.snippet, url: shareUrl });
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

  return (
    <div className="w-full text-gray-900 dark:text-gray-100 select-text py-4">

      {/* Judul Halaman */}
      <h1 className="text-[1.5em] font-bold tracking-tight mb-2 text-gray-900 dark:text-white border-b pb-2 border-gray-200 dark:border-gray-700">
        <InteractiveText text={heading} rules={interactiveWords} page="Projects" onNavigate={onNavigate} />
      </h1>
      <p className="text-[0.875em] text-gray-500 dark:text-gray-400 mb-6">
        <InteractiveText text={subheading} rules={interactiveWords} page="Projects" onNavigate={onNavigate} />
      </p>

      {/* Navigasi kategori hanya muncul setelah masuk rak. Halaman awal memakai Project Index. */}
      {activeCategory !== 'overview' && <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
        <button type="button" onClick={() => { setActiveCategory('overview'); setSelectedArticle(null); setSelectedDirectingIndex(null); setSelectedGalleryIndex(null); setSelectedCustomIndex(null); }} className="mr-1 px-3 py-2 font-mono text-[0.6875em] font-bold uppercase tracking-wide text-[#2B579A] hover:bg-[#2B579A]/10 dark:text-[#6FA8DC]">← Project Index</button>
        {navTabs.map((tab) => (
          <button
            key={tab.key}
            data-hint-id={`projects-nav-${tab.key}`}
            onClick={() => {
              setActiveCategory(tab.key);
              setSelectedArticle(null);
              setSelectedDirectingIndex(null);
              setSelectedGalleryIndex(null);
              setSelectedCustomIndex(null);
            }}
            className={`px-4 py-2 text-[0.75em] font-semibold rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616] ${
              activeCategory === tab.key
                ? 'bg-[#2B579A] dark:bg-[#6FA8DC] text-white dark:text-[#1a1a1a] shadow-sm'
                : 'bg-gray-100 dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#383838]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>}

      {activeCategory === 'overview' && (
        <section className="view-reveal">
          <div className="mb-6 grid grid-cols-1 gap-5 border-b border-gray-200 pb-6 md:grid-cols-[minmax(0,1fr)_17rem] md:items-end dark:border-gray-700">
            <div>
              <p className="font-mono text-[0.625em] uppercase tracking-[0.22em] text-[#2B579A] dark:text-[#6FA8DC]">Project Index / {String(searchableWorks.length).padStart(2, '0')} files</p>
              <h2 className="mt-2 max-w-2xl text-[1.5em] font-bold leading-tight sm:text-[1.875em]">Choose a drawer. Open a work.</h2>
              <p className="mt-2 max-w-xl text-[0.8125em] leading-relaxed text-gray-500 dark:text-gray-400">Tulisan, film, visual, dan dokumen disimpan sebagai arsip yang berbeda—bukan dipaksa terlihat sama.</p>
            </div>
            <label className="block">
              <span className="mb-1 block font-mono text-[0.5625em] uppercase tracking-widest text-gray-400">Quick find</span>
              <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 focus-within:border-[#2B579A] dark:border-gray-600 dark:bg-[#202020]">
                <span className="text-gray-400">⌕</span><input value={projectQuery} onChange={(e) => setProjectQuery(e.target.value)} placeholder="Cari judul, kategori..." className="min-w-0 flex-1 bg-transparent text-[0.75em] outline-none" />
              </div>
            </label>
          </div>

          {normalizedQuery ? (
            <div>
              <div className="mb-3 flex items-center justify-between"><p className="font-mono text-[0.625em] uppercase tracking-widest text-gray-400">Search results</p><span className="font-mono text-[0.625em] text-gray-400">{searchResults.length} found</span></div>
              {searchResults.length ? <div className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700 dark:border-gray-700">{searchResults.map((result) => <button key={`${result.sectionKey}-${result.item.id || result.index}`} type="button" onClick={() => openSearchResult(result)} className="group grid min-h-14 w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left"><div className="h-10 w-12 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">{result.image ? <img src={projectThumbnail(result.image, 160)} alt={`Pratinjau ${result.item.title || result.sectionLabel}`} loading="lazy" decoding="async" fetchPriority="low" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-mono text-[0.5625em] text-gray-500 dark:text-gray-300">{result.type.slice(0, 3).toUpperCase()}</span>}</div><div className="min-w-0"><p className="truncate text-[0.8125em] font-bold group-hover:text-[#2B579A] dark:group-hover:text-[#6FA8DC]">{result.item.title || 'Untitled'}</p><p className="font-mono text-[0.5625em] uppercase tracking-wider text-gray-500 dark:text-gray-300">{result.sectionLabel}</p></div><span className="text-gray-500 group-hover:translate-x-1 transition-transform" aria-hidden="true">→</span></button>)}</div> : <p role="status" className="py-12 text-center text-[0.8125em] italic text-gray-600 dark:text-gray-300">Tidak ada karya yang cocok.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visibleProjectSections.length === 0 && (
                <p role="status" className="col-span-full rounded-md border border-dashed border-gray-300 px-5 py-12 text-center text-[0.8125em] text-gray-500 dark:border-gray-700 dark:text-gray-300">
                  Arsip karya sedang tidak dapat dimuat. Coba muat ulang beberapa saat lagi.
                </p>
              )}
              {visibleProjectSections.map((section, index) => (
                <button key={section.key} type="button" onClick={() => setActiveCategory(section.key)} className="group relative min-h-[12rem] overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-6 text-left transition duration-300 hover:-translate-y-0.5 hover:border-[#2B579A] hover:shadow-lg focus:outline-none focus-visible:-translate-y-0.5 focus-visible:border-[#2B579A] focus-visible:ring-2 focus-visible:ring-[#2B579A] focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-[#222] dark:hover:border-[#6FA8DC] dark:focus-visible:border-[#6FA8DC] dark:focus-visible:ring-[#6FA8DC] dark:focus-visible:ring-offset-[#161616]">
                  {section.image && <img src={projectThumbnail(section.image)} alt="" aria-hidden="true" loading="lazy" decoding="async" fetchPriority="low" className="absolute inset-0 h-full w-full object-cover opacity-[0.12] grayscale transition duration-500 group-hover:scale-105 group-hover:opacity-50 group-hover:grayscale-0 group-focus-visible:scale-105 group-focus-visible:opacity-50 group-focus-visible:grayscale-0 dark:opacity-[0.14]" />}
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/90 to-white/65 transition-opacity duration-300 group-hover:opacity-55 group-focus-visible:opacity-55 dark:from-[#222]/95 dark:via-[#222]/90 dark:to-[#222]/70" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-4"><span className="font-mono text-[0.75em] font-semibold uppercase tracking-[0.16em] text-[#2B579A] dark:text-[#6FA8DC]">{String(index + 1).padStart(2, '0')} / {section.type}</span><span className="shrink-0 rounded-full border border-gray-300 bg-white/90 px-2.5 py-1 font-mono text-[0.6875em] font-medium text-gray-600 shadow-sm dark:border-gray-600 dark:bg-[#181818]/90 dark:text-gray-300">{section.count} {section.count === 1 ? 'file' : 'files'}</span></div>
                    <div className="max-w-[24rem]"><h3 className="text-[1.5em] font-bold leading-tight text-gray-950 group-hover:text-[#2B579A] dark:text-white dark:group-hover:text-[#6FA8DC]">{section.label}</h3><p className="mt-2 line-clamp-2 text-[0.875em] leading-relaxed text-gray-700 dark:text-gray-300">{section.description}</p><span className="mt-4 inline-flex items-center gap-2 font-mono text-[0.75em] font-bold uppercase tracking-wide text-gray-900 dark:text-gray-100">Open drawer <span className="transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1">→</span></span></div>
                  </div>
                </button>
              ))}
            </div>
          )}
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
              <ArticleStyleListing
                items={articles}
                onOpen={openArticle}
                hintPrefix="projects-article"
              />
            )
          ) : (
            /* Tampilan Baca Artikel Penuh (Detail View) */
            <div className="space-y-6 view-reveal">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  onClick={closeArticle}
                  className="text-[0.75em] font-semibold text-gray-600 dark:text-gray-300 hover:text-[#2B579A] dark:hover:text-[#6FA8DC] bg-gray-100 dark:bg-[#2d2d2d] px-3 py-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
                >
                  &larr; Kembali ke Daftar Artikel
                </button>

                <button
                  onClick={() => handleNativeShare(selectedArticle)}
                  className="flex items-center gap-1.5 text-[0.75em] font-semibold text-white bg-[#2B579A] dark:bg-[#6FA8DC] dark:text-[#1a1a1a] px-3.5 py-1.5 rounded shadow-sm hover:bg-[#1e3f73] dark:hover:bg-[#5a95c9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /></svg>
                  Share
                </button>
              </div>

              <div className={`${ARTICLE_CONTAINER_CLASS} space-y-4`}>
                {selectedArticle.category && (
                  <span className="inline-block bg-green-600 text-white text-[0.625em] font-bold uppercase tracking-wide px-3 py-1.5">
                    {selectedArticle.category}
                  </span>
                )}

                <h1 className="text-[1.5em] sm:text-[1.875em] font-extrabold text-gray-900 dark:text-white leading-snug">
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
                    />
                  </div>
                )}

                <div className={`${ARTICLE_TEXT_CLASS} space-y-4 pt-1`}>
                  <p className="font-medium text-[1em] text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-[#252526] p-4 rounded border-l-4 border-green-600">
                    {selectedArticle.snippet}
                  </p>
                  {/* Isi artikel disimpan sebagai HTML (dari editor Bold/Italic/Underline/List/Link
                      di CMS), jadi dirender pakai dangerouslySetInnerHTML biar formatnya kebawa —
                      bukan cuma teks polos kayak sebelumnya. Cuma admin (password-protected) yang
                      bisa nulis ke field ini lewat CMS, jadi aman dari XSS pihak luar. Gak perlu
                      className justify/list/link manual lagi di sini — udah ikut ARTICLE_TEXT_CLASS
                      di parent-nya (text-align inherit ke bawah). */}
                  <div
                    className="space-y-4"
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
              <div className="mb-6 flex items-end justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                <div>
                  <p className="font-mono text-[0.625em] uppercase tracking-[0.22em] text-[#2B579A] dark:text-[#6FA8DC]">Selected motion work</p>
                  <h2 className="mt-1 text-[1.25em] font-bold">Directing desk</h2>
                </div>
                <span className="font-mono text-[0.625em] text-gray-400">{String(directingItems.length).padStart(2, '0')} FILM{directingItems.length === 1 ? '' : 'S'}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                {directingItems.map((item, index) => (
                  <button key={item.id || index} type="button" onClick={() => setSelectedDirectingIndex(index)} {...(item.hintEnabled !== false ? { 'data-hint-id': `projects-directing-${item.id || index}` } : {})} className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] rounded-sm">
                    <div className="relative aspect-video overflow-hidden rounded-sm border border-gray-200 bg-gray-950 dark:border-gray-700">
                      {item.posterImage ? <img src={projectThumbnail(item.posterImage, 720)} alt={`Poster ${item.title || 'video work'}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025] group-hover:opacity-75" loading="lazy" decoding="async" fetchPriority="low" /> : <div className="h-full w-full bg-gradient-to-br from-[#2B579A] to-[#101827]" />}
                      <span className="absolute inset-0 flex items-center justify-center"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-black/35 text-lg text-white backdrop-blur-sm transition group-hover:scale-110">▶</span></span>
                      {(item.runtime || item.year) && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 font-mono text-[0.5625em] text-white">{[item.year, item.runtime].filter(Boolean).join(' · ')}</span>}
                    </div>
                    <p className="mt-3 font-mono text-[0.625em] uppercase tracking-[0.18em] text-gray-400">{item.role || 'Directing'}</p>
                    <h3 className="mt-1 text-[1.1em] font-bold leading-tight group-hover:text-[#2B579A] dark:group-hover:text-[#6FA8DC]">{item.title}</h3>
                    {item.premise && <p className="mt-2 text-[0.8125em] leading-relaxed text-gray-500 dark:text-gray-400 line-clamp-2">{item.premise}</p>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <article className="view-reveal space-y-6">
              <button type="button" onClick={() => setSelectedDirectingIndex(null)} className="rounded bg-gray-100 px-3 py-1.5 text-[0.75em] font-semibold text-gray-600 hover:text-[#2B579A] dark:bg-[#2d2d2d] dark:text-gray-300">&larr; Kembali ke Directing</button>
              {(() => {
                const media = getMediaEmbed(selectedDirectingItem.mediaType, selectedDirectingItem.mediaUrl);
                return (
                  <>
                    <div className="aspect-video w-full overflow-hidden rounded-md border border-gray-200 bg-black dark:border-gray-700">
                      {media?.kind === 'iframe' && <iframe src={media.src} title={selectedDirectingItem.title} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />}
                      {media?.kind === 'video' && <video src={media.src} poster={selectedDirectingItem.posterImage || undefined} controls preload="metadata" className="h-full w-full" />}
                      {(!media || media.kind === 'external') && (selectedDirectingItem.posterImage ? <img src={selectedDirectingItem.posterImage} alt={selectedDirectingItem.title} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center font-mono text-xs text-gray-400">PREVIEW NOT AVAILABLE</div>)}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_13rem] gap-7 md:gap-10">
                      <div>
                        <p className="font-mono text-[0.625em] uppercase tracking-[0.2em] text-[#2B579A] dark:text-[#6FA8DC]">{selectedDirectingItem.role || 'Directing work'}</p>
                        <h2 className="mt-2 text-[1.75em] font-bold leading-tight">{selectedDirectingItem.title}</h2>
                        {selectedDirectingItem.premise && <p className="mt-4 text-[1em] leading-relaxed text-gray-600 dark:text-gray-300">{selectedDirectingItem.premise}</p>}
                        {selectedDirectingItem.contribution && <div className={`${ARTICLE_TEXT_CLASS} mt-6 border-t border-gray-200 pt-5 dark:border-gray-700`} dangerouslySetInnerHTML={{ __html: selectedDirectingItem.contribution }} />}
                        {selectedDirectingItem.credits && <><h3 className="mt-7 font-mono text-[0.6875em] font-bold uppercase tracking-[0.18em]">Credits</h3><div className={`${ARTICLE_TEXT_CLASS} mt-3`} dangerouslySetInnerHTML={{ __html: selectedDirectingItem.credits }} /></>}
                      </div>
                      <aside className="space-y-4 border-t border-gray-200 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0 dark:border-gray-700">
                        {[['Role', selectedDirectingItem.role], ['Year', selectedDirectingItem.year], ['Runtime', selectedDirectingItem.runtime]].filter(([, value]) => value).map(([label, value]) => <div key={label}><p className="font-mono text-[0.5625em] uppercase tracking-widest text-gray-400">{label}</p><p className="mt-1 text-[0.8125em] font-semibold">{value}</p></div>)}
                        {(selectedDirectingItem.externalUrl || media?.kind === 'external') && <a href={selectedDirectingItem.externalUrl || media.src} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-between rounded bg-[#2B579A] px-3 py-2 text-[0.6875em] font-bold uppercase tracking-wide text-white">{selectedDirectingItem.externalLabel || 'Open full work'} <span>↗</span></a>}
                      </aside>
                    </div>
                  </>
                );
              })()}
            </article>
          )}
        </div>
      )}

      {/* ======================= MENU: POSTER (daftar file langsung, tanpa Sub Bab) ======================= */}
      {activeCategory === 'poster' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-end flex-wrap gap-3 mb-4">
                {activeGalleryItems.length > 0 && !selectedGalleryItem && (
                  <div className="flex items-center gap-1 text-[0.6875em] font-mono text-gray-400">
                    <span className="hidden sm:inline mr-1">Ukuran:</span>
                    {[
                      { key: 'small', label: 'Small' },
                      { key: 'medium', label: 'Medium' },
                      { key: 'large', label: 'Large' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setGridDensity(opt.key)}
                        className={`px-2.5 py-1 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616] ${
                          gridDensity === opt.key
                            ? 'bg-[#2B579A] dark:bg-[#6FA8DC] text-white dark:text-[#1a1a1a] border-[#2B579A] dark:border-[#6FA8DC]'
                            : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
            </div>

              {activeGalleryItems.length === 0 ? (
                <p className="text-[0.875em] text-gray-400 italic py-10 text-center">
                  Belum ada poster yang ditambahkan.
                </p>
              ) : !selectedGalleryItem ? (
                /* Masonry ala Pinterest — tinggi kartu ngikutin rasio gambar asli,
                   bukan dipaksa seragam, jadi susunannya berantakan alami */
                <div
                  className={`gap-4 sm:gap-5 ${
                    gridDensity === 'large'
                      ? 'columns-1 sm:columns-2'
                      : gridDensity === 'small'
                        ? 'columns-2 sm:columns-3 lg:columns-4'
                        : 'columns-1 sm:columns-2 lg:columns-3'
                  }`}
                >
                  {activeGalleryItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      onClick={() => setSelectedGalleryIndex(idx)}
                      {...(item.hintEnabled !== false ? { 'data-hint-id': `projects-gallery-${item.id || idx}` } : {})}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedGalleryIndex(idx);
                        }
                      }}
                      className="mb-4 sm:mb-5 break-inside-avoid cursor-pointer group rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
                    >
                      <div className="relative overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black/40">
                        <img
                          src={projectThumbnail(item.imageUrl, 640)}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          className="w-full h-auto block group-hover:scale-105 transition-transform duration-300"
                        />
                        {item.dimensions && (
                          <span className="absolute top-2 left-2 text-[0.5625em] font-mono uppercase bg-white/90 dark:bg-black/70 text-gray-700 dark:text-gray-200 px-1.5 py-0.5 rounded">
                            {item.dimensions}
                          </span>
                        )}
                        {/* Overlay judul pas di-hover, khas kartu Pinterest */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                          <h3 className="text-white text-[0.875em] font-semibold leading-snug line-clamp-2">
                            {item.title}
                          </h3>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Detail — dibuka pas salah satu kartu di grid diklik */
                <div className="space-y-6 view-reveal">
                  <button
                    onClick={() => setSelectedGalleryIndex(null)}
                    className="text-[0.75em] font-semibold text-gray-600 dark:text-gray-300 hover:text-[#2B579A] dark:hover:text-[#6FA8DC] bg-gray-100 dark:bg-[#2d2d2d] px-3 py-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
                  >
                    &larr; Kembali ke Poster
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6 md:gap-10 items-start">
                    <div className="w-full rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black/40 flex items-center justify-center">
                      <img
                        src={selectedGalleryItem.imageUrl}
                        alt={selectedGalleryItem.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto max-h-[78vh] object-contain"
                      />
                    </div>

                    <div className="space-y-3">
                      {selectedGalleryItem.dimensions && (
                        <span className="text-[0.625em] font-mono uppercase bg-[#2B579A]/10 dark:bg-[#6FA8DC]/15 text-[#2B579A] dark:text-[#6FA8DC] px-2 py-0.5 rounded border border-[#2B579A]/30 dark:border-[#6FA8DC]/30 inline-block">
                          {selectedGalleryItem.dimensions}
                        </span>
                      )}
                      {selectedGalleryItem.category && (
                        <span className="text-[0.625em] font-mono uppercase text-gray-400 tracking-widest block">
                          {selectedGalleryItem.category}
                        </span>
                      )}

                      <h2 className="text-[1.25em] sm:text-[1.5em] font-bold text-gray-900 dark:text-white">
                        {selectedGalleryItem.title}
                      </h2>

                      <p className="text-[0.875em] text-gray-600 dark:text-gray-300 leading-relaxed">
                        {selectedGalleryItem.description}
                      </p>

                      {activeGalleryItems.length > 1 && (
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                          <span className="text-[0.75em] font-mono text-gray-400">
                            Poster {selectedGalleryIndex + 1} dari {activeGalleryItems.length}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={prevGalleryItem}
                              className="px-3 py-1.5 bg-gray-100 dark:bg-[#2d2d2d] hover:bg-gray-200 dark:hover:bg-[#383838] text-[0.75em] font-semibold rounded text-gray-800 dark:text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
                            >
                              &larr; Prev
                            </button>
                            <button
                              onClick={nextGalleryItem}
                              className="px-3 py-1.5 bg-[#2B579A] hover:bg-[#1e3f73] dark:bg-[#6FA8DC] dark:hover:bg-[#5a95c9] text-[0.75em] font-semibold rounded text-white dark:text-[#1a1a1a] shadow transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
                            >
                              Next &rarr;
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
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
            activeCustomType === 'writing' ? (
              /* Layout "Tulisan (seperti Articles)" — dipilih admin lewat CMS buat tab
                 tambahan yang konteksnya tulisan (esai, cerpen, dll), biar tampilannya
                 SERAGAM sama tab Articles bawaan — satu komponen bareng, bukan niru-niru
                 manual. imageUrl/description item custom disamain ke image/snippet
                 lewat getImage/getSnippet biar kompatibel sama ArticleStyleListing. */
              <ArticleStyleListing
                items={activeCustomItems}
                onOpen={(item) => setSelectedCustomIndex(activeCustomItems.indexOf(item))}
                hintPrefix="projects-custom"
                getImage={(item) => item.imageUrl}
                getSnippet={(item) => item.description}
                getMeta={() => null}
              />
            ) : (
            /* Grid kartu — gambar (kalau ada), judul, kategori */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {activeCustomItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  onClick={() => setSelectedCustomIndex(idx)}
                  {...(item.hintEnabled !== false ? { 'data-hint-id': `projects-custom-${item.id || idx}` } : {})}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCustomIndex(idx);
                    }
                  }}
                  className="cursor-pointer group rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
                >
                  <div className={`relative ${activeCustomType === 'video' ? 'aspect-video' : 'aspect-[4/3]'} overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black/40`}>
                    {activeCustomType === 'writing' && item.wordContent && (
                      <span
                        title="Ada tulisan panjang"
                        className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-[#2B579A] dark:bg-[#6FA8DC] text-white dark:text-[#1a1a1a] flex items-center justify-center text-[0.625em] shadow"
                      >
                        📄
                      </span>
                    )}
                    {item.imageUrl ? (
                      <img
                        src={projectThumbnail(item.imageUrl, 640)}
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-mono text-[0.6875em] uppercase tracking-widest text-gray-400">{activeCustomType === 'video' ? '▶ Video' : activeCustomType === 'document' ? '▤ Document' : activeCustomType === 'link' ? '↗ Link' : 'Image'}</span>
                      </div>
                    )}
                    {activeCustomType === 'video' && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white">▶</span></span>}
                  </div>
                  <div className="pt-2">
                    {item.category && (
                      <span className="text-[0.625em] font-mono uppercase text-gray-400 tracking-wide block mb-0.5">
                        {item.category}
                      </span>
                    )}
                    <h3 className="text-[0.8125em] font-bold leading-snug text-gray-900 dark:text-white group-hover:text-[#2B579A] dark:group-hover:text-[#6FA8DC] transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
            )
          ) : (
            /* Detail item — dibuka pas salah satu kartu di grid diklik */
            <div className="space-y-6 view-reveal">
              <button
                onClick={() => setSelectedCustomIndex(null)}
                className="text-[0.75em] font-semibold text-gray-600 dark:text-gray-300 hover:text-[#2B579A] dark:hover:text-[#6FA8DC] bg-gray-100 dark:bg-[#2d2d2d] px-3 py-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:focus-visible:ring-[#6FA8DC] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#161616]"
              >
                &larr; Kembali
              </button>

              <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-6 md:gap-10 items-start">
                {activeCustomType === 'video' && (() => {
                  const item = activeCustomItems[selectedCustomIndex];
                  const media = getMediaEmbed(item.mediaType, item.mediaUrl);
                  return <div className="aspect-video w-full overflow-hidden rounded-md border border-gray-200 bg-black dark:border-gray-700">{media?.kind === 'iframe' ? <iframe src={media.src} title={item.title} className="h-full w-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : media?.kind === 'video' ? <video src={media.src} poster={item.imageUrl || undefined} controls preload="metadata" className="h-full w-full" /> : item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center font-mono text-xs text-gray-400">VIDEO PREVIEW</div>}</div>;
                })()}
                {activeCustomType !== 'video' && activeCustomItems[selectedCustomIndex].imageUrl && (
                  <div className="w-full rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black/40 flex items-center justify-center">
                    <img
                      src={activeCustomItems[selectedCustomIndex].imageUrl}
                      alt={activeCustomItems[selectedCustomIndex].title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-auto max-h-[70vh] object-contain"
                    />
                  </div>
                )}

                <div className="space-y-3">
                  {activeCustomItems[selectedCustomIndex].category && (
                    <span className="text-[0.625em] font-mono uppercase text-gray-400 tracking-widest block">
                      {activeCustomItems[selectedCustomIndex].category}
                    </span>
                  )}
                  <h2 className="text-[1.25em] sm:text-[1.5em] font-bold text-gray-900 dark:text-white">
                    {activeCustomItems[selectedCustomIndex].title}
                  </h2>

                  {activeCustomType === 'video' && (activeCustomItems[selectedCustomIndex].role || activeCustomItems[selectedCustomIndex].year || activeCustomItems[selectedCustomIndex].runtime) && <p className="font-mono text-[0.6875em] text-gray-400">{[activeCustomItems[selectedCustomIndex].role, activeCustomItems[selectedCustomIndex].year, activeCustomItems[selectedCustomIndex].runtime].filter(Boolean).join(' · ')}</p>}

                  {/* Deskripsi singkat cuma ditampilin kalau item ini GAK punya tulisan
                      panjang dari Word (wordContent) — kalau ada, tulisan panjangnya yang
                      jadi konten utama (dirender full-width di bawah, lihat blok setelah
                      grid ini), biar gak dobel sama deskripsi singkat. */}
                  {(activeCustomType !== 'writing' || !activeCustomItems[selectedCustomIndex].wordContent) && (
                    <p className="text-[0.875em] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {activeCustomItems[selectedCustomIndex].description}
                    </p>
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

              {activeCustomType === 'video' && activeCustomItems[selectedCustomIndex].credits && <div className={`${ARTICLE_CONTAINER_CLASS} ${ARTICLE_TEXT_CLASS} border-t border-gray-100 pt-5 dark:border-gray-800`} dangerouslySetInnerHTML={{ __html: activeCustomItems[selectedCustomIndex].credits }} />}

              {/* Tulisan panjang (mis. cerpen) hasil convert dari file Word yang di-upload
                  admin lewat CMS — disimpen sebagai HTML (`wordContent`), full-width di
                  bawah grid foto/judul di atas (biar keleluasaan bacanya, gak keimpit
                  kolom sempit). Cuma admin (password-protected) yang bisa nulis ke field
                  ini lewat CMS, jadi aman dari XSS pihak luar — sama kayak pola
                  dangerouslySetInnerHTML buat isi artikel di atas. */}
              {activeCustomType === 'writing' && activeCustomItems[selectedCustomIndex].wordContent && (
                <div
                  className={`${ARTICLE_CONTAINER_CLASS} ${ARTICLE_TEXT_CLASS} space-y-4 pt-2 border-t border-gray-100 dark:border-gray-800 [&_p]:mb-3`}
                  dangerouslySetInnerHTML={{ __html: activeCustomItems[selectedCustomIndex].wordContent }}
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
                  <img src={shareArticle.image} alt={shareArticle.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
              <p className="text-[0.75em] text-gray-500 dark:text-gray-400 line-clamp-2">{shareArticle.snippet}</p>

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
        @keyframes viewReveal {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .view-reveal {
          animation: viewReveal 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .view-reveal { animation: none; }
        }
      `}</style>
    </div>
  );
}
