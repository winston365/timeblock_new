import { useEffect, useMemo } from 'react';
import { useWaifuStore } from '../stores/waifuStore';
import { useGameStateStore } from '@/shared/stores/gameStateStore';
import {
    getMoodFromAffection,
    getDialogueFromAffection,
} from '@/data/repositories/waifuRepository';

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
