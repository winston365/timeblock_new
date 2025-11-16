/**
 * XPToast
 *
 * @role XP 획득 시 사용자에게 축하 메시지와 획득한 XP를 표시하는 토스트 알림 컴포넌트
 * @input xp (number), message (string, optional), onClose (function)
 * @output XP 아이콘, 메시지, 획득 XP를 표시하는 토스트 UI (3초 후 자동 사라짐)
 * @external_dependencies
 *   - React hooks (useState, useEffect): 상태 관리 및 타이머 관리
 *   - XPToast.css: 스타일시트 및 애니메이션
 */

import { useEffect, useState } from 'react';
import './XPToast.css';

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
    <div className={`xp-toast ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="xp-toast-content">
        <div className="xp-toast-icon">✨</div>
        <div className="xp-toast-text">
          <div className="xp-toast-title">
            {message || '축하합니다!'}
          </div>
          <div className="xp-toast-xp">
            +{xp} XP
          </div>
        </div>
      </div>
    </div>
  );
}
