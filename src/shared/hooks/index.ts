/**
 * 공통 훅 통합 export
 *
 * @role 모든 커스텀 훅을 중앙에서 관리하고 재배포
 * @input 없음
 * @output 모든 커스텀 훅 export
 * @external_dependencies
 *   - useDailyData: 일일 데이터 관리 훅
 *   - useGameState: 게임 상태 관리 훅
 *   - useWaifuState: 와이푸 상태 관리 훅
 *   - useEnergyState: 에너지 상태 관리 훅
 *   - useKeyboardNavigation: 키보드 네비게이션 훅
 */

export * from './useDailyData';
export * from './useGameState';
export * from './useWaifuState';
export * from './useEnergyState';
export * from './useKeyboardNavigation';
// DEPRECATED: usePersonaContext는 성능 최적화를 위해 buildPersonaContext()로 대체됨
// export * from './usePersonaContext';
