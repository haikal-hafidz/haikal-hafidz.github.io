import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeVisitorIntroduction } from '../lib/visitorIntroductionData';

function playPrinterSound(volume = 100) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const context = new AudioCtx();
    const now = context.currentTime;
    [0, 0.075, 0.15, 0.225].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index % 2 ? 'square' : 'sawtooth';
      oscillator.frequency.setValueAtTime(index % 2 ? 92 : 118, now + offset);
      gain.gain.setValueAtTime(0.012 * (Math.max(0, Math.min(100, Number(volume) || 0)) / 100), now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.06);
    });
    window.setTimeout(() => context.close().catch(() => {}), 700);
  } catch { /* sound is optional */ }
}

export default function VisitorIntroduction({ data, style, darkMode, soundEnabled, hintActive, inline = false, homeNavigation = null }) {
  const content = useMemo(() => normalizeVisitorIntroduction(data), [data]);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [printingDestination, setPrintingDestination] = useState(null);
  const [printed, setPrinted] = useState(() => {
    try { return localStorage.getItem('portfolio_visitor_intro_seen') === '1'; } catch { return false; }
  });
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const printActionTimerRef = useRef(null);

  const closeSheet = (afterClose) => {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      afterClose?.();
    }, 420);
  };

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event) => event.key === 'Escape' && closeSheet();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  useEffect(() => () => {
    if (printActionTimerRef.current) window.clearTimeout(printActionTimerRef.current);
  }, []);

  if (content.enabled === false) return null;

  const openSheet = () => {
    if (soundEnabled) playPrinterSound(100);
    setClosing(false);
    setPrinted(true);
    try { localStorage.setItem('portfolio_visitor_intro_seen', '1'); } catch { /* optional preference */ }
    setOpen(true);
  };

  const printThenOpen = (label, action) => {
    if (printingDestination) return;
    
    setPrintingDestination(label);
    printActionTimerRef.current = window.setTimeout(() => {
      action?.();
      setPrintingDestination(null);
      printActionTimerRef.current = null;
    }, 760);
  };

  return (
    <>
      <aside className={`portfolio-rail z-20 ${inline ? 'relative w-full' : 'fixed'}`} style={style} aria-label="Visitor introduction">
        <button
          ref={triggerRef}
          type="button"
          onClick={openSheet}
          data-hint-id="visitor-introduction"
          className={`group w-full text-left ${darkMode ? 'text-gray-100' : 'text-[#172033] dark:text-gray-100'}`}
          aria-haspopup="dialog"
        >
          <div className={`relative mx-auto w-full pt-5 ${inline ? 'max-w-[14rem]' : 'max-w-[10.5rem]'}`}>
            <div className="absolute left-1/2 top-0 h-9 w-[76%] -translate-x-1/2 rounded-t border border-b-0 border-gray-400/50 bg-[#d8d8d5] shadow-sm dark:border-gray-600 dark:bg-[#343434]">
              <span className="absolute left-1/2 top-2.5 h-1.5 w-11 -translate-x-1/2 rounded-full bg-[#242424]" />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#2B579A] shadow-[0_0_0_2px_rgba(43,87,154,.14)] transition group-hover:bg-green-500" />
            </div>
            <div className="relative border border-gray-300 bg-white px-3 pb-3 pt-4 shadow-[0_7px_16px_rgba(0,0,0,.08)] transition duration-300 group-hover:translate-y-1.5 dark:border-gray-600 dark:bg-[#f5f3ec] dark:text-[#172033]">
              <p className="font-mono text-[0.5em] uppercase tracking-[0.18em] text-[#2B579A]">{content.triggerEyebrow}</p>
              <h2 className="mt-1.5 font-serif text-[0.92em] leading-tight">{content.triggerTitle}</h2>
              <p className="mt-3 font-mono text-[0.5em] uppercase tracking-[0.1em] text-gray-500">{printed ? content.printedLabel : `${content.triggerAction} →`}</p>
            </div>
          </div>
          {hintActive && <p className="mt-3 text-center font-mono text-[0.58em] uppercase tracking-[0.14em] text-[#2B579A]">An introduction is waiting here.</p>}
        </button>

        {!inline && homeNavigation && (
          <nav className={`mx-auto mt-5 w-full max-w-[10.5rem] ${darkMode ? 'text-slate-100' : 'text-slate-800'}`} aria-label="Home shortcuts">
            <p className="mb-2 font-mono text-[0.5625em] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">{content.documentIndexLabel ?? 'Document index'}</p>
            <div className={`border-y py-1.5 ${darkMode ? 'border-slate-700/90' : 'border-slate-300/75'}`}>
              <button type="button" onClick={() => { homeNavigation.onPrintNavigate?.('Projects'); }} className="group flex min-h-8 w-full items-center justify-between gap-2 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A]">
                <span className="min-w-0 flex-1 font-serif text-[0.8125em] font-normal leading-tight transition group-hover:text-[#2B579A]">Selected works</span><span aria-hidden="true" className="font-mono text-[0.5625em] text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2B579A]">→</span>
              </button>
              <button type="button" onClick={() => { homeNavigation.onPrintNavigate?.('Career'); }} className="group flex min-h-8 w-full items-center justify-between gap-2 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A]">
                <span className="min-w-0 flex-1 font-serif text-[0.8125em] font-normal leading-tight transition group-hover:text-[#2B579A]">Experience</span><span aria-hidden="true" className="font-mono text-[0.5625em] text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2B579A]">→</span>
              </button>
              <button type="button" onClick={() => { homeNavigation.onPrintNavigate?.('Contact'); }} className="group flex min-h-8 w-full items-center justify-between gap-2 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A]">
                <span className="min-w-0 flex-1 font-serif text-[0.8125em] font-normal leading-tight transition group-hover:text-[#2B579A]">Contact</span><span aria-hidden="true" className="font-mono text-[0.5625em] text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2B579A]">→</span>
              </button>

              <div className={`my-1.5 border-t ${darkMode ? 'border-slate-700/90' : 'border-slate-300/75'}`} aria-hidden="true" />

            {homeNavigation.zineEnabled && (
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('portfolio:home-action', { detail: 'zine' }))} data-hint-id="home-wassup" className="group flex min-h-8 w-full items-center justify-between gap-2 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A]">
                <span className="min-w-0 flex-1 font-serif text-[0.8125em] font-normal leading-tight transition group-hover:text-[#2B579A]">{homeNavigation.zineLabel || 'Wassup?'}</span><span aria-hidden="true" className="font-mono text-[0.5625em] text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2B579A]">↗</span>
              </button>
            )}
            {homeNavigation.gameEnabled && (
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('portfolio:home-action', { detail: 'game' }))} data-hint-id="home-mini-game" className="group flex min-h-8 w-full items-center justify-between gap-2 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A]">
                <span className="min-w-0 flex-1 font-serif text-[0.8125em] font-normal leading-tight transition group-hover:text-[#2B579A]">Mini Game</span><span aria-hidden="true" className="font-mono text-[0.5625em] text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2B579A]">↗</span>
              </button>
            )}
            </div>
          </nav>
        )}
      </aside>

      {printingDestination && createPortal(
        <div className="portfolio-rail route-print-takeover" role="status" aria-live="polite" aria-label={`Printing ${printingDestination}`}>
          <div className="route-print-machine" aria-hidden="true">
            <span className="route-print-slot" />
            <span className="route-print-light" />
          </div>
          <div className="route-print-paper">
            <p>DOCUMENT REQUEST / PRINTING</p>
            <div />
            <h1>{printingDestination}</h1>
            <span>PLEASE WAIT — YOUR COPY IS BEING PREPARED</span>
          </div>
          <style>{`
            .route-print-takeover{position:fixed;inset:0;z-index:10020;overflow:hidden;background:#d7d7d7;color:#121a2b}
            .route-print-machine{position:absolute;left:50%;top:0;z-index:2;width:min(420px,72vw);height:54px;transform:translateX(-50%);border:1px solid #9ca3af;border-top:0;border-radius:0 0 8px 8px;background:#c9c9c6;box-shadow:0 8px 24px rgba(0,0,0,.18)}
            .route-print-slot{position:absolute;left:50%;bottom:10px;width:66%;height:7px;transform:translateX(-50%);border-radius:999px;background:#252525}
            .route-print-light{position:absolute;right:18px;bottom:11px;width:7px;height:7px;border-radius:50%;background:#2B579A;box-shadow:0 0 0 3px rgba(43,87,154,.15)}
            .route-print-paper{position:absolute;inset:0;min-height:100vh;padding:clamp(72px,10vh,120px) clamp(24px,8vw,120px) 56px;background:#fbfaf6;box-shadow:0 0 80px rgba(0,0,0,.22);animation:route-paper-in .76s cubic-bezier(.2,.8,.2,1) both}
            .route-print-paper p,.route-print-paper span{display:block;font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.18em;color:#2B579A}
            .route-print-paper div{height:5px;margin:20px 0 clamp(56px,12vh,130px);background:#2B579A}
            .route-print-paper h1{max-width:1100px;margin:0;font:400 clamp(48px,8vw,118px)/.94 Georgia,'Times New Roman',serif;letter-spacing:-.045em}
            .route-print-paper span{position:absolute;left:clamp(24px,8vw,120px);bottom:48px;color:#788294}
            @keyframes route-paper-in{0%{clip-path:inset(0 47% 100% 47%);transform:translateY(-12%)}42%{clip-path:inset(0 34% 46% 34%)}100%{clip-path:inset(0);transform:none}}
            @media(max-width:760px){.route-print-machine{width:76vw}.route-print-paper{padding-top:88px}.route-print-paper h1{font-size:clamp(42px,15vw,70px)}.route-print-paper span{bottom:28px}}
            @media(prefers-reduced-motion:reduce){.route-print-paper{animation:none}}
          `}</style>
        </div>,
        document.body,
      )}

      {open && createPortal(
        <div className={`portfolio-rail visitor-copy-takeover ${closing ? 'is-closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="visitor-copy-title">
          <div className="visitor-copy-paper">
            <button ref={closeRef} type="button" onClick={() => closeSheet()} className="visitor-copy-close" aria-label="Close visitor introduction">×</button>
            <main className="visitor-copy-content">
              <div className="visitor-copy-meta">
                <span>{content.documentCode}</span><span>{content.recipient}</span>
              </div>
              <div className="visitor-copy-rule" />
              <section className="visitor-copy-lead">
                <p className="visitor-copy-kicker">{content.kicker}</p>
                <h1 id="visitor-copy-title">{content.title}</h1>
                <div className="visitor-copy-body">{content.body}</div>
              </section>
              <p className="visitor-copy-closing">{content.closing}</p>
              <div className="visitor-copy-actions">
                <button type="button" className="is-primary" onClick={() => closeSheet()}>{content.closeLabel} ×</button>
              </div>
            </main>
          </div>
          <style>{`
            .visitor-copy-takeover{position:fixed;inset:0;z-index:10000;overflow:auto;background:#d7d7d7;animation:visitor-paper-in .72s cubic-bezier(.2,.8,.2,1) both;color:#121a2b}
            .visitor-copy-takeover.is-closing{animation:visitor-paper-out .42s cubic-bezier(.6,0,.8,.2) both}
            .visitor-copy-paper{min-height:100vh;background:#fbfaf6;box-shadow:0 0 80px rgba(0,0,0,.22)}
            .visitor-copy-content{width:min(1120px,calc(100% - 48px));min-height:100vh;margin:0 auto;padding:38px 0 64px;display:flex;flex-direction:column}
            .visitor-copy-close{position:fixed;right:24px;top:20px;z-index:2;width:44px;height:44px;border:1px solid #bac0c9;background:#fbfaf6;font:28px/1 Georgia,serif;transition:.2s}
            .visitor-copy-close:hover{background:#2B579A;color:white;border-color:#2B579A}
            .visitor-copy-meta{display:flex;justify-content:space-between;gap:30px;padding-right:58px;font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.18em;color:#2B579A}
            .visitor-copy-rule{height:5px;background:#2B579A;margin:20px 0 clamp(42px,7vh,90px)}
            .visitor-copy-lead{width:min(880px,100%);margin:auto 0;padding:clamp(10px,3vh,44px) 0}
            .visitor-copy-kicker{margin:0 0 18px;font:600 11px/1.4 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#788294}
            .visitor-copy-lead h1{max-width:950px;margin:0;font:400 clamp(42px,6.3vw,92px)/.98 Georgia,'Times New Roman',serif;letter-spacing:-.045em}
            .visitor-copy-body{max-width:760px;margin:clamp(32px,6vh,72px) 0 0;white-space:pre-line;font:400 clamp(18px,1.7vw,25px)/1.65 Georgia,'Times New Roman',serif;color:#4e5869}
            .visitor-copy-closing{max-width:680px;margin:0;font:italic 20px/1.55 Georgia,serif;color:#566071}
            .visitor-copy-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.visitor-copy-actions button{padding:14px 18px;border:1px solid #9da6b3;background:transparent;font:600 11px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;color:inherit}.visitor-copy-actions button:hover,.visitor-copy-actions .is-primary{border-color:#2B579A;background:#2B579A;color:white}
            @keyframes visitor-paper-in{0%{clip-path:inset(0 46% 96% 46%);transform:translateY(-8%)}45%{clip-path:inset(0 34% 40% 34%)}100%{clip-path:inset(0);transform:none}}
            @keyframes visitor-paper-out{from{clip-path:inset(0)}to{clip-path:inset(0 48% 100% 48%);transform:translateY(-8%)}}
            @media(max-width:760px){.visitor-copy-content{width:min(100% - 28px,680px);padding-top:24px}.visitor-copy-meta{display:block;padding-right:48px}.visitor-copy-meta span{display:block;margin-bottom:5px}.visitor-copy-lead h1{font-size:clamp(38px,13vw,62px)}.visitor-copy-close{right:14px;top:14px}.visitor-copy-actions{display:grid}.visitor-copy-actions button{width:100%}}
            @media(prefers-reduced-motion:reduce){.visitor-copy-takeover,.visitor-copy-takeover.is-closing{animation:none}.visitor-copy-takeover *{scroll-behavior:auto!important}}
          `}</style>
        </div>,
        document.body,
      )}
    </>
  );
}
