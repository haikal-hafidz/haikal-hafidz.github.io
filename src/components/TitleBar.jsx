import { useEffect, useRef, useState } from 'react';
import LanguageToggle from './LanguageToggle';

export default function TitleBar({
  isAdminMode, setIsAdminMode,
  onEnterRecordingView, onRestoreAdminAfterRecording,
  darkMode, setDarkMode,
  isFullscreen, onToggleFullscreen,
  onSave,
  activeTab,
  soundEnabled = true,
  onToggleSound,
  language = 'id',
  onLanguageChange,
  helpActive,
  onToggleHelp,
  hasUnreadPatch = false,
  onTogglePatch,
  patchActive = false,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordQuality, setRecordQuality] = useState('1080');
  const [countdown, setCountdown] = useState(null);
  const [recordingPreview, setRecordingPreview] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [autoZoomEnabled, setAutoZoomEnabled] = useState(true);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const hiddenVideoRef = useRef(null);
  const hiddenCanvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const idleTimeoutRef = useRef(null);
  const chunksRef = useRef([]);
  const countdownTimerRef = useRef(null);
  const recordingStartedFromAdminRef = useRef(false);

  // Virtual Camera Position & Zoom targets
  const cameraStateRef = useRef({
    currentZoom: 1.0,
    currentX: 0.5,
    currentY: 0.5,
    targetZoom: 1.0,
    targetX: 0.5,
    targetY: 0.5,
  });

  const clearRecordingCountdown = () => {
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = null;
    setCountdown(null);
  };

  const stopAnimationAndCleanupTracks = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.pause();
      hiddenVideoRef.current.srcObject = null;
      hiddenVideoRef.current = null;
    }
    hiddenCanvasRef.current = null;
    if (canvasStreamRef.current) {
      canvasStreamRef.current.getTracks().forEach((track) => track.stop());
      canvasStreamRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const cancelRecordingCountdown = () => {
    clearRecordingCountdown();
    stopAnimationAndCleanupTracks();
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    if (recordingStartedFromAdminRef.current) onRestoreAdminAfterRecording?.();
    recordingStartedFromAdminRef.current = false;
  };

  const stopScreenRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch {
        /* ignore */
      }
      recorder.stop();
    } else {
      stopAnimationAndCleanupTracks();
      setIsRecording(false);
      clearRecordingCountdown();
      if (recordingStartedFromAdminRef.current) onRestoreAdminAfterRecording?.();
      recordingStartedFromAdminRef.current = false;
    }
  };

  const closeRecordingPreview = () => {
    if (recordingPreview?.url) URL.revokeObjectURL(recordingPreview.url);
    setRecordingPreview(null);
  };

  // Event interaction handler for Smart Auto-Zoom
  const handleUserInteraction = (event) => {
    if (!isRecording || !autoZoomEnabled) return;

    let targetEl = event.target;
    if (!targetEl || typeof targetEl.getBoundingClientRect !== 'function') return;

    // Find closest meaningful interactive element
    const interactiveContainer = targetEl.closest('button, a, input, select, textarea, [role="button"], [role="tab"], .project-card, section, article, header, img');
    if (interactiveContainer) {
      targetEl = interactiveContainer;
    }

    const rect = targetEl.getBoundingClientRect();
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;

    // Center point of element relative to viewport
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const normX = Math.max(0.1, Math.min(0.9, cx / vw));
    const normY = Math.max(0.1, Math.min(0.9, cy / vh));

    // Determine target zoom level based on element type/size
    let desiredZoom = 1.4;
    if (rect.width > vw * 0.7 || rect.height > vh * 0.7) {
      desiredZoom = 1.2;
    } else if (rect.width < 100 && rect.height < 100) {
      desiredZoom = 1.5;
    }

    cameraStateRef.current.targetX = normX;
    cameraStateRef.current.targetY = normY;
    cameraStateRef.current.targetZoom = desiredZoom;

    // Reset idle timer to gradually zoom out after 2.5 seconds
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      cameraStateRef.current.targetZoom = 1.0;
      cameraStateRef.current.targetX = 0.5;
      cameraStateRef.current.targetY = 0.5;
    }, 2500);
  };

  // Attach global interaction listeners during active recording
  useEffect(() => {
    if (!isRecording) return undefined;

    const onPointerDown = (e) => handleUserInteraction(e);
    const onClick = (e) => handleUserInteraction(e);
    const onFocus = (e) => handleUserInteraction(e);
    const onScroll = () => {
      if (!autoZoomEnabled) return;
      // Slight follow zoom during scroll
      cameraStateRef.current.targetZoom = 1.15;
      cameraStateRef.current.targetX = 0.5;
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(() => {
        cameraStateRef.current.targetZoom = 1.0;
        cameraStateRef.current.targetX = 0.5;
        cameraStateRef.current.targetY = 0.5;
      }, 1800);
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('click', onClick, { passive: true });
    window.addEventListener('focusin', onFocus, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('click', onClick);
      window.removeEventListener('focusin', onFocus);
      window.removeEventListener('scroll', onScroll);
    };
  }, [isRecording, autoZoomEnabled]);

  const startScreenRecording = async (qualityOverride = null) => {
    if (!isAdminMode) return;
    if (isRecording || countdown !== null) return;
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
      window.alert('Browser ini belum mendukung screen recording. Pakai Chrome atau Edge terbaru.');
      return;
    }
    try {
      closeRecordingPreview();
      const requestedQuality = qualityOverride === '720' || qualityOverride === '1080' ? qualityOverride : recordQuality;
      setRecordQuality(requestedQuality);
      const target = requestedQuality === '720' ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: target.width }, height: { ideal: target.height }, frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });

      // Setup hidden video element to receive input stream
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      hiddenVideoRef.current = video;
      await video.play().catch(() => {});

      // Setup canvas for Virtual Camera rendering
      const canvas = document.createElement('canvas');
      canvas.width = target.width;
      canvas.height = target.height;
      hiddenCanvasRef.current = canvas;
      const ctx = canvas.getContext('2d', { alpha: false });

      // Reset camera initial state
      cameraStateRef.current = {
        currentZoom: 1.0,
        currentX: 0.5,
        currentY: 0.5,
        targetZoom: 1.0,
        targetX: 0.5,
        targetY: 0.5,
      };

      // Frame rendering loop with smooth camera lerping
      const renderFrame = () => {
        if (!hiddenCanvasRef.current || !hiddenVideoRef.current) return;

        const cam = cameraStateRef.current;
        // Smooth lerping interpolation
        cam.currentZoom += (cam.targetZoom - cam.currentZoom) * 0.08;
        cam.currentX += (cam.targetX - cam.currentX) * 0.08;
        cam.currentY += (cam.targetY - cam.currentY) * 0.08;

        const vWidth = video.videoWidth || canvas.width;
        const vHeight = video.videoHeight || canvas.height;

        const cropW = vWidth / cam.currentZoom;
        const cropH = vHeight / cam.currentZoom;

        const centerX = cam.currentX * vWidth;
        const centerY = cam.currentY * vHeight;

        let cropX = centerX - cropW / 2;
        let cropY = centerY - cropH / 2;

        // Clamp crop bounds within video dimensions
        cropX = Math.max(0, Math.min(vWidth - cropW, cropX));
        cropY = Math.max(0, Math.min(vHeight - cropH, cropY));

        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        animFrameRef.current = requestAnimationFrame(renderFrame);
      };

      animFrameRef.current = requestAnimationFrame(renderFrame);

      // Capture stream from canvas & combine audio tracks from display stream
      const canvasStream = canvas.captureStream(30);
      canvasStreamRef.current = canvasStream;
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...stream.getAudioTracks(),
      ];
      const combinedStream = new MediaStream(combinedTracks);

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2']
        .find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stopAnimationAndCleanupTracks();
        const recordedBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        if (recordedBlob.size > 0) {
          const url = URL.createObjectURL(recordedBlob);
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const extension = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
          setRecordingPreview({ url, filename: `portfolio-recording-${stamp}.${extension}`, blob: recordedBlob });
        } else {
          console.error('Rekaman kosong (0 bytes)');
        }
        chunksRef.current = [];
        recorderRef.current = null;
        setIsRecording(false);
        clearRecordingCountdown();
        if (recordingStartedFromAdminRef.current) onRestoreAdminAfterRecording?.();
        recordingStartedFromAdminRef.current = false;
      };

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopScreenRecording();
      });

      recordingStartedFromAdminRef.current = true;
      onEnterRecordingView?.();
      setCountdown(3);
      let remaining = 3;

      countdownTimerRef.current = window.setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setCountdown(remaining);
          return;
        }
        clearRecordingCountdown();
        recorder.start(1000);
        setIsRecording(true);
        setRecordingDuration(0);
        durationIntervalRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      }, 1000);
    } catch (error) {
      if (error?.name !== 'NotAllowedError') console.error('Screen recording gagal:', error);
      stopAnimationAndCleanupTracks();
      recorderRef.current = null;
      setIsRecording(false);
      clearRecordingCountdown();
      if (recordingStartedFromAdminRef.current) onRestoreAdminAfterRecording?.();
      recordingStartedFromAdminRef.current = false;
    }
  };

  useEffect(() => {
    const handleCmsRecordingRequest = (event) => {
      if (!isAdminMode) return;
      const quality = event?.detail?.quality === '720' ? '720' : '1080';
      startScreenRecording(quality);
    };
    window.addEventListener('portfolio:start-recording', handleCmsRecordingRequest);
    return () => window.removeEventListener('portfolio:start-recording', handleCmsRecordingRequest);
  }, [isAdminMode, isRecording, countdown, recordQuality]);

  useEffect(() => () => {
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (recordingPreview?.url) URL.revokeObjectURL(recordingPreview.url);
  }, [recordingPreview?.url]);

  return (
    <div className="relative z-50 bg-[#2b579a] text-white flex justify-between items-center px-2 sm:px-3 py-1.5 text-[10pt] leading-4 select-none transition-colors duration-200 border-b border-black/10">
      
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
        {/* Tombol Bell Patch Update */}
        <button
          type="button"
          onClick={onTogglePatch}
          data-hint-id="titlebar-patch"
          data-hint-surface="blue"
          className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer ${
            patchActive
              ? 'border-amber-300 bg-amber-400 text-black shadow'
              : hasUnreadPatch
              ? 'border-red-400 bg-red-500 text-white shadow hover:bg-red-600'
              : 'border-white/25 bg-white/10 text-white hover:bg-white hover:text-[#2B579A]'
          }`}
          title={patchActive ? 'Tutup update patch' : 'Lihat catatan update patch'}
          aria-label={patchActive ? 'Tutup Update Patch' : 'Buka Update Patch'}
          aria-pressed={patchActive}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Tombol Help / Hint Toggle — dipindah dari floating button bawah ke TitleBar di samping LanguageToggle */}
        <button
          type="button"
          onClick={onToggleHelp}
          data-hint-id="titlebar-help"
          data-hint-surface="blue"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer ${
            helpActive
              ? 'border-amber-300 bg-amber-400 text-black shadow'
              : 'border-white/25 bg-white/10 text-white hover:bg-white hover:text-[#2B579A]'
          }`}
          title={helpActive ? 'Matikan mode Help' : 'Tunjukkan apa saja yang bisa diklik'}
          aria-label={helpActive ? 'Matikan Help' : 'Aktifkan Help'}
          aria-pressed={helpActive}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-1.5c0-.9.5-1.4 1.2-1.9.8-.6 1.3-1.3 1.3-2.3A2.5 2.5 0 0 0 12 7.8a2.5 2.5 0 0 0-2.5 2.5" strokeLinecap="round" />
            <circle cx="12" cy="17.6" r="0.6" fill="currentColor" stroke="none" />
          </svg>
        </button>

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
          disabled={isRecording || countdown !== null}
          data-hint-id="titlebar-admin"
          data-hint-surface="blue"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
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
          <div className="flex flex-col items-center gap-4">
            <div className="grid h-28 w-28 place-items-center rounded-full border-4 border-white bg-[#2B579A] font-mono text-5xl font-bold text-white shadow-2xl">{countdown}</div>
            <button type="button" onClick={cancelRecordingCountdown} className="rounded-full border border-white/70 bg-black/35 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-black/55">Cancel Recording</button>
          </div>
        </div>
      )}

      {/* macOS-Inspired Floating Recording Controls Pill */}
      {isRecording && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[190] flex items-center gap-3 px-4 py-2 bg-neutral-900/90 backdrop-blur-xl text-white border border-white/20 rounded-full shadow-2xl text-xs font-sans tracking-tight transition-all duration-300"
          role="region"
          aria-label="Recording Controls"
        >
          {/* Animated Recording Indicator */}
          <div className="flex items-center gap-2 pr-2 border-r border-white/20">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="font-mono font-bold text-white/90 text-xs tracking-wider">
              {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:{(recordingDuration % 60).toString().padStart(2, '0')}
            </span>
          </div>

          {/* Smart Auto-Zoom Toggle Badge */}
          <button
            type="button"
            onClick={() => setAutoZoomEnabled((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
              autoZoomEnabled
                ? 'bg-blue-600/40 text-blue-200 border border-blue-400/30 hover:bg-blue-600/60'
                : 'bg-white/10 text-white/50 border border-white/10 hover:bg-white/20 hover:text-white/80'
            }`}
            title={autoZoomEnabled ? 'Smart Auto-Zoom Aktif' : 'Smart Auto-Zoom Nonaktif'}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Auto-Zoom {autoZoomEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Stop Recording Button */}
          <button
            type="button"
            onClick={stopScreenRecording}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold rounded-full px-3 py-1 text-xs transition-all shadow-md hover:scale-105 cursor-pointer"
            title="Hentikan dan simpan rekaman"
          >
            <span className="h-2 w-2 rounded-sm bg-white" aria-hidden="true" />
            Stop
          </button>
        </div>
      )}

      {recordingPreview && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Preview rekaman">
          <div className="w-full max-w-4xl rounded-2xl border border-white/15 bg-neutral-900 text-white p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">Preview Recording</h2>
                  <p className="text-xs text-neutral-400">Hasil perekaman layar dengan Smart Auto-Zoom virtual camera.</p>
                </div>
              </div>
              <button type="button" onClick={closeRecordingPreview} className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors" aria-label="Tutup dan buang rekaman">×</button>
            </div>

            <video src={recordingPreview.url} controls autoPlay className="max-h-[65vh] w-full rounded-xl bg-black border border-white/10 shadow-inner" />

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-mono text-neutral-400">{recordingPreview.filename}</span>
              <div className="flex gap-2">
                <button type="button" onClick={closeRecordingPreview} className="rounded-xl border border-white/20 bg-white/5 hover:bg-white/15 px-4 py-2 text-xs font-semibold text-neutral-200 transition-colors cursor-pointer">Discard</button>
                <a href={recordingPreview.url} download={recordingPreview.filename} onClick={() => window.setTimeout(closeRecordingPreview, 800)} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow-lg transition-all flex items-center gap-1.5 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download Video
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
