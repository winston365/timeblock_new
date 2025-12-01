/**
 * 차트 색상 팔레트 유틸리티
 * 
 * @role 타임블록별 일관된 색상 제공
 * @description 모든 통계 차트에서 동일한 색상 팔레트를 사용하여 시각적 일관성 확보
 */

/**
 * 타임블록별 고정 색상 팔레트
 * HSL 기반으로 명도와 채도를 조정하여 접근성과 가독성 확보
 */
export const BLOCK_COLORS: Record<string, string> = {
    '5-8': '#FF6B6B',   // 새벽/아침 - 밝은 빨강 (활력)
    '8-11': '#4ECDC4',  // 오전 - 청록색 (집중)
    '11-14': '#45B7D1', // 점심 - 파랑 (안정)
    '14-17': '#FFA07A', // 오후 - 연한 주황 (생산성)
    '17-20': '#98D8C8', // 저녁 - 민트 (휴식 전환)
    '20-23': '#95E1D3', // 밤 - 연두 (마무리)
    'other': '#A0A0A0'  // 기타 (23:00-05:00) - 회색
};

/**
 * 타임블록 색상 가져오기 (fallback 포함)
 * 
 * @param blockId - 타임블록 ID
 * @param opacity - 불투명도 (0-1), 기본값 1
 * @returns CSS 색상 값 (hex 또는 rgba)
 */
export function getBlockColor(blockId: string, opacity: number = 1): string {
    const baseColor = BLOCK_COLORS[blockId] || BLOCK_COLORS.other;

    if (opacity === 1) {
        return baseColor;
    }

    // Hex to RGBA 변환
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * 모든 타임블록 색상 배열로 반환
 * Recharts의 색상 배열로 사용 가능
 * @returns 타임블록 색상 배열
 */
export function getAllBlockColors(): string[] {
    return ['5-8', '8-11', '11-14', '14-17', '17-20', '20-23', 'other']
        .map(id => BLOCK_COLORS[id]);
}

/**
 * 차트용 그라데이션 색상 생성
 * 
 * @param blockId - 타임블록 ID
 * @returns 그라데이션 CSS 문자열
 */
export function getBlockGradient(blockId: string): string {
    const baseColor = BLOCK_COLORS[blockId] || BLOCK_COLORS.other;
    // 약간 어두운 버전 생성 (그라데이션 효과)
    return `linear-gradient(135deg, ${baseColor} 0%, ${baseColor}dd 100%)`;
}
