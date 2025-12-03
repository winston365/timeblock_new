/**
 * DamageFloatingText - 데미지 플로팅 텍스트 컴포넌트
 *
 * @role 공격 시 데미지 수치를 화면에 떠오르는 애니메이션으로 표시
 * @description 데미지 값이 위로 떠오르며 페이드아웃되는 효과
 */

import { useEffect, useState } from 'react';

interface DamageFloatingTextProps {
  damage: number;
  onComplete?: () => void;
}

export function DamageFloatingText({ damage, onComplete }: DamageFloatingTextProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
      aria-hidden="true"
    >
      <div
        className="animate-damage-float text-center"
        style={{
          animation: 'damageFloat 1s ease-out forwards',
        }}
      >
        <span
          className="text-4xl font-black text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]"
          style={{
            textShadow: '0 0 20px rgba(239, 68, 68, 0.8), 2px 2px 0 #000, -2px -2px 0 #000',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          -{damage}분!
        </span>
      </div>
      <style>{`
        @keyframes damageFloat {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          20% {
            transform: translateY(-10px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translateY(-80px) scale(0.8);
          }
        }
      `}</style>
    </div>
  );
}
