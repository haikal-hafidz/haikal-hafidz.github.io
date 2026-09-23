import { useEffect, useMemo, useState } from 'react';

const SPEEDS = {
  slow: { type: 115, pause: 3400 },
  normal: { type: 72, pause: 2700 },
  fast: { type: 42, pause: 2100 },
};

export default function DynamicStatement({ settings }) {
  const pairs = useMemo(() => (Array.isArray(settings?.pairs) ? settings.pairs : [])
    .map((pair) => ({ source: String(pair?.source || '').trim(), result: String(pair?.result || '').trim() }))
    .filter((pair) => pair.source && pair.result)
    .slice(0, 8), [settings]);
  const [pairIndex, setPairIndex] = useState(0);
  const [sourceText, setSourceText] = useState(pairs[0]?.source || '');
  const [resultText, setResultText] = useState(pairs[0]?.result || '');
  const [phase, setPhase] = useState('idle');
  const motionReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const timing = SPEEDS[settings?.speed] || SPEEDS.normal;

  useEffect(() => {
    if (!pairs.length) return undefined;
    const safeIndex = pairIndex % pairs.length;
    const current = pairs[safeIndex];
    const next = pairs[(safeIndex + 1) % pairs.length];
    let delay = timing.type;

    if (motionReduced || pairs.length < 2 || settings?.enabled === false) {
      setSourceText(current.source);
      setResultText(current.result);
      setPhase('idle');
      return undefined;
    }

    if (phase === 'idle') delay = Number(settings?.pauseDuration) || timing.pause;
    if (phase === 'selectSource' || phase === 'selectResult') delay = 480;
    if (phase === 'deleteSource' || phase === 'deleteResult') delay = 170;

    const timer = window.setTimeout(() => {
      if (phase === 'idle') setPhase('selectSource');
      else if (phase === 'selectSource') setPhase('deleteSource');
      else if (phase === 'deleteSource') {
        setSourceText('');
        setPhase('typeSource');
      } else if (phase === 'typeSource') {
        if (sourceText.length < next.source.length) {
          setSourceText(next.source.slice(0, sourceText.length + 1));
        } else setPhase('selectResult');
      } else if (phase === 'selectResult') setPhase('deleteResult');
      else if (phase === 'deleteResult') {
        setResultText('');
        setPhase('typeResult');
      } else if (phase === 'typeResult') {
        if (resultText.length < next.result.length) {
          setResultText(next.result.slice(0, resultText.length + 1));
        } else {
          setPairIndex((safeIndex + 1) % pairs.length);
          setPhase('idle');
        }
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [pairIndex, pairs, phase, resultText, settings?.enabled, settings?.pauseDuration, sourceText, timing, motionReduced]);

  if (settings?.enabled === false || !pairs.length) return null;
  const sizeClass = settings?.size === 'small'
    ? 'text-[clamp(1.7rem,8vw,2.05rem)] sm:text-[2.15em]'
    : settings?.size === 'medium'
      ? 'text-[clamp(1.85rem,8.6vw,2.25rem)] sm:text-[2.65em]'
      : 'text-[clamp(2rem,9.2vw,2.45rem)] sm:text-[3.15em]';
  const sourceSelected = phase === 'selectSource' || phase === 'deleteSource';
  const resultSelected = phase === 'selectResult' || phase === 'deleteResult';
  const currentPair = pairs[pairIndex % pairs.length];
  const accessibleStatement = `${settings?.prefix || 'Gue'} ${settings?.highlightedWord || 'mengubah'} ${currentPair?.source || ''} ${settings?.connector || 'menjadi'} ${currentPair?.result || ''}`;

  return (
    <h1 className={`${sizeClass} mx-auto min-h-[2.3em] w-full max-w-[52rem] min-w-0 break-words text-left font-normal leading-[1.12] tracking-tight text-gray-900 dark:text-white`}>
      <span className="sr-only">{accessibleStatement}</span>
      <span aria-hidden="true">
        <span>{settings?.prefix || 'Gue'} </span>
        <mark className="bg-yellow-300/90 dark:bg-yellow-400/80 text-inherit px-[0.08em] box-decoration-clone">{settings?.highlightedWord || 'mengubah'}</mark>
        <span> </span>
        <span className={sourceSelected ? 'bg-[#2B579A] text-white' : ''}>{sourceText || '\u00a0'}</span>
        <span> {settings?.connector || 'menjadi'} </span>
        <span className={resultSelected ? 'bg-[#2B579A] text-white' : ''}>{resultText || '\u00a0'}</span>
        {!sourceSelected && !resultSelected && <span className="typing-caret" />}
      </span>
    </h1>
  );
}
