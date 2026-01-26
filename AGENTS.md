# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the React + TypeScript UI. Key areas: `components/` for reusable UI, `pages/` for screens, `api.ts` for Tauri invoke wrappers, and `types/` for shared interfaces. `App.tsx` is the main shell.
- `src/assets/` and `public/` contain static assets used by the frontend.
- `src-tauri/` is the Rust backend. `src/lib.rs` wires Tauri commands, `src/main.rs` is the entry, `src/account/` owns account storage, `src/api/` wraps Trae HTTP calls, and `src/machine.rs` handles Windows registry helpers. `src-tauri/tauri.conf.json` is the app config.
- `scripts/` and `trae_scripts/` contain automation helpers; `dist/` is generated build output and should not be edited by hand.

## Build, Test, and Development Commands
- `npm install` sets up JS dependencies.
- `npm run tauri dev` runs the full desktop app (frontend + Tauri backend).
- `npm run tauri build` builds the production desktop bundle.
- `npm run dev` runs the frontend-only dev server.
- `npm run build` builds the frontend bundle.
- `npm run preview` serves the built frontend for a quick smoke check.

## Coding Style & Naming Conventions
- TypeScript/React uses 2-space indentation, double quotes, and semicolons. Keep the Tauri boundary in `src/api.ts` and reuse shared types from `src/types/`.
- Naming: React components and files use PascalCase (`AccountCard.tsx`), variables/functions use camelCase, and CSS classes use kebab-case (for example, `.account-card`).
- Rust changes should stay inside `src-tauri/src/` and be formatted with `cargo fmt` where possible.

## Testing Guidelines
- There is no dedicated automated test suite in this repo. Validate changes manually using `npm run tauri dev`.
- Optional: `node scripts/playwright-delete.mjs` exercises account deletion via a running app (requires a CDP endpoint like `CDP_URL=http://127.0.0.1:9222`).

## Commit & Pull Request Guidelines
- Git history is not available in this checkout, so follow clear, imperative commit subjects (for example, `Add account import flow`) and keep each commit scoped.
- PRs should include a short description, test steps, and screenshots for UI updates in `src/`. Link relevant issues when applicable.

## Security & Configuration Notes
- Do not commit real tokens or exported account data. Local app data is stored under `%APPDATA%\\com.sauce.trae-auto\\`.
- Windows-only behavior lives in `src-tauri/src/machine.rs`; update docs if expanding platform support.
- When reading files, prefer UTF-8 encoding whenever possible.