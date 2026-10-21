import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const REFRESH_MS = 60_000;
const pickImage = (images = []) => images.filter((item) => item?.['#text']).at(-1)?.['#text'] || '';

const relativeTime = (unixSeconds) => {
  if (!unixSeconds) return '';
  const minutes = Math.floor(Math.max(0, Date.now() - Number(unixSeconds) * 1000) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
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
    title: data.fallbackTitle || 'Midnight City',
    artist: data.fallbackArtist || 'M83',
    album: 'Hurry Up, We\'re Dreaming',
    image: data.fallbackImage || '',
    url: data.fallbackUrl || '',
    nowPlaying: false,
    playedAt: null,
    fallback: true,
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

  // Tastemaker Minimalist Card Design
  const card = (
    <div
      data-hint-id="lastfm-footnote"
      className={`group w-full max-w-[10.5rem] border-t border-b py-2.5 transition-colors ${
        darkMode ? 'border-gray-800 text-gray-100' : 'border-gray-300/80 text-gray-800'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
          {shown.image ? (
            <img
              src={shown.image}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full w-full place-items-center font-serif text-sm text-gray-400">
              ♪
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${shown.nowPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-[#2B579A] dark:bg-[#6FA8DC]'}`} />
            <span className="font-mono text-[0.52em] uppercase tracking-[0.16em] text-gray-400 font-semibold">
              {shown.nowPlaying ? 'Now' : 'Listening'}
            </span>
          </div>
          <p className="truncate font-serif text-[0.8125em] font-medium leading-tight text-gray-900 dark:text-gray-100 group-hover:text-[#2B579A] dark:group-hover:text-[#6FA8DC] transition-colors">
            {shown.title}
          </p>
          <p className="mt-0.5 truncate text-[0.6875em] text-gray-500 dark:text-gray-400">
            {shown.artist}
          </p>
        </div>
      </div>
    </div>
  );

  const rail = (
    <aside
      className="portfolio-rail fixed z-30 hidden md:block"
      style={{ ...style, position: 'fixed', overflow: 'visible', overflowY: 'visible', overscrollBehavior: 'none' }}
      aria-label="Recently played on Last.fm"
    >
      {shown.url ? (
        <a href={shown.url} target="_blank" rel="noreferrer" className="block no-underline focus-visible:ring-2 focus-visible:ring-[#2B579A]">
          {card}
        </a>
      ) : card}
    </aside>
  );

  const mobilePlayer = (
    <div className="fixed bottom-14 right-3 z-[89] md:hidden" data-hint-id="lastfm-footnote-mobile">
      {mobileOpen && (
        <div className={`mb-2 w-[min(78vw,17rem)] rounded-xl border p-3 shadow-xl backdrop-blur ${darkMode ? 'border-slate-700 bg-[#202020]/95 text-slate-100' : 'border-slate-200 bg-white/95 text-slate-800'}`}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-900 shadow-inner dark:border-slate-600">
              {shown.image ? <img src={shown.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full w-full place-items-center text-lg text-white">♪</div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-sm font-semibold leading-tight">{shown.title}</p>
              <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{shown.artist}</p>
              {(shown.album || time) && <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-slate-400">{time || shown.album}</p>}
            </div>
          </div>
          {shown.url && <a href={shown.url} target="_blank" rel="noreferrer" className="mt-2 block truncate font-mono text-[9px] uppercase tracking-[0.08em] text-[#2B579A] dark:text-[#6FA8DC] no-underline">Open on Last.fm →</a>}
        </div>
      )}
      <button
        type="button"
        onClick={() => setMobileOpen((value) => !value)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? 'Close Last.fm player' : 'Open Last.fm player'}
        className={`ml-auto grid h-12 w-12 place-items-center rounded-full border shadow-lg transition-transform active:scale-95 ${darkMode ? 'border-slate-600 bg-[#202020] text-white' : 'border-slate-300 bg-white text-slate-900'}`}
      >
        <span className="relative block h-8 w-8 overflow-hidden rounded-full bg-slate-900 shadow-inner" aria-hidden="true">
          {shown.image && <img src={shown.image} alt="" className="absolute inset-[3px] h-[26px] w-[26px] rounded-full object-cover" loading="lazy" />}
        </span>
      </button>
    </div>
  );

  const content = <>{rail}{mobilePlayer}</>;
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
