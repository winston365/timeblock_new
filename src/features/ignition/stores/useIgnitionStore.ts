import { create } from 'zustand';
import type { Task } from '@/shared/types/domain';
import { checkIgnitionAvailability } from '../utils/ignitionLimits';
import { toast } from 'react-hot-toast';

interface IgnitionState {
    isOpen: boolean;
    isSpinning: boolean;
    selectedTask: Task | null;
    microStepText: string;
    timerState: 'idle' | 'running' | 'paused' | 'completed';
    timeLeft: number; // seconds
    isBonus: boolean; // 비활동 보너스 여부

    // Actions
    openIgnition: () => void;
    closeIgnition: () => void;
    openIgnitionWithCheck: (isBonus?: boolean) => Promise<boolean>;
    startSpin: () => void;
    stopSpin: (task: Task) => void;
    setMicroStep: (text: string) => void;
    startTimer: () => void;
    pauseTimer: () => void;
    resetTimer: () => void;
    tickTimer: () => void;
}

export const useIgnitionStore = create<IgnitionState>((set) => ({
    isOpen: false,
    isSpinning: false,
    selectedTask: null,
    microStepText: '',
    timerState: 'idle',
    timeLeft: 180, // 3 minutes
    isBonus: false,

    openIgnition: () => set({ isOpen: true, isSpinning: true, timerState: 'idle', timeLeft: 180, microStepText: '', selectedTask: null }),
    closeIgnition: () => set({ isOpen: false, isSpinning: false, timerState: 'idle' }),

    openIgnitionWithCheck: async (isBonus = false) => {
        // GameStateStore import
        const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
        const { gameState, spendXP } = useGameStateStore.getState();

        // 점화 가능 여부 체크
        const check = checkIgnitionAvailability(gameState, isBonus);

        if (!check.canIgnite) {
            // 쿨다운
            if (check.reason === 'cooldown') {
                const mins = Math.ceil(check.cooldownRemaining! / 60);
                toast.error(`🕐 ${mins}분 후 사용 가능합니다`);
                return false;
            }

            // XP 부족
            if (check.reason === 'insufficient_xp') {
                toast.error('💰 XP가 부족합니다 (필요: 50 XP)');
                return false;
            }

            return false;
        }

        // XP 구매 필요 시
        if (check.requiresXP && !isBonus) {
            const confirmed = confirm(
                `점화를 ${check.requiresXP} XP로 구매하시겠습니까?\n\n` +
                `현재 XP: ${gameState?.availableXP || 0}\n` +
                `구매 후: ${(gameState?.availableXP || 0) - check.requiresXP}`
            );

            if (!confirmed) {
                return false;
            }

            // XP 차감
            try {
                await spendXP(check.requiresXP);
            } catch (error) {
                toast.error('XP 차감에 실패했습니다');
                return false;
            }
        }

        // 점화 실행
        set({
            isOpen: true,
            isSpinning: true,
            isBonus,
            timerState: 'idle',
            timeLeft: 180,
            microStepText: '',
            selectedTask: null
        });

        // GameState 업데이트 (보너스도 쿨다운 적용)
        if (gameState) {
            const { updateGameState } = await import('@/data/repositories/gameStateRepository');
            const today = new Date().toISOString().split('T')[0];

            // 날짜 변경 시 리셋
            const needsReset = gameState.lastIgnitionResetDate !== today;

            // 보너스는 횟수 차감 안 하지만 쿨다운은 적용
            await updateGameState({
                usedIgnitions: isBonus ? gameState.usedIgnitions : (needsReset ? 1 : (gameState.usedIgnitions + 1)),
                lastIgnitionTime: Date.now(), // 보너스도 쿨다운 적용
                lastIgnitionResetDate: today,
            });
        }

        return true;
    },

    startSpin: () => set({ isSpinning: true, selectedTask: null, microStepText: '' }),
    stopSpin: (task) => set({ isSpinning: false, selectedTask: task }),

    setMicroStep: (text) => set({ microStepText: text }),

    startTimer: () => set({ timerState: 'running' }),
    pauseTimer: () => set({ timerState: 'paused' }),
    resetTimer: () => set({ timerState: 'idle', timeLeft: 180 }),

    tickTimer: () => set((state) => {
        if (state.timerState !== 'running') return {};
        if (state.timeLeft <= 0) return { timerState: 'completed', timeLeft: 0 };
        return { timeLeft: state.timeLeft - 1 };
    }),
}));
