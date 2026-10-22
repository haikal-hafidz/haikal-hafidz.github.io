import React from 'react';

const TAG_RE = /<\/?[a-z][\s\S]*>/i;

function plainTextToHtml(value) {
  return String(value || '')
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export default function RichContent({
  value = '',
  className = '',
  as: Tag = 'div',
}) {
  if (value === null || value === undefined || value === '') return null;

  const raw = String(value);
  const html = TAG_RE.test(raw) ? raw : plainTextToHtml(raw);

  return (
    <Tag
      className={`
        [&_p]:my-2
        [&_h1]:my-4 [&_h1]:text-[1.5em] [&_h1]:font-bold [&_h1]:leading-tight
        [&_h2]:my-3 [&_h2]:text-[1.25em] [&_h2]:font-bold [&_h2]:leading-tight
        [&_h3]:my-3 [&_h3]:font-bold
        [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5
        [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5
        [&_li]:my-1
        [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[#2B579A] [&_blockquote]:pl-3 [&_blockquote]:italic
        [&_a]:text-[#2B579A] [&_a]:underline dark:[&_a]:text-[#7fb0f1]
        [&_strong]:font-bold [&_em]:italic
        [&_code]:font-sans [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit [&_code]:rounded-none [&_code]:inline
        [&_pre]:font-sans [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:whitespace-pre-wrap [&_pre]:text-inherit
        ${className}
      `}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
