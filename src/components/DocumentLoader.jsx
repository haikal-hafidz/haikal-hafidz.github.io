import { useState, useEffect, useRef } from 'react';

export default function DocumentLoader({ isDataReady = true, onFinished }) {
  const [act, setAct] = useState(1); // 1: Suspicion (0-2.4s), 2: Rebellion (2.4-4.8s), 3: Collapse (4.8-7.2s), 4: Free-fall (7.2s+), 5: Final Pull
  const containerRef = useRef(null);

  useEffect(() => {
    // Act 1 -> Act 2 (Rebellion starts) at 2400ms
    const timer1 = setTimeout(() => {
      setAct(2);
    }, 2400);

    // Act 2 -> Act 3 (Line collapses) at 4800ms
    const timer2 = setTimeout(() => {
      setAct(3);
    }, 4800);

    // Act 3 -> Act 4 (Free-fall) at 7200ms
    const timer3 = setTimeout(() => {
      setAct(4);
    }, 7200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Act 4 -> Act 5: Brief anticipation hold (~800ms) before final vertical pull when data is ready
  useEffect(() => {
    if (act >= 4 && isDataReady && act < 5) {
      const timer4 = setTimeout(() => {
        setAct(5);
      }, 800);
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
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Georgia", "Times New Roman", serif, sans-serif;
          font-size: 2.3rem;
          font-weight: 500;
          letter-spacing: -0.01em;
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
          width: 140px;
          height: 2px;
          background: rgba(0, 0, 0, 0.08);
          border-radius: 2px;
          margin-top: 16px;
          overflow: hidden;
          position: relative;
          will-change: transform, opacity;
          transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease;
        }

        .loading-line-progress {
          height: 100%;
          background: #2b579a;
          width: 0%;
          animation: progressCalm 9s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          will-change: width;
        }

        @keyframes progressCalm {
          0% { width: 0%; }
          30% { width: 35%; }
          60% { width: 70%; }
          100% { width: 92%; }
        }

        /* ACT 1: Suspicion (0-2.4s) — 'o' twitches first, 'd' reacts afterward */
        .act-1 .letter-o {
          animation: twitchO 1.0s cubic-bezier(0.25, 1, 0.5, 1) 0.8s forwards;
        }
        .act-1 .letter-d {
          animation: subtleD 1.2s cubic-bezier(0.25, 1, 0.35, 1) 1.5s forwards;
        }

        @keyframes twitchO {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          35% { transform: translate3d(0, -3px, 0) rotate(-6deg); }
          70% { transform: translate3d(0, -1px, 0) rotate(-2deg); }
          100% { transform: translate3d(0,0,0) rotate(0deg); }
        }

        @keyframes subtleD {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          40% { transform: translate3d(-3px, -4px, 0) rotate(-12deg); }
          75% { transform: translate3d(-1px, -1px, 0) rotate(-4deg); }
          100% { transform: translate3d(0,0,0) rotate(0deg); }
        }

        /* ACT 2: Rebellion (2.4-4.8s) — 'd' initiates disorder, domino reaction spreads outwards */
        .act-2 .letter-d {
          animation: rebelCommitD 1.6s cubic-bezier(0.25, 1, 0.35, 1) forwards;
        }
        .act-2 .letter-a {
          animation: dominoA 1.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s forwards;
        }
        .act-2 .letter-i {
          animation: dominoI 1.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards;
        }
        .act-2 .letter-o {
          animation: dominoO 1.3s ease 0.6s forwards;
        }
        .act-2 .letter-n {
          animation: dominoN 1.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s forwards;
        }
        .act-2 .letter-l {
          animation: dominoL 1.2s ease 0.9s forwards;
        }
        .act-2 .letter-g {
          animation: dominoG 1.2s ease 1.0s forwards;
        }

        @keyframes rebelCommitD {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          25% { transform: translate3d(-6px, -5px, 0) rotate(-20deg); }
          50% { transform: translate3d(-2px, 0, 0) rotate(-8deg); }
          80% { transform: translate3d(14px, 2px, 0) rotate(26deg); }
          100% { transform: translate3d(12px, 0, 0) rotate(16deg); }
        }

        @keyframes dominoA {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(-7px, -3px, 0) rotate(-16deg); }
          100% { transform: translate3d(-5px, 2px, 0) rotate(-10deg); }
        }

        @keyframes dominoI {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(16px, 4px, 0) rotate(22deg); }
        }

        @keyframes dominoO {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(-12px, 3px, 0) rotate(-24deg); }
        }

        @keyframes dominoN {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(20px, -3px, 0) rotate(-18deg); }
        }

        @keyframes dominoL {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(-8px, -4px, 0) rotate(-14deg); }
        }

        @keyframes dominoG {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(12px, -5px, 0) rotate(-12deg); }
        }

        /* ACT 3: Collapse (4.8-7.2s) — Loading line wavers and collapses, letters become unbalanced as 'd' leaps up */
        .act-3 .loading-line-wrapper,
        .act-4 .loading-line-wrapper,
        .act-5 .loading-line-wrapper {
          animation: lineWaverCollapse 2.0s ease forwards;
        }

        @keyframes lineWaverCollapse {
          0% { transform: scaleX(1) rotate(0deg); opacity: 1; }
          30% { transform: scaleX(0.85) rotate(4deg) translate3d(0, 4px, 0); opacity: 0.8; }
          65% { transform: scaleX(0.6) rotate(-7deg) translate3d(0, 10px, 0); opacity: 0.4; }
          100% { transform: scaleX(0) rotate(20deg) translate3d(0, 24px, 0); opacity: 0; }
        }

        .act-3 .letter-d {
          animation: breakFreeD 2.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .act-3 .letter-a {
          animation: shiftA 1.8s ease forwards;
        }
        .act-3 .letter-i {
          animation: shiftI 1.8s ease forwards;
        }

        @keyframes breakFreeD {
          0% { transform: translate3d(12px, 0, 0) rotate(16deg); }
          100% { transform: translate3d(10px, -48px, 0) rotate(-18deg) scale(1.12); }
        }
        @keyframes shiftA {
          0% { transform: translate3d(-5px, 2px, 0) rotate(-10deg); }
          100% { transform: translate3d(-10px, -6px, 0) rotate(18deg); }
        }
        @keyframes shiftI {
          0% { transform: translate3d(16px, 4px, 0) rotate(22deg); }
          100% { transform: translate3d(22px, 14px, 0) rotate(32deg); }
        }

        /* ACT 4: Free-fall — Disrupted letters fall with coherent trajectories while 'd' hovers in anticipation */
        .act-4 .letter-l, .act-5 .letter-l { animation: freefallL 2.2s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards; }
        .act-4 .letter-o, .act-5 .letter-o { animation: freefallO 2.2s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.08s forwards; }
        .act-4 .letter-a, .act-5 .letter-a { animation: freefallA 2.2s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.04s forwards; }
        .act-4 .letter-i, .act-5 .letter-i { animation: freefallI 2.2s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.14s forwards; }
        .act-4 .letter-n, .act-5 .letter-n { animation: freefallN 2.2s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.10s forwards; }
        .act-4 .letter-g, .act-5 .letter-g { animation: freefallG 2.2s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.16s forwards; }

        .act-4 .letter-d {
          transform: translate3d(10px, -48px, 0) rotate(-18deg) scale(1.12);
          animation: holdD 0.8s linear forwards;
        }

        @keyframes holdD {
          0% { transform: translate3d(10px, -48px, 0) rotate(-18deg) scale(1.12); }
          100% { transform: translate3d(10px, -48px, 0) rotate(-18deg) scale(1.12); }
        }

        @keyframes freefallL {
          0% { transform: translate3d(-8px, -4px, 0) rotate(-14deg); }
          30% { transform: translate3d(-10px, -12px, 0) rotate(-20deg); }
          100% { transform: translate3d(-25px, 110vh, 0) rotate(-210deg); opacity: 0.9; }
        }
        @keyframes freefallO {
          0% { transform: translate3d(-12px, 3px, 0) rotate(-24deg); }
          30% { transform: translate3d(-14px, -8px, 0) rotate(-30deg); }
          100% { transform: translate3d(-40px, 110vh, 0) rotate(380deg); opacity: 0.9; }
        }
        @keyframes freefallA {
          0% { transform: translate3d(-10px, -6px, 0) rotate(18deg); }
          30% { transform: translate3d(-12px, -14px, 0) rotate(26deg); }
          100% { transform: translate3d(-20px, 110vh, 0) rotate(270deg); opacity: 0.9; }
        }
        @keyframes freefallI {
          0% { transform: translate3d(22px, 14px, 0) rotate(32deg); }
          30% { transform: translate3d(22px, 0px, 0) rotate(18deg); }
          100% { transform: translate3d(20px, 110vh, 0) rotate(340deg); opacity: 0.9; }
        }
        @keyframes freefallN {
          0% { transform: translate3d(20px, -3px, 0) rotate(-18deg); }
          30% { transform: translate3d(20px, -10px, 0) rotate(-22deg); }
          100% { transform: translate3d(30px, 110vh, 0) rotate(300deg); opacity: 0.9; }
        }
        @keyframes freefallG {
          0% { transform: translate3d(12px, -5px, 0) rotate(-12deg); }
          30% { transform: translate3d(12px, -12px, 0) rotate(-16deg); }
          100% { transform: translate3d(45px, 110vh, 0) rotate(-320deg); opacity: 0.9; }
        }

        /* ACT 5: Final Pull — 'd' plunges down, dragging the loader overlay down vertically to reveal website */
        .act-5 .letter-d {
          animation: pullDownD 1.3s cubic-bezier(0.5, 0, 0.75, 0.2) forwards;
        }

        @keyframes pullDownD {
          0% { transform: translate3d(10px, -48px, 0) rotate(-18deg) scale(1.12); }
          100% { transform: translate3d(10px, 110vh, 0) rotate(25deg) scale(1); }
        }

        .loader-vertical-pull-active {
          animation: pullDownOverlay 1.3s cubic-bezier(0.5, 0, 0.75, 0.2) forwards;
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
