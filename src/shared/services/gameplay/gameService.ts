import {
    addXP as addXPToRepo,
    spendXP as spendXPFromRepo,
    updateQuestProgress as updateQuestProgressInRepo,
} from '@/data/repositories';

/**
 * GameService
 *
 * Handles game-related logic (XP, Quests) to decouple it from data stores.
 * Now purely returns results/events for the caller (Store) to handle.
 */
export const gameService = {
    /**
     * Add XP
     */
    addXP: async (amount: number, blockId?: string) => {
        try {
            const result = await addXPToRepo(amount, blockId);
            return result;
        } catch (error) {
            console.error('Failed to add XP:', error);
            throw error;
        }
    },

    /**
     * Spend XP
     */
    spendXP: async (amount: number) => {
        try {
            const updatedState = await spendXPFromRepo(amount);
            return updatedState;
        } catch (error) {
            console.error('Failed to spend XP:', error);
            throw error;
        }
    },

    /**
     * Update Quest Progress
     */
    updateQuestProgress: async (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks' | 'prepare_tasks' | 'use_timer', amount: number = 1) => {
        try {
            const updatedState = await updateQuestProgressInRepo(questType, amount);
            return updatedState;
        } catch (error) {
            console.error('Failed to update quest progress:', error);
            throw error;
        }
    }
};
