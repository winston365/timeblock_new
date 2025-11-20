import { useEffect, useState } from 'react';
import { ToastType } from '@/shared/stores/toastStore';

interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    onClose: () => void;
}

const TOAST_STYLES: Record<ToastType, { bg: string; icon: string; title: string; text: string }> = {
    success: {
        bg: 'bg-[linear-gradient(135deg,#10B981_0%,#059669_100%)]',
        icon: '✅',
        title: '성공',
        text: 'text-white'
    },
    error: {
        bg: 'bg-[linear-gradient(135deg,#EF4444_0%,#B91C1C_100%)]',
        icon: '🚫',
        title: '오류',
        text: 'text-white'
    },
    warning: {
        bg: 'bg-[linear-gradient(135deg,#F59E0B_0%,#D97706_100%)]',
        icon: '⚠️',
        title: '주의',
        text: 'text-white'
    },
    info: {
        bg: 'bg-[linear-gradient(135deg,#3B82F6_0%,#2563EB_100%)]',
        icon: 'ℹ️',
        title: '알림',
        text: 'text-white'
    }
};

export default function Toast({ id, message, type, onClose }: ToastProps) {
    const [isVisible, setIsVisible] = useState(true);
    const style = TOAST_STYLES[type];

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
                'pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5 transition-all duration-300',
                style.bg,
                style.text,
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            ].join(' ')}
            role="alert"
        >
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0 text-2xl">
                        {style.icon}
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-medium text-white/90">
                            {style.title}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                            {message}
                        </p>
                    </div>
                    <div className="ml-4 flex flex-shrink-0">
                        <button
                            type="button"
                            className="inline-flex rounded-md text-white/80 hover:text-white focus:outline-none"
                            onClick={() => {
                                setIsVisible(false);
                                setTimeout(onClose, 300);
                            }}
                        >
                            <span className="sr-only">Close</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L10 10 5.707 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
