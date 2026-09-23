import { useState } from 'react';
import InteractiveText from '../components/InteractiveText';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

// Field link tombol (actionButtons/collabButtonUrl) di CMS sering diisi orang cuma alamat
// emailnya polos (mis. "nama@gmail.com?subject=Halo") TANPA prefix "mailto:" di depan —
// itu bikin browser nganggep string itu path relatif biasa (bukan alamat email), jadi
// tombolnya keliatan gak ngarah ke mana-mana. Fungsi ini otomatis nambahin "mailto:" kalau
// polanya emang kayak alamat email dan belum ada skema (http/https/mailto/tel) sama sekali
// — jadi CMS-nya tetep bisa diisi tanpa mikirin prefix, tapi link publiknya tetep valid.
function resolveActionUrl(raw) {
  const url = (raw || '').trim();
  if (!url) return url;
  if (/^(mailto:|tel:|https?:)/i.test(url)) return url;
  // Pola kasar alamat email: ada "@", dan bagian setelah "@" ada titik (domain) sebelum
  // ketemu spasi/"?" (query string kayak ?subject=... boleh nyusul).
  if (/^[^\s@?]+@[^\s@?]+\.[^\s@?]+/.test(url)) return `mailto:${url}`;
  return url;
}

/* Icon kecil monoline, bikin sendiri biar gak nambah dependency baru ke proyek */
const Icon = {
  Mail: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  Pin: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </svg>
  ),
  Copy: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="m4 12 6 6L20 6" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  ),
  LinkedIn: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M6.94 8.5H4V20h2.94V8.5ZM5.47 4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4ZM20 13.3c0-3.06-1.63-4.48-3.8-4.48-1.75 0-2.53.96-2.97 1.64V8.5H10.3c.04.86 0 11.5 0 11.5h2.93v-6.42c0-.34.02-.69.12-.94.28-.69.9-1.4 1.96-1.4 1.38 0 1.94 1.05 1.94 2.59V20H20v-6.7Z" />
    </svg>
  ),
  GitHub: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03a9.6 9.6 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  ),
  Instagram: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.9" cy="7.1" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M4 4h4.4l4 5.6L17 4h3l-6.3 8.1L20.4 20H16l-4.3-6-5 6H4l6.7-8.4L4 4Z" />
    </svg>
  ),
};

// Jaring pengaman: kalau suatu saat isi CMS masih nyisipin emoji di label tombol,
// dibersihin di sini biar tampilannya tetep rapi.
function stripTrailingEmoji(str = '') {
  return str.replace(/\p{Extended_Pictographic}/gu, '').replace(/\uFE0F/gu, '').trim();
}

// Field "location" di CMS masih 1 kolom teks gabungan, mis. "Jakarta, Indonesia (Available for Remote)".
// Dipecah di sini jadi lokasi utama + status ketersediaan (kalau ada), tanpa perlu ubah skema CMS.
function splitLocation(raw = '') {
  const match = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) return { location: match[1].trim(), availability: match[2].trim() };
  return { location: raw.trim(), availability: null };
}

const FALLBACK = {
  eyebrow: 'NEW DOCUMENT / CONTACT',
  heading: 'Every collaboration begins with an unfinished sentence.',
  subheading: "Tell me what you're trying to make. We can revise the rest together.",
  email: '',
  location: 'Batam, Indonesia',
  draftButtonLabel: 'Create Email Draft',
  responseNote: 'Draft created — review before sending.',
  inquiryPaths: [
    { id: 'project', label: 'Start a project', subject: 'Project Inquiry', enabled: true },
    { id: 'opportunity', label: 'Offer an opportunity', subject: 'Opportunity', enabled: true },
    { id: 'hello', label: 'Just say hello', subject: 'Hello', enabled: true },
  ],
  serviceOptions: ['Writing', 'Editing', 'Directing', 'Creative Development'],
  stageOptions: ['Just an idea', 'In progress', 'Ready to begin'],
  timelineOptions: ['Flexible', 'This month', 'Specific date'],
  properties: [
    { id: 'status', label: 'Status', value: 'Open for selected projects', enabled: true },
    { id: 'based', label: 'Based in', value: 'Batam, Indonesia', enabled: true },
    { id: 'mode', label: 'Working mode', value: 'Remote / Batam-based', enabled: true },
    { id: 'response', label: 'Response', value: 'Usually within 1–3 days', enabled: true },
    { id: 'fit', label: 'Best fit', value: 'Writing, editing, directing, creative development', enabled: true },
  ],
  socials: [],
  actionButtons: [],
};

export default function Contact({ data, interactiveWords = [], onNavigate }) {
  // Selalu utamakan data dari CMS (props). FALLBACK cuma jaring pengaman kalau
  // props-nya belum ada / ada field yang kosong dari Supabase, biar gak crash.
  const contactInfo = {
    ...FALLBACK,
    ...(data || {}),
    inquiryPaths: Array.isArray(data?.inquiryPaths) && data.inquiryPaths.length ? data.inquiryPaths : FALLBACK.inquiryPaths,
    serviceOptions: Array.isArray(data?.serviceOptions) && data.serviceOptions.length ? data.serviceOptions : FALLBACK.serviceOptions,
    stageOptions: Array.isArray(data?.stageOptions) && data.stageOptions.length ? data.stageOptions : FALLBACK.stageOptions,
    timelineOptions: Array.isArray(data?.timelineOptions) && data.timelineOptions.length ? data.timelineOptions : FALLBACK.timelineOptions,
    properties: Array.isArray(data?.properties) && data.properties.length ? data.properties : FALLBACK.properties,
    socials: Array.isArray(data?.socials) ? data.socials : [],
    actionButtons: Array.isArray(data?.actionButtons) ? data.actionButtons : [],
  };
  const { location, availability } = splitLocation(contactInfo.location);

  const [copied, setCopied] = useState(false);
  const paths = contactInfo.inquiryPaths.filter((path) => path.enabled !== false);
  const [activePathId, setActivePathId] = useState(paths[0]?.id || 'project');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [service, setService] = useState(contactInfo.serviceOptions[0] || '');
  const [stage, setStage] = useState(contactInfo.stageOptions[0] || '');
  const [timeline, setTimeline] = useState(contactInfo.timelineOptions[0] || '');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [attachmentLink, setAttachmentLink] = useState('');
  const [photo, setPhoto] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [drafted, setDrafted] = useState(false);
  const [draftError, setDraftError] = useState('');
  const activePath = paths.find((path) => path.id === activePathId) || paths[0] || FALLBACK.inquiryPaths[0];
  const activePathKind = activePath.kind || activePath.id;
  const wordCount = message.trim() ? message.trim().split(/\s+/).length : 0;

  const subjectDetail = activePathKind === 'project' ? service : activePathKind === 'opportunity' ? role : senderName;
  const draftSubject = [activePath.subject || activePath.label, subjectDetail].filter(Boolean).join(' — ');
  const draftLines = [
    `Hello Haikal,`,
    '',
    senderName ? `My name is ${senderName}.` : '',
    senderEmail ? `You can reply to me at ${senderEmail}.` : '',
    activePathKind === 'project' && service ? `I’m reaching out about: ${service}.` : '',
    activePathKind === 'project' && stage ? `Current stage: ${stage}.` : '',
    activePathKind === 'project' && timeline ? `Expected timeline: ${timeline}.` : '',
    activePathKind === 'opportunity' && company ? `Company / organization: ${company}.` : '',
    activePathKind === 'opportunity' && role ? `Role / opportunity: ${role}.` : '',
    '',
    message,
    '',
    senderName ? `— ${senderName}` : '',
  ].filter((line, index, all) => line || (index > 0 && all[index - 1])).join('\n');
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      setDraftError('Tulis sedikit konteks terlebih dahulu supaya pesan tidak kosong.');
      return;
    }
    if (!senderEmail || !/^\S+@\S+\.\S+$/.test(senderEmail)) {
      setDraftError('Format email balasan belum benar.');
      return;
    }
    if (attachmentLink && !/^https?:\/\//i.test(attachmentLink)) {
      setDraftError('Link lampiran harus diawali http:// atau https://.');
      return;
    }
    if (photo && photo.size > 8 * 1024 * 1024) {
      setDraftError('Ukuran foto maksimal 8 MB.');
      return;
    }
    setDraftError('');
    setDrafted(false);
    setIsSending(true);
    const formData = new FormData();
    formData.append('name', senderName.trim());
    formData.append('email', senderEmail.trim());
    formData.append('subject', draftSubject);
    formData.append('inquiry_type', activePath.label || activePathKind);
    formData.append('service', service);
    formData.append('stage', stage);
    formData.append('timeline', timeline);
    formData.append('company', company.trim());
    formData.append('role', role.trim());
    formData.append('message', draftLines);
    formData.append('attachment_link', attachmentLink.trim());
    if (photo) formData.append('photo', photo);
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase belum dikonfigurasi.');
      const { data: result, error } = await supabase.functions.invoke('portfolio-contact', {
        body: formData,
      });
      if (error) throw error;
      if (!result?.ok) throw new Error(result?.error || 'Pengiriman gagal.');
      setDrafted(true);
      setMessage('');
      setAttachmentLink('');
      setPhoto(null);
    } catch (error) {
      console.error('Contact submission failed:', error);
      setDraftError('Pesan belum berhasil dikirim. Coba lagi atau gunakan Copy email.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactInfo.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard gak tersedia (mis. non-https lokal) — diamkan, email tetap terbaca */
    }
  };

  return (
    <div className="w-full text-gray-900 dark:text-gray-100 select-text py-2">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-12">
        <main className="min-w-0">
        <p className="font-mono text-[0.6875em] font-bold uppercase tracking-[0.2em] text-[#2B579A] dark:text-[#6FA8DC]">
          {contactInfo.eyebrow}
        </p>
        <h2 className="mt-3 max-w-3xl text-[2em] sm:text-[2.6em] font-normal font-serif text-gray-900 dark:text-white leading-[1.08] tracking-tight">
          <InteractiveText text={contactInfo.heading} rules={interactiveWords} page="Contact" onNavigate={onNavigate} />
        </h2>
        <p className="max-w-2xl text-[0.875em] sm:text-[1em] text-gray-500 dark:text-gray-400 leading-relaxed mt-4">
          <InteractiveText text={contactInfo.subheading} rules={interactiveWords} page="Contact" onNavigate={onNavigate} />
        </p>

        <div className="mt-7 flex flex-wrap gap-2" data-hint-id="contact-inquiry-paths" role="tablist" aria-label="Jenis pesan">
          {paths.map((path) => <button key={path.id} type="button" role="tab" aria-selected={activePathId === path.id} onClick={() => { setActivePathId(path.id); setDrafted(false); setDraftError(''); }} className={`ux-action rounded-md border px-3.5 py-2 text-[0.75em] font-semibold transition ${activePathId === path.id ? 'border-[#2B579A] bg-[#2B579A] text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-[#2B579A] hover:text-[#2B579A] dark:border-gray-700 dark:bg-[#222] dark:text-gray-300'}`}>{path.label}</button>)}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-[#202020]" data-hint-id="contact-document-brief">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
            <span className="font-mono text-[0.6875em] font-bold uppercase tracking-wider text-[#2B579A] dark:text-[#6FA8DC]">Untitled Collaboration</span>
            <span className="font-mono text-[0.625em] text-gray-400">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <p className="font-serif text-[1em] text-gray-700 dark:text-gray-300">Hello Haikal,</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label><span className="mb-1.5 block font-mono text-[0.625em] uppercase tracking-wider text-gray-400">My name is</span><input name="name" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Your name" className="w-full border-b border-gray-300 bg-transparent px-0 py-2 text-[0.875em] outline-none focus:border-[#2B579A] dark:border-gray-600" /></label>
              <label><span className="mb-1.5 block font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Reply to</span><input name="email" type="email" required value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="you@email.com" className="w-full border-b border-gray-300 bg-transparent px-0 py-2 text-[0.875em] outline-none focus:border-[#2B579A] dark:border-gray-600" /></label>
            </div>

            {activePathKind === 'project' && <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[['I need help with', service, setService, contactInfo.serviceOptions], ['Current stage', stage, setStage, contactInfo.stageOptions], ['Timeline', timeline, setTimeline, contactInfo.timelineOptions]].map(([label, value, setter, options]) => <label key={label}><span className="mb-1.5 block font-mono text-[0.625em] uppercase tracking-wider text-gray-400">{label}</span><select value={value} onChange={(e) => setter(e.target.value)} className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-[0.8125em] outline-none focus:border-[#2B579A] dark:border-gray-700 dark:bg-[#282828]">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>)}
            </div>}

            {activePathKind === 'opportunity' && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Company / organization</span><input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full border-b border-gray-300 bg-transparent py-2 text-[0.875em] outline-none focus:border-[#2B579A] dark:border-gray-600" /></label><label><span className="mb-1.5 block font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Role / opportunity</span><input value={role} onChange={(e) => setRole(e.target.value)} className="w-full border-b border-gray-300 bg-transparent py-2 text-[0.875em] outline-none focus:border-[#2B579A] dark:border-gray-600" /></label></div>}

            <label className="block"><span className="mb-1.5 block font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Here is what you should know</span><textarea name="message" required value={message} onChange={(e) => { setMessage(e.target.value); setDrafted(false); }} rows={6} placeholder="Start with the idea, problem, or opportunity…" className="w-full resize-y rounded-md border border-gray-200 bg-gray-50 px-4 py-3 font-serif text-[0.9375em] leading-relaxed outline-none focus:border-[#2B579A] dark:border-gray-700 dark:bg-[#282828]" /></label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label><span className="mb-1.5 block font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Attach a photo · optional</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { setPhoto(event.target.files?.[0] || null); setDrafted(false); }} className="block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[0.75em] file:mr-3 file:rounded file:border-0 file:bg-[#2B579A] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white dark:border-gray-700 dark:bg-[#282828]" /><span className="mt-1 block text-[0.6875em] text-gray-400">JPG, PNG, WEBP, atau GIF · maksimal 8 MB</span></label>
              <label><span className="mb-1.5 block font-mono text-[0.625em] uppercase tracking-wider text-gray-400">Attachment link · optional</span><input name="attachment_link" type="url" value={attachmentLink} onChange={(event) => { setAttachmentLink(event.target.value); setDrafted(false); }} placeholder="https://drive.google.com/…" className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-[0.8125em] outline-none focus:border-[#2B579A] dark:border-gray-700 dark:bg-[#282828]" /><span className="mt-1 block text-[0.6875em] text-gray-400">Drive, Dropbox, portfolio, atau referensi lain.</span></label>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <p className="font-mono text-[0.625em] text-gray-400">Pesan disimpan dan diteruskan lewat kanal Contact yang aman.</p>
              <button type="submit" disabled={isSending} className="ux-action inline-flex items-center justify-center gap-2 rounded-md bg-[#2B579A] px-5 py-2.5 text-[0.8125em] font-bold text-white transition hover:bg-[#23477f] disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B579A] focus-visible:ring-offset-2" data-hint-id="contact-create-draft">{isSending ? 'Sending…' : (/draft/i.test(contactInfo.draftButtonLabel || '') ? 'Send Message' : (contactInfo.draftButtonLabel || 'Send Message'))}<Icon.Arrow className="h-4 w-4" /></button>
            </div>
            {draftError && <p role="alert" className="text-right text-[0.75em] font-medium text-red-600 dark:text-red-400">{draftError}</p>}
            {drafted && <p role="status" className="text-right text-[0.75em] font-medium text-emerald-600 dark:text-emerald-400">Pesan berhasil dikirim. Gue akan membalas melalui email yang lu cantumkan.</p>}
          </div>
        </form>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-gray-200 pt-5 dark:border-gray-700">
          <span className="text-[0.75em] text-gray-400">Prefer another channel?</span>
          <button type="button" data-hint-id="contact-copy-email" onClick={handleCopyEmail} className="inline-flex items-center gap-1.5 text-[0.75em] font-semibold text-gray-700 hover:text-[#2B579A] dark:text-gray-300"><Icon.Mail className="h-4 w-4" />{copied ? 'Email copied' : 'Copy email'}</button>
          {contactInfo.socials.map((soc, idx) => <a key={idx} href={soc.url} target="_blank" rel="noopener noreferrer" className="text-[0.75em] font-semibold text-gray-700 hover:text-[#2B579A] dark:text-gray-300">{soc.name}</a>)}
          {contactInfo.actionButtons.filter((btn) => btn.url).map((btn, index) => <a key={index} href={resolveActionUrl(btn.url)} target="_blank" rel="noopener noreferrer" className="text-[0.75em] font-semibold text-gray-700 hover:text-[#2B579A] dark:text-gray-300">{stripTrailingEmoji(btn.label)}</a>)}
        </div>
        </main>

        <aside className="h-fit border-t-4 border-[#2B579A] bg-gray-50 p-5 dark:bg-[#242424] lg:sticky lg:top-5" data-hint-id="contact-document-properties">
          <p className="font-mono text-[0.6875em] font-bold uppercase tracking-[0.18em] text-[#2B579A] dark:text-[#6FA8DC]">Document Properties</p>
          <dl className="mt-5 space-y-4">
            {contactInfo.properties.filter((item) => item.enabled !== false && item.value).map((item) => <div key={item.id || item.label}><dt className="font-mono text-[0.5625em] uppercase tracking-widest text-gray-400">{item.label}</dt><dd className="mt-1 text-[0.8125em] leading-relaxed text-gray-700 dark:text-gray-300">{item.value}</dd></div>)}
            {!contactInfo.properties.some((item) => /based/i.test(item.label)) && location && <div><dt className="font-mono text-[0.5625em] uppercase tracking-widest text-gray-400">Based in</dt><dd className="mt-1 text-[0.8125em] text-gray-700 dark:text-gray-300">{location}</dd></div>}
            {availability && <div><dt className="font-mono text-[0.5625em] uppercase tracking-widest text-gray-400">Availability</dt><dd className="mt-1 flex items-center gap-2 text-[0.8125em] text-gray-700 dark:text-gray-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{availability}</dd></div>}
          </dl>
        </aside>
      </div>
    </div>
  );
}
