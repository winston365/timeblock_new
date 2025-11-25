/**
 * AppToaster Component
 *
 * @role Toast 알림 설정 컴포넌트
 * @input 없음
 * @output Toaster 컴포넌트
 */

import { memo } from 'react';
import { Toaster } from 'react-hot-toast';

/**
 * 앱 전체 토스터 설정 컴포넌트
 */
function AppToasterComponent() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: '',
        style: {
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          color: '#333',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderRadius: '1rem',
          padding: '16px',
        },
        success: {
          iconTheme: {
            primary: '#10B981',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}

export const AppToaster = memo(AppToasterComponent);
