# DarsAI — حوّل فيديو الدرس إلى ملزمة

Client-side web app (React + TypeScript + Vite) that captures board frames from a lesson video, runs OCR, optionally asks an
AI provider to read/organise the content, lets you edit everything, and exports a real PDF study booklet.
Visual identity follows `design.md` (NOON — glassmorphism, light theme, `#FFB23E / #B892FF / #5EEAD4`, ink `#1B1230`).

## Commands
```bash
npm install
npm run dev         # development
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # typecheck + production build into dist/
npm run preview
```

## Deploy to GitHub Pages
1. Push to a GitHub repo, branch `main`.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. `.github/workflows/deploy.yml` installs, typechecks, runs tests (non-blocking for now), builds and deploys; the built `dist` is also kept as a downloadable artifact. `base: './'` plus `HashRouter` make refreshes and any repo sub-path work.

## What works (by design)
- Projects in IndexedDB: create / rename / duplicate / delete / search / sort, autosave, export & import (JSON), storage usage.
- Video upload (MP4/WebM/Ogg, plus MOV where the browser decodes it), timeline, start/end, presets (Fast/Balanced/Detailed),
  real frame sampling with change-ratio duplicate filtering, minimum gap, manual capture, cancel, image import, reorder/delete/download.
- YouTube: URL validation + embedded preview only. Frames **cannot** be read from the embed and DarsAI does not download videos.
- OCR: Tesseract.js (lazy, languages `ara`, `eng`), confidence shown, low confidence auto-flagged, original image always beside the text.
- AI: Gemini / OpenRouter / Groq adapters, priority + preferred provider, capability routing, retry/backoff, fallback, visible log,
  per-call consent dialogs, connection test. AI output is always flagged "needs review".
- PDF: cover, TOC (4+ headings), headings, bullets, callouts, equations, board images with timestamps, page numbers, A4/Letter,
  5 modes, preview + download. Pages are drawn with the browser's own text engine (correct Arabic shaping/bidi, no font embedding
  needed) and embedded as images with jsPDF.

## Known limitations (honest list)
- **Not verified here**: this build was authored in a sandbox without internet, so `npm install`, `tsc`, `vitest` and `vite build`
  were **not run**. Run the commands above and fix anything they report.
- PDF text is rasterised (not selectable/searchable). File size grows with page count.
- Equations are drawn as plain text; no LaTeX typesetting. Handwriting/Arabic-handwriting OCR via Tesseract is weak; use AI vision or edit manually.
- No automatic board-region detection or manual region crop yet; no image pre-processing before OCR; no cross-frame OCR merging.
- Undo/redo = browser-native in text fields only. No service worker/offline mode. Hugging Face not integrated. No ESLint config.
- The video file is not persisted; re-select it after reopening a lesson (frames are saved).
- OCR language data is downloaded from a CDN on first use (needs internet once).
- PDF generation and the UI have no automated tests (they need a real browser canvas).

See `docs/PROVIDERS.md`. OCR languages: Arabic, English. Video formats: whatever your browser decodes (MP4/H.264, WebM).
