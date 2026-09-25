import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const REFRESH_MS = 60_000;
const pickImage = (images = []) => images.filter((item) => item?.['#text']).at(-1)?.['#text'] || '';

const relativeTime = (unixSeconds) => {
  if (!unixSeconds) return '';
  const minutes = Math.floor(Math.max(0, Date.now() - Number(unixSeconds) * 1000) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const normalizeTrack = (track) => track ? ({
  title: track.name || '',
  artist: track.artist?.['#text'] || track.artist?.name || '',
  album: track.album?.['#text'] || '',
  image: pickImage(track.image),
  url: track.url || '',
  nowPlaying: track['@attr']?.nowplaying === 'true',
  playedAt: track.date?.uts || null,
}) : null;

export default function LastFmFootnote({ data = {}, style, darkMode = false }) {
  const apiKey = import.meta.env.VITE_LASTFM_API_KEY;
  const username = String(data.username || '').trim();
  const enabled = data.enabled !== false;
  const [track, setTrack] = useState(null);
  const [status, setStatus] = useState('idle');
  const [mobileOpen, setMobileOpen] = useState(false);

  const fallback = useMemo(() => ({
    title: data.fallbackTitle || '', artist: data.fallbackArtist || '', album: '',
    image: data.fallbackImage || '', url: data.fallbackUrl || '',
    nowPlaying: false, playedAt: null, fallback: true,
  }), [data.fallbackArtist, data.fallbackImage, data.fallbackTitle, data.fallbackUrl]);

  useEffect(() => {
    if (!enabled || !username || !apiKey) {
      return undefined;
    }
    let active = true;
    let controller;
    const loadTrack = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const query = new URLSearchParams({ method: 'user.getrecenttracks', user: username, api_key: apiKey, format: 'json', limit: '1' });
        const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${query}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Last.fm returned ${response.status}`);
        const payload = await response.json();
        if (payload.error) throw new Error(payload.message || 'Last.fm request failed');
        const raw = payload?.recenttracks?.track;
        const first = Array.isArray(raw) ? raw[0] : raw;
        if (!active) return;
        setTrack(normalizeTrack(first));
        setStatus('ready');
      } catch (error) {
        if (!active || error.name === 'AbortError') return;
        console.warn('Listening Footnote gagal mengambil Last.fm:', error);
        setStatus('error');
      }
    };
    loadTrack();
    const timer = window.setInterval(loadTrack, REFRESH_MS);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); };
  }, [apiKey, enabled, username]);

  if (!enabled) return null;
  const configured = Boolean(username && apiKey);
  const shown = configured ? (track || fallback) : fallback;
  if (!shown.title && !shown.artist) {
    return null;
  }
  const time = !shown.nowPlaying && !shown.fallback ? relativeTime(shown.playedAt) : '';
  const card = (
    <div data-hint-id="lastfm-footnote" className={`group w-full overflow-hidden border-y border-slate-300/75 py-3 text-slate-800 ${darkMode ? 'border-slate-700/90 text-slate-100' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-slate-200 dark:bg-slate-800">
          {shown.image ? <img src={shown.image} alt="" className="h-full w-full object-cover grayscale transition duration-500 ease-out group-hover:grayscale-0" loading="lazy" /> : <div className="grid h-full w-full place-items-center font-serif text-2xl text-slate-400">♪</div>}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 font-serif text-[1em] font-semibold leading-tight">{shown.title}</p>
          <p className="mt-1 truncate text-[0.75em] text-slate-500 dark:text-slate-400">{shown.artist}</p>
          {(shown.album || time) && <p className="mt-1 truncate font-mono text-[0.5625em] uppercase tracking-[0.08em] text-slate-400">{time || shown.album}</p>}
        </div>
      </div>
      {status === 'error' && !track && <p className="mt-2 font-mono text-[0.5625em] text-slate-400">Live signal unavailable · showing fallback</p>}
    </div>
  );

  const rail = <aside className="portfolio-rail fixed z-30 hidden md:block" style={{ ...style, position: 'fixed', overflow: 'visible', overflowY: 'visible', overscrollBehavior: 'none' }} aria-label="Recently played on Last.fm">{shown.url ? <a href={shown.url} target="_blank" rel="noreferrer" className="block no-underline focus-visible:ring-2 focus-visible:ring-[#2B579A]">{card}</a> : card}</aside>;

  const mobilePlayer = (
    <div className="fixed bottom-14 right-3 z-[89] md:hidden" data-hint-id="lastfm-footnote-mobile">
      {mobileOpen && (
        <div className={`mb-2 w-[min(78vw,17rem)] rounded-xl border p-3 shadow-xl backdrop-blur ${darkMode ? 'border-slate-700 bg-[#202020]/95 text-slate-100' : 'border-slate-200 bg-white/95 text-slate-800'}`}>
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-300 bg-slate-900 shadow-inner dark:border-slate-600">
              {shown.image ? <img src={shown.image} alt="" className="h-full w-full rounded-full object-cover" loading="lazy" /> : <div className="grid h-full w-full place-items-center text-lg text-white">♪</div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-sm font-semibold leading-tight">{shown.title}</p>
              <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{shown.artist}</p>
              {(shown.album || time) && <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-slate-400">{time || shown.album}</p>}
            </div>
          </div>
          {shown.url && <a href={shown.url} target="_blank" rel="noreferrer" className="mt-2 block truncate font-mono text-[9px] uppercase tracking-[0.08em] text-[#2B579A] no-underline">Open on Last.fm →</a>}
        </div>
      )}
      <button
        type="button"
        onClick={() => setMobileOpen((value) => !value)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? 'Close Last.fm player' : 'Open Last.fm player'}
        className={`ml-auto grid h-14 w-14 place-items-center rounded-full border shadow-lg transition-transform active:scale-95 ${darkMode ? 'border-slate-600 bg-[#202020] text-white' : 'border-slate-300 bg-white text-slate-900'}`}
      >
        <span className="relative block h-10 w-10 overflow-hidden rounded-full bg-slate-900 shadow-inner" aria-hidden="true">
          {shown.image && <img src={shown.image} alt="" className="absolute inset-[5px] h-[30px] w-[30px] rounded-full object-cover" loading="lazy" />}
          <span className="absolute inset-[4px] rounded-full border border-white/20" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-500 bg-white" />
        </span>
      </button>
    </div>
  );

  const content = <>{rail}{mobilePlayer}</>;
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
