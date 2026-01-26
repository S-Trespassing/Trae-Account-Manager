# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the React + TypeScript UI, with shared components in `src/components/` and top-level screens in `src/pages/`.
- `src/types/` defines shared TypeScript types; `src/api.ts` centralizes frontend API calls.
- `src-tauri/` contains the Rust backend and Tauri config (`src-tauri/tauri.conf.json`), with modules under `src-tauri/src/account/` and `src-tauri/src/api/`.
- `public/` and `src/assets/` store static assets; `src-tauri/icons/` stores app icons.
- `scripts/` includes Playwright helpers; `trae_scripts/` contains Python automation utilities.
- `dist/` is generated build output; do not edit by hand.

## Build, Test, and Development Commands
- `npm install` installs frontend dependencies.
- `npm run dev` starts the Vite dev server on `http://localhost:1420` (the Tauri dev URL).
- `npm run tauri dev` runs the desktop app (Rust backend + Vite frontend).
- `npm run build` type-checks and builds the frontend to `dist/`.
- `npm run tauri build` builds the desktop bundle.
- `npm run preview` serves the built frontend for smoke checks.

## Coding Style & Naming Conventions
- TypeScript/React uses 2-space indentation, double quotes, and semicolons.
- Rust files follow standard `rustfmt` layout with 4-space indentation.
- Component and page files are `PascalCase.tsx` (e.g., `src/components/AccountCard.tsx`).
- Keep shared types in `src/types/` and reuse existing API helpers in `src/api.ts`.
- `tsconfig.json` is strict; avoid unused locals/parameters and fix type errors early.

## Testing Guidelines
- No unit-test runner is configured yet.
- Playwright helper scripts exist for manual UI checks:
  - `node scripts/verify-themes.mjs` (run `npm run dev` first; outputs `screenshots/`).
  - `node scripts/playwright-delete.mjs` (requires the app running and a Chromium CDP endpoint; set `CDP_URL` if needed).
- If you add tests, document the command here and keep naming consistent (e.g., `*.spec.ts`).

## Commit & Pull Request Guidelines
- Recent history follows a Conventional Commits pattern: `type(scope): message` (e.g., `chore(build): update config`). Keep it consistent.
- Write concise, present-tense commit messages and keep commits scoped to one change.
- PRs should include: a brief description, linked issues (if any), testing performed (commands), and screenshots for UI changes.

## Security & Configuration Tips
- App data is stored locally under `%APPDATA%\\com.sauce.trae-auto\\`; avoid committing real account data.
- Keep `src-tauri/tauri.conf.json` and `vite.config.ts` aligned on the dev URL/port.
