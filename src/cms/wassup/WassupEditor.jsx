import React from 'react';

export default function WassupEditor({ ctx }) {
  const { formData, setZine, inputCls, Field, CollapsibleSection, zineInbox, zineInboxLoading, zineInboxError, loadZineInbox, editInboxZine, moderateInboxZine, archiveInboxZine, moderatingZineId, ContentCard, addZineEntry, removeZineEntry, updateZineEntry } = ctx;
  return (
<div className="space-y-5">
  <h2 className="border-b border-gray-100 pb-2 text-sm font-bold text-blue-600 dark:border-gray-800 dark:text-blue-400">Wassup? / Writing Exchange</h2>
  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={formData.zine.enabled !== false} onChange={(e) => setZine('enabled', e.target.checked)} className="h-4 w-4 accent-[#2B579A]" />Tampilkan pilihan Wassup?</label>
  <div className="grid gap-3 md:grid-cols-3"><Field label="Nama pada tombol pilihan"><input value={formData.zine.menuLabel || ''} onChange={(e) => setZine('menuLabel', e.target.value)} className={inputCls} placeholder="Wassup?" /></Field><Field label="Judul pengalaman"><input value={formData.zine.title || ''} onChange={(e) => setZine('title', e.target.value)} className={inputCls} /></Field><Field label="Batas karakter"><input type="number" min="100" max="5000" value={formData.zine.maxLength || 1200} onChange={(e) => setZine('maxLength', Number(e.target.value))} className={inputCls} /></Field></div>
  <Field label="Prompt menulis"><input value={formData.zine.writePrompt || ''} onChange={(e) => setZine('writePrompt', e.target.value)} className={inputCls} /></Field>
  <Field label="Pesan setelah Send"><input value={formData.zine.submitSuccess || ''} onChange={(e) => setZine('submitSuccess', e.target.value)} className={inputCls} /></Field>
  <CollapsibleSection sectionKey="zine-content-manager" title="Konten Wassup?" subtitle="Inbox kiriman pembaca dan zine yang dapat diterima">
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Inbox kiriman pembaca</h3>
          <p className="mt-1 text-[11px] text-gray-500">Edit bila perlu, lalu Approve agar bisa diterima pengunjung lain atau Reject untuk menyembunyikannya.</p>
        </div>
        <button type="button" onClick={loadZineInbox} disabled={zineInboxLoading} className="rounded border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50 dark:border-blue-800 dark:bg-[#252525] dark:text-blue-300">{zineInboxLoading ? 'Memuat…' : 'Refresh Inbox'}</button>
      </div>
      {zineInboxError && <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">{zineInboxError}</p>}
      {!zineInboxLoading && !zineInbox.length && !zineInboxError && <p className="text-xs text-gray-500">Belum ada kiriman pembaca.</p>}
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3"><h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Kotak Pesan Masuk</h4><span className="font-mono text-[10px] text-gray-400">{zineInbox.length}</span></div>
          <p className="rounded border border-dashed border-blue-200 bg-white/60 p-3 text-xs leading-relaxed text-gray-500 dark:border-blue-900 dark:bg-white/[0.02]">Semua kiriman aktif masuk ke inbox ini. Kiriman yang belum diputuskan ditaruh di Kotak Pending; setelah Approve atau Reject, kiriman pindah ke Kotak Setelah Diproses.</p>
        </section>
        <section className="space-y-3 border-t border-blue-200 pt-4 dark:border-blue-900">
          <div className="flex items-center justify-between gap-3"><h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-300">Kotak Pending</h4><span className="font-mono text-[10px] text-gray-400">{zineInbox.filter((entry) => entry.status === 'pending').length}</span></div>
          {zineInbox.filter((entry) => entry.status === 'pending').length ? zineInbox.filter((entry) => entry.status === 'pending').map((entry) => (
            <ContentCard key={`inbox-${entry.id}`} cardKey={`zine-inbox-${entry.id}`} listKey="zine-inbox" idx={0} count={1} title={`Submission #${entry.id}`} subtitle={`${entry.status.toUpperCase()} · ${new Date(entry.created_at).toLocaleString('id-ID')}`}>
              <Field label="Isi kiriman"><textarea rows={7} maxLength={5000} value={entry.body || ''} onChange={(event) => editInboxZine(entry.id, event.target.value)} className={`${inputCls} resize-y font-serif`} /></Field>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto rounded-full bg-amber-100 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">pending</span>
                <button type="button" disabled={moderatingZineId === entry.id} onClick={() => moderateInboxZine(entry, 'rejected')} className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 disabled:opacity-50 dark:border-red-800 dark:text-red-300">Reject</button>
                <button type="button" disabled={moderatingZineId === entry.id} onClick={() => moderateInboxZine(entry, 'approved')} className="rounded bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{moderatingZineId === entry.id ? 'Menyimpan…' : 'Approve'}</button>
              </div>
            </ContentCard>
          )) : <p className="rounded border border-dashed border-gray-300 p-3 text-xs text-gray-400 dark:border-gray-700">Tidak ada pesan yang menunggu keputusan.</p>}
        </section>
        <section className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3"><h4 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Kotak Setelah Diproses · Approved / Rejected</h4><span className="font-mono text-[10px] text-gray-400">{zineInbox.filter((entry) => entry.status !== 'pending').length}</span></div>
          {zineInbox.filter((entry) => entry.status !== 'pending').length ? zineInbox.filter((entry) => entry.status !== 'pending').map((entry) => (
            <ContentCard key={`inbox-${entry.id}`} cardKey={`zine-inbox-${entry.id}`} listKey="zine-inbox" idx={0} count={1} title={`Submission #${entry.id}`} subtitle={`${entry.status.toUpperCase()} · ${new Date(entry.created_at).toLocaleString('id-ID')}`}>
              <Field label="Isi kiriman"><textarea rows={7} maxLength={5000} value={entry.body || ''} onChange={(event) => editInboxZine(entry.id, event.target.value)} className={`${inputCls} resize-y font-serif`} /></Field>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`mr-auto rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${entry.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{entry.status}</span>
                <button type="button" disabled={moderatingZineId === entry.id} onClick={() => moderateInboxZine(entry, 'pending')} className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-600">Kembalikan ke Pending</button>
                <button type="button" disabled={moderatingZineId === entry.id} onClick={() => archiveInboxZine(entry)} className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/20">{moderatingZineId === entry.id ? 'Menghapus…' : 'Hapus'}</button>
              </div>
            </ContentCard>
          )) : <p className="rounded border border-dashed border-gray-300 p-3 text-xs text-gray-400 dark:border-gray-700">Belum ada pesan yang selesai diproses.</p>}
        </section>
      </div>
    </div>
    <div className="flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">Zine yang dapat diterima pengunjung</h3><button type="button" onClick={addZineEntry} className="rounded border border-dashed border-blue-400 px-3 py-2 text-xs font-semibold text-blue-600">+ Tambah Zine</button></div>
    <div className="space-y-3">{formData.zine.entries.map((entry, index) => <ContentCard key={entry.id || index} cardKey={`zine-${index}`} listKey="zines" idx={index} count={formData.zine.entries.length} title={entry.title || `Zine #${index + 1}`} subtitle={entry.author || 'Anonymous'} onRemove={() => removeZineEntry(index)}>
      <div className="grid gap-3 md:grid-cols-2"><Field label="Judul"><input value={entry.title || ''} onChange={(e) => updateZineEntry(index, { title: e.target.value })} className={inputCls} /></Field><Field label="Penulis"><input value={entry.author || ''} onChange={(e) => updateZineEntry(index, { author: e.target.value })} className={inputCls} /></Field></div>
      <Field label="Label kecil"><input value={entry.label || ''} onChange={(e) => updateZineEntry(index, { label: e.target.value })} className={inputCls} /></Field>
      <Field label="Isi zine"><textarea rows={8} value={entry.body || ''} onChange={(e) => updateZineEntry(index, { body: e.target.value })} className={`${inputCls} resize-y font-serif`} /></Field>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={entry.published !== false} onChange={(e) => updateZineEntry(index, { published: e.target.checked })} className="h-4 w-4 accent-[#2B579A]" />Boleh diterima pengunjung</label>
    </ContentCard>)}</div>
  </CollapsibleSection>
</div>
  );
}
