/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file useIgnitionStore.ts
 * @role 점화 시스템 상태 관리 Zustand 스토어
 * @input 사용자 상호작용, 설정값, 게임 상태
 * @output 점화 UI 상태, 스피너/타이머 상태, 히스토리
 * @dependencies zustand, gameStateRepository, settingsStore
 */

import { create } from 'zustand';
import type { GameState, Task } from '@/shared/types/domain';
import { checkIgnitionAvailability } from '../utils/ignitionLimits';
import { toast } from 'react-hot-toast';
import { useSettingsStore } from '@/shared/stores/settingsStore';
import { SETTING_DEFAULTS } from '@/shared/constants/defaults';

/**
 * 점화 시스템 상태 인터페이스
 */
interface IgnitionState {
    /** 점화 오버레이 열림 상태 */
    isOpen: boolean;
    /** 스피너 회전 중 여부 */
    isSpinning: boolean;
    /** 선택된 작업 */
    selectedTask: Task | null;
    /** AI 생성 마이크로스텝 텍스트 */
    microStepText: string;
    /** 타이머 상태 */
    timerState: 'idle' | 'running' | 'paused' | 'completed';
    /** 남은 시간 (초) */
    timeLeft: number;
    /** 비활동 보너스 여부 */
    isBonus: boolean;

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
    /** 점화 히스토리 */
    history: Task[];
    /** 히스토리에 작업 추가 */
    addToHistory: (task: Task, source?: 'normal' | 'bonus') => Promise<void>;
}

/**
 * 점화 시스템 Zustand 스토어
 * 스피너/타이머 상태, 선택된 작업, 히스토리 관리
 *
 * @returns 점화 상태 및 액션
 */
export const useIgnitionStore = create<IgnitionState>((set) => {
    // 초기 로드 시 persisted 히스토리 불러오기 (Dexie -> gameState)
    (async () => {
        try {
            const { loadGameState } = await import('@/data/repositories/gameStateRepository');
            const persisted = await loadGameState();
            const persistedHistory = (persisted as any).ignitionHistory || [];
            if (persistedHistory.length > 0) {
                set({ history: persistedHistory.slice(0, 10) });
            }
        } catch (error) {
            console.error('[IgnitionStore] Failed to load ignition history:', error);
        }
    })();

    return {
        isOpen: false,
        isSpinning: false,
        selectedTask: null,
        microStepText: '',
        timerState: 'idle',
        timeLeft: (useSettingsStore.getState().settings?.ignitionDurationMinutes ?? SETTING_DEFAULTS.ignitionDurationMinutes) * 60,
        isBonus: false,

        openIgnition: () => {
            const duration = (useSettingsStore.getState().settings?.ignitionDurationMinutes ?? SETTING_DEFAULTS.ignitionDurationMinutes) * 60;
            set({ isOpen: true, isSpinning: false, timerState: 'idle', timeLeft: duration, microStepText: '', selectedTask: null });
        },
        closeIgnition: () => set({ isOpen: false, isSpinning: false, timerState: 'idle' }),

        openIgnitionWithCheck: async (isBonus = false) => {
            // GameStateStore import
            const { useGameStateStore } = await import('@/shared/stores/gameStateStore');
            const { gameState, spendXP } = useGameStateStore.getState();
            const { settings } = useSettingsStore.getState();

            // 점화 가능 여부 체크 - 중앙화된 기본값 사용
            const cooldownMinutes = isBonus
                ? (settings?.justDoItCooldownMinutes ?? SETTING_DEFAULTS.justDoItCooldownMinutes)
                : (settings?.ignitionCooldownMinutes ?? SETTING_DEFAULTS.ignitionCooldownMinutes);

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
            const duration = (settings?.ignitionDurationMinutes ?? SETTING_DEFAULTS.ignitionDurationMinutes) * 60;
            set({
                isOpen: true,
                isSpinning: false,
                isBonus,
                timerState: 'idle',
                timeLeft: duration,
                microStepText: '',
                selectedTask: null
            });

            // GameState 업데이트
            if (gameState) {
                const { updateGameState } = await import('@/data/repositories/gameStateRepository');
                const today = new Date().toISOString().split('T')[0];

                // 날짜 변경 시 리셋
                const needsReset = gameState.lastIgnitionResetDate !== today;

                const updatePayload: Partial<GameState> = {
                    lastIgnitionResetDate: today,
                };

                // 보너스와 일반 점화의 타임스탬프를 각각 업데이트
                if (isBonus) {
                    updatePayload.lastBonusIgnitionTime = Date.now();
                } else {
                    updatePayload.usedIgnitions = needsReset ? 1 : (gameState.usedIgnitions + 1);
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
            const duration = (useSettingsStore.getState().settings?.ignitionDurationMinutes ?? SETTING_DEFAULTS.ignitionDurationMinutes) * 60;
            set({ timerState: 'idle', timeLeft: duration });
        },

        tickTimer: () => set((state) => {
            if (state.timerState !== 'running') return {};
            if (state.timeLeft <= 0) return { timerState: 'completed', timeLeft: 0 };
            return { timeLeft: state.timeLeft - 1 };
        }),

        history: [],
        addToHistory: async (task: Task, source: 'normal' | 'bonus' = 'normal') => {
            const { updateGameState, loadGameState } = await import('@/data/repositories/gameStateRepository');
            const { useGameStateStore } = await import('@/shared/stores/gameStateStore');

            // 최신 gameState 기준으로 병합 (fallback: store/loaded state)
            const currentState = useGameStateStore.getState().gameState || await loadGameState();
            const existingHistory = (currentState as any).ignitionHistory || [];

            const entry = { ...task, source };
            const newHistory = [entry, ...existingHistory].slice(0, 10);

            set({ history: newHistory });

            // 영구 저장 + 전역 gameState 동기화
            const updated = await updateGameState({ ignitionHistory: newHistory });
            useGameStateStore.setState({ gameState: updated });
        },
    };
});
