# GYM TRAINER — App Documentation

## Stack
- Vanilla JS (no frameworks), CSS3, HTML5
- Hosted on GitHub Pages: https://jesuscordovba-tech.github.io/gym-trainer
- Repo: https://github.com/jesuscordovba-tech/gym-trainer

## Files

### `index.html`
Entry point. Loads all scripts. Lock screen (PIN) rendered inline in `<style>`.
Key meta tags:
- `viewport` — allows pinch-to-zoom (no `user-scalable=no`)
- `apple-mobile-web-app-capable` — fullscreen on iOS home screen
- `theme-color` — dark/light variants for browser chrome
- CSP restricts: scripts self, connect to api.github.com, frames to youtube.com

### `js/data.js`
Static data (never modified at runtime):
- `userProfile` — age, height, weight, computed BMR/TDEE/deficit
- `gymData` — all machines grouped by category
- `workoutPlan` — 6-day split (PUSH A, PULL A, LEGS A, PUSH B, PULL B, LEGS B + CORE)
  Each day has: name, focus, warmup, cooldown, cardio, exercises[]
  Each exercise: name, machine (ref gymData), sets, reps, rest (seconds), rir, muscle, video (YouTube ID)

### `js/auth.js`
PIN-based auth using Web Crypto API (AES-256-GCM). PIN derived via PBKDF2 with salt stored as `gymapp_salt` in localStorage.
- `isLocked()`, `setPin(pin)`, `checkPin(pin)`, `clearPin()`
- `encrypt(data, pin)` / `decrypt(encrypted, pin)` — used by db.js for cloud sync

### `js/db.js`
LocalStorage persistence + GitHub Gist sync.
- Keys: `gymapp_progress`, `gymapp_weights`, `gymapp_github_token`
- Auto-syncs to Gist on every change (500ms debounce)
- Gist ID: `a2e0cc16311b5589246aa6215e5a7250`
- Sync encrypts data with auth.encrypt() before sending

### `js/app.js`
Main application logic. All code in an IIFE.

**State:**
- `progress` — `{ dayIdx: { exIdx: setsCompleted } }`
- `weights` — `{ "dayIdx-exIdx": "kg_string" }`
- `currentDay` — index of selected day
- `cloudReady` — bool, whether GitHub token is set

**Functions:**
- `initLockScreen()` — PIN creation/verification
- `initApp()` — after PIN, renders everything
- `renderWorkout(dayIndex)` — main workout view
- `handleSetClick()` — marks a set as completed, auto-starts rest timer
- `handleWeightChange()` — saves weight input
- `recommendWeight(ex, currentKg, allDone)` — computes next weight (+2.5kg if RIR≤1, +1.25kg otherwise). Only active when all sets completed.
- `startTimer()` / `showTimer()` / `hideTimer()` — rest timer with audio beep
- `setupVideo()` / `openVideo()` / `closeVideo()` — video modal for individual videos (still used for future video-btn)
- `renderMachines()` — machines tab
- `renderProgress()` — progress tab (stats + per-day detail)
- `renderSettings()` — settings tab (profile, PIN, GitHub token, sync)
- `esc(s)` — HTML-escape a string

**DEFAULT_KG** — machine → starting kg mapping for initial weight suggestions.

### `css/style.css`
Dark theme. Responsive breakpoints:
- 768px — tighter padding, smaller header
- 640px — column layout for exercise-top, 2-column day-grid
- 480px — 1-column day-grid, smaller stats, smaller set-dots
- 360px — smallest screens, tiny text

Touch targets min 44px. `overflow-x: hidden` on body. `touch-action: manipulation` on interactive elements. `prefers-reduced-motion` respected. `safe-area-inset` for notched devices.

## Features

### Video System
Each exercise with a video shows a placeholder (▶). On click, it injects the YouTube iframe (muted autoplay, loop, controls). This saves mobile data vs loading all iframes on page load.

There's also a video overlay/modal for future use (individual exercise video popup).

### Weight Recommendation
Two states:
1. **No weight recorded** → orange badge `Inicia: X kg` (from DEFAULT_KG by machine)
2. **All sets completed** → green badge `⬆ X kg` (current + increment based on RIR)

Increment: RIR ≤ 1 → +2.5kg, RIR ≥ 2 → +1.25kg.

### Rest Timer
Auto-starts after tapping a set dot (if not the last set). Shows overlay with countdown. Audio beep on completion. Can be skipped or stopped.

### Cloud Sync
Requires GitHub personal token with `gist` scope. Data is AES-256-GCM encrypted with the user's PIN before upload. Syncs automatically on every change (500ms debounce). Manual pull/push buttons in settings.

### Progressive Overload Philosophy
The app does NOT auto-increase weights. It RECOMMENDS increases when all sets are completed. The user decides whether to accept. This matches real training: you complete the prescribed reps/sets, then add weight next session.

## Build/Deploy
No build step. Push to `main` branch, GitHub Pages serves from root.
No service worker, no PWA manifest (future enhancement).
