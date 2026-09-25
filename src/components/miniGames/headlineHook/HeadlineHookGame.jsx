import { getMiniGameLeaderboard, submitMiniGameScore } from '../../../lib/homeExperienceApi';
import React, { useMemo, useState } from 'react';

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

export default function HeadlineHookGame({ ctx, game }) {
  const { gamePhase, setGamePhase } = ctx;
  const [session, setSession] = useState([]);
  const [index, setIndex] = useState(0);
  const [choiceId, setChoiceId] = useState('');
  const [reports, setReports] = useState([]);
  const [locked, setLocked] = useState(false);

  const [playerName,setPlayerName]=useState(''); const [board,setBoard]=useState([]); const [boardOpen,setBoardOpen]=useState(false); const [standing,setStanding]=useState(null); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState(''); const [startedAt,setStartedAt]=useState(0);
  const activeSeconds=startedAt?Math.max(0,Math.floor((Date.now()-startedAt)/1000)):0;
  const activeCase = session[index];
  const activeChoice = activeCase?.options?.find((item) => item.id === choiceId);
  const totalScore = reports.reduce((sum, item) => sum + item.score, 0);
  const averages = useMemo(() => {
    if (!reports.length) return { clarity: 0, relevance: 0, hook: 0 };
    return {
      clarity: Math.round(reports.reduce((s, x) => s + x.clarity, 0) / reports.length),
      relevance: Math.round(reports.reduce((s, x) => s + x.relevance, 0) / reports.length),
      hook: Math.round(reports.reduce((s, x) => s + x.hook, 0) / reports.length),
    };
  }, [reports]);

  const start = () => {
    const pool = (game?.cases || []).filter((item) => item?.enabled !== false);
    setSession(shuffle(pool).slice(0, Math.min(Number(game?.casesPerSession) || 10, pool.length)));
    setIndex(0); setChoiceId(''); setReports([]); setLocked(false);
    setStartedAt(Date.now()); setStanding(null); setNotice(''); setGamePhase('headline-play');
  };

  const submit = () => {
    if (!activeChoice || locked) return;
    const score = Number(activeChoice.clarity || 0) + Number(activeChoice.relevance || 0) + Number(activeChoice.hook || 0);
    setReports((prev) => [...prev, { caseId: activeCase.id, headline: activeChoice.text, clarity: activeChoice.clarity || 0, relevance: activeChoice.relevance || 0, hook: activeChoice.hook || 0, risks: activeChoice.risks || [], score }]);
    setLocked(true);
  };

  const next = () => {
    if (index >= session.length - 1) { setGamePhase('headline-result'); return; }
    setIndex((v) => v + 1); setChoiceId(''); setLocked(false);
  };

  const refreshBoard=async()=>{try{setBoard(await getMiniGameLeaderboard('headline-hook',20));setBoardOpen(true);}catch{setNotice('Klasemen belum dapat dimuat.');}};
  const save=async()=>{if(playerName.trim().length<2){setNotice('Nama / alias minimal 2 karakter.');return;}setSaving(true);try{const accuracy=Math.round(totalScore/Math.max(1,session.length*100)*100);const st=await submitMiniGameScore({gameId:'headline-hook',playerName,score:totalScore,accuracy,correctCount:reports.filter(x=>x.score>=90).length,totalQuestions:session.length,activeSeconds});setStanding(st);setNotice('');await refreshBoard();}catch{setNotice('Skor belum dapat disimpan.');}finally{setSaving(false);}};
  const grade = (game?.gradeTitles || []).slice().sort((a,b)=>Number(b.min)-Number(a.min)).find((g)=>totalScore >= Number(g.min)) || { label:'First Draft', remark:'' };
  const strongest = Object.entries(averages).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'clarity';
  const dimensionLabel = strongest === 'clarity' ? game?.clarityLabel : strongest === 'relevance' ? game?.relevanceLabel : game?.hookLabel;

  if (gamePhase === 'headline-intro') return <section className="mx-auto max-w-3xl py-6"><button type="button" onClick={()=>setGamePhase('library')} className="mb-5 min-h-11 rounded border border-gray-300 px-4 py-2 font-mono text-xs font-bold uppercase dark:border-gray-600">← Balik ke Menu Games</button><section className="border-y border-gray-200 py-5 dark:border-gray-700"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Tujuan permainan</p><h3 className="mt-2 font-serif text-3xl">{game?.title}</h3><p className="mt-3 font-serif text-lg leading-relaxed text-gray-700 dark:text-gray-200">{game?.objective}</p></section><section className="mt-5"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Aturan main</p><ol className="mt-3">{(game?.rules||[]).map((rule,i)=><li key={i} className="border-t border-gray-300 py-3 text-sm leading-relaxed"><strong>{String(i+1).padStart(2,'0')}.</strong> {rule}</li>)}</ol></section><section className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Sistem skor</p><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Kejelasan</dt><dd>maks. 35</dd></div><div className="flex justify-between border-b border-gray-200 pb-2"><dt>Relevansi</dt><dd>maks. 35</dd></div><div className="flex justify-between"><dt>Daya Tarik</dt><dd>maks. 30</dd></div></dl></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">Rincian gelar</p><dl className="mt-3 space-y-2 text-sm">{(game?.gradeTitles||[]).map((g,i,list)=><div key={g.label} className="flex justify-between border-b border-gray-200 pb-2"><dt>{g.label}</dt><dd>{g.min}–{i===0?1000:Number(list[i-1].min)-1}</dd></div>)}</dl></div></section><button type="button" onClick={start} className="mt-7 min-h-11 rounded bg-[#2B579A] px-5 py-2.5 text-sm font-bold text-white">{game?.startButtonLabel}</button><p className="mt-3 font-mono text-xs text-gray-500">{Number(game?.casesPerSession)||10} brief · mouse atau layar sentuh</p></section>;

  if (gamePhase === 'headline-play' && activeCase) return <section className="mx-auto max-w-4xl py-5">
    <div className="mb-4 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500"><span>{game?.briefLabel || 'BRIEF'} {String(index+1).padStart(2,'0')} / {String(session.length).padStart(2,'0')}</span><span>{activeCase.label}</span></div>
    <div className="grid gap-3 md:grid-cols-3">
      {[[game?.contentTypeLabel||'JENIS KONTEN',activeCase.contentType],[game?.audienceLabel||'TARGET PEMBACA',activeCase.audience],[game?.goalLabel||'TUJUAN',activeCase.goal]].map(([label,value])=><div key={label} className="rounded border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-[#252525]"><span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#2B579A]">{label}</span><p className="mt-2 text-sm leading-relaxed">{value}</p></div>)}
    </div>
    <p className="mb-3 mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">{game?.chooseLabel || 'PILIH HEADLINE'}</p>
    <div className="grid gap-3 md:grid-cols-2">{activeCase.options.map((option)=><button disabled={locked} type="button" key={option.id} onClick={()=>setChoiceId(option.id)} className={`min-h-[104px] rounded border p-4 text-left font-serif text-lg leading-snug transition ${choiceId===option.id ? 'border-[#2B579A] bg-blue-50 ring-1 ring-[#2B579A] dark:bg-blue-950/30' : 'border-gray-300 bg-white hover:border-[#2B579A] dark:border-gray-700 dark:bg-[#252525]'}`}>{option.text}</button>)}</div>
    {!locked && <button disabled={!choiceId} type="button" onClick={submit} className="mt-5 min-h-11 rounded bg-[#2B579A] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{game?.submitLabel || 'Kunci Headline'}</button>}
    {locked && activeChoice && <div className="mt-6 rounded border border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-[#252525]">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">{game?.reportLabel || 'HEADLINE REPORT'}</p>
      <p className="mt-3 font-serif text-xl">{activeChoice.text}</p>
      <div className="mt-5 grid grid-cols-3 gap-3">{[[game?.clarityLabel||'Kejelasan',activeChoice.clarity,35],[game?.relevanceLabel||'Relevansi',activeChoice.relevance,35],[game?.hookLabel||'Daya Tarik',activeChoice.hook,30]].map(([label,value,max])=><div key={label} className="rounded border border-gray-200 p-3 text-center dark:border-gray-700"><span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</span><strong className="mt-1 block text-lg">{value}/{max}</strong></div>)}</div>
      <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300"><strong>{game?.riskLabel || 'Catatan Risiko'}:</strong> {(activeChoice.risks||[]).length ? activeChoice.risks.join(', ') : (game?.cleanRiskLabel || 'Tidak ada risiko editorial utama.')}</p>
      <button type="button" onClick={next} className="mt-5 min-h-11 rounded border border-[#2B579A] px-5 py-2.5 text-sm font-bold text-[#2B579A]">{index >= session.length-1 ? 'Lihat Hasil' : (game?.nextLabel || 'Brief Berikutnya')}</button>
    </div>}
  </section>;

  if (gamePhase === 'headline-result') return <section className="mx-auto max-w-3xl py-8">
    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#2B579A]">{game?.resultEyebrow || 'LAPORAN HEADLINE AKHIR'}</p>
    <h3 className="mt-2 font-serif text-3xl">{grade.label}</h3>
    <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{grade.remark}</p>
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded border border-gray-300 p-4 dark:border-gray-700"><span className="font-mono text-[9px] uppercase text-gray-500">{game?.scoreLabel||'Skor Akhir'}</span><strong className="mt-1 block text-2xl">{totalScore}/{session.length*100}</strong></div>
      <div className="rounded border border-gray-300 p-4 dark:border-gray-700"><span className="font-mono text-[9px] uppercase text-gray-500">{game?.clarityLabel||'Kejelasan'}</span><strong className="mt-1 block text-2xl">{averages.clarity}/35</strong></div>
      <div className="rounded border border-gray-300 p-4 dark:border-gray-700"><span className="font-mono text-[9px] uppercase text-gray-500">{game?.relevanceLabel||'Relevansi'}</span><strong className="mt-1 block text-2xl">{averages.relevance}/35</strong></div>
      <div className="rounded border border-gray-300 p-4 dark:border-gray-700"><span className="font-mono text-[9px] uppercase text-gray-500">{game?.hookLabel||'Daya Tarik'}</span><strong className="mt-1 block text-2xl">{averages.hook}/30</strong></div>
    </div>
    <p className="mt-4 text-sm"><strong>{game?.bestDimensionLabel || 'Dimensi Terkuat'}:</strong> {dimensionLabel}</p>
    <div className="mt-6 max-w-md text-left"><label className="text-xs font-bold uppercase">Nama / alias</label><input value={playerName} onChange={e=>setPlayerName(e.target.value)} className="mt-2 w-full rounded border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600" placeholder="Nama / alias"/><div className="mt-3 flex flex-wrap gap-2"><button onClick={save} disabled={saving} className="min-h-11 rounded bg-[#2B579A] px-4 py-2 text-sm font-bold text-white">{saving?'Menyimpan…':'Simpan Skor'}</button><button type="button" onClick={start} className="min-h-11 rounded border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-700">{game?.replayLabel || 'Main Lagi'}</button><button onClick={refreshBoard} className="min-h-11 rounded border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-700">Lihat Klasemen</button><button type="button" onClick={()=>setGamePhase('library')} className="min-h-11 rounded border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-700">Balik ke Menu Games</button></div>{standing&&<p className="mt-3 text-sm">Peringkat Anda: <strong>#{standing.rank||'—'}</strong></p>}{notice&&<p className="mt-2 text-xs text-red-600">{notice}</p>}{boardOpen&&<div className="mt-6"><div className="flex items-center justify-between"><h4 className="font-serif text-xl">Klasemen</h4><button onClick={()=>setBoardOpen(false)} className="text-xs">Tutup ×</button></div><div className="mt-3 space-y-2">{board.map((row,i)=><div key={row.id||i} className="grid grid-cols-[2rem_1fr_auto] gap-3 border-b border-gray-200 py-2 text-sm dark:border-gray-700"><strong>#{i+1}</strong><span>{row.playerName}</span><span>{row.score}</span></div>)}</div></div>}</div>
  </section>;

  return null;
}
