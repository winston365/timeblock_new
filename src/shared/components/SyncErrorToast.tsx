/**
 * SyncErrorToast
 *
 * @role Firebase 동기화 오류 발생 시 사용자에게 알림을 표시하는 토스트 컴포넌트
 * @input message (string), onClose (function), onRetry (function, optional)
 * @output 에러 아이콘, 메시지, 재시도 버튼을 표시하는 토스트 UI (5초 후 자동 사라짐)
 * @external_dependencies
 *   - React hooks (useState, useEffect): 상태 관리 및 타이머 관리
 */

import { useEffect, useState } from 'react';
import './SyncErrorToast.css';

interface SyncErrorToastProps {
  message: string;
  onClose: () => void;
  onRetry?: () => void;
}

/**
 * 동기화 에러 시 알림 메시지를 표시하는 토스트 컴포넌트
 *
 * @param {SyncErrorToastProps} props - message, onClose, onRetry를 포함하는 props
 * @returns {JSX.Element} 토스트 알림 UI
 * @sideEffects
 *   - 5초 후 자동으로 사라짐
 *   - 타이머를 사용하여 onClose 콜백 호출
 */
export default function SyncErrorToast({ message, onClose, onRetry }: SyncErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 5초 후 자동 닫기 (에러 메시지는 조금 더 길게 표시)
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // 애니메이션 후 완전 제거
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div className={`sync-error-toast ${isVisible ? 'visible' : 'hidden'}`}>
      <div className="sync-error-toast-content">
        <div className="sync-error-toast-icon">⚠️</div>
        <div className="sync-error-toast-text">
          <div className="sync-error-toast-title">동기화 실패</div>
          <div className="sync-error-toast-message">{message}</div>
        </div>
        <div className="sync-error-toast-actions">
          {onRetry && (
            <button className="sync-error-retry-btn" onClick={handleRetry} title="재시도">
              🔄
            </button>
          )}
          <button className="sync-error-close-btn" onClick={handleClose} title="닫기">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
