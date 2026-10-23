---
name: ui-ux-redesign
description: Professional UI/UX audit and redesign of the Iraq caravan guide PWA (index.html, food.js, map-viewer.js, banner.js, and optionally admin.html). Use when the user asks to redesign, beautify, modernize, or improve the look, usability, layout, colors, typography, or user experience of the app or admin panel, or asks for a UI/UX review. Works screenshot-driven, proposes directions before touching the live app, and preserves offline behavior and admin-managed data.
---

# UI/UX Redesign — راهنمای کاروان عراق

You are acting as a senior product designer and front-end engineer. The goal is a redesign that looks professional and is measurably easier to use, not a coat of paint. Every change must be justified by a user need.

## 1. Who uses this app (design for them, not for a portfolio)

- **Caravan managers and staff** (مدیر و عوامل کاروان) and **pilgrims** in Najaf, Karbala, Kadhimiya, Samarra. Many are middle-aged or older, not technical.
- Used **outdoors in strong sunlight**, in crowds, often **one-handed**, often **offline** or on weak roaming data.
- Typical urgent tasks, in priority order:
  1. Call the HQ / clinic / insurance / transport supervisor **now** (emergency).
  2. Find their hotel and route to it, or find it on the city map by code.
  3. Find a place (Red Crescent, parking, restaurant, ziyarat sites).
  4. Daily food plan and cook calculator (managers / cooks).
- Language: Persian (fa), RTL. Some Arabic text (names of shrines, places).

The user who owns the project is non-technical and Persian-speaking. Talk to them in simple Persian, show pictures, avoid jargon.

## 2. Hard constraints (never break these)

- **Static GitHub Pages** site, no build step, no framework. Plain HTML/CSS/JS. Do not introduce npm builds, React, Tailwind CDN, or external CSS frameworks.
- **All content comes from `data.js`** (`CARAVAN_DATA`), edited by `admin.html`. Never hard-code content that the admin manages (names, phones, titles, footer, banners, food plans). If a redesign needs a new editable field, add it in both the app and the admin (`buildData` in admin.html plus the relevant `admin-*.js`).
- **Offline first**: `sw.js` precaches core files. Any new file must be added to `STATIC` in `sw.js`, and `CACHE` version must be bumped on every deploy that changes app files. No runtime dependency on external fonts, CDNs, or images for the app (pdf.js in admin only is fine).
- **Font**: Vazirmatn, self-hosted in `fonts/`. Keep it. Use its weight range (300–900) for hierarchy.
- **RTL correctness**: use logical properties where possible (`margin-inline-start`, `padding-inline`, `inset-inline-end`). Do not use ‹ › or arrows as text glyphs for direction (bidi mirrors them); use inline SVG. Phone numbers and counters need `dir="ltr"`.
- **Font size scaling**: every font size must stay as `calc(Npx * var(--fs,1))` so the user's Aa button keeps working (levels 1, 1.15, 1.3).
- **Theming**: light and dark via `[data-theme="dark"]`. All colors are CSS custom properties on `:root`. Section kinds have color tokens `--c-<kind>` and `--rgb-<kind>` (hq, clinic, consulate, hotel, ins, transport, restaurant, parking, ziyarat, other); `.sec-card.k-<kind>` maps them to `--accent`. Keep this system; refine values, don't scatter hex codes.
- **Preview / hidden content**: `?preview=1` and `SHOW_HIDDEN` must keep working (badges «پنهان از کاربران»).
- Do not break: swipe between cities, sticky header/tabs, quick-nav chips, hotel search and gallery, map viewer gestures, food view, photo lightbox, splash/top banner, QR/share, install banner.

## 3. Workflow

### Step 1 — Audit with real screenshots
Never redesign blind. Set up a headless browser in the scratchpad (not in the repo):

```bash
cd <scratchpad> && npm i -s playwright && npx playwright install chromium
```

Serve the repo locally (`python3 -m http.server 8080` from the repo root, in background) and capture with a script:
- Viewports: 360×780 (small Android), 390×844 (iPhone), 768×1024 (tablet).
- Both themes (`localStorage.setItem('caravan-theme','dark')` or click `#themeBtn`), and font scale 1.3.
- Each city tab, an open hotel detail, the map viewer, the food view, the splash.
- Set `sessionStorage['caravan-splash']='1'` to skip the splash when not testing it.

Look at every screenshot yourself (Read tool) before judging. Write findings as a short table: problem → who it hurts → severity → fix. Check specifically:
- **Hierarchy**: can an anxious user find "call the clinic" in under 3 seconds?
- **Touch targets** ≥ 48×48px, spacing ≥ 8px between tappable items, primary actions in the thumb zone (bottom half).
- **Contrast**: WCAG AA minimum, aim for AAA (7:1) for phone numbers and primary text (sunlight). Compute ratios, don't eyeball.
- **Density and rhythm**: consistent spacing scale (4/8/12/16/24/32), consistent radii, consistent shadows.
- **Typography**: a clear type scale (e.g. 12 / 14 / 16 / 20 / 26 / 34), line-height 1.7–1.9 for Persian body text, never below 12px base.
- **Consistency** between cards, buttons, chips, badges; one button style per role.
- **States**: pressed, focus-visible (keyboard and screen reader), disabled, loading, empty, offline.
- **Motion**: subtle, ≤ 250ms, respects `prefers-reduced-motion`.
- **Performance**: no layout shift on load, images sized, no heavy effects (large blur filters hurt cheap Android phones).

### Step 2 — Propose directions before changing the app
Build `redesign-preview.html` (a standalone page in the repo, not linked from the app) that shows 2–3 design directions side by side on real content from `data.js`, for example:
- **A. Calm & official** — refined current green, more whitespace, gold accents, quieter cards.
- **B. High-contrast field mode** — bigger type, bolder color blocks per section, maximum legibility outdoors.
- **C. Spiritual / heritage** — subtle Islamic geometric patterns, shrine imagery, warmer palette.

Each direction: the city header, an HQ card with contacts, the quick-nav, a hotel result, the bottom bar, in light and dark. Push it, give the user the link `https://mirahmadian.github.io/iraq-guide/redesign-preview.html`, explain the differences in simple Persian, and **ask which one they want** (AskUserQuestion). Do not redesign the live app until they choose.

### Step 3 — Implement in stages
After the user picks a direction:
1. **Tokens first**: update `:root` and dark-theme tokens (colors, spacing, radii, shadows, type scale). This alone should carry most of the visual change.
2. **Components**: header, tabs, hero, quick-nav, section cards, contact rows and action buttons, hotel search/detail, global cards, bottom bar, modals. Same tokens in `food.js`, `map-viewer.js`, `banner.js` injected CSS.
3. **UX improvements** that came out of the audit (e.g. sticky emergency call button, clearer empty/offline states, better hotel detail layout).
4. Optionally the **admin panel**, only if the user asks; it has its own CSS in admin.html.

Keep each stage a separate commit so it can be reverted.

### Step 4 — Verify
- Re-run the screenshot script; compare before/after; look at every image.
- Run the jsdom smoke tests in the scratchpad (render all cities, open hotel, open map, open food view, admin `buildData` round-trip) and check for console errors.
- Check contrast numbers for text and buttons in both themes.
- Check font scale 1.3 does not overflow or wrap badly at 360px.
- `node -e` syntax-check each JS file and the inline scripts.

### Step 5 — Deploy
- Bump `CACHE` in `sw.js`.
- Commit and push to `main` (the owner has authorized direct deploys). GitHub Pages takes 1–10 minutes; tell the user to wait and then fully close and reopen the app (installed PWAs update on the next launch).
- Remove `redesign-preview.html` once the redesign is live, unless the user wants to keep it.

## 4. Quality bar

The result should look like a well-made government or hajj-organization app: trustworthy, calm, clear, and fast. Prefer restraint over decoration. Every screen should answer "what can I do here, and how do I do it with one thumb?" If a decorative element competes with a phone number or a call button, remove the decoration.

## 5. Reporting to the user

Persian, short, non-technical. Show before/after screenshots when possible (publish them on the preview page). List what changed in plain words, what they need to do (usually: wait, then reopen), and anything you could not verify on a real phone.
