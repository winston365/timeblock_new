/**
 * Resistance Multipliers - Shared Constants
 *
 * @role 저항도(심리적 난이도)에 따른 작업 시간 배율
 * @usage
 *   - Client: src/shared/types/domain.ts에서 import
 *   - Server: functions/index.js에서 require
 * @sync Keep in sync with both client and server implementations
 */

/**
 * 저항도 배율 상수
 *
 * @type {Object.<string, number>}
 * @property {number} low - 쉬운 작업 (1.0배)
 * @property {number} medium - 보통 난이도 작업 (1.3배)
 * @property {number} high - 어려운 작업 (1.6배)
 *
 * @example
 * const adjustedDuration = baseDuration * RESISTANCE_MULTIPLIERS[resistance];
 * // baseDuration: 60분, resistance: 'high'
 * // adjustedDuration: 60 * 1.6 = 96분
 */
const RESISTANCE_MULTIPLIERS = {
  low: 1.0,    // 🟢 쉬움 - 저항도 없음
  medium: 1.3, // 🟡 보통 - 30% 추가 시간 필요
  high: 1.6,   // 🔴 어려움 - 60% 추가 시간 필요
};

/**
 * 저항도 타입 정의 (TypeScript 호환용)
 * @typedef {'low' | 'medium' | 'high'} Resistance
 */

/**
 * 저항도 레이블 (UI 표시용)
 */
const RESISTANCE_LABELS = {
  low: '쉬움',
  medium: '보통',
  high: '어려움',
};

/**
 * 저항도 색상 (UI 표시용)
 */
const RESISTANCE_COLORS = {
  low: '#10b981',    // green-500
  medium: '#f59e0b', // amber-500
  high: '#ef4444',   // red-500
};

// CommonJS export (Node.js / Firebase Functions)
module.exports = {
  RESISTANCE_MULTIPLIERS,
  RESISTANCE_LABELS,
  RESISTANCE_COLORS,
};

// ES Module export (optional, for modern environments)
if (typeof exports !== 'undefined') {
  exports.RESISTANCE_MULTIPLIERS = RESISTANCE_MULTIPLIERS;
  exports.RESISTANCE_LABELS = RESISTANCE_LABELS;
  exports.RESISTANCE_COLORS = RESISTANCE_COLORS;
}
