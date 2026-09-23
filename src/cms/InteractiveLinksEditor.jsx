import { useRef, useState } from 'react';

const PAGES = ['Home', 'About', 'Projects', 'Career', 'Book', 'Contact'];
const emptyRule = () => ({
  id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  page: 'Home', phrase: '', target: 'About', textColor: '#2B579A',
  underlineColor: '#dc2626', tooltip: '', newTab: false, enabled: true,
});

export default function InteractiveLinksEditor({ value = [], onChange, inputClassName = '' }) {
  const rules = Array.isArray(value) ? value : [];
  const [openId, setOpenId] = useState(null);
  const dragIndex = useRef(null);
  const update = (index, field, nextValue) => onChange(rules.map((rule, i) => i === index ? { ...rule, [field]: nextValue } : rule));
  const remove = (index) => onChange(rules.filter((_, i) => i !== index));
  const move = (from, to) => {
    if (from === to || from == null || to < 0 || to >= rules.length) return;
    const next = [...rules];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-blue-600 dark:text-blue-400">Interactive Words</h2>
        <p className="mt-1 text-xs text-gray-500">Tulis frasa persis seperti yang muncul pada konten. Sistem akan memberi spellcheck underline dan menjadikannya link.</p>
      </div>
      {rules.map((rule, index) => (
        <div key={rule.id || index} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); move(dragIndex.current, index); dragIndex.current = null; }} className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#282828]">
          <div className="flex items-center gap-2 p-3">
            <span draggable onDragStart={() => { dragIndex.current = index; }} onDragEnd={() => { dragIndex.current = null; }} className="cursor-grab select-none px-1 text-sm text-gray-400 active:cursor-grabbing" title="Seret untuk mengubah urutan">⠿</span>
            <button type="button" onClick={() => setOpenId((current) => current === (rule.id || index) ? null : (rule.id || index))} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-bold text-gray-700 dark:text-gray-200">{rule.phrase || `Interactive Word #${index + 1}`}</span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-gray-400">{rule.page || 'Home'} → {rule.target || 'Belum ada tujuan'}</span>
            </button>
            <button type="button" onClick={() => setOpenId((current) => current === (rule.id || index) ? null : (rule.id || index))} className="grid h-7 w-7 place-items-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">{openId === (rule.id || index) ? '⌃' : '⌄'}</button>
            <button type="button" onClick={() => remove(index)} className="text-[10px] font-semibold text-red-500">Hapus</button>
          </div>
          {openId === (rule.id || index) && <div className="space-y-3 border-t border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-[#242424]">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold">Halaman asal
              <select value={rule.page || 'Home'} onChange={(e) => update(index, 'page', e.target.value)} className={`${inputClassName} mt-1`}>{PAGES.map((page) => <option key={page}>{page}</option>)}</select>
            </label>
            <label className="text-xs font-semibold">Frasa
              <input value={rule.phrase || ''} onChange={(e) => update(index, 'phrase', e.target.value)} className={`${inputClassName} mt-1`} placeholder="produksi visual" />
            </label>
            <label className="text-xs font-semibold">Tujuan navigasi / URL
              <input value={rule.target || ''} onChange={(e) => update(index, 'target', e.target.value)} className={`${inputClassName} mt-1`} placeholder="Projects atau https://..." list="interactive-targets" />
              <datalist id="interactive-targets">{PAGES.map((page) => <option key={page} value={page} />)}</datalist>
            </label>
            <label className="text-xs font-semibold">Tooltip
              <input value={rule.tooltip || ''} onChange={(e) => update(index, 'tooltip', e.target.value)} className={`${inputClassName} mt-1`} placeholder="Lihat karya visual" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs">
            <label className="flex items-center gap-2">Warna teks <input type="color" value={rule.textColor || '#2B579A'} onChange={(e) => update(index, 'textColor', e.target.value)} /></label>
            <label className="flex items-center gap-2">Underline <input type="color" value={rule.underlineColor || '#dc2626'} onChange={(e) => update(index, 'underlineColor', e.target.value)} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={rule.newTab === true} onChange={(e) => update(index, 'newTab', e.target.checked)} /> Tab baru</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={rule.enabled !== false} onChange={(e) => update(index, 'enabled', e.target.checked)} /> Aktif</label>
          </div>
          </div>}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rules, emptyRule()])} className="px-3 py-2 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700">+ Tambah Interactive Word</button>
    </div>
  );
}
