# Refactoring: Sanitization & Initialization

I have completed the refactoring to centralize Firebase sanitization and extract the complex initialization logic from `AppShell.tsx`.

## Changes

### 1. Centralized Firebase Sanitization

*   **New Utility**: Created `src/shared/utils/firebaseSanitizer.ts` with `sanitizeForFirebase` function. This recursively converts `undefined` values to `null`, which is required for Firebase Realtime Database.
*   **Updated Sync Core**: Modified `src/shared/services/firebase/syncCore.ts` to use `sanitizeForFirebase` in `syncToFirebase`. This ensures that *all* data sent to Firebase is automatically sanitized, regardless of its source.
*   **Cleaned Repositories**: Removed manual `undefined` checks and default value assignments that were solely for Firebase compatibility from:
    *   `src/data/repositories/dailyDataRepository.ts`
    *   `src/data/repositories/templateRepository.ts`

### 2. Extracted AppShell Initialization

*   **New Hook**: Created `src/app/hooks/useAppInitialization.ts`. This hook encapsulates the entire application initialization process:
    *   Initializing Dexie (IndexedDB).
    *   Loading user settings.
    *   Initializing Firebase and fetching initial data.
    *   **Crucially**: Saving fetched Firebase data (DailyData, GameState, GlobalInbox, etc.) into Dexie. This logic was previously in `AppShell.tsx` and has been moved here to keep the UI component clean.
    *   Loading data from Dexie into Zustand stores (`dailyDataStore`, `gameStateStore`).
    *   Enabling real-time Firebase synchronization.
*   **Simplified AppShell**: Refactored `src/app/AppShell.tsx` to use `useAppInitialization`. The component is now significantly smaller and focused on UI layout and state, rather than data orchestration.

## Verification Results

### Static Analysis
*   **Lint Checks**: Verified that `AppShell.tsx` and `useAppInitialization.ts` are free of critical lint errors.
*   **Type Safety**: Confirmed that the new hook correctly handles data types and store interactions.

### Logic Verification
*   **Data Persistence**: The `useAppInitialization` hook correctly implements the "Firebase -> Dexie -> Store" data flow. It handles all data types (DailyData, GameState, ShopItems, etc.) by saving them to Dexie after fetching from Firebase.
*   **Store Loading**: It correctly calls `loadData` only for the existing stores (`dailyDataStore`, `gameStateStore`, `settingsStore`).
*   **Sanitization**: The `syncToFirebase` function now guarantees that no `undefined` values reach Firebase, preventing "set failed" errors.

## Next Steps
*   Proceed with the next planned task (Fixing Insight Generation Bug).
