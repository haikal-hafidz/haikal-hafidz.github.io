import { useState } from 'react';
import InteractiveText from '../components/InteractiveText';

export default function About({ data, interactiveWords = [], onNavigate }) {
  const content = data || {};
  const heading = content.heading ?? '';
  const subheading = content.subheading ?? '';
  const bio = content.bio || '';
  const [activeSection, setActiveSection] = useState('author');
  const bits = content.bitsAndPieces || {};
  const bitsItems = Array.isArray(bits.items) ? bits.items.filter((item) => item?.label || item?.value) : [];

  return (
    <article className="w-full min-h-[65vh] flex items-center px-5 py-12 sm:px-10 sm:py-16 select-text">
      <div className="w-full max-w-3xl mx-auto">
        {(heading || subheading) && <header className="mb-8 border-b border-gray-200 pb-5 dark:border-gray-700">
          {heading && <h1 className="text-[1.75em] font-semibold tracking-tight sm:text-[2.2em]"><InteractiveText text={heading} rules={interactiveWords} page="About" onNavigate={onNavigate} /></h1>}
          {subheading && <p className="mt-2 max-w-2xl text-[0.8125em] leading-relaxed text-gray-500 dark:text-gray-400"><InteractiveText text={subheading} rules={interactiveWords} page="About" onNavigate={onNavigate} /></p>}
        </header>}

        <div className="mb-8 flex border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="About sections">
          {(content.authorNoteTabLabel ?? 'The Author') && <button type="button" role="tab" aria-selected={activeSection === 'author'} onClick={() => setActiveSection('author')} className={`relative px-4 py-3 font-mono text-[0.6875em] font-bold uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-500 ${activeSection === 'author' ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {content.authorNoteTabLabel ?? 'The Author'}
            {activeSection === 'author' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-gray-900 dark:bg-gray-100" />}
          </button>}
          {(content.bitsTabLabel ?? 'Bits & Pieces') && <button type="button" role="tab" aria-selected={activeSection === 'bits'} onClick={() => setActiveSection('bits')} className={`relative px-4 py-3 font-mono text-[0.6875em] font-bold uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-500 ${activeSection === 'bits' ? 'text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {content.bitsTabLabel ?? 'Bits & Pieces'}
            {activeSection === 'bits' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-gray-900 dark:bg-gray-100" />}
          </button>}
        </div>

        {activeSection === 'author' ? (
          <section role="tabpanel">
            {content.headline && <h1 className="max-w-3xl text-[20pt] font-normal leading-[1.08] tracking-tight text-gray-900 dark:text-white"><InteractiveText text={content.headline} rules={interactiveWords} page="About" onNavigate={onNavigate} /></h1>}
            {(content.headline || bio) && <div className="my-7 h-px bg-gray-200 dark:bg-gray-700" />}
            {bio && <p className="max-w-2xl text-[1.0625em] sm:text-[1.25em] leading-[1.75] text-gray-700 dark:text-gray-300 whitespace-pre-line"><InteractiveText text={bio} rules={interactiveWords} page="About" onNavigate={onNavigate} /></p>}
            {(content.signature || content.locationLine) && <div className="mt-8 text-right font-serif italic text-[0.875em] leading-relaxed text-gray-500 dark:text-gray-400">{content.signature && <p>{content.signature}</p>}{content.locationLine && <p>{content.locationLine}</p>}</div>}
          </section>
        ) : (
          <section role="tabpanel" className="animate-[about-tab-in_220ms_ease-out]">
            {bitsItems.length ? <div className="border-t border-gray-200 dark:border-gray-700">
              {bitsItems.map((item, index) => (
                <div key={item.id || index} className="grid grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] gap-5 border-b border-gray-200 py-4 dark:border-gray-700">
                  {item.label && <p className="font-mono text-[0.625em] font-bold uppercase tracking-[0.15em] text-gray-400">{item.label}</p>}
                  {item.value && <p className="text-[0.9375em] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-line"><InteractiveText text={item.value} rules={interactiveWords} page="About" onNavigate={onNavigate} /></p>}
                </div>
              ))}
            </div> : <p className="py-6 text-sm text-gray-400">Belum ada isi Bits & Pieces.</p>}
          </section>
        )}
        <style>{`@keyframes about-tab-in{from{opacity:.35;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      </div>
    </article>
  );
}
