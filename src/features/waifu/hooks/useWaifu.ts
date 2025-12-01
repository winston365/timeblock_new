/**
 * @file useWaifu.ts
 *
 * @description 와이푸 상태 및 파생 데이터를 제공하는 React 훅
 *
 * @role 와이푸 상태 훅 - 컴포넌트에서 와이푸 데이터 접근
 *
 * @responsibilities
 *   - 와이푸 상태 초기 로드
 *   - XP 변경 시 호감도 동기화
 *   - 현재 기분/대사 파생 데이터 제공
 *   - 와이푸 액션 (onTaskComplete, onInteract 등) 노출
 *
 * @dependencies
 *   - waifuStore: 와이푸 상태 스토어
 *   - gameStateStore: 게임 상태 (XP) 스토어
 *   - waifuRepository: 기분/대사 유틸리티
 */

import { useEffect, useMemo } from 'react';
import { useWaifuStore } from '../stores/waifuStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import {
    getMoodFromAffection,
    getDialogueFromAffection,
} from '@/data/repositories/waifuRepository';

/**
 * 와이푸 상태 및 파생 데이터를 제공하는 React 훅
 *
 * @returns 와이푸 상태, 로딩 상태, 에러, 현재 기분/대사, 액션 함수들
 * @sideEffects
 *   - 초기 마운트 시 와이푸 데이터 로드
 *   - XP 변경 시 호감도 동기화
 */
export function useWaifu() {
    const {
        waifuState,
        loading,
        error,
        loadData,
        onTaskComplete,
        onInteract,
        resetDaily,
        syncWithXP,
    } = useWaifuStore();

    const gameState = useGameStateStore((state) => state.gameState);

    // Initial load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Sync affection when XP changes
    useEffect(() => {
        if (gameState?.availableXP !== undefined) {
            syncWithXP();
        }
    }, [gameState?.availableXP, syncWithXP]);

    // Derived state
    const currentMood = waifuState ? getMoodFromAffection(waifuState.affection) : '😐 보통';

    const dialogueObj = useMemo(() => {
        return waifuState
            ? getDialogueFromAffection(waifuState.affection, waifuState.tasksCompletedToday)
            : { text: '안녕하세요!' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waifuState?.affection, waifuState?.tasksCompletedToday]);

    const currentDialogue = dialogueObj.text;
    const currentAudio = dialogueObj.audio;

    return {
        waifuState,
        loading,
        error,
        refresh: loadData,
        onTaskComplete,
        onInteract,
        resetDaily,
        currentMood,
        currentDialogue,
        currentAudio,
    };
}
