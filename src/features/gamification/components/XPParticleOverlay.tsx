/**
 * @file XPParticleOverlay.tsx
 * @role XP 획득 시 화면에 파티클 애니메이션을 표시하는 오버레이
 * @input useXPParticleStore에서 파티클 데이터
 * @output 화면 전역에 표시되는 XP 파티클 애니메이션
 * @dependencies framer-motion, xpParticleStore
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useXPParticleStore } from '@/features/gamification/stores/xpParticleStore';

export const XPParticleOverlay = () => {
    const { particles, targetPosition, removeParticle } = useXPParticleStore();

    if (!targetPosition) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
            <AnimatePresence>
                {particles.map((particle) => (
                    <Particle
                        key={particle.id}
                        particle={particle}
                        targetX={targetPosition.x}
                        targetY={targetPosition.y}
                        onComplete={() => removeParticle(particle.id)}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

const Particle = ({
    particle,
    targetX,
    targetY,
    onComplete,
}: {
    particle: { id: string; startX: number; startY: number; amount: number; color?: string };
    targetX: number;
    targetY: number;
    onComplete: () => void;
}) => {
    // Randomize path slightly for natural feel
    const randomX = (Math.random() - 0.5) * 100;
    const randomY = (Math.random() - 0.5) * 100;

    return (
        <motion.div
            initial={{
                x: particle.startX,
                y: particle.startY,
                scale: 0.5,
                opacity: 1,
            }}
            animate={{
                x: [particle.startX, particle.startX + randomX, targetX],
                y: [particle.startY, particle.startY + randomY, targetY],
                scale: [1, 1.5, 0.5],
                opacity: [1, 1, 0],
            }}
            transition={{
                duration: 0.8,
                ease: "easeInOut",
                times: [0, 0.4, 1],
            }}
            onAnimationComplete={onComplete}
            className="absolute flex items-center justify-center font-bold text-yellow-400 drop-shadow-md"
            style={{
                fontSize: '1.2rem',
                textShadow: '0 0 10px rgba(250, 204, 21, 0.8)',
            }}
        >
            <span className="mr-1">✨</span> +{particle.amount} XP
        </motion.div>
    );
};
