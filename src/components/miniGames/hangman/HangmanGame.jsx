import React from 'react';

export default function HangmanGame({ ctx }) {
  const { mode, setMode, zineMode, setZineMode, zineDraft, setZineDraft, zineNotice, setZineNotice, selectedZine, setSelectedZine, gamePhase, setGamePhase, sessionDrafts, setSessionDrafts, draftIndex, setDraftIndex, foundIssues, setFoundIssues, wrongTokens, setWrongTokens, timeLeft, setTimeLeft, rawScore, setRawScore, correctClicks, setCorrectClicks, totalClicks, setTotalClicks, issuesFoundTotal, setIssuesFoundTotal, activeSeconds, setActiveSeconds, hintUsed, setHintUsed, hintedIssue, setHintedIssue, scoreboard, setScoreboard, leaderboardOpen, setLeaderboardOpen, playerName, setPlayerName, leaderboardNotice, setLeaderboardNotice, playerStanding, setPlayerStanding, scoreSaving, setScoreSaving, hangmanWords, setHangmanWords, hangmanIndex, setHangmanIndex, hangmanGuessed, setHangmanGuessed, hangmanSolved, setHangmanSolved, hangmanWrongLetters, setHangmanWrongLetters, hangmanTotalGuesses, setHangmanTotalGuesses, hangmanCorrectGuesses, setHangmanCorrectGuesses, hangmanWordDone, setHangmanWordDone, hangmanStanding, setHangmanStanding, hangmanScoreboard, setHangmanScoreboard, hangmanLeaderboardOpen, setHangmanLeaderboardOpen, hangmanPlayerName, setHangmanPlayerName, hangmanNotice, setHangmanNotice, hangmanSaving, setHangmanSaving, hangmanTimeLeft, setHangmanTimeLeft, hangmanFinishedBy, setHangmanFinishedBy, modalRef, lastTriggerRef, zines, availableDrafts, activeDraft, activeIssues, activeSegments, secondsPerDraft, draftsPerSession, scoreSettings, signatureRole, modalOpen, totalIssues, accuracy, completionRate, finalGrade, hangmanSlot, configuredHangmanWords, activeHangmanWord, hangmanWrongCount, hangmanSolvedCurrent, hangmanAccuracy, hangmanScore, hangmanGradeTitles, hangmanTitle, closeExperience, startHangman, guessHangmanLetter, nextHangmanWord, refreshHangmanLeaderboard, saveHangmanScore, openZine, openGame, saveZineDraft, receiveZine, startGame, finishDraft, clickIssue, clickWrongWord, useHint, refreshLeaderboard, saveLeaderboardScore, openLeaderboard, nextDraft, navigateFromGame, data, zineData, miniGameData, interactiveWords, onNavigate, resultTitle, hangmanMask } = ctx;
  return (<>
              {gamePhase === 'hangman-intro' && <div className="mx-auto max-w-3xl py-3 sm:py-6">
                <div className="mb-5 flex flex-wrap gap-2"><button type="button" onClick={() => setGamePhase('library')} className="min-h-11 rounded border border-gray-300 px-4 py-2 font-mono text-xs font-bold uppercase dark:border-gray-600">← Balik ke Menu Games</button></div><section className="border-y border-gray-200 py-5 dark:border-gray-700"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Tujuan permainan</p><p className="mt-2 font-serif text-xl leading-relaxed text-gray-700 dark:text-gray-200">{hangmanSlot?.objective || 'Lima belas kata menunggu untuk ditebak. Gunakan petunjuk yang tersedia dan temukan setiap kata sebelum waktu habis—atau Hangman selesai digambar.'}</p></section>
                <section className="mt-5"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Aturan main</p><ol className="mt-3 grid grid-cols-1 text-sm leading-relaxed">{[hangmanSlot?.rules?.click || 'Pilih huruf A–Z untuk menebak kata berdasarkan petunjuk singkat.', hangmanSlot?.rules?.timer || 'Setiap kata memberi enam kesempatan salah: kepala, badan, tangan kanan, tangan kiri, kaki kanan, lalu kaki kiri.', hangmanSlot?.rules?.wrong || 'Tebakan benar membuka semua kemunculan huruf yang sama. Huruf yang sudah dipilih tidak dapat digunakan kembali.', hangmanSlot?.rules?.hint || 'Berhasil menebak kata akan mengosongkan Hangman dan membawa Anda ke kata berikutnya. Selesaikan 15 kata dalam 10 menit.', hangmanSlot?.rules?.review || 'Kesalahan keenam atau waktu 00:00 mengakhiri permainan.'].map((rule,index)=><li key={index} className="border-t border-gray-300 py-3"><strong>{String(index+1).padStart(2,'0')}.</strong> {rule}</li>)}</ol></section>
                <section className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Sistem permainan</p><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Kata per sesi</dt><dd>15</dd></div><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Kesalahan maksimal</dt><dd>6</dd></div><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Waktu sesi</dt><dd>10 menit</dd></div><div className="flex justify-between"><dt>Input</dt><dd>A–Z</dd></div></dl></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Rincian gelar</p><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Master Wordsmith</dt><dd>15/15</dd></div><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Seasoned Linguist</dt><dd>10–14</dd></div><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Vocabulary Scout</dt><dd>5–9</dd></div><div className="flex justify-between"><dt>Word Rookie</dt><dd>0–4</dd></div></dl></div></section>
                <button type="button" onClick={startHangman} className="mt-7 min-h-12 rounded bg-[#2B579A] px-6 py-3 font-mono text-sm font-bold uppercase tracking-wide text-white hover:bg-[#234a84]">{hangmanSlot?.startButtonLabel || 'Mulai Menggantung'} →</button><p className="mt-3 font-mono text-xs text-gray-500">15 kata · 10 menit · keyboard A–Z</p>
              </div>}

              {gamePhase === 'hangman-play' && activeHangmanWord && <div className="mx-auto max-w-3xl py-2">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs uppercase tracking-wide text-gray-500">
                  <span>Kata {hangmanIndex + 1}/{hangmanWords.length} · Waktu {Math.floor(hangmanTimeLeft / 60)}:{String(hangmanTimeLeft % 60).padStart(2, '0')}</span>
                  <span>Terjawab {hangmanSolved} · Akurasi {hangmanAccuracy}% · Salah {hangmanWrongCount}/6</span>
                </div>
                <article className="border-y border-gray-200 py-7 dark:border-gray-700">
                  <div className="grid gap-7 md:grid-cols-[13rem_1fr] md:items-center">
                    <div className="grid min-h-56 place-items-center border-r-0 border-gray-200 md:border-r dark:border-gray-700">
                      <svg className="h-48 w-36 text-gray-800 dark:text-gray-100" viewBox="0 0 180 240" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-label={`${hangmanWrongCount} dari 6 kesalahan`}>
                        <path d="M18 220h145M45 220V20h85M130 20v28"/>
                        {hangmanWrongCount >= 1 && <circle cx="130" cy="68" r="18"/>}
                        {hangmanWrongCount >= 2 && <path d="M130 86v58"/>}
                        {hangmanWrongCount >= 3 && <path d="M130 101 101 121"/>}
                        {hangmanWrongCount >= 4 && <path d="m130 101 29 20"/>}
                        {hangmanWrongCount >= 5 && <path d="m130 144-24 35"/>}
                        {hangmanWrongCount >= 6 && <path d="m130 144 24 35"/>}
                      </svg>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">{hangmanSlot?.hangmanClueLabel || 'Petunjuk'}</p>
                      <p className="mt-2 font-serif text-xl leading-relaxed text-gray-700 dark:text-gray-200">{activeHangmanWord.clue}</p>
                      <p className="mt-7 break-words font-mono text-2xl font-bold tracking-[0.16em] sm:text-3xl">{hangmanWordDone && !hangmanSolvedCurrent ? activeHangmanWord.word.split('').join(' ') : hangmanMask(activeHangmanWord.word, hangmanGuessed)}</p>
                    </div>
                  </div>
                </article>
                {!hangmanWordDone ? <div className="mt-5">
                  <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm text-gray-600 dark:text-gray-300">{hangmanSlot?.hangmanChooseLetterLabel || 'Pilih satu huruf'}</p><p className="font-mono text-xs text-gray-500">{hangmanSlot?.hangmanRemainingLabel || 'Kesempatan tersisa'} {6 - hangmanWrongCount}</p></div>
                  <div className="grid grid-cols-7 gap-2 sm:grid-cols-9">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => <button key={letter} type="button" disabled={hangmanGuessed.includes(letter)} onClick={() => guessHangmanLetter(letter)} className="aspect-square rounded border border-gray-300 bg-white font-mono text-sm font-bold hover:border-[#2B579A] hover:text-[#2B579A] disabled:cursor-default disabled:opacity-25 dark:border-gray-600 dark:bg-[#202020]">{letter}</button>)}</div>
                </div> : <section aria-live="polite" className="mt-7">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#2B579A]">{hangmanSolvedCurrent ? (hangmanSlot?.hangmanWordCompleteLabel || 'Kata selesai') : (hangmanSlot?.hangmanDeathRevealLabel || 'Enam kesalahan · jawaban dibuka')}</p>
                  <div className="mt-4 border-l-2 border-[#2B579A] pl-4"><p className="text-sm">{hangmanSolvedCurrent ? (hangmanSlot?.hangmanSafeMessage || 'Selamat, lehernya aman.') : <>{hangmanSlot?.hangmanAnswerPrefix || 'Kata yang dicari:'} <strong>{activeHangmanWord.word}</strong></>}</p></div>
                  {hangmanFinishedBy !== 'hangman' && <button type="button" onClick={nextHangmanWord} className="mt-7 min-h-11 rounded bg-[#2B579A] px-5 py-2 font-mono text-sm font-bold uppercase tracking-wide text-white">{hangmanIndex >= hangmanWords.length - 1 ? (hangmanSlot?.hangmanSeeResultLabel || 'Lihat hasil →') : (hangmanSlot?.hangmanNextWordLabel || 'Kata berikutnya →')}</button>}
                </section>}
              </div>}

              {(gamePhase === 'hangman-result' || (gamePhase === 'hangman-play' && hangmanFinishedBy === 'hangman')) && <div className="mx-auto max-w-3xl py-8">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-[#2B579A]">{hangmanSlot?.resultEyebrow || 'Laporan akhir'} · {hangmanSolved}/15 kata</p>
                <h3 className="mt-2 font-serif text-3xl">{hangmanTitle}</h3>{hangmanFinishedBy && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{hangmanFinishedBy === 'hangman' ? (hangmanSlot?.hangmanDeathMessage || 'Siapa Yang Bilang Kata-kata Ngga Bisa Membunuh?') : (hangmanSlot?.hangmanTimeoutMessage || 'Waktu habis. Kata-kata menang kali ini.')}</p>}

                {hangmanStanding?.rank === 1 && <p className="mt-4 font-serif text-xl font-bold">{hangmanSlot?.hangmanPodiumFirst || 'Selamat. Kosa Kata Anda Menyelamatkan Nyawa.'}</p>}
                {hangmanStanding?.rank === 2 && <p className="mt-4 font-serif text-xl font-bold">{hangmanSlot?.hangmanPodiumSecond || 'Runner Up. Banyak Kata, Kurang Tahta.'}</p>}
                {hangmanStanding?.rank === 3 && <p className="mt-4 font-serif text-xl font-bold">{hangmanSlot?.hangmanPodiumThird || 'Peringkat Tiga. Setidaknya Bukan yang Digantung.'}</p>}
                {hangmanStanding?.rank > 3 && <p className="mt-4 font-mono text-sm">{hangmanSlot?.hangmanRankPrefix || 'Anda berada di peringkat'} <strong>#{hangmanStanding.rank}</strong>{hangmanStanding.totalPlayers ? ` dari ${hangmanStanding.totalPlayers} ${hangmanSlot?.hangmanRankPlayersSuffix || 'pemain'}` : ''}.</p>}

                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div className="rounded border border-gray-300 p-4 dark:border-gray-700"><span className="block font-mono text-[10px] uppercase text-gray-500">{hangmanSlot?.hangmanSolvedLabel || 'Terjawab'}</span><strong className="mt-1 block text-xl">{hangmanSolved}/15</strong></div>
                  <div className="rounded border border-gray-300 p-4 dark:border-gray-700"><span className="block font-mono text-[10px] uppercase text-gray-500">{hangmanSlot?.hangmanAccuracyLabel || 'Akurasi'}</span><strong className="mt-1 block text-xl">{hangmanAccuracy}%</strong></div>
                  <div className="rounded border border-gray-300 p-4 dark:border-gray-700"><span className="block font-mono text-[10px] uppercase text-gray-500">{hangmanSlot?.hangmanWrongLettersLabel || 'Huruf salah'}</span><strong className="mt-1 block text-xl">{hangmanWrongLetters.length}</strong></div>
                </div>

                {!hangmanStanding && <div className="mt-6 max-w-md">
                  <label className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500" htmlFor="hangman-player-name">{hangmanSlot?.hangmanNamePrompt || 'Masukkan nama / alias untuk masuk klasemen'}</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input id="hangman-player-name" type="text" maxLength={24} value={hangmanPlayerName} onChange={(event) => { setHangmanPlayerName(event.target.value); setHangmanNotice(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveHangmanScore(); } }} placeholder={hangmanSlot?.hangmanNamePlaceholder || "Nama / alias"} className="min-h-11 min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#2B579A] dark:border-gray-600 dark:bg-[#202020]" />
                    <button type="button" disabled={hangmanSaving} onClick={saveHangmanScore} className="min-h-11 rounded bg-[#2B579A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{hangmanSaving ? (hangmanSlot?.hangmanSavingLabel || 'Menyimpan…') : (hangmanSlot?.hangmanSaveScoreLabel || 'Simpan Skor')}</button>
                  </div>
                  {hangmanNotice && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{hangmanNotice}</p>}
                </div>}

                {hangmanStanding && <div className="mx-auto mt-6 max-w-md border-y border-gray-200 py-3 font-mono text-sm dark:border-gray-700"><span className="text-gray-500">{hangmanSlot?.hangmanYourRankLabel || 'Peringkatmu'}</span><strong className="ml-3 text-lg">#{hangmanStanding.rank}</strong>{hangmanStanding.totalPlayers ? <span className="ml-1 text-gray-500">dari {hangmanStanding.totalPlayers}</span> : null}<span className="ml-3 text-[10px] uppercase text-gray-400">{hangmanSlot?.hangmanBestScoreLabel || 'Skor terbaik tersimpan'}</span></div>}

                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                  <button type="button" onClick={startHangman} className="min-h-11 w-full rounded bg-[#2B579A] px-4 py-2 text-sm font-bold text-white">{hangmanSlot?.replayLabel || 'Main Lagi'}</button>
                  <button type="button" onClick={async () => { setHangmanLeaderboardOpen(true); await refreshHangmanLeaderboard(); window.setTimeout(() => document.getElementById('hangman-leaderboard')?.scrollIntoView({ behavior: 'smooth' }), 0); }} className="min-h-11 w-full rounded border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-600">{hangmanSlot?.hangmanLeaderboardLabel || 'Lihat Klasemen'}</button>
                  <button type="button" onClick={() => setGamePhase('library')} className="min-h-11 w-full rounded border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-600">Balik ke Menu Games</button>
                </div>
                {hangmanLeaderboardOpen && <div id="hangman-leaderboard" className="mx-auto mt-8 max-w-xl scroll-mt-6 border-t border-gray-200 pt-6 text-left dark:border-gray-700">
                  <div className="flex items-end justify-between gap-3"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#2B579A]">The Hangman</p><h4 className="mt-1 font-serif text-2xl">{hangmanSlot?.hangmanLeaderboardTitle || 'Klasemen'}</h4></div><button type="button" onClick={() => setHangmanLeaderboardOpen(false)} className="font-mono text-xs text-gray-500 hover:text-[#2B579A]">{hangmanSlot?.hangmanLeaderboardCloseLabel || 'Tutup ×'}</button></div>
                  <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                    {hangmanScoreboard.length ? hangmanScoreboard.map((row,index) => <div key={row.id || index} className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-3 ${hangmanStanding?.playerId === row.playerId ? 'font-bold text-[#2B579A]' : ''}`}><span className="font-mono text-xs">{String(index+1).padStart(2,'0')}</span><span className="truncate text-sm">{row.playerName || 'Anonymous'}{hangmanStanding?.playerId === row.playerId ? ' · ' + (hangmanSlot?.hangmanYouLabel || 'Kamu') : ''}</span><span className="font-mono text-sm font-bold">{row.score}</span></div>) : <p className="py-5 text-center text-sm text-gray-500">{hangmanSlot?.hangmanLeaderboardEmptyLabel || 'Belum ada penghuni klasemen.'}</p>}
                  </div>
                  {hangmanStanding?.rank > hangmanScoreboard.length && <div className="mt-3 grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded border border-dashed border-[#2B579A] px-3 py-3 font-bold text-[#2B579A]"><span className="font-mono text-xs">#{hangmanStanding.rank}</span><span className="truncate text-sm">{hangmanStanding.playerName || hangmanPlayerName} · {hangmanSlot?.hangmanYouLabel || 'Kamu'}</span><span className="font-mono text-sm">{hangmanStanding.score}</span></div>}
                </div>}
              </div>}
  </>);
}
