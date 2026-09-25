import { useEffect, useRef, useState } from 'react';
import LanguageToggle from './LanguageToggle';

export default function TitleBar({
  isAdminMode, setIsAdminMode,
  darkMode, setDarkMode,
  isFullscreen, onToggleFullscreen,
  onSave,
  activeTab,
  soundEnabled = true,
  onToggleSound,
  language = 'id',
  onLanguageChange,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordQuality, setRecordQuality] = useState('1080');
  const [countdown, setCountdown] = useState(null);
  const [recordingPreview, setRecordingPreview] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const stopScreenRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const closeRecordingPreview = () => {
    if (recordingPreview?.url) URL.revokeObjectURL(recordingPreview.url);
    setRecordingPreview(null);
  };

  const startScreenRecording = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      window.alert('Browser ini belum mendukung screen recording. Pakai Chrome atau Edge terbaru.');
      return;
    }
    try {
      closeRecordingPreview();
      const target = recordQuality === '720' ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: target.width }, height: { ideal: target.height }, frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
      const mimeType = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
        setRecordingPreview({ url, filename: `portfolio-recording-${stamp}.${extension}` });
        stream.getTracks().forEach((track) => track.stop());
        chunksRef.current = [];
        streamRef.current = null;
        recorderRef.current = null;
        setIsRecording(false);
      };
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state !== 'inactive') recorder.stop();
      });

      // Tutup CMS sebelum frame pertama direkam supaya hasil langsung menampilkan website publik.
      setIsAdminMode(false);
      setCountdown(3);
      let remaining = 3;
      const countdownTimer = window.setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setCountdown(remaining);
          return;
        }
        window.clearInterval(countdownTimer);
        setCountdown(null);
        recorder.start(1000);
        setIsRecording(true);
      }, 1000);
    } catch (error) {
      if (error?.name !== 'NotAllowedError') console.error('Screen recording gagal:', error);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setIsRecording(false);
      setCountdown(null);
    }
  };

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingPreview?.url) URL.revokeObjectURL(recordingPreview.url);
  }, [recordingPreview?.url]);

  return (
    <div className="bg-[#2b579a] dark:bg-[#1e1e1e] text-white flex justify-between items-center px-2 sm:px-3 py-1.5 text-[10pt] leading-4 select-none transition-colors duration-200 border-b border-black/10">
      
      {/* BAGIAN KIRI: kosong di halaman publik; quick controls hanya muncul di Admin. */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {isAdminMode && (
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={onSave}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-[11px] transition-colors shadow-sm"
              title="Simpan Perubahan CMS"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span className="hidden sm:inline">Save</span>
            </button>
            <button
              type="button"
              onClick={startScreenRecording}
              className="flex items-center gap-1 rounded bg-red-600 px-2 py-0.5 text-[11px] text-white shadow-sm transition-colors hover:bg-red-500"
              title="Rekam tampilan website"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />
              <span className="hidden sm:inline">Record</span>
            </button>
            <select value={recordQuality} onChange={(event) => setRecordQuality(event.target.value)} className="h-6 rounded border border-white/25 bg-white/10 px-1 text-[10px] text-white outline-none" title="Kualitas rekaman">
              <option value="720" className="text-black">720p</option>
              <option value="1080" className="text-black">1080p</option>
            </select>
            <button className="p-1 hover:bg-white/10 rounded text-white/80 hover:text-white hidden sm:block" title="Undo">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"></path></svg>
            </button>
            <button className="p-1 hover:bg-white/10 rounded text-white/80 hover:text-white hidden sm:block" title="Redo">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4"></path></svg>
            </button>
          </div>
        )}
      </div>

      {/* BAGIAN KANAN: Mode Toggle & Tombol Admin Only */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {isRecording && (
          <button type="button" onClick={stopScreenRecording} className="flex h-8 items-center gap-1.5 rounded-full border border-red-200 bg-red-600 px-3 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm animate-pulse" title="Hentikan dan unduh rekaman">
            <span className="h-2 w-2 rounded-sm bg-white" aria-hidden="true" /> Stop
          </button>
        )}
        <LanguageToggle activeTab={activeTab} language={language} onLanguageChange={onLanguageChange} />
        <div className="flex items-center gap-1.5" data-hint-id="titlebar-sound" data-hint-surface="blue">
          <button
            type="button"
            onClick={onToggleSound}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:scale-105 hover:bg-white hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
            title={soundEnabled ? 'Suara opening aktif · klik untuk mute' : 'Suara opening mati · klik untuk aktifkan'}
            aria-label={soundEnabled ? 'Mute suara opening Visitor Copy, Mini Games, dan Wassup' : 'Aktifkan suara opening Visitor Copy, Mini Games, dan Wassup'}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" strokeLinejoin="round"/><path d="M15 9a4 4 0 0 1 0 6M17.8 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round"/></svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" strokeLinejoin="round"/><path d="m16 10 5 5m0-5-5 5" strokeLinecap="round"/></svg>
            )}
          </button>
        </div>
        {/* Tombol Toggle Light / Dark Mode — di layar sempit cuma nampilin ikon, teksnya disembunyiin.
            data-hint-id cuma dipasang pas activeTab === 'Home' (lihat App.jsx: HintToggle & CSS
            .hint-mode-active), biar mode Hint di luar A4 sengaja dibatasin ke tab Home doang. */}
        <button 
          onClick={() => setDarkMode(!darkMode)}
          data-hint-id="titlebar-dark-mode"
          data-hint-surface="blue"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:scale-105 hover:bg-white hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
          aria-label={darkMode ? 'Aktifkan Light Mode' : 'Aktifkan Dark Mode'}
        >
          {darkMode ? (
            <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg className="w-4 h-4 text-gray-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>
          )}
        </button>

        {/* Tombol Toggle Full Screen — expand seluruh web (title bar, ribbon, dokumen,
            status bar) pake Fullscreen API browser (logic-nya di App.jsx, dikirim ke
            sini lewat props isFullscreen & onToggleFullscreen). Sama kayak tombol Dark
            Mode: di layar sempit cuma nampilin ikon, teksnya disembunyiin. */}
        <button
          onClick={onToggleFullscreen}
          data-hint-id="titlebar-fullscreen"
          data-hint-surface="blue"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:scale-105 hover:bg-white hover:text-[#2B579A] focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
          title={isFullscreen ? 'Keluar dari Full Screen' : 'Full Screen'}
          aria-label={isFullscreen ? 'Keluar dari Full Screen' : 'Masuk Full Screen'}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v3a2 2 0 01-2 2H4M15 3v3a2 2 0 002 2h3M9 21v-3a2 2 0 00-2-2H4M15 21v-3a2 2 0 012-2h3"></path></svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V5a1 1 0 011-1h3M20 8V5a1 1 0 00-1-1h-3M4 16v3a1 1 0 001 1h3M20 16v3a1 1 0 01-1 1h-3"></path></svg>
          )}
        </button>

        {/* Pintu Masuk Admin Only */}
        <button
          type="button"
          onClick={() => setIsAdminMode(!isAdminMode)}
          data-hint-id="titlebar-admin"
          data-hint-surface="blue"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] transition-all ${
            isAdminMode 
              ? 'border-amber-300 bg-amber-500 text-black shadow hover:bg-amber-400' 
              : 'border-white/25 bg-white/10 text-white hover:scale-105 hover:bg-white hover:text-[#2B579A]'
          }`}
          title={isAdminMode ? 'Keluar dari Admin' : 'Admin Only'}
          aria-label={isAdminMode ? 'Keluar dari Admin' : 'Masuk Admin Only'}
          aria-pressed={isAdminMode}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="8" r="3.25" />
            <path d="M5.5 20c.7-4.1 3-6.2 6.5-6.2s5.8 2.1 6.5 6.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Tombol minimize/maximize standar windows — cuma dekorasi, disembunyiin di layar sempit biar gak numpuk */}
        <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-white/25 text-white/70">
          <span className="px-2 py-0.5 hover:bg-white/15 rounded cursor-pointer">&#8211;</span>
          <span className="px-2 py-0.5 hover:bg-white/15 rounded cursor-pointer">&#9633;</span>
          <span className="px-2 py-0.5 hover:bg-red-600 rounded cursor-pointer">&#10005;</span>
        </div>
      </div>

      {countdown !== null && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/35 backdrop-blur-[2px]" aria-live="assertive">
          <div className="grid h-28 w-28 place-items-center rounded-full border-4 border-white bg-[#2B579A] font-mono text-5xl font-bold text-white shadow-2xl">{countdown}</div>
        </div>
      )}

      {recordingPreview && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Preview rekaman">
          <div className="w-full max-w-4xl rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-[#202020] dark:text-white">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h2 className="font-mono text-sm font-bold uppercase tracking-wider">Preview Recording</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Periksa hasilnya sebelum disimpan.</p></div>
              <button type="button" onClick={closeRecordingPreview} className="grid h-8 w-8 place-items-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Tutup dan buang rekaman">×</button>
            </div>
            <video src={recordingPreview.url} controls autoPlay className="max-h-[70vh] w-full rounded-lg bg-black" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeRecordingPreview} className="rounded border border-gray-300 px-4 py-2 text-xs font-semibold dark:border-gray-600">Discard</button>
              <a href={recordingPreview.url} download={recordingPreview.filename} onClick={() => window.setTimeout(closeRecordingPreview, 800)} className="rounded bg-[#2B579A] px-4 py-2 text-xs font-bold text-white hover:bg-[#21477f]">Download</a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
