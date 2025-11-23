/**
 * Resistance Multipliers - Shared Constants (Functions Copy)
 *
 * @role 저항도(심리적 난이도)에 따른 작업 시간 배율
 * @usage Server: functions/index.js에서 require
 * @note Root의 shared/constants/resistanceMultipliers.js와 동기화 필요
 */

const RESISTANCE_MULTIPLIERS = {
    low: 1.0,    // 🟢 쉬움 - 저항도 없음
    medium: 1.3, // 🟡 보통 - 30% 추가 시간 필요
    high: 1.6,   // 🔴 어려움 - 60% 추가 시간 필요
};

const RESISTANCE_LABELS = {
    low: '쉬움',
    medium: '보통',
    high: '어려움',
};

const RESISTANCE_COLORS = {
    low: '#10b981',    // green-500
    medium: '#f59e0b', // amber-500
    high: '#ef4444',   // red-500
};

module.exports = {
    RESISTANCE_MULTIPLIERS,
    RESISTANCE_LABELS,
    RESISTANCE_COLORS,
};
