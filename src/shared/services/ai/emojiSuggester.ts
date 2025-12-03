/**
 * Role: Debounced emoji suggestion pipeline that queues task titles, consults Gemini, and applies suggested emojis to tasks.
 * Dependencies:
 * - settingsRepository for feature toggles and API configuration
 * - geminiApi for emoji recommendations
 * - chatHistoryRepository for token logging
 * - unified task service for persistence and UI updates
 */
import { loadSettings } from '@/data/repositories/settingsRepository';
import { suggestTaskEmoji } from './geminiApi';
import { trackTokenUsage } from '@/shared/utils/tokenUtils';
import { updateAnyTask } from '@/shared/services/task';

type EmojiSuggestionJob = {
  taskId: string;
  taskTitle: string;
};

const suggestionQueue: EmojiSuggestionJob[] = [];
const taskTitleEmojiCache = new Map<string, string>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

const scheduleProcess = () => {
  if (debounceTimer) return;
  debounceTimer = setTimeout(runJobs, DEBOUNCE_MS);
};

async function runJobs() {
  debounceTimer = null;
  if (suggestionQueue.length === 0) return;

  const userSettings = await loadSettings().catch(() => null);
  if (!userSettings?.autoEmojiEnabled || !userSettings?.geminiApiKey) {
    suggestionQueue.length = 0;
    return;
  }

  const geminiApiKey = userSettings.geminiApiKey;
  const geminiModel = userSettings.geminiModel;

  while (suggestionQueue.length) {
    const queuedJob = suggestionQueue.shift()!;
    const cachedEmoji = taskTitleEmojiCache.get(queuedJob.taskTitle);
    if (cachedEmoji) {
      applyEmoji(queuedJob.taskId, cachedEmoji);
      continue;
    }

    try {
      const { emoji: suggestedEmoji, tokenUsage } = await suggestTaskEmoji(
        queuedJob.taskTitle,
        geminiApiKey,
        geminiModel
      );
      const trimmedEmoji = suggestedEmoji.trim();
      trackTokenUsage(tokenUsage);
      if (trimmedEmoji) {
        taskTitleEmojiCache.set(queuedJob.taskTitle, trimmedEmoji);
        applyEmoji(queuedJob.taskId, trimmedEmoji);
      }
    } catch (suggestionError) {
      console.error('[EmojiSuggester] Failed to suggest emoji:', suggestionError);
    }
  }
}

/**
 * 이모지를 작업에 적용합니다.
 * 통합 Task 서비스를 사용하여 저장소 위치 자동 감지 + UI 실시간 반영
 */
function applyEmoji(taskId: string, emoji: string) {
  updateAnyTask(taskId, { emoji }).catch(applyError => {
    console.error('[EmojiSuggester] Failed to apply emoji:', applyError);
  });
}

/**
 * 작업 제목 기반 이모지 추천을 큐에 추가합니다. 토글이 꺼져 있으면 내부에서 무시합니다.
 * @param taskId 작업 식별자
 * @param taskTitle 작업 제목 텍스트
 */
export function scheduleEmojiSuggestion(taskId: string, taskTitle: string) {
  if (!taskTitle) return;
  suggestionQueue.push({ taskId, taskTitle });
  scheduleProcess();
}
