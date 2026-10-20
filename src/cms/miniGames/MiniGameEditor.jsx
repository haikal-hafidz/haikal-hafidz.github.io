import React, { useState } from 'react';
import {
  getSampleTemplate,
  validateGameJson,
  normalizeImportedItems
} from './miniGameJsonImporter';

const CASE_GAME_TYPES = new Set(['headlineHook', 'toneSwitcher', 'logicalLeap']);
const CASE_GAME_LABELS = {
  headlineHook: { bank: 'Headline Brief Bank', caseName: 'Brief', optionName: 'Headline', optionScores: [['clarity','Kejelasan'],['relevance','Relevansi'],['hook','Daya Tarik']] },
  toneSwitcher: { bank: 'Tone Situation Bank', caseName: 'Situasi', optionName: 'Versi', optionScores: [['toneFit','Kesesuaian Nada'],['audienceFit','Kesesuaian Audiens'],['clarity','Kejelasan']] },
  logicalLeap: { bank: 'Logic Case Bank', caseName: 'Argumen', optionName: 'Analisis', optionScores: [['logic','Logika'],['evidence','Bukti'],['precision','Presisi']] },
};
const TOP_LEVEL_SKIP = new Set(['id','gameType','enabled','showInLibrary','gameName','gameCategory','gameCardDescription','title','objective','rules','gradeTitles','cases']);
const prettifyKey = (key) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());

/**
 * Dedicated JSON Importer & Validator Component for all Mini Game Tabs.
 */
function JsonImportPanel({ gameType, editingMiniGame, setMiniGame, CollapsibleSection, inputCls, cmsCopy }) {
  const [inputText, setInputText] = useState('');
  const [importMode, setImportMode] = useState('append'); // 'append' | 'overwrite'
  const [validationResult, setValidationResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const isCaseBased = CASE_GAME_TYPES.has(gameType) || gameType === 'plagiarismPolice';
  const contentKey = isCaseBased ? 'cases' : 'drafts';
  const existingCount = Array.isArray(editingMiniGame[contentKey]) ? editingMiniGame[contentKey].length : 0;

  const handleTextChange = (text) => {
    setInputText(text);
    setValidationResult(null);
    setStatusMessage('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      handleTextChange(event.target?.result || '');
      e.target.value = '';
    };
    reader.onerror = () => {
      setStatusMessage('Gagal membaca file JSON / File read error.');
    };
    reader.readAsText(file);
  };

  const handleCopySample = () => {
    const sample = getSampleTemplate(gameType);
    navigator.clipboard.writeText(sample).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      setInputText(sample);
      setValidationResult(null);
    });
  };

  const handleLoadSampleToArea = () => {
    setInputText(getSampleTemplate(gameType));
    setValidationResult(null);
    setStatusMessage('');
  };

  const handleValidate = () => {
    const result = validateGameJson(inputText, gameType);
    setValidationResult(result);
    if (!result.valid) {
      setStatusMessage(`Validation failed with ${result.errors.length} error(s). Review list below.`);
    } else {
      setStatusMessage(`Validation successful! ${result.items.length} ${contentKey} ready for import.`);
    }
  };

  const handleImport = () => {
    if (!validationResult || !validationResult.valid || !validationResult.items.length) {
      return;
    }

    const normalizedNewItems = normalizeImportedItems(validationResult.items, gameType, 'import');

    if (importMode === 'overwrite') {
      const confirmMsg = cmsCopy(
        `APAKAH ANDA YAKIN?\n\nOpsi "Timpa Semuanya" akan MENGHAPUS ${existingCount} item ${contentKey} yang ada saat ini dan menggantinya dengan ${normalizedNewItems.length} item baru hasil import.\n\nTindakan ini dapat dibatalkan dengan menekan tombol "Batal" di TitleBar sebelum menekan "Save Changes".`,
        `CONFIRM OVERWRITE?\n\n"Overwrite All" will REPLACE the current ${existingCount} ${contentKey} item(s) with ${normalizedNewItems.length} imported item(s).\n\nYou can revert by clicking "Cancel" in TitleBar before saving.`
      );
      if (!window.confirm(confirmMsg)) {
        return;
      }
      setMiniGame(contentKey, normalizedNewItems);
      setStatusMessage(`[OVERWRITE SUCCESS] Replaced all items. Now containing ${normalizedNewItems.length} ${contentKey}. Press "Save Changes" in TitleBar to finalize.`);
    } else {
      const currentList = Array.isArray(editingMiniGame[contentKey]) ? editingMiniGame[contentKey] : [];
      const updatedList = [...currentList, ...normalizedNewItems];
      setMiniGame(contentKey, updatedList);
      setStatusMessage(`[APPEND SUCCESS] Added ${normalizedNewItems.length} new ${contentKey}. Total now: ${updatedList.length} ${contentKey}. Press "Save Changes" in TitleBar to finalize.`);
    }

    setInputText('');
    setValidationResult(null);
  };

  return (
    <CollapsibleSection
      sectionKey={`minigame-json-importer-${gameType}`}
      title={cmsCopy('JSON Content Importer & AI Generator', 'JSON Content Importer & AI Generator')}
      subtitle={cmsCopy('Import konten/pertanyaan game dari JSON hasil AI (ChatGPT/Claude/dll) dengan validasi ketat.', 'Import game content/questions from AI-generated JSON with strict validation.')}
    >
      <div className="space-y-4 text-xs">
        {/* Helper info & copy sample template */}
        <div className="rounded-md border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="block text-[#2B579A] dark:text-blue-300">
                {cmsCopy('Petunjuk AI Prompting', 'AI Prompting Instructions')}
              </strong>
              <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                {cmsCopy(
                  `Gunakan templat JSON di bawah sebagai contoh format prompt untuk AI. Salin templat, berikan instruksi ke AI untuk menghasilkan konten tambahan dengan struktur persis sama, lalu tempel hasilnya di area bawah.`,
                  `Use the JSON template below as format sample for AI prompting. Copy the template, prompt AI to generate additional questions using the exact structure, then paste below.`
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySample}
                className="rounded border border-blue-400 bg-white px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-[#1a1a1a] dark:text-blue-300"
              >
                {copySuccess ? cmsCopy('Tersalin! ✓', 'Copied! ✓') : cmsCopy('Salin Templat Contoh', 'Copy Sample Template')}
              </button>
              <button
                type="button"
                onClick={handleLoadSampleToArea}
                className="rounded bg-blue-100 px-3 py-1.5 font-semibold text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200"
              >
                {cmsCopy('Muat ke Area Text', 'Load to Text Area')}
              </button>
            </div>
          </div>
        </div>

        {/* Input Controls */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="font-bold text-gray-800 dark:text-gray-200">
              {cmsCopy('Area Input JSON', 'JSON Text Input Area')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500">
                {cmsCopy('Atau upload file .json:', 'Or upload .json file:')}
              </span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="text-[11px] text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-gray-200 file:px-2.5 file:py-1 file:text-[11px] file:font-semibold hover:file:bg-gray-300 dark:file:bg-gray-700 dark:file:text-gray-200"
              />
            </div>
          </div>

          <textarea
            rows={8}
            value={inputText}
            onChange={(e) => handleTextChange(e.target.value)}
            className={`${inputCls} resize-y font-mono text-[11px]`}
            placeholder={cmsCopy('Tempel teks JSON di sini (array dari item/objek)...', 'Paste JSON text here (array of items/objects)...')}
          />
        </div>

        {/* Import Mode selection & Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-[#222222]">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {cmsCopy('Mode Import:', 'Import Mode:')}
            </span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="radio"
                name={`import-mode-${gameType}`}
                value="append"
                checked={importMode === 'append'}
                onChange={() => setImportMode('append')}
                className="accent-[#2B579A]"
              />
              <span>{cmsCopy(`Tambahkan ke Data Ada (+${existingCount} item)`, `Append to Existing (+${existingCount} items)`)}</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-red-600 dark:text-red-400 font-medium">
              <input
                type="radio"
                name={`import-mode-${gameType}`}
                value="overwrite"
                checked={importMode === 'overwrite'}
                onChange={() => setImportMode('overwrite')}
                className="accent-red-600"
              />
              <span>{cmsCopy('Timpa Semua Data Ada', 'Overwrite All Existing')}</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!inputText.trim()}
              className="rounded border border-gray-400 bg-white px-4 py-2 font-bold text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-gray-200"
            >
              {cmsCopy('1. Validasi JSON', '1. Validate JSON')}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!validationResult || !validationResult.valid || !validationResult.items.length}
              className="rounded bg-[#2B579A] px-4 py-2 font-bold text-white shadow-sm hover:bg-[#1f4073] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cmsCopy('2. Eksekusi Import', '2. Execute Import')}
            </button>
          </div>
        </div>

        {/* Validation Feedback & Messages */}
        {statusMessage && (
          <div className={`rounded-md p-3 text-xs font-semibold ${
            validationResult?.valid
              ? 'border border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300'
              : validationResult
              ? 'border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
              : 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
          }`}>
            {statusMessage}
          </div>
        )}

        {validationResult && !validationResult.valid && (
          <div className="rounded-md border border-red-300 bg-red-50/80 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 space-y-1">
            <strong>Daftar Error Validasi ({validationResult.errors.length}):</strong>
            <ul className="list-disc pl-5 space-y-0.5 max-h-48 overflow-y-auto">
              {validationResult.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {validationResult && validationResult.valid && (
          <div className="rounded-md border border-green-300 bg-green-50/80 p-3 text-xs text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200 space-y-1">
            <strong>✓ Ringkasan Validasi:</strong>
            <p>{validationResult.summary}</p>
            <p className="text-[11px] text-gray-600 dark:text-gray-400">
              Siap untuk di-import menggunakan mode <strong>{importMode === 'overwrite' ? 'TIMPA / OVERWRITE' : 'TAMBAH / APPEND'}</strong>. Klik tombol &quot;2. Eksekusi Import&quot; di atas.
            </p>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

function CaseGameEditor({ ctx }) {
  const { activeMiniGameEditor, setActiveMiniGameEditor, bumpCmsDomRevision, editingMiniGame, setMiniGame, inputCls, Field, CollapsibleSection, cmsCopy, miniGameAutofillText, setMiniGameAutofillText, miniGameAutofillNotice, setMiniGameAutofillNotice, applyMiniGameAutofill } = ctx;
  const meta = CASE_GAME_LABELS[editingMiniGame.gameType];
  const rules = Array.isArray(editingMiniGame.rules) ? editingMiniGame.rules : [];
  const cases = Array.isArray(editingMiniGame.cases) ? editingMiniGame.cases : [];
  const grades = Array.isArray(editingMiniGame.gradeTitles) ? editingMiniGame.gradeTitles : [];
  const scalarEntries = Object.entries(editingMiniGame).filter(([key, value]) => !TOP_LEVEL_SKIP.has(key) && (typeof value === 'string' || typeof value === 'number'));
  const patchCase = (caseIndex, patch) => setMiniGame('cases', cases.map((item, index) => index === caseIndex ? { ...item, ...patch } : item));
  const patchOption = (caseIndex, optionIndex, patch) => patchCase(caseIndex, { options: (cases[caseIndex]?.options || []).map((item, index) => index === optionIndex ? { ...item, ...patch } : item) });
  const patchGrade = (gradeIndex, patch) => setMiniGame('gradeTitles', grades.map((item, index) => index === gradeIndex ? { ...item, ...patch } : item));
  return <div className="space-y-5">
    <button type="button" onClick={() => { setActiveMiniGameEditor(null); bumpCmsDomRevision(); }} className="font-mono text-xs text-gray-500 hover:text-blue-600">← Daftar Mini Game</button>
    <h2 className="border-b border-gray-100 pb-2 text-sm font-bold text-blue-600 dark:border-gray-800 dark:text-blue-400">Mini Game Archive / {editingMiniGame.gameName}</h2>
    <label className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/20"><input type="checkbox" checked={editingMiniGame.showInLibrary === true} onChange={(e) => setMiniGame('showInLibrary', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Tampilkan game ini di halaman Mini Game</label>
    <div className="grid gap-3 md:grid-cols-2"><Field label="Nama mini game"><input value={editingMiniGame.gameName || ''} onChange={(e) => setMiniGame('gameName', e.target.value)} className={inputCls}/></Field><Field label="Kategori mini game"><input value={editingMiniGame.gameCategory || ''} onChange={(e) => setMiniGame('gameCategory', e.target.value)} className={inputCls}/></Field></div>
    <Field label="Deskripsi kartu mini game"><textarea rows={2} value={editingMiniGame.gameCardDescription || ''} onChange={(e) => setMiniGame('gameCardDescription', e.target.value)} className={`${inputCls} resize-y`}/></Field>
    <Field label="Judul game"><input value={editingMiniGame.title || ''} onChange={(e) => setMiniGame('title', e.target.value)} className={inputCls}/></Field>
    <Field label="Objective"><textarea rows={3} value={editingMiniGame.objective || ''} onChange={(e) => setMiniGame('objective', e.target.value)} className={`${inputCls} resize-y`}/></Field>
    
    {/* Dedicated JSON Importer Panel */}
    <JsonImportPanel
      gameType={editingMiniGame.gameType}
      editingMiniGame={editingMiniGame}
      setMiniGame={setMiniGame}
      CollapsibleSection={CollapsibleSection}
      inputCls={inputCls}
      cmsCopy={cmsCopy}
    />

    <CollapsibleSection sectionKey={`minigame-autofill-${activeMiniGameEditor}`} title={cmsCopy('Isi Otomatis','Autofill')} subtitle={cmsCopy('Tempel paket JSON untuk mengisi game ini sekaligus.','Paste a JSON package to fill this game in one go.')}><textarea rows={10} value={miniGameAutofillText} onChange={(e)=>{setMiniGameAutofillText(e.target.value);setMiniGameAutofillNotice('');}} className={`${inputCls} resize-y font-mono text-[11px]`} placeholder='{"gameName":"...","rules":["..."],"cases":[...]}'/><div className="mt-3 flex items-center gap-3"><button type="button" onClick={applyMiniGameAutofill} className="rounded bg-[#2B579A] px-3 py-2 text-xs font-semibold text-white">Terapkan Isi Otomatis</button>{miniGameAutofillNotice && <span className="text-[11px] text-gray-500">{miniGameAutofillNotice}</span>}</div></CollapsibleSection>
    <CollapsibleSection sectionKey={`case-rules-${activeMiniGameEditor}`} title="Aturan Main"><div className="space-y-3">{rules.map((rule,index)=><Field key={index} label={`Peraturan ${index+1}`}><textarea rows={2} value={rule || ''} onChange={(e)=>setMiniGame('rules', rules.map((item,i)=>i===index?e.target.value:item))} className={`${inputCls} resize-y`}/></Field>)}</div></CollapsibleSection>
    <CollapsibleSection sectionKey={`case-copy-${activeMiniGameEditor}`} title="Teks Gameplay & Hasil"><div className="grid gap-3 md:grid-cols-2">{scalarEntries.map(([key,value])=><Field key={key} label={prettifyKey(key)}><input type={typeof value === 'number' ? 'number' : 'text'} value={value ?? ''} onChange={(e)=>setMiniGame(key, typeof value === 'number' ? Number(e.target.value) : e.target.value)} className={inputCls}/></Field>)}</div></CollapsibleSection>
    <CollapsibleSection sectionKey={`case-grades-${activeMiniGameEditor}`} title="Gelar Pemain"><div className="space-y-3">{grades.map((grade,index)=><div key={index} className="grid gap-3 rounded border border-gray-200 p-3 md:grid-cols-[7rem_1fr_2fr] dark:border-gray-700"><Field label="Nilai min."><input type="number" value={grade.min ?? 0} onChange={(e)=>patchGrade(index,{min:Number(e.target.value)})} className={inputCls}/></Field><Field label="Nama gelar"><input value={grade.label || ''} onChange={(e)=>patchGrade(index,{label:e.target.value})} className={inputCls}/></Field><Field label="Remark"><input value={grade.remark || ''} onChange={(e)=>patchGrade(index,{remark:e.target.value})} className={inputCls}/></Field></div>)}</div></CollapsibleSection>
    <CollapsibleSection sectionKey={`case-bank-${activeMiniGameEditor}`} title={`${meta.bank} (${cases.length})`}><div className="space-y-4">{cases.map((gameCase,caseIndex)=><div key={gameCase.id || caseIndex} className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-[#292929]"><div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-wider text-blue-600">{String(caseIndex+1).padStart(2,'0')} / {meta.caseName}</div><div className="grid gap-3 md:grid-cols-2">{Object.entries(gameCase).filter(([key,value])=>key!=='options' && (typeof value==='string'||typeof value==='number')).map(([key,value])=><Field key={key} label={prettifyKey(key)}><textarea rows={key==='statement'||key==='source'||key==='goal'?3:1} value={value ?? ''} onChange={(e)=>patchCase(caseIndex,{[key]:typeof value==='number'?Number(e.target.value):e.target.value})} className={`${inputCls} resize-y`}/></Field>)}</div><div className="mt-4 space-y-3">{(gameCase.options || []).map((option,optionIndex)=><div key={option.id || optionIndex} className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-[#242424]"><strong className="mb-2 block text-xs">{meta.optionName} {optionIndex+1}</strong><Field label="Teks"><textarea rows={2} value={option.text || ''} onChange={(e)=>patchOption(caseIndex,optionIndex,{text:e.target.value})} className={`${inputCls} resize-y`}/></Field><div className="grid gap-3 md:grid-cols-3">{meta.optionScores.map(([key,label])=><Field key={key} label={label}><input type="number" value={option[key] ?? 0} onChange={(e)=>patchOption(caseIndex,optionIndex,{[key]:Number(e.target.value)})} className={inputCls}/></Field>)}</div>{editingMiniGame.gameType==='headlineHook' && <Field label="Risk tags (pisahkan dengan koma)"><input value={(option.risks || []).join(', ')} onChange={(e)=>patchOption(caseIndex,optionIndex,{risks:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})} className={inputCls}/></Field>}</div>)}</div></div>)}</div></CollapsibleSection>
  </div>;
}


export default function MiniGameEditor({ ctx }) {
  const { activeMiniGameEditor, setActiveMiniGameEditor, bumpCmsDomRevision, addMiniGameSlot, removeMiniGameSlot, formData, editingMiniGame, setMiniGame, inputCls, Field, CollapsibleSection, cmsCopy, miniGameAutofillText, setMiniGameAutofillText, miniGameAutofillNotice, setMiniGameAutofillNotice, applyMiniGameAutofill, dispatchCmsNotice, uploadImageToStorage, setMiniGameRule, updateGradeTitle, setMiniGameScore, addGameDraft, miniGameContentErrors, ContentCard, removeGameDraft, updateGameDraft, addGameIssue, phraseOccurrences, removeGameIssue, updateGameIssue } = ctx;
  if (activeMiniGameEditor !== null && CASE_GAME_TYPES.has(editingMiniGame?.gameType)) return <CaseGameEditor ctx={ctx} />;

  const effectiveGameType = editingMiniGame?.gameType || (
    String(editingMiniGame?.gameName || '').trim().toLowerCase() === 'the hangman' ? 'hangman' :
    String(editingMiniGame?.gameName || '').trim().toLowerCase() === 'plagiarism police' ? 'plagiarismPolice' :
    'redPen'
  );

  return (
<div className="space-y-5">
  {activeMiniGameEditor === null ? <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800"><h2 className="text-sm font-bold text-blue-600 dark:text-blue-400">Mini Game Archive</h2><button type="button" onClick={addMiniGameSlot} className="rounded border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600">+ Tambah Slot Game</button></div><p className="text-xs leading-relaxed text-gray-500">Setiap slot punya formulir sesuai jenis gamenya. The Hangman memakai Word Bank: <strong>Kata</strong> + <strong>Petunjuk</strong>. Satu sesi mengambil 15 kata acak dari bank kata aktif.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setActiveMiniGameEditor('redPen'); bumpCmsDomRevision(); }} className="rounded-md border border-blue-500 bg-blue-50 px-4 py-3 text-left transition-all hover:shadow-md dark:bg-blue-950/30"><span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-blue-600">01 / Aktif</span><strong className="mt-1 block text-sm">{formData.miniGame.gameName || 'The Red Pen'}</strong></button>{(formData.miniGame.gameSlots || []).map((slot, index) => <div key={slot.id || index} className="flex min-w-52 items-stretch rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-[#2d2d2d]"><button type="button" onClick={() => { setActiveMiniGameEditor(`slot-${index}`); bumpCmsDomRevision(); }} className="min-w-0 flex-1 px-4 py-3 text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/20"><span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-gray-400">{String(index + 2).padStart(2, '0')} / {slot.gameName?.trim() ? 'Aktif' : 'Kosong'}</span><strong className="mt-1 block truncate text-sm">{slot.gameName || `Game ${index + 2}`}</strong></button><button type="button" onClick={() => removeMiniGameSlot(index)} className="px-3 text-xs font-semibold text-red-500" aria-label={`Hapus slot ${slot.gameName || index + 2}`}>×</button></div>)}</div></> : <><button type="button" onClick={() => { setActiveMiniGameEditor(null); bumpCmsDomRevision(); }} className="font-mono text-xs text-gray-500 hover:text-blue-600">← Daftar Mini Game</button><h2 className="border-b border-gray-100 pb-2 text-sm font-bold text-blue-600 dark:border-gray-800 dark:text-blue-400">Mini Game Archive / {editingMiniGame.gameName || 'Game baru'}</h2>
  {activeMiniGameEditor === 'redPen' && <><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editingMiniGame.enabled !== false} onChange={(e) => setMiniGame('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Tampilkan tombol Mini Game di Home</label><div className="grid gap-3 md:grid-cols-2"><Field label="Label menu di Home"><input value={editingMiniGame.menuLabel || ''} onChange={(e) => setMiniGame('menuLabel', e.target.value)} className={inputCls} /></Field><Field label="Judul halaman pilihan game"><input value={editingMiniGame.libraryTitle || ''} onChange={(e) => setMiniGame('libraryTitle', e.target.value)} className={inputCls} /></Field></div><Field label="Deskripsi halaman pilihan game"><textarea rows={2} value={editingMiniGame.libraryDescription || ''} onChange={(e) => setMiniGame('libraryDescription', e.target.value)} className={`${inputCls} resize-y`} /></Field></>}
  <label className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/20"><input type="checkbox" checked={editingMiniGame.showInLibrary === true} onChange={(e) => setMiniGame('showInLibrary', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Tampilkan game ini di halaman Mini Game</label>
  <div className="grid gap-3 md:grid-cols-2"><Field label="Nama mini game"><input value={editingMiniGame.gameName || ''} onChange={(e) => setMiniGame('gameName', e.target.value)} className={inputCls} /></Field><Field label="Kategori mini game"><input value={editingMiniGame.gameCategory || ''} onChange={(e) => setMiniGame('gameCategory', e.target.value)} className={inputCls} /></Field></div>
  <Field label="Deskripsi kartu mini game"><textarea rows={2} value={editingMiniGame.gameCardDescription || ''} onChange={(e) => setMiniGame('gameCardDescription', e.target.value)} className={`${inputCls} resize-y`} /></Field>

  {/* Dedicated JSON Importer Panel */}
  <JsonImportPanel
    gameType={effectiveGameType}
    editingMiniGame={editingMiniGame}
    setMiniGame={setMiniGame}
    CollapsibleSection={CollapsibleSection}
    inputCls={inputCls}
    cmsCopy={cmsCopy}
  />

  <CollapsibleSection sectionKey={`minigame-autofill-${activeMiniGameEditor}`} title={cmsCopy('Isi Otomatis', 'Autofill')} subtitle={cmsCopy('Tempel paket JSON dari ChatGPT/AI lain untuk mengisi konten mini game ini sekaligus.', 'Paste a JSON package from ChatGPT/another AI to fill this mini game in one go.')}><p className="text-[11px] leading-relaxed text-gray-500">{cmsCopy('Bekerja mengikuti mode bahasa CMS yang aktif. Di ID, data menjadi sumber Indonesia. Di EN, teks masuk sebagai terjemahan Inggris tanpa menimpa sumber Indonesia.', 'Works with the active CMS language. In ID, data becomes the Indonesian source. In EN, text is stored as English translation without overwriting the Indonesian source.')}</p><textarea rows={10} value={miniGameAutofillText} onChange={(e) => { setMiniGameAutofillText(e.target.value); setMiniGameAutofillNotice(''); }} className={`${inputCls} resize-y font-mono text-[11px]`} placeholder={'{\n  "title": "...",\n  "objective": "...",\n  "rules": { "click": "...", "timer": "...", "wrong": "...", "hint": "...", "review": "..." },\n  "startButtonLabel": "...",\n  "drafts": [{ "word": "...", "clue": "..." }]\n}'} /><div className="flex flex-wrap items-center gap-3"><button type="button" onClick={applyMiniGameAutofill} disabled={!miniGameAutofillText.trim()} className="rounded bg-[#2B579A] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{cmsCopy('Terapkan ke Formulir', 'Apply to Form')}</button><button type="button" onClick={() => { setMiniGameAutofillText(''); setMiniGameAutofillNotice(''); }} className="rounded border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:text-gray-300">{cmsCopy('Kosongkan', 'Clear')}</button></div>{miniGameAutofillNotice && <p className="text-xs font-medium text-[#2B579A]">{miniGameAutofillNotice}</p>}<p className="text-[10px] leading-relaxed text-gray-400">{cmsCopy('Field yang diterima: nama/kategori/deskripsi game, judul, tujuan, rules, tombol mulai, pengaturan sesi, gelar, tampilan hasil, dan konten/word bank. ID teknis, ilustrasi, dan pengaturan tampil tidak disentuh.', 'Accepted fields: game name/category/description, title, objective, rules, start button, session settings, titles, result display, and content/word bank. Technical IDs, illustration, and visibility settings are untouched.')}</p></CollapsibleSection>
  <CollapsibleSection sectionKey="minigame-illustration" title="Ilustrasi kartu game">{editingMiniGame.illustration && <img src={editingMiniGame.illustration} alt="Preview ilustrasi game" className="h-36 w-full rounded border border-gray-200 object-cover dark:border-gray-700" />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { dispatchCmsNotice('Ilustrasi game maksimal 2 MB. Pakai JPG/WebP sekitar 1200 × 900 px.'); e.target.value = ''; return; } const url = await uploadImageToStorage(file); if (url) setMiniGame('illustration', url); e.target.value = ''; }} className="block w-full text-xs" /><Field label="Atau tempel URL ilustrasi"><input value={editingMiniGame.illustration || ''} onChange={(e) => setMiniGame('illustration', e.target.value)} placeholder="https://..." className={inputCls} /></Field><p className="text-[11px] text-gray-500">Rekomendasi: WebP/JPG 1200 × 900 px (rasio 4:3), maksimal 500 KB agar rak game tetap ringan.</p></CollapsibleSection>
  <Field label="Judul halaman permainan"><input value={editingMiniGame.title || ''} onChange={(e) => setMiniGame('title', e.target.value)} className={inputCls} /></Field>
  <CollapsibleSection sectionKey={`minigame-rules-${activeMiniGameEditor}`} title={cmsCopy('Aturan Main', 'Game Rules')} subtitle={cmsCopy('Tujuan, lima aturan permainan, dan teks tombol mulai.', 'Objective, five game rules, and start-button text.')}><Field label={cmsCopy("Tujuan permainan", "Game objective")}><textarea rows={3} value={editingMiniGame.objective || ''} onChange={(e) => setMiniGame('objective', e.target.value)} className={`${inputCls} resize-y`} /></Field><div className="grid gap-3 md:grid-cols-2"><Field label={cmsCopy("Aturan 01 — tindakan pemain", "Rule 01 — player action")}><textarea rows={2} value={editingMiniGame.rules.click || ''} onChange={(e) => setMiniGameRule('click', e.target.value)} className={`${inputCls} resize-y`} /></Field><Field label={cmsCopy("Aturan 02 — waktu", "Rule 02 — time")}><textarea rows={2} value={editingMiniGame.rules.timer || ''} onChange={(e) => setMiniGameRule('timer', e.target.value)} className={`${inputCls} resize-y`} /></Field><Field label={cmsCopy("Aturan 03 — jawaban salah", "Rule 03 — wrong answer")}><textarea rows={2} value={editingMiniGame.rules.wrong || ''} onChange={(e) => setMiniGameRule('wrong', e.target.value)} className={`${inputCls} resize-y`} /></Field><Field label={editingMiniGame.gameType === 'hangman' ? cmsCopy('Aturan 04 — kata berikutnya', 'Rule 04 — next word') : cmsCopy('Aturan 04 — bantuan', 'Rule 04 — help')}><textarea rows={2} value={editingMiniGame.rules.hint || ''} onChange={(e) => setMiniGameRule('hint', e.target.value)} className={`${inputCls} resize-y`} /></Field></div><Field label={editingMiniGame.gameType === 'hangman' ? cmsCopy('Aturan 05 — kondisi kalah', 'Rule 05 — losing condition') : cmsCopy('Aturan 05 — review editorial', 'Rule 05 — editorial review')}><textarea rows={2} value={editingMiniGame.rules.review || ''} onChange={(e) => setMiniGameRule('review', e.target.value)} className={`${inputCls} resize-y`} /></Field><Field label={cmsCopy("Teks tombol mulai", "Start button text")}><input value={editingMiniGame.startButtonLabel || ''} onChange={(e) => setMiniGame('startButtonLabel', e.target.value)} className={inputCls} /></Field></CollapsibleSection>
  {editingMiniGame.gameType === 'hangman' ? <><div className="grid gap-3 md:grid-cols-2"><Field label="Waktu sesi"><input value="10 menit" readOnly className={inputCls} /></Field><Field label="Kata per sesi"><input value="15" readOnly className={inputCls} /></Field></div><CollapsibleSection sectionKey="hangman-gelar" title="Gelar pemain"><div className="grid gap-3 md:grid-cols-2">{editingMiniGame.gradeTitles.map((item, index) => <Field key={index} label={['15/15','10–14','5–9','0–4'][index] || `Gelar ${index + 1}`}><input value={item.label || ''} onChange={(e) => updateGradeTitle(index, { label: e.target.value })} className={inputCls} /></Field>)}</div></CollapsibleSection><CollapsibleSection sectionKey="hangman-public-copy" title={cmsCopy('Teks Gameplay & Hasil', 'Gameplay & Result Copy')} subtitle={cmsCopy('Semua teks publik Hangman di gameplay, kematian, hasil, dan klasemen.', 'All public Hangman copy for gameplay, death, results, and leaderboard.')}><div className="grid gap-3 md:grid-cols-2">
<Field label={cmsCopy('Label laporan hasil','Result report label')}><input value={editingMiniGame.resultEyebrow || ''} onChange={(e)=>setMiniGame('resultEyebrow',e.target.value)} className={inputCls}/></Field>
<Field label={cmsCopy('Tombol main lagi','Replay button')}><input value={editingMiniGame.replayLabel || ''} onChange={(e)=>setMiniGame('replayLabel',e.target.value)} className={inputCls}/></Field>
<Field label={cmsCopy('Tombol lihat klasemen','Leaderboard button')}><input value={editingMiniGame.hangmanLeaderboardLabel || ''} onChange={(e)=>setMiniGame('hangmanLeaderboardLabel',e.target.value)} className={inputCls}/></Field>
<Field label={cmsCopy('Pesan mati','Death message')}><input value={editingMiniGame.hangmanDeathMessage || ''} onChange={(e)=>setMiniGame('hangmanDeathMessage',e.target.value)} className={inputCls}/></Field>
<Field label={cmsCopy('Pesan waktu habis','Timeout message')}><input value={editingMiniGame.hangmanTimeoutMessage || ''} onChange={(e)=>setMiniGame('hangmanTimeoutMessage',e.target.value)} className={inputCls}/></Field>
<Field label="Podium #1"><input value={editingMiniGame.hangmanPodiumFirst || ''} onChange={(e)=>setMiniGame('hangmanPodiumFirst',e.target.value)} className={inputCls}/></Field>
<Field label="Podium #2"><input value={editingMiniGame.hangmanPodiumSecond || ''} onChange={(e)=>setMiniGame('hangmanPodiumSecond',e.target.value)} className={inputCls}/></Field>
<Field label="Podium #3"><input value={editingMiniGame.hangmanPodiumThird || ''} onChange={(e)=>setMiniGame('hangmanPodiumThird',e.target.value)} className={inputCls}/></Field>
{[
['hangmanSolvedLabel','Label statistik — terjawab'],['hangmanAccuracyLabel','Label statistik — akurasi'],['hangmanWrongLettersLabel','Label statistik — huruf salah'],['hangmanNamePrompt','Instruksi nama pemain'],['hangmanNamePlaceholder','Placeholder nama'],['hangmanSaveScoreLabel','Tombol simpan skor'],['hangmanSavingLabel','Teks sedang menyimpan'],['hangmanYourRankLabel','Label peringkat pemain'],['hangmanBestScoreLabel','Label skor terbaik'],['hangmanLeaderboardTitle','Judul klasemen'],['hangmanLeaderboardCloseLabel','Tombol tutup klasemen'],['hangmanLeaderboardEmptyLabel','Klasemen kosong'],['hangmanYouLabel','Label pemain sendiri'],['hangmanClueLabel','Label petunjuk'],['hangmanChooseLetterLabel','Instruksi pilih huruf'],['hangmanRemainingLabel','Label kesempatan tersisa'],['hangmanWordCompleteLabel','Label kata selesai'],['hangmanDeathRevealLabel','Label jawaban dibuka'],['hangmanSafeMessage','Pesan kata berhasil'],['hangmanAnswerPrefix','Awalan jawaban'],['hangmanNextWordLabel','Tombol kata berikutnya'],['hangmanSeeResultLabel','Tombol lihat hasil'],['hangmanRankPrefix','Awalan info peringkat'],['hangmanRankPlayersSuffix','Sebutan pemain']
].map(([key,label])=><Field key={key} label={cmsCopy(label,label)}><input value={editingMiniGame[key] || ''} onChange={(e)=>setMiniGame(key,e.target.value)} className={inputCls}/></Field>)}
</div></CollapsibleSection></> : <><div className="grid gap-3 md:grid-cols-2"><Field label="Waktu per draft (detik)"><input type="number" min="15" max="120" value={editingMiniGame.secondsPerDraft || 60} onChange={(e) => setMiniGame('secondsPerDraft', Math.min(120, Math.max(15, Number(e.target.value) || 60)))} className={inputCls} /></Field><Field label="Jumlah draft per permainan (maks. 5)"><input type="number" min="1" max="5" value={editingMiniGame.draftsPerSession || 5} onChange={(e) => setMiniGame('draftsPerSession', Math.min(5, Math.max(1, Number(e.target.value) || 5)))} className={inputCls} /></Field></div></>}
  {editingMiniGame.gameType !== 'hangman' && <><CollapsibleSection sectionKey="minigame-score" title="Sistem skor dan gelar"><div className="grid gap-3 md:grid-cols-3"><Field label="Temuan benar (+)"><input type="number" min="0" value={editingMiniGame.scoreSettings.correctPoints} onChange={(e) => setMiniGameScore('correctPoints', e.target.value)} className={inputCls} /></Field><Field label="Klik salah (−)"><input type="number" min="0" value={editingMiniGame.scoreSettings.wrongPenalty} onChange={(e) => setMiniGameScore('wrongPenalty', e.target.value)} className={inputCls} /></Field><Field label="Draft selesai (+)"><input type="number" min="0" value={editingMiniGame.scoreSettings.completionBonus} onChange={(e) => setMiniGameScore('completionBonus', e.target.value)} className={inputCls} /></Field><Field label="Maks. bonus waktu (+)"><input type="number" min="0" value={editingMiniGame.scoreSettings.maxTimeBonus} onChange={(e) => setMiniGameScore('maxTimeBonus', e.target.value)} className={inputCls} /></Field><Field label="Pakai hint (−)"><input type="number" min="0" value={editingMiniGame.scoreSettings.hintPenalty} onChange={(e) => setMiniGameScore('hintPenalty', e.target.value)} className={inputCls} /></Field></div><div className="grid gap-3 md:grid-cols-2">{editingMiniGame.gradeTitles.map((item, index) => <div key={index} className="grid grid-cols-[5rem_1fr] gap-2"><Field label="Nilai min."><input type="number" min="0" max="100" value={item.min} onChange={(e) => updateGradeTitle(index, { min: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className={inputCls} /></Field><Field label={`Nama gelar ${index + 1}`}><input value={item.label || ''} onChange={(e) => updateGradeTitle(index, { label: e.target.value })} className={inputCls} /></Field></div>)}</div></CollapsibleSection></>}
  {editingMiniGame.gameType !== 'hangman' && <><CollapsibleSection sectionKey="minigame-result" title="Tampilan hasil"><div className="grid gap-3 md:grid-cols-2"><Field label="Label laporan hasil"><input value={editingMiniGame.resultEyebrow || ''} onChange={(e) => setMiniGame('resultEyebrow', e.target.value)} className={inputCls} /></Field><Field label="Tombol main ulang"><input value={editingMiniGame.replayLabel || ''} onChange={(e) => setMiniGame('replayLabel', e.target.value)} className={inputCls} /></Field><Field label="Tombol menuju Projects"><input value={editingMiniGame.projectsCtaLabel || ''} onChange={(e) => setMiniGame('projectsCtaLabel', e.target.value)} className={inputCls} /></Field><Field label="Tombol menuju Contact"><input value={editingMiniGame.contactCtaLabel || ''} onChange={(e) => setMiniGame('contactCtaLabel', e.target.value)} className={inputCls} /></Field></div></CollapsibleSection></>}
  {editingMiniGame.gameType !== 'hangman' && <><div className="rounded border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"><strong>Aturan isi:</strong> frasa bermasalah harus disalin persis dari paragraf dan hanya boleh muncul satu kali. CMS akan menolak Save kalau frasa kosong, tidak ditemukan, atau muncul berulang.</div></>}
  <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">{editingMiniGame.gameType === 'hangman' ? 'Word Bank' : `Draft ${editingMiniGame.gameName || 'Game baru'}`}</h3><button type="button" onClick={addGameDraft} className="rounded border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600">{editingMiniGame.gameType === 'hangman' ? '+ Tambah Kata' : '+ Tambah Draft'}</button></div>
  <div className="space-y-3">{editingMiniGame.drafts.map((draft, index) => {
    const errors = miniGameContentErrors(editingMiniGame, draft);
    return <ContentCard key={draft.id || index} cardKey={`game-${index}`} listKey="gameDrafts" idx={index} count={editingMiniGame.drafts.length} title={`${String(index + 1).padStart(2, '0')} / ${draft.label || 'Tanpa label'}`} subtitle={editingMiniGame.gameType === 'hangman' ? (errors.length ? `${errors.length} perlu diperbaiki` : 'Kata + petunjuk · siap dimainkan') : `${(draft.issues || []).length} koreksi${errors.length ? ` · ${errors.length} perlu diperbaiki` : ' · siap dimainkan'}`} onRemove={() => removeGameDraft(index)}>
      <div className="grid gap-3 md:grid-cols-[1fr_auto]"><Field label={editingMiniGame.gameType === 'hangman' ? 'Kata' : 'Label tingkat/draft'}><input value={draft.label || ''} onChange={(e) => updateGameDraft(index, { label: e.target.value })} className={inputCls} /></Field><label className="flex items-end gap-2 pb-3 text-xs"><input type="checkbox" checked={draft.enabled !== false} onChange={(e) => updateGameDraft(index, { enabled: e.target.checked })} className="h-4 w-4 accent-[#2B579A]" />Aktif</label></div>
      <Field label={editingMiniGame.gameType === 'hangman' ? 'Petunjuk' : 'Paragraf yang harus diedit'}><textarea rows={editingMiniGame.gameType === 'hangman' ? 2 : 7} value={draft.passage || ''} onChange={(e) => updateGameDraft(index, { passage: e.target.value })} className={`${inputCls} resize-y font-serif`} /></Field>
      {editingMiniGame.gameType !== 'hangman' && <><div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700"><h4 className="text-xs font-bold uppercase tracking-wide">Koreksi editorial</h4><button type="button" onClick={() => addGameIssue(index)} className="rounded bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">+ Tambah Koreksi</button></div>
      <div className="space-y-3">{(draft.issues || []).map((issue, issueIndex) => {
        const phrase = String(issue.phrase || '').trim();
        const occurrenceCount = phraseOccurrences(draft.passage || '', phrase);
        const invalid = !phrase || occurrenceCount !== 1 || !String(issue.replacement || '').trim();
        return <div key={issue.id || issueIndex} className={`rounded border p-3 ${invalid ? 'border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-[#282828]'}`}><div className="mb-2 flex items-center justify-between"><strong className="text-xs">Koreksi #{issueIndex + 1}</strong><button type="button" onClick={() => removeGameIssue(index, issueIndex)} className="text-[10px] font-semibold text-red-500">Hapus</button></div><div className="grid gap-3 md:grid-cols-2"><Field label="Frasa bermasalah (salin persis)"><input value={issue.phrase || ''} onChange={(e) => updateGameIssue(index, issueIndex, { phrase: e.target.value })} className={inputCls} /></Field><Field label="Pengganti (atau tulis: hapus)"><input value={issue.replacement || ''} onChange={(e) => updateGameIssue(index, issueIndex, { replacement: e.target.value })} className={inputCls} /></Field></div><Field label="Alasan editorial"><textarea rows={2} value={issue.explanation || ''} onChange={(e) => updateGameIssue(index, issueIndex, { explanation: e.target.value })} className={`${inputCls} resize-y`} /></Field>{phrase && occurrenceCount !== 1 && <p className="mt-2 text-[11px] font-semibold text-red-600">{occurrenceCount === 0 ? 'Frasa ini belum ditemukan persis di paragraf.' : `Frasa ini muncul ${occurrenceCount} kali; buat lebih spesifik.`}</p>}</div>;
      })}</div>
      {errors.length > 0 && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300"><strong>Belum bisa disimpan:</strong><ul className="mt-1 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}</>}
    </ContentCard>;
  })}</div></>}
</div>
  );
}
