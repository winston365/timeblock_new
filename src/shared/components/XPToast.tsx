/**
 * XPToast
 *
 * @role XP 획득 시 사용자에게 축하 메시지와 획득한 XP를 표시하는 토스트 알림 컴포넌트
 * @input xp (number), message (string, optional), onClose (function)
 * @output XP 아이콘, 메시지, 획득 XP를 표시하는 토스트 UI (3초 후 자동 사라짐)
 * @external_dependencies
 *   - React hooks (useState, useEffect): 상태 관리 및 타이머 관리
 */

import { useEffect, useState } from 'react';

interface XPToastProps {
  xp: number;
  message?: string;
  onClose: () => void;
}

/**
 * XP 획득 시 축하 메시지를 표시하는 토스트 컴포넌트
 *
 * @param {XPToastProps} props - xp, message, onClose를 포함하는 props
 * @returns {JSX.Element} 토스트 알림 UI
 * @sideEffects
 *   - 3초 후 자동으로 사라짐
 *   - 타이머를 사용하여 onClose 콜백 호출
 */
export default function XPToast({ xp, message, onClose }: XPToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 3초 후 자동 닫기
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // 애니메이션 후 완전 제거
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`
        fixed top-20 right-5 z-[9999]
        rounded-xl shadow-xl
        px-5 py-4 min-w-[280px]
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[400px]'}
      `}
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Icon with bounce animation */}
        <div className="text-[2rem] animate-bounce">✨</div>

        {/* Text content */}
        <div className="flex-1 text-white">
          <div className="text-base font-semibold mb-1">
            {message || '축하합니다!'}
          </div>
          <div
            className="text-xl font-bold"
            style={{
              color: '#ffd700',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            +{xp} XP
          </div>
        </div>
      </div>
    </div>
  );
}
