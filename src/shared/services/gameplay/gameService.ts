/**
 * Game Service
 *
 * @role 게임 관련 로직(XP, 퀘스트)을 데이터 저장소와 분리하여 처리합니다.
 * @responsibilities
 *   - XP 추가/차감 로직 위임
 *   - 퀘스트 진행 상황 업데이트 위임
 *   - Repository 계층에 대한 Facade 제공
 * @dependencies
 *   - gameRepository: XP 및 퀘스트 데이터 영속화
 */

import {
    addXP as addXPToRepo,
    spendXP as spendXPFromRepo,
    updateQuestProgress as updateQuestProgressInRepo,
} from '@/data/repositories';
export const gameService = {
    /**
     * XP를 추가합니다.
     *
     * @param {number} amount - 추가할 XP 양
     * @param {string} [blockId] - 연관된 타임블록 ID (선택)
     * @returns {Promise<GameState>} 업데이트된 게임 상태
     * @throws {Error} XP 추가 실패 시
     */
    addXP: async (amount: number, blockId?: string) => {
        try {
            const gameStateResult = await addXPToRepo(amount, blockId);
            return gameStateResult;
        } catch (xpError) {
            console.error('Failed to add XP:', xpError);
            throw xpError;
        }
    },

    /**
     * XP를 차감합니다 (상점 구매 등).
     *
     * @param {number} amount - 차감할 XP 양
     * @returns {Promise<GameState>} 업데이트된 게임 상태
     * @throws {Error} XP 부족 또는 차감 실패 시
     */
    spendXP: async (amount: number) => {
        try {
            const updatedGameState = await spendXPFromRepo(amount);
            return updatedGameState;
        } catch (spendError) {
            console.error('Failed to spend XP:', spendError);
            throw spendError;
        }
    },

    /**
     * 퀘스트 진행 상황을 업데이트합니다.
     *
     * @param {string} questType - 퀘스트 타입 ('complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks' | 'prepare_tasks' | 'use_timer')
     * @param {number} [amount=1] - 증가시킬 진행량
     * @returns {Promise<GameState>} 업데이트된 게임 상태
     * @throws {Error} 퀘스트 업데이트 실패 시
     */
    updateQuestProgress: async (questType: 'complete_tasks' | 'earn_xp' | 'lock_blocks' | 'perfect_blocks' | 'prepare_tasks' | 'use_timer', amount: number = 1) => {
        try {
            const updatedQuestState = await updateQuestProgressInRepo(questType, amount);
            return updatedQuestState;
        } catch (questError) {
            console.error('Failed to update quest progress:', questError);
            throw questError;
        }
    }
};
