import { useState, useEffect, useRef } from 'react';

export default function DocumentLoader({ isDataReady = true, onFinished }) {
  const [act, setAct] = useState(1); // 1: Quiet/Suspicious, 2: Rebellion Spreads, 3: Line Collapse, 4: Free-fall, 5: Vertical Pull
  const containerRef = useRef(null);

  useEffect(() => {
    // Act 1 -> Act 2 (Rebellion spreads) at 800ms
    const timer1 = setTimeout(() => {
      setAct(2);
    }, 800);

    // Act 2 -> Act 3 (Line gives up) at 1800ms
    const timer2 = setTimeout(() => {
      setAct(3);
    }, 1800);

    // Act 3 -> Act 4 (Free-fall) at 2700ms
    const timer3 = setTimeout(() => {
      setAct(4);
    }, 2700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Act 4 -> Act 5 (Vertical pull) when Act 4 reaches finish AND isDataReady is true (~3600ms)
  useEffect(() => {
    if (act >= 4 && isDataReady && act < 5) {
      const timer4 = setTimeout(() => {
        setAct(5);
      }, 900); // 2700 + 900 = 3600ms
      return () => clearTimeout(timer4);
    }
  }, [act, isDataReady]);

  // Handle vertical uncover completion
  const handleUncoverEnd = () => {
    onFinished?.();
  };

  // Reduced motion support
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReducedMotion(true);
    }
  }, []);

  useEffect(() => {
    if (reducedMotion && isDataReady) {
      const timer = setTimeout(() => {
        onFinished?.();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [reducedMotion, isDataReady, onFinished]);

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F3F3F3] text-[#111111] select-none overflow-hidden ${
        act === 5 ? 'loader-vertical-pull-active' : ''
      } ${reducedMotion ? 'loader-reduced-motion' : ''}`}
      onAnimationEnd={(e) => {
        if (e.target === containerRef.current && act === 5) {
          handleUncoverEnd();
        }
      }}
      role="status"
      aria-label="Membuka dokumen portofolio"
    >
      <style>{`
        /* Distinctive, characterful editorial sans-serif typography */
        .rebellious-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          will-change: transform;
        }

        .rebellious-word {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 2.1rem;
          font-weight: 500;
          letter-spacing: -0.02em;
          display: inline-flex;
          align-items: baseline;
          position: relative;
          color: #1a1a1a;
        }

        .rebellious-letter {
          display: inline-block;
          transform-origin: 50% 85%;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }

        /* Thin loading progress line beneath the word */
        .loading-line-wrapper {
          width: 130px;
          height: 2px;
          background: rgba(0, 0, 0, 0.08);
          border-radius: 2px;
          margin-top: 14px;
          overflow: hidden;
          position: relative;
          will-change: transform, opacity;
          transition: transform 0.3s ease, opacity 0.3s ease;
        }

        .loading-line-progress {
          height: 100%;
          background: #2b579a;
          width: 0%;
          animation: progressCalm 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          will-change: width;
        }

        @keyframes progressCalm {
          0% { width: 0%; }
          30% { width: 35%; }
          60% { width: 65%; }
          85% { width: 85%; }
          100% { width: 92%; }
        }

        /* ACT 1: Quiet & Suspicious */
        .act-1 .letter-o {
          animation: twitchO 0.5s ease 0.3s forwards;
        }
        .act-1 .letter-d {
          animation: subtleD 0.7s cubic-bezier(0.25, 1, 0.5, 1) 0.2s forwards;
        }

        @keyframes twitchO {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(0, -2px, 0) rotate(-4deg); }
          100% { transform: translate3d(0,0,0) rotate(0deg); }
        }

        @keyframes subtleD {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          40% { transform: translate3d(-2px, -3px, 0) rotate(-12deg); }
          65% { transform: translate3d(-1px, -1px, 0) rotate(-6deg); }
          100% { transform: translate3d(0,0,0) rotate(0deg); }
        }

        /* ACT 2: Rebellion Spreads */
        .act-2 .letter-d {
          animation: rebelCommitD 0.75s cubic-bezier(0.25, 1, 0.35, 1) forwards;
        }
        .act-2 .letter-a {
          animation: dominoA 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.15s forwards;
        }
        .act-2 .letter-o {
          animation: dominoO 0.55s ease 0.3s forwards;
        }
        .act-2 .letter-l {
          animation: dominoL 0.5s ease 0.42s forwards;
        }
        .act-2 .letter-i {
          animation: dominoI 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s forwards;
        }
        .act-2 .letter-n {
          animation: dominoN 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s forwards;
        }
        .act-2 .letter-g {
          animation: dominoG 0.5s ease 0.45s forwards;
        }

        @keyframes rebelCommitD {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          25% { transform: translate3d(-5px, -4px, 0) rotate(-18deg); }
          45% { transform: translate3d(-2px, 0, 0) rotate(-8deg); }
          75% { transform: translate3d(14px, 2px, 0) rotate(26deg); }
          100% { transform: translate3d(10px, 0, 0) rotate(14deg); }
        }

        @keyframes dominoA {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(-6px, -2px, 0) rotate(-14deg); }
          100% { transform: translate3d(-4px, 1px, 0) rotate(-8deg); }
        }

        @keyframes dominoO {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(-10px, 2px, 0) rotate(-22deg); }
        }

        @keyframes dominoL {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(-6px, -3px, 0) rotate(-12deg); }
        }

        @keyframes dominoI {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(14px, 3px, 0) rotate(20deg); }
        }

        @keyframes dominoN {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(18px, -2px, 0) rotate(-16deg); }
        }

        @keyframes dominoG {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(10px, -4px, 0) rotate(-10deg); }
        }

        /* ACT 3: Loading Line Gives Up */
        .act-3 .loading-line-wrapper,
        .act-4 .loading-line-wrapper,
        .act-5 .loading-line-wrapper {
          animation: lineWaverCollapse 0.6s ease forwards;
        }

        @keyframes lineWaverCollapse {
          0% { transform: scaleX(1) rotate(0deg); opacity: 1; }
          30% { transform: scaleX(0.9) rotate(3deg) translate3d(0, 3px, 0); opacity: 0.8; }
          60% { transform: scaleX(0.7) rotate(-5deg) translate3d(0, 8px, 0); opacity: 0.4; }
          100% { transform: scaleX(0) rotate(15deg) translate3d(0, 18px, 0); opacity: 0; }
        }

        .act-3 .letter-d {
          animation: breakFreeD 0.7s cubic-bezier(0.34, 1.3, 0.64, 1) forwards;
        }
        .act-3 .letter-a {
          animation: shiftA 0.6s ease forwards;
        }
        .act-3 .letter-i {
          animation: shiftI 0.6s ease forwards;
        }

        @keyframes breakFreeD {
          100% { transform: translate3d(16px, -24px, 0) rotate(-35deg); }
        }
        @keyframes shiftA {
          100% { transform: translate3d(-8px, -6px, 0) rotate(18deg); }
        }
        @keyframes shiftI {
          100% { transform: translate3d(20px, 14px, 0) rotate(32deg); }
        }

        /* ACT 4: Cartoon Free-Fall */
        .act-4 .letter-l, .act-5 .letter-l { animation: freefallL 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards; }
        .act-4 .letter-o, .act-5 .letter-o { animation: freefallO 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.04s forwards; }
        .act-4 .letter-a, .act-5 .letter-a { animation: freefallA 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.02s forwards; }
        .act-4 .letter-d, .act-5 .letter-d { animation: freefallD 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.06s forwards; }
        .act-4 .letter-n, .act-5 .letter-n { animation: freefallN 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.05s forwards; }
        .act-4 .letter-g, .act-5 .letter-g { animation: freefallG 0.85s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.08s forwards; }

        /* 'i' hangs at the top (coyote time) while others fall */
        .act-4 .letter-i {
          animation: hangI 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes hangI {
          0% { transform: translate3d(20px, 14px, 0) rotate(32deg); }
          /* Suspended in midair beat */
          40% { transform: translate3d(20px, -30px, 0) rotate(-15deg) scale(1.1); }
          100% { transform: translate3d(20px, -45px, 0) rotate(-8deg) scale(1.15); }
        }

        @keyframes freefallL {
          0% { transform: translate3d(-6px, -3px, 0) rotate(-12deg); }
          25% { transform: translate3d(-8px, -12px, 0) rotate(-20deg); } /* coyote pause */
          100% { transform: translate3d(-20px, 110vh, 0) rotate(-180deg); opacity: 0.9; }
        }
        @keyframes freefallO {
          0% { transform: translate3d(-10px, 2px, 0) rotate(-22deg); }
          25% { transform: translate3d(-12px, -8px, 0) rotate(-30deg); }
          100% { transform: translate3d(-35px, 110vh, 0) rotate(360deg); opacity: 0.9; }
        }
        @keyframes freefallA {
          0% { transform: translate3d(-8px, -6px, 0) rotate(18deg); }
          25% { transform: translate3d(-10px, -15px, 0) rotate(25deg); }
          100% { transform: translate3d(-15px, 110vh, 0) rotate(240deg); opacity: 0.9; }
        }
        @keyframes freefallD {
          0% { transform: translate3d(16px, -24px, 0) rotate(-35deg); }
          25% { transform: translate3d(16px, -32px, 0) rotate(-45deg); }
          100% { transform: translate3d(30px, 110vh, 0) rotate(-420deg); opacity: 0.9; }
        }
        @keyframes freefallN {
          0% { transform: translate3d(18px, -2px, 0) rotate(-16deg); }
          25% { transform: translate3d(18px, -10px, 0) rotate(-22deg); }
          100% { transform: translate3d(25px, 110vh, 0) rotate(270deg); opacity: 0.9; }
        }
        @keyframes freefallG {
          0% { transform: translate3d(10px, -4px, 0) rotate(-10deg); }
          25% { transform: translate3d(10px, -12px, 0) rotate(-15deg); }
          100% { transform: translate3d(40px, 110vh, 0) rotate(-300deg); opacity: 0.9; }
        }

        /* ACT 5: The final 'i' pulls the background down vertically */
        .act-5 .letter-i {
          animation: pullDownI 0.75s cubic-bezier(0.7, 0, 0.2, 1) forwards;
        }

        @keyframes pullDownI {
          0% { transform: translate3d(20px, -45px, 0) rotate(-8deg) scale(1.15); }
          20% { transform: translate3d(20px, -20px, 0) rotate(12deg) scale(1.25); }
          100% { transform: translate3d(20px, 120vh, 0) rotate(45deg) scale(1); }
        }

        .loader-vertical-pull-active {
          animation: pullDownOverlay 0.75s cubic-bezier(0.7, 0, 0.2, 1) forwards;
        }

        @keyframes pullDownOverlay {
          0% { transform: translate3d(0, 0%, 0); }
          100% { transform: translate3d(0, 105%, 0); }
        }

        /* Reduced motion support */
        .loader-reduced-motion {
          animation: fadeOverlayReduced 0.4s ease forwards !important;
        }
        .loader-reduced-motion .rebellious-letter,
        .loader-reduced-motion .loading-line-wrapper {
          animation: none !important;
          transform: none !important;
        }
        @keyframes fadeOverlayReduced {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <div className={`rebellious-container act-${act}`}>
        <div className="rebellious-word">
          <span className="rebellious-letter letter-l">l</span>
          <span className="rebellious-letter letter-o">o</span>
          <span className="rebellious-letter letter-a">a</span>
          <span className="rebellious-letter letter-d">d</span>
          <span className="rebellious-letter letter-i">i</span>
          <span className="rebellious-letter letter-n">n</span>
          <span className="rebellious-letter letter-g">g</span>
        </div>

        <div className="loading-line-wrapper">
          <div className="loading-line-progress" />
        </div>
      </div>
    </div>
  );
}
