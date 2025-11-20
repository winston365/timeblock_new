/**
 * Task Recommendation Utility
 * 
 * @role AI-based task recommendation for Focus Mode
 * @input tasks, context (time, energy)
 * @output recommended task
 */

import type { Task } from '@/shared/types/domain';

interface RecommendationContext {
    currentTime: Date;
    remainingMinutes: number;
    currentEnergy?: number;
}

/**
 * Recommend the next best task based on context
 */
export function recommendNextTask(
    tasks: Task[],
    context: RecommendationContext
): Task | null {
    // Filter incomplete tasks only
    const incompleteTasks = tasks.filter(t => !t.completed);

    if (incompleteTasks.length === 0) return null;

    const { remainingMinutes, currentEnergy = 50 } = context;

    // Score each task
    const scoredTasks = incompleteTasks.map(task => {
        let score = 0;

        // 1. Time fit (prefer tasks that fit in remaining time)
        if (task.adjustedDuration <= remainingMinutes) {
            score += 30;
        } else {
            score -= 20; // Penalty for too long
        }

        // 2. Difficulty based on energy
        if (currentEnergy >= 70) {
            // High energy → prefer difficult tasks
            if (task.resistance === 'high') score += 25;
            else if (task.resistance === 'medium') score += 15;
        } else if (currentEnergy >= 40) {
            // Medium energy → prefer medium tasks
            if (task.resistance === 'medium') score += 25;
            else if (task.resistance === 'low') score += 15;
        } else {
            // Low energy → prefer easy tasks
            if (task.resistance === 'low') score += 30;
            else if (task.resistance === 'medium') score += 10;
            else score -= 10; // Avoid hard tasks when tired
        }

        // 3. Duration preference (shorter tasks for momentum)
        if (task.baseDuration <= 30) {
            score += 15; // Quick wins
        } else if (task.baseDuration <= 60) {
            score += 5;
        }

        // 4. Urgency (if time is running out, prioritize)
        if (remainingMinutes <= 60) {
            score += 10; // Any task completion is valuable
        }

        return { task, score };
    });

    // Sort by score (highest first)
    scoredTasks.sort((a, b) => b.score - a.score);

    return scoredTasks[0]?.task || null;
}

/**
 * Get recommendation message based on task
 */
export function getRecommendationMessage(task: Task, currentEnergy?: number): string {
    const messages: Record<string, string[]> = {
        high_energy_hard: [
            "에너지가 넘치네! 어려운 거 도전해볼까?",
            "지금 컨디션 좋은데, 중요한 거 먼저 해치워!",
            "집중력 최고조! 이거 끝내버리자!"
        ],
        medium_energy_medium: [
            "이 정도면 적당할 것 같아!",
            "무난하게 시작해보자!",
            "딱 지금 하기 좋은 작업이야!"
        ],
        low_energy_easy: [
            "가벼운 걸로 워밍업 하자!",
            "쉬운 거부터 천천히~",
            "부담 없이 시작해볼까?"
        ],
        quick_win: [
            "30분이면 끝! 빠르게 처리하자!",
            "짧고 굵게! 금방 끝날 거야!",
            "가볍게 하나 끝내고 기분 좋아지자!"
        ]
    };

    const energy = currentEnergy ?? 50;
    let key = 'medium_energy_medium';

    if (task.baseDuration <= 30) {
        key = 'quick_win';
    } else if (energy >= 70 && task.resistance === 'high') {
        key = 'high_energy_hard';
    } else if (energy < 40 && task.resistance === 'low') {
        key = 'low_energy_easy';
    }

    const options = messages[key];
    return options[Math.floor(Math.random() * options.length)];
}
