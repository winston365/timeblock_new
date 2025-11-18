import { useEffect, useState } from 'react';

interface XPToastProps {
  xp: number;
  message?: string;
  onClose: () => void;
}

/**
 * XP reward toast that slides in for three seconds and automatically dismisses.
 */
export default function XPToast({ xp, message, onClose }: XPToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={[
        'fixed top-20 right-5 z-[9999] min-w-[280px] rounded-2xl',
        'bg-[linear-gradient(135deg,#667eea_0%,#764ba2_100%)]',
        'px-5 py-4 text-white shadow-lg transition-all duration-300',
        isVisible ? 'opacity-100 translate-x-0' : 'pointer-events-none opacity-0 translate-x-40',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl animate-bounce">🎉</div>
        <div className="flex flex-col gap-1">
          <div className="text-base font-semibold">
            {message || '축하합니다!'}
          </div>
          <div className="text-xl font-bold text-[#ffd700] drop-shadow">
            +{xp} XP
          </div>
        </div>
      </div>
    </div>
  );
}
