import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DynamicStatement from './DynamicStatement';
import InteractiveText from './InteractiveText';
import { getApprovedZines, getMiniGameLeaderboard, submitMiniGameScore, submitZine } from '../lib/homeExperienceApi';

const safeLocalJson = (key, fallback) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const focusableSelector = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
const homeRouteClass = 'group flex min-h-12 w-full items-center justify-between rounded-sm border border-gray-300 bg-white px-4 py-3 text-left font-mono text-[10pt] font-bold uppercase leading-4 tracking-[0.08em] text-gray-800 transition hover:border-[#2B579A] hover:bg-[#2B579A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-[#202020] dark:text-white dark:hover:border-[#6FA8DC] dark:hover:bg-[#6FA8DC] dark:hover:text-[#171717]';

const shuffle = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
};

const countOccurrences = (text, phrase) => {
  if (!phrase) return 0;
  let count = 0;
  let cursor = 0;
  while ((cursor = text.indexOf(phrase, cursor)) !== -1) {
    count += 1;
    cursor += phrase.length;
  }
  return count;
};

const validIssuesFor = (draft) => (Array.isArray(draft?.issues) ? draft.issues : [])
  .filter((issue) => issue?.phrase?.trim() && countOccurrences(draft?.passage || '', issue.phrase.trim()) === 1)
  .map((issue, index) => ({ ...issue, id: issue.id || `issue-${index}`, phrase: issue.phrase.trim() }));

const playableDrafts = (miniGameData) => (Array.isArray(miniGameData?.drafts) ? miniGameData.drafts : [])
  .filter((draft) => draft?.enabled !== false && draft?.passage?.trim() && validIssuesFor(draft).length);

const buildSegments = (draft) => {
  const passage = draft?.passage || '';
  const issueRanges = validIssuesFor(draft).map((issue) => {
    const start = passage.indexOf(issue.phrase);
    return { start, end: start + issue.phrase.length, issue };
  }).sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;
  let tokenIndex = 0;

  const addPlainText = (text) => {
    text.split(/(\s+|[^\p{L}\p{N}’'-]+)/u).filter(Boolean).forEach((part) => {
      const clickable = /[\p{L}\p{N}]/u.test(part);
      segments.push({ type: clickable ? 'word' : 'text', text: part, id: `word-${tokenIndex}` });
      tokenIndex += 1;
    });
  };

  issueRanges.forEach((range) => {
    if (range.start < cursor) return;
    addPlainText(passage.slice(cursor, range.start));
    segments.push({ type: 'issue', text: passage.slice(range.start, range.end), issue: range.issue, id: range.issue.id });
    cursor = range.end;
  });
  addPlainText(passage.slice(cursor));
  return segments;
};

const resultTitle = (grade, titles) => {
  const ordered = (Array.isArray(titles) ? titles : []).map((item) => ({ min: Number(item?.min) || 0, label: item?.label || '' })).filter((item) => item.label).sort((a, b) => b.min - a.min);
  return ordered.find((item) => grade >= item.min)?.label || 'Draft Survivor';
};

export default function HomeExperience({ data, zineData, miniGameData, interactiveWords = [], onNavigate }) {
  const [mode, setMode] = useState('idle');
  const [zineMode, setZineMode] = useState(null);
  const [zineDraft, setZineDraft] = useState('');
  const [zineNotice, setZineNotice] = useState('');
  const [selectedZine, setSelectedZine] = useState(null);
  const [gamePhase, setGamePhase] = useState('library');
  const [selectedGameId, setSelectedGameId] = useState('root');
  const [sessionDrafts, setSessionDrafts] = useState([]);
  const [draftIndex, setDraftIndex] = useState(0);
  const [foundIssues, setFoundIssues] = useState([]);
  const [wrongTokens, setWrongTokens] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [rawScore, setRawScore] = useState(0);
  const [correctClicks, setCorrectClicks] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [issuesFoundTotal, setIssuesFoundTotal] = useState(0);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintedIssue, setHintedIssue] = useState(null);
  const [scoreboard, setScoreboard] = useState(() => safeLocalJson('portfolio_minigame_scores', []));
  const modalRef = useRef(null);
  const lastTriggerRef = useRef(null);

  const zines = Array.isArray(zineData?.entries) ? zineData.entries.filter((entry) => entry?.published !== false && entry?.body?.trim()) : [];
  const libraryGames = useMemo(() => [
    { ...miniGameData, id: 'root' },
    ...(Array.isArray(miniGameData?.gameSlots) ? miniGameData.gameSlots : []),
  ].filter((game) => game?.gameName?.trim() && game?.showInLibrary === true), [miniGameData]);
  const activeGameData = libraryGames.find((game) => game.id === selectedGameId) || libraryGames[0] || miniGameData;
  const availableDrafts = useMemo(() => playableDrafts(activeGameData), [activeGameData]);
  const activeDraft = sessionDrafts[draftIndex];
  const activeIssues = useMemo(() => validIssuesFor(activeDraft), [activeDraft]);
  const activeSegments = useMemo(() => buildSegments(activeDraft), [activeDraft]);
  const secondsPerDraft = Math.min(120, Math.max(15, Number(activeGameData?.secondsPerDraft) || 60));
  const draftsPerSession = Math.min(5, Math.max(1, Number(activeGameData?.draftsPerSession) || 5));
  const scoreSettings = {
    correctPoints: Math.max(0, Number(activeGameData?.scoreSettings?.correctPoints) || 100),
    wrongPenalty: Math.max(0, Number(activeGameData?.scoreSettings?.wrongPenalty) || 25),
    completionBonus: Math.max(0, Number(activeGameData?.scoreSettings?.completionBonus) || 100),
    maxTimeBonus: Math.max(0, Number(activeGameData?.scoreSettings?.maxTimeBonus) || 100),
    hintPenalty: Math.max(0, Number(activeGameData?.scoreSettings?.hintPenalty) || 75),
  };
  const signatureRole = data?.role || '';
  const modalOpen = mode !== 'idle';
  const totalIssues = sessionDrafts.reduce((total, draft) => total + validIssuesFor(draft).length, 0);
  const accuracy = totalClicks ? Math.round((correctClicks / totalClicks) * 100) : 0;
  const completionRate = totalIssues ? issuesFoundTotal / totalIssues : 0;
  const finalGrade = Math.round(accuracy * completionRate);

  const closeExperience = () => {
    setMode('idle');
    setZineMode(null);
    setZineNotice('');
    setSelectedZine(null);
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    let ignore = false;
    getMiniGameLeaderboard(10)
      .then((rows) => { if (!ignore && rows.length) setScoreboard(rows); })
      .catch(() => { /* local scoreboard remains available */ });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalRef.current?.querySelector(focusableSelector)?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeExperience();
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modalOpen]);

  useEffect(() => {
    if (mode !== 'game' || gamePhase !== 'play') return undefined;
    if (timeLeft <= 0) {
      setGamePhase('review');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
      setActiveSeconds((value) => value + 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [mode, gamePhase, timeLeft]);

  const openZine = (event) => {
    lastTriggerRef.current = event?.currentTarget || null;
    setZineMode(null);
    setZineNotice('');
    setSelectedZine(null);
    setMode('zine');
  };

  const openGame = (event) => {
    lastTriggerRef.current = event?.currentTarget || lastTriggerRef.current;
    setSelectedGameId(libraryGames[0]?.id || 'root');
    setGamePhase('library');
    setSessionDrafts([]);
    setMode('game');
  };

  useEffect(() => {
    const onRailAction = (event) => {
      if (event.detail === 'zine') {
        setZineMode(null);
        setZineNotice('');
        setSelectedZine(null);
        setMode('zine');
      }
      if (event.detail === 'game') {
        setSelectedGameId(libraryGames[0]?.id || 'root');
        setGamePhase('library');
        setSessionDrafts([]);
        setMode('game');
      }
    };
    window.addEventListener('portfolio:home-action', onRailAction);
    return () => window.removeEventListener('portfolio:home-action', onRailAction);
  }, [libraryGames]);

  const saveZineDraft = async () => {
    const clean = zineDraft.trim();
    if (!clean) return setZineNotice('Tulisan masih kosong.');
    setZineNotice('Mengirim halaman…');
    try {
      await submitZine(clean);
      setZineDraft('');
      setZineNotice(zineData?.submitSuccess || 'Tulisan masuk antrean kurasi.');
    } catch (error) {
      if (error?.message === 'Tunggu sebentar sebelum mengirim tulisan lain.' || error?.message === 'Tulisan terlalu panjang.') return setZineNotice(error.message);
      const submissions = safeLocalJson('portfolio_zine_submissions', []);
      submissions.unshift({ body: clean, createdAt: new Date().toISOString(), pending: true });
      localStorage.setItem('portfolio_zine_submissions', JSON.stringify(submissions.slice(0, 25)));
      setZineNotice('Koneksi sedang bermasalah. Draft aman tersimpan di perangkat ini—coba kirim lagi nanti.');
    }
  };

  const receiveZine = async () => {
    setSelectedZine(null);
    setZineNotice('Mencari satu halaman…');
    try {
      const communityZines = await getApprovedZines(100);
      const available = [...zines, ...communityZines];
      if (!available.length) return setZineNotice('Belum ada tulisan yang diterbitkan.');
      setSelectedZine(available[Math.floor(Math.random() * available.length)]);
      setZineNotice('');
    } catch {
      if (!zines.length) return setZineNotice('Tulisan publik belum bisa dimuat. Coba lagi sebentar.');
      setSelectedZine(zines[Math.floor(Math.random() * zines.length)]);
      setZineNotice('Menampilkan koleksi CMS karena koneksi komunitas sedang terganggu.');
    }
  };

  const startGame = () => {
    const selected = shuffle(availableDrafts).slice(0, draftsPerSession);
    setSessionDrafts(selected);
    setDraftIndex(0);
    setFoundIssues([]);
    setWrongTokens([]);
    setTimeLeft(secondsPerDraft);
    setRawScore(0);
    setCorrectClicks(0);
    setTotalClicks(0);
    setIssuesFoundTotal(0);
    setActiveSeconds(0);
    setHintUsed(false);
    setHintedIssue(null);
    setGamePhase(selected.length ? 'play' : 'intro');
  };

  const finishDraft = (nextFoundCount) => {
    const completionBonus = scoreSettings.completionBonus;
    const timeBonus = Math.round((timeLeft / secondsPerDraft) * scoreSettings.maxTimeBonus);
    setRawScore((value) => value + completionBonus + timeBonus);
    setFoundIssues((current) => current.slice(0, nextFoundCount));
    setGamePhase('review');
  };

  const clickIssue = (issue) => {
    if (gamePhase !== 'play' || foundIssues.includes(issue.id)) return;
    const next = [...foundIssues, issue.id];
    setFoundIssues(next);
    setCorrectClicks((value) => value + 1);
    setTotalClicks((value) => value + 1);
    setIssuesFoundTotal((value) => value + 1);
    setRawScore((value) => value + scoreSettings.correctPoints);
    setHintedIssue(null);
    if (next.length === activeIssues.length) finishDraft(next.length);
  };

  const clickWrongWord = (tokenId) => {
    if (gamePhase !== 'play' || wrongTokens.includes(tokenId)) return;
    setWrongTokens((current) => [...current, tokenId]);
    setTotalClicks((value) => value + 1);
    setRawScore((value) => Math.max(0, value - scoreSettings.wrongPenalty));
  };

  const useHint = () => {
    if (hintUsed || gamePhase !== 'play') return;
    const remaining = activeIssues.find((issue) => !foundIssues.includes(issue.id));
    if (!remaining) return;
    setHintUsed(true);
    setHintedIssue(remaining.id);
    setRawScore((value) => Math.max(0, value - scoreSettings.hintPenalty));
    window.setTimeout(() => setHintedIssue((current) => current === remaining.id ? null : current), 2000);
  };

  const saveFinalScore = async () => {
    const finalAccuracy = totalClicks ? Math.round((correctClicks / totalClicks) * 100) : 0;
    const finalCompletion = totalIssues ? issuesFoundTotal / totalIssues : 0;
    const grade = Math.round(finalAccuracy * finalCompletion);
    const nextBoard = [{ score: grade, total: 100 }, ...scoreboard].slice(0, 5);
    setScoreboard(nextBoard);
    localStorage.setItem('portfolio_minigame_scores', JSON.stringify(nextBoard));
    try {
      await submitMiniGameScore(grade, 100);
      const globalBoard = await getMiniGameLeaderboard(10);
      if (globalBoard.length) setScoreboard(globalBoard);
    } catch {
      // Local result remains visible when the service is unavailable.
    }
  };

  const nextDraft = () => {
    if (draftIndex < sessionDrafts.length - 1) {
      setDraftIndex((value) => value + 1);
      setFoundIssues([]);
      setWrongTokens([]);
      setHintedIssue(null);
      setTimeLeft(secondsPerDraft);
      setGamePhase('play');
      return;
    }
    setGamePhase('result');
    saveFinalScore();
  };

  const navigateFromGame = (page) => {
    closeExperience();
    window.setTimeout(() => onNavigate?.(page), 0);
  };

  return (
    <section className="relative px-5 pb-8 pt-7 sm:min-h-[65vh] sm:px-10 sm:py-12" aria-label="Home introduction">
      <div className="relative sm:min-h-[52vh]">
        <div className="mx-auto w-full max-w-[60rem] lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2"><DynamicStatement settings={data?.dynamicStatement} /></div>
        <nav className="mx-auto mt-8 grid w-full gap-2 sm:grid-cols-2 md:hidden" aria-label="Home routes and interactive features">
          <button type="button" onClick={() => onNavigate?.('Projects')} data-hint-id="home-selected-work" className={homeRouteClass}><span>Selected work</span><span aria-hidden="true">→</span></button>
          <button type="button" onClick={() => onNavigate?.('Career')} data-hint-id="home-experience" className={homeRouteClass}><span>Experience</span><span aria-hidden="true">→</span></button>
          <button type="button" onClick={() => onNavigate?.('Contact')} data-hint-id="home-contact" className={homeRouteClass}><span>Contact</span><span aria-hidden="true">→</span></button>
          {zineData?.enabled !== false && <button type="button" onClick={openZine} data-hint-id="home-wassup" className={homeRouteClass}><span>{zineData?.menuLabel || 'Wassup?'}</span><span aria-hidden="true">→</span></button>}
          {miniGameData?.enabled !== false && <button type="button" onClick={openGame} data-hint-id="home-mini-game" className={homeRouteClass}><span>{miniGameData?.menuLabel || 'Mini Game'}</span><span aria-hidden="true">→</span></button>}
        </nav>
      </div>
      <div className="mt-9 border-t border-gray-200 pt-5 text-right dark:border-gray-700 sm:absolute sm:bottom-10 sm:right-12 sm:mt-0 sm:max-w-[70%] sm:border-0 sm:pt-0">
        <p className="mb-1 font-mono text-[0.75em] uppercase tracking-[0.18em] text-gray-600 dark:text-gray-300"><InteractiveText text={signatureRole} rules={interactiveWords} page="Home" onNavigate={onNavigate} /></p>
        <h1 className="font-serif text-[1.9em] font-normal leading-none tracking-tight text-gray-900 dark:text-white sm:text-[2.25em]">{data?.name || 'Haikal A. Hafidz'}</h1>
      </div>

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[10000] overflow-y-auto bg-[#d7d7d7] dark:bg-[#181818]">
          <section ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="home-experience-title" className="home-experience-print-in min-h-screen w-full overflow-y-auto bg-[#fbfaf6] p-5 text-gray-900 shadow-[0_0_80px_rgba(0,0,0,.22)] dark:bg-[#202020] dark:text-gray-100 sm:p-8 lg:px-[8vw] lg:py-10">
            <header className="mx-auto mb-6 flex max-w-[100rem] items-start justify-between gap-4 border-b border-gray-200 pb-4 dark:border-gray-700">
              <div><p className="font-mono text-[0.75em] uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#8AB4E6]">{mode === 'zine' ? 'Wassup?' : gamePhase === 'library' ? 'Mini Game Archive' : (activeGameData?.gameName || 'Mini Game')}</p><h2 id="home-experience-title" className="mt-1 font-serif text-[1.75em] leading-tight text-gray-900 dark:text-white">{mode === 'zine' ? (zineData?.title || 'Write one. Receive one.') : gamePhase === 'library' ? (miniGameData?.libraryTitle || 'Choose a desk.') : (activeGameData?.title || activeGameData?.gameName || 'Inspect the unfinished draft.')}</h2></div>
              <div className="flex items-center gap-3">{mode === 'game' && gamePhase === 'play' && <span className={`font-mono text-sm font-bold tabular-nums ${timeLeft <= 10 ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}`}>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</span>}<button type="button" onClick={closeExperience} className="min-h-11 shrink-0 rounded border border-gray-300 px-4 py-2 text-sm font-semibold hover:border-[#2B579A] hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:border-gray-600" aria-label="Tutup dan kembali ke Home">Tutup ×</button></div>
            </header>

            {mode === 'zine' && <div className="mx-auto max-w-3xl">{!zineMode && <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setZineMode('write')} className="min-h-28 rounded border border-gray-300 p-4 text-left transition hover:border-[#2B579A] dark:border-gray-600"><strong className="block font-serif text-xl">Menulis</strong><span className="mt-2 block text-base leading-relaxed text-gray-600 dark:text-gray-300">Tinggalkan satu halaman untuk pembaca berikutnya.</span></button><button type="button" onClick={() => { setZineMode('receive'); receiveZine(); }} className="min-h-28 rounded border border-gray-300 p-4 text-left transition hover:border-[#2B579A] dark:border-gray-600"><strong className="block font-serif text-xl">Menerima</strong><span className="mt-2 block text-base leading-relaxed text-gray-600 dark:text-gray-300">Ambil satu tulisan yang sudah diterbitkan.</span></button></div>}{zineMode && <button type="button" onClick={() => { setZineMode(null); setSelectedZine(null); setZineNotice(''); }} className="mb-4 min-h-11 text-sm font-semibold text-[#2B579A] underline underline-offset-4">← Kembali ke pilihan</button>}{zineMode === 'write' && <div><textarea value={zineDraft} onChange={(event) => setZineDraft(event.target.value.slice(0, Number(zineData?.maxLength) || 1200))} rows={8} className="w-full resize-y rounded border border-gray-300 bg-transparent p-4 font-serif text-base leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:border-gray-600" placeholder={zineData?.writePrompt || 'Tulis sesuatu yang layak ditemukan orang lain…'} /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm text-gray-500">{zineDraft.length}/{Number(zineData?.maxLength) || 1200}</span><button type="button" onClick={saveZineDraft} className="min-h-11 rounded bg-[#2B579A] px-5 py-2 text-sm font-bold text-white">Kirim</button></div></div>}{zineMode === 'receive' && selectedZine && <article className="mx-auto max-w-xl animate-[zine-print_650ms_ease-out] border border-gray-200 bg-[#fffdf7] p-7 shadow-lg dark:border-gray-600 dark:bg-[#292722]"><p className="font-mono text-[0.75em] uppercase tracking-[0.16em] text-gray-600 dark:text-gray-300">{selectedZine.label || 'For a stranger'}</p><h3 className="mt-3 font-serif text-2xl">{selectedZine.title || 'Untitled'}</h3><p className="mt-5 whitespace-pre-wrap font-serif text-base leading-relaxed">{selectedZine.body}</p><p className="mt-6 text-right font-mono text-sm text-gray-600 dark:text-gray-300">— {selectedZine.author || 'Anonymous'}</p></article>}{zineNotice && <p role="status" aria-live="polite" className="mt-4 text-base">{zineNotice}</p>}</div>}

            {mode === 'game' && <main className="mx-auto max-w-[55rem]">
              {gamePhase === 'library' && <div className="grid min-h-[calc(100vh-12rem)] place-items-center py-6"><div className="w-full"><p className="mx-auto mb-7 max-w-xl text-center text-sm leading-relaxed text-gray-600 dark:text-gray-300">{miniGameData?.libraryDescription || 'Pilih satu meja kerja. Setiap permainan menguji bagian berbeda dari proses mengubah gagasan mentah menjadi naskah.'}</p><div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">{libraryGames.map((game, index) => <button key={game.id || `game-${index}`} type="button" onClick={() => { setSelectedGameId(game.id || `game-${index}`); setGamePhase('intro'); }} aria-label={`Buka ${game.gameName}`} className="group overflow-hidden rounded border border-gray-300 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#2B579A] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:border-gray-600 dark:bg-[#252525]"><div className="grid aspect-[4/3] place-items-center overflow-hidden bg-[#eef3fa] dark:bg-[#1b2635]">{game.illustration ? <img src={game.illustration} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <svg className="h-20 w-20 text-[#2B579A] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105 dark:text-[#8AB4E6]" viewBox="0 0 96 96" fill="none" aria-hidden="true"><path d="M67 12 82 27 40 69 21 75l6-19L67 12Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round"/><path d="m59 20 16 16M27 56l13 13M21 75l-7 7M18 85h54" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="M43 66 28 51" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/></svg>}</div><div className="p-4"><span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#2B579A]">{game.gameCategory || `Game ${String(index + 1).padStart(2, '0')}`}</span><strong className="mt-1 block font-serif text-xl">{game.gameName}</strong>{game.gameCardDescription && <span className="mt-2 block text-sm leading-relaxed text-gray-600 dark:text-gray-300">{game.gameCardDescription}</span>}</div></button>)}<div aria-disabled="true" className="grid min-h-full overflow-hidden rounded border border-dashed border-gray-300 bg-gray-100/70 text-center text-gray-400 dark:border-gray-700 dark:bg-white/5 dark:text-gray-500"><div className="grid aspect-[4/3] place-items-center border-b border-dashed border-gray-300 dark:border-gray-700"><svg className="h-14 w-14" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="13" y="13" width="38" height="38" rx="4"/><path d="M24 32h16M32 24v16" strokeLinecap="round"/></svg></div><div className="p-4"><span className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em]">Coming soon</span><span className="mt-2 block text-sm leading-relaxed">Meja berikutnya sedang disiapkan.</span></div></div></div></div></div>}
              {gamePhase === 'intro' && <div className="mx-auto max-w-3xl py-3 sm:py-6"><button type="button" onClick={() => setGamePhase('library')} className="mb-5 min-h-11 font-mono text-xs font-bold uppercase tracking-wide text-[#2B579A]">← Kembali ke pilihan game</button><section className="border-y border-gray-200 py-5 dark:border-gray-700"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Tujuan permainan</p><p className="mt-2 font-serif text-xl leading-relaxed text-gray-700 dark:text-gray-200">{activeGameData?.objective || 'Detail permainan ini belum diisi. Game tetap ditampilkan karena namanya sudah aktif di CMS.'}</p></section><section className="mt-5"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Aturan main</p><ol className="mt-3 grid gap-x-5 text-sm leading-relaxed sm:grid-cols-2">{[activeGameData?.rules?.click, activeGameData?.rules?.timer, activeGameData?.rules?.wrong, activeGameData?.rules?.hint, activeGameData?.rules?.review].filter(Boolean).map((rule, index, list) => <li key={index} className={`border-t border-gray-300 py-3 ${index === list.length - 1 && list.length % 2 === 1 ? 'sm:col-span-2' : ''}`}><strong>{String(index + 1).padStart(2, '0')}.</strong> {rule}</li>)}</ol></section><section className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Sistem skor</p><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Temuan benar</dt><dd>+{scoreSettings.correctPoints}</dd></div><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Klik salah</dt><dd>−{scoreSettings.wrongPenalty}</dd></div><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Draft selesai</dt><dd>+{scoreSettings.completionBonus}</dd></div><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Bonus waktu</dt><dd>maks. +{scoreSettings.maxTimeBonus}</dd></div><div className="flex justify-between"><dt>Pakai hint</dt><dd>−{scoreSettings.hintPenalty}</dd></div></dl></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Rincian gelar</p><dl className="mt-3 space-y-2 text-sm">{(activeGameData?.gradeTitles || []).filter((item) => item?.label?.trim()).slice().sort((a, b) => Number(b.min) - Number(a.min)).map((item, index, list) => <div key={`${item.min}-${item.label}`} className="flex justify-between border-b border-gray-200 pb-2"><dt>{item.label}</dt><dd>{item.min}–{index === 0 ? 100 : Number(list[index - 1].min) - 1}</dd></div>)}</dl></div></section>{availableDrafts.length ? <><button type="button" onClick={startGame} className="mt-7 min-h-12 rounded bg-[#2B579A] px-6 py-3 font-mono text-sm font-bold uppercase tracking-wide text-white hover:bg-[#234a84]">{activeGameData?.startButtonLabel || 'Mulai Mengedit'} →</button><p className="mt-3 font-mono text-xs text-gray-500">{Math.min(draftsPerSession, availableDrafts.length)} draft · maksimal {Math.ceil((Math.min(draftsPerSession, availableDrafts.length) * secondsPerDraft) / 60)} menit · mouse atau layar sentuh</p></> : <p role="status" className="mt-7 border-l-4 border-amber-500 pl-4 text-base">Game ini sudah tampil, tetapi belum bisa dimainkan karena belum punya draft valid. Lengkapi isinya di CMS.</p>}</div>}

              {(gamePhase === 'play' || gamePhase === 'review') && activeDraft && <div key={activeDraft.id || draftIndex} className="red-pen-draft-in py-2"><div className="mb-5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs uppercase tracking-wide text-gray-500"><span>Draft {draftIndex + 1}/{sessionDrafts.length} · {activeDraft.label || `Level ${draftIndex + 1}`}</span><span>Skor {rawScore} · Akurasi {accuracy}%</span></div><article className="border-y border-gray-200 py-7 dark:border-gray-700"><p className="whitespace-pre-wrap font-serif text-[1.15rem] leading-[2.15] sm:text-[1.32rem]">{activeSegments.map((segment) => {
                if (segment.type === 'text') return <span key={segment.id}>{segment.text}</span>;
                if (segment.type === 'issue') {
                  const found = foundIssues.includes(segment.issue.id);
                  const reveal = gamePhase === 'review';
                  return <button key={segment.id} type="button" onClick={() => clickIssue(segment.issue)} disabled={gamePhase !== 'play' || found} className={`red-pen-token rounded px-0.5 text-left font-inherit focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] ${found ? 'bg-green-50 text-gray-900 dark:bg-green-950/30 dark:text-gray-100' : reveal ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200' : hintedIssue === segment.issue.id ? 'red-pen-hint bg-amber-100 dark:bg-amber-900/40' : 'hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}><span className={found || reveal ? 'decoration-red-600 decoration-2 line-through' : ''}>{segment.text}</span>{(found || reveal) && <span className="ml-1 font-sans text-[0.78em] font-semibold text-green-700 no-underline dark:text-green-300">[{segment.issue.replacement || 'hapus'}]</span>}</button>;
                }
                const wrong = wrongTokens.includes(segment.id);
                return <button key={segment.id} type="button" onClick={() => clickWrongWord(segment.id)} disabled={gamePhase !== 'play' || wrong} className={`red-pen-token rounded px-0.5 font-inherit focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] ${wrong ? 'red-pen-wrong text-red-700 dark:text-red-300' : 'hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}>{segment.text}</button>;
              })}</p></article>{gamePhase === 'play' && <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-600 dark:text-gray-300">Ditemukan {foundIssues.length}/{activeIssues.length}</p><button type="button" onClick={useHint} disabled={hintUsed} className="min-h-11 rounded border border-gray-300 px-4 py-2 font-mono text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600">{hintUsed ? 'Hint sudah dipakai' : `Gunakan hint (−${scoreSettings.hintPenalty})`}</button></div>}{gamePhase === 'review' && <section aria-live="polite" className="mt-7"><p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#2B579A]">{timeLeft === 0 ? 'Waktu habis · editorial review' : 'Draft selesai · editorial review'}</p><div className="mt-4 grid gap-3">{activeIssues.map((issue) => <div key={issue.id} className="border-l-2 border-[#2B579A] pl-4"><p className="text-sm"><span className="text-red-700 line-through dark:text-red-300">{issue.phrase}</span><span className="mx-2">→</span><strong className="text-green-700 dark:text-green-300">{issue.replacement || 'hapus'}</strong></p><p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{issue.explanation || 'Bagian ini dapat dibuat lebih jelas dan efektif.'}</p></div>)}</div><button type="button" onClick={nextDraft} className="mt-7 min-h-11 rounded bg-[#2B579A] px-5 py-2 font-mono text-sm font-bold uppercase tracking-wide text-white">{draftIndex === sessionDrafts.length - 1 ? 'Lihat hasil →' : 'Draft berikutnya →'}</button></section>}</div>}

              {gamePhase === 'result' && <div className="mx-auto max-w-2xl py-5 text-center"><p className="font-mono text-xs uppercase tracking-[0.18em] text-[#2B579A]">{activeGameData?.resultEyebrow || 'Final editorial report'} · grade {finalGrade}/100</p><h3 className="mt-3 font-serif text-4xl sm:text-5xl">{resultTitle(finalGrade, activeGameData?.gradeTitles)}</h3><div className="mt-8 grid grid-cols-2 gap-px overflow-hidden border border-gray-200 bg-gray-200 text-left dark:border-gray-700 dark:bg-gray-700 sm:grid-cols-4"><div className="bg-[#fbfaf6] p-4 dark:bg-[#202020]"><span className="block font-mono text-[10px] uppercase text-gray-500">Score</span><strong className="mt-1 block text-xl">{rawScore}</strong></div><div className="bg-[#fbfaf6] p-4 dark:bg-[#202020]"><span className="block font-mono text-[10px] uppercase text-gray-500">Accuracy</span><strong className="mt-1 block text-xl">{accuracy}%</strong></div><div className="bg-[#fbfaf6] p-4 dark:bg-[#202020]"><span className="block font-mono text-[10px] uppercase text-gray-500">Issues</span><strong className="mt-1 block text-xl">{issuesFoundTotal}/{totalIssues}</strong></div><div className="bg-[#fbfaf6] p-4 dark:bg-[#202020]"><span className="block font-mono text-[10px] uppercase text-gray-500">Active time</span><strong className="mt-1 block text-xl">{Math.floor(activeSeconds / 60)}:{String(activeSeconds % 60).padStart(2, '0')}</strong></div></div><div className="mt-8 flex flex-wrap justify-center gap-3"><button type="button" onClick={startGame} className="min-h-11 rounded bg-[#2B579A] px-5 py-2 text-sm font-bold text-white">{activeGameData?.replayLabel || 'Main lagi'}</button><button type="button" onClick={() => navigateFromGame('Projects')} className="min-h-11 rounded border border-gray-300 px-5 py-2 text-sm font-semibold dark:border-gray-600">{activeGameData?.projectsCtaLabel || 'Lihat tulisan Haikal'}</button><button type="button" onClick={() => navigateFromGame('Contact')} className="min-h-11 rounded border border-gray-300 px-5 py-2 text-sm font-semibold dark:border-gray-600">{activeGameData?.contactCtaLabel || 'Hubungi Haikal'}</button></div></div>}
            </main>}
          </section>
        </div>,
        document.body,
      )}

      <style>{`@keyframes zine-print{from{opacity:0;transform:translateY(-24px) scale(.96)}to{opacity:1;transform:none}}@keyframes home-experience-print{0%{clip-path:inset(0 46% 96% 46%);transform:translateY(-8%)}45%{clip-path:inset(0 34% 40% 34%)}100%{clip-path:inset(0);transform:none}}@keyframes red-pen-draft{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}@keyframes red-pen-wrong{0%,100%{transform:none}35%{transform:translateX(-2px)}70%{transform:translateX(2px)}}@keyframes red-pen-hint{50%{box-shadow:0 0 0 4px rgba(245,158,11,.22)}}.home-experience-print-in{animation:home-experience-print .72s cubic-bezier(.2,.8,.2,1) both}.red-pen-draft-in{animation:red-pen-draft .22s ease-out both}.red-pen-wrong{animation:red-pen-wrong .2s ease-out}.red-pen-hint{animation:red-pen-hint .6s ease-in-out 3}.red-pen-token{display:inline;line-height:inherit}@media(prefers-reduced-motion:reduce){.animate-[zine-print_650ms_ease-out],.home-experience-print-in,.red-pen-draft-in,.red-pen-wrong,.red-pen-hint{animation:none!important}}`}</style>
    </section>
  );
}
