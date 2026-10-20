# DESIGN.md – Portfolio Website Design Reference

## 1. Visual language (colors & variables)
The site defines its color palette via CSS custom properties in `src/index.css`:

| Variable | Light theme | Dark theme |
|----------|-------------|-----------|
| `--text` | `#6b6375` | `#9ca3af` |
| `--text-h` (heading) | `#08060d` | `#f3f4f6` |
| `--bg` (background) | `#fff` | `#16171d` |
| `--border` | `#e5e4e7` | `#2e303a` |
| `--code-bg` | `#f4f3ec` | `#1f2028` |
| `--accent` | `#aa3bff` | `#c084fc` |
| `--accent-bg` | `rgba(170, 59, 255, 0.1)` | `rgba(192, 132, 252, 0.15)` |
| `--accent-border` | `rgba(170, 59, 255, 0.5)` | `rgba(192, 132, 252, 0.5)` |
| `--social-bg` | `rgba(244, 243, 236, 0.5)` | `rgba(47, 48, 58, 0.5)` |
| `--shadow` | `rgba(0,0,0,0.1) 0 10px 15px -3px, rgba(0,0,0,0.05) 0 4px 6px -2px` | `rgba(0,0,0,0.4) 0 10px 15px -3px, rgba(0,0,0,0.25) 0 4px 6px -2px` |

These variables are used throughout the UI via Tailwind utilities and custom CSS classes.

## 2. Typography
- **Base font**: `system-ui, 'Segoe UI', Roboto, sans-serif` – set at 18 px (line‑height 1.45, letter‑spacing 0.18 px). On screens ≤ 1024 px the base size drops to 16 px.
- **Headings** (`h1`, `h2`): weight 500, color `var(--text-h)`. `h1` has large negative letter‑spacing (‑1.68 px) and vertical margins (32 px, reduced to 20 px on ≤ 1024 px). `h2` line‑height 118 % with small negative spacing (‑0.24 px).
- **Monospace**: `var(--mono)` (`ui‑monospace, Consolas, monospace`) used for `<code>` and `.counter` elements.
- **Code blocks**: 15 px font‑size, 135 % line‑height, padded with 4 px × 8 px, background `var(--code-bg)`.

## 3. Layout & container sizing
- Root container `#root` is centered, max‑width 1126 px, stretches to full viewport height (`min-height: 100svh`). It has a thin border (`1px solid var(--border)`).
- Primary flex layout for the main page (`#center`) uses `display: flex; flex-direction: column; gap: 25px; place-content:center; place-items:center; flex-grow:1`. On ≤ 1024 px the padding shrinks and gap reduces to 18 px.
- Sections like `#next-steps` and `#docs` are flex rows with a top border; they collapse to column layout on ≤ 1024 px.
- The hero graphics are positioned with absolute transforms (see `App.css` – not reproduced here) but are part of the visual branding and are kept as‑is.

## 4. UI components (verified CSS classes)
| Component | CSS source | Key visual rules |
|-----------|------------|-----------------|
| **Counter** | `App.css` (lines 1‑18) | Rounded box, `font-size:16px`, padding, accent colors, hover border, focus outline. |
| **Hero** | `App.css` (lines 20‑57) | Positioned elements (`.base`, `.framework`, `.vite`) with perspective transforms for a stylised logo. |
| **Next‑steps** | `App.css` (lines 73‑96) | Flex row with border‑top, padded children, icons sized 22 px, responsive column switch. |
| **Docs** | `App.css` (lines 98‑105) | Right border on desktop, bottom border on mobile. |
| **Social links list** | `App.css` (lines 107‑154) | Horizontal list, rounded background (`var(--social-bg)`), hover shadow, responsive wrap and full‑width items on mobile. |
| **Spacer** | `App.css` (lines 156‑162) | Simple horizontal rule, height 88 px (48 px on mobile). |
| **Ticks** | `App.css` (lines 164‑184) | Decorative line with pseudo‑elements using `var(--border)`. |

All other UI elements (TitleBar, Ribbon, Ruler, StatusBar, etc.) are built with Tailwind utility classes defined in the JSX; their visual appearance follows the same color vars and typography rules above.

## 5. Navigation
- Tab‑based navigation is driven by `activeTab` state. Visible tabs: **Home, About, Projects, Career, Book, Contact**. The active tab updates the document `<title>` and meta description via `setPageMeta`.
- Deep‑link support via URL query `?tab=` and optional `article=` for project detail pages.
- Mobile layout collapses the side rail; navigation tabs become stacked vertically (handled in `App.jsx` with `MOBILE_BREAKPOINT_QUERY`).

## 6. Responsive breakpoints & behavior
| Breakpoint | Condition | UI changes |
|-----------|-----------|------------|
| **Desktop** | `window.matchMedia('(max-width: 767px)')` **false** | Full‑width rail, ruler visible, TitleBar/StatusBar displayed, layout as defined in CSS (flex rows). |
| **Mobile** | `max-width: 767px` **true** | Rail hidden, Ruler omitted, TitleBar/StatusBar simplified automatically, flex rows (`#next-steps`, `#docs`) become columns, spacing reduces, font size scales down via `index.css` media query. |
| **Medium** | `max-width: 1024px` (used in many CSS rules) | Padding and gaps shrink, heading margins reduce, code font‑size remains 15 px, UI elements like social links wrap, `#root` width stays 100% (max‑width 1126 px still applies). |

## 7. Interaction patterns (visual feedback)
- Buttons and links use `transition: box-shadow 0.3s` and `:hover` shadow (`var(--shadow)`).
- `.counter` shows a border on hover and an outline on focus‑visible.
- Hint system (`HintToggle`) adds a visual overlay on interactive elements (implemented in React, not CSS).
- Full‑screen toggle animates via the Fullscreen API; no CSS change is required.
- Sound effects are optional and respect the `soundEnabled` state, but they do not affect visual design.

## 8. Elements **not fully verified** (marked as *unverified*)
- Exact values for spacing inside many Tailwind‑styled components (e.g., padding inside `TitleBar`, `Ribbon`, `StatusBar`) are defined in JSX using Tailwind classes; they are inferred from the utility classes but not listed here.
- Specific SVG icons, images and custom illustrations used in the hero or mini‑games are not covered because their assets live in the `src/assets` folder and are not referenced in the CSS files we inspected.
- Precise contrast ratios for accessibility have not been measured; only the CSS variables are documented.
- The exact behavior of the mini‑games, zine, and visitor introduction animations is driven by JavaScript; only their presence is noted.

## 9. Design preservation checklist
When editing UI components, ensure the following remain unchanged unless a deliberate redesign is approved:
1. Use the existing CSS custom properties for colors and shadows.
2. Keep the base font size (18 px desktop, 16 px ≤ 1024 px) and line‑height.
3. Preserve the responsive breakpoints at 767 px (mobile) and 1024 px (medium).
4. Maintain the flex‑based column layout for the main container and the desktop‑only rail.
5. Retain hover/focus visual cues (border, outline, shadow) defined in `App.css`.
6. Do not remove or rename the `.counter`, `.hero`, `#next-steps`, `#docs`, or `.ticks` classes.
7. Ensure any new UI element references the same `var(--…)` palette to keep visual consistency.

---

*This document is derived solely from the current source code (`*.css`, JSX component styles, and layout logic). Any design details not observable in the code are explicitly marked as unverified.*
