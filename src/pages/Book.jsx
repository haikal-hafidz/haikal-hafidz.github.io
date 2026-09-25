import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import InteractiveText from '../components/InteractiveText';

const STATUS_STYLE = {
  published: { label: 'Published', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800' },
  writing: { label: 'In progress', className: 'bg-blue-50 text-[#2B579A] border-blue-200 dark:bg-blue-950/30 dark:text-[#6FA8DC] dark:border-blue-800' },
  draft: { label: 'Draft', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' },
};

function bookThumb(url, width = 520) {
  if (!url || !url.includes('/storage/v1/object/public/')) return url;
  const resized = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  // Cover buku tidak boleh dipotong. Supabase juga harus memakai `contain`, bukan
  // cuma CSS object-contain, supaya file hasil transformasinya sendiri tetap utuh.
  return `${resized}${resized.includes('?') ? '&' : '?'}width=${width}&quality=76&resize=contain`;
}

function StatusBadge({ status }) {
  const meta = STATUS_STYLE[status] || STATUS_STYLE.published;
  return <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[0.5625em] font-bold uppercase tracking-[0.16em] ${meta.className}`}>{meta.label}</span>;
}

function parseRoles(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '').split(',').map((role) => role.trim()).filter(Boolean);
}

function BookCover({ book, size = 'hero', priority = false, decorative = false }) {
  const dimensions = {
    hero: 'max-h-[25rem] max-w-full',
    detail: 'max-h-[24rem] max-w-full',
    shelf: 'h-48 max-w-[9.5rem]',
  };
  const fallbackDimensions = size === 'shelf' ? 'h-48 w-36' : 'aspect-[3/4] w-full max-w-[14rem]';

  if (!book?.coverImage) {
    return <div className={`flex items-center justify-center border border-gray-200 bg-white px-5 text-center font-mono text-[0.625em] text-gray-400 shadow-xl dark:border-gray-700 dark:bg-[#181818] ${fallbackDimensions}`}>COVER IN REVISION</div>;
  }

  return (
    <img
      src={bookThumb(book.coverImage, size === 'shelf' ? 360 : 900)}
      alt={decorative ? '' : `Sampul ${book.title}`}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      className={`block h-auto w-auto rounded-sm border border-gray-200 bg-white object-contain shadow-xl dark:border-gray-700 dark:bg-[#181818] ${dimensions[size]}`}
    />
  );
}

export default function Book({ data, interactiveWords = [], onNavigate, initialBookId, navigationRequestKey, railStyle = null, isMobileLayout = false }) {
  const bookData = data || {};
  const heading = bookData.heading ?? '';
  const subheading = bookData.subheading ?? '';
  const items = useMemo(() => (Array.isArray(bookData.items) ? bookData.items : []), [bookData.items]);
  const [selectedId, setSelectedId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const coverSwipeStart = useRef(null);
  const coverDidSwipe = useRef(false);

  const currentBook = useMemo(
    () => items.find((item) => item.featured) || items.find((item) => item.status === 'writing') || items[0],
    [items]
  );
  const startHereBook = useMemo(
    () => items.find((item) => item.startHere) || items.find((item) => item.status === 'published') || items[0],
    [items]
  );
  const selectedBook = items.find((item) => item.id === selectedId) || currentBook;
  const detailBook = items.find((item) => item.id === detailId) || null;

  useEffect(() => {
    if (!initialBookId || !navigationRequestKey) return;
    const target = items.find((item) => item.id === initialBookId);
    if (target) {
      setSelectedId(target.id);
      setDetailId(target.id);
    }
  }, [initialBookId, navigationRequestKey, items]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDetailId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!items.length) {
    return <div className="py-14 text-center text-gray-900 dark:text-gray-100"><h1 className="text-[1.5em] font-bold"><InteractiveText text={heading} rules={interactiveWords} page="Book" onNavigate={onNavigate} /></h1><p className="mt-3 text-[0.875em] italic text-gray-400">Belum ada publikasi.</p></div>;
  }

  if (detailBook) {
    const status = detailBook.status || 'published';
    const detailRoles = parseRoles(detailBook.myRoles);
    return (
      <article className="view-reveal w-full py-3 text-gray-900 dark:text-gray-100">
        <button type="button" onClick={() => setDetailId(null)} className="mb-6 inline-flex items-center gap-2 rounded font-mono text-[0.6875em] font-bold uppercase tracking-wider text-gray-500 hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:text-gray-400 dark:hover:text-[#6FA8DC]">← Publications</button>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[16rem_minmax(0,1fr)] md:items-start md:gap-10">
          <div>
            <div className="mx-auto flex max-w-[14rem] justify-center">
              <BookCover book={detailBook} size="detail" priority />
            </div>
            {(detailBook.progress || status === 'writing' || status === 'draft') && <div className="mx-auto mt-5 max-w-[14rem]"><div className="mb-1.5 flex justify-between font-mono text-[0.5625em] uppercase tracking-wider text-gray-400"><span>Manuscript progress</span><span>{Math.max(0, Math.min(100, Number(detailBook.progress) || 0))}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className="h-full bg-[#2B579A] dark:bg-[#6FA8DC]" style={{ width: `${Math.max(0, Math.min(100, Number(detailBook.progress) || 0))}%` }} /></div></div>}
            {detailBook.overviewImage && <figure className="mx-auto mt-7 w-fit max-w-full border-t border-gray-200 pt-5 dark:border-gray-700"><p className="mb-3 font-mono text-[0.5625em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#6FA8DC]">Selected page</p><img src={bookThumb(detailBook.overviewImage, 900)} alt={`Preview ${detailBook.title}`} loading="lazy" decoding="async" className="block h-auto max-h-[25rem] max-w-full rounded-sm border border-gray-200 bg-white object-contain shadow-lg dark:border-gray-700 dark:bg-[#181818]" /><figcaption className="mt-2 font-mono text-[0.5em] uppercase tracking-[0.14em] text-gray-400">Excerpt preview</figcaption></figure>}
          </div>

          <div className="min-w-0">
            <p className="font-mono text-[0.625em] uppercase tracking-[0.22em] text-[#2B579A] dark:text-[#6FA8DC]">Publication dossier</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge status={status} />{detailBook.category && <span className="font-mono text-[0.625em] uppercase tracking-widest text-gray-400">{detailBook.category}</span>}</div>
            <h1 className="mt-4 max-w-2xl text-[1.875em] font-semibold leading-[1.08] tracking-tight sm:text-[2.35em]">{detailBook.title}</h1>
            {detailBook.author && <p className="mt-2 text-[0.875em] text-gray-500 dark:text-gray-400">written by <span className="font-semibold text-gray-800 dark:text-gray-100">{detailBook.author}</span></p>}
            {detailBook.pitch && <p className="mt-4 max-w-2xl text-[1em] leading-relaxed text-gray-600 dark:text-gray-300">{detailBook.pitch}</p>}

            <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-gray-200 py-5 sm:grid-cols-3 dark:border-gray-700">
              {[
                ['Publisher', detailBook.publisher],
                ['My role', detailRoles.join(' · ')],
                ['Published', detailBook.publicationDate || detailBook.year],
                ['Genre', detailBook.category],
                ['Format', detailBook.format],
                ['Language', detailBook.language],
                ['Length', detailBook.pageCount ? `${detailBook.pageCount} pages` : ''],
                ['Edition', detailBook.edition],
                ['ISBN', detailBook.isbn],
              ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="font-mono text-[0.5625em] uppercase tracking-widest text-gray-400">{label}</dt><dd className="mt-1 text-[0.75em] font-semibold">{value}</dd></div>)}
            </dl>

            <div className="mt-6 space-y-6">
              <section><h2 className="font-mono text-[0.625em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#6FA8DC]">About this work</h2><p className="mt-3 max-w-2xl text-[0.875em] leading-[1.75] text-gray-600 dark:text-gray-300">{detailBook.fullDescription || detailBook.summary}</p></section>
              {detailBook.whyWritten && <section className="border-l-2 border-[#2B579A]/30 pl-4 dark:border-[#6FA8DC]/30"><h2 className="font-mono text-[0.625em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#6FA8DC]">Why I wrote this</h2><p className="mt-2 max-w-2xl text-[0.875em] italic leading-[1.75] text-gray-600 dark:text-gray-300">{detailBook.whyWritten}</p></section>}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              {detailBook.actionUrl && <a href={detailBook.actionUrl} target="_blank" rel="noopener noreferrer" {...(detailBook.hintEnabled !== false ? { 'data-hint-id': `book-action-${detailBook.id}` } : {})} className="rounded-sm bg-[#2B579A] px-4 py-2.5 font-mono text-[0.6875em] font-bold uppercase tracking-wider text-white hover:bg-[#1e3f73] dark:bg-[#6FA8DC] dark:text-[#171717]">{detailBook.actionText || 'Open document'} ↗</a>}
              {detailBook.secondaryUrl && <a href={detailBook.secondaryUrl} target="_blank" rel="noopener noreferrer" className="rounded-sm border border-gray-300 px-4 py-2.5 font-mono text-[0.6875em] font-bold uppercase tracking-wider hover:border-[#2B579A] hover:text-[#2B579A] dark:border-gray-600 dark:hover:border-[#6FA8DC] dark:hover:text-[#6FA8DC]">{detailBook.secondaryText || 'More information'} ↗</a>}
            </div>
          </div>
        </div>
      </article>
    );
  }

  const selectedStatus = selectedBook?.status || 'published';
  const selectedRoles = parseRoles(selectedBook?.myRoles);
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === selectedBook.id));
  const loosePageText = String(
    selectedBook?.fullDescription ||
    selectedBook?.summary ||
    selectedBook?.whyWritten ||
    selectedBook?.pitch ||
    ''
  ).trim();
  const loosePageExcerpt = loosePageText.length > 260 ? `${loosePageText.slice(0, 257).trimEnd()}…` : loosePageText;
  const loosePage = loosePageExcerpt ? (
    <button
      type="button"
      onClick={() => setDetailId(selectedBook.id)}
      className="group block w-full rotate-[-1deg] border border-gray-300 bg-[#fffef8] p-5 text-left shadow-lg transition hover:-translate-y-1 hover:rotate-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:border-gray-700 dark:bg-[#252522]"
      aria-label={`Peek inside ${selectedBook.title}`}
    >
      <p className="font-mono text-[0.5625em] font-bold uppercase tracking-[0.2em] text-gray-400">Loose page · Peek inside</p>
      <p className="mt-4 font-serif text-[0.8125em] leading-[1.7] text-gray-700 dark:text-gray-300">“{loosePageExcerpt}”</p>
      <span className="mt-5 inline-block font-mono text-[0.5625em] font-bold uppercase tracking-[0.16em] text-[#2B579A] group-hover:underline dark:text-[#6FA8DC]">Open document →</span>
    </button>
  ) : null;
  const selectRelativeBook = (offset) => {
    if (items.length < 2) return;
    const nextIndex = (selectedIndex + offset + items.length) % items.length;
    setSelectedId(items[nextIndex].id);
  };
  const autopsyNotes = [
    { label: 'Origin', value: selectedBook.origin || selectedBook.whyWritten || selectedBook.summary, position: 'md:col-start-1 md:row-start-1 md:self-end md:text-right' },
    { label: 'Core question', value: selectedBook.coreQuestion || selectedBook.pitch, position: 'md:col-start-3 md:row-start-1 md:self-end' },
    { label: 'Written during', value: selectedBook.writtenDuring || selectedBook.publicationDate || selectedBook.year, position: 'md:col-start-1 md:row-start-2 md:self-start md:text-right' },
    { label: 'Almost deleted', value: selectedBook.almostDeleted, position: 'md:col-start-3 md:row-start-2 md:self-start' },
  ].filter((note) => note.value).slice(0, 4);
  return (
    <div className="view-reveal w-full py-3 text-gray-900 dark:text-gray-100">
      {(heading || subheading) && <header className="border-b border-gray-200 pb-5 dark:border-gray-700">
        {heading && <h1 className="text-[1.75em] font-semibold tracking-tight sm:text-[2.2em]"><InteractiveText text={heading} rules={interactiveWords} page="Book" onNavigate={onNavigate} /></h1>}
        {subheading && <p className="mt-2 max-w-2xl text-[0.8125em] leading-relaxed text-gray-500 dark:text-gray-400"><InteractiveText text={subheading} rules={interactiveWords} page="Book" onNavigate={onNavigate} /></p>}
      </header>}

      <section className="py-8" aria-label="Book autopsy">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3"><StatusBadge status={selectedStatus} />{items.length > 1 && <div className="flex items-center overflow-hidden rounded border border-gray-200 dark:border-gray-700"><button type="button" onClick={() => selectRelativeBook(-1)} aria-label="Buku sebelumnya" className="px-2.5 py-1.5 font-mono text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">←</button><span className="border-x border-gray-200 px-2.5 py-1.5 font-mono text-[0.5625em] tracking-wider text-gray-400 dark:border-gray-700">{String(selectedIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span><button type="button" onClick={() => selectRelativeBook(1)} aria-label="Buku berikutnya" className="px-2.5 py-1.5 font-mono text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">→</button></div>}</div>

        <div className="grid grid-cols-1 gap-7 md:grid-cols-[minmax(0,1fr)_15rem_minmax(0,1fr)] md:grid-rows-2 md:gap-x-8 md:gap-y-10">
          <div className="mx-auto w-full max-w-[15rem] md:col-start-2 md:row-span-2 md:row-start-1 md:self-center">
          <button type="button" onClick={() => { if (coverDidSwipe.current) { coverDidSwipe.current = false; return; } setDetailId(selectedBook.id); }} onPointerDown={(event) => { coverSwipeStart.current = event.clientX; coverDidSwipe.current = false; }} onPointerUp={(event) => { if (coverSwipeStart.current === null) return; const distance = event.clientX - coverSwipeStart.current; coverSwipeStart.current = null; if (Math.abs(distance) > 42 && items.length > 1) { coverDidSwipe.current = true; selectRelativeBook(distance < 0 ? 1 : -1); } }} onPointerCancel={() => { coverSwipeStart.current = null; coverDidSwipe.current = false; }} {...(selectedBook.hintEnabled !== false ? { 'data-hint-id': 'book-open-active' } : {})} className="group relative block w-full touch-pan-y text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A]">
            <div className="absolute -bottom-4 left-[8%] h-6 w-[84%] rounded-full bg-black/20 blur-xl dark:bg-black/50" />
            <div className="relative flex justify-center transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-1deg]"><BookCover book={selectedBook} size="hero" priority /></div>
          </button>
          {items.length > 1 && <div className="mt-5"><div className="flex items-center justify-center gap-0.5" aria-label="Pilih buku">{items.map((book, index) => <button key={book.id} type="button" onClick={() => setSelectedId(book.id)} aria-label={`Pilih ${book.title}`} aria-pressed={index === selectedIndex} title={book.title} className="grid h-11 min-w-11 place-items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A]"><span aria-hidden="true" className={`h-2 rounded-full transition-all ${index === selectedIndex ? 'w-7 bg-[#2B579A] dark:bg-[#6FA8DC]' : 'w-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'}`} /></button>)}</div><p className="text-center font-mono text-[0.5em] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-300">Swipe cover · {selectedIndex + 1} of {items.length}</p></div>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:contents">
            {autopsyNotes.map((note, index) => <article key={note.label} className={`relative rounded-md border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-[#202020]/70 ${note.position}`}><span aria-hidden="true" className={`absolute top-1/2 hidden h-px w-8 bg-gray-300 md:block dark:bg-gray-700 ${index % 2 === 0 ? '-right-8' : '-left-8'}`} /><p className="font-mono text-[0.5625em] font-bold uppercase tracking-[0.2em] text-gray-400">{note.label}</p><p className="mt-2 text-[0.8125em] leading-relaxed text-gray-600 dark:text-gray-300">{note.value}</p></article>)}
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-3xl border-t border-gray-200 pt-6 text-center dark:border-gray-700"><h2 className="text-[1.75em] font-semibold leading-tight tracking-tight sm:text-[2.25em]">{selectedBook.title}</h2>{selectedBook.author && <p className="mt-2 text-[0.8125em] text-gray-500 dark:text-gray-400">Written by <span className="font-semibold text-gray-800 dark:text-gray-100">{selectedBook.author}</span>{selectedBook.publisher ? ` · ${selectedBook.publisher}` : ''}</p>}{selectedRoles.length > 0 && <div className="mt-3 flex flex-wrap items-center justify-center gap-2"><span className="mr-1 font-mono text-[0.5625em] font-bold uppercase tracking-[0.18em] text-gray-400">My contribution</span>{selectedRoles.map((role) => <span key={role} className="rounded-full border border-[#2B579A]/30 bg-[#2B579A]/[0.04] px-2.5 py-1 font-mono text-[0.5625em] font-bold uppercase tracking-wider text-[#2B579A] dark:border-[#6FA8DC]/35 dark:bg-[#6FA8DC]/[0.06] dark:text-[#6FA8DC]">{role}</span>)}</div>}<p className="mx-auto mt-3 max-w-2xl text-[0.875em] leading-relaxed text-gray-600 dark:text-gray-300">{selectedBook.pitch || selectedBook.summary}</p><div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-[0.625em] uppercase tracking-wider text-gray-400">{(selectedBook.publicationDate || selectedBook.year) && <span>{selectedBook.publicationDate || selectedBook.year}</span>}{(selectedBook.format || selectedBook.category) && <span>{selectedBook.format || selectedBook.category}</span>}{selectedBook.language && <span>{selectedBook.language}</span>}{selectedBook.pageCount && <span>{selectedBook.pageCount} pages</span>}{selectedBook.edition && <span>{selectedBook.edition}</span>}</div><button type="button" onClick={() => setDetailId(selectedBook.id)} className="mt-6 rounded-sm bg-[#2B579A] px-4 py-2.5 font-mono text-[0.6875em] font-bold uppercase tracking-wider text-white hover:bg-[#1e3f73] dark:bg-[#6FA8DC] dark:text-[#171717]">Open document →</button></div>
        {isMobileLayout && loosePage && <div className="mx-auto mt-8 max-w-sm">{loosePage}</div>}
      </section>

      {startHereBook && startHereBook.id !== selectedBook.id && <aside className="mb-7 flex flex-col justify-between gap-4 rounded-lg border border-[#2B579A]/25 bg-[#2B579A]/[0.04] p-4 sm:flex-row sm:items-center dark:border-[#6FA8DC]/25 dark:bg-[#6FA8DC]/[0.05]"><div><p className="font-mono text-[0.5625em] font-bold uppercase tracking-[0.2em] text-[#2B579A] dark:text-[#6FA8DC]">New here? Start here</p><p className="mt-1 text-[0.875em] font-semibold">{startHereBook.title}</p></div><button type="button" onClick={() => { setSelectedId(startHereBook.id); setDetailId(startHereBook.id); }} className="shrink-0 font-mono text-[0.625em] font-bold uppercase tracking-wider text-[#2B579A] hover:underline dark:text-[#6FA8DC]">Open recommendation →</button></aside>}

      {!isMobileLayout && railStyle && loosePage && typeof document !== 'undefined' && createPortal(
        <aside className="fixed z-30" style={railStyle} aria-label="Book loose page">
          {loosePage}
        </aside>,
        document.body
      )}

      <style>{`@keyframes viewReveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.view-reveal{animation:viewReveal .32s cubic-bezier(.16,1,.3,1)}@media(prefers-reduced-motion:reduce){.view-reveal{animation:none}}`}</style>
    </div>
  );
}
