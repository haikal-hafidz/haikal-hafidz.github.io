import { useState, useEffect, useRef } from 'react';

export default function DocumentLoader({ isDataReady = true, onFinished }) {
  const [act, setAct] = useState(1); // 1: Suspicion (0-2.2s), 2: Rebellion (2.2-4.4s), 3: Collective Fall & Line Collapse (4.4s+), 4: Vertical Pull
  const containerRef = useRef(null);

  useEffect(() => {
    // Act 1 -> Act 2 (Rebellion) at 2200ms
    const timer1 = setTimeout(() => {
      setAct(2);
    }, 2200);

    // Act 2 -> Act 3 (Collective fall & line collapse) at 4400ms
    const timer2 = setTimeout(() => {
      setAct(3);
    }, 4400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Act 3 -> Act 4: 'd' plunges down and initiates background vertical pull when data is ready
  useEffect(() => {
    if (act >= 3 && isDataReady && act < 4) {
      const timer3 = setTimeout(() => {
        setAct(4);
      }, 700);
      return () => clearTimeout(timer3);
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
        act === 4 ? 'loader-vertical-pull-active' : ''
      } ${reducedMotion ? 'loader-reduced-motion' : ''}`}
      onAnimationEnd={(e) => {
        if (e.target === containerRef.current && act === 4) {
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
          animation: progressCalm 6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          will-change: width;
        }

        @keyframes progressCalm {
          0% { width: 0%; }
          30% { width: 40%; }
          60% { width: 75%; }
          100% { width: 95%; }
        }

        /* ACT 1: Suspicion (0-2.2s) — 'o' twitches first, 'd' reacts afterward */
        .act-1 .letter-o {
          animation: twitchO 0.9s cubic-bezier(0.25, 1, 0.5, 1) 0.6s forwards;
        }
        .act-1 .letter-d {
          animation: subtleD 1.0s cubic-bezier(0.25, 1, 0.35, 1) 1.2s forwards;
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

        /* ACT 2: Rebellion (2.2-4.4s) — 'd' initiates disorder, domino reaction spreads outwards */
        .act-2 .letter-d {
          animation: rebelCommitD 1.5s cubic-bezier(0.25, 1, 0.35, 1) forwards;
        }
        .act-2 .letter-a {
          animation: dominoA 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s forwards;
        }
        .act-2 .letter-i {
          animation: dominoI 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards;
        }
        .act-2 .letter-o {
          animation: dominoO 1.2s ease 0.5s forwards;
        }
        .act-2 .letter-n {
          animation: dominoN 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards;
        }
        .act-2 .letter-l {
          animation: dominoL 1.1s ease 0.8s forwards;
        }
        .act-2 .letter-g {
          animation: dominoG 1.1s ease 0.9s forwards;
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

        /* ACT 3: Line Collapse & Immediate Collective Fall — Loading line drops, ALL letters plummet continuously from their current positions */
        .act-3 .loading-line-wrapper,
        .act-4 .loading-line-wrapper {
          animation: lineWaverCollapse 1.4s ease forwards;
        }

        @keyframes lineWaverCollapse {
          0% { transform: scaleX(1) rotate(0deg); opacity: 1; }
          35% { transform: scaleX(0.8) rotate(4deg) translate3d(0, 6px, 0); opacity: 0.8; }
          70% { transform: scaleX(0.4) rotate(-8deg) translate3d(0, 16px, 0); opacity: 0.3; }
          100% { transform: scaleX(0) rotate(20deg) translate3d(0, 32px, 0); opacity: 0; }
        }

        /* All letters fall in one continuous sequence without pausing */
        .act-3 .letter-l, .act-4 .letter-l { animation: collectiveFallL 1.6s cubic-bezier(0.5, 0, 0.75, 0.2) forwards; }
        .act-3 .letter-o, .act-4 .letter-o { animation: collectiveFallO 1.6s cubic-bezier(0.5, 0, 0.75, 0.2) 0.05s forwards; }
        .act-3 .letter-a, .act-4 .letter-a { animation: collectiveFallA 1.6s cubic-bezier(0.5, 0, 0.75, 0.2) 0.02s forwards; }
        .act-3 .letter-i, .act-4 .letter-i { animation: collectiveFallI 1.6s cubic-bezier(0.5, 0, 0.75, 0.2) 0.08s forwards; }
        .act-3 .letter-n, .act-4 .letter-n { animation: collectiveFallN 1.6s cubic-bezier(0.5, 0, 0.75, 0.2) 0.06s forwards; }
        .act-3 .letter-g, .act-4 .letter-g { animation: collectiveFallG 1.6s cubic-bezier(0.5, 0, 0.75, 0.2) 0.10s forwards; }

        @keyframes collectiveFallL {
          0% { transform: translate3d(-8px, -4px, 0) rotate(-14deg); }
          100% { transform: translate3d(-25px, 110vh, 0) rotate(-210deg); opacity: 0.9; }
        }
        @keyframes collectiveFallO {
          0% { transform: translate3d(-12px, 3px, 0) rotate(-24deg); }
          100% { transform: translate3d(-40px, 110vh, 0) rotate(380deg); opacity: 0.9; }
        }
        @keyframes collectiveFallA {
          0% { transform: translate3d(-5px, 2px, 0) rotate(-10deg); }
          100% { transform: translate3d(-20px, 110vh, 0) rotate(270deg); opacity: 0.9; }
        }
        @keyframes collectiveFallI {
          0% { transform: translate3d(16px, 4px, 0) rotate(22deg); }
          100% { transform: translate3d(20px, 110vh, 0) rotate(340deg); opacity: 0.9; }
        }
        @keyframes collectiveFallN {
          0% { transform: translate3d(20px, -3px, 0) rotate(-18deg); }
          100% { transform: translate3d(30px, 110vh, 0) rotate(300deg); opacity: 0.9; }
        }
        @keyframes collectiveFallG {
          0% { transform: translate3d(12px, -5px, 0) rotate(-12deg); }
          100% { transform: translate3d(45px, 110vh, 0) rotate(-320deg); opacity: 0.9; }
        }

        /* Letter 'd' leaps slightly up and plunges down, pulling the background overlay with it */
        .act-3 .letter-d,
        .act-4 .letter-d {
          animation: pullDownD 1.6s cubic-bezier(0.4, 0, 0.7, 0.2) forwards;
        }

        @keyframes pullDownD {
          0% { transform: translate3d(12px, 0, 0) rotate(16deg); }
          25% { transform: translate3d(10px, -36px, 0) rotate(-18deg) scale(1.12); }
          100% { transform: translate3d(10px, 110vh, 0) rotate(25deg) scale(1); }
        }

        .loader-vertical-pull-active {
          animation: pullDownOverlay 1.3s cubic-bezier(0.4, 0, 0.7, 0.2) forwards;
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
