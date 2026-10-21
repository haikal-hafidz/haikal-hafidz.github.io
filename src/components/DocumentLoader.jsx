import { useState, useEffect, useRef } from 'react';

export default function DocumentLoader({ isDataReady = true, onFinished }) {
  const [act, setAct] = useState(1); // 1: Quiet/Suspicious (0-3s), 2: Rebellion Spreads (3-6s), 3: Line Collapse (6-9s), 4: Free-fall (9-12s), 5: Vertical Pull (12-15s)
  const containerRef = useRef(null);

  useEffect(() => {
    // Act 1 -> Act 2 (Rebellion starts trouble) at 3000ms
    const timer1 = setTimeout(() => {
      setAct(2);
    }, 3000);

    // Act 2 -> Act 3 (Line loses control & collapses) at 6000ms
    const timer2 = setTimeout(() => {
      setAct(3);
    }, 6000);

    // Act 3 -> Act 4 (Suspended cartoon fall) at 9000ms
    const timer3 = setTimeout(() => {
      setAct(4);
    }, 9000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // Act 4 -> Act 5 (Final 'd' holds motionless for 1.5s then pulls background down) at 10500ms when isDataReady is true
  useEffect(() => {
    if (act >= 4 && isDataReady && act < 5) {
      const timer4 = setTimeout(() => {
        setAct(5);
      }, 1500); // 9000 + 1500 = 10500ms (exactly 1.5s motionless hold)
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
          animation: progressCalm 11s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          will-change: width;
        }

        @keyframes progressCalm {
          0% { width: 0%; }
          25% { width: 30%; }
          50% { width: 60%; }
          75% { width: 82%; }
          100% { width: 95%; }
        }

        /* ACT 1: Quiet & Suspicious (0-3s) */
        .act-1 .letter-o {
          animation: twitchO 1.2s cubic-bezier(0.25, 1, 0.5, 1) 1.2s forwards;
        }
        .act-1 .letter-d {
          animation: subtleD 1.6s cubic-bezier(0.25, 1, 0.35, 1) 2.0s forwards;
        }

        @keyframes twitchO {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          30% { transform: translate3d(0, -3px, 0) rotate(-5deg); }
          70% { transform: translate3d(0, -1px, 0) rotate(-2deg); }
          100% { transform: translate3d(0,0,0) rotate(0deg); }
        }

        @keyframes subtleD {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          40% { transform: translate3d(-3px, -4px, 0) rotate(-14deg); }
          70% { transform: translate3d(-1px, -1px, 0) rotate(-5deg); }
          100% { transform: translate3d(0,0,0) rotate(0deg); }
        }

        /* ACT 2: Rebellion Spreads (3-6s) */
        .act-2 .letter-d {
          animation: rebelCommitD 1.8s cubic-bezier(0.25, 1, 0.35, 1) forwards;
        }
        .act-2 .letter-a {
          animation: dominoA 1.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.6s forwards;
        }
        .act-2 .letter-o {
          animation: dominoO 1.4s ease 1.0s forwards;
        }
        .act-2 .letter-l {
          animation: dominoL 1.3s ease 1.3s forwards;
        }
        .act-2 .letter-i {
          animation: dominoI 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s forwards;
        }
        .act-2 .letter-n {
          animation: dominoN 1.4s cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s forwards;
        }
        .act-2 .letter-g {
          animation: dominoG 1.3s ease 1.5s forwards;
        }

        @keyframes rebelCommitD {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          25% { transform: translate3d(-6px, -5px, 0) rotate(-20deg); }
          45% { transform: translate3d(-2px, 0, 0) rotate(-8deg); }
          75% { transform: translate3d(16px, 3px, 0) rotate(28deg); }
          100% { transform: translate3d(12px, 0, 0) rotate(16deg); }
        }

        @keyframes dominoA {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          50% { transform: translate3d(-7px, -3px, 0) rotate(-16deg); }
          100% { transform: translate3d(-5px, 2px, 0) rotate(-10deg); }
        }

        @keyframes dominoO {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(-12px, 3px, 0) rotate(-24deg); }
        }

        @keyframes dominoL {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(-8px, -4px, 0) rotate(-14deg); }
        }

        @keyframes dominoI {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(16px, 4px, 0) rotate(22deg); }
        }

        @keyframes dominoN {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(20px, -3px, 0) rotate(-18deg); }
        }

        @keyframes dominoG {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          100% { transform: translate3d(12px, -5px, 0) rotate(-12deg); }
        }

        /* ACT 3: Loading Line Gives Up (6-9s) */
        .act-3 .loading-line-wrapper,
        .act-4 .loading-line-wrapper,
        .act-5 .loading-line-wrapper {
          animation: lineWaverCollapse 2.2s ease forwards;
        }

        @keyframes lineWaverCollapse {
          0% { transform: scaleX(1) rotate(0deg); opacity: 1; }
          30% { transform: scaleX(0.85) rotate(4deg) translate3d(0, 4px, 0); opacity: 0.8; }
          65% { transform: scaleX(0.6) rotate(-7deg) translate3d(0, 10px, 0); opacity: 0.4; }
          100% { transform: scaleX(0) rotate(20deg) translate3d(0, 24px, 0); opacity: 0; }
        }

        .act-3 .letter-d {
          animation: breakFreeD 3.0s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .act-3 .letter-a {
          animation: shiftA 2.0s ease forwards;
        }
        .act-3 .letter-i {
          animation: shiftI 2.0s ease forwards;
        }

        @keyframes breakFreeD {
          0% { transform: translate3d(12px, 0, 0) rotate(16deg); }
          100% { transform: translate3d(10px, -52px, 0) rotate(-18deg) scale(1.15); }
        }
        @keyframes shiftA {
          0% { transform: translate3d(-5px, 2px, 0) rotate(-10deg); }
          100% { transform: translate3d(-10px, -8px, 0) rotate(20deg); }
        }
        @keyframes shiftI {
          0% { transform: translate3d(16px, 4px, 0) rotate(22deg); }
          100% { transform: translate3d(24px, 18px, 0) rotate(35deg); }
        }

        /* ACT 4: Suspended Cartoon Fall (9-12s) */
        .act-4 .letter-l, .act-5 .letter-l { animation: freefallL 2.6s cubic-bezier(0.55, 0.085, 0.68, 0.53) forwards; }
        .act-4 .letter-o, .act-5 .letter-o { animation: freefallO 2.6s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.1s forwards; }
        .act-4 .letter-a, .act-5 .letter-a { animation: freefallA 2.6s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.05s forwards; }
        .act-4 .letter-i, .act-5 .letter-i { animation: freefallI 2.6s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.18s forwards; }
        .act-4 .letter-n, .act-5 .letter-n { animation: freefallN 2.6s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.12s forwards; }
        .act-4 .letter-g, .act-5 .letter-g { animation: freefallG 2.6s cubic-bezier(0.55, 0.085, 0.68, 0.53) 0.2s forwards; }

        /* In Act 4, 'd' is already at its final apex suspended position from Act 3 and remains completely motionless for the full 1.5s hold */
        .act-4 .letter-d {
          transform: translate3d(10px, -52px, 0) rotate(-18deg) scale(1.15);
          animation: freezeD 1.5s linear forwards;
        }

        @keyframes freezeD {
          0% { transform: translate3d(10px, -52px, 0) rotate(-18deg) scale(1.15); }
          100% { transform: translate3d(10px, -52px, 0) rotate(-18deg) scale(1.15); }
        }

        @keyframes freefallL {
          0% { transform: translate3d(-8px, -4px, 0) rotate(-14deg); }
          35% { transform: translate3d(-10px, -15px, 0) rotate(-22deg); } /* coyote pause hold */
          100% { transform: translate3d(-25px, 110vh, 0) rotate(-210deg); opacity: 0.9; }
        }
        @keyframes freefallO {
          0% { transform: translate3d(-12px, 3px, 0) rotate(-24deg); }
          35% { transform: translate3d(-14px, -10px, 0) rotate(-32deg); }
          100% { transform: translate3d(-40px, 110vh, 0) rotate(400deg); opacity: 0.9; }
        }
        @keyframes freefallA {
          0% { transform: translate3d(-10px, -8px, 0) rotate(20deg); }
          35% { transform: translate3d(-12px, -18px, 0) rotate(28deg); }
          100% { transform: translate3d(-20px, 110vh, 0) rotate(280deg); opacity: 0.9; }
        }
        @keyframes freefallI {
          0% { transform: translate3d(24px, 18px, 0) rotate(35deg); }
          35% { transform: translate3d(24px, 0px, 0) rotate(20deg); }
          100% { transform: translate3d(20px, 110vh, 0) rotate(360deg); opacity: 0.9; }
        }
        @keyframes freefallN {
          0% { transform: translate3d(20px, -3px, 0) rotate(-18deg); }
          35% { transform: translate3d(20px, -12px, 0) rotate(-24deg); }
          100% { transform: translate3d(30px, 110vh, 0) rotate(320deg); opacity: 0.9; }
        }
        @keyframes freefallG {
          0% { transform: translate3d(12px, -5px, 0) rotate(-12deg); }
          35% { transform: translate3d(12px, -15px, 0) rotate(-18deg); }
          100% { transform: translate3d(45px, 110vh, 0) rotate(-340deg); opacity: 0.9; }
        }

        /* ACT 5: The final 'd' falls immediately after the 1.5s hold, dragging the background down vertically (11-13s) */
        .act-5 .letter-d {
          animation: pullDownD 1.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
        }

        @keyframes pullDownD {
          0% { transform: translate3d(10px, -52px, 0) rotate(-18deg) scale(1.15); }
          100% { transform: translate3d(10px, 110vh, 0) rotate(25deg) scale(1); }
        }

        .loader-vertical-pull-active {
          animation: pullDownOverlay 1.8s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
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
