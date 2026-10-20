import { useState, useEffect, useRef } from 'react';

export default function DocumentLoader({ isDataReady = true, onFinished }) {
  const [act, setAct] = useState(1); // 1: Order, 2: First rebellion, 3: Contagion, 4: Climax/Scatter, 5: Uncover drag
  const actRef = useRef(act);
  actRef.current = act;

  // Act timers setup
  useEffect(() => {
    // Act 1 -> Act 2 (Rebellion of 'd') at 600ms
    const timer1 = setTimeout(() => {
      setAct(2);
    }, 600);

    // Act 2 -> Act 3 (Contagion chain reaction) at 1400ms
    const timer2 = setTimeout(() => {
      setAct(3);
    }, 1400);

    // Act 3 -> Act 4 (Climax & scatter) at 2400ms
    const timer3 = setTimeout(() => {
      setAct(4);
    }, 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  // When Act 4 is reached, wait for `isDataReady` to trigger Act 5 (Uncover drag) at ~3200ms
  useEffect(() => {
    if (act >= 4 && isDataReady && act < 5) {
      const timer4 = setTimeout(() => {
        setAct(5);
      }, 800); // 2400 + 800 = 3200ms
      return () => clearTimeout(timer4);
    }
  }, [act, isDataReady]);

  // Handle Act 5 completion
  const handleUncoverEnd = () => {
    onFinished?.();
  };

  // For reduced motion preference
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
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#F3F3F3] text-[#1a1a1a] select-none overflow-hidden ${
        act === 5 ? 'loader-uncover-active' : ''
      } ${reducedMotion ? 'loader-reduced-motion' : ''}`}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && act === 5) {
          handleUncoverEnd();
        }
      }}
      role="status"
      aria-label="Membuka dokumen portofolio"
    >
      <style>{`
        /* Continuous clean editorial sans typography */
        .rebellious-word {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 1.75rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          display: inline-flex;
          align-items: baseline;
          position: relative;
        }

        .rebellious-letter {
          display: inline-block;
          transform-origin: 50% 80%;
          will-change: transform;
          transition: transform 0.25s cubic-bezier(0.2, 0, 0.2, 1);
        }

        /* Act 2: 'd' instigator rebellion */
        .act-2 .letter-d {
          animation: rebelD 0.8s cubic-bezier(0.25, 1, 0.35, 1) forwards;
        }
        .act-2 .letter-i {
          animation: victimI 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.45s forwards;
        }
        .act-2 .letter-a {
          animation: flinchA 0.4s ease 0.15s forwards;
        }

        @keyframes rebelD {
          0% { transform: translate(0, 0) rotate(0deg); }
          /* Anticipation */
          25% { transform: translate(-4px, -3px) rotate(-14deg); }
          /* Brief pause/recovery before lunge */
          40% { transform: translate(-2px, 0px) rotate(-8deg); }
          /* Momentum lunge into 'i' */
          70% { transform: translate(12px, 1px) rotate(24deg); }
          /* Recovery rebound */
          100% { transform: translate(8px, 0px) rotate(12deg); }
        }

        @keyframes victimI {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(16px, -2px) rotate(22deg); }
          100% { transform: translate(12px, 1px) rotate(14deg); }
        }

        @keyframes flinchA {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-2px, 0) rotate(-4deg); }
          100% { transform: translate(4px, 0) rotate(6deg); }
        }

        /* Act 3: Contagion across the word */
        .act-3 .letter-l {
          animation: reactL 0.6s ease 0.2s forwards;
        }
        .act-3 .letter-o {
          animation: reactO 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards;
        }
        .act-3 .letter-a {
          animation: reactA 0.7s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .act-3 .letter-d {
          animation: breakD 0.8s cubic-bezier(0.34, 1.3, 0.64, 1) forwards;
        }
        .act-3 .letter-i {
          animation: reactI 0.7s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .act-3 .letter-n {
          animation: reactN 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s forwards;
        }
        .act-3 .letter-g {
          animation: reactG 0.6s ease 0.3s forwards;
        }

        @keyframes reactL {
          100% { transform: translate(-6px, -2px) rotate(-10deg); }
        }
        @keyframes reactO {
          100% { transform: translate(-12px, 2px) rotate(-22deg); }
        }
        @keyframes reactA {
          100% { transform: translate(6px, -4px) rotate(16deg); }
        }
        @keyframes breakD {
          /* 'd' breaks baseline completely */
          100% { transform: translate(18px, -22px) rotate(-32deg); }
        }
        @keyframes reactI {
          100% { transform: translate(18px, 12px) rotate(28deg); }
        }
        @keyframes reactN {
          100% { transform: translate(22px, 6px) rotate(-18deg); }
        }
        @keyframes reactG {
          100% { transform: translate(12px, -3px) rotate(-12deg); }
        }

        /* Act 4: Major Climax & Scatter */
        .act-4 .letter-l, .act-5 .letter-l {
          animation: scatterL 0.7s cubic-bezier(0.5, 0, 0.75, 0) forwards;
        }
        .act-4 .letter-o, .act-5 .letter-o {
          animation: scatterO 0.7s cubic-bezier(0.5, 0, 0.75, 0) forwards;
        }
        .act-4 .letter-a, .act-5 .letter-a {
          animation: scatterA 0.7s cubic-bezier(0.5, 0, 0.75, 0) forwards;
        }
        .act-4 .letter-d, .act-5 .letter-d {
          animation: scatterD 0.7s cubic-bezier(0.5, 0, 0.75, 0) forwards;
        }
        .act-4 .letter-i, .act-5 .letter-i {
          animation: scatterI 0.7s cubic-bezier(0.5, 0, 0.75, 0) forwards;
        }
        .act-4 .letter-n, .act-5 .letter-n {
          animation: scatterN 0.7s cubic-bezier(0.5, 0, 0.75, 0) forwards;
        }
        .act-4 .letter-g {
          animation: prepG 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes scatterL {
          100% { transform: translate(-120vw, -80vh) rotate(-280deg); opacity: 0; }
        }
        @keyframes scatterO {
          100% { transform: translate(-100vw, 90vh) rotate(360deg); opacity: 0; }
        }
        @keyframes scatterA {
          100% { transform: translate(-30vw, -120vh) rotate(220deg); opacity: 0; }
        }
        @keyframes scatterD {
          100% { transform: translate(110vw, -110vh) rotate(540deg); opacity: 0; }
        }
        @keyframes scatterI {
          100% { transform: translate(20vw, 120vh) rotate(-180deg); opacity: 0; }
        }
        @keyframes scatterN {
          100% { transform: translate(120vw, -40vh) rotate(320deg); opacity: 0; }
        }
        @keyframes prepG {
          0% { transform: translate(12px, -3px) rotate(-12deg); }
          100% { transform: translate(45px, 0px) rotate(-28deg) scale(1.15); }
        }

        /* Act 5: Uncover Drag Transition */
        .act-5 .letter-g {
          animation: dragPullG 0.75s cubic-bezier(0.7, 0, 0.2, 1) forwards;
        }

        @keyframes dragPullG {
          0% { transform: translate(45px, 0px) rotate(-28deg) scale(1.15); }
          20% { transform: translate(30px, 0px) rotate(-35deg) scale(1.25); }
          100% { transform: translate(120vw, 0px) rotate(15deg) scale(1); }
        }

        .loader-uncover-active {
          animation: uncoverDragOverlay 0.75s cubic-bezier(0.7, 0, 0.2, 1) forwards;
        }

        @keyframes uncoverDragOverlay {
          0% { transform: translateX(0%); }
          100% { transform: translateX(105%); }
        }

        /* Reduced motion support */
        .loader-reduced-motion {
          animation: fadeOverlayReduced 0.4s ease forwards !important;
        }
        .loader-reduced-motion .rebellious-letter {
          animation: none !important;
          transform: none !important;
        }
        @keyframes fadeOverlayReduced {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      <div
        className={`rebellious-word act-${act}`}
        aria-hidden="true"
      >
        <span className="rebellious-letter letter-l">l</span>
        <span className="rebellious-letter letter-o">o</span>
        <span className="rebellious-letter letter-a">a</span>
        <span className="rebellious-letter letter-d">d</span>
        <span className="rebellious-letter letter-i">i</span>
        <span className="rebellious-letter letter-n">n</span>
        <span className="rebellious-letter letter-g">g</span>
      </div>
    </div>
  );
}
