/**
 * Chat History 저장소
 * Gemini 채팅 히스토리 및 토큰 사용량 관리
 */

import { db } from '../db/dexieClient';
import type { ChatHistory, DailyTokenUsage, GeminiChatMessage } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { addSyncLog } from '@/shared/services/syncLogger';
import {
  syncChatHistoryToFirebase,
  syncTokenUsageToFirebase,
  isFirebaseInitialized
} from '@/shared/services/firebaseService';

// ============================================================================
// Chat History CRUD
// ============================================================================

/**
 * 오늘 날짜의 채팅 히스토리 로드
 */
export async function loadTodayChatHistory(): Promise<GeminiChatMessage[]> {
  try {
    const date = getLocalDate();
    const history = await db.chatHistory.get(date);
    return history?.messages || [];
  } catch (error) {
    console.error('Failed to load chat history:', error);
    return [];
  }
}

/**
 * 특정 날짜의 채팅 히스토리 로드
 */
export async function loadChatHistory(date: string): Promise<GeminiChatMessage[]> {
  try {
    const history = await db.chatHistory.get(date);
    return history?.messages || [];
  } catch (error) {
    console.error(`Failed to load chat history for ${date}:`, error);
    return [];
  }
}

/**
 * 채팅 히스토리 저장 (전체 교체)
 */
export async function saveChatHistory(
  messages: GeminiChatMessage[],
  date: string = getLocalDate()
): Promise<void> {
  try {
    const chatHistory: ChatHistory = {
      date,
      messages,
      updatedAt: Date.now(),
    };

    await db.chatHistory.put(chatHistory);

    addSyncLog('dexie', 'save', `Chat history saved for ${date}`, {
      messageCount: messages.length,
    });

    console.log(`✅ Chat history saved for ${date} (${messages.length} messages)`);

    // Auto-sync to Firebase
    if (isFirebaseInitialized()) {
      syncChatHistoryToFirebase(date, chatHistory).catch(err => {
        console.error('Firebase chat history sync failed, but local save succeeded:', err);
      });
    }
  } catch (error) {
    console.error('Failed to save chat history:', error);
    throw error;
  }
}

/**
 * 메시지 추가
 */
export async function addChatMessage(
  message: GeminiChatMessage,
  date: string = getLocalDate()
): Promise<void> {
  try {
    const messages = await loadChatHistory(date);
    messages.push(message);
    await saveChatHistory(messages, date);
  } catch (error) {
    console.error('Failed to add chat message:', error);
    throw error;
  }
}

/**
 * 최근 N개 메시지 가져오기 (20개 제한)
 */
export async function getRecentMessages(
  limit: number = 20,
  date: string = getLocalDate()
): Promise<GeminiChatMessage[]> {
  try {
    const messages = await loadChatHistory(date);
    // 최근 메시지부터 limit 개수만큼 반환
    return messages.slice(-limit);
  } catch (error) {
    console.error('Failed to get recent messages:', error);
    return [];
  }
}

/**
 * 채팅 히스토리 삭제
 */
export async function deleteChatHistory(date: string): Promise<void> {
  try {
    await db.chatHistory.delete(date);
    console.log(`✅ Chat history deleted for ${date}`);
  } catch (error) {
    console.error('Failed to delete chat history:', error);
    throw error;
  }
}

// ============================================================================
// Token Usage CRUD
// ============================================================================

/**
 * 오늘 토큰 사용량 로드
 */
export async function loadTodayTokenUsage(): Promise<DailyTokenUsage | null> {
  try {
    const date = getLocalDate();
    const result = await db.dailyTokenUsage.get(date);
    return result || null;
  } catch (error) {
    console.error('Failed to load token usage:', error);
    return null;
  }
}

/**
 * 특정 날짜의 토큰 사용량 로드
 */
export async function loadTokenUsage(date: string): Promise<DailyTokenUsage | null> {
  try {
    const result = await db.dailyTokenUsage.get(date);
    return result || null;
  } catch (error) {
    console.error(`Failed to load token usage for ${date}:`, error);
    return null;
  }
}

/**
 * 토큰 사용량 추가 (누적)
 */
export async function addTokenUsage(
  promptTokens: number,
  candidatesTokens: number,
  date: string = getLocalDate()
): Promise<void> {
  try {
    const existing = await loadTokenUsage(date);

    const tokenUsage: DailyTokenUsage = {
      date,
      promptTokens: (existing?.promptTokens || 0) + promptTokens,
      candidatesTokens: (existing?.candidatesTokens || 0) + candidatesTokens,
      totalTokens: (existing?.totalTokens || 0) + promptTokens + candidatesTokens,
      messageCount: (existing?.messageCount || 0) + 1,
      updatedAt: Date.now(),
    };

    await db.dailyTokenUsage.put(tokenUsage);

    addSyncLog('dexie', 'save', `Token usage updated for ${date}`, {
      promptTokens: tokenUsage.promptTokens,
      candidatesTokens: tokenUsage.candidatesTokens,
      totalTokens: tokenUsage.totalTokens,
    });

    console.log(`✅ Token usage updated for ${date}`);

    // Auto-sync to Firebase
    if (isFirebaseInitialized()) {
      syncTokenUsageToFirebase(date, tokenUsage).catch(err => {
        console.error('Firebase token usage sync failed, but local save succeeded:', err);
      });
    }
  } catch (error) {
    console.error('Failed to add token usage:', error);
    throw error;
  }
}

/**
 * 모든 토큰 사용량 로드 (날짜별)
 */
export async function loadAllTokenUsage(): Promise<DailyTokenUsage[]> {
  try {
    return await db.dailyTokenUsage.toArray();
  } catch (error) {
    console.error('Failed to load all token usage:', error);
    return [];
  }
}

/**
 * 특정 기간의 토큰 사용량 로드
 */
export async function loadTokenUsageRange(
  startDate: string,
  endDate: string
): Promise<DailyTokenUsage[]> {
  try {
    return await db.dailyTokenUsage
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  } catch (error) {
    console.error('Failed to load token usage range:', error);
    return [];
  }
}
