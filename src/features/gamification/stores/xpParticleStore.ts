/**
 * @file xpParticleStore.ts
 * @role XP 획득 시 파티클 애니메이션 상태 관리
 * @input 파티클 생성 좌표, XP 양
 * @output 활성 파티클 목록, 타겟 위치, 파티클 조작 함수
 * @dependencies zustand
 */

import { create } from 'zustand';

/**
 * XP 파티클 정보
 */
interface Particle {
    /** 파티클 고유 ID */
    id: string;
    /** 시작 X 좌표 */
    startX: number;
    /** 시작 Y 좌표 */
    startY: number;
    /** XP 양 */
    amount: number;
    /** 파티클 색상 (선택) */
    color?: string;
}

/**
 * XP 파티클 스토어 상태 인터페이스
 */
interface XPParticleState {
    /** 활성 파티클 목록 */
    particles: Particle[];
    /** 파티클 목적지 좌표 (XP 바 위치) */
    targetPosition: { x: number; y: number } | null;
    /** 새 파티클 생성 */
    spawnParticle: (x: number, y: number, amount: number, color?: string) => void;
    /** 파티클 제거 */
    removeParticle: (id: string) => void;
    /** 목적지 좌표 설정 */
    setTargetPosition: (x: number, y: number) => void;
}

/**
 * XP 파티클 애니메이션 상태 관리 스토어
 * @description XP 획득 시 시각적 피드백을 위한 파티클 시스템 상태 관리
 * @returns Zustand 스토어 훅
 */
export const useXPParticleStore = create<XPParticleState>((set) => ({
    particles: [],
    targetPosition: null,

    spawnParticle: (startX, startY, amount, color) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
            particles: [...state.particles, { id, startX, startY, amount, color }],
        }));
    },

    removeParticle: (id) => {
        set((state) => ({
            particles: state.particles.filter((p) => p.id !== id),
        }));
    },

    setTargetPosition: (x, y) => {
        set({ targetPosition: { x, y } });
    },
}));
