# Unified Sync Engine Implementation

## Goal
Implement a "Unified Sync Engine" that automates data synchronization between Dexie (local) and Firebase (remote).
-   **Dexie Hooks**: Automatically detect local changes and sync to Firebase.
-   **Repositories**: Remove explicit `syncToFirebase` calls, making them pure Dexie wrappers.
-   **Loop Prevention**: Handle remote updates without triggering infinite sync loops.

## Proposed Changes

### 1. Create Sync Engine

#### [NEW] [syncEngine.ts](file:///e:/git/timeblock_new/src/shared/services/syncEngine.ts)
-   **`SyncEngine` Class**:
    -   `init(db)`: Registers Dexie hooks for `creating`, `updating`, `deleting`.
    -   `applyRemoteUpdate(callback)`: Wrapper to prevent hooks from triggering sync during remote updates.
    -   `handleLocalChange(tableName, obj, key)`: Dispatches to `syncToFirebase` based on table strategy.
-   **Strategies**:
    -   `dailyData`: Sync single record by key (date).
    -   `gameState`: Sync single record.
    -   `templates`: Fetch all -> Sync array.
    -   `shopItems`: Fetch all -> Sync array.
    -   `globalInbox`: Fetch all -> Sync array.
    -   `energyLevels`: Sync single record by key (date).

### 2. Refactor Repositories

Remove `syncToFirebase` calls from:
-   [dailyDataRepository.ts](file:///e:/git/timeblock_new/src/data/repositories/dailyDataRepository.ts)
-   [gameStateRepository.ts](file:///e:/git/timeblock_new/src/data/repositories/gameStateRepository.ts)
-   [templateRepository.ts](file:///e:/git/timeblock_new/src/data/repositories/templateRepository.ts)
-   [shopRepository.ts](file:///e:/git/timeblock_new/src/data/repositories/shopRepository.ts)
-   [energyRepository.ts](file:///e:/git/timeblock_new/src/data/repositories/energyRepository.ts)
-   [inboxRepository.ts](file:///e:/git/timeblock_new/src/data/repositories/inboxRepository.ts) (if exists and has sync)

### 3. Update Initialization & Realtime Sync

#### [MODIFY] [useAppInitialization.ts](file:///e:/git/timeblock_new/src/app/hooks/useAppInitialization.ts)
-   Initialize `SyncEngine` with `db`.
-   Wrap `fetchDataFromFirebase` saving logic with `SyncEngine.applyRemoteUpdate`.
-   Wrap `enableFirebaseSync` callbacks with `SyncEngine.applyRemoteUpdate` (and ensure they write to Dexie).

#### [MODIFY] [firebaseService.ts](file:///e:/git/timeblock_new/src/shared/services/firebaseService.ts)
-   Update `enableFirebaseSync` to potentially return data or allow `SyncEngine` to handle the writing.
-   *Better*: Move `enableFirebaseSync` logic into `SyncEngine` or make it use `SyncEngine`.

## Verification Plan

### Automated Tests
-   (No unit tests environment, so manual verification)

### Manual Verification
1.  **Local -> Remote**:
    -   Add a task (DailyData). Check Firebase console.
    -   Add XP (GameState). Check Firebase console.
    -   Create Template. Check Firebase console.
2.  **Remote -> Local**:
    -   Modify data in Firebase console.
    -   Verify app updates (via Realtime Sync).
    -   **Crucial**: Verify no infinite loop (console logs shouldn't show endless "Syncing..." messages).
