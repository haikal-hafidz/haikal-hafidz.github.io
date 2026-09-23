import { useState } from 'react';
import { createPortal } from 'react-dom';
import InteractiveText from '../components/InteractiveText';

const getNotes = (data = {}) => {
  if (data.notesVisible === false) return [];
  const limit = Math.max(1, Math.min(3, Number(data.notesLimit) || 3));
  return [
  { label: data.note1Label || '', text: data.note1 || '' },
  { label: data.note2Label || '', text: data.note2 || '' },
  { label: data.note3Label || '', text: data.note3 || '' },
  ].filter((note) => note.text?.trim()).slice(0, limit);
};

function Notes({ notes, compact = false }) {
  return (
    <div className={compact ? 'grid gap-3 mt-8' : 'grid gap-4'} aria-label="Catatan tentang Haikal">
      {notes.map((note, index) => (
        <aside key={`${note.label}-${index}`} className="rounded-xl border border-[#b9c9dc] bg-white/90 dark:border-[#3f5875] dark:bg-[#202936]/95 px-4 py-3 shadow-[0_5px_16px_rgba(43,87,154,0.10)]">
          {note.label && <p className="mb-1.5 font-mono text-[0.6875em] font-bold uppercase tracking-[0.16em] text-[#2B579A] dark:text-[#8db7e8]">{note.label}</p>}
          <p className="m-0 text-[0.8125em] leading-relaxed text-gray-700 dark:text-gray-200">{note.text}</p>
        </aside>
      ))}
    </div>
  );
}

export function AboutNotesPortal({ data, style, darkMode = false }) {
  if (!style || typeof document === 'undefined') return null;
  return createPortal(
    <div className={`portfolio-rail ${darkMode ? 'dark' : ''}`}><div className="absolute z-20 overflow-visible" style={style}><Notes notes={getNotes(data)} /></div></div>,
    document.body,
  );
}

export default function About({ data, interactiveWords = [], onNavigate }) {
  const content = data || {};
  const bio = content.bio || '';
  const notes = getNotes(content);
  const [activeSection, setActiveSection] = useState('note');
  const properties = content.authorProperties || {};
  const propertyItems = Array.isArray(properties.items) ? properties.items.filter((item) => item?.label || item?.value) : [];
  return (
    <article className="w-full min-h-[65vh] flex items-center px-5 py-12 sm:px-10 sm:py-16 select-text">
      <div className="w-full max-w-3xl mx-auto">
        <div className="mb-8 flex border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="About sections">
          <button type="button" role="tab" aria-selected={activeSection === 'note'} onClick={() => setActiveSection('note')} className={`relative px-4 py-3 font-mono text-[0.6875em] font-bold uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2B579A] ${activeSection === 'note' ? 'text-[#2B579A] dark:text-[#8db7e8]' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            Author’s Note
            {activeSection === 'note' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#2B579A] dark:bg-[#6FA8DC]" />}
          </button>
          {properties.enabled !== false && <button type="button" role="tab" aria-selected={activeSection === 'properties'} onClick={() => setActiveSection('properties')} data-hint-id="about-author-properties" className={`relative px-4 py-3 font-mono text-[0.6875em] font-bold uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2B579A] ${activeSection === 'properties' ? 'text-[#2B579A] dark:text-[#8db7e8]' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            Author Properties
            {activeSection === 'properties' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#2B579A] dark:bg-[#6FA8DC]" />}
          </button>}
        </div>

        {activeSection === 'note' ? (
          <section role="tabpanel">
            <p className="mb-4 font-mono text-[0.6875em] font-bold uppercase tracking-[0.2em] text-[#2B579A] dark:text-[#8db7e8]">Author’s Note / About</p>
            {content.headline && <h1 className="max-w-3xl text-[2.25em] sm:text-[3.25em] font-normal leading-[1.08] tracking-tight text-gray-900 dark:text-white"><InteractiveText text={content.headline} rules={interactiveWords} page="About" onNavigate={onNavigate} /></h1>}
            {(content.headline || bio) && <div className="my-7 h-px bg-gray-200 dark:bg-gray-700" />}
            {bio && <p className="max-w-2xl text-[1.0625em] sm:text-[1.25em] leading-[1.75] text-gray-700 dark:text-gray-300 whitespace-pre-line"><InteractiveText text={bio} rules={interactiveWords} page="About" onNavigate={onNavigate} /></p>}
            {(content.signature || content.locationLine) && <div className="mt-8 text-right font-serif italic text-[0.875em] leading-relaxed text-gray-500 dark:text-gray-400">{content.signature && <p>{content.signature}</p>}{content.locationLine && <p>{content.locationLine}</p>}</div>}
            <div className="md:hidden"><Notes notes={notes} compact /></div>
          </section>
        ) : (
          <section role="tabpanel" className="animate-[about-tab-in_220ms_ease-out]">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[0.6875em] font-bold uppercase tracking-[0.2em] text-[#2B579A] dark:text-[#8db7e8]">About / Document Properties</p>
                <h1 className="mt-3 font-serif text-[2.25em] font-normal leading-none text-gray-900 dark:text-white sm:text-[3em]">{properties.panelTitle || 'Author Properties'}</h1>
              </div>
              {properties.lastRevised && <p className="font-mono text-[0.625em] uppercase tracking-[0.14em] text-gray-400">Revised {properties.lastRevised}</p>}
            </div>
            {propertyItems.length ? <div className="grid grid-cols-1 border-t border-l border-gray-200 dark:border-gray-700 sm:grid-cols-2">
              {propertyItems.map((item, index) => {
                const body = <><p className="font-mono text-[0.625em] font-bold uppercase tracking-[0.15em] text-gray-400">{item.label || `Property ${index + 1}`}</p><p className="mt-2 font-serif text-[1.125em] leading-snug text-gray-800 dark:text-gray-100">{item.value || '—'}</p></>;
                const classes = 'min-h-28 border-r border-b border-gray-200 p-4 transition-colors hover:bg-[#2B579A]/[0.035] dark:border-gray-700 dark:hover:bg-[#6FA8DC]/[0.05]';
                return item.url ? <a key={item.id || index} href={item.url} target="_blank" rel="noreferrer" className={classes}>{body}</a> : <div key={item.id || index} className={classes}>{body}</div>;
              })}
            </div> : <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700">Belum ada Author Properties yang diisi.</p>}
          </section>
        )}
        <style>{`@keyframes about-tab-in{from{opacity:.35;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      </div>
    </article>
  );
}
