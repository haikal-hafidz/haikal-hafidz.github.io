import React, { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Extension } from '@tiptap/core';

const ParagraphSpacing = Extension.create({
  name: 'paragraphSpacing',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading', 'blockquote'],
      attributes: {
        paragraphSpacing: {
          default: null,
          parseHTML: (element) => element.style.marginBottom || null,
          renderHTML: (attributes) => attributes.paragraphSpacing
            ? { style: `margin-bottom: ${attributes.paragraphSpacing}` }
            : {},
        },
      },
    }];
  },
});

export default function CmsWritingEditor({
  initialValue = '',
  onChange,
  placeholder = '',
  variant = 'standard',
}) {
  const [linkUrl, setLinkUrl] = useState('');
  const compact = variant === 'mini';
  const documentMode = variant === 'document';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      TextStyleKit.configure({ backgroundColor: false, color: false, fontFamily: false }),
      ParagraphSpacing,
    ],
    content: initialValue || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `${compact ? 'min-h-[92px]' : documentMode ? 'min-h-[280px]' : 'min-h-[150px]'} px-3 py-3 text-xs leading-relaxed focus:outline-none`,
        'data-placeholder': placeholder,
      },
      transformPastedHTML(html) {
        return html
          .replace(/<(meta|link|style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
          .replace(/\sclass=("|\')[^"\']*\1/gi, '')
          .replace(/\s(id|lang|dir)=("|\')[^"\']*\2/gi, '');
      },
    },
    onUpdate: ({ editor: activeEditor }) => onChange?.(activeEditor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const next = initialValue || '';
    if (editor.getHTML() !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, initialValue]);

  if (!editor) return <div className="min-h-[92px] rounded border border-gray-200 p-3 text-xs text-gray-400 dark:border-gray-700">Menyiapkan editor…</div>;

  const btn = (active = false) =>
    `min-w-7 rounded px-2 py-1 text-[10px] font-medium transition ${active ? 'bg-[#2B579A] text-white' : 'text-gray-700 hover:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700'}`;

  const setLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkUrl('');
  };

  return (
    <div className="overflow-hidden rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-[#1e1e1e]">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-1 py-1 dark:border-gray-700 dark:bg-[#2d2d2d]">
        {!compact && (
          <select
            value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('blockquote') ? 'blockquote' : 'p'}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'p') editor.chain().focus().setParagraph().run();
              else if (value === 'blockquote') editor.chain().focus().toggleBlockquote().run();
              else editor.chain().focus().toggleHeading({ level: Number(value.replace('h', '')) }).run();
            }}
            className="mr-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]"
          >
            <option value="p">Normal</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option>
          </select>
        )}

        <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
        <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button type="button" className={btn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></button>
        {!compact && <button type="button" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></button>}

        <button type="button" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>

        {!compact && (
          <>
            <select defaultValue="" onChange={(e) => { if (e.target.value) editor.chain().focus().setFontSize(e.target.value).run(); e.target.value = ''; }} className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]">
              <option value="" disabled>Size</option><option value="0.75em">Small</option><option value="1em">Normal</option><option value="1.25em">Large</option><option value="1.5em">XL</option>
            </select>
            <select defaultValue="" onChange={(e) => { if (e.target.value) editor.chain().focus().setLineHeight(e.target.value).run(); e.target.value = ''; }} className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]">
              <option value="" disabled>Line</option><option value="1.25">1.0</option><option value="1.5">1.15</option><option value="1.75">1.5</option><option value="2">2.0</option>
            </select>
            <select defaultValue="" onChange={(e) => { if (e.target.value) editor.chain().focus().updateAttributes('paragraph', { paragraphSpacing: e.target.value }).run(); e.target.value = ''; }} className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]">
              <option value="" disabled>Space</option><option value="0">0</option><option value="0.5em">S</option><option value="1em">M</option><option value="1.5em">L</option>
            </select>
          </>
        )}

        {['left', 'center', 'right', 'justify'].map((align) => (
          <button key={align} type="button" className={btn(editor.isActive({ textAlign: align }))} onClick={() => editor.chain().focus().setTextAlign(align).run()}>
            {align === 'left' ? '≡←' : align === 'center' ? '≡' : align === 'right' ? '→≡' : '☰'}
          </button>
        ))}

        {!compact && (
          <>
            <button type="button" className={btn()} onClick={() => editor.chain().focus().undo().run()}>↶</button>
            <button type="button" className={btn()} onClick={() => editor.chain().focus().redo().run()}>↷</button>
          </>
        )}

        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="ml-1 w-24 rounded border border-gray-300 bg-white px-1.5 py-1 text-[10px] dark:border-gray-600 dark:bg-[#1e1e1e]" />
        <button type="button" className={btn(editor.isActive('link'))} onClick={setLink}>Link</button>
        {!compact && <button type="button" className={btn()} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>Clear</button>}
      </div>

      <div className="[&_.tiptap]:outline-none [&_.tiptap_p]:my-2 [&_.tiptap_ul]:my-2 [&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ol]:my-2 [&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_blockquote]:my-3 [&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-[#2B579A] [&_.tiptap_blockquote]:pl-3 [&_.tiptap_a]:text-[#2B579A] [&_.tiptap_a]:underline">
        <EditorContent editor={editor} />
      </div>

      <div className="border-t border-gray-100 px-3 py-1 font-mono text-[9px] text-gray-400 dark:border-gray-800">
        {compact ? 'Mini Writer' : documentMode ? 'Document Writer' : 'Standard Writer'} · tersimpan sebagai semantic HTML
      </div>
    </div>
  );
}
