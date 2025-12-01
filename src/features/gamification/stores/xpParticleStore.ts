/**
 * @file xpParticleStore.ts
 * @role XP 획득 시 파티클 애니메이션 상태 관리
 * @input 파티클 생성 좌표, XP 양
 * @output 활성 파티클 목록, 타겟 위치, 파티클 조작 함수
 * @dependencies zustand
 */

import { create } from 'zustand';

interface Particle {
    id: string;
    startX: number;
    startY: number;
    amount: number;
    color?: string;
}

interface XPParticleState {
    particles: Particle[];
    targetPosition: { x: number; y: number } | null;
    spawnParticle: (x: number, y: number, amount: number, color?: string) => void;
    removeParticle: (id: string) => void;
    setTargetPosition: (x: number, y: number) => void;
}

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
