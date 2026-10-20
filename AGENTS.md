# AGENTS.md – Portfolio Web Project Guide

**Purpose** – This document records the verified facts about the current portfolio website, defines safe editing rules, and outlines a testing workflow that can be followed for any change. All existing features, design, architecture, and Supabase integrations are to be preserved unless you explicitly request otherwise.

---

## 1️⃣ Project purpose  
A personal portfolio site for **Haikal A. Hafidz** that showcases writing, editing, books, projects, interactive mini‑games, and provides a Supabase‑backed admin CMS for live content updates.

---

## 2️⃣ Verified technology stack  

| Layer | Packages (from `package.json`) |
|-------|--------------------------------|
| **Framework** | `react` ^19.2.8, `react-dom` ^19.2.8, `vite` ^8.2.0 |
| **Styling** | `tailwindcss` ^4.3.3, `@tailwindcss/vite` |
| **Backend / Data** | `@supabase/supabase-js` ^2.112.2 (Auth, RLS, RPC) |
| **Rich‑text editor** | `@tiptap/*` (core, pm, react, starter‑kit, extensions) |
| **Document conversion** | `mammoth` ^1.12.1 |
| **Analytics** | Custom `src/lib/analytics.js` (GA4, enabled via `VITE_GA_MEASUREMENT_ID`) |
| **Build & Dev** | `@vitejs/plugin-react`, `@tailwindcss/vite` |
| **Lint / Tooling** | `eslint`, `@eslint/js`, `eslint‑plugin‑react‑hooks`, `eslint‑plugin‑react‑refresh` |

> **Note:** The site **already has a public GitHub Pages URL** (`https://haikal-hafidz.github.io/`). The exact deployment configuration in the repository (e.g., `homepage` field, CI scripts) has **not been verified**, so any modification to the deployment setup requires your explicit approval.

---

## 3️⃣ Repository layout (verified)  

```
Portofolio Web/
├─ .github/                (empty)
├─ .vscode/
├─ dist/                   ← production build output (generated)
├─ netlify/                ← legacy Netlify folder (no config files present)
├─ node_modules/
├─ public/
│   ├─ favicon.png
│   ├─ icons.svg
│   ├─ share-preview.jpg
│   ├─ _headers            ← Netlify‑specific response headers
│   └─ _redirects          ← Netlify‑specific redirects
├─ src/
│   ├─ App.jsx                 ← root component, lazy‑loads pages & CMS
│   ├─ pages/
│   │   ├─ About.jsx
│   │   ├─ Book.jsx
│   │   ├─ Career.jsx
│   │   ├─ Contact.jsx
│   │   ├─ Home.jsx
│   │   └─ Projects.jsx
│   ├─ components/
│   │   ├─ TitleBar.jsx
│   │   ├─ Ribbon.jsx
│   │   ├─ Ruler.jsx
│   │   ├─ StatusBar.jsx
│   │   ├─ WelcomeToast.jsx
│   │   ├─ HintToggle.jsx
│   │   ├─ DocumentLoader.jsx
│   │   ├─ miniGames/          ← mini‑game UI
│   │   └─ wassup/             ← “Wassup?” zine UI
│   ├─ cms/
│   │   ├─ CmsDashboard.jsx
│   │   ├─ CmsData.js
│   │   ├─ CmsWritingEditor.jsx
│   │   └─ InteractiveLinksEditor.jsx
│   ├─ lib/
│   │   ├─ analytics.js
│   │   ├─ supabaseClient.js
│   │   ├─ pageMeta.js
│   │   ├─ visitorIntroductionData.js
│   │   ├─ localization.js
│   │   └─ homeExperienceApi.js
│   └─ assets/                ← static assets referenced from code
├─ .env.example               ← template for required VITE_ env vars
├─ .gitignore
├─ package.json
├─ vite.config.js
└─ README.md
```

- **Legacy Netlify files** (`_headers`, `_redirects`) are retained; their purpose has not been removed because they may still be needed if the site ever returns to Netlify.

---

## 4️⃣ Public pages & navigation (source → feature)  

| Tab (query `tab=`) | Source file | Core features |
|--------------------|-------------|---------------|
| **Home** | `src/pages/Home.jsx` | Featured‑works carousel, HomeExperience dialog, VisitorIntroduction splash, Hint system, Mini‑games, “Wassup?” zine |
| **About** | `src/pages/About.jsx` | Author bio, author‑properties panel, Last.fm footnote |
| **Projects** | `src/pages/Projects.jsx` | Lists articles, books, directing, posters, custom sections; deep‑link support (`?article=`) |
| **Career** | `src/pages/Career.jsx` | Timeline, dynamic statement, word‑count via `StatusBar` |
| **Book** | `src/pages/Book.jsx` | Book showcase (re‑uses carousel logic) |
| **Contact** | `src/pages/Contact.jsx` | Contact information and external links |

Navigation is driven by the `activeTab` state in `src/App.jsx`. Deep‑link handling (`?tab=Projects&article=…`) is implemented there (lines 456‑463).

---

## 5️⃣ UI conventions (verified)  

- **Responsive layout** – Mobile breakpoint `(max-width: 767px)`. Desktop uses a “paper‑like” base view scale (`BASE_VIEW_SCALE = 0.9`). Mobile layout disables the ruler and simplifies TitleBar/StatusBar.  
- **Font scaling** – `fontSize` (pt) applied via inline style; Tailwind utilities are expressed in `em` to respect this scaling.  
- **Full‑screen mode** – toggled via the Fullscreen API (`document.documentElement.requestFullscreen()`).  
- **Hint overlay** – `HintToggle` globally highlights elements with `data‑hint‑id`.  
- **Analytics** – `trackPageView(activeTab)` fires on each tab change (except when admin mode is active). GA4 is initialized once via `initAnalytics()` if `VITE_GA_MEASUREMENT_ID` is set.

---

## 6️⃣ Architectural patterns (verified)  

1. **Lazy loading** – All public pages and the CMS dashboard are loaded with `React.lazy`.  
2. **Code splitting** – Defined in `vite.config.js` (`rolldownOptions.output.codeSplitting.groups`) to separate vendors, data, page chunks, and public components.  
3. **State persistence** – Session storage caches live portfolio data (`PORTFOLIO_SESSION_CACHE_KEY`); local storage holds UI preferences (`portfolio_language`, `portfolio_sound`).  
4. **Supabase auth flow** – Admin login uses `VITE_ADMIN_EMAIL`; admin status is verified via RPC `is_portfolio_admin`. Auth state changes are listened to via `supabase.auth.onAuthStateChange`.  
5. **CMS** – `src/cms/CmsDashboard.jsx` provides a UI for editing content; saves are sent to Supabase (`savePortfolioData`).

---

## 7️⃣ Safe editing rules (concise & actionable)  

| # | Rule |
|---|------|
| 1 | **Open the target file** and note exact line numbers before editing. |
| 2 | **Scope changes** to a single component, page, or helper function; avoid touching shared layout files unless necessary. |
| 3 | **Do not rename, add, or remove** `VITE_` environment variables without updating `.env.example` and all code references. |
| 4 | **Run `npm audit fix` only after reviewing** the suggested changes; avoid forcing major version upgrades without testing. |
| 5 | **Testing workflow** (see Section 8) must be followed for every change. |
| 6 | **Never modify** existing design, content, CMS logic, or Supabase integration unless you explicitly request it. |
| 7 | **Deployment changes** (including any CI or GitHub‑Actions scripts) **require your explicit approval**; the current deployment setup is to be preserved. |
| 8 | **Retain Netlify files** (`_headers`, `_redirects`) unless you confirm they are obsolete. |

---

## 8️⃣ Testing workflow (proportional to the change)  

1. **Inspect & test** the specific functionality you are modifying (e.g., component UI, CMS flow, Supabase request).  
2. **Run the app locally** – `npm run dev`.  
   - If the change **affects UI or responsiveness**, **test both desktop and mobile viewports**.  
   - For non‑UI changes (e.g., data helpers, server‑side logic), viewport testing is not required.  
3. **Build the project** – `npm run build` – after code changes (when feasible) to ensure the production bundle succeeds.  
4. **Check related navigation**, CMS dialogs, or third‑party integrations (Supabase, GA4) if the change touches them.  
5. **Report any tests you could not perform** (e.g., lack of a live Supabase instance) in the change summary.  

---

## 9️⃣ Remaining uncertainties (untested)  

| Area | Reason |
|------|--------|
| **Netlify configuration** | No `netlify.toml` is present; we only see Netlify‑specific files (`_headers`, `_redirects`). Their current relevance is unknown. |
| **CI/CD pipeline** | No GitHub Actions or other CI scripts are in the repo, so the exact build‑and‑deploy process is not documented. |
| **Supabase schema & RPCs** | Table structure, RLS policies, and the `is_portfolio_admin` RPC live in the Supabase project, not in the repository. |
| **Asset sources for featured works** | Images / media are loaded from Supabase data; local assets beyond the generic icons are not present. |
| **Accessibility & i18n verification** | Localization helper exists, but there are no automated tests for language switching or accessibility compliance. |
| **Production‑ready deployment config** | **Website sudah live di GitHub Pages (https://haikal-hafidz.github.io/).** Yang belum diverifikasi hanyalah konfigurasi deployment di repository lokal (mis. field `homepage` atau skrip CI). |

---

## 10️⃣ Next actions  

1. **Review this draft** and let me know if any section needs adjustment.  
2. **Approve** the final content when you are satisfied; I will then create the `AGENTS.md` file.  
3. If you need additional documentation (e.g., `CONTRIBUTING.md`, `DESIGN.md`) or want to clarify any of the uncertainties, just tell me.

*All instructions respect the constraints you set: no code changes, no commits, and no deployments will occur until you give explicit permission.*
