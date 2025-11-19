/**
 * Command Interface
 *
 * Represents an executable action with undo capability.
 * Used to encapsulate complex logic like "Complete Task" which involves:
 * - Optimistic Updates
 * - Repository Calls
 * - Side Effects (XP, Quests)
 * - Error Handling & Rollback
 */
export interface Command {
    execute(): Promise<void>;
    undo(): Promise<void>;
}
