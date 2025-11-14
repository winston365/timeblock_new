/**
 * XPToast - XP 획득 시 축하 메시지 표시
 */

import { useEffect, useState } from 'react';
import './XPToast.css';

interface XPToastProps {
  xp: number;
  message?: string;
  onClose: () => void;
}

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
