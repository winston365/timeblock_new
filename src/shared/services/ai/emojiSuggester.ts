import { loadSettings } from '@/data/repositories/settingsRepository';
import { suggestTaskEmoji } from './geminiApi';
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';
import { addTokenUsage } from '@/data/repositories/chatHistoryRepository';
import { updateInboxTask } from '@/data/repositories/inboxRepository';
import { useInboxStore } from '@/shared/stores/inboxStore';

type Job = {
  taskId: string;
  text: string;
};

const queue: Job[] = [];
const cache = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

const scheduleProcess = () => {
  if (timer) return;
  timer = setTimeout(runJobs, DEBOUNCE_MS);
};

async function runJobs() {
  timer = null;
  if (queue.length === 0) return;

  const settings = await loadSettings().catch(() => null);
  if (!settings?.autoEmojiEnabled || !settings?.geminiApiKey) {
    queue.length = 0;
    return;
  }

  const apiKey = settings.geminiApiKey;
  const model = settings.geminiModel;

  while (queue.length) {
    const job = queue.shift()!;
    const cached = cache.get(job.text);
    if (cached) {
      applyEmoji(job.taskId, cached);
      continue;
    }

    try {
      const { emoji, tokenUsage } = await suggestTaskEmoji(job.text, apiKey, model);
      const trimmed = emoji.trim();
      if (tokenUsage) {
        addTokenUsage(tokenUsage.promptTokens, tokenUsage.candidatesTokens).catch(console.error);
      }
      if (trimmed) {
        cache.set(job.text, trimmed);
        applyEmoji(job.taskId, trimmed);
      }
    } catch (err) {
      console.error('[EmojiSuggester] Failed to suggest emoji:', err);
    }
  }
}

function applyEmoji(taskId: string, emoji: string) {
  const store = useDailyDataStore.getState();
  const hasInDaily =
    store.dailyData?.tasks?.some(t => t.id === taskId) ?? false;

  const applyToDaily = () =>
    store.updateTask(taskId, { emoji }, { skipBehaviorTracking: true, skipEmoji: true });
  const applyToInbox = () =>
    updateInboxTask(taskId, { emoji })
      .then(() => {
        // 인박스 스토어 상태도 최신화
        const inboxStore = useInboxStore.getState();
        inboxStore.loadData().catch(() => {});
      })
      .catch(err => {
        console.error('[EmojiSuggester] Failed to apply emoji to inbox task:', err);
      });

  if (hasInDaily) {
    applyToDaily().catch(err => {
      console.error('[EmojiSuggester] Failed to apply emoji (dailyData):', err);
    });
  } else {
    applyToInbox();
  }
}

/**
 * 작업 제목 기반 이모지 추천을 큐에 추가합니다.
 * 토글이 꺼져 있으면 내부에서 무시합니다.
 */
export function scheduleEmojiSuggestion(taskId: string, text: string) {
  if (!text) return;
  queue.push({ taskId, text });
  scheduleProcess();
}
