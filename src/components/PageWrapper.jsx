import React from 'react';

/**
 * Wrapper that gives each portfolio section an A4‑portrait layout.
 * It centers the content, enforces an A4 aspect ratio on desktop,
 * and provides a margin between pages.
 *
 * Props:
 *   id   – string that matches the tab name (e.g. "Home").
 *   children – the actual page component (Home, About, …).
 */
export default function PageWrapper({ id, children }) {
  // The outer div is used by the IntersectionObserver via the id attribute.
  // The inner container gets the A4 styling on desktop.
  return (
    <div id={id} className="w-full flex justify-center">
      <div className="relative w-full max-w-[794px] bg-white dark:bg-[#202020] p-8 rounded shadow-xl border border-gray-300 dark:border-gray-700"
        style={{
          // 210mm × 297mm at 96dpi ≈ 794 × 1123px. We keep height auto so content can expand.
          aspectRatio: '210 / 297',
          // On desktop we keep the A4 size; on mobile the outer wrapper is hidden by the other branch.
        }}>
        {children}
      </div>
    </div>
  );
}
