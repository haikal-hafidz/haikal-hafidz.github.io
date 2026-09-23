import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import InteractiveText from '../components/InteractiveText';

const LEGACY_KEYS = [{ key: 'professional', name: 'Professional' }, { key: 'college', name: 'College' }];

function normalizeCategories(raw) {
  const career = raw || {};
  if (Array.isArray(career.categories)) return career.categories.map((category, categoryIndex) => ({
    id: category.id || `career-category-${categoryIndex}`,
    name: category.name || '',
    type: category.type === 'credential' ? 'credential' : 'career',
    items: Array.isArray(category.items) ? category.items : [],
  }));
  return LEGACY_KEYS.map(({ key, name }) => ({ id: key, name, type: 'career', items: Array.isArray(career[key]?.items) ? career[key].items : [] }));
}

const firstYear = (value = '') => {
  const match = String(value).match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : 9999;
};

function buildCareerData(categories) {
  const timeline = [];
  const credentials = [];
  categories.forEach((category, categoryIndex) => {
    category.items.forEach((item, itemIndex) => {
      const entry = { ...item, categoryName: category.name, categoryId: category.id, categoryIndex, itemIndex };
      if (category.type === 'credential') {
        credentials.push(entry);
        if (item.showOnTimeline === true) timeline.push({ ...entry, isCredential: true });
      } else timeline.push({ ...entry, isCredential: false });
    });
  });
  timeline.sort((a, b) => {
    const aOrder = Number(a.timelineOrder);
    const bOrder = Number(b.timelineOrder);
    const hasA = Number.isFinite(aOrder) && a.timelineOrder !== '' && a.timelineOrder != null;
    const hasB = Number.isFinite(bOrder) && b.timelineOrder !== '' && b.timelineOrder != null;
    if (hasA || hasB) return (hasA ? aOrder : 9999) - (hasB ? bOrder : 9999);
    return firstYear(a.period || a.date) - firstYear(b.period || b.date) || a.categoryIndex - b.categoryIndex || a.itemIndex - b.itemIndex;
  });
  return { timeline, credentials };
}

function TimelineButton({ entry, index, active, onSelect }) {
  const title = entry.isCredential ? entry.title : entry.role;
  const period = entry.isCredential ? entry.date : entry.period;
  return <button type="button" onClick={() => onSelect(index)} data-hint-id={`career-version-${entry.id || index}`} className={`grid w-full grid-cols-[1.5rem_1fr] gap-2 rounded-lg px-2 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] ${active ? 'bg-[#2B579A]/10 text-gray-900 dark:bg-[#6FA8DC]/15 dark:text-white' : 'text-gray-500 hover:bg-gray-200/70 dark:text-gray-400 dark:hover:bg-white/5'}`}>
    <span className={`mt-0.5 block h-3 w-3 rounded-full border-2 ${active ? 'border-[#2B579A] bg-[#2B579A] dark:border-[#6FA8DC] dark:bg-[#6FA8DC]' : 'border-gray-400 dark:border-gray-500'}`} />
    <span className="min-w-0"><span className="block font-mono text-[0.625em] font-bold uppercase tracking-[0.12em] text-[#2B579A] dark:text-[#8db7e8]">{entry.categoryName || 'Career'}</span><span className="mt-0.5 block truncate text-[0.75em] font-semibold">{title || 'Untitled entry'}</span>{period && <span className="mt-0.5 block text-[0.625em]">{period}</span>}</span>
  </button>;
}

function CareerHistory({ timeline, credentials, activeIndex, onSelect, onOpenCredentials, compact = false }) {
  const [filter, setFilter] = useState('all');
  const groups = useMemo(() => {
    const seen = new Set();
    return timeline.reduce((result, entry) => {
      if (!entry.categoryId || seen.has(entry.categoryId)) return result;
      seen.add(entry.categoryId);
      result.push({ id: entry.categoryId, name: entry.categoryName || 'Other' });
      return result;
    }, []);
  }, [timeline]);
  const visibleEntries = timeline.map((entry, originalIndex) => ({ entry, originalIndex })).filter(({ entry }) => filter === 'all' || entry.categoryId === filter);
  const chooseFilter = (nextFilter) => {
    setFilter(nextFilter);
    const candidates = timeline.map((entry, originalIndex) => ({ entry, originalIndex })).filter(({ entry }) => nextFilter === 'all' || entry.categoryId === nextFilter);
    if (candidates.length) onSelect(candidates[candidates.length - 1].originalIndex);
  };
  const filters = <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Filter document history"><button type="button" onClick={() => chooseFilter('all')} className={`shrink-0 rounded px-2 py-1.5 font-mono text-[0.5625em] font-bold uppercase tracking-wider ${filter === 'all' ? 'bg-[#2B579A] text-white' : 'bg-white/70 text-gray-500 hover:text-[#2B579A] dark:bg-[#252525] dark:text-gray-400'}`}>All</button>{groups.map((group) => <button key={group.id} type="button" onClick={() => chooseFilter(group.id)} className={`shrink-0 rounded px-2 py-1.5 font-mono text-[0.5625em] font-bold uppercase tracking-wider ${filter === group.id ? 'bg-[#2B579A] text-white' : 'bg-white/70 text-gray-500 hover:text-[#2B579A] dark:bg-[#252525] dark:text-gray-400'}`}>{group.name}</button>)}</div>;
  if (compact) return <div className="mb-6"><div className="mb-3">{filters}</div><div className="overflow-x-auto pb-2"><div className="flex min-w-max gap-2">{visibleEntries.map(({ entry, originalIndex }) => <TimelineButton key={entry.id || originalIndex} entry={entry} index={originalIndex} active={originalIndex === activeIndex} onSelect={onSelect} />)}{credentials.length > 0 && <button type="button" onClick={onOpenCredentials} className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-[0.6875em] uppercase tracking-wider text-gray-600 dark:border-gray-700 dark:text-gray-300">All credentials ({credentials.length})</button>}</div></div></div>;
  return <aside aria-label="Document history" className="flex h-full min-h-0 w-full flex-col"><p className="mb-3 shrink-0 font-mono text-[0.6875em] uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Document history</p><div className="mb-3 shrink-0">{filters}</div><div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1" onWheel={(event) => event.stopPropagation()}>{visibleEntries.map(({ entry, originalIndex }) => <TimelineButton key={entry.id || originalIndex} entry={entry} index={originalIndex} active={originalIndex === activeIndex} onSelect={onSelect} />)}</div>{credentials.length > 0 && <button type="button" onClick={onOpenCredentials} data-hint-id="career-all-credentials" className="mt-3 w-full shrink-0 rounded-md border border-gray-300 px-3 py-2 font-mono text-[0.6875em] font-semibold uppercase tracking-wider text-gray-600 hover:border-[#2B579A] hover:text-[#2B579A] dark:border-gray-700 dark:text-gray-300 dark:hover:border-[#6FA8DC] dark:hover:text-[#6FA8DC]">View all credentials ({credentials.length})</button>}</aside>;
}

export default function Career({ data, interactiveWords = [], onNavigate, railStyle, darkMode = false }) {
  const careerData = data || {};
  const categories = useMemo(() => normalizeCategories(data), [data]);
  const { timeline, credentials } = useMemo(() => buildCareerData(categories), [categories]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, timeline.length - 1));
  const [detailOpen, setDetailOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const modalCloseRef = useRef(null);

  useEffect(() => setActiveIndex((current) => Math.min(current, Math.max(0, timeline.length - 1))), [timeline.length]);
  useEffect(() => {
    if (!detailOpen && !credentialsOpen && !selectedImage) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => modalCloseRef.current?.focus(), 0);
    const close = (event) => { if (event.key === 'Escape') { setDetailOpen(false); setCredentialsOpen(false); setSelectedImage(null); } };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', close); };
  }, [detailOpen, credentialsOpen, selectedImage]);

  const active = timeline[activeIndex];
  const title = active?.isCredential ? active.title : active?.role;
  const organization = active?.isCredential ? active.issuer : active?.company;
  const period = active?.isCredential ? active.date : active?.period;
  const image = active?.coverImage || active?.image || active?.companyInfo?.photo;
  const years = timeline.map((entry) => firstYear(entry.period || entry.date)).filter((year) => year !== 9999);
  const yearRange = years.length ? `${Math.min(...years)} — ${Math.max(...years) === new Date().getFullYear() ? 'Now' : Math.max(...years)}` : 'Still being written';

  const openArchiveAt = (index) => {
    setActiveIndex(index);
    setArchiveOpen(true);
  };

  const modal = (detailOpen || credentialsOpen || selectedImage) && typeof document !== 'undefined' ? createPortal(
    <div className="portfolio-rail fixed inset-0 z-[150] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) { setDetailOpen(false); setCredentialsOpen(false); setSelectedImage(null); } }}>
      {selectedImage ? <section role="dialog" aria-modal="true" aria-label="Pratinjau credential" className="relative"><button ref={modalCloseRef} type="button" onClick={() => setSelectedImage(null)} className="absolute right-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white hover:bg-black" aria-label="Tutup pratinjau">×</button><img src={selectedImage} alt="Credential preview" className="max-h-[88vh] max-w-[92vw] object-contain shadow-2xl" /></section> : <section role="dialog" aria-modal="true" aria-labelledby="career-dialog-title" className="w-full max-w-4xl overflow-hidden rounded-lg border border-[#7896bc] bg-white shadow-2xl dark:border-[#4b6380] dark:bg-[#202020]">
        <header className="flex items-center justify-between bg-[#2B579A] px-5 py-3 text-white"><div><p className="font-mono text-[0.625em] uppercase tracking-[0.15em] text-blue-100">Career document</p><h2 id="career-dialog-title" className="text-[1.0625em] font-semibold">{credentialsOpen ? 'Credentials & Attachments' : `${title || 'Career entry'} — Details`}</h2></div><button ref={modalCloseRef} type="button" onClick={() => { setDetailOpen(false); setCredentialsOpen(false); }} className="grid h-11 w-11 place-items-center rounded hover:bg-white/15" aria-label="Tutup">×</button></header>
        <div className="max-h-[72vh] overflow-y-auto p-6 sm:p-8">
          {credentialsOpen ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{credentials.map((item, index) => <article key={item.id || index} className="flex gap-4 border-t border-gray-200 pt-4 dark:border-gray-700">{item.image && <button type="button" onClick={() => setSelectedImage(item.image)} className="h-20 w-20 shrink-0 overflow-hidden rounded"><img src={item.image} alt="" className="h-full w-full object-cover" /></button>}<div><p className="font-mono text-[0.625em] uppercase tracking-wider text-[#2B579A] dark:text-[#8db7e8]">{item.categoryName}</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-1 text-[0.75em] text-gray-500">{[item.issuer, item.date].filter(Boolean).join(' · ')}</p>{item.description && <p className="mt-2 text-[0.8125em] leading-relaxed text-gray-600 dark:text-gray-300">{item.description}</p>}{item.verifyUrl && <a href={item.verifyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[0.75em] text-[#2B579A] underline dark:text-[#8db7e8]">View verification ↗</a>}</div></article>)}</div> : active && <div className={`grid grid-cols-1 gap-7 ${image ? 'md:grid-cols-[16rem_1fr]' : ''}`}>{image && <img src={image} alt="" className="h-64 w-full rounded-md object-cover" />}<div><p className="font-mono text-[0.6875em] uppercase tracking-[0.15em] text-[#2B579A] dark:text-[#8db7e8]">{active.categoryName}</p><h3 className="mt-2 font-serif text-[2em] leading-tight">{title}</h3><p className="mt-2 text-gray-500">{[organization, period, active.location].filter(Boolean).join(' · ')}</p>{active.description && <p className="mt-6 whitespace-pre-line text-[0.9375em] leading-relaxed text-gray-700 dark:text-gray-300">{active.description}</p>}{active.companyInfo?.about && <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700"><p className="font-mono text-[0.625em] uppercase tracking-wider text-gray-400">About the organization</p><p className="mt-2 text-[0.875em] leading-relaxed text-gray-600 dark:text-gray-300">{active.companyInfo.about}</p></div>}{active.relatedUrl && <a href={active.relatedUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block text-[0.8125em] font-semibold text-[#2B579A] underline underline-offset-4 dark:text-[#8db7e8]">{active.relatedLabel || 'Open related work'} ↗</a>}</div></div>}
        </div>
      </section>}
    </div>, document.body) : null;

  if (!active) return <div className="flex min-h-[65vh] items-center justify-center text-gray-400"><p>Belum ada perjalanan yang ditampilkan.</p></div>;

  if (!archiveOpen) return <article className="flex min-h-[65vh] w-full items-center px-5 py-10 sm:px-10 sm:py-14 select-text"><div className="mx-auto w-full max-w-3xl">
    <div><p className="mb-4 font-mono text-[0.6875em] font-bold uppercase tracking-[0.2em] text-[#2B579A] dark:text-[#8db7e8]">Career & Education / Archive</p><h1 className="font-serif text-[2.6em] font-normal leading-[1.04] tracking-tight text-gray-900 dark:text-white sm:text-[3.6em]"><InteractiveText text={careerData.archiveTitle || careerData.heading || 'A record of work, study, and things that became experience.'} rules={interactiveWords} page="Career" onNavigate={onNavigate} /></h1><p className="mt-6 max-w-xl text-[1em] leading-relaxed text-gray-600 dark:text-gray-300"><InteractiveText text={careerData.archiveIntro || careerData.subheading || 'An unfinished archive of where I learned, worked, led, and changed direction.'} rules={interactiveWords} page="Career" onNavigate={onNavigate} /></p><div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-gray-200 pt-5 dark:border-gray-700"><div><p className="font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Entries</p><p className="mt-1 text-[1.25em] font-semibold">{timeline.length}</p></div><div><p className="font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Period</p><p className="mt-1 text-[1.25em] font-semibold">{yearRange}</p></div><div><p className="font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Attachments</p><p className="mt-1 text-[1.25em] font-semibold">{credentials.length}</p></div></div><button type="button" onClick={() => openArchiveAt(timeline.length - 1)} data-hint-id="career-open-archive" className="mt-8 rounded bg-[#2B579A] px-5 py-3 font-mono text-[0.75em] font-semibold uppercase tracking-wider text-white hover:bg-[#244b87]">{careerData.archiveButtonLabel || 'Open career archive'} →</button></div>
  </div></article>;

  return <><article className="flex min-h-[65vh] w-full items-center px-5 py-10 sm:px-10 sm:py-14 select-text"><div className="mx-auto w-full max-w-3xl">
    {!railStyle && <CareerHistory compact timeline={timeline} credentials={credentials} activeIndex={activeIndex} onSelect={setActiveIndex} onOpenCredentials={() => setCredentialsOpen(true)} />}
    <button type="button" onClick={() => setArchiveOpen(false)} className="mb-5 font-mono text-[0.6875em] uppercase tracking-wider text-gray-400 hover:text-[#2B579A] dark:hover:text-[#8db7e8]">← Archive cover</button>
    <div className="mb-3 flex items-center justify-between gap-4 font-mono text-[0.6875em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#8db7e8]"><span>Career archive / Journey</span><span>{String(activeIndex + 1).padStart(2, '0')} / {String(timeline.length).padStart(2, '0')}</span></div>
    <h1 className="max-w-3xl font-serif text-[2.3em] font-normal leading-[1.08] tracking-tight text-gray-900 dark:text-white sm:text-[3.1em]"><InteractiveText text={title || 'Untitled revision'} rules={interactiveWords} page="Career" onNavigate={onNavigate} /></h1>
    <p className="mt-3 text-[0.875em] text-gray-500 dark:text-gray-400">{[organization, period].filter(Boolean).join(' · ')}</p>
    <div className={`mt-8 grid gap-7 ${image ? 'md:grid-cols-[13rem_1fr]' : 'grid-cols-1'}`}>{image && <img src={image} alt="" className="h-48 w-full rounded-md object-cover" />}<div><p className="font-mono text-[0.6875em] font-bold uppercase tracking-[0.15em] text-[#2B579A] dark:text-[#8db7e8]">{active.categoryName}{period ? ` · ${period}` : ''}</p>{active.revisionTitle && <h2 className="mt-3 font-serif text-[1.55em] leading-tight text-gray-900 dark:text-white">{active.revisionTitle}</h2>}<p className="mt-4 text-[1em] leading-relaxed text-gray-700 dark:text-gray-300">{active.shortSummary || active.description}</p>{active.whatChanged && <div className="mt-6"><p className="font-mono text-[0.625em] font-bold uppercase tracking-[0.16em] text-gray-400">What changed</p><p className="mt-2 text-[0.875em] leading-relaxed text-gray-600 dark:text-gray-400">{active.whatChanged}</p></div>}<div className="mt-7 flex flex-wrap gap-2"><button type="button" onClick={() => setDetailOpen(true)} data-hint-id="career-full-revision" className="rounded bg-[#2B579A] px-4 py-2.5 font-mono text-[0.6875em] font-semibold uppercase tracking-wider text-white hover:bg-[#244b87]">View full entry</button>{active.relatedUrl && <a href={active.relatedUrl} target="_blank" rel="noreferrer" data-hint-id="career-related-work" className="rounded border border-gray-300 px-4 py-2.5 font-mono text-[0.6875em] font-semibold uppercase tracking-wider text-gray-700 hover:border-[#2B579A] hover:text-[#2B579A] dark:border-gray-700 dark:text-gray-300">{active.relatedLabel || 'Related work'} →</a>}</div></div></div>
  </div></article>{railStyle && typeof document !== 'undefined' && createPortal(<div className={`portfolio-rail ${darkMode ? 'dark' : ''}`}><div className="absolute z-30 overflow-hidden" style={{ ...railStyle, height: railStyle.maxHeight }}><CareerHistory timeline={timeline} credentials={credentials} activeIndex={activeIndex} onSelect={setActiveIndex} onOpenCredentials={() => setCredentialsOpen(true)} /></div></div>, document.body)}{modal}</>;
}
