/**
 * Chat History Repository
 *
 * @role Gemini 채팅 메시지 히스토리 및 토큰 사용량 관리
 * @input GeminiChatMessage 객체, 토큰 사용량, 날짜 문자열
 * @output ChatHistory 객체, GeminiChatMessage 배열, DailyTokenUsage 객체
 * @external_dependencies
 *   - IndexedDB (db.chatHistory, db.dailyTokenUsage): 메인 저장소
 *   - Firebase: 실시간 동기화 (syncToFirebase)
 *   - @/shared/types/domain: ChatHistory, DailyTokenUsage, GeminiChatMessage 타입
 */

import { db } from '../db/dexieClient';
import type { ChatHistory, DailyTokenUsage, GeminiChatMessage } from '@/shared/types/domain';
import { getLocalDate } from '@/shared/lib/utils';
import { addSyncLog } from '@/shared/services/sync/syncLogger';
import { isFirebaseInitialized } from '@/shared/services/sync/firebaseService';
import { syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { chatHistoryStrategy, tokenUsageStrategy } from '@/shared/services/sync/firebase/strategies';

// ============================================================================
// Chat History CRUD
// ============================================================================

/**
 * 오늘 날짜의 채팅 히스토리 로드
 *
 * @returns {Promise<GeminiChatMessage[]>} 오늘의 메시지 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
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
 *
 * @param {string} date - 조회할 날짜
 * @returns {Promise<GeminiChatMessage[]>} 메시지 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
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
 *
 * @param {GeminiChatMessage[]} messages - 저장할 메시지 배열
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 저장 실패 시
 * @sideEffects
 *   - IndexedDB에 데이터 저장
 *   - Firebase에 비동기 동기화
 *   - syncLogger에 로그 기록
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


    // Auto-sync to Firebase
    if (isFirebaseInitialized()) {
      syncToFirebase(chatHistoryStrategy, chatHistory, date).catch(err => {
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
 *
 * @param {GeminiChatMessage} message - 추가할 메시지 객체
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} 로드 또는 저장 실패 시
 * @sideEffects
 *   - 기존 메시지 배열에 새 메시지 추가
 *   - saveChatHistory 호출
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
 *
 * @param {number} [limit=20] - 조회할 메시지 개수
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<GeminiChatMessage[]>} 최근 메시지 배열
 * @throws 없음
 * @sideEffects
 *   - loadChatHistory 호출
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
 *
 * @param {string} date - 삭제할 날짜
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 삭제 실패 시
 * @sideEffects
 *   - IndexedDB에서 데이터 삭제
 */
export async function deleteChatHistory(date: string): Promise<void> {
  try {
    await db.chatHistory.delete(date);
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
 *
 * @returns {Promise<DailyTokenUsage | null>} 오늘의 토큰 사용량 또는 null
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
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
 *
 * @param {string} date - 조회할 날짜
 * @returns {Promise<DailyTokenUsage | null>} 토큰 사용량 또는 null
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 데이터 조회
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
 *
 * @param {number} promptTokens - 프롬프트 토큰 수
 * @param {number} candidatesTokens - 응답 토큰 수
 * @param {string} [date] - 날짜 (기본값: 오늘)
 * @returns {Promise<void>}
 * @throws {Error} IndexedDB 저장 실패 시
 * @sideEffects
 *   - 기존 토큰 사용량에 누적
 *   - IndexedDB에 저장
 *   - Firebase에 비동기 동기화
 *   - syncLogger에 로그 기록
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


    // Auto-sync to Firebase
    if (isFirebaseInitialized()) {
      syncToFirebase(tokenUsageStrategy, tokenUsage, date).catch(err => {
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
 *
 * @returns {Promise<DailyTokenUsage[]>} 모든 날짜의 토큰 사용량 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 전체 데이터 조회
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
 *
 * @param {string} startDate - 시작 날짜
 * @param {string} endDate - 종료 날짜
 * @returns {Promise<DailyTokenUsage[]>} 기간 내 토큰 사용량 배열
 * @throws 없음
 * @sideEffects
 *   - IndexedDB에서 범위 조회
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
