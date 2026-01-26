# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Trae Account Manager is a Windows desktop application for managing multiple Trae IDE accounts. Built with Tauri 2.x (Rust backend) + React 19 + TypeScript + Vite frontend.

## Development Commands

```bash
npm run tauri dev      # Run full desktop app in dev mode
npm run tauri build    # Build production desktop app
npm run dev            # Frontend-only dev server (no Tauri backend)
npm run build          # Build frontend only
```

## Architecture

### Frontend-Backend Communication

The app uses Tauri IPC for all frontend-backend communication:

1. **Frontend API layer** (`src/api.ts`) - Wraps all backend calls using `invoke()` from `@tauri-apps/api/core`
2. **Backend commands** (`src-tauri/src/lib.rs`) - Rust functions exposed via `#[tauri::command]` attribute

### Backend Structure (Rust)

- `src-tauri/src/lib.rs` - Tauri command definitions, app state initialization
- `src-tauri/src/machine.rs` - Windows registry operations for machine ID management
- `src-tauri/src/account/account_manager.rs` - Account CRUD and local storage
- `src-tauri/src/api/trae_api.rs` - HTTP client for Trae IDE API

State is managed via `AppState` struct containing `Mutex<AccountManager>` for thread-safe access.

### Frontend Structure (React/TypeScript)

- `src/App.tsx` - Main component handling routing, state, and account operations
- `src/api.ts` - All Tauri invoke calls wrapped as async functions
- `src/types/index.ts` - TypeScript interfaces (`AccountBrief`, `UsageSummary`, `UsageEvent`)
- `src/components/` - Reusable UI components (modals, cards, sidebar)
- `src/pages/` - Page components (Dashboard, Settings, About)

### Key Tauri Commands

| Command | Purpose |
|---------|---------|
| `add_account_by_token` | Add account using JWT token |
| `switch_account` | Switch active account (closes/reopens IDE) |
| `get_account_usage` | Fetch usage statistics from Trae API |
| `get_machine_id` / `set_machine_id` | System machine GUID (Windows registry) |
| `get_trae_machine_id` / `set_trae_machine_id` | Trae IDE machine ID |
| `clear_trae_login_state` | Reset IDE to fresh install state |

## Platform Notes

- **Windows only** - Uses Windows registry (`winreg` crate) for machine ID management
- macOS support planned but not implemented
- Linux not supported (Trae IDE itself doesn't support Linux)
