# Stabilo Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the audit's High findings and re-skin all 35 routes of ReadQuest in the approved "Stabilo" direction (reading-journal look, highlighter accent) without changing API or data.

**Architecture:** One token source (`frontend/src/app/globals.css` CSS variables mapped through Tailwind v4 `@theme inline`), self-hosted fonts via `next/font/local`, shared primitives in `frontend/src/components/ui.tsx` + a few focused new components. Pages keep their data logic; only markup/classes change. Pure logic touched (copy helpers, brand-color guard, menu split) gets Vitest tests first.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19.2, Tailwind v4, lucide-react, Vitest 5 (node env). No new runtime dependencies.

**Spec:** `docs/redesign/AUDIT.md` (findings) + `docs/redesign/DESIGN-SYSTEM.md` (tokens/components) + approved direction preview "A. Stabilo".

## Global Constraints

- Language: UI copy Bahasa Indonesia, sentence case, no emoji in headings/nav; code, names, commits in English.
- Colors (light): paper `#F6F7F9`, surface `#FFFFFF`, ink `#1B2340`, muted `#5A6177`, line `#E1E4EB`, highlighter `#FFE066`, leaf `#2F7D5B`, danger `#C2410C`-family must meet 4.5:1 on surface.
- Colors (dark, not near-black): bg `#121830`, surface `#1A2140`, ink `#ECEEF6`, muted `#A9AFC6`, line `#2A3256`, highlighter `#F5D547` (text on it is `#121830`).
- Type: Literata (display + note body, serif), Plus Jakarta Sans (UI). Self-hosted woff2 via `next/font/local` — no request to Google at build or runtime; CSP unchanged.
- Admin branding: `primary_color` only tints brand accents (logo tile, active-nav indicator, links) and is clamped to ≥4.5:1 against surface; it never replaces ink/highlighter.
- All text ≥12px; tap targets ≥44px; every interactive element has `focus-visible` ring; all motion inside `@media (prefers-reduced-motion: no-preference)`.
- No API/schema changes. `npm run lint && npm run typecheck && npm test && npm run build` green after every task.
- Performance must not regress vs baseline (`/home/claude/rt/shots/before/report.json`): per-route LCP within +100ms, CLS ≤ baseline and ≤0.1 on every route.

## Review Focus

- Long names/titles (e.g. "Dewi Lestari Putri", 60-char book titles) at 360px width: must wrap or truncate with full text available, never collapse to one letter (Task 2 test via `ProfileHeader` layout rule + screenshot check).
- Admin sets a light brand color (e.g. `#FFE600`): accent must be auto-darkened to stay ≥4.5:1 (Task 3 `brandAccent` test).
- Member opens `/team` directly: gets a clear "khusus Team Lead/Admin" state, no raw 403 (Task 2).
- Dark mode + highlighter: text on highlight stays dark (≥4.5:1) (Task 3 token check in DESIGN-SYSTEM table, screenshot in Task 5).
- Feature flags off (feed/leaderboard/quests disabled by Admin): Home and bottom nav must not show dead links or empty gaps (Task 4/5 use `visibleMenus`; menu test covers disabled feature).

---

### Task 1: Audit + design docs

**Files:** Create `docs/redesign/AUDIT.md`, `docs/redesign/DESIGN-SYSTEM.md`, `docs/redesign/UX-FLOW.md`.

- [ ] Write AUDIT.md: summary, findings table (area, issue, impact, severity, fix, effort, status), baseline metrics table per route.
- [ ] Write UX-FLOW.md: Mermaid diagrams of current vs proposed main loop (open app → read 15 min → write note → feed/points) and per-page "3-second" hierarchy.
- [ ] Write DESIGN-SYSTEM.md: tokens table (light/dark, contrast ratios), type scale, radius/shadow/motion, component inventory with states.
- [ ] Commit `docs: add redesign audit, UX flow and design system`.

### Task 2: High-severity fixes (behavior, not look)

**Files:** Modify `features/profile/ProfileHeader.tsx`, `components/AppShell.tsx`, `features/feed/FeedView.tsx`, `app/(app)/(main)/team/page.tsx`, `app/(app)/(main)/profile/page.tsx`, `components/PostCard.tsx`, `features/navigation/menu.ts`; Test `features/navigation/menu.test.ts`.

**Interfaces:** Produces `splitMobileMenus(items, slots = 4): { primary: MenuItem[]; more: MenuItem[] }` unchanged signature, but `read` is excluded from `primary` (it gets the center action button).

- [ ] Test: `splitMobileMenus` never puts `read` in `primary`; with `read` + 5 others → `primary.length === 4`, `more` contains the rest except `read`. Run `npm test -- menu` → FAIL.
- [ ] Implement in `menu.ts`; run → PASS.
- [ ] ProfileHeader: name block takes full row on mobile (`basis-full sm:basis-auto`), actions below; `<dt>` before `<dd>`.
- [ ] AppShell: remove floating "+" FAB; bottom nav gets a raised center "Baca" item linking `/read` (no overlap with content).
- [ ] FeedView: move the function `<select>` out of `role="tablist"`; tabs keep `role="tab"`/`aria-selected`.
- [ ] Team page: if `user.permissions` lacks the team-view permission, render an explanatory empty state and do not call the API.
- [ ] PostCard rating: stars use `text-rating` token (≥4.5:1).
- [ ] Reserve space (skeletons with fixed min-heights) for Home widgets and profile header to cut CLS.
- [ ] Verify lint/typecheck/test/build; commit `fix: profile header wrap, mobile nav overlap, feed tablist a11y, team gate, CLS`.

### Task 3: Tokens, fonts, brand guard

**Files:** Modify `app/globals.css`, `app/layout.tsx`, `features/ui-config/BrandingEffects.tsx`; Create `src/fonts/*.woff2` + `src/fonts/OFL.txt`, `lib/color.ts`; Test `lib/color.test.ts`.

**Interfaces:** Produces `contrastRatio(a: string, b: string): number` and `brandAccent(hex: string, surface: string): string` (returns hex darkened/lightened in steps until ratio ≥ 4.5). CSS vars consumed by all later tasks: `--paper --surface --surface-muted --ink --muted --line --highlight --on-highlight --leaf --danger --rating --brand-accent`, Tailwind names `bg-paper text-ink bg-highlight text-on-highlight text-rating border-line font-display`.

- [ ] Test: `contrastRatio("#1B2340","#FFFFFF") > 14`; `brandAccent("#FFE600","#FFFFFF")` has ratio ≥ 4.5 with `#FFFFFF`; `brandAccent("#1B2340","#FFFFFF") === "#1b2340"`; invalid hex returns fallback `#1B2340`. Run → FAIL.
- [ ] Implement `lib/color.ts`; run → PASS.
- [ ] Replace tokens in globals.css (keep old names `--primary/--foreground/--border/...` as aliases so untouched classes keep working); add `.marker`, `.hl` utilities and reduced-motion guards; theme-color meta updated.
- [ ] Fonts via `next/font/local` with CSS variables `--font-display`, `--font-sans`.
- [ ] BrandingEffects sets `--brand-accent` via `brandAccent` for light and dark surfaces.
- [ ] Verify; commit `feat(ui): Stabilo design tokens, self-hosted fonts, brand contrast guard`.

### Task 4: Core primitives

**Files:** Modify `components/ui.tsx`, `components/ProgressBar.tsx`, `components/Avatar.tsx`, `components/BookCover.tsx`; Create `components/Skeleton.tsx`, `components/EmptyState.tsx`, `components/Marker.tsx`, `components/Tabs.tsx`.

**Interfaces:** `Button` variants `primary | secondary | ghost | danger`, sizes `md | sm`, states hover/focus-visible/active/disabled/loading; `Marker({ value, max, label })` highlighter progress with `role="progressbar"`; `Tabs({ items, value, onChange, label })` roving-tabindex tablist; `EmptyState({ icon, title, body, action })`; `Skeleton({ className })`.

- [ ] Implement; replace ad-hoc tab markup in FeedView, profile, u/[id], leaderboard, ShelfView, admin moderation/appearance with `Tabs`.
- [ ] Verify; commit `feat(ui): core primitives with full state coverage`.

### Task 5: Shell + Home (checkpoint)

**Files:** Modify `components/AppShell.tsx`, `components/Logo.tsx`, `app/(app)/(main)/page.tsx`, `features/home/*`, `features/shell/widgets.tsx`; Create `features/home/TodayHero.tsx`, `lib/today.ts`; Test `lib/today.test.ts`.

**Interfaces:** `todayHeadline({ minutes, target, name }): string` → `"9 menit lagi untuk target hari ini, Rina"` when below target, `"Target hari ini tercapai, Rina"` when ≥ target, `"Mulai 15 menit pertamamu hari ini, Rina"` when 0.

- [ ] Test the three cases + first name extraction ("Dewi Lestari Putri" → "Dewi"). FAIL → implement → PASS.
- [ ] Home order (mobile): TodayHero (date, headline in Literata, Marker, streak, CTA "Lanjut baca <last book>" or "Mulai sesi baca"), team strip (avatars + "x dari y rekan sudah membaca"), composer, feed. Desktop keeps right rail.
- [ ] Shell: paper background, ink header, sidebar with highlighter active state, bottom nav with center Baca.
- [ ] Screenshot desktop + mobile, light + dark; send to user.
- [ ] Commit `feat(home): Stabilo shell and Today hero`.

### Task 6: Feed + post detail
`components/PostCard.tsx`, `features/feed/*`, `app/(app)/(main)/posts/[id]/page.tsx`. Note body in Literata; first quote/highlight styled with `.hl`; image max-height 420px with fixed aspect to avoid CLS; reactions as labeled pill buttons. Commit `feat(feed): journal-style post cards`.

### Task 7: Reading flow
`app/(app)/read/page.tsx`, `features/reading/*`. Book picker list, timer ring in ink/highlight, finish form steps, celebration respects reduced motion. Commit `feat(read): Stabilo reading session`.

### Task 8: Progress pages
leaderboard, quests, stats, profile, u/[id], shelf, books, books/[id], buddy, room, notifications, settings/notifications, team. Charts get axis labels and value tooltips/table toggle; badge names wrap (2 lines). Commit per 3–4 pages.

### Task 9: Auth + onboarding
login, register, onboarding. Commit `feat(auth): Stabilo auth and onboarding`.

### Task 10: Admin
`app/(app)/admin/layout.tsx` (lucide icons, full-height sidebar), all admin pages via shared primitives. Commit `feat(admin): Stabilo admin`.

### Task 11: Verification
Full `shoot.mjs` run against redesign build (port 3001) → compare with baseline (LCP, CLS, axe counts, console errors); lint/typecheck/test/build; code review; CHANGELOG entry in `docs/redesign/CHANGELOG.md`; update AUDIT.md statuses.
