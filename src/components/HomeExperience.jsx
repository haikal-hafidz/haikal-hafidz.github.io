import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DynamicStatement from './DynamicStatement';
import InteractiveText from './InteractiveText';
import { getApprovedZines, getMiniGameLeaderboard, submitMiniGameScore, submitZine } from '../lib/homeExperienceApi';
import WassupExperience from './wassup/WassupExperience';
import MiniGameExperience from './miniGames/MiniGameExperience';

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


const DEFAULT_HANGMAN_WORDS = [
  { word: 'AMBIGUITAS', clue: 'Makna yang tidak pasti.' },
  { word: 'GAGASAN', clue: 'Ide yang dipikirkan.' },
  { word: 'JANGGAL', clue: 'Terasa tidak semestinya.' },
  { word: 'LUGAS', clue: 'Jelas dan langsung.' },
  { word: 'TAFSIR', clue: 'Pemaknaan terhadap sesuatu.' },
  { word: 'KHALAYAK', clue: 'Kelompok penerima pesan.' },
  { word: 'SANGGAH', clue: 'Membantah suatu pendapat.' },
  { word: 'NALURI', clue: 'Dorongan alami.' },
  { word: 'WACANA', clue: 'Gagasan dalam pembahasan.' },
  { word: 'SAMAR', clue: 'Tidak terlihat jelas.' },
  { word: 'NUANSA', clue: 'Perbedaan yang sangat halus.' },
  { word: 'SATIR', clue: 'Sindiran lewat humor.' },
  { word: 'DISTOPIA', clue: 'Masyarakat yang buruk.' },
  { word: 'PARADOKS', clue: 'Pernyataan tampak bertentangan.' },
  { word: 'METAFORA', clue: 'Perbandingan secara kiasan.' },
  { word: 'NARASI', clue: 'Rangkaian sebuah cerita.' },
  { word: 'RETORIKA', clue: 'Seni menggunakan bahasa.' },
  { word: 'SUBTEKS', clue: 'Makna yang tidak diucapkan.' },
  { word: 'IRONI', clue: 'Berlawanan dengan harapan.' },
  { word: 'BIAS', clue: 'Kecenderungan yang memengaruhi penilaian.' },
  { word: 'EMPATI', clue: 'Memahami perasaan orang lain.' },
  { word: 'WAWASAN', clue: 'Pemahaman yang lebih luas.' },
  { word: 'PERSEPSI', clue: 'Cara menangkap sesuatu.' },
  { word: 'ARKETIPE', clue: 'Pola yang terus berulang.' },
  { word: 'PROSA', clue: 'Tulisan tanpa pola sajak.' },
  { word: 'LEKSIKON', clue: 'Kumpulan kosakata.' },
  { word: 'SINTAKSIS', clue: 'Susunan kata dalam kalimat.' },
  { word: 'SEMANTIK', clue: 'Kajian tentang makna.' },
  { word: 'KATARSIS', clue: 'Pelepasan emosi.' },
  { word: 'ANEKDOT', clue: 'Cerita singkat menarik.' },
];

const hangmanWordsFrom = (miniGameData) => {
  const slot = (miniGameData?.gameSlots || []).find((item) => String(item?.gameName || '').trim().toLowerCase() === 'the hangman')
    || (miniGameData?.gameSlots || [])[0];
  const fromCms = (slot?.drafts || []).filter((item) => item?.enabled !== false).map((item) => {
    const word = String(item?.label || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const clue = String(item?.passage || '').trim();
    return word.length >= 3 && clue ? { word, clue } : null;
  }).filter(Boolean);
  return { slot, words: fromCms.length >= 15 ? fromCms : DEFAULT_HANGMAN_WORDS };
};

const hangmanMask = (word, guessed) => [...word].map((letter) => guessed.includes(letter) ? letter : '_').join(' ');

export default function HomeExperience({ data, zineData, miniGameData, interactiveWords = [], onNavigate, showcaseOpenSound }) {
  const [mode, setMode] = useState('idle');
  const [zineMode, setZineMode] = useState(null);
  const [zineDraft, setZineDraft] = useState('');
  const [zineNotice, setZineNotice] = useState('');
  const [selectedZine, setSelectedZine] = useState(null);
  const [gamePhase, setGamePhase] = useState('library');
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
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [leaderboardNotice, setLeaderboardNotice] = useState('');
  const [playerStanding, setPlayerStanding] = useState(null);
  const [scoreSaving, setScoreSaving] = useState(false);
  const [hangmanWords, setHangmanWords] = useState([]);
  const [hangmanIndex, setHangmanIndex] = useState(0);
  const [hangmanGuessed, setHangmanGuessed] = useState([]);
  const [hangmanSolved, setHangmanSolved] = useState(0);
  const [hangmanWrongLetters, setHangmanWrongLetters] = useState([]);
  const [hangmanTotalGuesses, setHangmanTotalGuesses] = useState(0);
  const [hangmanCorrectGuesses, setHangmanCorrectGuesses] = useState(0);
  const [hangmanWordDone, setHangmanWordDone] = useState(false);
  const [hangmanStanding, setHangmanStanding] = useState(null);
  const [hangmanScoreboard, setHangmanScoreboard] = useState([]);
  const [hangmanLeaderboardOpen, setHangmanLeaderboardOpen] = useState(false);
  const [hangmanPlayerName, setHangmanPlayerName] = useState('');
  const [hangmanNotice, setHangmanNotice] = useState('');
  const [hangmanSaving, setHangmanSaving] = useState(false);
  const [hangmanTimeLeft, setHangmanTimeLeft] = useState(600);
  const [hangmanFinishedBy, setHangmanFinishedBy] = useState('');
  const modalRef = useRef(null);
  const lastTriggerRef = useRef(null);

  const zines = Array.isArray(zineData?.entries) ? zineData.entries.filter((entry) => entry?.published !== false && entry?.body?.trim()) : [];
  const availableDrafts = useMemo(() => playableDrafts(miniGameData), [miniGameData]);
  const activeDraft = sessionDrafts[draftIndex];
  const activeIssues = useMemo(() => validIssuesFor(activeDraft), [activeDraft]);
  const activeSegments = useMemo(() => buildSegments(activeDraft), [activeDraft]);
  const secondsPerDraft = Math.min(120, Math.max(15, Number(miniGameData?.secondsPerDraft) || 60));
  const draftsPerSession = Math.min(5, Math.max(1, Number(miniGameData?.draftsPerSession) || 5));
  const scoreSettings = {
    correctPoints: Math.max(0, Number(miniGameData?.scoreSettings?.correctPoints) || 100),
    wrongPenalty: Math.max(0, Number(miniGameData?.scoreSettings?.wrongPenalty) || 25),
    completionBonus: Math.max(0, Number(miniGameData?.scoreSettings?.completionBonus) || 100),
    maxTimeBonus: Math.max(0, Number(miniGameData?.scoreSettings?.maxTimeBonus) || 100),
    hintPenalty: Math.max(0, Number(miniGameData?.scoreSettings?.hintPenalty) || 75),
  };
  const signatureRole = data?.role || '';
  const modalOpen = mode !== 'idle';
  const totalIssues = sessionDrafts.reduce((total, draft) => total + validIssuesFor(draft).length, 0);
  const accuracy = totalClicks ? Math.round((correctClicks / totalClicks) * 100) : 0;
  const completionRate = totalIssues ? issuesFoundTotal / totalIssues : 0;
  const finalGrade = Math.round(accuracy * completionRate);
  const { slot: hangmanSlot, words: configuredHangmanWords } = useMemo(() => hangmanWordsFrom(miniGameData), [miniGameData]);
  const activeHangmanWord = hangmanWords[hangmanIndex] || null;
  const hangmanWrongCount = activeHangmanWord ? hangmanGuessed.filter((letter) => !activeHangmanWord.word.includes(letter)).length : 0;
  const hangmanSolvedCurrent = activeHangmanWord ? [...activeHangmanWord.word].every((letter) => hangmanGuessed.includes(letter)) : false;
  const hangmanAccuracy = hangmanTotalGuesses ? Math.round((hangmanCorrectGuesses / hangmanTotalGuesses) * 100) : 0;
  const hangmanScore = hangmanSolved * 1000 + hangmanAccuracy * 10 + Math.max(0, hangmanTimeLeft);
  const hangmanGradeTitles = Array.isArray(hangmanSlot?.gradeTitles) && hangmanSlot.gradeTitles.length ? hangmanSlot.gradeTitles : [{ min: 15, label: 'Master Wordsmith' }, { min: 10, label: 'Seasoned Linguist' }, { min: 5, label: 'Vocabulary Scout' }, { min: 0, label: 'Word Rookie' }];
  const hangmanTitle = hangmanGradeTitles.slice().sort((a,b)=>Number(b.min)-Number(a.min)).find((item)=>hangmanSolved >= Number(item.min))?.label || 'Word Rookie';

  const closeExperience = () => {
    setMode('idle');
    setZineMode(null);
    setZineNotice('');
    setSelectedZine(null);
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  };

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

  const startHangman = () => {
    setHangmanWords(shuffle(configuredHangmanWords).slice(0, 15));
    setHangmanIndex(0);
    setHangmanGuessed([]);
    setHangmanSolved(0);
    setHangmanWrongLetters([]);
    setHangmanTotalGuesses(0);
    setHangmanCorrectGuesses(0);
    setHangmanWordDone(false);
    setHangmanStanding(null);
    setHangmanLeaderboardOpen(false);
    setHangmanPlayerName('');
    setHangmanNotice('');
    setHangmanTimeLeft(600);
    setHangmanFinishedBy('');
    setGamePhase('hangman-play');
  };

  const guessHangmanLetter = (letter) => {
    if (!activeHangmanWord || hangmanWordDone || hangmanGuessed.includes(letter)) return;
    const hit = activeHangmanWord.word.includes(letter);
    const nextGuessed = [...hangmanGuessed, letter];
    const nextWrong = nextGuessed.filter((item) => !activeHangmanWord.word.includes(item)).length;
    const solvedNow = [...activeHangmanWord.word].every((item) => nextGuessed.includes(item));
    setHangmanGuessed(nextGuessed);
    setHangmanTotalGuesses((value) => value + 1);
    if (hit) setHangmanCorrectGuesses((value) => value + 1);
    else setHangmanWrongLetters((value) => [...value, letter]);
    if (solvedNow) {
      setHangmanSolved((value) => value + 1);
      setHangmanWordDone(true);
    } else if (nextWrong >= 6) {
      setHangmanWordDone(true);
      setHangmanFinishedBy('hangman');
    }
  };

  const nextHangmanWord = () => {
    if (hangmanIndex >= hangmanWords.length - 1) {
      setGamePhase('hangman-result');
      return;
    }
    setHangmanIndex((value) => value + 1);
    setHangmanGuessed([]);
    setHangmanWordDone(false);
  };

  const refreshHangmanLeaderboard = async () => {
    try {
      const rows = await getMiniGameLeaderboard('hangman', 10);
      setHangmanScoreboard(rows);
    } catch { /* public game remains playable without leaderboard */ }
  };

  const saveHangmanScore = async () => {
    const cleanName = hangmanPlayerName.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (cleanName.length < 2) return setHangmanNotice('Nama / alias minimal 2 karakter.');
    setHangmanSaving(true);
    setHangmanNotice('Menyimpan skor…');
    try {
      const standing = await submitMiniGameScore({
        gameId: 'hangman',
        playerName: cleanName,
        score: hangmanScore,
        accuracy: hangmanAccuracy,
        correctCount: hangmanSolved,
        totalQuestions: 15,
        activeSeconds: 600 - hangmanTimeLeft,
      });
      setHangmanPlayerName(cleanName);
      setHangmanStanding(standing);
      setHangmanNotice('');
      await refreshHangmanLeaderboard();
    } catch (error) {
      console.error('Hangman leaderboard submit failed:', error);
      setHangmanNotice('Skor belum bisa disimpan. Coba lagi.');
    } finally {
      setHangmanSaving(false);
    }
  };

  useEffect(() => {
    if (mode !== 'game' || gamePhase !== 'hangman-play' || hangmanFinishedBy === 'hangman') return undefined;
    if (hangmanTimeLeft <= 0) {
      setHangmanFinishedBy('time');
      setGamePhase('hangman-result');
      return undefined;
    }
    const timer = window.setTimeout(() => setHangmanTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [mode, gamePhase, hangmanTimeLeft, hangmanFinishedBy]);

  const openZine = (event) => {
    lastTriggerRef.current = event?.currentTarget || null;
    setZineMode(null);
    setZineNotice('');
    setSelectedZine(null);
    setMode('zine');
    window.setTimeout(() => {
      try { showcaseOpenSound?.(); } catch {}
    }, 0);
  };

  const openGame = (event) => {
    lastTriggerRef.current = event?.currentTarget || lastTriggerRef.current;
    setGamePhase('library');
    setSessionDrafts([]);
    setMode('game');
    window.setTimeout(() => {
      try { showcaseOpenSound?.(); } catch {}
    }, 0);
  };

  useEffect(() => {
    const onRailAction = (event) => {
      if (event.detail === 'zine') openZine();
      if (event.detail === 'game') openGame();
    };
    window.addEventListener('portfolio:home-action', onRailAction);
    return () => window.removeEventListener('portfolio:home-action', onRailAction);
  }, []);

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
    setLeaderboardOpen(false);
    setLeaderboardNotice('');
    setPlayerStanding(null);
    setScoreSaving(false);
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

  const refreshLeaderboard = async () => {
    try {
      const rows = await getMiniGameLeaderboard('red-pen', 10);
      setScoreboard(rows);
      localStorage.setItem('portfolio_minigame_scores', JSON.stringify(rows));
      return rows;
    } catch {
      return scoreboard;
    }
  };

  const saveLeaderboardScore = async () => {
    const cleanName = playerName.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (cleanName.length < 2) {
      setLeaderboardNotice('Nama / alias minimal 2 karakter.');
      return;
    }
    setScoreSaving(true);
    setLeaderboardNotice('Menyimpan skor…');
    try {
      const standing = await submitMiniGameScore({
        gameId: 'red-pen',
        playerName: cleanName,
        score: rawScore,
        accuracy,
        correctCount: issuesFoundTotal,
        totalQuestions: totalIssues,
        activeSeconds,
      });
      setPlayerName(cleanName);
      setPlayerStanding(standing);
      setLeaderboardNotice('');
      await refreshLeaderboard();
    } catch (error) {
      // Jangan bocorkan pesan database/Supabase ke pemain, tapi simpan detailnya
      // di console supaya kegagalan backend tetap bisa didiagnosis.
      console.error('Red Pen leaderboard submit failed:', error);
      setLeaderboardNotice('Skor belum bisa disimpan. Coba lagi.');
    } finally {
      setScoreSaving(false);
    }
  };

  const openLeaderboard = async () => {
    setLeaderboardOpen(true);
    window.setTimeout(() => {
      document.getElementById('red-pen-leaderboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    await refreshLeaderboard();
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
          {zineData?.enabled !== false && <button type="button" onClick={openZine} data-hint-id="home-wassup" className={homeRouteClass}><span>{zineData?.menuLabel || 'Wassup?'}</span><span aria-hidden="true">→</span></button>}
          {miniGameData?.enabled !== false && <button type="button" onClick={openGame} data-hint-id="home-mini-game" className={homeRouteClass}><span>{miniGameData?.menuLabel || 'Mini Game'}</span><span aria-hidden="true">→</span></button>}
          <button type="button" onClick={() => onNavigate?.('Projects')} data-hint-id="home-selected-work" className={homeRouteClass}><span>Selected work</span><span aria-hidden="true">→</span></button>
          <button type="button" onClick={() => onNavigate?.('Career')} data-hint-id="home-experience" className={homeRouteClass}><span>Experience</span><span aria-hidden="true">→</span></button>
          <button type="button" onClick={() => onNavigate?.('Contact')} data-hint-id="home-contact" className={homeRouteClass}><span>Contact</span><span aria-hidden="true">→</span></button>
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
              <div><p className="font-mono text-[0.75em] uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#8AB4E6]">{mode === 'zine' ? 'Wassup?' : gamePhase === 'library' ? 'Mini Game Archive' : gamePhase.startsWith('hangman-') ? (hangmanSlot?.gameName || 'The Hangman') : 'The Red Pen'}</p><h2 id="home-experience-title" className="mt-1 font-serif text-[1.75em] leading-tight text-gray-900 dark:text-white">{mode === 'zine' ? (zineData?.title || 'Write one. Receive one.') : gamePhase === 'library' ? (miniGameData?.libraryTitle || 'Choose a desk.') : gamePhase.startsWith('hangman-') ? (hangmanSlot?.title || 'Guess the word before the line is complete.') : (miniGameData?.title || 'Inspect the unfinished draft.')}</h2></div>
              <div className="flex items-center gap-3">{mode === 'game' && gamePhase === 'play' && <span className={`font-mono text-sm font-bold tabular-nums ${timeLeft <= 10 ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}`}>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</span>}<button type="button" onClick={closeExperience} className="min-h-11 shrink-0 rounded border border-gray-300 px-4 py-2 text-sm font-semibold hover:border-[#2B579A] hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] dark:border-gray-600" aria-label="Tutup dan kembali ke Home">{hangmanSlot?.hangmanLeaderboardCloseLabel || 'Tutup ×'}</button></div>
            </header>

            {mode === 'zine' && <WassupExperience ctx={{ mode, setMode, zineMode, setZineMode, zineDraft, setZineDraft, zineNotice, setZineNotice, selectedZine, setSelectedZine, gamePhase, setGamePhase, sessionDrafts, setSessionDrafts, draftIndex, setDraftIndex, foundIssues, setFoundIssues, wrongTokens, setWrongTokens, timeLeft, setTimeLeft, rawScore, setRawScore, correctClicks, setCorrectClicks, totalClicks, setTotalClicks, issuesFoundTotal, setIssuesFoundTotal, activeSeconds, setActiveSeconds, hintUsed, setHintUsed, hintedIssue, setHintedIssue, scoreboard, setScoreboard, leaderboardOpen, setLeaderboardOpen, playerName, setPlayerName, leaderboardNotice, setLeaderboardNotice, playerStanding, setPlayerStanding, scoreSaving, setScoreSaving, hangmanWords, setHangmanWords, hangmanIndex, setHangmanIndex, hangmanGuessed, setHangmanGuessed, hangmanSolved, setHangmanSolved, hangmanWrongLetters, setHangmanWrongLetters, hangmanTotalGuesses, setHangmanTotalGuesses, hangmanCorrectGuesses, setHangmanCorrectGuesses, hangmanWordDone, setHangmanWordDone, hangmanStanding, setHangmanStanding, hangmanScoreboard, setHangmanScoreboard, hangmanLeaderboardOpen, setHangmanLeaderboardOpen, hangmanPlayerName, setHangmanPlayerName, hangmanNotice, setHangmanNotice, hangmanSaving, setHangmanSaving, hangmanTimeLeft, setHangmanTimeLeft, hangmanFinishedBy, setHangmanFinishedBy, modalRef, lastTriggerRef, zines, availableDrafts, activeDraft, activeIssues, activeSegments, secondsPerDraft, draftsPerSession, scoreSettings, signatureRole, modalOpen, totalIssues, accuracy, completionRate, finalGrade, hangmanSlot, configuredHangmanWords, activeHangmanWord, hangmanWrongCount, hangmanSolvedCurrent, hangmanAccuracy, hangmanScore, hangmanGradeTitles, hangmanTitle, closeExperience, startHangman, guessHangmanLetter, nextHangmanWord, refreshHangmanLeaderboard, saveHangmanScore, openZine, openGame, saveZineDraft, receiveZine, startGame, finishDraft, clickIssue, clickWrongWord, useHint, refreshLeaderboard, saveLeaderboardScore, openLeaderboard, nextDraft, navigateFromGame, data, zineData, miniGameData, interactiveWords, onNavigate, resultTitle, hangmanMask }} />}
            {mode === 'game' && <MiniGameExperience ctx={{ mode, setMode, zineMode, setZineMode, zineDraft, setZineDraft, zineNotice, setZineNotice, selectedZine, setSelectedZine, gamePhase, setGamePhase, sessionDrafts, setSessionDrafts, draftIndex, setDraftIndex, foundIssues, setFoundIssues, wrongTokens, setWrongTokens, timeLeft, setTimeLeft, rawScore, setRawScore, correctClicks, setCorrectClicks, totalClicks, setTotalClicks, issuesFoundTotal, setIssuesFoundTotal, activeSeconds, setActiveSeconds, hintUsed, setHintUsed, hintedIssue, setHintedIssue, scoreboard, setScoreboard, leaderboardOpen, setLeaderboardOpen, playerName, setPlayerName, leaderboardNotice, setLeaderboardNotice, playerStanding, setPlayerStanding, scoreSaving, setScoreSaving, hangmanWords, setHangmanWords, hangmanIndex, setHangmanIndex, hangmanGuessed, setHangmanGuessed, hangmanSolved, setHangmanSolved, hangmanWrongLetters, setHangmanWrongLetters, hangmanTotalGuesses, setHangmanTotalGuesses, hangmanCorrectGuesses, setHangmanCorrectGuesses, hangmanWordDone, setHangmanWordDone, hangmanStanding, setHangmanStanding, hangmanScoreboard, setHangmanScoreboard, hangmanLeaderboardOpen, setHangmanLeaderboardOpen, hangmanPlayerName, setHangmanPlayerName, hangmanNotice, setHangmanNotice, hangmanSaving, setHangmanSaving, hangmanTimeLeft, setHangmanTimeLeft, hangmanFinishedBy, setHangmanFinishedBy, modalRef, lastTriggerRef, zines, availableDrafts, activeDraft, activeIssues, activeSegments, secondsPerDraft, draftsPerSession, scoreSettings, signatureRole, modalOpen, totalIssues, accuracy, completionRate, finalGrade, hangmanSlot, configuredHangmanWords, activeHangmanWord, hangmanWrongCount, hangmanSolvedCurrent, hangmanAccuracy, hangmanScore, hangmanGradeTitles, hangmanTitle, closeExperience, startHangman, guessHangmanLetter, nextHangmanWord, refreshHangmanLeaderboard, saveHangmanScore, openZine, openGame, saveZineDraft, receiveZine, startGame, finishDraft, clickIssue, clickWrongWord, useHint, refreshLeaderboard, saveLeaderboardScore, openLeaderboard, nextDraft, navigateFromGame, data, zineData, miniGameData, interactiveWords, onNavigate, resultTitle, hangmanMask }} />}
          </section>
        </div>,
        document.body,
      )}

      <style>{`@keyframes zine-print{from{opacity:0;transform:translateY(-24px) scale(.96)}to{opacity:1;transform:none}}@keyframes home-experience-print{0%{clip-path:inset(0 46% 96% 46%);transform:translateY(-8%)}45%{clip-path:inset(0 34% 40% 34%)}100%{clip-path:inset(0);transform:none}}@keyframes red-pen-draft{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}@keyframes red-pen-wrong{0%,100%{transform:none}35%{transform:translateX(-2px)}70%{transform:translateX(2px)}}@keyframes red-pen-hint{50%{box-shadow:0 0 0 4px rgba(245,158,11,.22)}}.home-experience-print-in{animation:home-experience-print .72s cubic-bezier(.2,.8,.2,1) both}.red-pen-draft-in{animation:red-pen-draft .22s ease-out both}.red-pen-wrong{animation:red-pen-wrong .2s ease-out}.red-pen-hint{animation:red-pen-hint .6s ease-in-out 3}.red-pen-token{display:inline;line-height:inherit}@media(prefers-reduced-motion:reduce){.animate-[zine-print_650ms_ease-out],.home-experience-print-in,.red-pen-draft-in,.red-pen-wrong,.red-pen-hint{animation:none!important}}`}</style>
    </section>
  );
}
