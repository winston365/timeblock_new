/**
 * GameState Repository
 *
 * @role 게임화 시스템 데이터 관리 (XP, 퀘스트, 연속 출석 등)
 *
 * This file is now a barrel re-export for backwards compatibility.
 * The actual implementation has been split into:
 *   - gameState/questOperations.ts - Quest management
 *   - gameState/xpOperations.ts - XP calculations
 *   - gameState/historyOperations.ts - History management
 *   - gameState/dayOperations.ts - Daily reset and migrations
 *   - gameState/index.ts - Repository CRUD and orchestration
 */

// Re-export everything from the modularized gameState repository
export {
  // CRUD operations
  createInitialGameState,
  loadGameState,
  saveGameState,
  updateGameState,

  // XP management
  addXP,
  spendXP,

  // Day management
  initializeNewDay,

  // Quest management
  updateQuestProgress,
  claimQuestBonus,

  // History management
  addToCompletedHistory,
  getXPHistory,
  getTimeBlockXPHistory,

  // Sub-module exports for direct access
  generateDailyQuests,
  validateAndCompleteQuests,
  incrementQuestProgress,
  processAddXP,
  processSpendXP,
  addToXPHistory,
  addToBlockXPHistory,
  addToCompletedTasksHistory,
  getXPHistoryFromState,
  getBlockXPHistoryFromState,
  processDailyReset,
  calculateStreak,
  migrateUncompletedInboxTasks,
  generateTasksFromAutoTemplates,
} from './gameState';
