import { create } from 'zustand';
import type { Task } from '@/shared/types/domain';
import { checkIgnitionAvailability } from '../utils/ignitionLimits';
import { toast } from 'react-hot-toast';
import { useSettingsStore } from '@/shared/stores/settingsStore';

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
    setSelectedTask: (task: Task | null) => void;
    history: Task[];
    addToHistory: (task: Task) => void;
}

export const useIgnitionStore = create<IgnitionState>((set) => ({
    isOpen: false,
    isSpinning: false,
    selectedTask: null,
    microStepText: '',
    timerState: 'idle',
    timeLeft: (useSettingsStore.getState().settings?.ignitionDurationMinutes ?? 3) * 60,
    isBonus: false,

    openIgnition: () => {
        const duration = (useSettingsStore.getState().settings?.ignitionDurationMinutes ?? 3) * 60;
        set({ isOpen: true, isSpinning: false, timerState: 'idle', timeLeft: duration, microStepText: '', selectedTask: null });
    },
    closeIgnition: () => set({ isOpen: false, isSpinning: false, timerState: 'idle' }),

    openIgnitionWithCheck: async (isBonus = false) => {
        // GameStateStore import
        const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
        const { gameState, spendXP } = useGameStateStore.getState();
        const { settings } = useSettingsStore.getState();

        // 점화 가능 여부 체크
        const cooldownMinutes = isBonus
            ? (settings?.justDoItCooldownMinutes ?? 1)
            : (settings?.ignitionCooldownMinutes ?? 30);

        const check = checkIgnitionAvailability(gameState, isBonus, {
            cooldownMinutes: cooldownMinutes,
            xpCost: settings?.ignitionXPCost,
        });

        if (!check.canIgnite) {
            // 쿨다운
            if (check.reason === 'cooldown') {
                const mins = Math.ceil(check.cooldownRemaining! / 60);
                toast.error(`🕐 ${mins}분 후 사용 가능합니다`);
                return false;
            }

            // XP 부족
            if (check.reason === 'insufficient_xp') {
                toast.error(`💰 XP가 부족합니다 (필요: ${check.requiresXP} XP)`);
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
        const duration = (settings?.ignitionDurationMinutes ?? 3) * 60;
        set({
            isOpen: true,
            isSpinning: false,
            isBonus,
            timerState: 'idle',
            timeLeft: duration,
            microStepText: '',
            selectedTask: null
        });

        // GameState 업데이트 (보너스는 메인 쿨다운/횟수에 영향 없음)
        if (gameState) {
            const { updateGameState } = await import('@/data/repositories/gameStateRepository');
            const today = new Date().toISOString().split('T')[0];

            // 날짜 변경 시 리셋
            const needsReset = gameState.lastIgnitionResetDate !== today;

            const updatePayload: {
                usedIgnitions: number;
                lastIgnitionResetDate: string;
                lastIgnitionTime?: number;
            } = {
                usedIgnitions: isBonus ? gameState.usedIgnitions : (needsReset ? 1 : (gameState.usedIgnitions + 1)),
                lastIgnitionResetDate: today,
            };

            // 보너스는 메인 쿨다운 타임스탬프에 영향을 주지 않는다
            if (!isBonus) {
                updatePayload.lastIgnitionTime = Date.now();
            }

            const updated = await updateGameState(updatePayload);

            // Store 상태도 즉시 갱신해서 다음 클릭에 쿨다운/횟수 적용이 바로 반영되도록 한다
            useGameStateStore.setState({ gameState: updated });
        }

        return true;
    },

    startSpin: () => set({ isSpinning: true, selectedTask: null, microStepText: '' }),
    stopSpin: (task) => set({ isSpinning: false, selectedTask: task }),

    setMicroStep: (text) => set({ microStepText: text }),
    setSelectedTask: (task) => set({ selectedTask: task }),

    startTimer: () => set({ timerState: 'running' }),
    pauseTimer: () => set({ timerState: 'paused' }),
    resetTimer: () => {
        const duration = (useSettingsStore.getState().settings?.ignitionDurationMinutes ?? 3) * 60;
        set({ timerState: 'idle', timeLeft: duration });
    },

    tickTimer: () => set((state) => {
        if (state.timerState !== 'running') return {};
        if (state.timeLeft <= 0) return { timerState: 'completed', timeLeft: 0 };
        return { timeLeft: state.timeLeft - 1 };
    }),

    history: [],
    addToHistory: (task: Task) => set((state) => {
        const newHistory = [task, ...state.history].slice(0, 5);
        return { history: newHistory };
    }),
}));
