/**
 * Task Recommendation Utility
 * 
 * @role AI-based task recommendation for Focus Mode
 * @input tasks, context (time)
 * @output recommended task
 */

import type { Task } from '@/shared/types/domain';

interface RecommendationContext {
    currentTime: Date;
    remainingMinutes: number;
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

    const { remainingMinutes } = context;

    // Score each task
    const scoredTasks = incompleteTasks.map(task => {
        let score = 0;

        // 1. Time fit (prefer tasks that fit in remaining time)
        if (task.adjustedDuration <= remainingMinutes) {
            score += 30;
        } else {
            score -= 20; // Penalty for too long
        }

        // 2. Difficulty based on resistance
        if (task.resistance === 'medium') score += 20;
        else if (task.resistance === 'low') score += 15;
        else if (task.resistance === 'high') score += 10;

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
export function getRecommendationMessage(task: Task): string {
    const messages: Record<string, string[]> = {
        hard_task: [
            "도전적인 작업이네! 집중해서 해보자!",
            "중요한 거 먼저 해치워!",
            "집중력 발휘할 시간이야!"
        ],
        medium_task: [
            "이 정도면 적당할 것 같아!",
            "무난하게 시작해보자!",
            "딱 지금 하기 좋은 작업이야!"
        ],
        easy_task: [
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

    let key = 'medium_task';

    if (task.baseDuration <= 30) {
        key = 'quick_win';
    } else if (task.resistance === 'high') {
        key = 'hard_task';
    } else if (task.resistance === 'low') {
        key = 'easy_task';
    }

    const options = messages[key];
    return options[Math.floor(Math.random() * options.length)];
}
